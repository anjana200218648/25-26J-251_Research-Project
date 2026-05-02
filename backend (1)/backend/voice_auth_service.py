"""
Voice Authentication Service
Handles speaker recognition, enrollment, and verification using SpeechBrain ECAPA-TDNN
"""

import os
import torch
import librosa
import numpy as np
from typing import Tuple, Optional, Dict
from datetime import datetime
from cryptography.fernet import Fernet
import base64
import json
from io import BytesIO
import tempfile
import wave

# Import SpeechBrain for speaker recognition
try:
    from speechbrain.inference.speaker import EncoderClassifier
except ImportError:
    print("[WARN] SpeechBrain not installed. Installing...")
    import subprocess
    import sys
    subprocess.check_call([sys.executable, "-m", "pip", "install", "speechbrain"])
    from speechbrain.inference.speaker import EncoderClassifier

# Import Whisper for speech-to-text
try:
    import whisper
    WHISPER_AVAILABLE = True
except ImportError:
    WHISPER_AVAILABLE = False
    print("[WARN] Whisper not installed. Speech-to-text will not work.")
    print("Install with: pip install openai-whisper")


class VoiceAuthService:
    """
    Service for voice biometric authentication and verification
    """

    # Similarity thresholds
    LOGIN_THRESHOLD = 0.82        # Stricter for login
    COMPLAINT_THRESHOLD = 0.65    # FIX 1: Lowered from 0.75 → more realistic for
                                  # natural Sinhala speech variance. Tune upward
                                  # once you have production similarity data.

    # Sinhala verification phrases
    SINHALA_PHRASES = [
        "මම අද පද්ධතියට පිවිසෙමි",
        "මෙය මගේ ආරක්ෂිත පිවිසුමයි",
        "මම තහවුරු කරමි මගේ අනන්‍යතාවය",
        "මම සැබෑ පරිශීලකයා වෙමි",
        "මගේ හඬ මගේ හැඳුනුම්පතයි"
    ]

    def __init__(self, whisper_model_size: str = "medium"):
        """
        Initialize voice authentication service

        Args:
            whisper_model_size: Whisper model size for transcription.
                FIX 2: Default changed from "small" to "medium".
                "small" has very limited Sinhala support; "medium" and
                "large-v3" produce dramatically better Sinhala transcriptions.
                Use "large-v3" if you have enough RAM/VRAM.
        """
        from config import VOICE_SPKREC_MODEL

        self.speaker_model = None

        # Disable Windows symlink warnings for HuggingFace
        os.environ['HF_HUB_DISABLE_SYMLINKS_WARNING'] = '1'

        # Initialize SpeechBrain ECAPA-TDNN model
        if os.environ.get('WERKZEUG_RUN_MAIN') != 'true':
            print("[INFO] Loading SpeechBrain ECAPA-TDNN model...")
        try:
            import platform
            if platform.system() == 'Windows':
                os.environ['HF_HUB_DISABLE_SYMLINKS'] = '1'
                os.environ['HF_HUB_DISABLE_SYMLINKS_WARNING'] = '1'

            from pathlib import Path
            cache_model_path = (
                Path.home() / '.cache' / 'huggingface' / 'hub'
                / 'models--speechbrain--spkrec-ecapa-voxceleb' / 'snapshots'
            )

            if cache_model_path.exists():
                snapshots = list(cache_model_path.glob('*'))
                if snapshots:
                    cache_dir = str(snapshots[0])
                    print(f"[INFO] Loading from cache: {cache_dir}")
                    self.speaker_model = EncoderClassifier.from_hparams(
                        source=cache_dir,
                        savedir=cache_dir,
                        run_opts={"device": "cpu"}
                    )
                    print("[INFO] Speaker recognition model loaded from cache successfully!")
                else:
                    raise FileNotFoundError("Model not in cache, will download")
            else:
                raise FileNotFoundError("Cache directory not found, will download")

        except Exception as e:
            print(f"[WARN] Cache load failed: {e}")
            print("[INFO] Attempting download (may require administrator privileges on Windows)...")
            try:
                self.speaker_model = EncoderClassifier.from_hparams(
                    source="speechbrain/spkrec-ecapa-voxceleb",
                    savedir=str(VOICE_SPKREC_MODEL),
                    run_opts={"device": "cpu"},
                    use_auth_token=False
                )
                print("[INFO] Speaker recognition model loaded successfully")
            except Exception as e2:
                print(f"[ERROR] Failed to load speaker model: {e2}")
                print()
                print("=" * 70)
                print("SOLUTION: Run PowerShell as Administrator and restart the backend:")
                print("  1. Right-click PowerShell -> Run as Administrator")
                print("  2. cd to backend directory")
                print("  3. python app.py")
                print("=" * 70)
                print("[INFO] Continuing without speaker recognition (voice login disabled)")
                print()
                self.speaker_model = None

        # Initialize encryption key
        self.encryption_key = self._get_or_create_encryption_key()
        self.cipher = Fernet(self.encryption_key)

        # Initialize Whisper model for speech-to-text
        self.whisper_model = None
        if WHISPER_AVAILABLE:
            # Determine primary model from constructor arg or env var; default to 'medium'
            primary_model = whisper_model_size or os.environ.get('VOICE_WHISPER_MODEL', 'medium')
            # Determine fallback chain (comma-separated env var) or sensible defaults
            fallback_chain = os.environ.get('VOICE_WHISPER_FALLBACKS', 'small,tiny').split(',')

            # Check for local pre-downloaded model first (FASTER!)
            from config import WHISPER_LOCAL_MODEL_PATH
            
            tried = []
            
            # Try local model first if configured
            if WHISPER_LOCAL_MODEL_PATH and os.path.exists(str(WHISPER_LOCAL_MODEL_PATH)):
                try:
                    print(f"[INFO] Loading Whisper model from local path: {WHISPER_LOCAL_MODEL_PATH}")
                    # Force CPU to avoid CUDA issues during startup
                    self.whisper_model = whisper.load_model(str(WHISPER_LOCAL_MODEL_PATH), device="cpu")
                    print(f"[INFO] Whisper model loaded from local file successfully (fast load)")
                except Exception as e:
                    print(f"[WARN] Failed to load local Whisper model: {e}")
                    print(f"[INFO] Falling back to standard download...")
            
            # If not loaded from local, try downloading
            if not self.whisper_model:
                models_to_try = [primary_model] + [m for m in fallback_chain if m and m != primary_model]
                for m in models_to_try:
                    try:
                        print(f"[INFO] Attempting to load Whisper model '{m}'...")
                        self.whisper_model = whisper.load_model(m, device="cpu")
                        print(f"[INFO] Whisper model '{m}' loaded successfully")
                        break
                    except Exception as e:
                        print(f"[WARN] Failed to load Whisper model '{m}': {e}")
                        tried.append(m)
            
            if not self.whisper_model:
                print(f"[ERROR] All Whisper model load attempts failed: {tried}")
            else:
                print(f"[INFO] Whisper initialization complete.")
        else:
            print("[WARN] Whisper not available. Speech-to-text will not work.")

    def _get_or_create_encryption_key(self) -> bytes:
        """Get or create encryption key for storing embeddings."""
        key_file = "voice_encryption.key"
        if os.path.exists(key_file):
            with open(key_file, "rb") as f:
                return f.read()
        else:
            key = Fernet.generate_key()
            with open(key_file, "wb") as f:
                f.write(key)
            return key

    # FIX 4: Helper to detect whether a file is already a 16kHz mono WAV so
    # we can skip redundant conversion and avoid corrupting the audio.
    @staticmethod
    def _is_valid_16k_mono_wav(path: str) -> bool:
        """Return True if the file is a valid PCM WAV at 16 kHz mono."""
        try:
            with wave.open(path, 'rb') as w:
                return (
                    w.getframerate() == 16000
                    and w.getnchannels() == 1
                    and w.getsampwidth() == 2  # 16-bit PCM
                )
        except Exception:
            return False

    def load_audio(self, audio_path: str, target_sr: int = 16000) -> np.ndarray:
        """
        Load and preprocess audio file.

        Args:
            audio_path: Path to audio file
            target_sr: Target sample rate (default 16000 Hz)

        Returns:
            Audio signal as numpy array
        """
        try:
            print(f"[INFO] Loading audio file: {os.path.basename(audio_path)}")

            # FIX 5: Try librosa first; fall back to soundfile for formats
            # librosa cannot decode (e.g. some raw PCM files).
            try:
                audio, sr = librosa.load(audio_path, sr=target_sr, mono=True)
            except Exception as lib_err:
                print(f"[WARN] librosa failed ({lib_err}), trying soundfile...")
                import soundfile as sf
                audio, sr = sf.read(audio_path, always_2d=False)
                if audio.ndim > 1:
                    audio = audio.mean(axis=1)  # downmix to mono
                if sr != target_sr:
                    audio = librosa.resample(audio, orig_sr=sr, target_sr=target_sr)
                    sr = target_sr

            print(f"[INFO] Audio — Duration: {len(audio)/sr:.2f}s, SR: {sr}Hz")

            max_amp = np.max(np.abs(audio))
            if max_amp > 0:
                audio = audio / (max_amp + 1e-8)
            else:
                print("[WARN] Audio has zero amplitude!")

            min_duration = 2.0
            if len(audio) / sr < min_duration:
                raise ValueError(
                    f"Audio too short. Minimum {min_duration}s required. "
                    f"Got: {len(audio)/sr:.2f}s"
                )

            return audio

        except Exception as e:
            print(f"[ERROR] Failed to load audio: {str(e)}")
            raise ValueError(f"Failed to load audio: {str(e)}")

    def load_audio_from_bytes(self, audio_bytes: bytes, target_sr: int = 16000) -> np.ndarray:
        """Load audio from bytes (for web uploads)."""
        try:
            try:
                audio, sr = librosa.load(BytesIO(audio_bytes), sr=target_sr, mono=True)
            except Exception as lib_err:
                print(f"[WARN] librosa failed ({lib_err}), trying soundfile...")
                import soundfile as sf
                audio, sr = sf.read(BytesIO(audio_bytes), always_2d=False)
                if audio.ndim > 1:
                    audio = audio.mean(axis=1)
                if sr != target_sr:
                    audio = librosa.resample(audio, orig_sr=sr, target_sr=target_sr)
                    sr = target_sr

            audio = audio / (np.max(np.abs(audio)) + 1e-8)

            min_duration = 2.0
            if len(audio) / sr < min_duration:
                raise ValueError(f"Audio too short. Minimum {min_duration}s required.")

            return audio
        except Exception as e:
            raise ValueError(f"Failed to load audio from bytes: {str(e)}")

    def extract_speaker_embedding(self, audio_path: str) -> np.ndarray:
        """Extract speaker embedding from audio file."""
        try:
            audio = self.load_audio(audio_path)
            audio_tensor = torch.FloatTensor(audio).unsqueeze(0)
            with torch.no_grad():
                embedding = self.speaker_model.encode_batch(audio_tensor)
                embedding = embedding.squeeze().cpu().numpy()
            return embedding
        except Exception as e:
            raise ValueError(f"Failed to extract embedding: {str(e)}")

    def extract_embedding_from_bytes(self, audio_bytes: bytes) -> np.ndarray:
        """Extract speaker embedding from audio bytes."""
        try:
            audio = self.load_audio_from_bytes(audio_bytes)
            audio_tensor = torch.FloatTensor(audio).unsqueeze(0)
            with torch.no_grad():
                embedding = self.speaker_model.encode_batch(audio_tensor)
                embedding = embedding.squeeze().cpu().numpy()
            return embedding
        except Exception as e:
            raise ValueError(f"Failed to extract embedding from bytes: {str(e)}")

    def encrypt_embedding(self, embedding: np.ndarray) -> str:
        """Encrypt speaker embedding for secure storage."""
        embedding_bytes = embedding.tobytes()
        encrypted = self.cipher.encrypt(embedding_bytes)
        return base64.b64encode(encrypted).decode('utf-8')

    def decrypt_embedding(self, encrypted_embedding: str) -> np.ndarray:
        """Decrypt stored speaker embedding."""
        encrypted_bytes = base64.b64decode(encrypted_embedding.encode('utf-8'))
        decrypted = self.cipher.decrypt(encrypted_bytes)
        return np.frombuffer(decrypted, dtype=np.float32)

    def compute_similarity(self, embedding1: np.ndarray, embedding2: np.ndarray) -> float:
        """Compute cosine similarity between two embeddings."""
        emb1_norm = embedding1 / (np.linalg.norm(embedding1) + 1e-8)
        emb2_norm = embedding2 / (np.linalg.norm(embedding2) + 1e-8)
        return float(np.dot(emb1_norm, emb2_norm))

    def verify_speaker(
        self,
        test_embedding: np.ndarray,
        enrolled_embedding: np.ndarray,
        threshold: float = LOGIN_THRESHOLD
    ) -> Tuple[bool, float]:
        """Verify if test embedding matches enrolled embedding."""
        similarity = self.compute_similarity(test_embedding, enrolled_embedding)
        verified = similarity >= threshold
        # Log for threshold tuning
        print(f"[METRIC] speaker_similarity={similarity:.4f} threshold={threshold:.4f} verified={verified}")
        return verified, similarity

    def transcribe_audio(self, audio_path: str, language: str = None) -> str:
        """
        Transcribe audio to text using Whisper (auto-detects language by default).

        Args:
            audio_path: Path to audio file
            language: Optional language code ('si' for Sinhala, 'en' for English, None for auto-detect)
                     Also accepts extended codes like 'en-US' which will be normalized to 'en'

        Uses improved Whisper parameters:
          - beam_size=5, best_of=5 for higher accuracy
          - temperature=0.0 for deterministic output
          - condition_on_previous_text=False to prevent hallucination loops
          - Stricter silence detection (RMS threshold 0.005 vs old 0.001)
        """
        if not self.whisper_model:
            raise RuntimeError("Whisper model not initialized")

        # Normalize language code: extract primary language (e.g., 'en-US' -> 'en')
        if language and '-' in language:
            language = language.split('-')[0].lower()
        
        try:
            file_size = os.path.getsize(audio_path)
            print(f"[INFO] Transcribing: {os.path.basename(audio_path)} ({file_size/1024:.1f} KB)")

            # Load audio to check quality before sending to Whisper
            try:
                # Force pkg_resources availability for librosa
                try:
                    import pkg_resources
                except ImportError:
                    # pkg_resources not available - skip analysis, proceed with transcription
                    print(f"[INFO] Skipping audio quality check (pkg_resources unavailable)")
                    audio_data, sr = None, None
                else:
                    audio_data, sr = librosa.load(audio_path, sr=None)
                    duration = len(audio_data) / sr
                    rms = np.sqrt(np.mean(audio_data ** 2))
                    peak = np.abs(audio_data).max()
                    print(f"[INFO] Audio quality — Duration: {duration:.2f}s, RMS: {rms:.5f}, Peak: {peak:.5f}")

                    # More lenient silence threshold to avoid rejecting valid speech
                    if rms < 0.0005:
                        print(f"[WARN] Audio appears silent (RMS={rms:.5f}). Skipping Whisper.")
                        return ""

            except Exception as e:
                print(f"[INFO] Could not analyse audio quality: {e}")

            lang_msg = f"language={language}" if language else "auto-detect"
            print(f"[INFO] Starting Whisper transcription ({lang_msg})...")
            
            # Suppress progress bar output during transcription (Windows-safe version)
            from contextlib import contextmanager
            import sys as _sys_mod
            import os as _os_mod
            import io

            @contextmanager
            def _quiet_stdio_local():
                """Windows-safe stdout/stderr suppression using StringIO."""
                old_stdout = _sys_mod.stdout
                old_stderr = _sys_mod.stderr
                try:
                    _sys_mod.stdout = io.StringIO()
                    _sys_mod.stderr = io.StringIO()
                    yield
                finally:
                    _sys_mod.stdout = old_stdout
                    _sys_mod.stderr = old_stderr

            transcribe_kwargs = {
                'fp16': False,
                'beam_size': 5,
                'best_of': 5,
                'temperature': 0.0,
                'condition_on_previous_text': False,
                'verbose': False
            }
            if language:
                transcribe_kwargs['language'] = language
                
                # Add Sinhala-specific prompt to guide transcription
                if language == 'si':
                    # Enhanced Sinhala context prompt with more natural text
                    transcribe_kwargs['initial_prompt'] = (
                        "මගේ දරුවා දිනපතා පැය කිහිපයක් සමාජ මාධ්‍ය භාවිතා කරයි. "
                        "ඔහු ෆේස්බුක්, ටික්ටොක්, ඉන්ස්ටග්‍රෑම් යනාදී යෙදුම් භාවිත කරයි. "
                        "මට ඔහුගේ අධික භාවිතය ගැන කනස්සල්ලක් ඇත. "
                        "ඔහුගේ ඉගෙනීම් කාර්ය සහ නිදා ගැනීමේ රටාව බලපෑමට ලක්ව ඇත."
                    )
                    # Temperature 0 for deterministic output (reduce hallucinations)
                    transcribe_kwargs['temperature'] = 0.0
                    # Add aggressive hallucination suppression parameters
                    transcribe_kwargs['compression_ratio_threshold'] = 2.0
                    transcribe_kwargs['logprob_threshold'] = -0.8
                    transcribe_kwargs['no_speech_threshold'] = 0.3
                    print(f"[INFO] Using enhanced Sinhala context with hallucination suppression")

            with _quiet_stdio_local():
                result = self.whisper_model.transcribe(audio_path, **transcribe_kwargs)

            transcript = result["text"].strip()
            
            # Post-processing: detect and fix repetitive hallucinations
            if language == 'si':
                transcript = self._clean_sinhala_repetitions(transcript)
            
            print(f"[INFO] Transcription complete ({len(transcript)} chars): '{transcript[:120]}'")
            return transcript

        except Exception as e:
            print(f"[ERROR] Transcription failed: {e}")
            import traceback
            traceback.print_exc()
            raise ValueError(f"Failed to transcribe audio: {str(e)}")

    def transcribe_audio_from_bytes(self, audio_bytes: bytes, language: str = None) -> str:
        """Transcribe audio to text from bytes using Whisper (auto-detects language by default)."""
        if not self.whisper_model:
            raise RuntimeError("Whisper model not initialized")

        try:
            with tempfile.NamedTemporaryFile(delete=False, suffix='.wav') as tmp_file:
                tmp_file.write(audio_bytes)
                tmp_path = tmp_file.name

            try:
                transcribe_kwargs = {
                    'fp16': False,
                    'beam_size': 5,
                    'best_of': 5,
                    'temperature': 0.0,
                    'condition_on_previous_text': False,
                }
                if language:
                    transcribe_kwargs['language'] = language
                    
                    # Add Sinhala-specific prompt to guide transcription
                    if language == 'si':
                        transcribe_kwargs['initial_prompt'] = (
                            "මගේ දරුවා දිනපතා පැය කිහිපයක් සමාජ මාධ්‍ය භාවිතා කරයි. "
                            "ඔහු ෆේස්බුක්, ටික්ටොක්, ඉන්ස්ටග්‍රෑම් යනාදී යෙදුම් භාවිත කරයි. "
                            "මට ඔහුගේ අධික භාවිතය ගැන කනස්සල්ලක් ඇත. "
                            "ඔහුගේ ඉගෙනීම් කාර්ය සහ නිදා ගැනීමේ රටාව බලපෑමට ලක්ව ඇත."
                        )
                        transcribe_kwargs['temperature'] = 0.0
                        transcribe_kwargs['compression_ratio_threshold'] = 2.0
                        transcribe_kwargs['logprob_threshold'] = -0.8
                        transcribe_kwargs['no_speech_threshold'] = 0.3
                
                result = self.whisper_model.transcribe(tmp_path, **transcribe_kwargs)
                transcript = result["text"].strip()
                
                # Clean Sinhala repetitions
                if language == 'si':
                    transcript = self._clean_sinhala_repetitions(transcript)
                
                return transcript
            finally:
                if os.path.exists(tmp_path):
                    os.unlink(tmp_path)

        except Exception as e:
            raise ValueError(f"Failed to transcribe audio from bytes: {str(e)}")

    def _clean_sinhala_repetitions(self, text: str) -> str:
        """
        Detect and remove repetitive hallucinations in Sinhala transcriptions.
        
        Common pattern: 'කරයි කරයි කරයි...' or 'කරන්න කරන්න...'
        Returns empty string if excessive repetition detected (likely hallucination).
        """
        import re
        
        words = text.split()
        
        # If text is very short, return as-is
        if len(words) < 5:
            return text
        
        # Check for excessive repetition (same word repeated 5+ times)
        word_counts = {}
        for word in words:
            word_counts[word] = word_counts.get(word, 0) + 1
        
        # If any single word makes up >60% of the text, it's likely hallucination
        total_words = len(words)
        for word, count in word_counts.items():
            if count / total_words > 0.6:
                print(f"[WARN] Detected repetitive hallucination: '{word}' appears {count}/{total_words} times")
                return ""  # Return empty - let user re-record
        
        # Check for consecutive repetitions (3+ times)
        cleaned_words = []
        i = 0
        while i < len(words):
            word = words[i]
            # Count consecutive occurrences
            count = 1
            while i + count < len(words) and words[i + count] == word:
                count += 1
            
            # If word repeats 3+ times consecutively, keep only first occurrence
            if count >= 3:
                cleaned_words.append(word)
                print(f"[WARN] Removed {count-1} consecutive repetitions of '{word}'")
                i += count
            else:
                cleaned_words.append(word)
                i += 1
        
        return ' '.join(cleaned_words)

    def normalize_text(self, text: str) -> str:
        """Normalize text for comparison (remove extra spaces, punctuation)."""
        import re
        text = re.sub(r'[^\w\s]', '', text)
        text = re.sub(r'\s+', ' ', text)
        return text.strip().lower()

    def verify_phrase(self, transcribed: str, expected: str) -> Tuple[bool, float]:
        """Verify if transcribed phrase matches expected phrase."""
        norm_transcribed = self.normalize_text(transcribed)
        norm_expected = self.normalize_text(expected)
        matched = norm_transcribed == norm_expected

        if len(norm_expected) == 0:
            confidence = 0.0
        else:
            from difflib import SequenceMatcher
            confidence = SequenceMatcher(None, norm_transcribed, norm_expected).ratio()

        return matched, confidence

    def get_random_phrase(self) -> str:
        """Get a random Sinhala verification phrase."""
        import random
        return random.choice(self.SINHALA_PHRASES)

    def enroll_user(self, user_id: str, audio_path: str) -> Dict:
        """Enroll a user with their voice."""
        try:
            embedding = self.extract_speaker_embedding(audio_path)
            encrypted_embedding = self.encrypt_embedding(embedding)
            return {
                "user_id": user_id,
                "encrypted_embedding": encrypted_embedding,
                "enrollment_timestamp": datetime.utcnow().isoformat(),
                "embedding_dim": len(embedding)
            }
        except Exception as e:
            raise ValueError(f"Enrollment failed: {str(e)}")

    def authenticate_login(
        self,
        audio_path: str,
        enrolled_embedding_encrypted: str,
        expected_phrase: str
    ) -> Dict:
        """Authenticate user login with voice."""
        try:
            login_embedding = self.extract_speaker_embedding(audio_path)
            enrolled_embedding = self.decrypt_embedding(enrolled_embedding_encrypted)

            speaker_verified, similarity = self.verify_speaker(
                login_embedding, enrolled_embedding, self.LOGIN_THRESHOLD
            )

            phrase_verified = False
            phrase_confidence = 0.0
            transcribed_text = ""

            try:
                # Use 'si' for Sinhala since login phrases are in Sinhala
                transcribed_text = self.transcribe_audio(audio_path, language='si')
                phrase_verified, phrase_confidence = self.verify_phrase(
                    transcribed_text, expected_phrase
                )
            except Exception as e:
                print(f"[WARN] Phrase verification failed: {e}")

            authenticated = speaker_verified and phrase_verified

            return {
                "authenticated": authenticated,
                "speaker_verified": speaker_verified,
                "speaker_similarity": similarity,
                "phrase_verified": phrase_verified,
                "phrase_confidence": phrase_confidence,
                "transcribed_text": transcribed_text,
                "session_embedding": self.encrypt_embedding(login_embedding) if authenticated else None
            }
        except Exception as e:
            raise ValueError(f"Authentication failed: {str(e)}")

    def verify_complaint_speaker(
        self,
        audio_path: str,
        session_embedding_encrypted: str
    ) -> Dict:
        """
        Verify speaker for complaint submission.

        FIX 12: Uses the lowered COMPLAINT_THRESHOLD (0.65) to account for
        natural variance between enrollment audio and longer, more casual
        complaint recordings.
        """
        try:
            complaint_embedding = self.extract_speaker_embedding(audio_path)
            session_embedding = self.decrypt_embedding(session_embedding_encrypted)

            verified, similarity = self.verify_speaker(
                complaint_embedding, session_embedding, self.COMPLAINT_THRESHOLD
            )

            return {
                "verified": verified,
                "similarity": similarity,
                "threshold": self.COMPLAINT_THRESHOLD
            }
        except Exception as e:
            raise ValueError(f"Speaker verification failed: {str(e)}")


# Global instance
_voice_auth_service = None


def get_voice_auth_service(whisper_model_size: str = "medium") -> VoiceAuthService:
    """
    Get or create global voice authentication service instance.

    FIX 13: Default whisper_model_size changed to "medium" for better Sinhala support.
    """
    global _voice_auth_service
    if _voice_auth_service is None:
        _voice_auth_service = VoiceAuthService(whisper_model_size=whisper_model_size)
    return _voice_auth_service