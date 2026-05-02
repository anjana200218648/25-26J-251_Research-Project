import os
import sys
import json
import re

from config import find_ffmpeg
ffmpeg_path = find_ffmpeg()
if ffmpeg_path:
    os.environ['PATH'] = ffmpeg_path + os.pathsep + os.environ['PATH']
    print(f"[INFO] Added FFmpeg to PATH: {ffmpeg_path}")
else:
    import shutil
    if shutil.which('ffmpeg'):
        print("[INFO] FFmpeg found in system PATH")
    else:
        print("[WARNING] FFmpeg not found. Voice transcription will fail.")
        print("[WARNING] Please install FFmpeg:")

from flask import Flask, request, jsonify
from flask_cors import CORS
from datetime import datetime
from werkzeug.exceptions import BadRequest, NotFound, InternalServerError
from werkzeug.utils import secure_filename
from dotenv import load_dotenv

load_dotenv()

def _extract_usage_metrics(text: str) -> dict:
    text_lower = text.lower()
    has_sinhala = any('\u0d80' <= char <= '\u0dff' for char in text)
    
    extracted_device = None
    device_map = [
        (['tablet', 'ipad', 'tab'], 'tablet'),
        (['laptop', 'notebook'], 'laptop'),
        (['desktop', 'computer', 'pc'], 'desktop'),
        (['phone', 'mobile', 'mobil', 'smartphone', 'iphone', 'android', 'cell'], 'mobile'),
    ]
    sinhala_device_map = [
        (['ටැබ්ලට්', 'ටැබ්'], 'tablet'),
        (['ලැප්ටොප්'], 'laptop'),
        (['ඩෙස්ක්ටොප්', 'පරිගණක'], 'desktop'),
        (['ෆෝන්', 'දුරකථන', 'මොබයිල්', 'ස්මාර්ට්ෆෝන්'], 'mobile'),
    ]
    
    for keywords, dtype in device_map:
        if any(re.search(r'\b' + re.escape(kw) + r'\b', text_lower) for kw in keywords):
            extracted_device = dtype
            break
    
    if not extracted_device and has_sinhala:
        for keywords, dtype in sinhala_device_map:
            if any(kw in text for kw in keywords):
                extracted_device = dtype
                break

    extracted_hours = None
    hours_patterns = [
        r'(\d+(?:\.\d+)?)\s*hours?\s*(?:a|per|each)\s*day',
        r'(\d+(?:\.\d+)?)\s*hours?\s*(?:daily|everyday|each\s*day)',
        r'(?:spend|spends|spent|spending|uses?|using)\s*(\d+(?:\.\d+)?)\s*hours?',
        r'(\d+(?:\.\d+)?)\s*hours?\s*(?:on|of|in)\s*(?:social|media|online|internet|phone|screen)',
        r'(?:about|around|nearly|approximately|roughly)\s*(\d+(?:\.\d+)?)\s*hours?',
    ]
    for pattern in hours_patterns:
        match = re.search(pattern, text_lower)
        if match:
            try:
                val = float(match.group(1))
                if 0 <= val <= 24:
                    extracted_hours = val
                    break
            except: pass

    if extracted_hours is None and has_sinhala:
        si_patterns = [r'පැය\s*(\d+(?:\.\d+)?)', r'(\d+(?:\.\d+)?)\s*පැය']
        for pattern in si_patterns:
            match = re.search(pattern, text)
            if match:
                try:
                    val = float(match.group(1))
                    if 0 <= val <= 24:
                        extracted_hours = val
                        break
                except: pass

    return {"device": extracted_device, "hours": extracted_hours}

def _detect_gibberish(text: str) -> dict:
    if len(text.strip()) < 10:
        return {
            'is_valid': False,
            'message': 'The complaint is too short. Please provide at least 10 characters describing your concern.',
            'message_si': 'පැමිණිල්ල ඉතා කෙටියි. කරුණාකර ඔබේ කනස්සල්ල විස්තර කරමින් අවම වශයෙන් අක්ෂර 10ක් සපයන්න.',
            'suggestions': ['Describe what behavior concerns you', 'Mention specific social media platforms', 'Explain how it affects your child'],
            'suggestions_si': ['කුමන හැසිරීම ඔබට කනස්සල්ලක් වන්නේද විස්තර කරන්න', 'නිශ්චිත සමාජ මාධ්‍ය වේදිකා සඳහන් කරන්න', 'එය ඔබේ දරුවාට බලපාන ආකාරය පැහැදිලි කරන්න']
        }
    
    char_repetition = re.findall(r'(.)\1{4,}', text.lower())
    if char_repetition:
        return {
            'is_valid': False,
            'message': f'Invalid text detected: repeated characters ("{char_repetition[0][0] * 5}..."). Please write a meaningful description.',
            'message_si': f'වලංගු නොවන පාඨය: නැවත නැවත අක්ෂර ("{char_repetition[0][0] * 5}..."). කරුණාකර අර්ථවත් විස්තරයක් ලියන්න.',
            'suggestions': ['Remove repeated characters', 'Describe your concerns in clear sentences'],
            'suggestions_si': ['නැවත නැවත අක්ෂර ඉවත් කරන්න', 'ඔබේ කනස්සල්ල පැහැදිලි වාක්‍යවලින් විස්තර කරන්න']
        }
    
    keyboard_patterns = ['qwerty', 'asdfgh', 'zxcvbn', 'qazwsx', 'poiuyt', 'lkjhgf', 'mnbvcx', 'wertyui', 'sdfghjk', 'xcvbnm', '1234567', '0987654']
    text_lower = text.lower().replace(' ', '')
    for pattern in keyboard_patterns:
        if pattern in text_lower or pattern[::-1] in text_lower:
            return {
                'is_valid': False,
                'message': 'Invalid text: keyboard mashing. Please write a meaningful description.',
                'message_si': 'වලංගු නොවන පාඨය: යතුරුපුවරු අනියම් ඇතුළත් කිරීම. කරුණාකර අර්ථවත් විස්තරයක් ලියන්න.',
                'suggestions': ['Type meaningful words', 'Describe specific behaviors or concerns'],
                'suggestions_si': ['අර්ථවත් වචන ටයිප් කරන්න', 'නිශ්චිත හැසිරීම් හෝ කනස්සල්ල විස්තර කරන්න']
            }
    
    special_chars = len(re.findall(r'[^\w\s\u0D80-\u0DFF]', text))
    total_chars = len(text.replace(' ', ''))
    if total_chars > 0 and special_chars / total_chars > 0.3:
        return {
            'is_valid': False,
            'message': 'Too many special characters. Please write a clear description using words.',
            'message_si': 'විශේෂ අක්ෂර ඕනෑවට වඩා. කරුණාකර වචන භාවිතා කර පැහැදිලි විස්තරයක් ලියන්න.',
            'suggestions': ['Use complete sentences', 'Remove excessive punctuation'],
            'suggestions_si': ['සම්පූර්ණ වාක්‍ය භාවිතා කරන්න', 'අතිරික්ත විරාම ලකුණු ඉවත් කරන්න']
        }
    
    words = text.split()
    for word in words:
        has_sinhala = any(0x0D80 <= ord(c) <= 0x0DFF for c in word)
        if not has_sinhala and len(word) > 30:
            return {
                'is_valid': False,
                'message': f'Invalid long word ("{word[:20]}..."). Use proper words.',
                'message_si': f'වලංගු නොවන දිගු වචනයක් ("{word[:20]}..."). නිසි වචන භාවිතා කරන්න.',
                'suggestions': ['Use normal words', 'Separate words with spaces'],
                'suggestions_si': ['සාමාන්‍ය වචන භාවිතා කරන්න', 'වචන අතර හිස්තැන් දමන්න']
            }
    
    meaningful_words = [w for w in words if len(w) >= 2 and not w.isdigit()]
    if len(meaningful_words) < 3:
        return {
            'is_valid': False,
            'message': 'Complaint needs more meaningful content. Describe in detail.',
            'message_si': 'පැමිණිල්ලට වැඩි අර්ථවත් අන්තර්ගතයක් අවශ්‍යයි. කරුණාකර විස්තරාත්මකව ලියන්න.',
            'suggestions': ['Describe what concerns you', 'Mention social media platforms', 'Explain impacts'],
            'suggestions_si': ['ඔබට කනස්සල්ලට කරුණු විස්තර කරන්න', 'සමාජ මාධ්‍ය වේදිකා සඳහන් කරන්න', 'බලපෑම් පැහැදිලි කරන්න']
        }
    
    return {
        'is_valid': True,
        'message': 'Valid complaint text',
        'message_si': 'වලංගු පැමිණිලි පාඨය',
        'suggestions': [],
        'suggestions_si': []
    }

