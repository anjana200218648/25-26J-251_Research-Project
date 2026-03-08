import os
import sys
import json

# Setup FFmpeg PATH (required by OpenAI Whisper)
from config import find_ffmpeg
ffmpeg_path = find_ffmpeg()
if ffmpeg_path:
    os.environ['PATH'] = ffmpeg_path + os.pathsep + os.environ['PATH']
    print(f"[INFO] Added FFmpeg to PATH: {ffmpeg_path}")
else:
    # Check if ffmpeg is already in PATH
    import shutil
    if shutil.which('ffmpeg'):
        print("[INFO] FFmpeg found in system PATH")
    else:
        print("[WARNING] FFmpeg not found. Voice transcription will fail.")
        print("[WARNING] Please install FFmpeg:")
        print("  Windows: winget install --id Gyan.FFmpeg")

from flask import Flask, request, jsonify
from flask_cors import CORS
from datetime import datetime
from werkzeug.exceptions import BadRequest, NotFound, InternalServerError
from werkzeug.utils import secure_filename
from dotenv import load_dotenv

# Load environment variables first
load_dotenv()

# Suppress noisy third-party warnings and reduce logging verbosity for HF/transformers
import warnings
import logging

# General: hide FutureWarning and common noisy UserWarnings from libraries
warnings.filterwarnings("ignore", category=FutureWarning)
warnings.filterwarnings("ignore", category=UserWarning)

# Suppress specific transformer / HF messages that are harmless but noisy
warnings.filterwarnings(
    "ignore",
    message=r"Some weights of .* were not initialized from the model checkpoint",
    category=UserWarning,
)
warnings.filterwarnings(
    "ignore",
    message=r"resume_download is deprecated",
    category=FutureWarning,
)
warnings.filterwarnings(
    "ignore",
    message=r"torch.utils._pytree._register_pytree_node is deprecated",
    category=UserWarning,
)

# Reduce logging from noisy libraries
os.environ.setdefault('HF_HUB_DISABLE_TELEMETRY', '1')
logging.getLogger('transformers').setLevel(logging.ERROR)
logging.getLogger('huggingface_hub').setLevel(logging.ERROR)
logging.getLogger('urllib3').setLevel(logging.ERROR)
logging.getLogger('filelock').setLevel(logging.ERROR)

# Import configuration
from config import create_required_directories, TEMP_VOICE_UPLOADS_DIR

# Import our custom modules
from database import init_db, get_complaints_collection, get_db
from model_service import ModelService
from risk_scoring import calculate_risk_score, detect_language
from auth_routes import auth_bp, token_required
from children_routes import children_bp
from voice_auth_routes import voice_auth_bp
from child_model import Child
from temporal_drift import TemporalDriftAnalyzer, integrate_temporal_drift
from voice_processor import process_voice_complaint

# Try to import ollama for LLM-based complaint validation
try:
    import ollama as ollama_client
    OLLAMA_AVAILABLE = True
    print("[INFO] Ollama module loaded successfully.")
except ImportError:
    OLLAMA_AVAILABLE = False
    print("[WARN] ollama module not installed. Complaint description validation will use rule-based fallback.")
    print("[WARN] Install with: pip install ollama")

# ---------------------------------------------------------------------------
# Centralized Sinhala-aware Ollama model priority
# Override via environment variables if needed.
# ---------------------------------------------------------------------------
OLLAMA_SINHALA_PRIMARY_MODEL = os.getenv("OLLAMA_SINHALA_PRIMARY_MODEL", "qwen2.5:3b")
OLLAMA_SINHALA_FALLBACKS = os.getenv(
    "OLLAMA_SINHALA_FALLBACKS",
    "qwen:7b,mistral,llama3.2:3b,llama3.2:1b,gemma2:2b"
)
print(f"[INFO] Ollama primary model for Sinhala analysis : {OLLAMA_SINHALA_PRIMARY_MODEL}")
print(f"[INFO] Ollama fallback models                    : {OLLAMA_SINHALA_FALLBACKS}")


def _preferred_ollama_models():
    """Return ordered list of preferred models for Sinhala complaint analysis."""
    models = [OLLAMA_SINHALA_PRIMARY_MODEL] + [
        m.strip() for m in OLLAMA_SINHALA_FALLBACKS.split(",") if m.strip()
    ]
    seen, ordered = set(), []
    for m in models:
        key = m.lower()
        if key not in seen:
            seen.add(key)
            ordered.append(m)
    return ordered


def pick_best_ollama_model(available_models):
    """Pick the best available Ollama model using the configured Sinhala priority list."""
    if not available_models:
        print("[WARN] pick_best_ollama_model: no available models supplied.")
        return None
    print(f"[DEBUG] Available Ollama models: {available_models}")
    for pref in _preferred_ollama_models():
        match = next((m for m in available_models if pref.lower() in m.lower()), None)
        if match:
            print(f"[INFO] Selected Ollama model '{match}' (matched preference '{pref}') for Sinhala complaint analysis.")
            return match
    fallback = available_models[0]
    print(f"[WARN] No preferred model matched. Falling back to first available: '{fallback}'")
    return fallback


def get_ollama_model():
    """Get the best available Ollama model for Sinhala complaint analysis."""
    if not OLLAMA_AVAILABLE:
        print("[WARN] get_ollama_model: ollama package not available.")
        return None
    try:
        import requests as req_lib
        print("[DEBUG] Contacting Ollama server at http://127.0.0.1:11434 ...")
        ollama_check = req_lib.get("http://127.0.0.1:11434/api/tags", timeout=5)
        if ollama_check.status_code != 200:
            print(f"[WARN] Ollama server returned HTTP {ollama_check.status_code}. Cannot load model.")
            return None
        models_data = ollama_check.json()
        available_models = [m['name'] for m in models_data.get('models', [])]
        if not available_models:
            print("[WARN] Ollama server is running but no models are installed. "
                  f"Run: ollama pull {OLLAMA_SINHALA_PRIMARY_MODEL}")
            return None
        return pick_best_ollama_model(available_models)
    except Exception as e:
        print(f"[WARN] Could not reach Ollama server: {e}")
        return None




# Create required directories
create_required_directories()

# Initialize Flask app
app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Register authentication blueprint
app.register_blueprint(auth_bp, url_prefix='/api/auth')

# Register children blueprint
app.register_blueprint(children_bp, url_prefix='/api/children')

# Register voice authentication blueprint
app.register_blueprint(voice_auth_bp, url_prefix='/api/voice-auth')

# Initialize model service and load the model (ONCE)
model_service = ModelService()
try:
    model_service.load_model()
    print("[INFO] Model loaded successfully")
    
    # Share model_service with voice_auth_routes to avoid duplicate loading
    import voice_auth_routes
    voice_auth_routes.model_service = model_service
except Exception as e:
    print(f"[WARN] Failed to load model: {e}")
    print("[INFO] Server will continue without model - complaint analysis will not work")


# service (and Whisper) will be loaded lazily on first use by the routes.
try:
    PRELOAD_VOICE_AUTH = os.environ.get('PRELOAD_VOICE_AUTH', 'false').lower() in ('1', 'true', 'yes')
    VOICE_WHISPER_MODEL = os.environ.get('VOICE_WHISPER_MODEL', 'medium')

    if PRELOAD_VOICE_AUTH:
        from voice_auth_service import get_voice_auth_service
        voice_service = get_voice_auth_service(whisper_model_size=VOICE_WHISPER_MODEL)
        print(f"[INFO] Voice authentication service initialized (model={VOICE_WHISPER_MODEL})")
    else:
        # Do not import or initialize Whisper-heavy services at startup.
        voice_service = None
        print("[INFO] Voice authentication service not preloaded. Set PRELOAD_VOICE_AUTH=1 to preload Whisper at startup.")
except Exception as e:
    print(f"[WARN] Failed to initialize voice auth service: {e}")
    print("[INFO] Server will continue without voice auth - voice complaints will not work")

# Initialize database connection
try:
    init_db()
except Exception as e:
    print(f"[WARN] Database error: {e}")

@app.route("/")
def root():
    """Root endpoint to provide API information."""
    return jsonify({
        "message": "Child Social Media Risk Assessment API (Flask Version)",
        "version": "1.0.0",
        "endpoints": {
            "submit_complaint": "/api/complaints/submit",
            "get_complaint": "/api/complaints/<complaint_id>",
            "list_complaints": "/api/complaints",
            "health": "/health"
        }
    })

@app.route("/health")
def health_check():
    """Health check endpoint."""
    return jsonify({
        "status": "healthy",
        "model_loaded": model_service.is_loaded(),
        "timestamp": datetime.utcnow().isoformat()
    })

