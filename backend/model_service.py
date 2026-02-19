import torch
import torch.nn as nn
import torch.nn.functional as F
from transformers import AutoTokenizer, AutoModel
import json
import os
import re
import time
import numpy as np
from typing import Dict, List, Optional
from sklearn.preprocessing import LabelEncoder


# Model configuration
BASE_MODEL_NAME = "mental/mental-roberta-base"
ALTERNATIVE_MODEL_NAME = "roberta-base"  # Fallback model if primary fails
MAX_LENGTH = 256
MODEL_TIMEOUT = 60  # Timeout in seconds for model downloads
MAX_RETRIES = 3     # Maximum retry attempts
RETRY_DELAY = 5     # Base delay between retries (seconds)

LABEL_ORDER = ["Low", "Medium", "High"]

NUMERIC_FEATURE_ORDER = [
    "age_of_child",
    "hours_per_day_on_social_media",
    "sentiment_score",
    "risk_word_count",
    "text_length",
    "risk_ratio",
    "child_gender_encoded",
    "reporter_role_encoded",
    "device_type_encoded",
]

# Get the trained model directory
TRAINED_DIR = os.path.join(os.path.dirname(__file__), "trained_model")

# Emoji pattern for text preprocessing
EMOJI_PATTERN = re.compile(
    "["
    "\U0001F600-\U0001F64F"
    "\U0001F300-\U0001F5FF"
    "\U0001F680-\U0001F6FF"
    "\U0001F1E0-\U0001F1FF"
    "\U00002500-\U00002BEF"
    "\U00002702-\U000027B0"
    "\U000024C2-\U0001F251"
    "\U0001f926-\U0001f937"
    "\U00010000-\U0010ffff"
    "\u2640-\u2642"
    "\u2600-\u2B55"
    "\u200d"
    "\u23cf"
    "\u23e9"
    "\u231a"
    "\ufe0f"
    "\u3030"
    "]+",
    flags=re.UNICODE
)

def preprocess_text(text: str) -> str:
    """Preprocess complaint text"""
    if not isinstance(text, str):
        return ""
    
    # Remove emojis
    text = EMOJI_PATTERN.sub(r'', text)
    
    # Remove repeated words
    text = re.sub(r'\b(\w+)(?:\s+\1\b)+', r'\1', text, flags=re.IGNORECASE)
    
    # Expand common contractions and informal language
    contractions = {
        "don't": "do not", "doesn't": "does not", "didn't": "did not",
        "can't": "cannot", "won't": "will not", "shouldn't": "should not",
        "wouldn't": "would not", "hasn't": "has not", "haven't": "have not",
        "isn't": "is not", "aren't": "are not", "wasn't": "was not",
        "weren't": "were not", "i'm": "i am", "he's": "he is",
        "she's": "she is", "it's": "it is", "we're": "we are",
        "they're": "they are", "i've": "i have", "you've": "you have"
    }
    for contraction, expansion in contractions.items():
        text = re.sub(r'\b' + contraction + r'\b', expansion, text, flags=re.IGNORECASE)
    
    # Lowercase
    text = text.lower()
    
    # Normalize whitespace
    text = re.sub(r'\s+', ' ', text).strip()
    
    return text

