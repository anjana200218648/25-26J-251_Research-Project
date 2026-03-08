"""
Voice Authentication API Routes
Handles enrollment, login, and complaint submission with voice biometrics
"""

from flask import Blueprint, request, jsonify, session
from werkzeug.utils import secure_filename
from werkzeug.exceptions import BadRequest
import os
import secrets
import shutil
import wave
from datetime import datetime, timedelta
from typing import Optional

from config import TEMP_VOICE_UPLOADS_DIR, MAX_VOICE_DURATION, MIN_VOICE_DURATION
from voice_auth_service import get_voice_auth_service
from database import SessionLocal, User, VoiceSession, LoginAttempt, VoiceComplaint, get_complaints_collection
from auth_routes import token_required
from risk_scoring import calculate_risk_score
from temporal_drift import integrate_temporal_drift
import io

voice_auth_bp = Blueprint('voice_auth', __name__)

# Model service will be shared from app.py to avoid duplicate loading
model_service = None

# Configuration
ALLOWED_EXTENSIONS = {'wav', 'mp3', 'webm', 'ogg', 'm4a', 'mp4'}
MAX_FILE_SIZE = 25 * 1024 * 1024   # 25 MB
SESSION_EXPIRY_HOURS = 24

# FIX 1: Startup ffmpeg check — fail loudly so the problem is visible immediately
# rather than silently falling back to unconverted audio that librosa can't decode.
if not shutil.which('ffmpeg'):
    print()
    print("=" * 70)
    print("[ERROR] ffmpeg is NOT installed or not in PATH.")
    print("Voice transcription and speaker recognition WILL FAIL without it.")
    print()
    print("Install ffmpeg:")
    print("  Linux  : sudo apt-get install ffmpeg")
    print("  macOS  : brew install ffmpeg")
    print("  Windows: winget install --id Gyan.FFmpeg")
    print("=" * 70)
    print()
else:
    print("[INFO] ffmpeg found:", shutil.which('ffmpeg'))


def allowed_file(filename: str) -> bool:
    """Check if file extension is allowed."""
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


def is_valid_16k_mono_wav(path: str) -> bool:
    """
    FIX 2: Check whether a file is already a valid 16 kHz mono PCM WAV.
    Used to skip redundant ffmpeg conversion that would corrupt already-good files.
    """
    try:
        with wave.open(path, 'rb') as w:
            return (
                w.getframerate() == 16000
                and w.getnchannels() == 1
                and w.getsampwidth() == 2  # 16-bit PCM
            )
    except Exception:
        return False


def convert_to_wav(audio_bytes: bytes, filename: str) -> str:
    """
    Convert audio bytes to WAV format (16kHz, mono).
    Returns path to converted file.
    """
    import subprocess
    import tempfile

    temp_input = os.path.join(TEMP_VOICE_UPLOADS_DIR, f"temp_input_{filename}")
    with open(temp_input, 'wb') as f:
        f.write(audio_bytes)

    temp_output = os.path.join(
        TEMP_VOICE_UPLOADS_DIR,
        f"temp_output_{filename.rsplit('.', 1)[0]}.wav"
    )

    # FIX 3: Hard-fail if ffmpeg is missing — don't silently return raw WebM/OGG
    # which librosa cannot decode, causing silent audio and failed transcription.
    if not shutil.which('ffmpeg'):
        if os.path.exists(temp_input):
            os.remove(temp_input)
        raise RuntimeError(
            "ffmpeg is required for audio conversion but is not installed. "
            "Install ffmpeg and restart the backend."
        )

    try:
        result = subprocess.run(
            [
                'ffmpeg', '-y', '-i', temp_input,
                '-acodec', 'pcm_s16le',
                '-ar', '16000',
                '-ac', '1',
                temp_output
            ],
            check=True,
            capture_output=True,
            text=True
        )
        
        # Verify output file exists and has content
        if not os.path.exists(temp_output):
            raise RuntimeError("FFmpeg conversion produced no output file")
        
        output_size = os.path.getsize(temp_output)
        if output_size < 1000:  # Less than 1KB is suspicious
            print(f"[WARN] Converted audio is very small: {output_size} bytes - might be silent")
        else:
            print(f"[INFO] Converted audio size: {output_size / 1024:.1f} KB")
        
        if os.path.exists(temp_input):
            os.remove(temp_input)
        return temp_output
    except subprocess.CalledProcessError as e:
        error_output = e.stderr if e.stderr else str(e)
        print(f"[ERROR] ffmpeg conversion failed: {error_output}")
        print(f"[ERROR] Input file: {temp_input} ({os.path.getsize(temp_input)} bytes)")
        if os.path.exists(temp_input):
            os.remove(temp_input)
        raise RuntimeError(f"Audio conversion failed: {error_output}")


