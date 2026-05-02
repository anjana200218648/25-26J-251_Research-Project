"""
Voice-to-Text Processing Module

This module handles voice complaint submission by converting audio input
to text using Whisper AI, enabling accessible complaint
submission for parents and guardians.

Key Features:
- Audio file validation and processing
- Speech-to-text conversion using OpenAI Whisper
- Text normalization and cleaning
- Error handling for audio quality issues
"""

import os
import io
import traceback
import tempfile
from typing import Dict, Optional, Tuple
from dotenv import load_dotenv
from contextlib import contextmanager
import sys
import os

# Load environment variables
load_dotenv()

# Check if Whisper is available
try:
    import whisper
    WHISPER_AVAILABLE = True
except ImportError:
    WHISPER_AVAILABLE = False
    print("Warning: openai-whisper not installed. Voice processing will not work.")
    print("Install with: pip install openai-whisper")


@contextmanager
def _quiet_stdio():
    """Context manager that silences stdout/stderr (Windows-safe version).
    
    Uses StringIO redirection instead of file descriptors to avoid
    Windows-specific errors with dup/dup2.
    """
    old_stdout = sys.stdout
    old_stderr = sys.stderr
    try:
        sys.stdout = io.StringIO()
        sys.stderr = io.StringIO()
        yield
    finally:
        sys.stdout = old_stdout
        sys.stderr = old_stderr