def compute_text_features(text: str) -> Dict[str, float]:
    """Compute text_length, risk_word_count, risk_ratio, and sentiment."""
    if not isinstance(text, str):
        text = ""

    text_lower = text.lower()
    tokens = re.findall(r"\b\w+\b", text_lower)
    text_length = len(tokens)

    risk_words = {
        "addicted", "addiction", "obsessed", "panic", "anxiety", "depressed",
        "suicide", "self", "harm", "secretive", "lies", "lying", "hides",
        "angry", "aggressive", "bullying", "predator", "grooming", "abuse",
        "withdraw", "withdrawn", "isolate", "isolation", "sleep", "insomnia",
        "grades", "dropped", "skip", "skips", "absent", "avoid", "avoids",
        "messages", "strangers", "panic", "attack", "weight", "lost",
        "tiktok", "instagram", "facebook", "snapchat", "youtube", "discord",
        "whatsapp", "messenger", "reels", "shorts", "stories", "dm", "dms",
        "scrolling", "scroll", "doomscrolling", "phone", "mobile", "device",
        "screen", "screens", "online", "chat", "stream", "streaming"
    }
    phrase_keywords = [
        "social media",
        "screen time",
        "phone addiction",
        "mobile addiction",
        "online addiction",
        "internet addiction",
    ]
    phrase_hits = sum(text_lower.count(phrase) for phrase in phrase_keywords)

    risk_word_count = sum(1 for t in tokens if t in risk_words) + phrase_hits
    risk_ratio = risk_word_count / (text_length + 1)

    positive_words = {"calm", "balanced", "responsible", "polite", "normal", "fine"}
    negative_words = {"angry", "anxious", "depressed", "panic", "withdrawn", "aggressive"}
    pos = sum(1 for t in tokens if t in positive_words)
    neg = sum(1 for t in tokens if t in negative_words)
    sentiment = 0.0
    if pos + neg > 0:
        sentiment = (pos - neg) / (pos + neg)

    return {
        "text_length": float(text_length),
        "risk_word_count": float(risk_word_count),
        "risk_ratio": float(risk_ratio),
        "sentiment_score": float(sentiment),
    }

def check_high_risk_rules(text: str, numeric_features: Dict[str, object]) -> tuple:
    """
    Rule-based safety layer to catch extreme high-risk cases.
    Returns (is_high_risk, reason)
    """
    text_lower = text.lower()
    
    # Critical keywords indicating severe risk
    critical_keywords = [
        'suicide', 'self harm', 'kill myself', 'end my life',
        'cutting', 'want to die', 'death wish', 'overdose',
        'sexual abuse', 'sexual harassment', 'predator', 'grooming',
        'trafficking', 'exploitation', 'inappropriate touching'
    ]
    
    for keyword in critical_keywords:
        if keyword in text_lower:
            return True, f"Critical safety concern detected: {keyword}"
    
    # Excessive social media usage (>10 hours/day)
    hours = numeric_features.get('hours_per_day_on_social_media', 0)
    age = numeric_features.get('age_of_child', 0)
    
    if hours > 10 and age < 13:
        return True, "Excessive social media usage for young child"
    
    return False, ""

def load_model_with_retry(model_name: str, is_tokenizer: bool = False, max_retries: int = MAX_RETRIES):
    """
    Load model or tokenizer with retry logic and timeout handling.
    
    Args:
        model_name: Name of the model to load
        is_tokenizer: Whether loading tokenizer (True) or model (False)
        max_retries: Maximum number of retry attempts
        
    Returns:
        Loaded model/tokenizer or None if all attempts fail
    """
    for attempt in range(max_retries):
        try:
            print(f"Attempting to load {'tokenizer' if is_tokenizer else 'model'} '{model_name}' (attempt {attempt + 1}/{max_retries})...")
            
            # First try to load from local cache
            try:
                if is_tokenizer:
                    result = AutoTokenizer.from_pretrained(model_name, local_files_only=True)
                else:
                    result = AutoModel.from_pretrained(model_name, local_files_only=True)
                print(f"Successfully loaded {'tokenizer' if is_tokenizer else 'model'} '{model_name}' from local cache")
                return result
            except Exception:
                print(f"Local cache miss for {model_name}, attempting to download...")
            
            # Load with extended timeout
            if is_tokenizer:
                # Set environment variable for Hugging Face timeout
                os.environ['HF_HUB_DOWNLOAD_TIMEOUT'] = str(MODEL_TIMEOUT)
                result = AutoTokenizer.from_pretrained(model_name, local_files_only=False)
            else:
                os.environ['HF_HUB_DOWNLOAD_TIMEOUT'] = str(MODEL_TIMEOUT)
                result = AutoModel.from_pretrained(model_name, local_files_only=False)
            
            print(f"Successfully loaded {'tokenizer' if is_tokenizer else 'model'} '{model_name}'")
            return result
            
        except Exception as e:
            print(f"Attempt {attempt + 1} failed: {str(e)}")
            if attempt < max_retries - 1:
                delay = RETRY_DELAY * (2 ** attempt)  # Exponential backoff
                print(f"Retrying in {delay} seconds...")
                time.sleep(delay)
            else:
                print(f" All {max_retries} attempts failed to load {model_name}")
                return None
    
    return None