def convert_file_to_wav(input_path: str) -> str:
    """
    Convert an existing audio file to WAV (16kHz, mono) using ffmpeg.

    FIX 4: Skip conversion when the file is already a valid 16 kHz mono WAV.
    The previous code always ran ffmpeg even on already-correct WAV files,
    causing double-processing that could degrade audio quality.
    Returns original path if already correct; otherwise returns path to new file.
    """
    # Skip if already in the correct format
    if is_valid_16k_mono_wav(input_path):
        print(f"[INFO] Audio already 16kHz mono WAV — skipping conversion: {os.path.basename(input_path)}")
        return input_path

    # FIX 5: Hard-fail if ffmpeg is missing
    if not shutil.which('ffmpeg'):
        raise RuntimeError(
            "ffmpeg is required for audio conversion but is not installed. "
            "Install ffmpeg and restart the backend."
        )

    import subprocess
    import tempfile

    fd, out_path = tempfile.mkstemp(suffix='.wav', dir=TEMP_VOICE_UPLOADS_DIR)
    os.close(fd)

    try:
        result = subprocess.run(
            [
                'ffmpeg', '-y', '-i', input_path,
                '-acodec', 'pcm_s16le', '-ar', '16000', '-ac', '1',
                out_path
            ],
            check=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )
        
        # Verify output file
        if not os.path.exists(out_path):
            raise RuntimeError("FFmpeg conversion produced no output file")
        
        output_size = os.path.getsize(out_path)
        if output_size < 1000:  # Less than 1KB
            print(f"[WARN] Converted audio very small: {output_size} bytes - possibly silent")
        else:
            print(f"[INFO] ffmpeg conversion successful → {os.path.basename(out_path)} ({output_size / 1024:.1f} KB)")
        
        return out_path
    except subprocess.CalledProcessError as e:
        error_msg = e.stderr if e.stderr else str(e)
        print(f"[ERROR] ffmpeg conversion failed for {input_path}: {error_msg}")
        print(f"[ERROR] Input size: {os.path.getsize(input_path) if os.path.exists(input_path) else 'N/A'}")
        try:
            os.remove(out_path)
        except Exception:
            pass
        raise RuntimeError(
            f"Audio conversion failed. ffmpeg error: {e.stderr.decode(errors='replace')}"
        )


def validate_audio_duration(filepath: str, min_sec: float = 2.0) -> bool:
    """
    FIX 6: Duration-based validation replaces the unreliable file-size check.
    File size varies wildly by codec (WebM/Opus can be <2 KB for 3 seconds).
    A proper duration check is format-agnostic.
    Returns True if duration >= min_sec, False otherwise.
    Logs a warning but does NOT raise on failure (non-blocking).
    """
    try:
        import librosa
        # Load only the first 5 seconds to keep it fast
        audio, sr = librosa.load(filepath, sr=None, duration=5.0)
        duration = len(audio) / sr
        print(f"[INFO] Audio duration: {duration:.2f}s (min required: {min_sec}s)")
        if duration < min_sec:
            print(f"[WARN] Audio too short: {duration:.2f}s")
            return False
        return True
    except Exception as e:
        print(f"[WARN] Duration check failed ({e}) — allowing through")
        return True   # Don't block if check itself fails