@app.route("/api/complaints/validate-description", methods=["POST"])
def validate_complaint_description():
    """
    Validate complaint description against provided child/context details using LLM.
    
    Checks whether the complaint text is coherent, relevant, and consistent
    with the provided input fields (age, social media hours, gender, device, etc.)
    
    Falls back to rule-based validation if Ollama is unavailable.
    """
    try:
        data = request.get_json()
        if not data:
            raise BadRequest("Invalid JSON body")

        complaint_text = str(data.get('complaint', '')).strip()
        if not complaint_text:
            return jsonify({
                "valid": False,
                "message": "Complaint description is empty.",
                "suggestions": ["Please describe your concerns about your child's social media usage."]
            }), 200

        # ====== GIBBERISH DETECTION (Priority Check) ======
        gibberish_result = _detect_gibberish(complaint_text)
        if not gibberish_result['is_valid']:
            lang = data.get('language', 'en')
            return jsonify({
                "valid": False,
                "message": gibberish_result['message_si'] if lang == 'si' else gibberish_result['message'],
                "issues": [gibberish_result['message_si']] if lang == 'si' else [gibberish_result['message']],
                "suggestions": gibberish_result['suggestions_si'] if lang == 'si' else gibberish_result['suggestions'],
                "method": "gibberish-detection"
            }), 200

        # Gather context fields
        age = data.get('age', '')
        hours = data.get('hours_per_day_on_social_media', '')
        gender = data.get('child_gender', '')
        device = data.get('device_type', '')
        reporter_role = data.get('reporter_role', '')

        # ---------- Try LLM validation with Ollama ----------
        if OLLAMA_AVAILABLE:
            try:
                import requests as req_lib
                # Check if Ollama server is running
                ollama_check = req_lib.get("http://127.0.0.1:11434/api/tags", timeout=5)
                if ollama_check.status_code == 200:
                    models_data = ollama_check.json()
                    available_models = [m['name'] for m in models_data.get('models', [])]

                    if available_models:
                        # Pick the best model using centralized Sinhala priority
                        active_model = pick_best_ollama_model(available_models)

                        prompt = f"""You are a STRICT complaint validation assistant for a child safety assessment system.

A parent/guardian submitted a complaint about their child's social media behavior.

CHILD DETAILS PROVIDED IN THE FORM:
- Age: {age} years old
- Gender: {gender}
- Daily social media usage: {hours} hours/day
- Primary device: {device}
- Reporter role: {reporter_role}

COMPLAINT TEXT:
\"{complaint_text}\"

TASK: Determine if this complaint text is VALID and CONSISTENT with the child details above.

**CRITICAL CHECK - FACTUAL CONSISTENCY:**
Carefully check if the complaint text mentions ANY specific details that CONTRADICT the form data:

1. **AGE MISMATCH** (MOST IMPORTANT): If the complaint text mentions a specific age (e.g., "he is 9 years old", "my 15 year old", "she's 11"), that age MUST match the form age of {age}. If the text says a DIFFERENT age, mark as INVALID with consistency_score = 0.0. This is a critical error.
2. **GENDER MISMATCH**: If the complaint uses gendered pronouns (he/she/him/her/son/daughter/boy/girl), check if they match the form gender "{gender}". If "he/him/son/boy" is used but gender is Female (or vice versa), flag it.
3. **HOURS MISMATCH**: If the complaint describes usage patterns that clearly contradict {hours} hours/day (e.g., text says "barely uses phone" but hours is 10+, or text says "uses all day" but hours is 0.5), flag it.
4. **RELEVANCE**: Is the text describing a genuine concern about a child's online/social media behavior? Reject random text, gibberish, recipes, song lyrics, homework, or unrelated content.
5. **MEANINGFULNESS**: Does the text provide enough detail to be useful?

Respond ONLY in valid JSON:
{{
    "is_valid": true or false,
    "relevance_score": number from 0.0 to 1.0 (how relevant to child safety),
    "consistency_score": number from 0.0 to 1.0 (how consistent with the form data above - 0.0 if age/gender/hours mismatch found),
    "message": "Brief explanation. If age mismatch found, say: 'The complaint mentions age X but the form says age Y.'",
    "issues": ["specific issue descriptions"],
    "suggestions": ["specific suggestion to fix"]
}}

IMPORTANT: If the complaint text says a different age than {age}, it is ALWAYS invalid."""

                        response = ollama_client.chat(
                            model=active_model,
                            messages=[
                                {
                                    'role': 'system',
                                    'content': 'You are a validation assistant. Respond only with valid JSON. Be strict about irrelevant content but lenient with genuine parental concerns expressed in any language including Sinhala.'
                                },
                                {
                                    'role': 'user',
                                    'content': prompt
                                }
                            ],
                            options={
                                'temperature': 0.1,
                                'num_predict': 500
                            }
                        )

                        result_text = response['message']['content'].strip()
                        result_text = result_text.replace('```json', '').replace('```', '').strip()

                        # Try to parse JSON response
                        try:
                            analysis = json.loads(result_text)
                        except json.JSONDecodeError:
                            # Extract JSON from response
                            json_start = result_text.find('{')
                            json_end = result_text.rfind('}') + 1
                            if json_start >= 0 and json_end > json_start:
                                analysis = json.loads(result_text[json_start:json_end])
                            else:
                                raise ValueError("Could not parse LLM response")

                        is_valid = analysis.get('is_valid', True)
                        relevance = analysis.get('relevance_score', 0.5)
                        consistency = analysis.get('consistency_score', 0.5)
                        message = analysis.get('message', '')
                        issues = analysis.get('issues', [])
                        suggestions = analysis.get('suggestions', [])

                        # Consider invalid if scores are too low
                        if relevance < 0.3 or consistency < 0.3:
                            is_valid = False

                        print(f"[LLM VALIDATION] Valid={is_valid}, Relevance={relevance:.2f}, Consistency={consistency:.2f}")

                        return jsonify({
                            "valid": is_valid,
                            "message": message,
                            "relevance_score": relevance,
                            "consistency_score": consistency,
                            "issues": issues,
                            "suggestions": suggestions,
                            "method": "llm",
                            "model_used": active_model
                        }), 200

            except Exception as e:
                print(f"[WARN] LLM validation failed, falling back to rule-based: {e}")

        # ---------- Fallback: Rule-based validation ----------
        import re as re_mod
        lang = data.get('language', 'en')  # 'en' or 'si'
        issues = []
        issues_si = []
        suggestions = []
        suggestions_si = []
        complaint_lower = complaint_text.lower()

        # ── Fuzzy matching helper (Levenshtein distance) ──
        def levenshtein(s1, s2):
            if len(s1) < len(s2):
                return levenshtein(s2, s1)
            if len(s2) == 0:
                return len(s1)
            prev_row = range(len(s2) + 1)
            for i, c1 in enumerate(s1):
                curr_row = [i + 1]
                for j, c2 in enumerate(s2):
                    insertions = prev_row[j + 1] + 1
                    deletions = curr_row[j] + 1
                    substitutions = prev_row[j] + (c1 != c2)
                    curr_row.append(min(insertions, deletions, substitutions))
                prev_row = curr_row
            return prev_row[-1]

        def text_has_fuzzy_keyword(text, keywords):
            """Check if any word in text fuzzy-matches any keyword.
            Only applies fuzzy to keywords with 5+ chars and words with 4+ chars.
            Short keywords use exact word-boundary matching only."""
            words = re_mod.findall(r'[a-z]+', text)
            for kw in keywords:
                kw_words = kw.split()
                if len(kw_words) == 1:
                    # Exact word-boundary match first (always checked)
                    if re_mod.search(r'\b' + re_mod.escape(kw) + r'\b', text):
                        return True
                    # Fuzzy match only for keywords with 5+ chars
                    if len(kw) >= 5:
                        max_dist = 1 if len(kw) <= 6 else 2
                        for w in words:
                            if len(w) >= 4 and levenshtein(w, kw) <= max_dist:
                                return True
                else:
                    # Multi-word phrase: check substring match
                    if kw in text:
                        return True
            return False

        def text_matches_exact(text, keywords):
            """Exact word-boundary matching only (no fuzzy). For short/common keywords."""
            for kw in keywords:
                kw_words = kw.split()
                if len(kw_words) == 1:
                    if re_mod.search(r'\b' + re_mod.escape(kw) + r'\b', text):
                        return True
                else:
                    if kw in text:
                        return True
            return False

        # Check Sinhala content
        has_sinhala = any(0x0D80 <= ord(c) <= 0x0DFF for c in complaint_text)

        # ====== 0. CHECK: Is this gibberish/meaningless text? ======
        def is_gibberish(text: str, lang_is_sinhala: bool = False) -> tuple:
            """
            Detect if text is gibberish/random keyboard mashing.
            Returns (is_gibberish: bool, reason: str)
            """
            if lang_is_sinhala:
                # For Sinhala text, skip gibberish check (Unicode range check is sufficient)
                return False, ""
            
            text_clean = text.strip()
            if len(text_clean) < 10:
                # Too short to determine, skip gibberish check
                return False, ""
            
            # Remove spaces and punctuation for analysis
            letters_only = re_mod.sub(r'[^a-zA-Z]', '', text_clean)
            if len(letters_only) < 5:
                return True, "Text contains almost no letters"
            
            # 1. Check for excessive character repetition (e.g., "aaaaaaa", "hhhhhhh")
            max_consecutive = 0
            current_char = ''
            current_count = 0
            for char in letters_only.lower():
                if char == current_char:
                    current_count += 1
                    max_consecutive = max(max_consecutive, current_count)
                else:
                    current_char = char
                    current_count = 1
            
            if max_consecutive >= 5:
                return True, "Contains repeated characters (e.g., 'aaaaa' or 'hhhhh')"
            
            # 2. Check vowel ratio (gibberish usually has very low vowel percentage)
            vowels = 'aeiouAEIOU'
            vowel_count = sum(1 for c in letters_only if c in vowels)
            vowel_ratio = vowel_count / len(letters_only) if len(letters_only) > 0 else 0
            
            # English typically has 35-45% vowels; gibberish often has <15%
            if vowel_ratio < 0.15:
                return True, "Text has too few vowels to be meaningful"
            
            # 3. Check for excessive consecutive consonants
            consonants = 'bcdfghjklmnpqrstvwxyzBCDFGHJKLMNPQRSTVWXYZ'
            max_consecutive_consonants = 0
            current_consonant_count = 0
            for char in letters_only:
                if char in consonants:
                    current_consonant_count += 1
                    max_consecutive_consonants = max(max_consecutive_consonants, current_consonant_count)
                else:
                    current_consonant_count = 0
            
            # Normal English rarely has more than 4-5 consecutive consonants
            if max_consecutive_consonants >= 7:
                return True, "Contains too many consecutive consonants"
            
            # 4. Check if text is all one continuous string (no spaces/very few)
            word_count = len(text_clean.split())
            avg_word_length = len(letters_only) / word_count if word_count > 0 else len(letters_only)
            
            # If "words" are extremely long on average, likely gibberish
            if avg_word_length > 20:
                return True, "Text appears to be random characters without proper word breaks"
            
            # 5. Check for recognizable English patterns (basic dictionary check)
            # Common English words that should appear in legitimate complaints
            common_words = re_mod.findall(r'\b[a-z]{2,}\b', text_clean.lower())
            
            # Check if we have ANY recognized short common words
            very_common = ['the', 'is', 'he', 'she', 'my', 'me', 'we', 'to', 'at', 'in', 'on', 'it',
                          'and', 'but', 'or', 'for', 'of', 'a', 'an', 'has', 'have', 'had', 'was',
                          'are', 'am', 'be', 'been', 'do', 'does', 'did', 'can', 'will', 'would',
                          'could', 'may', 'might', 'must', 'should', 'not', 'no', 'yes', 'all',
                          'any', 'this', 'that', 'these', 'those', 'i', 'you', 'they', 'them']
            
            has_common_word = any(word in very_common for word in common_words)
            
            # If text has enough letters but NO common English words, likely gibberish
            if len(letters_only) > 20 and not has_common_word:
                return True, "Text contains no recognizable English words"
            
            return False, ""
        
        # Check if complaint is gibberish
        gibberish_result, gibberish_reason = is_gibberish(complaint_text, has_sinhala)
        if gibberish_result:
            issues.append(
                f"The complaint appears to be random text or gibberish. {gibberish_reason}. "
                "Please provide a meaningful description of your concerns."
            )
            issues_si.append(
                f"පැමිණිල්ල අහඹු පෙළ හෝ අර්ථ රහිත පෙළ ලෙස පෙනේ. {gibberish_reason}. "
                "කරුණාකර ඔබගේ කනස්සල්ල පිළිබඳ අර්ථවත් විස්තරයක් ලබා දෙන්න."
            )
            suggestions.append(
                "Describe real concerns about your child's online behavior, such as: time spent online, "
                "behavioral changes, sleep issues, cyberbullying, or exposure to inappropriate content."
            )
            suggestions_si.append(
                "ඔබේ දරුවාගේ අන්තර්ජාල හැසිරීම පිළිබඳ සැබෑ කනස්සල්ල විස්තර කරන්න: අන්තර්ජාලයේ ගත කරන කාලය, "
                "හැසිරීම් වෙනස්වීම්, නිදි ගැටලු, සයිබර් හිරිහැර, හෝ නුසුදුසු අන්තර්ගතවලට නිරාවරණය වීම."
            )
            # Short-circuit: if gibberish detected, return immediately with invalidity
            use_si = (lang == 'si')
            final_issues = issues_si if use_si else issues
            final_suggestions = suggestions_si if use_si else suggestions
            return jsonify({
                "valid": False,
                "message": "The complaint text appears to be meaningless or random characters." if not use_si else "පැමිණිලි පෙළ අර්ථ රහිත හෝ අහඹු අක්ෂර ලෙස පෙනේ.",
                "issues": final_issues,
                "suggestions": final_suggestions,
                "method": "rule-based"
            }), 200

        # ====== 1. CHECK: Is the text related to child/social media context? ======
        context_keywords = [
            'social media', 'online', 'phone', 'internet', 'screen', 'app', 'game',
            'gaming', 'mobile', 'tablet', 'laptop', 'computer', 'device',
            'tiktok', 'instagram', 'facebook', 'youtube', 'snapchat', 'discord',
            'whatsapp', 'twitter', 'roblox', 'fortnite', 'minecraft',
            'website', 'web', 'chat', 'messaging', 'video', 'videos',
            'browse', 'browsing', 'scroll', 'scrolling', 'download',
            'media', 'digital', 'cyber',
        ]
        usage_keywords = [
            'spend', 'spent', 'spends', 'spending', 'hours', 'hour',
            'uses', 'using', 'usage', 'plays', 'playing', 'played',
            'watches', 'watching', 'watched', 'daily', 'everyday', 'every day',
        ]
        concern_indicators = [
            'worry', 'worried', 'concern', 'concerned', 'afraid', 'scared',
            'problem', 'issue', 'trouble', 'struggling', 'suffering',
            'too much', 'excessive', 'addicted', 'addiction', 'obsessed',
            'angry', 'aggressive', 'depressed', 'anxious', 'anxiety',
            'bully', 'bullied', 'bullying', 'harass', 'threatened',
            'predator', 'stranger', 'inappropriate', 'explicit',
            'sleep', 'insomnia', 'tired', 'exhausted',
            'grades', 'failing', 'dropped', 'decline', 'skip',
            'isolat', 'withdrawn', 'avoid', 'refuse',
            'secret', 'hiding', 'lying', 'lies',
            'mood', 'behavior', 'behaviour', 'changed', 'different',
            'crying', 'upset', 'hurt', 'harm', 'danger',
            'not eating', 'weight', 'health',
            'cant stop', "can't stop", 'all day', 'all night', 'too long',
            'content', 'posts', 'messages from',
            'not study', 'not sleep', 'does not', 'stopped', 'quit',
        ]
        sinhala_context_words = [
            'සමාජ', 'මාධ්‍ය', 'ඔන්ලයින්', 'ෆෝන්', 'දුරකථන', 'පරිගණක',
            'ඉන්ටර්නෙට්', 'ගේම්', 'වීඩියෝ', 'ටික්ටොක්', 'යූටියුබ්',
            'ෆේස්බුක්', 'ඉන්ස්ටග්‍රෑම්', 'තිරය', 'ඩිජිටල්',
        ]
        sinhala_concern_words = [
            'කනස්සල්ල', 'බිය', 'ගැටලු', 'අවදානම', 'පීඩා', 'නිද්ර',
            'ඉගෙනුම', 'හැසිරීම', 'වෙනස්', 'දුක', 'ගැටළු', 'භාවිත',
            'පැය', 'වේලා', 'අධික', 'බලපෑම', 'ගැහැණු', 'පිරිමි',
        ]
        child_keywords = [
            'child', 'kid', 'son', 'daughter', 'boy', 'girl',
            'he', 'she', 'my', 'him', 'her',
        ]
        positive_only_indicators = [
            'well', 'good', 'fine', 'great', 'excellent', 'happy', 'healthy',
            'normal', 'okay', 'ok', 'no problem', 'no issue', 'doing great',
        ]

        has_hours_mention = bool(re_mod.search(r'\d+(?:\.\d+)?\s*hours?', complaint_lower))
        # Fuzzy matching for context/platform keywords (handles typos like "socoal", "instagam")
        has_context = text_has_fuzzy_keyword(complaint_lower, context_keywords) or has_hours_mention
        has_usage = text_has_fuzzy_keyword(complaint_lower, usage_keywords)
        # Exact matching for common English words (no fuzzy — avoids false positives)
        has_concern = text_matches_exact(complaint_lower, concern_indicators)
        has_sinhala_context = any(sw in complaint_text for sw in sinhala_context_words)
        has_sinhala_concern = any(sw in complaint_text for sw in sinhala_concern_words)
        has_child_ref = text_matches_exact(complaint_lower, child_keywords)
        has_positive_only = text_matches_exact(complaint_lower, positive_only_indicators)

        is_relevant = has_context or has_sinhala or has_sinhala_context or has_sinhala_concern or (has_usage and has_hours_mention)

        if is_relevant:
            if has_positive_only and not has_concern and not has_usage and not has_hours_mention and not has_sinhala_concern:
                issues.append(
                    "It looks like everything is fine based on your description. "
                    "Please describe a specific concern about your child's online activity."
                )
                issues_si.append(
                    "ඔබගේ විස්තරයට අනුව සියල්ල හොඳින් පවතින බව පෙනේ. "
                    "කරුණාකර ඔබේ දරුවාගේ අන්තර්ජාල ක්‍රියාකාරකම් ගැන නිශ්චිත කනස්සල්ලක් විස්තර කරන්න."
                )
                suggestions.append(
                    "Try mentioning what worries you — e.g., changes in behavior, sleep issues, "
                    "cyberbullying, or too much screen time."
                )
                suggestions_si.append(
                    "ඔබව කනස්සල්ලට පත් කරන දේ සඳහන් කරන්න — උදා: හැසිරීම් වෙනස්වීම්, "
                    "නිද්‍රා ගැටලු, සයිබර් හිරිහැර, හෝ අධික තිර කාලය."
                )
        else:
            # Not relevant (no tech/online context). Only allow if BOTH child ref + concern present.
            # e.g. "my son is being bullied" → valid (child ref + concern, even without tech keywords)
            # e.g. "I love playing football with my friends" → flagged (no concern)
            if not ((has_child_ref and has_concern) or has_sinhala_concern):
                issues.append(
                    "We couldn't identify details about your child's online activity in the description. "
                    "Please include information related to social media usage or online behavior."
                )
                issues_si.append(
                    "ඔබගේ විස්තරයේ දරුවාගේ අන්තර්ජාල ක්‍රියාකාරකම් පිළිබඳ තොරතුරු හඳුනාගත නොහැකි විය. "
                    "කරුණාකර සමාජ මාධ්‍ය භාවිතය හෝ අන්තර්ජාල හැසිරීම් පිළිබඳ තොරතුරු ඇතුළත් කරන්න."
                )
                suggestions.append(
                    "Describe what happened — for example: how long they spend online, "
                    "what platforms they use, any behavioral changes you noticed."
                )
                suggestions_si.append(
                    "සිදු වූ දේ විස්තර කරන්න — උදා: ඔවුන් අන්තර්ජාලයේ කොපමණ කාලයක් ගත කරනවාද, "
                    "මොන වේදිකා භාවිත කරනවාද, ඔබ දුටු හැසිරීම් වෙනස්කම්."
                )

        # ====== 2. CHECK: Age mentioned in text vs form age ======
        try:
            age_val = int(age)
            age_patterns = [
                r'\b(\d{1,2})\s*[-\s]?years?\s*old\b',
                r'\bage[d]?\s*(\d{1,2})\b',
                r'\b(?:he|she|my\s+(?:son|daughter|child|kid))\s+is\s+(\d{1,2})\b',
                r'\b(\d{1,2})\s*[-]\s*year\s*[-]\s*old\b',
                r'\bmy\s+(\d{1,2})\s*(?:year|yr)\b',
            ]
            mentioned_ages = set()
            for pattern in age_patterns:
                matches = re_mod.findall(pattern, complaint_lower)
                for m in matches:
                    try:
                        mentioned_age = int(m)
                        if 1 <= mentioned_age <= 25:
                            mentioned_ages.add(mentioned_age)
                    except ValueError:
                        pass
            if mentioned_ages:
                mismatched_ages = [a for a in mentioned_ages if a != age_val]
                if mismatched_ages:
                    issues.append(
                        f"The description says the child is {mismatched_ages[0]} years old, "
                        f"but the age field says {age_val}. Please check which is correct."
                    )
                    issues_si.append(
                        f"විස්තරයේ දරුවාගේ වයස {mismatched_ages[0]} ලෙස සඳහන් වේ, "
                        f"නමුත් පෝරමයේ වයස {age_val} ලෙස ඇත. කරුණාකර නිවැරදි අගය පරීක්ෂා කරන්න."
                    )
                    suggestions.append(
                        f"Update the age in your description or change the age field to match."
                    )
                    suggestions_si.append(
                        f"ඔබගේ විස්තරයේ වයස යාවත්කාලීන කරන්න හෝ පෝරමයේ වයස ගැලපෙන ලෙස වෙනස් කරන්න."
                    )
        except (ValueError, TypeError):
            pass

        # ====== 3. CHECK: Gender mentioned in text vs form gender ======
        try:
            if gender:
                gender_lower = gender.lower()
                male_patterns = [r'\bhe\b', r'\bhim\b', r'\bhis\b', r'\bson\b', r'\bboy\b', r"\bhe's\b"]
                female_patterns = [r'\bshe\b', r'\bher\b', r'\bhers\b', r'\bdaughter\b', r'\bgirl\b', r"\bshe's\b"]
                text_has_male = any(re_mod.search(p, complaint_lower) for p in male_patterns)
                text_has_female = any(re_mod.search(p, complaint_lower) for p in female_patterns)

                if gender_lower in ('female', 'f') and text_has_male and not text_has_female:
                    issues.append(
                        "Your description uses male pronouns (he/him/son/boy), "
                        "but the gender is set to Female. Please check and correct."
                    )
                    issues_si.append(
                        "ඔබගේ විස්තරයේ පිරිමි සර්වනාම (he/him/son/boy) භාවිතා කර ඇත, "
                        "නමුත් ස්ත්‍රී පුරුෂ භාවය ගැහැණු ලෙස සකසා ඇත. කරුණාකර පරීක්ෂා කර නිවැරදි කරන්න."
                    )
                    suggestions.append("Update the pronouns in the description or change the gender field.")
                    suggestions_si.append("විස්තරයේ සර්වනාම යාවත්කාලීන කරන්න හෝ ස්ත්‍රී පුරුෂ භාව ක්ෂේත්‍රය වෙනස් කරන්න.")
                elif gender_lower in ('male', 'm') and text_has_female and not text_has_male:
                    issues.append(
                        "Your description uses female pronouns (she/her/daughter/girl), "
                        "but the gender is set to Male. Please check and correct."
                    )
                    issues_si.append(
                        "ඔබගේ විස්තරයේ ගැහැණු සර්වනාම (she/her/daughter/girl) භාවිතා කර ඇත, "
                        "නමුත් ස්ත්‍රී පුරුෂ භාවය පිරිමි ලෙස සකසා ඇත. කරුණාකර පරීක්ෂා කර නිවැරදි කරන්න."
                    )
                    suggestions.append("Update the pronouns in the description or change the gender field.")
                    suggestions_si.append("විස්තරයේ සර්වනාම යාවත්කාලීන කරන්න හෝ ස්ත්‍රී පුරුෂ භාව ක්ෂේත්‍රය වෙනස් කරන්න.")
        except Exception:
            pass

        # ====== 4. CHECK: Hours consistency (text vs form) ======
        try:
            hours_val = float(hours)

            excessive_keywords = ['all day', 'entire day', 'whole day', 'never stops',
                                  'always on', 'constantly', 'nonstop', 'non-stop',
                                  'all the time', 'glued to']
            if hours_val <= 1.5 and any(kw in complaint_lower for kw in excessive_keywords):
                issues.append(
                    f"Your description says the child is online excessively, "
                    f"but the daily hours is set to only {hours_val}. Please verify."
                )
                issues_si.append(
                    f"ඔබගේ විස්තරයට අනුව දරුවා අධිකව අන්තර්ජාලයේ සිටින බව පෙනේ, "
                    f"නමුත් දෛනික පැය ගණන {hours_val} ලෙස සකසා ඇත. කරුණාකර තහවුරු කරන්න."
                )
                suggestions.append("Update the daily hours in the form if usage is actually higher.")
                suggestions_si.append("භාවිතය ඇත්තෙන්ම වැඩි නම් පෝරමයේ දෛනික පැය යාවත්කාලීන කරන්න.")

            minimal_keywords = ['barely uses', 'rarely uses', 'almost never',
                               "doesn't use", 'does not use', 'never uses',
                               'no interest in', 'not interested']
            if hours_val >= 6 and any(kw in complaint_lower for kw in minimal_keywords):
                issues.append(
                    f"Your description says the child barely uses social media, "
                    f"but the daily hours is set to {hours_val}. Please verify."
                )
                issues_si.append(
                    f"ඔබගේ විස්තරයට අනුව දරුවා සමාජ මාධ්‍ය කලාතුරකින් භාවිත කරන බව පෙනේ, "
                    f"නමුත් දෛනික පැය ගණන {hours_val} ලෙස සකසා ඇත. කරුණාකර තහවුරු කරන්න."
                )
                suggestions.append("Check whether the daily hours value is correct.")
                suggestions_si.append("දෛනික පැය අගය නිවැරදිදැයි පරීක්ෂා කරන්න.")

            hours_patterns = [
                r'(\d+(?:\.\d+)?)\s*hours?\s*(?:a|per|each)\s*day',
                r'(\d+(?:\.\d+)?)\s*hours?\s*(?:on|of|in)\s*(?:social|media|online|internet|phone|screen|tiktok|instagram|facebook|youtube)',
                r'(?:spend|spends|spent|spending|uses?|using)\s*(\d+(?:\.\d+)?)\s*hours?',
                r'(\d+(?:\.\d+)?)\s*hours?\s*(?:daily|everyday|each\s*day)',
                r'(?:about|around|nearly|approximately|roughly)\s*(\d+(?:\.\d+)?)\s*hours?',
            ]
            mentioned_hours = set()
            for pattern in hours_patterns:
                matches = re_mod.findall(pattern, complaint_lower)
                for m in matches:
                    try:
                        text_hours = float(m)
                        if 0 <= text_hours <= 24:
                            mentioned_hours.add(text_hours)
                    except ValueError:
                        pass
            for text_hours in mentioned_hours:
                diff = abs(text_hours - hours_val)
                if diff >= 2:
                    issues.append(
                        f"You mentioned {text_hours:g} hours in the description, "
                        f"but the daily hours field says {hours_val:g}. Please make them consistent."
                    )
                    issues_si.append(
                        f"ඔබ විස්තරයේ පැය {text_hours:g}ක් සඳහන් කර ඇත, "
                        f"නමුත් දෛනික පැය ක්ෂේත්‍රයේ {hours_val:g} ලෙස ඇත. කරුණාකර ඒවා ගැලපෙන ලෙස සකසන්න."
                    )
                    suggestions.append(
                        f"Update the hours in your description or change the daily hours field."
                    )
                    suggestions_si.append(
                        f"ඔබගේ විස්තරයේ පැය ගණන යාවත්කාලීන කරන්න හෝ දෛනික පැය ක්ෂේත්‍රය වෙනස් කරන්න."
                    )
                    break
        except (ValueError, TypeError):
            pass

        # ====== 5. CHECK: Age-inappropriate topics ======
        try:
            age_val = int(age)
            adult_keywords = ['workplace', 'office', 'salary', 'mortgage', 'taxes',
                            'retirement', 'divorce', 'marriage', 'employment',
                            'drinking alcohol', 'nightclub', 'dating app']
            if age_val <= 14 and text_matches_exact(complaint_lower, adult_keywords):
                issues.append(
                    "The description mentions topics that don't seem related to a child's online behavior."
                )
                issues_si.append(
                    "විස්තරයේ දරුවෙකුගේ අන්තර්ජාල හැසිරීමට සම්බන්ධ නොවන මාතෘකා සඳහන් වේ."
                )
                suggestions.append("Focus on concerns about your child's age group — social media, online safety, etc.")
                suggestions_si.append("ඔබේ දරුවාගේ වයස් කාණ්ඩයට අදාළ කනස්සල්ල කෙරෙහි අවධානය යොමු කරන්න.")
        except (ValueError, TypeError):
            pass

        # ====== 6. CHECK: Description quality / minimum detail ======
        word_count = len([w for w in complaint_lower.split() if len(w) > 1])
        if word_count < 5 and not has_sinhala:
            issues.append("The description is too short. Please provide more detail about the concern.")
            issues_si.append("විස්තරය ඉතා කෙටි ය. කරුණාකර කනස්සල්ල පිළිබඳ වැඩි විස්තර සපයන්න.")
            suggestions.append("Describe what happened, when you noticed changes, and how it affects your child.")
            suggestions_si.append("සිදු වූ දේ, ඔබ වෙනස්කම් දුටු විට, සහ එය ඔබේ දරුවාට බලපාන ආකාරය විස්තර කරන්න.")

        # ── Build response with correct language ──
        is_valid = len(issues) == 0
        use_si = (lang == 'si')

        final_issues = issues_si if use_si else issues
        final_suggestions = suggestions_si if use_si else suggestions

        if is_valid:
            message = "ඔබගේ පැමිණිලි විස්තරය වලංගු සහ ලබා දී ඇති තොරතුරු සමඟ ගැලපේ." if use_si else \
                      "Your complaint description looks good and matches the provided details."
        elif len(final_issues) == 1:
            message = final_issues[0]
        else:
            message = f"ඔබගේ පැමිණිලි විස්තරයෙහි ගැටලු {len(final_issues)}ක් හමු විය. කරුණාකර සමාලෝචනය කර නිවැරදි කරන්න." if use_si else \
                      f"Found {len(final_issues)} issue(s) in your description. Please review and correct."

        return jsonify({
            "valid": is_valid,
            "message": message,
            "issues": final_issues,
            "suggestions": final_suggestions,
            "method": "rule-based"
        }), 200

    except BadRequest as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        print(f"Error validating complaint: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({
            "valid": True,
            "message": "Validation check could not be completed. Proceeding with submission.",
            "method": "error-fallback"
        }), 200