class VoiceProcessor:
    """
    Handles voice-based complaint input processing.
    
    Converts audio files to text and prepares them for ML analysis.
    """
    
    def __init__(self, model_size: Optional[str] = None):
        """
        Initialize the voice processor with Whisper model.

        Args:
            model_size: Whisper model size ("tiny", "base", "small", "medium", "large").
                        If not provided, the `VOICE_WHISPER_MODEL` env var is used
                        or falls back to "medium" for better accuracy on Sinhala.
        """
        if not WHISPER_AVAILABLE:
            raise ImportError(
                "openai-whisper library not installed. "
                "Install with: pip install openai-whisper"
            )
        # Decide model size: explicit arg -> env var -> default 'medium'
        if not model_size:
            model_size = os.environ.get('VOICE_WHISPER_MODEL', 'medium')

        # Check for local pre-downloaded model first (FASTER!)
        from config import WHISPER_LOCAL_MODEL_PATH
        
        # Initialize Whisper model (load quietly to avoid showing progress %) 
        try:
            if WHISPER_LOCAL_MODEL_PATH and os.path.exists(str(WHISPER_LOCAL_MODEL_PATH)):
                print(f"Loading Whisper model from local path: {WHISPER_LOCAL_MODEL_PATH}")
                with _quiet_stdio():
                    self.model = whisper.load_model(str(WHISPER_LOCAL_MODEL_PATH))
                print("Whisper model loaded from local file successfully (fast load)")
            else:
                print(f"Loading Whisper {model_size} model (downloading if needed)...")
                with _quiet_stdio():
                    self.model = whisper.load_model(model_size)
                print("Whisper model initialized successfully")
        except Exception as e:
            print(f"Warning: Failed to initialize Whisper model: {e}")
            self.model = None
        
        # Supported audio formats
        self.SUPPORTED_FORMATS = ['wav', 'mp3', 'ogg', 'flac', 'webm', 'mp4', 'm4a']
        # Allow larger uploads (up to ~2 minutes at reasonable bitrates)
        self.MAX_AUDIO_SIZE_MB = 20  # Maximum audio file size
        
    def process_audio_file(
        self, 
        audio_data: bytes, 
        file_extension: str,
        language_code: str = "auto"
    ) -> Dict:
        """
        Process audio file and convert to text using Whisper.
        
        Args:
            audio_data: Raw audio file bytes
            file_extension: File extension (wav, mp3, etc.)
            language_code: Language for recognition (default: "en", use "si" for Sinhala)
            
        Returns:
            Dict containing:
            - success: Boolean indicating success/failure
            - transcript: Extracted text from audio
            - confidence: Recognition confidence score (N/A for Whisper)
            - error: Error message if failed
        """
        
        # Validate model initialization
        if not self.model:
            return {
                'success': False,
                'transcript': '',
                'confidence': 0.0,
                'audio_duration': None,
                'error': 'Whisper model not initialized.'
            }
        
        # Validate file format
        if file_extension.lower() not in self.SUPPORTED_FORMATS:
            return {
                'success': False,
                'transcript': '',
                'confidence': 0.0,
                'audio_duration': None,
                'error': f'Unsupported format: {file_extension}. Supported: {", ".join(self.SUPPORTED_FORMATS)}'
            }
        
        # Validate file size
        size_mb = len(audio_data) / (1024 * 1024)
        if size_mb > self.MAX_AUDIO_SIZE_MB:
            return {
                'success': False,
                'transcript': '',
                'confidence': 0.0,
                'audio_duration': None,
                'error': f'File too large: {size_mb:.1f}MB. Maximum: {self.MAX_AUDIO_SIZE_MB}MB'
            }
        
        try:
            # Save audio data to temporary file
            with tempfile.NamedTemporaryFile(delete=False, suffix=f'.{file_extension}') as tmp_file:
                tmp_file.write(audio_data)
                tmp_path = tmp_file.name

            converted_path = tmp_path
            audio_duration = None
            
            # If container is webm/mp4/ogg etc, convert to WAV 16k mono for Whisper
            try:
                import subprocess
                
                # Get audio duration using ffprobe
                try:
                    ffprobe_cmd = [
                        'ffprobe', '-v', 'error', '-show_entries', 
                        'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', 
                        tmp_path
                    ]
                    duration_output = subprocess.run(
                        ffprobe_cmd, 
                        check=True, 
                        stdout=subprocess.PIPE, 
                        stderr=subprocess.PIPE,
                        text=True
                    )
                    audio_duration = float(duration_output.stdout.strip())
                    print(f"Audio duration: {audio_duration:.2f} seconds")
                except Exception as dur_e:
                    print(f"Could not extract audio duration: {dur_e}")
                
                # Convert format if needed
                if file_extension.lower() in ['webm', 'ogg', 'mp4', 'm4a']:
                    conv_fd, conv_path = tempfile.mkstemp(suffix='.wav')
                    os.close(conv_fd)
                    ffmpeg_cmd = [
                        'ffmpeg', '-y', '-i', tmp_path,
                        '-acodec', 'pcm_s16le', '-ar', '16000', '-ac', '1', conv_path
                    ]
                    try:
                        subprocess.run(ffmpeg_cmd, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
                        converted_path = conv_path
                        print(f"Converted input {tmp_path} -> {converted_path} for Whisper")
                    except Exception as conv_e:
                        print(f"FFmpeg conversion failed: {conv_e}. Proceeding with original file.")

            except Exception as e_conv:
                print(f"Conversion check failed: {e_conv}")

            try:
                # Perform speech recognition with Whisper
                print(f"Processing audio ({size_mb:.2f}MB, format: {file_extension})...")

                # Determine whether to force language or allow Whisper auto-detection
                whisper_lang = None
                if language_code and language_code.lower() not in ['auto', 'detect', '']:
                    # Convert language code format (en-US -> en, si-LK -> si)
                    whisper_lang = language_code.split('-')[0] if '-' in language_code else language_code

                # Call Whisper: omit language to enable auto-detection when whisper_lang is None
                if whisper_lang:
                    result = self.model.transcribe(
                        converted_path,
                        language=whisper_lang,
                        fp16=False  # Disable FP16 for CPU compatibility
                    )
                else:
                    result = self.model.transcribe(
                        converted_path,
                        fp16=False
                    )

                transcript = result.get("text", "").strip()
                
                # Check if transcript is empty
                if not transcript:
                    return {
                        'success': False,
                        'transcript': '',
                        'confidence': 0.0,
                        'audio_duration': audio_duration,
                        'error': 'No speech detected in audio. Please ensure clear audio with minimal background noise.'
                    }
                
                # Clean and normalize transcript
                cleaned_transcript = self._clean_transcript(transcript)
                
                print(f"Speech recognition successful. Transcript: {cleaned_transcript[:50]}...")
                
                return {
                    'success': True,
                    'transcript': cleaned_transcript,
                    'confidence': 1.0,  # Whisper doesn't provide confidence scores
                    'audio_duration': audio_duration,  # Duration in seconds
                    'error': None
                }
                
            finally:
                # Clean up temporary files
                try:
                    if os.path.exists(tmp_path):
                        os.unlink(tmp_path)
                except:
                    pass
                try:
                    if converted_path != tmp_path and os.path.exists(converted_path):
                        os.unlink(converted_path)
                except:
                    pass
            
        except Exception as e:
            print(f"Error during speech recognition: {str(e)}")
            traceback.print_exc()
            return {
                'success': False,
                'transcript': '',
                'confidence': 0.0,
                'audio_duration': None,
                'error': f'Speech recognition failed: {str(e)}'
            }
    
    def _clean_transcript(self, text: str) -> str:
        """
        Clean and normalize transcribed text.
        
        Removes extra whitespace, fixes common transcription issues.
        
        Args:
            text: Raw transcript text
            
        Returns:
            Cleaned and normalized text
        """
        import re
        
        if not text:
            return ""
        
        # Remove extra whitespace
        text = re.sub(r'\s+', ' ', text).strip()
        
        # Capitalize first letter
        if text:
            text = text[0].upper() + text[1:]
        
        # Ensure ends with punctuation
        if text and text[-1] not in '.!?':
            text += '.'
        
        return text
    
    def validate_audio_quality(self, audio_data: bytes) -> Tuple[bool, str]:
        """
        Perform basic audio quality validation.
        
        Checks for:
        - Minimum duration
        - File corruption
        - Silence detection
        
        Args:
            audio_data: Raw audio bytes
            
        Returns:
            Tuple of (is_valid, error_message)
        """
        # Basic size validation
        if len(audio_data) < 1000:  # Less than 1KB likely invalid
            return False, "Audio file too small. Minimum recording duration not met."
        
        # Check for empty/silent audio (more sophisticated check would use audio analysis)
        # For now, just basic validation
        return True, ""


def process_voice_complaint(
    audio_data: bytes,
    file_extension: str,
    language: str = "en"
) -> Dict:
    """
    High-level function to process voice complaint.
    
    Wrapper function that handles the complete voice-to-text pipeline.
    
    Args:
        audio_data: Audio file bytes
        file_extension: File extension
        language: Recognition language code (e.g., "en" for English, "si" for Sinhala)
        
    Returns:
        Dict with transcript and processing status
    """
    try:
        processor = VoiceProcessor()
        
        # Validate audio quality first
        is_valid, error_msg = processor.validate_audio_quality(audio_data)
        if not is_valid:
            return {
                'success': False,
                'transcript': '',
                'confidence': 0.0,
                'audio_duration': None,
                'error': error_msg
            }
        
        # Process audio to text
        result = processor.process_audio_file(
            audio_data=audio_data,
            file_extension=file_extension,
            language_code=language
        )
        
        return result
        
    except ImportError as e:
        return {
            'success': False,
            'transcript': '',
            'confidence': 0.0,
            'audio_duration': None,
            'error': 'Voice processing not available. Missing dependencies.'
        }
    except Exception as e:
        return {
            'success': False,
            'transcript': '',
            'confidence': 0.0,
            'audio_duration': None,
            'error': f'Voice processing error: {str(e)}'
        }