def _run_consistency_checks(complaint_text, age, hours, gender, language='en'):
    issues_en = []
    issues_si = []
    suggestions_en = []
    suggestions_si = []
    complaint_lower = complaint_text.lower()
    has_sinhala = any(0x0D80 <= ord(c) <= 0x0DFF for c in complaint_text)

    if age:
        try:
            age_val = int(age)
            age_patterns = [r'\b(\d{1,2})\s*(?:years?\s*old|year\s*old|yr)\b', r'\bage[d]?\s*(\d{1,2})\b']
            mentioned = set()
            for p in age_patterns:
                for m in re.findall(p, complaint_lower):
                    try:
                        mentioned.add(int(m))
                    except: pass
            if mentioned and min(mentioned) != age_val:
                issues_en.append(f"Description says age {min(mentioned)} but form says {age_val}.")
                issues_si.append(f"විස්තරයේ වයස {min(mentioned)} නමුත් පෝරමයේ {age_val}.")
                suggestions_en.append("Make the age consistent.")
                suggestions_si.append("වයස ගැලපෙන ලෙස සකසන්න.")
        except: pass

    if gender:
        gender_lower = gender.lower()
        male_words = ['he', 'him', 'his', 'son', 'boy']
        female_words = ['she', 'her', 'hers', 'daughter', 'girl']
        has_male = any(re.search(r'\b' + w + r'\b', complaint_lower) for w in male_words)
        has_female = any(re.search(r'\b' + w + r'\b', complaint_lower) for w in female_words)
        if gender_lower in ('female', 'f') and has_male and not has_female:
            issues_en.append("Male pronouns used but gender is Female.")
            issues_si.append("පිරිමි සර්වනාම භාවිතා කර ඇතත් ස්ත්‍රී පුරුෂ භාවය ගැහැණු.")
            suggestions_en.append("Update pronouns or gender field.")
            suggestions_si.append("සර්වනාම හෝ ස්ත්‍රී පුරුෂ භාවය වෙනස් කරන්න.")
        elif gender_lower in ('male', 'm') and has_female and not has_male:
            issues_en.append("Female pronouns used but gender is Male.")
            issues_si.append("ගැහැණු සර්වනාම භාවිතා කර ඇතත් ස්ත්‍රී පුරුෂ භාවය පිරිමි.")
            suggestions_en.append("Update pronouns or gender field.")
            suggestions_si.append("සර්වනාම හෝ ස්ත්‍රී පුරුෂ භාවය වෙනස් කරන්න.")

    if hours:
        try:
            hours_val = float(hours)
            hours_patterns = [r'(\d+(?:\.\d+)?)\s*hours?']
            mentioned = set()
            for p in hours_patterns:
                for m in re.findall(p, complaint_lower):
                    try:
                        val = float(m)
                        if 0 <= val <= 24:
                            mentioned.add(val)
                    except: pass
            if mentioned and abs(min(mentioned) - hours_val) >= 2:
                issues_en.append(f"Description mentions {min(mentioned):g}h/day but form says {hours_val:g}h.")
                issues_si.append(f"විස්තරයේ පැය {min(mentioned):g}ක් නමුත් පෝරමයේ {hours_val:g}.")
                suggestions_en.append("Make hours consistent.")
                suggestions_si.append("පැය ගණන ගැලපෙන ලෙස සකසන්න.")
        except: pass

    word_count = len([w for w in complaint_lower.split() if len(w) > 1])
    if word_count < 5 and not has_sinhala:
        issues_en.append("Description is very short. Please provide more detail.")
        issues_si.append("විස්තරය ඉතා කෙටියි. කරුණාකර වැඩි විස්තර සපයන්න.")
        suggestions_en.append("Describe specific behaviors and impacts.")
        suggestions_si.append("නිශ්චිත හැසිරීම් සහ බලපෑම් විස්තර කරන්න.")

    return {
        'issues': {'en': issues_en, 'si': issues_si},
        'suggestions': {'en': suggestions_en, 'si': suggestions_si}
    }

import warnings
import logging

warnings.filterwarnings("ignore", category=FutureWarning)
warnings.filterwarnings("ignore", category=UserWarning)
warnings.filterwarnings("ignore", message=r"Some weights of .* were not initialized from the model checkpoint", category=UserWarning)
warnings.filterwarnings("ignore", message=r"resume_download is deprecated", category=FutureWarning)
warnings.filterwarnings("ignore", message=r"torch.utils._pytree._register_pytree_node is deprecated", category=UserWarning)

os.environ.setdefault('HF_HUB_DISABLE_TELEMETRY', '1')
logging.getLogger('transformers').setLevel(logging.ERROR)
logging.getLogger('huggingface_hub').setLevel(logging.ERROR)
logging.getLogger('urllib3').setLevel(logging.ERROR)
logging.getLogger('filelock').setLevel(logging.ERROR)

from config import create_required_directories, TEMP_VOICE_UPLOADS_DIR
from database import init_db, get_complaints_collection, get_db
from model_service import ModelService
from risk_scoring import calculate_risk_score, detect_language
from auth_routes import auth_bp, token_required
from children_routes import children_bp
from voice_auth_routes import voice_auth_bp
from child_model import Child
from temporal_drift import TemporalDriftAnalyzer, integrate_temporal_drift
from voice_processor import process_voice_complaint

try:
    import ollama as ollama_client
    OLLAMA_AVAILABLE = True
    print("[INFO] Ollama module loaded successfully.")
except ImportError:
    OLLAMA_AVAILABLE = False
    print("[WARN] ollama module not installed. Complaint description validation will use rule-based fallback.")