# ─────────────────────────────────────────────────────────────────────────────
# Text-report builder (plain-text, stored in DB at submission time)
# ─────────────────────────────────────────────────────────────────────────────
def _word_wrap(text: str, width: int = 68) -> list:
    """Word-wrap a string to a fixed column width."""
    words = str(text).split()
    lines, curr = [], ''
    for w in words:
        candidate = (curr + ' ' + w).strip()
        if len(candidate) <= width:
            curr = candidate
        else:
            if curr:
                lines.append(curr)
            curr = w
    if curr:
        lines.append(curr)
    return lines


def _generate_text_report(doc: dict, complaint_id, generated_at) -> str:
    """
    Build a fully formatted plain-text risk-assessment report.
    Called automatically after every complaint insert.
    """
    LINE  = '=' * 70
    DASH  = '-' * 70

    risk_raw   = (doc.get('risk_level') or 'Low Risk').lower()
    risk_level = 'HIGH' if 'high' in risk_raw else ('MEDIUM' if 'medium' in risk_raw else 'LOW')
    risk_score = doc.get('risk_score', 0)
    if isinstance(risk_score, float):
        risk_score_str = f"{risk_score:.2f}"
    else:
        risk_score_str = str(risk_score)

    gender   = 'Male'   if doc.get('child_gender') == 'M' else 'Female'
    role_raw = doc.get('reporter_role', '')
    role     = role_raw.capitalize()

    ts = doc.get('timestamp')
    if hasattr(ts, 'strftime'):
        submitted_date = ts.strftime('%B %d, %Y')
        submitted_time = ts.strftime('%I:%M %p')
    else:
        try:
            from datetime import datetime as _dt
            _ts = _dt.fromisoformat(str(ts))
            submitted_date = _ts.strftime('%B %d, %Y')
            submitted_time = _ts.strftime('%I:%M %p')
        except Exception:
            submitted_date = str(ts)
            submitted_time = ''

    gen_date = generated_at.strftime('%B %d, %Y')
    gen_time = generated_at.strftime('%I:%M:%S %p')

    # Score breakdown
    bd = doc.get('risk_score_breakdown') or {}
    breakdown_lines = [
        f"  ML Score        : {bd.get('ml_score', 'N/A')}",
        f"  Rule Score      : {bd.get('rule_score', 'N/A')}",
        f"  History Score   : {bd.get('history_score', 'N/A')}",
    ]
    if 'temporal_drift' in bd:
        td_val = bd['temporal_drift']
        prefix = '+' if isinstance(td_val, (int, float)) and td_val >= 0 else ''
        breakdown_lines.append(f"  Temporal Drift  : {prefix}{td_val}")

    # Triggered indicators
    indicators = doc.get('triggered_indicators') or []
    indicator_lines = (
        [f"  {i+1}. {ind}" for i, ind in enumerate(indicators)]
        if indicators else ['  None detected.']
    )

    # Recommendations by risk level
    recs_map = {
        'HIGH': [
            'Seek immediate professional help from a child psychologist or counselor.',
            'Implement strict parental controls and monitoring software immediately.',
            'Temporarily restrict device and internet access until safety measures are in place.',
            'Document all concerning online activities for professional consultation.',
            'Involve the entire family in counseling sessions.',
            'Educate the child about cyberbullying, online predators, and digital safety.',
        ],
        'MEDIUM': [
            'Increase active monitoring of daily social media usage.',
            'Set strict daily screen-time limits (2-3 hours maximum).',
            'Enable parental controls and content filters on all devices.',
            'Schedule a counselor check-in if emotional or behavioral signs continue.',
            'Establish no-phone study and sleep hours with consistent family rules.',
            'Have open, non-judgmental conversations about online experiences.',
        ],
        'LOW': [
            'Continue current monitoring practices and safety measures.',
            'Schedule regular check-ins to discuss online experiences.',
            'Encourage responsible digital citizenship and healthy online habits.',
            'Stay informed about emerging online safety trends and digital risks.',
            'Model healthy technology use as a parent or guardian.',
            'Foster an environment where the child feels comfortable sharing concerns.',
        ],
    }
    rec_lines = []
    for i, rec in enumerate(recs_map.get(risk_level, recs_map['LOW']), 1):
        wrapped = _word_wrap(rec, 64)
        rec_lines.append(f"  {i}. {wrapped[0]}")
        for cont in wrapped[1:]:
            rec_lines.append(f"     {cont}")
        rec_lines.append('')

    # Complaint text (word-wrapped)
    complaint_lines = [f"  {l}" for l in _word_wrap(doc.get('complaint', ''), 66)]

    parts = [
        LINE,
        '          CHILDSAFE RISK ASSESSMENT - TEXT REPORT',
        '             Confidential | Social Media Risk Analysis',
        LINE,
        '',
        f"  Report Generated : {gen_date}  {gen_time}",
        f"  Complaint ID     : {complaint_id}",
        f"  Complaint Filed  : {submitted_date}  {submitted_time}",
        '',
        DASH,
        '  GUARDIAN / REPORTER INFORMATION',
        DASH,
        f"  Guardian Name   : {doc.get('guardian_name', 'N/A')}",
        f"  Phone Number    : {doc.get('phone_number', 'N/A')}",
        f"  Region          : {doc.get('region', 'N/A')}",
        f"  Reporter Role   : {role}",
        '',
        DASH,
        '  CHILD INFORMATION',
        DASH,
        f"  Child Name                : {doc.get('child_name', 'N/A')}",
        f"  Age                       : {doc.get('age', 'N/A')} years old",
        f"  Gender                    : {gender}",
        f"  Daily Social Media Usage  : {doc.get('hours_per_day_on_social_media', 0)} hours/day",
        '',
        DASH,
        '  RISK ASSESSMENT RESULTS',
        DASH,
        f"  Final Risk Level  : {risk_level}",
        f"  Risk Score        : {risk_score_str} / 100",
        f"  ML Probability    : {doc.get('risk_probability', 0) * 100:.2f}%",
        '',
        '  Score Breakdown:',
        *breakdown_lines,
        '',
        '  Risk Indicators Triggered:',
        *indicator_lines,
        '',
        DASH,
        '  COMPLAINT DESCRIPTION',
        DASH,
        '',
        *complaint_lines,
        '',
        DASH,
        '  RECOMMENDATIONS',
        DASH,
        '',
        *rec_lines,
        LINE,
        '  ChildSafe Risk Assessment System  |  Confidential Document',
        LINE,
    ]
    return '\n'.join(parts)