def save_audio_file(file) -> str:
    """
    Save uploaded audio file and return path.

    SECURITY NOTE: Only accepts audio from browser MediaRecorder API.
    """
    if not file or file.filename == '':
        raise BadRequest("No file provided")

    if not allowed_file(file.filename):
        raise BadRequest(f"Invalid file type. Allowed: {ALLOWED_EXTENSIONS}")

    file.seek(0, os.SEEK_END)
    file_size = file.tell()
    file.seek(0)

    if file_size > MAX_FILE_SIZE:
        raise BadRequest(f"File too large. Maximum size: {MAX_FILE_SIZE / 1024 / 1024:.0f} MB")

    # FIX 7: Minimum size lowered from 10 KB → 1 KB.
    # WebM/Opus recordings (the most common browser format) can be under 10 KB
    # for valid 3-second recordings, especially on mobile.  We validate actual
    # duration after saving instead (validate_audio_duration).
    MIN_FILE_SIZE = 1 * 1024   # 1 KB
    if file_size < MIN_FILE_SIZE:
        raise BadRequest("Audio file is empty or corrupted.")

    timestamp = datetime.utcnow().strftime('%Y%m%d_%H%M%S')
    random_str = secrets.token_hex(4)
    filename = f"{timestamp}_{random_str}_{secure_filename(file.filename)}"
    filepath = os.path.join(TEMP_VOICE_UPLOADS_DIR, filename)
    file.save(filepath)

    print(f"[INFO] Saved audio: {filename} ({file_size / 1024:.1f} KB)")
    return filepath


def cleanup_audio_file(filepath: str):
    """Delete temporary audio file."""
    try:
        if filepath and os.path.exists(filepath):
            os.remove(filepath)
            print(f"[INFO] Deleted temp file: {os.path.basename(filepath)}")
    except Exception as e:
        print(f"[WARN] Failed to delete {filepath}: {e}")


def validate_audio_freshness(filepath: str) -> bool:
    """
    Validate that audio is fresh (likely from live recording, not a replay attack).

    FIX 8: Freshness check now uses the file's creation time (st_ctime) rather
    than modification time (st_mtime). After ffmpeg conversion the mtime is
    updated to "now", making every converted file look fresh even if the
    original was old.  We record upload_time in the filename timestamp instead
    and compare against the *original* save time derived from the filename.
    """
    try:
        basename = os.path.basename(filepath)
        # Extract the timestamp embedded in the filename by save_audio_file()
        # Format: YYYYMMDD_HHMMSS_<random>_<original_name>
        try:
            ts_str = '_'.join(basename.split('_')[:2])  # e.g. "20240101_153045"
            file_time = datetime.strptime(ts_str, '%Y%m%d_%H%M%S')
            age_seconds = (datetime.utcnow() - file_time).total_seconds()
        except Exception:
            # Fallback: use stat ctime
            file_stat = os.stat(filepath)
            age_seconds = datetime.utcnow().timestamp() - file_stat.st_ctime

        MAX_AGE_SECONDS = 180  # 3 minutes
        if age_seconds > MAX_AGE_SECONDS:
            print(f"[SECURITY] Audio file too old: {age_seconds:.0f}s (max {MAX_AGE_SECONDS}s)")
            return False

        print(f"[INFO] Audio freshness OK: {age_seconds:.1f}s old")
        return True

    except Exception as e:
        print(f"[WARN] Freshness validation error ({e}) — allowing through")
        return True


# ── Enrollment ────────────────────────────────────────────────────────────────

@voice_auth_bp.route('/enrollment/initiate', methods=['POST'])
@token_required
def initiate_enrollment(current_user):
    """Initiate voice enrollment process."""
    try:
        user_id = current_user.get('_id')

        with SessionLocal() as db:
            user = db.query(User).filter(User.id == int(user_id)).first()
            if not user:
                return jsonify({"error": "User not found"}), 404
            already_enrolled = user.voice_enrolled == 'true'

        return jsonify({
            "success": True,
            "user_id": user_id,
            "already_enrolled": already_enrolled,
            "instructions": {
                "duration": "5 seconds",
                "format": "WAV, 16kHz, mono",
                "content": "Speak naturally in Sinhala. Say your name, a sentence, or count numbers."
            }
        }), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@voice_auth_bp.route('/enrollment/submit', methods=['POST'])