OLLAMA_SINHALA_PRIMARY_MODEL = os.getenv("OLLAMA_SINHALA_PRIMARY_MODEL", "qwen2.5:3b")
OLLAMA_SINHALA_FALLBACKS = os.getenv("OLLAMA_SINHALA_FALLBACKS", "qwen:7b,mistral,llama3.2:3b,llama3.2:1b,gemma2:2b")
print(f"[INFO] Ollama primary model for Sinhala analysis : {OLLAMA_SINHALA_PRIMARY_MODEL}")
print(f"[INFO] Ollama fallback models                    : {OLLAMA_SINHALA_FALLBACKS}")

def _preferred_ollama_models():
    models = [OLLAMA_SINHALA_PRIMARY_MODEL] + [m.strip() for m in OLLAMA_SINHALA_FALLBACKS.split(",") if m.strip()]
    seen, ordered = set(), []
    for m in models:
        key = m.lower()
        if key not in seen:
            seen.add(key)
            ordered.append(m)
    return ordered

def get_ordered_available_models(available_models):
    if not available_models:
        return []
    candidates = []
    preferred = _preferred_ollama_models()
    for pref in preferred:
        match = next((m for m in available_models if pref.lower() in m.lower()), None)
        if match and match not in candidates:
            candidates.append(match)
    for m in available_models:
        if m not in candidates:
            candidates.append(m)
    return candidates

def get_ollama_candidates():
    if not OLLAMA_AVAILABLE:
        return []
    try:
        import requests as req_lib
        ollama_check = req_lib.get("http://127.0.0.1:11434/api/tags", timeout=3)
        if ollama_check.status_code != 200:
            return []
        models_data = ollama_check.json()
        available_models = [m['name'] for m in models_data.get('models', [])]
        if not available_models:
            print(f"[WARN] Ollama server is running but no models are installed. Run: ollama pull {OLLAMA_SINHALA_PRIMARY_MODEL}")
            return []
        return get_ordered_available_models(available_models)
    except Exception as e:
        print(f"[DEBUG] Could not reach Ollama server: {e}")
        return []

def get_ollama_model():
    candidates = get_ollama_candidates()
    return candidates[0] if candidates else None

create_required_directories()

app = Flask(__name__)
CORS(app)
app.register_blueprint(auth_bp, url_prefix='/api/auth')
app.register_blueprint(children_bp, url_prefix='/api/children')
app.register_blueprint(voice_auth_bp, url_prefix='/api/voice-auth')

model_service = ModelService()
try:
    print("[INFO] Initializing NLP Model Service...")
    model_service.load_model()
    print("[INFO] NLP Model Service loaded successfully")
    import voice_auth_routes
    voice_auth_routes.model_service = model_service
except Exception as e:
    print(f"[WARN] Failed to load model: {e}")

try:
    print("[INFO] Initializing Voice Authentication Service...")
    PRELOAD_VOICE_AUTH = os.environ.get('PRELOAD_VOICE_AUTH', 'false').lower() in ('1', 'true', 'yes')
    VOICE_WHISPER_MODEL = os.environ.get('VOICE_WHISPER_MODEL', 'medium')
    if PRELOAD_VOICE_AUTH:
        from voice_auth_service import get_voice_auth_service
        voice_service = get_voice_auth_service(whisper_model_size=VOICE_WHISPER_MODEL)
        print(f"[INFO] Voice authentication service initialized (model={VOICE_WHISPER_MODEL})")
    else:
        voice_service = None
        print("[INFO] Voice authentication service not preloaded.")
except Exception as e:
    print(f"[WARN] Failed to initialize voice auth service: {e}")

try:
    init_db()
except Exception as e:
    print(f"[WARN] Database error: {e}")