@app.route("/api/complaints/submit", methods=["POST"])
def submit_complaint():
    """Submit a new complaint and get risk assessment."""
    try:
        data = request.get_json()
        if not data:
            raise BadRequest("Invalid JSON body")

        # Basic validation: required fields must exist and be non-empty
        required_fields = [
            "guardian_name", "child_name", "age", "phone_number", "region",
            "complaint", "child_gender", "hours_per_day_on_social_media",
            "reporter_role", "device_type"
        ]
        missing_fields = [field for field in required_fields if field not in data]
        if missing_fields:
            raise BadRequest(f"Missing required field(s): {', '.join(missing_fields)}")

        empty_fields = []
        for field in required_fields:
            value = data.get(field)
            if value is None:
                empty_fields.append(field)
            elif isinstance(value, str) and not value.strip():
                empty_fields.append(field)
        if empty_fields:
            raise BadRequest(f"Empty required field(s): {', '.join(empty_fields)}")

        complaint_text = str(data.get('complaint', ''))
        
        # Validate complaint for gibberish (priority check before processing)
        gibberish_result = _detect_gibberish(complaint_text)
        if not gibberish_result['is_valid']:
            raise BadRequest(gibberish_result['message'] + " " + " ".join(gibberish_result['suggestions'][:2]))
        
        complaint_preview = complaint_text[:100] + ("..." if len(complaint_text) > 100 else "")

        print("\n" + "="*80)
        print("RECEIVED DATA FROM FRONTEND:")
        print(f"   Guardian Name: {data.get('guardian_name')}")
        print(f"   Child Name: {data.get('child_name')}")
        print(f"   Age: {data.get('age')}")
        print(f"   Child Gender: {data.get('child_gender')}")
        print(f"   Hours/Day: {data.get('hours_per_day_on_social_media')}")
        print(f"   Reporter Role: {data.get('reporter_role')}")
        print(f"   Complaint: {complaint_preview}")
        print("="*80 + "\n")

        # Validate and normalize 'age' to ensure it's within allowed range (10-18)
        try:
            age_val = int(data['age'])
        except Exception:
            raise BadRequest("Invalid value for 'age'; must be an integer between 10 and 18")
        if not (10 <= age_val <= 18):
            raise BadRequest("Child age must be between 10 and 18 years")
        
        # Validate and convert hours_per_day_on_social_media to float
        try:
            hours_val = float(data['hours_per_day_on_social_media'])
        except Exception:
            raise BadRequest("Invalid value for 'hours_per_day_on_social_media'; must be a number")
        if not (0 <= hours_val <= 24):
            raise BadRequest("Hours per day must be between 0 and 24")

        # Prepare features for model prediction
        gender_map = {
            'Male': 'M',
            'Female': 'F',
            'Other': 'Other',
            'M': 'M',
            'F': 'F',
            'male': 'M',
            'female': 'F',
            'other': 'Other'
        }
        gender_value = gender_map.get(data['child_gender'], data['child_gender'][0].upper() if len(data['child_gender']) > 0 else 'M')

        features = {
            'age_of_child': age_val,
            'hours_per_day_on_social_media': hours_val,
            'child_gender': gender_value,
            'reporter_role': str(data['reporter_role']).lower().strip(),
            'device_type': str(data['device_type']).lower().strip()
        }

        print("TRANSFORMED FEATURES FOR MODEL:")
        for key, value in features.items():
            print(f"   {key}: {value} (type: {type(value).__name__})")
        print("="*80 + "\n")

        detected_language = detect_language(data['complaint'])
        print(f"DETECTED LANGUAGE: {detected_language.upper()}")
        print("="*80 + "\n")

        # Initialize variables for both English and Sinhala flows
        llm_sinhala_result = None
        translated_text = None
        
        if detected_language == 'sinhala':
            print("Sinhala text detected. Analyzing directly with LLM...")
            model = get_ollama_model()
            if not model:
                raise BadRequest("No suitable LLM model available for Sinhala analysis.")
            try:
                # Build comprehensive context for better LLM analysis
                child_context = f"""
Child Information:
- Age: {data.get('age', 'Not specified')} years old
- Gender: {features.get('child_gender', 'Not specified')}
- Daily social media usage: {hours_val} hours per day
- Device type: {features.get('device_type', 'Not specified')}
- Reporter: {features.get('reporter_role', 'Not specified')}

Parent/Guardian Complaint (in Sinhala):
{data['complaint']}

IMPORTANT Risk Assessment Guidelines:
1. Low Risk (score 0-39):
   - Usage ≤ 2 hours/day AND child manages responsibilities well
   - Social media used for educational or creative purposes
   - No signs of addiction, academic decline, or harmful behavior
   - Parent mentions child is balanced and responsible

2. Medium Risk (score 40-69):
   - Usage 3-5 hours/day OR some concerning behaviors
   - Some academic impact or neglect of responsibilities
   - Signs of mild dependency or emotional issues
   - Parent expresses moderate concern

3. High Risk (score 70-100):
   - Usage > 6 hours/day OR severe concerning behaviors
   - Significant academic decline or behavioral changes
   - Addiction symptoms (withdrawal, aggression, isolation)
   - Exposure to harmful content or cyberbullying
   - Parent expresses serious concern or distress

Consider BOTH the complaint content AND the quantitative factors (age, hours per day).
If a parent says the child "manages well" or "studies are good", this is a POSITIVE indicator.
"""
                
                prompt = (
                     "You are an expert child psychologist specializing in social media addiction risk assessment.\n\n"

    "The following case contains:\n"
    "1) A parent’s description written in Sinhala language.\n"
    "2) The child’s usage statistics.\n\n"

    "Carefully analyze BOTH the Sinhala complaint text and the usage data.\n"
    "If the text is meaningless, irrelevant, or does not indicate behavioral concerns, consider that as LOW risk unless usage statistics clearly indicate otherwise.\n\n"

    "Risk Level Definitions:\n"
    "- LOW: Balanced usage, manages studies well, no emotional dependency signs.\n"
    "- MEDIUM: Some signs of overuse or mild emotional dependency but still functioning.\n"
    "- HIGH: Strong addiction signs such as neglecting studies, sleep disturbance, emotional instability, excessive daily usage.\n\n"

    f"{child_context}\n\n"
    "Respond ONLY in this exact JSON format (no extra text):\n"
    "{\"risk_level\": \"low|medium|high\", "
    "\"explanation\": \"Brief explanation in English\", "
                )
                response = ollama_client.chat(
                    model=model,
                    messages=[
                        {
                            'role': 'system',
                            'content': 'You are an expert child psychologist. Provide accurate, context-aware risk assessments. Consider both positive and negative factors. Be realistic and avoid over-diagnosing low-risk situations.'
                        },
                        {
                            'role': 'user',
                            'content': prompt
                        }
                    ],
                    options={
                        'temperature': 0.2,
                        'num_predict': 600
                    }
                )
                import ast
                llm_result = response['message']['content'].strip()
                print(f"[LLM SINHALA ANALYSIS] Raw output: {llm_result}")
                
                # Parse JSON response
                try:
                    result_json = json.loads(llm_result)
                except Exception:
                    try:
                        result_json = ast.literal_eval(llm_result)
                    except Exception:
                        result_json = {"risk_level": "unknown", "explanation": llm_result, "risk_factors": []}
                
                # Store LLM result for later use
                llm_sinhala_result = {
                    "risk_level": result_json.get("risk_level", "unknown").lower(),
                    "explanation": result_json.get("explanation", ""),
                    "risk_factors": result_json.get("risk_factors", []),
                    "raw_output": llm_result
                }
                
                print(f"[LLM SINHALA ANALYSIS] Risk Level: {llm_sinhala_result['risk_level']}")
                print(f"[LLM SINHALA ANALYSIS] Explanation: {llm_sinhala_result['explanation']}")
                
            except Exception as e:
                print(f"[ERROR] LLM Sinhala analysis failed: {e}")
                raise BadRequest("Sinhala complaint analysis failed. Please try again later.")

        # For English (or other) complaints, use ML+rule-based pipeline as before
        # For Sinhala with LLM result, convert to numeric score
        analysis_text = data['complaint']
        
        if llm_sinhala_result:
            # Use LLM analysis for Sinhala
            print("[LLM SINHALA SCORE CONVERSION]")
            # Convert LLM risk level to numeric score (0-100)
            risk_level_map = {
                'low': 25,       # 0-40 is low
                'medium': 55,    # 40-70 is medium  
                'high': 85       # 70-100 is high
            }
            llm_numeric_score = risk_level_map.get(llm_sinhala_result['risk_level'], 50)
            
            # Create a mock prediction structure for consistency
            prediction = {
                'probability_high_risk': llm_numeric_score / 100.0,
                'predicted_label': 1 if llm_numeric_score >= 70 else 0,
                'predicted_label_name': llm_sinhala_result['risk_level'].title(),
                'method': 'llm-sinhala-analysis'
            }
            
            # Create risk score result from LLM
            risk_score_result = {
                'total_score': llm_numeric_score,
                'risk_level': llm_sinhala_result['risk_level'],
                'explanation': llm_sinhala_result['explanation'],
                'score_breakdown': {
                    'ml_score': llm_numeric_score,  # Use LLM score as base
                    'rule_score': 0,  # No rule-based adjustments for LLM
                    'temporal_drift': 0
                },
                'triggered_indicators': llm_sinhala_result['risk_factors'],
                'language_detected': 'sinhala',
                'analysis_method': 'llm_sinhala_direct',
                'llm_risk_level': llm_sinhala_result['risk_level'],
                'llm_explanation': llm_sinhala_result['explanation'],
                'llm_risk_factors': llm_sinhala_result['risk_factors'],
                'llm_raw_output': llm_sinhala_result['raw_output']
            }
            
            print(f"   LLM Risk Level: {llm_sinhala_result['risk_level']}")
            print(f"   Converted to Score: {llm_numeric_score}/100")
            print("="*80 + "\n")
        else:
            # Standard ML model prediction for English
            prediction = model_service.predict(analysis_text, features)
            print(f"ML MODEL (RoBERTa) PREDICTION:")
            print(f"   Probability High Risk: {prediction['probability_high_risk']:.4f}")
            print(f"   Predicted Label: {prediction.get('predicted_label_name', prediction['predicted_label'])}")
            print(f"   Method: {prediction.get('method', 'ml-model')}")
            print("="*80 + "\n")
            
            risk_score_result = calculate_risk_score(
                ml_probability=prediction['probability_high_risk'],
                complaint_text=analysis_text,
                hours_per_day=hours_val,
                previous_risk_level="low",
                previous_ml_score=None
            )
            risk_score_result['language_detected'] = 'english'
            risk_score_result['analysis_method'] = 'ml_model'
            
        # Filter by child name and user ID to track same child over time
        user_id = data.get('user_id')
        child_name = data.get('child_name')
        complaint_history = []
        
        if user_id and child_name:
            try:
                complaints_collection = get_complaints_collection()
                # Get previous complaints for this user
                all_complaints = complaints_collection.find(
                    filters={'user_id': user_id},
                    limit=50  # Last 50 complaints for analysis
                )
                
                # Filter to same child by name
                complaint_history = [
                    c for c in all_complaints 
                    if c.get('child_name', '').lower() == child_name.lower()
                ]
                
                # Convert timestamp strings back to datetime objects for analysis
                for c in complaint_history:
                    if isinstance(c.get('timestamp'), str):
                        try:
                            c['timestamp'] = datetime.fromisoformat(c['timestamp'])
                        except:
                            c['timestamp'] = datetime.now()
                    # Ensure risk score field exists
                    if 'ml_risk_score' not in c:
                        c['ml_risk_score'] = c.get('risk_score', 0)
                        
            except Exception as e:
                print(f"Warning: Could not retrieve complaint history: {e}")
                complaint_history = []
        
        # Apply temporal drift analysis
        child_identifier = f"{user_id}_{child_name}"
        temporal_result = integrate_temporal_drift(
            child_id=child_identifier,
            current_ml_score=risk_score_result['score_breakdown']['ml_score'],
            current_rule_score=risk_score_result['score_breakdown']['rule_score'],
            complaint_history=complaint_history
        )
        
        # Update risk score with temporal adjustment
        risk_score_result['total_score'] = temporal_result['final_score']
        risk_score_result['score_breakdown']['temporal_drift'] = temporal_result['drift_adjustment']
        risk_score_result['temporal_data'] = temporal_result['temporal_data']
        
        # Re-evaluate risk level with temporal score
        # Thresholds aligned with risk_scoring.py: high>=70, medium>=40, low<40
        if temporal_result['final_score'] >= 70:
            risk_score_result['risk_level'] = 'high'
        elif temporal_result['final_score'] >= 40:
            risk_score_result['risk_level'] = 'medium'
        else:
            risk_score_result['risk_level'] = 'low'
        
        print("FINAL RISK ASSESSMENT (with Temporal Drift):")
        if detected_language == 'sinhala':
            if llm_sinhala_result:
                print(f"   Analysis Method: LLM Direct Analysis (Ollama)")
                print(f"   Original Sinhala: {data['complaint'][:80]}...")
                print(f"   LLM Risk Level: {llm_sinhala_result['risk_level'].upper()}")
                print(f"   LLM Explanation: {llm_sinhala_result['explanation'][:100]}...")
            elif translated_text:
                print(f"   Analysis Method: LLM Translation → ML Model (same pipeline as English)")
                print(f"   Original Sinhala: {data['complaint'][:80]}...")
                print(f"   Translated English: {translated_text[:80]}...")
            else:
                print(f"   Analysis Method: ML Model (structured features - translation unavailable)")
                print(f"   Original Sinhala: {data['complaint'][:80]}...")
        
        if not llm_sinhala_result:
            print(f"   ML Prediction: {prediction['predicted_label']} ({'High' if prediction['predicted_label'] == 1 else 'Low'})")
            print(f"   ML Probability: {prediction['probability_high_risk']:.2%}")
        
        print(f"   Base Score: {temporal_result['base_score']:.2f}/100")
        print(f"   Temporal Drift Adjustment: {temporal_result['drift_adjustment']:+.0f} points  [{temporal_result['temporal_data']['pattern']}]")
        print(f"   Final Score: {risk_score_result['total_score']:.2f}/100")
        print(f"   Final Risk Level: {risk_score_result['risk_level'].upper()}")
        print("="*80 + "\n")
        
        # Prepare document for database
        # USE COMPREHENSIVE RISK LEVEL, not just ML prediction
        complaint_doc = {
            "user_id": data.get('user_id'),  # Store user_id with complaint
            "guardian_name": data['guardian_name'],
            "child_name": data['child_name'],
            "age": age_val,
            "phone_number": data['phone_number'],
            "region": data['region'],
            "complaint": data['complaint'],
            "child_gender": features['child_gender'],
            "hours_per_day_on_social_media": hours_val,
            "reporter_role": features['reporter_role'],
            "device_type": features['device_type'],
            "risk_level": risk_score_result['risk_level'].title() + " Risk",  # Use comprehensive score
            "risk_probability": prediction['probability_high_risk'],
            "predicted_label": prediction['predicted_label'],
            # Add comprehensive risk scoring fields
            "risk_score": risk_score_result['total_score'],
            "risk_score_breakdown": risk_score_result['score_breakdown'],
            "triggered_indicators": risk_score_result['triggered_indicators'],
            "risk_explanation": risk_score_result.get('explanation', ''),
            "temporal_data": risk_score_result.get('temporal_data', {}),
            # Add language detection and analysis fields
            "language_detected": risk_score_result.get('language_detected', 'english'),
            "analysis_method": risk_score_result.get('analysis_method', 'ml_model'),
            "timestamp": datetime.now()
        }
        
        # Add LLM-specific fields for Sinhala complaints
        if llm_sinhala_result:
            complaint_doc['llm_risk_level'] = llm_sinhala_result['risk_level']
            complaint_doc['llm_explanation'] = llm_sinhala_result['explanation']
            complaint_doc['llm_risk_factors'] = llm_sinhala_result['risk_factors']
            complaint_doc['llm_raw_output'] = llm_sinhala_result['raw_output']
        
        # Insert into PostgreSQL (via repo)
        complaints_collection = get_complaints_collection()
        result = complaints_collection.insert_one(complaint_doc)

        # --- Auto-generate and save text report immediately after insert ---
        inserted_id = result.inserted_id
        try:
            report_generated_at = datetime.now()
            text_report = _generate_text_report(complaint_doc, inserted_id, report_generated_at)
            complaints_collection.update_text_report(
                complaint_id=inserted_id,
                text_report=text_report,
                generated_at=report_generated_at
            )
            print(f"[INFO] Text report auto-saved for complaint {inserted_id} at {report_generated_at.isoformat()}")
            complaint_doc['text_report'] = text_report
            complaint_doc['report_generated_at'] = report_generated_at.isoformat()
        except Exception as report_err:
            print(f"[WARN] Text report auto-save failed: {report_err}")

        # Prepare response
        complaint_doc['id'] = str(inserted_id)
        complaint_doc['_id'] = str(inserted_id)
        
        # Convert datetime to string for JSON serialization
        complaint_doc['timestamp'] = complaint_doc['timestamp'].isoformat()

        return jsonify(complaint_doc), 201
        
    except BadRequest as e:
        print(f"BadRequest Error: {str(e)}")
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        print(f" Error processing complaint: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": f"Error processing complaint: {str(e)}"}), 500