class MultimodalClassifier(nn.Module):
    """Multimodal classifier supporting legacy and enhanced architectures."""

    def __init__(
        self,
        base_model_name: str,
        num_additional_features: int,
        hidden_dropout_prob: float = 0.1,
        architecture_type: str = "legacy",
        num_numeric: int = 6,
        categorical_cardinalities: Optional[List[int]] = None,
    ):
        super(MultimodalClassifier, self).__init__()

        print(f"Loading base model: {base_model_name}")
        self.base = load_model_with_retry(base_model_name, is_tokenizer=False)
        if self.base is None:
            print(f"Primary base model failed, trying fallback: {ALTERNATIVE_MODEL_NAME}")
            self.base = load_model_with_retry(ALTERNATIVE_MODEL_NAME, is_tokenizer=False)
            if self.base is None:
                raise Exception(f"Failed to load both primary ({base_model_name}) and fallback ({ALTERNATIVE_MODEL_NAME}) models")
            print(f"Successfully loaded fallback base model: {ALTERNATIVE_MODEL_NAME}")
        else:
            print(f"Primary base model loaded successfully: {base_model_name}")

        hidden_size = self.base.config.hidden_size
        self.architecture_type = architecture_type
        self.num_numeric = num_numeric
        self.dropout = nn.Dropout(hidden_dropout_prob)

        if architecture_type == "enhanced_multimodal_v2":
            if categorical_cardinalities is None:
                categorical_cardinalities = [2, 3, 4]

            self.numeric_mlp = nn.Sequential(
                nn.Linear(self.num_numeric, 64),
                nn.ReLU(),
                nn.Dropout(hidden_dropout_prob),
                nn.Linear(64, 32),
                nn.ReLU(),
            )

            embedding_dim = 8
            self.categorical_embeddings = nn.ModuleList(
                [nn.Embedding(max(2, int(size)), embedding_dim) for size in categorical_cardinalities]
            )

            categorical_total_dim = embedding_dim * len(self.categorical_embeddings)
            fusion_dim = hidden_size + 32 + categorical_total_dim
            self.classifier = nn.Sequential(
                nn.Linear(fusion_dim, 512),
                nn.GELU(),
                nn.Dropout(hidden_dropout_prob),
                nn.Linear(512, 128),
                nn.GELU(),
                nn.Dropout(hidden_dropout_prob),
                nn.Linear(128, 3),
            )
        else:
            combined_size = hidden_size + num_additional_features
            self.classifier = nn.Sequential(
                nn.Linear(combined_size, combined_size // 2),
                nn.ReLU(),
                nn.Dropout(hidden_dropout_prob),
                nn.Linear(combined_size // 2, 3),
            )

    def forward(self, input_ids=None, attention_mask=None, additional_features=None, labels=None):
        base_out = self.base(input_ids=input_ids, attention_mask=attention_mask)
        pooled = base_out.last_hidden_state[:, 0, :]

        if additional_features is None:
            additional_features = torch.zeros((pooled.size(0), 0), device=pooled.device)

        if self.architecture_type == "enhanced_multimodal_v2":
            numeric = additional_features[:, :self.num_numeric]
            categorical = additional_features[:, self.num_numeric:].long()

            numeric_repr = self.numeric_mlp(numeric)

            embedded = []
            for i, emb in enumerate(self.categorical_embeddings):
                if i < categorical.size(1):
                    cat_ids = categorical[:, i].clamp(min=0, max=emb.num_embeddings - 1)
                else:
                    cat_ids = torch.zeros((categorical.size(0),), dtype=torch.long, device=categorical.device)
                embedded.append(emb(cat_ids))
            categorical_repr = torch.cat(embedded, dim=1) if embedded else torch.zeros((pooled.size(0), 0), device=pooled.device)

            x = torch.cat([pooled, numeric_repr, categorical_repr], dim=1)
        else:
            x = torch.cat([pooled, additional_features], dim=1)

        x = self.dropout(x)
        logits = self.classifier(x)
        loss = None
        if labels is not None:
            loss_fct = nn.CrossEntropyLoss()
            loss = loss_fct(logits.view(-1, 3), labels.view(-1))
        return {"loss": loss, "logits": logits}

class ModelService:
    """Service for loading and using the trained model"""
    
    def __init__(self):
        self.model: Optional[MultimodalClassifier] = None
        self.tokenizer: Optional[AutoTokenizer] = None
        self.encoders: Dict[str, LabelEncoder] = {}
        self.device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
        self.label_order = LABEL_ORDER
        self._loaded = False
    
    def load_model(self):
        """Load the trained model and encoders with robust timeout handling"""
        global BASE_MODEL_NAME
        
        try:
            print(f"Loading model from: {TRAINED_DIR}")

            # Load metadata if present
            metadata_path = os.path.join(TRAINED_DIR, 'metadata.json')
            if os.path.exists(metadata_path):
                with open(metadata_path, 'r', encoding='utf-8') as f:
                    metadata = json.load(f)
                self.label_order = metadata.get('label_order', LABEL_ORDER)
                if metadata.get('base_model_name'):
                    BASE_MODEL_NAME = metadata['base_model_name']
            else:
                metadata = {}

            architecture_type = metadata.get('architecture_type', 'legacy')
            num_numeric = int(metadata.get('num_numeric', 6))
            categorical_cardinalities = metadata.get('categorical_cardinalities')
            if not isinstance(categorical_cardinalities, list):
                categorical_cardinalities = None

            # Load tokenizer with retry logic
            print("Loading tokenizer...")
            self.tokenizer = load_model_with_retry(BASE_MODEL_NAME, is_tokenizer=True)
            
            # Fallback to alternative model if primary fails
            if self.tokenizer is None:
                print(f"[WARN] Primary model failed, trying fallback model: {ALTERNATIVE_MODEL_NAME}")
                self.tokenizer = load_model_with_retry(ALTERNATIVE_MODEL_NAME, is_tokenizer=True)
                
                if self.tokenizer is None:
                    raise Exception("Failed to load both primary and fallback tokenizers")
                else:
                    print(f"[OK] Successfully loaded fallback tokenizer: {ALTERNATIVE_MODEL_NAME}")
                    # Update BASE_MODEL_NAME to the working model for MultimodalClassifier
                    BASE_MODEL_NAME = ALTERNATIVE_MODEL_NAME
            else:
                print("[OK] Primary tokenizer loaded successfully")
            
            # Load encoders
            encoders_path = os.path.join(TRAINED_DIR, 'label_encoders.json')
            if os.path.exists(encoders_path):
                with open(encoders_path, 'r', encoding='utf-8') as f:
                    enc_map = json.load(f)
                
                for col, classes in enc_map.items():
                    le = LabelEncoder()
                    le.classes_ = np.array(classes, dtype=object)
                    self.encoders[col] = le
                print("[OK] Encoders loaded")
            else:
                print("[WARN] No encoders file found, using defaults")
                # Create default encoders
                self._create_default_encoders()
            
            # Initialize model
            num_features = len(NUMERIC_FEATURE_ORDER)
            print(f"Initializing model with {num_features} additional features...")
            self.model = MultimodalClassifier(
                BASE_MODEL_NAME,
                num_features,
                architecture_type=architecture_type,
                num_numeric=num_numeric,
                categorical_cardinalities=categorical_cardinalities,
            )
            self.model.to(self.device)
            
            # Load classifier head weights if available. Support multiple save formats.
            classifier_path = os.path.join(TRAINED_DIR, 'classifier_head.pt')
            if os.path.exists(classifier_path):
                try:
                    state = torch.load(classifier_path, map_location=self.device)

                    # Case A: modern checkpoint with full state_dict
                    if isinstance(state, dict) and 'model_state_dict' in state:
                        architecture_type = state.get('architecture_type', architecture_type)
                        num_numeric = int(state.get('num_numeric', num_numeric))
                        categorical_cardinalities = state.get('categorical_cardinalities', categorical_cardinalities)
                        if not isinstance(categorical_cardinalities, list):
                            categorical_cardinalities = None

                        self.model = MultimodalClassifier(
                            state.get('base_model_name', BASE_MODEL_NAME),
                            num_features,
                            architecture_type=architecture_type,
                            num_numeric=num_numeric,
                            categorical_cardinalities=categorical_cardinalities,
                        )
                        self.model.to(self.device)
                        self.model.load_state_dict(state['model_state_dict'], strict=False)
                        print(" Full model state_dict loaded")

                    # Case B: legacy checkpoint with separate parts
                    elif isinstance(state, dict) and 'classifier' in state and 'dropout' in state:
                        classifier_state = state.get('classifier', {})
                        current_classifier_state = self.model.classifier.state_dict()

                        mismatched_shapes = []
                        for key, tensor in classifier_state.items():
                            if key in current_classifier_state and hasattr(tensor, 'shape') and hasattr(current_classifier_state[key], 'shape'):
                                if tuple(tensor.shape) != tuple(current_classifier_state[key].shape):
                                    mismatched_shapes.append((key, tuple(tensor.shape), tuple(current_classifier_state[key].shape)))

                        if mismatched_shapes:
                            print("[WARN] Legacy classifier checkpoint is incompatible with current model shape; skipping legacy head load.")
                            print("[WARN] This usually means artifacts are from an older architecture or label setup. Re-train to refresh 'classifier_head.pt'.")
                            for key, ckpt_shape, model_shape in mismatched_shapes[:4]:
                                print(f"[WARN] Shape mismatch for {key}: checkpoint={ckpt_shape}, model={model_shape}")
                        else:
                            self.model.classifier.load_state_dict(classifier_state)
                            try:
                                self.model.dropout.load_state_dict(state['dropout'])
                            except Exception:
                                # dropout may be a module or simple state; ignore if incompatible
                                pass
                            print("[OK] Classifier head loaded (parts)")

                    # Case C: saved object is a state_dict mapping parameter names -> tensors
                    elif isinstance(state, dict):
                        # Heuristic: if keys start with 'classifier.' try loading partially
                        keys = list(state.keys())
                        if any(k.startswith('classifier.') for k in keys) or any('classifier' in k for k in keys):
                            try:
                                # Load matching keys into model (non-strict)
                                self.model.load_state_dict(state, strict=False)
                                print("[OK] Model state_dict loaded (partial)")
                            except Exception as e:
                                print(f"[WARN] Partial load failed: {e}")
                        else:
                            print("[WARN] Unrecognized classifier file contents; skipping load")

                    else:
                        print("[WARN] Classifier file format not recognized; skipping load")

                except Exception as e:
                    print(f"[WARN] Could not load classifier weights: {e}")
                    print("[WARN] Continuing with initialized classifier. For best accuracy, regenerate trained artifacts.")
            else:
                print("[WARN] No classifier weights found, using initialized model")
            
            self.model.eval()
            self._loaded = True
            print("[OK] Model loaded successfully")
            print(f"[INFO] Model running on: {self.device}")
            
        except Exception as e:
            print(f"[ERROR] Error loading model: {e}")
            print("[INFO] This might be due to network connectivity issues or Hugging Face server problems.")
            print("[INFO] Try running the application again when network connectivity is restored.")
            raise
    
    def _create_default_encoders(self):
        """Create default encoders if none exist"""
        # Default gender encoder
        le_gender = LabelEncoder()
        le_gender.classes_ = np.array(['female', 'male'], dtype=object)
        self.encoders['child_gender'] = le_gender
        
        # Default device_type encoder
        le_device = LabelEncoder()
        le_device.classes_ = np.array(['smartphone', 'tablet', 'laptop', 'desktop'], dtype=object)
        self.encoders['device_type'] = le_device
        
        # Default reporter role encoder
        le_role = LabelEncoder()
        le_role.classes_ = np.array(['mother', 'father', 'guardian'], dtype=object)
        self.encoders['reporter_role'] = le_role
    
    def is_loaded(self) -> bool:
        """Check if model is loaded"""
        return self._loaded
    
    def predict(self, text: str, numeric_features: Dict[str, any], threshold: float = 0.60) -> Dict:
        
        if not self._loaded:
            raise Exception("Model not loaded. Call load_model() first.")
        
        # STEP 1: Check rule-based safety layer first
        is_high_risk_rule, reason = check_high_risk_rules(text, numeric_features)
        if is_high_risk_rule:
            return {
                'probability_high_risk': 0.95,
                'predicted_label': 2,
                'predicted_label_name': 'High',
                'rule_triggered': True,
                'rule_reason': reason,
                'method': 'rule-based',
                'threshold_used': threshold
            }

        # Add text-derived features
        text_features = compute_text_features(text)
        for key, value in text_features.items():
            numeric_features[key] = value

        # Preprocess text
        processed_text = preprocess_text(text)
        
        # Tokenize
        encoding = self.tokenizer(
            processed_text,
            padding='max_length',
            truncation=True,
            max_length=MAX_LENGTH,
            return_tensors='pt'
        )
        
        numeric_vec = []
        for key in NUMERIC_FEATURE_ORDER:
            if key.endswith('_encoded'):
                raw_key = key.replace('_encoded', '')
                val = numeric_features.get(raw_key)

                if raw_key in self.encoders and isinstance(val, str):
                    le = self.encoders[raw_key]
                    try:
                        # Find the index of the value in the encoder's classes
                        val = val.lower()
                        matched = False
                        for i, cls in enumerate(le.classes_):
                            if cls.lower() == val:
                                mapped = int(i)
                                matched = True
                                break
                        if not matched:
                            mapped = 0
                    except Exception as e:
                        mapped = 0
                    numeric_vec.append(float(mapped))
                else:
                    numeric_vec.append(float(val) if val is not None else 0.0)
            else:
                val = numeric_features.get(key, 0.0)
                numeric_vec.append(float(val))
        
        # Move to device
        input_ids = encoding['input_ids'].to(self.device)
        attention_mask = encoding['attention_mask'].to(self.device)
        additional_features = torch.tensor([numeric_vec], dtype=torch.float).to(self.device)
        
        # STEP 2: Use ML model with optimized 60% threshold
        # Let the transformer model analyze the full sentence context
        with torch.no_grad():
            outputs = self.model(
                input_ids=input_ids,
                attention_mask=attention_mask,
                additional_features=additional_features
            )
            logits = outputs['logits']
            probs = F.softmax(logits, dim=1).cpu().numpy()[0]
            high_idx = self.label_order.index('High') if 'High' in self.label_order else 2
            prob_high = float(probs[high_idx])
            pred_label = int(np.argmax(probs))
            label_name = self.label_order[pred_label]
        
        # Return balanced prediction
        return {
            'probability_high_risk': prob_high,
            'predicted_label': pred_label,
            'predicted_label_name': label_name,
            'probabilities': {self.label_order[i]: float(p) for i, p in enumerate(probs)},
            'rule_triggered': False,
            'rule_reason': '',
            'method': 'ml-model',
            'threshold_used': threshold
        }