def _validate_complaint_relevance(complaint_text, age=None, hours=None, gender=None, device=None, reporter_role=None, language='en'):
    # If language is Sinhala and the complaint is not valid, return a fixed generic message
    # First, check gibberish
    gibberish = _detect_gibberish(complaint_text)
    if not gibberish['is_valid']:
        if language == 'si':
            return {
                'valid': False,
                'message': 'කරුණාකර ඔබේම දරුවෙකුගේ සමාජ මාධ්‍ය ඇබ්බැහි වීම පිළිබඳ පුද්ගලික පැමිණිල්ලක් ලියන්න.',
                'issues': [],
                'suggestions': ['කරුණාකර ඔබේම දරුවෙකුගේ සමාජ මාධ්‍ය ඇබ්බැහි වීම පිළිබඳ පුද්ගලික පැමිණිල්ලක් ලියන්න.'],
                'extracted_device_type': None,
                'extracted_hours': None
            }
        else:
            return {
                'valid': False,
                'message': gibberish['message'],
                'issues': [gibberish['message']],
                'suggestions': gibberish['suggestions'],
                'extracted_device_type': None,
                'extracted_hours': None
            }

    # For Sinhala, skip detailed analysis and only check if it's about a specific child with social media keywords
    if language == 'si':
        has_guardian = any(p in complaint_text for p in ['මගේ දරුවා', 'මගේ පුතා', 'මගේ දුව', 'අපේ දරුවා'])
        social_keywords = ['සමාජ මාධ්‍ය', 'ෆේස්බුක්', 'ටිකොක්', 'ඉන්ස්ටග්‍රෑම්', 'යූටියුබ්', 'වට්ස්ඇප්', 'ඇබ්බැහි', 'දුරකථන භාවිතය', 'පැය']
        has_social = any(kw in complaint_text for kw in social_keywords)
        if has_guardian and has_social:
            # Pass through to normal validation
            pass
        else:
            return {
                'valid': False,
                'message': 'කරුණාකර ඔබේම දරුවෙකුගේ සමාජ මාධ්‍ය ඇබ්බැහි වීම පිළිබඳ පුද්ගලික පැමිණිල්ලක් ලියන්න.',
                'issues': [],
                'suggestions': ['කරුණාකර ඔබේම දරුවෙකුගේ සමාජ මාධ්‍ය ඇබ්බැහි වීම පිළිබඳ පුද්ගලික පැමිණිල්ලක් ලියන්න.'],
                'extracted_device_type': None,
                'extracted_hours': None
            }

    llm_result = None
    if OLLAMA_AVAILABLE:
        candidates = get_ollama_candidates()
        for model_name in candidates:
            try:
                print(f"[INFO] Attempting complaint validation with Ollama model: {model_name}")
                prompt = f"""You are a strict complaint validator for a child social media addiction reporting system.

A parent or guardian has submitted the following complaint text.  
Your task is to determine if this is a VALID personal complaint about a specific child's social media addiction.

VALID complaints MUST:
- Express concern about a specific child (using phrases like "my child", "my son", "my daughter", "මගේ දරුවා", "මගේ පුතා").
- Describe issues related to excessive social media/phone use, addiction symptoms, or negative impact on studies/sleep/behavior.

INVALID complaints include:
- Public awareness messages, news reports, police warnings, scam alerts, or any general advice not tied to the user's own child.
- Topics unrelated to social media addiction (war, climate, politics, fertilizer, etc.).
- Forwarded warnings ("This is happening", "Police say", "ජනතාව දැනුවත් කරන්න").

Also extract if possible:
- device_type: mobile, tablet, laptop, desktop, or null
- hours_per_day: number (0-24) or null

Return ONLY valid JSON with these fields:
{{
    "is_valid": true/false,
    "reason_en": "short explanation in English",
    "reason_si": "short explanation in Sinhala (if the complaint contains Sinhala, otherwise same as English)",
    "extracted_device_type": "mobile/tablet/laptop/desktop/null",
    "extracted_hours": number or null
}}

Complaint text:
\"\"\"{complaint_text}\"\"\"
"""
                response = ollama_client.chat(
                    model=model_name,
                    messages=[
                        {'role': 'system', 'content': 'You are a strict validator. Only accept personal complaints about a child\'s social media addiction. Reject public announcements, news, scams, and any topic not directly concerning the user\'s own child. Provide output in valid JSON with both English and Sinhala reason fields.'},
                        {'role': 'user', 'content': prompt}
                    ],
                    options={'temperature': 0.1, 'num_predict': 300}
                )
                result_text = response['message']['content'].strip()
                result_text = re.sub(r'```json\s*|\s*```', '', result_text)
                llm_result = json.loads(result_text)
                print(f"[INFO] Successfully validated with {model_name}")
                break
            except Exception as e:
                print(f"[WARN] Ollama model {model_name} failed: {e}")
                continue
        else:
            print("[WARN] All available Ollama models failed. Falling back to rule-based validation.")

    if llm_result and llm_result.get('is_valid') is True:
        extracted_device = llm_result.get('extracted_device_type')
        extracted_hours = llm_result.get('extracted_hours')
        consistency = _run_consistency_checks(complaint_text, age, hours, gender, language)
        use_si = (language == 'si')
        issues = consistency['issues']['si'] if use_si else consistency['issues']['en']
        sugg = consistency['suggestions']['si'] if use_si else consistency['suggestions']['en']
        return {
            'valid': True,
            'message': "Complaint is relevant to social media addiction." if not use_si else "පැමිණිල්ල සමාජ මාධ්‍ය ඇබ්බැහි වීමට අදාළ වේ.",
            'issues': issues,
            'suggestions': sugg,
            'extracted_device_type': extracted_device,
            'extracted_hours': extracted_hours
        }

    if llm_result and llm_result.get('is_valid') is False:
        if language == 'si':
            return {
                'valid': False,
                'message': 'කරුණාකර ඔබේම දරුවෙකුගේ සමාජ මාධ්‍ය ඇබ්බැහි වීම පිළිබඳ පුද්ගලික පැමිණිල්ලක් ලියන්න.',
                'issues': [],
                'suggestions': ['කරුණාකර ඔබේම දරුවෙකුගේ සමාජ මාධ්‍ය ඇබ්බැහි වීම පිළිබඳ පුද්ගලික පැමිණිල්ලක් ලියන්න.'],
                'extracted_device_type': None,
                'extracted_hours': None
            }
        else:
            reason_en = llm_result.get('reason_en', 'Not relevant to child social media addiction.')
            return {
                'valid': False,
                'message': reason_en,
                'issues': [reason_en],
                'suggestions': ["Please write a personal complaint about your own child's social media usage."],
                'extracted_device_type': None,
                'extracted_hours': None
            }

    # Rule-based fallback (for English or Sinhala that passed the simple check)
    text_lower = complaint_text.lower()
    has_sinhala = any(0x0D80 <= ord(c) <= 0x0DFF for c in complaint_text)
    guardian_en = ['my child', 'my son', 'my daughter', 'my kid', 'our child', 'my children']
    guardian_si = ['මගේ දරුවා', 'මගේ පුතා', 'මගේ දුව', 'අපේ දරුවා']
    has_guardian = any(p in text_lower for p in guardian_en) or any(p in complaint_text for p in guardian_si)
    social_en = ['social media', 'tiktok', 'facebook', 'instagram', 'youtube', 'whatsapp', 'addict', 'screen time', 'phone usage']
    social_si = ['සමාජ මාධ්‍ය', 'ෆේස්බුක්', 'ටිකොක්', 'ඇබ්බැහි', 'දුරකථන භාවිතය']
    has_social = any(kw in text_lower for kw in social_en) or any(kw in complaint_text for kw in social_si)
    public_en = ['police say', 'public awareness', 'warning to the public', 'authorities warn']
    public_si = ['පොලීසිය පවසයි', 'ජනතාව දැනුවත් කිරීම', 'අනතුරු ඇඟවීමක්']
    is_public = any(p in text_lower for p in public_en) or any(p in complaint_text for p in public_si)

    use_si = (language == 'si')
    if is_public and not has_guardian:
        if use_si:
            return {
                'valid': False,
                'message': 'කරුණාකර ඔබේම දරුවෙකුගේ සමාජ මාධ්‍ය ඇබ්බැහි වීම පිළිබඳ පුද්ගලික පැමිණිල්ලක් ලියන්න.',
                'issues': [],
                'suggestions': ['කරුණාකර ඔබේම දරුවෙකුගේ සමාජ මාධ්‍ය ඇබ්බැහි වීම පිළිබඳ පුද්ගලික පැමිණිල්ලක් ලියන්න.'],
                'extracted_device_type': None,
                'extracted_hours': None
            }
        else:
            return {
                'valid': False,
                'message': "This appears to be a public announcement or warning, not a personal complaint about your child.",
                'issues': ["The complaint reads like a news alert or police warning."],
                'suggestions': ["Please describe your own child's behavior and your concerns."],
                'extracted_device_type': None,
                'extracted_hours': None
            }
    if not has_guardian:
        if use_si:
            return {
                'valid': False,
                'message': 'කරුණාකර ඔබේම දරුවෙකුගේ සමාජ මාධ්‍ය ඇබ්බැහි වීම පිළිබඳ පුද්ගලික පැමිණිල්ලක් ලියන්න.',
                'issues': [],
                'suggestions': ['කරුණාකර ඔබේම දරුවෙකුගේ සමාජ මාධ්‍ය ඇබ්බැහි වීම පිළිබඳ පුද්ගලික පැමිණිල්ලක් ලියන්න.'],
                'extracted_device_type': None,
                'extracted_hours': None
            }
        else:
            return {
                'valid': False,
                'message': "The complaint does not mention your child. Please use 'my child', 'my son', etc.",
                'issues': ["No indication that this is about your own child."],
                'suggestions': ["Start with 'My child spends hours on...' or similar."],
                'extracted_device_type': None,
                'extracted_hours': None
            }
    if not has_social:
        if use_si:
            return {
                'valid': False,
                'message': 'කරුණාකර ඔබේම දරුවෙකුගේ සමාජ මාධ්‍ය ඇබ්බැහි වීම පිළිබඳ පුද්ගලික පැමිණිල්ලක් ලියන්න.',
                'issues': [],
                'suggestions': ['කරුණාකර ඔබේම දරුවෙකුගේ සමාජ මාධ්‍ය ඇබ්බැහි වීම පිළිබඳ පුද්ගලික පැමිණිල්ලක් ලියන්න.'],
                'extracted_device_type': None,
                'extracted_hours': None
            }
        else:
            return {
                'valid': False,
                'message': "The description does not mention social media or phone addiction.",
                'issues': ["Missing keywords like social media, TikTok, addiction, etc."],
                'suggestions': ["Focus on how your child uses social media and the problems it causes."],
                'extracted_device_type': None,
                'extracted_hours': None
            }

    extraction = _extract_usage_metrics(complaint_text)
    consistency = _run_consistency_checks(complaint_text, age, hours, gender, language)
    issues = consistency['issues']['si'] if use_si else consistency['issues']['en']
    sugg = consistency['suggestions']['si'] if use_si else consistency['suggestions']['en']
    return {
        'valid': True,
        'message': "Complaint passes basic checks." if not use_si else "පැමිණිල්ල මූලික පරීක්ෂණ සමත් වේ.",
        'issues': issues,
        'suggestions': sugg,
        'extracted_device_type': extraction['device'],
        'extracted_hours': extraction['hours']
    }