@app.route("/api/complaints/voice-submit", methods=["POST"])
@token_required
def submit_voice_complaint(current_user):
    """
    Submit a complaint via voice recording.
    
    Accepts audio file, converts to text using OpenAI Whisper (free, open-source),
    then processes through standard complaint pipeline.
    
    Expects multipart/form-data with:
    - audio_file: Audio file (wav, mp3, ogg, flac, webm)
    - Additional form fields same as text complaint submission
    """
    try:
        # Validate that audio file is present
        if 'audio_file' not in request.files:
            raise BadRequest("No audio file provided")
        
        audio_file = request.files['audio_file']
        
        if audio_file.filename == '':
            raise BadRequest("Empty audio file")
        
        # Get file extension
        filename = secure_filename(audio_file.filename)
        file_extension = filename.rsplit('.', 1)[-1].lower() if '.' in filename else ''
        
        # Read audio data
        audio_data = audio_file.read()

        # Get language preference (default to English)
        language = request.form.get('language', 'en-US')
        
        # Normalize language code to Whisper format
        if language:
            language = language.lower().strip()
            if 'sinhala' in language or 'sin' in language or language.startswith('si'):
                language = 'si'
            elif 'english' in language or language.startswith('en'):
                language = 'en'
            elif '-' in language:
                language = language.split('-')[0]
        
        manual_transcript = str(request.form.get('complaint', '')).strip()

        print(f"\nProcessing voice complaint: {filename} ({len(audio_data)} bytes), language={language}")

        if manual_transcript:
            transcript = manual_transcript
            try:
                confidence = float(request.form.get('voice_confidence', 0))
            except Exception:
                confidence = 0.0
            print("Using frontend-reviewed transcript for voice complaint")
        else:
            # Process audio to text using OpenAI Whisper
            voice_result = process_voice_complaint(
                audio_data=audio_data,
                file_extension=file_extension,
                language=language
            )

            if not voice_result['success']:
                return jsonify({
                    "error": "Voice processing failed",
                    "details": voice_result['error']
                }), 400

            # Extract transcript
            transcript = voice_result['transcript']
            confidence = voice_result['confidence']
        
        print(f"Voice transcription successful (confidence: {confidence:.2%})")
        print(f"Transcript: {transcript}")
        
        # Get other form fields
        form_data = {
            'guardian_name': request.form.get('guardian_name'),
            'child_name': request.form.get('child_name'),
            'age': request.form.get('age'),
            'phone_number': request.form.get('phone_number'),
            'region': request.form.get('region'),
            'complaint': transcript,  # Use transcribed text
            'child_gender': request.form.get('child_gender'),
            'hours_per_day_on_social_media': request.form.get('hours_per_day_on_social_media'),
            'reporter_role': request.form.get('reporter_role'),
            'device_type': request.form.get('device_type', 'mobile'),
            'user_id': current_user.get('_id') if isinstance(current_user, dict) else str(current_user._id)
        }
        
        # Validate required fields
        required_fields = ['guardian_name', 'child_name', 'age', 'phone_number', 
                          'region', 'child_gender', 'hours_per_day_on_social_media', 
                          'reporter_role', 'device_type']
        
        for field in required_fields:
            if not form_data.get(field):
                raise BadRequest(f"Missing required field: {field}")
        
        # Validate transcript for gibberish
        gibberish_check = _detect_gibberish(transcript)
        if not gibberish_check['is_valid']:
            return jsonify({
                "error": gibberish_check['message'],
                "suggestions": gibberish_check['suggestions'],
                "invalid_transcript": True
            }), 400
        
        # Convert numeric fields
        try:
            age_val = int(form_data['age'])
            hours_val = float(form_data['hours_per_day_on_social_media'])
        except ValueError:
            raise BadRequest("Invalid numeric values for age or hours")
        
        # Prepare features for ML model
        features = {
            'age_of_child': age_val,
            'hours_per_day_on_social_media': hours_val,
            'child_gender': form_data['child_gender'].lower(),
            'reporter_role': form_data['reporter_role'].lower(),
            'device_type': form_data['device_type'].lower()
        }
        
        # Get ML prediction
        prediction = model_service.predict(transcript, features)
        
        # Calculate risk score
        risk_score_result = calculate_risk_score(
            ml_probability=prediction['probability_high_risk'],
            complaint_text=transcript,
            hours_per_day=hours_val,
            previous_risk_level="low",
            previous_ml_score=None
        )
        
        # Apply temporal drift analysis (same as text complaints)
        user_id = form_data['user_id']
        child_name = form_data['child_name']
        complaint_history = []
        
        if user_id and child_name:
            try:
                complaints_collection = get_complaints_collection()
                all_complaints = complaints_collection.find(
                    filters={'user_id': user_id},
                    limit=50
                )
                
                complaint_history = [
                    c for c in all_complaints 
                    if c.get('child_name', '').lower() == child_name.lower()
                ]
                
                for c in complaint_history:
                    if isinstance(c.get('timestamp'), str):
                        try:
                            c['timestamp'] = datetime.fromisoformat(c['timestamp'])
                        except:
                            c['timestamp'] = datetime.now()
                    if 'ml_risk_score' not in c:
                        c['ml_risk_score'] = c.get('risk_score', 0)
                        
            except Exception as e:
                print(f"Warning: Could not retrieve complaint history: {e}")
                complaint_history = []
        
        child_identifier = f"{user_id}_{child_name}"
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
            risk_score_result['risk_level'] = 'high'
        elif temporal_result['final_score'] >= 35:
            risk_score_result['risk_level'] = 'medium'
        else:
            risk_score_result['risk_level'] = 'low'
        
        # Prepare complaint document
        complaint_doc = {
            "user_id": user_id,
            "guardian_name": form_data['guardian_name'],
            "child_name": form_data['child_name'],
            "age": age_val,
            "phone_number": form_data['phone_number'],
            "region": form_data['region'],
            "complaint": transcript,
            "child_gender": features['child_gender'],
            "hours_per_day_on_social_media": hours_val,
            "reporter_role": features['reporter_role'],
            "device_type": features['device_type'],
            "risk_level": risk_score_result['risk_level'].title() + " Risk",
            "risk_probability": prediction['probability_high_risk'],
            "predicted_label": prediction['predicted_label'],
            "risk_score": risk_score_result['total_score'],
            "risk_score_breakdown": risk_score_result['score_breakdown'],
            "triggered_indicators": risk_score_result['triggered_indicators'],
            "risk_explanation": risk_score_result['explanation'],
            "temporal_data": risk_score_result.get('temporal_data', {}),
            "input_method": "voice",  # Mark as voice input
            "voice_confidence": confidence,  # Store speech recognition confidence
            "timestamp": datetime.now()
        }
        
        # Save to database
        complaints_collection = get_complaints_collection()
        result = complaints_collection.insert_one(complaint_doc)
        
        complaint_doc['id'] = str(result.inserted_id)
        complaint_doc['_id'] = str(result.inserted_id)
        complaint_doc['timestamp'] = complaint_doc['timestamp'].isoformat()
        
        return jsonify(complaint_doc), 201
        
    except BadRequest as e:
        print(f"BadRequest Error: {str(e)}")
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        print(f"Error processing voice complaint: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": f"Error processing voice complaint: {str(e)}"}), 500