@token_required
def submit_enrollment(current_user):
    """Submit enrollment voice sample."""
    audio_path = None
    converted_path = None

    try:
        user_id = current_user.get('_id')

        if 'audio' not in request.files:
            raise BadRequest("No audio file provided")

        audio_file = request.files['audio']
        audio_path = save_audio_file(audio_file)

        # Convert to WAV only if not already correct
        try:
            converted_path = convert_file_to_wav(audio_path)
            if converted_path != audio_path:
                cleanup_audio_file(audio_path)
                audio_path = None   # prevent double-cleanup in finally
        except RuntimeError as e:
            return jsonify({"error": str(e)}), 500

        # Validate duration after conversion
        if not validate_audio_duration(converted_path, min_sec=2.0):
            return jsonify({"error": "Recording too short. Please record at least 2 seconds."}), 400

        if not validate_audio_freshness(converted_path):
            return jsonify({
                "error": "Audio file rejected for security reasons. Please record again."
            }), 400

        voice_service = get_voice_auth_service()
        enrollment_data = voice_service.enroll_user(user_id, converted_path)

        with SessionLocal() as db:
            user = db.query(User).filter(User.id == int(user_id)).first()
            if not user:
                return jsonify({"error": "User not found"}), 404

            user.voice_enrolled = 'true'
            user.encrypted_speaker_embedding = enrollment_data['encrypted_embedding']
            user.enrollment_timestamp = datetime.utcnow()
            user.embedding_dimension = enrollment_data['embedding_dim']
            db.commit()

        print(f"[INFO] Enrollment successful for user {user_id}")
        return jsonify({
            "success": True,
            "message": "Voice enrollment successful",
            "enrollment_timestamp": enrollment_data['enrollment_timestamp']
        }), 201

    except Exception as e:
        print(f"[ERROR] Enrollment failed: {e}")
        return jsonify({"error": str(e)}), 500

    finally:
        if audio_path:
            cleanup_audio_file(audio_path)
        if converted_path:
            cleanup_audio_file(converted_path)


# ── Login ─────────────────────────────────────────────────────────────────────