def _word_wrap(text: str, width: int = 68) -> list:
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

    indicators = doc.get('triggered_indicators') or []
    indicator_lines = (
        [f"  {i+1}. {ind}" for i, ind in enumerate(indicators)]
        if indicators else ['  None detected.']
    )

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

@app.route("/")
def root():
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
    return jsonify({
        "status": "healthy",
        "model_loaded": model_service.is_loaded(),
        "timestamp": datetime.utcnow().isoformat()
    })

@app.route("/api/complaints/validate-description", methods=["POST"])
def validate_complaint_description():
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
        age = data.get('age', '')
        hours = data.get('hours', data.get('hours_per_day_on_social_media', ''))
        gender = data.get('gender', data.get('child_gender', ''))
        device = data.get('device', data.get('device_type', ''))
        reporter_role = data.get('reporter_role', '')
        lang = data.get('language', 'en')

        validation = _validate_complaint_relevance(
            complaint_text=complaint_text,
            age=age,
            hours=hours,
            gender=gender,
            device=device,
            reporter_role=reporter_role,
            language=lang
        )
        return jsonify(validation), 200
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

@app.route("/api/complaints/submit", methods=["POST"])
def submit_complaint():
    try:
        data = request.get_json()
        if not data:
            raise BadRequest("Invalid JSON body")

        required_fields = ["guardian_name", "child_name", "age", "phone_number", "region", "complaint", "child_gender", "reporter_role"]
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

        validation = _validate_complaint_relevance(
            complaint_text=complaint_text,
            age=data.get('age'),
            hours=data.get('hours_per_day_on_social_media'),
            gender=data.get('child_gender'),
            device=data.get('device_type'),
            reporter_role=data.get('reporter_role'),
            language='en'
        )
        if not validation['valid']:
            return jsonify({
                "error": validation['message'],
                "issues": validation['issues'],
                "suggestions": validation['suggestions']
            }), 400

        try:
            age_val = int(data['age'])
        except Exception:
            raise BadRequest("Invalid value for 'age'; must be an integer between 10 and 18")
        if not (10 <= age_val <= 18):
            raise BadRequest("Child age must be between 10 and 18 years")

        raw_hours = data.get('hours_per_day_on_social_media')
        if not raw_hours or str(raw_hours).strip() == "":
            extracted = _extract_usage_metrics(complaint_text)
            hours_val = extracted["hours"] if extracted["hours"] is not None else 0.0
        else:
            try:
                hours_val = float(raw_hours)
            except Exception:
                hours_val = 0.0
        hours_val = max(0.0, min(24.0, hours_val))

        raw_device = data.get('device_type')
        if not raw_device or str(raw_device).strip() == "":
            extracted = _extract_usage_metrics(complaint_text)
            device_type_val = extracted["device"] if extracted["device"] else "mobile"
        else:
            device_type_val = str(raw_device).lower().strip()

        gender_map = {
            'Male': 'M', 'Female': 'F', 'Other': 'Other',
            'M': 'M', 'F': 'F',
            'male': 'M', 'female': 'F', 'other': 'Other'
        }
        gender_value = gender_map.get(data['child_gender'], data['child_gender'][0].upper() if len(data['child_gender']) > 0 else 'M')

        features = {
            'age_of_child': age_val,
            'hours_per_day_on_social_media': hours_val,
            'child_gender': gender_value,
            'reporter_role': str(data['reporter_role']).lower().strip(),
            'device_type': device_type_val
        }

        detected_language = detect_language(data['complaint'])

        llm_sinhala_result = None

        if detected_language == 'sinhala':
            model = get_ollama_model()
            if not model:
                raise BadRequest("No suitable LLM model available for Sinhala analysis.")
            try:
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
                    "1) A parent's description written in Sinhala language.\n"
                    "2) The child's usage statistics.\n\n"
                    "Carefully analyze BOTH the Sinhala complaint text and the usage data.\n"
                    "If the text is meaningless, irrelevant, or does not indicate behavioral concerns, consider that as LOW risk unless usage statistics clearly indicate otherwise.\n\n"
                    "Risk Level Definitions:\n"
                    "- LOW: Balanced usage, manages studies well, no emotional dependency signs.\n"
                    "- MEDIUM: Some signs of overuse or mild emotional dependency but still functioning.\n"
                    "- HIGH: Strong addiction signs such as neglecting studies, sleep disturbance, emotional instability, excessive daily usage.\n\n"
                    f"{child_context}\n\n"
                    "Respond ONLY in this exact JSON format (no extra text):\n"
                    "{\"risk_level\": \"low|medium|high\", \"explanation\": \"Brief explanation in English\"}"
                )
                response = ollama_client.chat(
                    model=model,
                    messages=[
                        {'role': 'system', 'content': 'You are an expert child psychologist. Provide accurate, context-aware risk assessments. Consider both positive and negative factors. Be realistic and avoid over-diagnosing low-risk situations.'},
                        {'role': 'user', 'content': prompt}
                    ],
                    options={'temperature': 0.2, 'num_predict': 600}
                )
                import ast
                llm_result = response['message']['content'].strip()
                try:
                    result_json = json.loads(llm_result)
                except Exception:
                    try:
                        result_json = ast.literal_eval(llm_result)
                    except Exception:
                        result_json = {"risk_level": "unknown", "explanation": llm_result}
                llm_sinhala_result = {
                    "risk_level": result_json.get("risk_level", "unknown").lower(),
                    "explanation": result_json.get("explanation", ""),
                    "risk_factors": result_json.get("risk_factors", []),
                    "raw_output": llm_result
                }
            except Exception as e:
                print(f"[ERROR] LLM Sinhala analysis failed: {e}")
                raise BadRequest("Sinhala complaint analysis failed. Please try again later.")

        if llm_sinhala_result:
            risk_level_map = {'low': 25, 'medium': 55, 'high': 85}
            llm_numeric_score = risk_level_map.get(llm_sinhala_result['risk_level'], 50)
            prediction = {
                'probability_high_risk': llm_numeric_score / 100.0,
                'predicted_label': 1 if llm_numeric_score >= 70 else 0,
                'predicted_label_name': llm_sinhala_result['risk_level'].title(),
                'method': 'llm-sinhala-analysis'
            }
            risk_score_result = {
                'total_score': llm_numeric_score,
                'risk_level': llm_sinhala_result['risk_level'],
                'explanation': llm_sinhala_result['explanation'],
                'score_breakdown': {'ml_score': llm_numeric_score, 'rule_score': 0, 'temporal_drift': 0},
                'triggered_indicators': llm_sinhala_result['risk_factors'],
                'language_detected': 'sinhala',
                'analysis_method': 'llm_sinhala_direct',
                'llm_risk_level': llm_sinhala_result['risk_level'],
                'llm_explanation': llm_sinhala_result['explanation'],
                'llm_risk_factors': llm_sinhala_result['risk_factors'],
                'llm_raw_output': llm_sinhala_result['raw_output']
            }
        else:
            prediction = model_service.predict(data['complaint'], features)
            risk_score_result = calculate_risk_score(
                ml_probability=prediction['probability_high_risk'],
                complaint_text=data['complaint'],
                hours_per_day=hours_val,
                previous_risk_level="low",
                previous_ml_score=None
            )
            risk_score_result['language_detected'] = 'english'
            risk_score_result['analysis_method'] = 'ml_model'

        user_id = data.get('user_id')
        child_name = data.get('child_name')
        complaint_history = []
        if user_id and child_name:
            try:
                complaints_collection = get_complaints_collection()
                all_complaints = complaints_collection.find(filters={'user_id': user_id}, limit=50)
                complaint_history = [c for c in all_complaints if c.get('child_name', '').lower() == child_name.lower()]
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
        if temporal_result['final_score'] >= 70:
            risk_score_result['risk_level'] = 'high'
        elif temporal_result['final_score'] >= 40:
            risk_score_result['risk_level'] = 'medium'
        else:
            risk_score_result['risk_level'] = 'low'

        complaint_doc = {
            "user_id": data.get('user_id'),
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
            "risk_level": risk_score_result['risk_level'].title() + " Risk",
            "risk_probability": prediction['probability_high_risk'],
            "predicted_label": prediction['predicted_label'],
            "risk_score": risk_score_result['total_score'],
            "risk_score_breakdown": risk_score_result['score_breakdown'],
            "triggered_indicators": risk_score_result['triggered_indicators'],
            "risk_explanation": risk_score_result.get('explanation', ''),
            "temporal_data": risk_score_result.get('temporal_data', {}),
            "language_detected": risk_score_result.get('language_detected', 'english'),
            "analysis_method": risk_score_result.get('analysis_method', 'ml_model'),
            "timestamp": datetime.now()
        }
        if llm_sinhala_result:
            complaint_doc['llm_risk_level'] = llm_sinhala_result['risk_level']
            complaint_doc['llm_explanation'] = llm_sinhala_result['explanation']
            complaint_doc['llm_risk_factors'] = llm_sinhala_result['risk_factors']
            complaint_doc['llm_raw_output'] = llm_sinhala_result['raw_output']

        complaints_collection = get_complaints_collection()
        result = complaints_collection.insert_one(complaint_doc)
        inserted_id = result.inserted_id
        try:
            report_generated_at = datetime.now()
            text_report = _generate_text_report(complaint_doc, inserted_id, report_generated_at)
            complaints_collection.update_text_report(complaint_id=inserted_id, text_report=text_report, generated_at=report_generated_at)
            complaint_doc['text_report'] = text_report
            complaint_doc['report_generated_at'] = report_generated_at.isoformat()
        except Exception as report_err:
            print(f"[WARN] Text report auto-save failed: {report_err}")

        complaint_doc['id'] = str(inserted_id)
        complaint_doc['_id'] = str(inserted_id)
        complaint_doc['timestamp'] = complaint_doc['timestamp'].isoformat()
        return jsonify(complaint_doc), 201

    except BadRequest as e:
        print(f"BadRequest Error: {str(e)}")
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        print(f"Error processing complaint: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": f"Error processing complaint: {str(e)}"}), 500