@app.route("/api/complaints/voice-transcribe", methods=["POST"])
@token_required
def transcribe_voice_complaint(current_user):
    """
    Generate transcript preview for a recorded voice complaint.
    """
    import tempfile, os as _os, shutil as _shutil

    audio_path = None
    converted_path = None

    try:
        # Support both field names: 'audio_file' (legacy) and 'audio' (new)
        audio_file = request.files.get('audio_file') or request.files.get('audio')
        if not audio_file or audio_file.filename == '':
            raise BadRequest("No audio file provided")

        language = request.form.get('language', 'en')  # default English
        
        # Normalize language code to Whisper format
        # Support various formats: 'si', 'sinhala', 'sin', 'si-LK' -> 'si'
        # 'en', 'english', 'en-US', 'en-GB' -> 'en'
        if language:
            language = language.lower().strip()
            if 'sinhala' in language or 'sin' in language or language.startswith('si'):
                language = 'si'
            elif 'english' in language or language.startswith('en'):
                language = 'en'
            # Extract base code for other formats (e.g., 'ta-IN' -> 'ta')
            elif '-' in language:
                language = language.split('-')[0]
        
        print(f"[INFO] voice-transcribe: language={language}")

        # Save to temp file
        filename = secure_filename(audio_file.filename or 'audio.webm')
        fd, audio_path = tempfile.mkstemp(
            suffix=_os.path.splitext(filename)[1] or '.webm',
            dir=TEMP_VOICE_UPLOADS_DIR
        )
        _os.close(fd)
        audio_file.save(audio_path)

        print(f"[INFO] voice-transcribe: saved {_os.path.getsize(audio_path)/1024:.1f} KB → {filename}")

        # Convert to 16kHz mono WAV using ffmpeg (skip if already correct)
        from voice_auth_routes import convert_file_to_wav, is_valid_16k_mono_wav
        if not is_valid_16k_mono_wav(audio_path):
            try:
                converted_path = convert_file_to_wav(audio_path)
                if converted_path != audio_path:
                    _os.remove(audio_path)
                    audio_path = None
            except RuntimeError as e:
                return jsonify({"error": str(e)}), 500
        else:
            converted_path = audio_path
            audio_path = None

        working_path = converted_path

        # Transcribe with Whisper (same service used by voice-submit)
        from voice_auth_service import get_voice_auth_service
        voice_service = get_voice_auth_service()

        try:
            # Use the language parameter from the form instead of auto-detect
            transcript = voice_service.transcribe_audio(working_path, language=language)
        except Exception as e:
            print(f"[WARN] Whisper transcription failed: {e}")
            transcript = ""

        # Check if transcription is empty or too short (likely failed or hallucination)
        if not transcript or len(transcript.strip()) < 5:
            return jsonify({
                "transcript": "",
                "confidence": 0.0,
                "language": language,
                "warning": "No clear speech detected. Please re-record and speak clearly into the microphone."
            }), 200
        
        # Check for gibberish in transcript
        gibberish_check = _detect_gibberish(transcript)
        if not gibberish_check['is_valid']:
            return jsonify({
                "transcript": transcript,
                "confidence": 0.0,
                "language": language,
                "warning": gibberish_check['message'],
                "is_gibberish": True,
                "suggestions": gibberish_check['suggestions']
            }), 200

        # Whisper doesn't provide a per-segment confidence score; report 1.0
        # to indicate the model ran successfully (consistent with previous API)
        response_payload = {
            "transcript": transcript,
            "confidence": 1.0,
            "language": language
        }

        try:
            if model_service and model_service.is_loaded():
                # Minimal feature defaults for preview risk estimation
                features = {
                    'age_of_child': int(request.form.get('age', 12)),
                    'hours_per_day_on_social_media': float(request.form.get('hours_per_day_on_social_media', 3.0)),
                    'child_gender': request.form.get('child_gender', 'other').lower(),
                    'reporter_role': request.form.get('reporter_role', 'parent').lower(),
                    'device_type': request.form.get('device_type', 'mobile').lower()
                }
                prediction = model_service.predict(transcript, features)
                risk_est = calculate_risk_score(
                    ml_probability=prediction.get('probability_high_risk', 0.0),
                    complaint_text=transcript,
                    hours_per_day=features['hours_per_day_on_social_media'],
                    previous_risk_level='low',
                    previous_ml_score=None
                )
                response_payload['risk_preview'] = {
                    'risk_level': risk_est.get('risk_level', ''),
                    'risk_score': risk_est.get('total_score', risk_est.get('score', None)),
                    'ml_probability': prediction.get('probability_high_risk')
                }
        except Exception as e:
            print(f"[WARN] Lightweight risk preview failed: {e}")

        return jsonify(response_payload)

    except BadRequest as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        print(f"Error transcribing voice complaint: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": f"Error transcribing voice complaint: {str(e)}"}), 500
    finally:
        # Clean up temp files
        for p in [audio_path, converted_path]:
            if p and _os.path.exists(p):
                try:
                    _os.remove(p)
                except Exception:
                    pass