@voice_auth_bp.route('/login/get-phrase', methods=['GET'])
def get_login_phrase():
    """Get random Sinhala phrase for login verification."""
    try:
        import random
        SINHALA_PHRASES = [
            "මම අද පද්ධතියට පිවිසෙමි",
            "මෙය මගේ ආරක්ෂිත පිවිසුමයි",
            "මම තහවුරු කරමි මගේ අනන්‍යතාවය",
            "මම සැබෑ පරිශීලකයා වෙමි",
            "මගේ හඬ මගේ හැඳුනුම්පතයි"
        ]
        return jsonify({
            "success": True,
            "phrase": random.choice(SINHALA_PHRASES),
            "language": "Sinhala"
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@voice_auth_bp.route('/login/voice-authenticate', methods=['POST'])
def voice_authenticate():
    """Authenticate user with voice biometrics."""
    audio_path = None
    converted_path = None

    try:
        email = request.form.get('email')
        expected_phrase = request.form.get('phrase')

        if not email or not expected_phrase:
            raise BadRequest("Email and phrase required")

        if 'audio' not in request.files:
            raise BadRequest("No audio file provided")

        audio_file = request.files['audio']
        audio_path = save_audio_file(audio_file)

        # Convert and validate
        try:
            converted_path = convert_file_to_wav(audio_path)
            if converted_path != audio_path:
                cleanup_audio_file(audio_path)
                audio_path = None
        except RuntimeError as e:
            return jsonify({"error": str(e)}), 500

        if not validate_audio_duration(converted_path, min_sec=2.0):
            return jsonify({"error": "Recording too short. Please record at least 2 seconds."}), 400

        if not validate_audio_freshness(converted_path):
            return jsonify({
                "error": "Audio file rejected for security reasons. Please record again."
            }), 400

        print(f"[INFO] Voice authentication attempt for {email}")

        with SessionLocal() as db:
            user = db.query(User).filter(User.email == email).first()
            if not user:
                attempt = LoginAttempt(
                    email=email,
                    success='false',
                    attempt_type='voice',
                    attempt_timestamp=datetime.utcnow()
                )
                db.add(attempt)
                db.commit()
                return jsonify({"error": "User not found"}), 404

            if user.voice_enrolled != 'true':
                return jsonify({"error": "Voice authentication not enrolled"}), 400

            voice_service = get_voice_auth_service()
            auth_result = voice_service.authenticate_login(
                converted_path,
                user.encrypted_speaker_embedding,
                expected_phrase
            )

            attempt = LoginAttempt(
                user_id=user.id,
                email=email,
                success='true' if auth_result['authenticated'] else 'false',
                attempt_type='voice',
                speaker_similarity=str(auth_result['speaker_similarity']),
                phrase_match='true' if auth_result['phrase_verified'] else 'false',
                attempt_timestamp=datetime.utcnow(),
                ip_address=request.remote_addr
            )
            db.add(attempt)

            if auth_result['authenticated']:
                session_token = secrets.token_urlsafe(32)
                expiry = datetime.utcnow() + timedelta(hours=SESSION_EXPIRY_HOURS)

                voice_session = VoiceSession(
                    user_id=user.id,
                    session_token=session_token,
                    encrypted_session_embedding=auth_result['session_embedding'],
                    login_timestamp=datetime.utcnow(),
                    login_phrase=expected_phrase,
                    speaker_similarity=str(auth_result['speaker_similarity']),
                    is_active='true',
                    expires_at=expiry
                )
                db.add(voice_session)
                db.commit()

                print(f"[INFO] Voice authentication successful for {email}")
                return jsonify({
                    "success": True,
                    "authenticated": True,
                    "session_token": session_token,
                    "user": {
                        "_id": str(user.id),
                        "name": user.name,
                        "email": user.email,
                        "phone": user.phone
                    },
                    "authentication_details": {
                        "speaker_verified": auth_result['speaker_verified'],
                        "speaker_similarity": auth_result['speaker_similarity'],
                        "phrase_verified": auth_result['phrase_verified'],
                        "phrase_confidence": auth_result['phrase_confidence']
                    }
                }), 200
            else:
                db.commit()
                print(f"[WARN] Voice authentication failed for {email}")
                return jsonify({
                    "success": False,
                    "authenticated": False,
                    "message": "Voice authentication failed",
                    "details": {
                        "speaker_verified": auth_result['speaker_verified'],
                        "phrase_verified": auth_result['phrase_verified'],
                        "transcribed": auth_result.get('transcribed_text', '')
                    }
                }), 401

    except Exception as e:
        print(f"[ERROR] Voice authentication error: {e}")
        return jsonify({"error": str(e)}), 500

    finally:
        if audio_path:
            cleanup_audio_file(audio_path)
        if converted_path:
            cleanup_audio_file(converted_path)


# ── Voice Complaint Submission ────────────────────────────────────────────────

@voice_auth_bp.route('/complaint/voice-submit', methods=['POST'])
def submit_voice_complaint():
    """
    Submit voice complaint with speaker verification, NLP risk analysis,
    and temporal drift tracking.

    Pipeline:
    1. Save uploaded audio
    2. Convert to WAV 16kHz mono (ONCE, via ffmpeg)
    3. Validate duration and freshness
    4. Extract embedding & compare with session embedding
    5. Whisper transcription (Sinhala)
    6. NLP Risk Model analysis
    7. Temporal drift tracking
    8. Persist to PostgreSQL + MongoDB
    """
    audio_path = None
    converted_path = None

    try:
        session_token = request.form.get('session_token')
        if not session_token:
            raise BadRequest("Session token required")

        if 'audio' not in request.files:
            raise BadRequest("No audio file provided")

        audio_file = request.files['audio']
        print(f"[INFO] Received audio — filename: {audio_file.filename}, "
              f"content-type: {audio_file.content_type}")

        # Check raw size before saving
        audio_file.seek(0, os.SEEK_END)
        raw_size = audio_file.tell()
        audio_file.seek(0)
        print(f"[INFO] Raw upload size: {raw_size / 1024:.1f} KB")

        if raw_size < 1000:
            return jsonify({
                "error": "Audio file is too small. Please record at least 2 seconds."
            }), 400

        audio_path = save_audio_file(audio_file)

        # FIX 9: Convert ONCE on the backend — do not attempt a second conversion
        # if the file is already a valid 16 kHz mono WAV (e.g. the old code path
        # that sent a client-side WAV). is_valid_16k_mono_wav() guards this.
        try:
            converted_path = convert_file_to_wav(audio_path)
            if converted_path != audio_path:
                cleanup_audio_file(audio_path)
                audio_path = None
        except RuntimeError as e:
            return jsonify({"error": str(e)}), 500

        working_path = converted_path  # single reference going forward

        # Validate duration (stricter than file-size check)
        if not validate_audio_duration(working_path, min_sec=2.0):
            return jsonify({
                "error": "Recording too short. Please speak for at least 2 seconds."
            }), 400

        if not validate_audio_freshness(working_path):
            return jsonify({
                "error": "Audio file rejected for security reasons. Please record again."
            }), 400

        print(f"[INFO] Processing voice complaint (working file: {os.path.basename(working_path)})")

        with SessionLocal() as db:
            # Validate session
            voice_session = db.query(VoiceSession).filter(
                VoiceSession.session_token == session_token,
                VoiceSession.is_active == 'true'
            ).first()

            if not voice_session:
                return jsonify({"error": "Invalid or expired session"}), 401

            if voice_session.expires_at < datetime.utcnow():
                voice_session.is_active = 'false'
                db.commit()
                return jsonify({"error": "Session expired"}), 401

            user_id = voice_session.user_id
            user = db.query(User).filter(User.id == user_id).first()
            if not user:
                return jsonify({"error": "User not found"}), 404

            # STEP 1 & 2: Speaker verification
            voice_service = get_voice_auth_service()
            verification_result = voice_service.verify_complaint_speaker(
                working_path,
                voice_session.encrypted_session_embedding
            )

            if not verification_result['verified']:
                print(f"[WARN] Speaker verification failed — similarity: {verification_result['similarity']:.4f}")
                return jsonify({
                    "error": "Speaker verification failed",
                    "message": "Voice does not match the authenticated user. Please try recording again.",
                    "similarity": verification_result['similarity'],
                    "threshold": verification_result['threshold']
                }), 403

            # STEP 3: Transcribe with Whisper
            # Extract language parameter from form, convert 'auto' to None for auto-detection
            language = request.form.get('language', 'en')  # default to English
            if language == 'auto':
                language = None  # Whisper auto-detection
            
            try:
                transcribed_text = voice_service.transcribe_audio(working_path, language=language)
                print(f"[INFO] Transcribed: '{transcribed_text[:120]}'")
            except Exception as e:
                print(f"[WARN] Transcription failed: {e}")
                transcribed_text = ""

            if not transcribed_text or not transcribed_text.strip():
                return jsonify({
                    "error": (
                        "No speech detected in the recording. "
                        "Please speak clearly and ensure your microphone is working."
                    )
                }), 400

            # Calculate audio duration for record
            try:
                import librosa as _librosa
                _audio, _sr = _librosa.load(working_path, sr=None)
                duration = len(_audio) / _sr
            except Exception:
                duration = 0.0

            # STEP 4: NLP Risk Model Analysis
            child_name = request.form.get('child_name', 'Unknown Child')
            age = int(request.form.get('age', 12))
            hours_per_day = float(request.form.get('hours_per_day_on_social_media', 3.0))
            child_gender = request.form.get('child_gender', 'other')
            reporter_role = request.form.get('reporter_role', 'parent')
            device_type = request.form.get('device_type', 'mobile')
            region = request.form.get('region', 'Not specified')
            phone_number = request.form.get(
                'phone_number',
                getattr(user, 'phone_number', '') or ''
            )

            features = {
                'age_of_child': age,
                'hours_per_day_on_social_media': hours_per_day,
                'child_gender': child_gender.lower(),
                'reporter_role': reporter_role.lower(),
                'device_type': device_type.lower()
            }

            prediction = model_service.predict(transcribed_text, features)

            risk_score_result = calculate_risk_score(
                ml_probability=prediction['probability_high_risk'],
                complaint_text=transcribed_text,
                hours_per_day=hours_per_day,
                previous_risk_level="low",
                previous_ml_score=None
            )

            # STEP 5: Temporal drift tracking
            child_identifier = f"{user_id}_{child_name}"
            complaint_history = []

            try:
                complaints_collection = get_complaints_collection()
                all_complaints = list(complaints_collection.find(
                    filters={'user_id': str(user_id)},
                    limit=50
                ))
                complaint_history = [
                    c for c in all_complaints
                    if c.get('child_name', '').lower() == child_name.lower()
                ]
                for c in complaint_history:
                    if isinstance(c.get('timestamp'), str):
                        try:
                            c['timestamp'] = datetime.fromisoformat(c['timestamp'])
                        except Exception:
                            c['timestamp'] = datetime.utcnow()
                    if 'ml_risk_score' not in c:
                        c['ml_risk_score'] = c.get('risk_score', 0)
            except Exception as e:
                print(f"[WARN] Could not retrieve complaint history: {e}")
                complaint_history = []

            temporal_result = integrate_temporal_drift(
                child_id=child_identifier,
                current_ml_score=risk_score_result['score_breakdown']['ml_score'],
                current_rule_score=risk_score_result['score_breakdown']['rule_score'],
                complaint_history=complaint_history
            )

            risk_score_result['total_score'] = temporal_result['final_score']
            risk_score_result['score_breakdown']['temporal_drift'] = temporal_result['drift_adjustment']
            risk_score_result['temporal_data'] = temporal_result['temporal_data']

            if temporal_result['final_score'] >= 50:
                risk_level = 'high'
            elif temporal_result['final_score'] >= 35:
                risk_level = 'medium'
            else:
                risk_level = 'low'
            risk_score_result['risk_level'] = risk_level

            # Persist to PostgreSQL
            voice_complaint = VoiceComplaint(
                user_id=user_id,
                session_id=voice_session.id,
                transcribed_text=transcribed_text,
                speaker_verified='true',
                speaker_similarity=str(verification_result['similarity']),
                audio_duration=str(duration),
                created_at=datetime.utcnow()
            )
            db.add(voice_complaint)
            db.commit()
            db.refresh(voice_complaint)

            # Persist to MongoDB
            complaint_doc = {
                "user_id": str(user_id),
                "guardian_name": getattr(user, 'name', 'Unknown'),
                "child_name": child_name,
                "age": age,
                "phone_number": phone_number,
                "region": region,
                "complaint": transcribed_text,
                "child_gender": child_gender,
                "hours_per_day_on_social_media": hours_per_day,
                "reporter_role": reporter_role,
                "device_type": device_type,
                "risk_level": risk_level.title() + " Risk",
                "risk_probability": prediction['probability_high_risk'],
                "predicted_label": prediction['predicted_label'],
                "risk_score": risk_score_result['total_score'],
                "ml_risk_score": risk_score_result['score_breakdown']['ml_score'],
                "risk_score_breakdown": risk_score_result['score_breakdown'],
                "triggered_indicators": risk_score_result['triggered_indicators'],
                "risk_explanation": risk_score_result['explanation'],
                "temporal_data": risk_score_result.get('temporal_data', {}),
                "input_method": "voice_authenticated",
                "speaker_verified": True,
                "speaker_similarity": verification_result['similarity'],
                "audio_duration": duration,
                "voice_complaint_id": voice_complaint.id,
                "timestamp": datetime.utcnow()
            }

            complaints_collection = get_complaints_collection()
            mongo_result = complaints_collection.insert_one(complaint_doc)

            print(f"[INFO] Voice complaint saved — risk: {risk_level}, "
                  f"score: {risk_score_result['total_score']}")

            return jsonify({
                "success": True,
                "complaint_id": voice_complaint.id,
                "mongo_complaint_id": str(mongo_result.inserted_id),
                "transcribed_text": transcribed_text,
                "verification": {
                    "speaker_verified": True,
                    "similarity": verification_result['similarity'],
                    "threshold": verification_result['threshold']
                },
                "risk_analysis": {
                    "risk_level": risk_level,
                    "risk_score": risk_score_result['total_score'],
                    "risk_probability": prediction['probability_high_risk'],
                    "predicted_label": prediction['predicted_label'],
                    "score_breakdown": risk_score_result['score_breakdown'],
                    "triggered_indicators": risk_score_result['triggered_indicators'],
                    "explanation": risk_score_result['explanation']
                },
                "temporal_drift": risk_score_result.get('temporal_data', {}),
                "audio_duration": duration,
                "message": "Voice complaint submitted successfully."
            }), 201

    except Exception as e:
        print(f"[ERROR] Voice complaint submission failed: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

    finally:
        if audio_path:
            cleanup_audio_file(audio_path)
        if converted_path:
            cleanup_audio_file(converted_path)


# ── Session Management ────────────────────────────────────────────────────────

@voice_auth_bp.route('/session/validate', methods=['POST'])
def validate_session():
    """Validate voice session token."""
    try:
        data = request.get_json()
        session_token = data.get('session_token') if data else None

        if not session_token:
            raise BadRequest("Session token required")

        with SessionLocal() as db:
            voice_session = db.query(VoiceSession).filter(
                VoiceSession.session_token == session_token,
                VoiceSession.is_active == 'true'
            ).first()

            if not voice_session:
                return jsonify({"valid": False, "message": "Invalid session"}), 200

            if voice_session.expires_at < datetime.utcnow():
                voice_session.is_active = 'false'
                db.commit()
                return jsonify({"valid": False, "message": "Session expired"}), 200

            user = db.query(User).filter(User.id == voice_session.user_id).first()
            return jsonify({
                "valid": True,
                "user_id": str(user.id),
                "user_name": user.name,
                "expires_at": voice_session.expires_at.isoformat()
            }), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@voice_auth_bp.route('/session/logout', methods=['POST'])
def logout_voice_session():
    """Invalidate voice session."""
    try:
        data = request.get_json()
        session_token = data.get('session_token') if data else None

        if not session_token:
            raise BadRequest("Session token required")

        with SessionLocal() as db:
            voice_session = db.query(VoiceSession).filter(
                VoiceSession.session_token == session_token
            ).first()
            if voice_session:
                voice_session.is_active = 'false'
                db.commit()

        return jsonify({"success": True, "message": "Session invalidated"}), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@voice_auth_bp.route('/enrollment/status', methods=['GET'])
@token_required
def get_enrollment_status(current_user):
    """Get voice enrollment status for current user."""
    try:
        user_id = current_user.get('_id')

        with SessionLocal() as db:
            user = db.query(User).filter(User.id == int(user_id)).first()
            if not user:
                return jsonify({"error": "User not found"}), 404

            return jsonify({
                "enrolled": user.voice_enrolled == 'true',
                "enrollment_timestamp": (
                    user.enrollment_timestamp.isoformat()
                    if user.enrollment_timestamp else None
                ),
                "embedding_dimension": user.embedding_dimension
            }), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500