@app.route("/api/complaints/voice-submit", methods=["POST"])
@token_required
def submit_voice_complaint(current_user):
    try:
        if 'audio_file' not in request.files:
            raise BadRequest("No audio file provided")
        audio_file = request.files['audio_file']
        if audio_file.filename == '':
            raise BadRequest("Empty audio file")
        filename = secure_filename(audio_file.filename)
        file_extension = filename.rsplit('.', 1)[-1].lower() if '.' in filename else ''
        audio_data = audio_file.read()

        language = request.form.get('language', 'en-US')
        if language:
            language = language.lower().strip()
            if 'sinhala' in language or 'sin' in language or language.startswith('si'):
                language = 'si'
            elif 'english' in language or language.startswith('en'):
                language = 'en'
            elif '-' in language:
                language = language.split('-')[0]

        manual_transcript = str(request.form.get('complaint', '')).strip()
        if manual_transcript:
            transcript = manual_transcript
            try:
                confidence = float(request.form.get('voice_confidence', 0))
            except Exception:
                confidence = 0.0
            audio_duration = None
        else:
            voice_result = process_voice_complaint(audio_data=audio_data, file_extension=file_extension, language=language)
            if not voice_result['success']:
                return jsonify({"error": "Voice processing failed", "details": voice_result['error']}), 400
            transcript = voice_result['transcript']
            confidence = voice_result['confidence']
            audio_duration = voice_result.get('audio_duration')

        form_data = {
            'guardian_name': request.form.get('guardian_name'),
            'child_name': request.form.get('child_name'),
            'age': request.form.get('age'),
            'phone_number': request.form.get('phone_number'),
            'region': request.form.get('region'),
            'complaint': transcript,
            'child_gender': request.form.get('child_gender'),
            'hours_per_day_on_social_media': request.form.get('hours_per_day_on_social_media'),
            'reporter_role': request.form.get('reporter_role'),
            'device_type': request.form.get('device_type', 'mobile'),
            'user_id': current_user.get('_id') if isinstance(current_user, dict) else str(current_user._id)
        }
        required_fields = ['guardian_name', 'child_name', 'age', 'phone_number', 'region', 'child_gender', 'hours_per_day_on_social_media', 'reporter_role', 'device_type']
        for field in required_fields:
            if not form_data.get(field):
                raise BadRequest(f"Missing required field: {field}")

        validation = _validate_complaint_relevance(
            complaint_text=transcript,
            age=form_data.get('age'),
            hours=form_data.get('hours_per_day_on_social_media'),
            gender=form_data.get('child_gender'),
            device=form_data.get('device_type'),
            reporter_role=form_data.get('reporter_role'),
            language=language
        )
        if not validation['valid']:
            return jsonify({
                "error": validation['message'],
                "issues": validation['issues'],
                "suggestions": validation['suggestions']
            }), 400

        try:
            age_val = int(form_data['age'])
            hours_val = float(form_data['hours_per_day_on_social_media'])
        except ValueError:
            raise BadRequest("Invalid numeric values for age or hours")

        features = {
            'age_of_child': age_val,
            'hours_per_day_on_social_media': hours_val,
            'child_gender': form_data['child_gender'].lower(),
            'reporter_role': form_data['reporter_role'].lower(),
            'device_type': form_data['device_type'].lower()
        }
        prediction = model_service.predict(transcript, features)
        risk_score_result = calculate_risk_score(
            ml_probability=prediction['probability_high_risk'],
            complaint_text=transcript,
            hours_per_day=hours_val,
            previous_risk_level="low",
            previous_ml_score=None
        )
        user_id = form_data['user_id']
        child_name = form_data['child_name']
        complaint_history = []
        if user_id and child_name:
            try:
                from database import SessionLocal, VoiceComplaint
                db = SessionLocal()
                try:
                    user_id_int = int(user_id) if isinstance(user_id, str) and user_id.isdigit() else 0
                    historical_complaints = db.query(VoiceComplaint).filter(
                        VoiceComplaint.user_id == user_id_int,
                        VoiceComplaint.child_name.ilike(child_name)
                    ).order_by(VoiceComplaint.created_at.desc()).limit(50).all()
                    for vc in historical_complaints:
                        complaint_history.append({
                            'timestamp': vc.created_at,
                            'risk_score': vc.risk_score or 0,
                            'ml_risk_score': vc.ml_risk_score or vc.risk_score or 0,
                            'child_name': vc.child_name,
                            'complaint': vc.complaint
                        })
                finally:
                    db.close()
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

        from database import SessionLocal, VoiceComplaint
        import json
        db = SessionLocal()
        try:
            voice_complaint = VoiceComplaint(
                user_id=int(user_id) if isinstance(user_id, str) and user_id.isdigit() else 0,
                session_id=None,
                guardian_name=form_data['guardian_name'],
                child_name=form_data['child_name'],
                age=age_val,
                phone_number=form_data['phone_number'],
                region=form_data['region'],
                complaint=transcript,
                child_gender=features['child_gender'],
                hours_per_day_on_social_media=hours_val,
                reporter_role=features['reporter_role'],
                device_type=features['device_type'],
                speaker_verified=False,
                speaker_similarity=None,
                audio_duration=audio_duration,
                voice_confidence=confidence,
                risk_level=risk_score_result['risk_level'],
                risk_score=risk_score_result['total_score'],
                risk_probability=prediction['probability_high_risk'],
                predicted_label=prediction['predicted_label'],
                ml_risk_score=risk_score_result['score_breakdown']['ml_score'],
                rule_risk_score=risk_score_result['score_breakdown']['rule_score'],
                temporal_drift_score=risk_score_result['score_breakdown'].get('temporal_drift', 0),
                risk_explanation=risk_score_result['explanation'],
                triggered_indicators=json.dumps(risk_score_result['triggered_indicators']),
                temporal_data=json.dumps(risk_score_result.get('temporal_data', {})),
                created_at=datetime.now()
            )
            db.add(voice_complaint)
            db.commit()
            db.refresh(voice_complaint)
            response_data = {
                "id": voice_complaint.id,
                "user_id": str(user_id),
                "guardian_name": voice_complaint.guardian_name,
                "child_name": voice_complaint.child_name,
                "age": voice_complaint.age,
                "phone_number": voice_complaint.phone_number,
                "region": voice_complaint.region,
                "complaint": voice_complaint.complaint,
                "child_gender": voice_complaint.child_gender,
                "hours_per_day_on_social_media": voice_complaint.hours_per_day_on_social_media,
                "reporter_role": voice_complaint.reporter_role,
                "device_type": voice_complaint.device_type,
                "risk_level": voice_complaint.risk_level.title() + " Risk",
                "risk_probability": voice_complaint.risk_probability,
                "risk_score": voice_complaint.risk_score,
                "risk_score_breakdown": risk_score_result['score_breakdown'],
                "triggered_indicators": risk_score_result['triggered_indicators'],
                "risk_explanation": voice_complaint.risk_explanation,
                "temporal_data": risk_score_result.get('temporal_data', {}),
                "input_method": "voice",
                "voice_confidence": voice_complaint.voice_confidence,
                "timestamp": voice_complaint.created_at.isoformat()
            }
            return jsonify(response_data), 201
        finally:
            db.close()
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
    import tempfile, os as _os
    audio_path = None
    converted_path = None
    try:
        audio_file = request.files.get('audio_file') or request.files.get('audio')
        if not audio_file or audio_file.filename == '':
            raise BadRequest("No audio file provided")
        language = request.form.get('language', 'en')
        if language:
            language = language.lower().strip()
            if 'sinhala' in language or 'sin' in language or language.startswith('si'):
                language = 'si'
            elif 'english' in language or language.startswith('en'):
                language = 'en'
            elif '-' in language:
                language = language.split('-')[0]
        filename = secure_filename(audio_file.filename or 'audio.webm')
        fd, audio_path = tempfile.mkstemp(suffix=_os.path.splitext(filename)[1] or '.webm', dir=TEMP_VOICE_UPLOADS_DIR)
        _os.close(fd)
        audio_file.save(audio_path)
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
        from voice_auth_service import get_voice_auth_service
        voice_service = get_voice_auth_service()
        try:
            transcript = voice_service.transcribe_audio(working_path, language=language)
        except Exception as e:
            print(f"[WARN] Whisper transcription failed: {e}")
            transcript = ""
        if not transcript or len(transcript.strip()) < 5:
            return jsonify({
                "transcript": "",
                "confidence": 0.0,
                "language": language,
                "warning": "No clear speech detected. Please re-record and speak clearly into the microphone."
            }), 200
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
        response_payload = {"transcript": transcript, "confidence": 1.0, "language": language}
        try:
            if model_service and model_service.is_loaded():
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
        for p in [audio_path, converted_path]:
            if p and _os.path.exists(p):
                try:
                    _os.remove(p)
                except Exception:
                    pass