@app.route("/api/complaints/<string:complaint_id>", methods=["GET"])
def get_complaint(complaint_id: str):
    """Get a specific complaint by ID."""
    try:
        complaints_collection = get_complaints_collection()
        complaint = complaints_collection.find_one_by_id(complaint_id)
        
        if not complaint:
            raise NotFound("Complaint not found")
        
        complaint['id'] = str(complaint['_id'])
        complaint['_id'] = str(complaint['_id'])
        complaint['timestamp'] = complaint['timestamp'].isoformat()
        
        return jsonify(complaint)
    except NotFound as e:
        return jsonify({"error": str(e)}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/complaints", methods=["GET"])
def list_complaints():
    """List all complaints with pagination."""
    try:
        skip = int(request.args.get('skip', 0))
        limit = int(request.args.get('limit', 50))
        
        complaints_collection = get_complaints_collection()
        all_docs = complaints_collection.find(filters=None, limit=skip + limit)
        # apply skip/limit on the returned list
        sliced = all_docs[skip: skip + limit]
        complaints = []
        for doc in sliced:
            # Support both 'id' and '_id' styles
            if '_id' in doc:
                doc_id = doc['_id']
            else:
                doc_id = doc.get('id')
            doc['id'] = str(doc_id)
            doc['_id'] = str(doc_id)
            # timestamp may already be string
            if isinstance(doc.get('timestamp'), str):
                pass
            else:
                ts = doc.get('timestamp')
                doc['timestamp'] = ts.isoformat() if ts else None
            complaints.append(doc)
        
        return jsonify({
            "complaints": complaints,
            "count": len(complaints),
            "skip": skip,
            "limit": limit
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/complaints/latest", methods=["GET"])
@token_required
def get_latest_complaint(current_user):
    """Get the most recent complaint for the authenticated user."""
    try:
        complaints_collection = get_complaints_collection()
        # current_user is a dictionary, so access _id using dict syntax
        raw_user_id = current_user.get('_id') if isinstance(current_user, dict) else current_user._id
        user_id = str(raw_user_id)

        # Prefer normalized string user_id (how we store complaint payloads)
        try:
            results = complaints_collection.find(filters={"user_id": user_id}, limit=1)
            # Fallback for legacy records where user_id may be stored as non-string
            if not results and raw_user_id != user_id:
                results = complaints_collection.find(filters={"user_id": raw_user_id}, limit=1)
        except Exception:
            # Defensive fallback for adapter/filter edge-cases
            all_results = complaints_collection.find(filters=None, limit=500)
            filtered = [doc for doc in all_results if str(doc.get("user_id", "")) == user_id]
            results = filtered[:1]

        complaint = results[0] if results else None
        
        if not complaint:
            return jsonify({"error": "No complaints found"}), 404
        
        # Format the response
        complaint_id = complaint.get('_id', complaint.get('id'))
        complaint['id'] = str(complaint_id) if complaint_id is not None else None
        complaint['_id'] = str(complaint_id) if complaint_id is not None else None
        timestamp = complaint.get('timestamp')
        if isinstance(timestamp, str):
            complaint['timestamp'] = timestamp
        elif timestamp is not None and hasattr(timestamp, 'isoformat'):
            complaint['timestamp'] = timestamp.isoformat()
        else:
            complaint['timestamp'] = None
        
        return jsonify(complaint)
    except Exception as e:
        print(f"Error fetching latest complaint: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

@app.route("/api/statistics", methods=["GET"])
def get_statistics():
    """Get user statistics - total complaints, high risk cases, and children count."""
    try:
        import traceback as _tb
        # user_id from query param (sent by Dashboard)
        user_id = request.args.get('user_id')

        complaints_collection = get_complaints_collection()
        from database import get_children_repo
        children_repo = get_children_repo()

        if user_id:
            total_complaints = complaints_collection.count_documents({"user_id": user_id})
            # risk_level is stored as e.g. "High Risk", "Medium Risk", "Low Risk"
            high_risk_complaints = complaints_collection.count_documents({"user_id": user_id, "risk_level": "High Risk"})
            children_count = children_repo.count_children(user_id)
        else:
            total_complaints = complaints_collection.count_documents({})
            high_risk_complaints = complaints_collection.count_documents({"risk_level": "High Risk"})
            children_count = children_repo.count_children()

        print(f"[INFO] /api/statistics user_id={user_id} → total={total_complaints}, high_risk={high_risk_complaints}, children={children_count}")

        return jsonify({
            "totalComplaints": total_complaints,
            "highRiskComplaints": high_risk_complaints,
            "children": children_count
        })
    except Exception as e:
        import traceback as _tb
        print(f"[ERROR] /api/statistics failed: {e}")
        _tb.print_exc()
        return jsonify({"error": str(e), "totalComplaints": 0, "highRiskComplaints": 0, "children": 0}), 500

@app.route("/api/temporal/analysis/<string:user_id>/<string:child_name>", methods=["GET"])
@token_required
def get_temporal_analysis(current_user, user_id, child_name):
    """
    Get temporal drift analysis for a specific child.
    
    Returns complaint history with time-series data and trend analysis.
    """
    try:
        # Verify user authorization
        current_user_id = current_user.get('_id') if isinstance(current_user, dict) else str(current_user._id)
        if current_user_id != user_id:
            return jsonify({"error": "Unauthorized access"}), 403
        
        complaints_collection = get_complaints_collection()
        
        # Get all complaints for this child
        all_complaints = complaints_collection.find(
            filters={'user_id': user_id},
            limit=100  # Last 100 complaints
        )
        
        # Filter to specific child
        child_complaints = [
            c for c in all_complaints 
            if c.get('child_name', '').lower() == child_name.lower()
        ]
        
        if not child_complaints:
            return jsonify({
                "message": "No complaint history found for this child",
                "child_name": child_name,
                "complaint_count": 0
            }), 404
        
        # Convert timestamps for analysis
        for c in child_complaints:
            if isinstance(c.get('timestamp'), str):
                try:
                    c['timestamp'] = datetime.fromisoformat(c['timestamp'])
                except:
                    c['timestamp'] = datetime.now()
            if 'ml_risk_score' not in c:
                c['ml_risk_score'] = c.get('risk_score', 0)
        
        # Create analyzer and generate time series data
        analyzer = TemporalDriftAnalyzer()
        time_series = analyzer.generate_time_series_data(child_complaints)
        
        # Get current temporal analysis
        latest_complaint = sorted(child_complaints, key=lambda x: x['timestamp'])[-1]
        historical_complaints = child_complaints[:-1]  # Exclude latest
        
        temporal_analysis = analyzer.analyze_temporal_drift(
            child_id=f"{user_id}_{child_name}",
            current_score=latest_complaint.get('ml_risk_score', 0),
            complaint_history=historical_complaints
        )
        
        return jsonify({
            "child_name": child_name,
            "complaint_count": len(child_complaints),
            "time_series_data": time_series,
            "current_analysis": temporal_analysis,
            "date_range": {
                "first_complaint": time_series[0]['date'] if time_series else None,
                "latest_complaint": time_series[-1]['date'] if time_series else None
            }
        }), 200
        
    except Exception as e:
        print(f"Error fetching temporal analysis: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

def _detect_gibberish(text: str) -> dict:
    """
    Detect gibberish/invalid complaints (repeated characters, keyboard mashing, etc.).
    Returns dict with is_valid, message, and suggestions.
    """
    import re
    
    # Check minimum length
    if len(text.strip()) < 10:
        return {
            'is_valid': False,
            'message': 'The complaint is too short. Please provide at least 10 characters describing your concern.',
            'message_si': 'පැමිණිල්ල ඉතා කෙටියි. කරුණාකර ඔබේ කනස්සල්ල විස්තර කරමින් අවම වශයෙන් අක්ෂර 10ක් සපයන්න.',
            'suggestions': ['Describe what behavior concerns you', 'Mention specific social media platforms', 'Explain how it affects your child'],
            'suggestions_si': ['කුමන හැසිරීම ඔබට කනස්සල්ලක් වන්නේද විස්තර කරන්න', 'නිශ්චිත සමාජ මාධ්‍ය වේදිකා සඳහන් කරන්න', 'එය ඔබේ දරුවාට බලපාන ආකාරය පැහැදිලි කරන්න']
        }
    
    # Check for excessive character repetition (e.g., "hhhhhhhhhh", "aaaaaaa")
    # Pattern: Same character repeated 5+ times
    char_repetition = re.findall(r'(.)\1{4,}', text.lower())
    if char_repetition:
        return {
            'is_valid': False,
            'message': f'Invalid text detected: repeated characters ("{char_repetition[0][0] * 5}..."). Please write a meaningful description of your concerns.',
            'message_si': f'වලංගු නොවන පාඨය හඳුනාගෙන ඇත: නැවත නැවත අක්ෂර ("{char_repetition[0][0] * 5}..."). කරුණාකර ඔබේ කනස්සල්ල පිළිබඳ අර්ථවත් විස්තරයක් ලියන්න.',
            'suggestions': ['Remove repeated characters', 'Describe your concerns in clear sentences'],
            'suggestions_si': ['නැවත නැවත අක්ෂර ඉවත් කරන්න', 'ඔබේ කනස්සල්ල පැහැදිලි වාක්‍යවලින් විස්තර කරන්න']
        }
    
    # Check for keyboard mashing patterns
    keyboard_patterns = [
        'qwerty', 'asdfgh', 'zxcvbn', 'qazwsx', 'poiuyt', 'lkjhgf',
        'mnbvcx', 'wertyui', 'sdfghjk', 'xcvbnm', '1234567', '0987654'
    ]
    text_lower = text.lower().replace(' ', '')
    for pattern in keyboard_patterns:
        if pattern in text_lower or pattern[::-1] in text_lower:
            return {
                'is_valid': False,
                'message': 'Invalid text detected: keyboard mashing. Please write a meaningful description of your concerns.',
                'message_si': 'වලංගු නොවන පාඨය: යතුරුපුවරු අනියම් ඇතුළත් කිරීම. කරුණාකර ඔබේ කනස්සල්ල පිළිබඳ අර්ථවත් විස්තරයක් ලියන්න.',
                'suggestions': ['Type meaningful words', 'Describe specific behaviors or concerns'],
                'suggestions_si': ['අර්ථවත් වචන ටයිප් කරන්න', 'නිශ්චිත හැසිරීම් හෝ කනස්සල්ල විස්තර කරන්න']
            }
    
    # Check for excessive punctuation/special characters (>30% of text)
    special_chars = len(re.findall(r'[^\w\s\u0D80-\u0DFF]', text))
    total_chars = len(text.replace(' ', ''))
    if total_chars > 0 and special_chars / total_chars > 0.3:
        return {
            'is_valid': False,
            'message': 'Too many special characters or punctuation marks. Please write a clear description using words.',
            'message_si': 'විශේෂ අක්ෂර හෝ විරාම ලකුණු ඕනෑවට වඩා වැඩියි. කරුණාකර වචන භාවිතා කරමින් පැහැදිලි විස්තරයක් ලියන්න.',
            'suggestions': ['Use complete sentences', 'Remove excessive punctuation'],
            'suggestions_si': ['සම්පූර්ණ වාක්‍ය භාවිතා කරන්න', 'අතිරික්ත විරාම ලකුණු ඉවත් කරන්න']
        }
    
    # Check for very long words (>30 chars) - likely gibberish
    words = text.split()
    for word in words:
        # Allow Sinhala compound words (they can be long)
        has_sinhala = any(0x0D80 <= ord(c) <= 0x0DFF for c in word)
        if not has_sinhala and len(word) > 30:
            return {
                'is_valid': False,
                'message': f'Invalid word detected ("{word[:20]}..."). Please use proper words and sentences.',
                'message_si': f'වලංගු නොවන වචනයක් හඳුනාගෙන ඇත ("{word[:20]}..."). කරුණාකර නිසි වචන සහ වාක්‍ය භාවිතා කරන්න.',
                'suggestions': ['Use normal words', 'Separate words with spaces'],
                'suggestions_si': ['සාමාන්‍ය වචන භාවිතා කරන්න', 'වචන අතර හිස්තැන් දමන්න']
            }
    
    # Check for minimum meaningful content (at least 3 words with 2+ chars each)
    meaningful_words = [w for w in words if len(w) >= 2 and not w.isdigit()]
    if len(meaningful_words) < 3:
        return {
            'is_valid': False,
            'message': 'The complaint needs more meaningful content. Please describe your concerns in detail.',
            'message_si': 'පැමිණිල්ලට වැඩි අර්ථවත් අන්තර්ගතයක් අවශ්‍යයි. කරුණාකර ඔබේ කනස්සල්ල විස්තරාත්මකව විස්තර කරන්න.',
            'suggestions': ['Describe what concerns you about your child\'s behavior', 'Mention social media platforms or apps', 'Explain impacts on sleep, studies, or mood'],
            'suggestions_si': ['ඔබේ දරුවාගේ හැසිරීම ගැන ඔබට කනස්සල්ලට කරුණු විස්තර කරන්න', 'සමාජ මාධ්‍ය වේදිකා හෝ යෙදුම් සඳහන් කරන්න', 'නින්ද, අධ්‍යයනය හෝ මනෝභාවය කෙරෙහි බලපෑම් පැහැදිලි කරන්න']
        }
    
    # All checks passed
    return {
        'is_valid': True,
        'message': 'Valid complaint text',
        'message_si': 'වලංගු පැමිණිලි පාඨය',
        'suggestions': [],
        'suggestions_si': []
    }


# Error Handlers
@app.errorhandler(404)
def not_found_error(error):
    return jsonify({"error": "Not Found"}), 404

@app.errorhandler(500)
def internal_error(error):
    return jsonify({"error": "Internal Server Error"}), 500

if __name__ == "__main__":
    # For development, use Flask's built-in server
    # For production, use a WSGI server like Gunicorn
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", 8001)), debug=False)