@app.route("/api/complaints/<string:complaint_id>", methods=["GET"])
def get_complaint(complaint_id: str):
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
    try:
        skip = int(request.args.get('skip', 0))
        limit = int(request.args.get('limit', 50))
        complaints_collection = get_complaints_collection()
        all_docs = complaints_collection.find(filters=None, limit=skip + limit)
        sliced = all_docs[skip: skip + limit]
        complaints = []
        for doc in sliced:
            if '_id' in doc:
                doc_id = doc['_id']
            else:
                doc_id = doc.get('id')
            doc['id'] = str(doc_id)
            doc['_id'] = str(doc_id)
            if isinstance(doc.get('timestamp'), str):
                pass
            else:
                ts = doc.get('timestamp')
                doc['timestamp'] = ts.isoformat() if ts else None
            complaints.append(doc)
        return jsonify({"complaints": complaints, "count": len(complaints), "skip": skip, "limit": limit})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/complaints/latest", methods=["GET"])
@token_required
def get_latest_complaint(current_user):
    try:
        complaints_collection = get_complaints_collection()
        raw_user_id = current_user.get('_id') if isinstance(current_user, dict) else current_user._id
        user_id = str(raw_user_id)
        try:
            results = complaints_collection.find(filters={"user_id": user_id}, limit=1)
            if not results and raw_user_id != user_id:
                results = complaints_collection.find(filters={"user_id": raw_user_id}, limit=1)
        except Exception:
            all_results = complaints_collection.find(filters=None, limit=500)
            filtered = [doc for doc in all_results if str(doc.get("user_id", "")) == user_id]
            results = filtered[:1]
        complaint = results[0] if results else None
        if not complaint:
            return jsonify({"error": "No complaints found"}), 404
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

@app.route("/api/voice-complaints", methods=["GET"])
@token_required
def list_voice_complaints(current_user):
    try:
        from database import SessionLocal, VoiceComplaint
        raw_user_id = current_user.get('_id') if isinstance(current_user, dict) else current_user._id
        user_id = int(raw_user_id) if isinstance(raw_user_id, str) and raw_user_id.isdigit() else int(raw_user_id) if isinstance(raw_user_id, int) else 0
        skip = int(request.args.get('skip', 0))
        limit = int(request.args.get('limit', 50))
        db = SessionLocal()
        try:
            voice_complaints = db.query(VoiceComplaint).filter(VoiceComplaint.user_id == user_id).order_by(VoiceComplaint.created_at.desc()).offset(skip).limit(limit).all()
            complaints_list = []
            import json
            for vc in voice_complaints:
                complaints_list.append({
                    'id': vc.id,
                    'user_id': vc.user_id,
                    'guardian_name': vc.guardian_name,
                    'child_name': vc.child_name,
                    'age': vc.age,
                    'phone_number': vc.phone_number,
                    'region': vc.region,
                    'complaint': vc.complaint,
                    'child_gender': vc.child_gender,
                    'hours_per_day_on_social_media': vc.hours_per_day_on_social_media,
                    'reporter_role': vc.reporter_role,
                    'device_type': vc.device_type,
                    'speaker_verified': vc.speaker_verified,
                    'speaker_similarity': vc.speaker_similarity,
                    'audio_duration': vc.audio_duration,
                    'voice_confidence': vc.voice_confidence,
                    'risk_level': vc.risk_level,
                    'risk_score': vc.risk_score,
                    'risk_probability': vc.risk_probability,
                    'predicted_label': vc.predicted_label,
                    'risk_explanation': vc.risk_explanation,
                    'triggered_indicators': json.loads(vc.triggered_indicators) if vc.triggered_indicators else [],
                    'temporal_data': json.loads(vc.temporal_data) if vc.temporal_data else {},
                    'risk_score_breakdown': {'ml_score': vc.ml_risk_score, 'rule_score': vc.rule_risk_score, 'temporal_drift': vc.temporal_drift_score},
                    'input_method': 'voice',
                    'timestamp': vc.created_at.isoformat() if vc.created_at else None
                })
            return jsonify({'complaints': complaints_list, 'count': len(complaints_list), 'skip': skip, 'limit': limit})
        finally:
            db.close()
    except Exception as e:
        print(f"Error listing voice complaints: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

@app.route("/api/voice-complaints/<int:complaint_id>", methods=["GET"])
@token_required
def get_voice_complaint(current_user, complaint_id):
    try:
        from database import SessionLocal, VoiceComplaint
        db = SessionLocal()
        try:
            voice_complaint = db.query(VoiceComplaint).filter(VoiceComplaint.id == complaint_id).first()
            if not voice_complaint:
                return jsonify({"error": "Voice complaint not found"}), 404
            raw_user_id = current_user.get('_id') if isinstance(current_user, dict) else current_user._id
            user_id = int(raw_user_id) if isinstance(raw_user_id, str) and raw_user_id.isdigit() else int(raw_user_id) if isinstance(raw_user_id, int) else 0
            if voice_complaint.user_id != user_id:
                return jsonify({"error": "Unauthorized"}), 403
            import json
            complaint_data = {
                'id': voice_complaint.id,
                'user_id': voice_complaint.user_id,
                'guardian_name': voice_complaint.guardian_name,
                'child_name': voice_complaint.child_name,
                'age': voice_complaint.age,
                'phone_number': voice_complaint.phone_number,
                'region': voice_complaint.region,
                'complaint': voice_complaint.complaint,
                'child_gender': voice_complaint.child_gender,
                'hours_per_day_on_social_media': voice_complaint.hours_per_day_on_social_media,
                'reporter_role': voice_complaint.reporter_role,
                'device_type': voice_complaint.device_type,
                'speaker_verified': voice_complaint.speaker_verified,
                'speaker_similarity': voice_complaint.speaker_similarity,
                'audio_duration': voice_complaint.audio_duration,
                'voice_confidence': voice_complaint.voice_confidence,
                'risk_level': voice_complaint.risk_level,
                'risk_score': voice_complaint.risk_score,
                'risk_probability': voice_complaint.risk_probability,
                'predicted_label': voice_complaint.predicted_label,
                'risk_explanation': voice_complaint.risk_explanation,
                'triggered_indicators': json.loads(voice_complaint.triggered_indicators) if voice_complaint.triggered_indicators else [],
                'temporal_data': json.loads(voice_complaint.temporal_data) if voice_complaint.temporal_data else {},
                'risk_score_breakdown': {'ml_score': voice_complaint.ml_risk_score, 'rule_score': voice_complaint.rule_risk_score, 'temporal_drift': voice_complaint.temporal_drift_score},
                'input_method': 'voice',
                'timestamp': voice_complaint.created_at.isoformat() if voice_complaint.created_at else None
            }
            return jsonify(complaint_data)
        finally:
            db.close()
    except Exception as e:
        print(f"Error fetching voice complaint: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

@app.route("/api/statistics", methods=["GET"])
def get_statistics():
    try:
        user_id = request.args.get('user_id')
        complaints_collection = get_complaints_collection()
        from database import get_children_repo
        children_repo = get_children_repo()
        if user_id:
            total_complaints = complaints_collection.count_documents({"user_id": user_id})
            high_risk_complaints = complaints_collection.count_documents({"user_id": user_id, "risk_level": "High Risk"})
            children_count = children_repo.count_children(user_id)
        else:
            total_complaints = complaints_collection.count_documents({})
            high_risk_complaints = complaints_collection.count_documents({"risk_level": "High Risk"})
            children_count = children_repo.count_children()
        return jsonify({"totalComplaints": total_complaints, "highRiskComplaints": high_risk_complaints, "children": children_count})
    except Exception as e:
        import traceback
        print(f"[ERROR] /api/statistics failed: {e}")
        traceback.print_exc()
        return jsonify({"error": str(e), "totalComplaints": 0, "highRiskComplaints": 0, "children": 0}), 500

@app.route("/api/temporal/analysis/<string:user_id>/<string:child_name>", methods=["GET"])
@token_required
def get_temporal_analysis(current_user, user_id, child_name):
    try:
        current_user_id = current_user.get('_id') if isinstance(current_user, dict) else str(current_user._id)
        if current_user_id != user_id:
            return jsonify({"error": "Unauthorized access"}), 403
        complaints_collection = get_complaints_collection()
        all_complaints = complaints_collection.find(filters={'user_id': user_id}, limit=100)
        child_complaints = [c for c in all_complaints if c.get('child_name', '').lower() == child_name.lower()]
        if not child_complaints:
            return jsonify({"message": "No complaint history found for this child", "child_name": child_name, "complaint_count": 0}), 404
        for c in child_complaints:
            if isinstance(c.get('timestamp'), str):
                try:
                    c['timestamp'] = datetime.fromisoformat(c['timestamp'])
                except:
                    c['timestamp'] = datetime.now()
            if 'ml_risk_score' not in c:
                c['ml_risk_score'] = c.get('risk_score', 0)
        analyzer = TemporalDriftAnalyzer()
        time_series = analyzer.generate_time_series_data(child_complaints)
        latest_complaint = sorted(child_complaints, key=lambda x: x['timestamp'])[-1]
        historical_complaints = child_complaints[:-1]
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

@app.errorhandler(404)
def not_found_error(error):
    return jsonify({"error": "Not Found"}), 404

@app.errorhandler(500)
def internal_error(error):
    return jsonify({"error": "Internal Server Error"}), 500

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", 8001)), debug=False) 