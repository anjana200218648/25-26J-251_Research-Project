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

# Only TRUE numeric features (6 features)
NUMERIC_FEATURE_ORDER = [
    "age_of_child",
    "hours_per_day_on_social_media",
    "sentiment_score",
    "risk_word_count",
    "text_length",
    "risk_ratio",
]

# Categorical features handled separately (3 features)
CATEGORICAL_FEATURE_ORDER = [
    "child_gender",
    "reporter_role",
    "device_type",
]

# Get the trained model directory from config
try:
    from config import TRAINED_MODEL_DIR
    TRAINED_DIR = str(TRAINED_MODEL_DIR)
except ImportError:
    # Fallback if config not available
    TRAINED_DIR = os.path.join(os.path.dirname(__file__), "trained_model")
    print(f"[WARNING] Using default trained model directory: {TRAINED_DIR}")

# Validate trained model directory exists
if not os.path.exists(TRAINED_DIR):
    print(f"[WARNING] Trained model directory not found: {TRAINED_DIR}")
    print(f"[WARNING] Please ensure the 'trained_model' folder exists in the backend directory")

MODEL_FILE_CANDIDATES = ["model.pt", "classifier_head.pt"]
ENCODER_FILE_CANDIDATES = ["encoders.json", "label_encoders.json"]

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
            # First try to load from local cache
            try:
                if is_tokenizer:
                    result = AutoTokenizer.from_pretrained(model_name, local_files_only=True)
                else:
                    result = AutoModel.from_pretrained(model_name, local_files_only=True)
                if os.environ.get('WERKZEUG_RUN_MAIN') != 'true':
                    print(f"[INFO] Loaded from cache: {model_name}")
                return result
            except Exception as e:
                if attempt == 0:
                    print(f"[INFO] Model not in cache, downloading...")
                pass
            
            # Load with extended timeout
            if is_tokenizer:
                os.environ['HF_HUB_DOWNLOAD_TIMEOUT'] = str(MODEL_TIMEOUT)
                result = AutoTokenizer.from_pretrained(model_name, local_files_only=False)
            else:
                os.environ['HF_HUB_DOWNLOAD_TIMEOUT'] = str(MODEL_TIMEOUT)
                result = AutoModel.from_pretrained(model_name, local_files_only=False)
            
            print(f"[INFO] Successfully loaded: {model_name}")
            return result
            
        except Exception as e:
            print(f"[WARNING] Attempt {attempt + 1}/{max_retries} failed: {e}")
            if attempt < max_retries - 1:
                delay = RETRY_DELAY * (2 ** attempt)
                print(f"[INFO] Retrying in {delay} seconds...")
                time.sleep(delay)
            else:
                print(f"[ERROR] All {max_retries} attempts failed for {model_name}")
                return None
    
    return None

class MultimodalClassifier(nn.Module):
    """
    Simplified Multimodal Classifier - Single Architecture
    
    Architecture:
    - Text: RoBERTa base model (768 dims)
    - Numeric: 6 features → MLP(64) → MLP(32)
    - Categorical: 3 features → Embeddings(8 dims each)
    - Fusion: Multi-head attention (4 heads)
    - Classifier: Linear(256) → Linear(3)
    """

    def __init__(
        self,
        base_model_name: str,
        num_additional_features: int,  # Total: numeric + categorical
        hidden_dropout_prob: float = 0.1,
        num_numeric: int = 6,
        categorical_cardinalities: Optional[List[int]] = None,
    ):
        super(MultimodalClassifier, self).__init__()

        # Load base transformer model
        self.base = load_model_with_retry(base_model_name, is_tokenizer=False)
        if self.base is None:
            print(f"[WARNING] Primary model failed, trying fallback: {ALTERNATIVE_MODEL_NAME}")
            self.base = load_model_with_retry(ALTERNATIVE_MODEL_NAME, is_tokenizer=False)
            if self.base is None:
                raise Exception(f"Failed to load both primary ({base_model_name}) and fallback ({ALTERNATIVE_MODEL_NAME}) models")

        hidden_size = self.base.config.hidden_size  # 768 for RoBERTa
        self.num_numeric = num_numeric
        self.dropout = nn.Dropout(hidden_dropout_prob)

        # Default categorical cardinalities if not provided
        if categorical_cardinalities is None:
            categorical_cardinalities = [2, 3, 3]  # [gender, role, device]

        # Numeric features MLP (6 → 64 → 32)
        self.numeric_mlp = nn.Sequential(
            nn.Linear(self.num_numeric, 64),
            nn.ReLU(),
            nn.BatchNorm1d(64),
            nn.Dropout(0.3),
            nn.Linear(64, 32),
            nn.ReLU(),
        )

        # Categorical embeddings (3 features, 8 dims each)
        self.embeddings = nn.ModuleList(
            [nn.Embedding(max(2, int(size)), 8) for size in categorical_cardinalities]
        )

        # Fusion dimension: text(768) + numeric(32) + categorical(24)
        fusion_dim = hidden_size + 32 + (8 * len(self.embeddings))

        # Multi-head attention for feature fusion
        self.fusion_attention = nn.MultiheadAttention(
            embed_dim=fusion_dim,
            num_heads=4,
            batch_first=True,
        )

        # Final classifier
        self.classifier = nn.Sequential(
            nn.Linear(fusion_dim, 256),
            nn.GELU(),
            nn.Dropout(0.3),
            nn.Linear(256, 3),  # Low, Medium, High
        )

    def forward(self, input_ids=None, attention_mask=None, additional_features=None, labels=None):
        """
        Forward pass
        
        Args:
            input_ids: Tokenized text
            attention_mask: Attention mask
            additional_features: [numeric(6), categorical(3)] = 9 features
            labels: Optional labels for training
        """
        # Get text representation from RoBERTa
        base_out = self.base(input_ids=input_ids, attention_mask=attention_mask)
        pooled = base_out.last_hidden_state[:, 0, :]  # [CLS] token

        if additional_features is None:
            additional_features = torch.zeros((pooled.size(0), 0), device=pooled.device)

        # Split numeric and categorical features
        numeric = additional_features[:, :self.num_numeric]  # First 6
        categorical = additional_features[:, self.num_numeric:].long()  # Last 3

        # Process numeric through MLP
        numeric_repr = self.numeric_mlp(numeric)

        # Process categorical through embeddings
        cat_embs = []
        for i, emb in enumerate(self.embeddings):
            if i < categorical.size(1):
                cat_ids = categorical[:, i].clamp(min=0, max=emb.num_embeddings - 1)
            else:
                cat_ids = torch.zeros((categorical.size(0),), dtype=torch.long, device=categorical.device)
            cat_embs.append(emb(cat_ids))

        cat_repr = torch.cat(cat_embs, dim=1) if cat_embs else torch.zeros((pooled.size(0), 0), device=pooled.device)

        # Fuse all representations: text + numeric + categorical
        fused = torch.cat([pooled, numeric_repr, cat_repr], dim=1).unsqueeze(1)

        # Apply attention fusion
        attn_out, _ = self.fusion_attention(fused, fused, fused)
        x = attn_out.squeeze(1)

        # Apply dropout and classifier
        x = self.dropout(x)
        logits = self.classifier(x)

        # Calculate loss if labels provided
        loss = None
        if labels is not None:
            loss_fct = nn.CrossEntropyLoss()
            loss = loss_fct(logits.view(-1, 3), labels.view(-1))

        return {"loss": loss, "logits": logits}

class ModelService:
    """Service for loading and using the trained model"""
    
    def __init__(self, auto_load: bool = False):
        """
        Initialize ModelService
        
        Args:
            auto_load: Whether to automatically load the model on initialization.
                       Defaults to False to prevent double-loading during startup.
        """
        self.model: Optional[MultimodalClassifier] = None
        self.tokenizer: Optional[AutoTokenizer] = None
        self.encoders: Dict[str, LabelEncoder] = {}
        self.device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
        self.label_order = LABEL_ORDER
        self._loaded = False
        self.loading_error: Optional[str] = None
        # Add normalization parameters
        self.numeric_mean = None
        self.numeric_std = None
        
        # Auto-load model if requested
        if auto_load:
            try:
                print("[INFO] Auto-loading model...")
                self.load_model()
                print(f"[INFO] Model loaded successfully on: {self.device}")
            except Exception as e:
                self.loading_error = str(e)
                print(f"[ERROR] Failed to auto-load model: {e}")
                print("[INFO] Model will be loaded on first prediction if needed")
    
    def load_model(self):
        """Load the trained model and encoders with robust timeout handling"""
        if self._loaded:
            return

        global BASE_MODEL_NAME

        def _infer_num_numeric(state_dict: Dict[str, torch.Tensor], default: int) -> int:
            """Infer number of numeric features from numeric_mlp layer"""
            for key in ["numeric_mlp.0.weight", "numeric_mlp.0.bias"]:
                if key in state_dict:
                    tensor = state_dict[key]
                    if hasattr(tensor, "shape") and len(tensor.shape) >= 2:
                        return int(tensor.shape[1])
            return default

        def _infer_cardinalities(state_dict: Dict[str, torch.Tensor]) -> Optional[List[int]]:
            """Infer categorical cardinalities from embedding layers"""
            cardinalities = []
            index = 0
            while True:
                key = f"embeddings.{index}.weight"
                if key not in state_dict:
                    break
                weight = state_dict[key]
                if hasattr(weight, "shape") and len(weight.shape) == 2:
                    cardinalities.append(int(weight.shape[0]))
                index += 1
            
            return cardinalities if cardinalities else None
        
        try:
            if os.environ.get('WERKZEUG_RUN_MAIN') != 'true':
                print(f"[INFO] Loading model from: {TRAINED_DIR}")

            # Load metadata if present
            metadata_path = os.path.join(TRAINED_DIR, 'metadata.json')
            if os.path.exists(metadata_path):
                with open(metadata_path, 'r', encoding='utf-8') as f:
                    metadata = json.load(f)
                self.label_order = metadata.get('label_order', LABEL_ORDER)
                
                # Load normalization parameters if available
                self.numeric_mean = metadata.get('numeric_mean')
                self.numeric_std = metadata.get('numeric_std')
            else:
                metadata = {}

            base_model_name = metadata.get('base_model_name', BASE_MODEL_NAME)

            selected_model_path = None
            for file_name in MODEL_FILE_CANDIDATES:
                path = os.path.join(TRAINED_DIR, file_name)
                if os.path.exists(path):
                    selected_model_path = path
                    print(f"[INFO] Found model file: {file_name}")
                    break

            if not selected_model_path:
                pass
            else:
                if os.environ.get('WERKZEUG_RUN_MAIN') != 'true':
                    print(f"[INFO] Model file: {os.path.basename(selected_model_path)}")

            if base_model_name:
                BASE_MODEL_NAME = base_model_name
            elif selected_model_path and os.path.basename(selected_model_path) == "model.pt":
                BASE_MODEL_NAME = ALTERNATIVE_MODEL_NAME

            # Start with defaults from metadata
            num_numeric = int(metadata.get('num_numeric', 6))
            categorical_cardinalities = metadata.get('categorical_cardinalities')
            if not isinstance(categorical_cardinalities, list):
                categorical_cardinalities = None
            
            # Try to infer parameters from checkpoint (overrides metadata)
            if selected_model_path and os.path.exists(selected_model_path):
                try:
                    if os.environ.get('WERKZEUG_RUN_MAIN') != 'true':
                        print("[INFO] Inspecting model checkpoint...")
                    temp_state = torch.load(selected_model_path, map_location='cpu')
                    
                    # Extract state_dict for inspection
                    state_dict_to_check = None
                    if isinstance(temp_state, dict):
                        if 'model_state_dict' in temp_state:
                            state_dict_to_check = temp_state['model_state_dict']
                            # Also get metadata from checkpoint if available
                            if 'num_numeric' in temp_state:
                                num_numeric = int(temp_state['num_numeric'])
                            if 'categorical_cardinalities' in temp_state:
                                categorical_cardinalities = temp_state['categorical_cardinalities']
                        else:
                            # Might be a raw state_dict
                            state_dict_to_check = temp_state
                    
                    # Infer parameters from state_dict if available
                    if state_dict_to_check:
                        # Infer num_numeric from numeric_mlp layer
                        num_numeric = _infer_num_numeric(state_dict_to_check, num_numeric)
                        
                        # Infer categorical cardinalities from embedding layers
                        inferred_cards = _infer_cardinalities(state_dict_to_check)
                        if inferred_cards:
                            categorical_cardinalities = inferred_cards
                    
                    del temp_state  # Free memory
                    if os.environ.get('WERKZEUG_RUN_MAIN') != 'true':
                        print(f"[INFO] Model inspection complete: numeric={num_numeric}, categorical={categorical_cardinalities}")
                except Exception as e:
                    print(f"[WARN] Could not pre-inspect model checkpoint: {e}")

            # Load tokenizer with retry logic
            if os.environ.get('WERKZEUG_RUN_MAIN') != 'true':
                print(f"[INFO] Loading tokenizer: {BASE_MODEL_NAME}")
            self.tokenizer = load_model_with_retry(BASE_MODEL_NAME, is_tokenizer=True)
            
            # Fallback to alternative model if primary fails
            if self.tokenizer is None:
                print(f"[WARNING] Failed to load {BASE_MODEL_NAME}, trying fallback: {ALTERNATIVE_MODEL_NAME}")
                self.tokenizer = load_model_with_retry(ALTERNATIVE_MODEL_NAME, is_tokenizer=True)
                if self.tokenizer is None:
                    raise Exception("Failed to load both primary and fallback tokenizers")
                BASE_MODEL_NAME = ALTERNATIVE_MODEL_NAME
            
            # Load encoders
            encoders_path = None
            for file_name in ENCODER_FILE_CANDIDATES:
                path = os.path.join(TRAINED_DIR, file_name)
                if os.path.exists(path):
                    encoders_path = path
                    print(f"[INFO] Found encoders file: {file_name}")
                    break

            if encoders_path and os.path.exists(encoders_path):
                with open(encoders_path, 'r', encoding='utf-8') as f:
                    enc_map = json.load(f)
                
                for col, classes in enc_map.items():
                    le = LabelEncoder()
                    le.classes_ = np.array(classes, dtype=object)
                    self.encoders[col] = le
            else:
                self._create_default_encoders()
            
            # Initialize model
            num_features = len(NUMERIC_FEATURE_ORDER) + len(CATEGORICAL_FEATURE_ORDER)
            
            self.model = MultimodalClassifier(
                BASE_MODEL_NAME,
                num_features,
                num_numeric=num_numeric,
                categorical_cardinalities=categorical_cardinalities,
            )
            self.model.to(self.device)
            
            # Load classifier head weights if available
            if selected_model_path:
                try:
                    print(f"[INFO] Loading model weights from: {os.path.basename(selected_model_path)}")
                    state = torch.load(selected_model_path, map_location=self.device)

                    # Case A: modern checkpoint with full state_dict
                    if isinstance(state, dict) and 'model_state_dict' in state:
                        self.model.load_state_dict(state['model_state_dict'], strict=False)
                        print("[OK] Full model state_dict loaded")

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
                        keys = list(state.keys())
                        if any(k.startswith('classifier.') for k in keys) or any('classifier' in k for k in keys) or any(k.startswith('base.') for k in keys):
                            try:
                                self.model.load_state_dict(state, strict=False)
                                print("[OK] Partial state dict loaded")
                            except Exception as e:
                                print(f"[WARN] Partial load failed: {e}")
                        else:
                            print("[WARN] Unknown state dict format, skipping")

                except Exception as e:
                    print(f"[WARN] Could not load classifier weights: {e}")
                    print("[INFO] Using untrained model")
            else:
                print("[WARNING] No model weights file found. Using untrained model.")
            
            self.model.eval()
            self._loaded = True
            self.loading_error = None
            if os.environ.get('WERKZEUG_RUN_MAIN') != 'true':
                print(f"[INFO] Model loaded successfully on: {self.device}")
            
        except Exception as e:
            self._loaded = False
            self.loading_error = str(e)
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
        
        print("[INFO] Created default encoders")
    
    def is_loaded(self) -> bool:
        """Check if model is loaded"""
        return self._loaded
    
    def get_status(self) -> Dict:
        """Get model service status"""
        return {
            'loaded': self._loaded,
            'device': str(self.device),
            'error': self.loading_error,
            'trained_dir': TRAINED_DIR,
            'trained_dir_exists': os.path.exists(TRAINED_DIR)
        }
    
    def predict(self, text: str, numeric_features: Dict[str, any], threshold: float = 0.60) -> Dict:
        """
        Make prediction using the model
        
        Args:
            text: Complaint text
            numeric_features: Dictionary of features
            threshold: Probability threshold for high risk
            
        Returns:
            Dictionary with prediction results
        """
        # Check if model is loaded, if not try to load it
        if not self._loaded:
            print("[INFO] Model not loaded. Attempting to load now...")
            try:
                self.load_model()
            except Exception as e:
                error_msg = f"Failed to load model: {e}"
                print(f"[ERROR] {error_msg}")
                # Return error response instead of raising exception
                return {
                    'error': True,
                    'message': error_msg,
                    'probability_high_risk': 0.0,
                    'predicted_label': -1,
                    'predicted_label_name': 'Error',
                    'rule_triggered': False,
                    'rule_reason': error_msg,
                    'method': 'error',
                    'threshold_used': threshold
                }
        
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

        try:
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
            
            # Build numeric features (6 features as float)
            numeric_vec = []
            for key in NUMERIC_FEATURE_ORDER:
                val = numeric_features.get(key, 0.0)
                numeric_vec.append(float(val))
            
            # Apply normalization if available
            if self.numeric_mean and self.numeric_std:
                normalized_numeric = []
                for i, val in enumerate(numeric_vec):
                    if i < len(self.numeric_mean) and i < len(self.numeric_std):
                        mean = self.numeric_mean[i]
                        std = self.numeric_std[i]
                        # Avoid division by zero
                        if std > 0:
                            normalized_val = (val - mean) / std
                        else:
                            normalized_val = val - mean
                        normalized_numeric.append(normalized_val)
                    else:
                        normalized_numeric.append(val)
                numeric_vec = normalized_numeric
            
            # Build categorical features (3 features as int)
            categorical_vec = []
            for key in CATEGORICAL_FEATURE_ORDER:
                val = numeric_features.get(key)
                
                if key in self.encoders and isinstance(val, str):
                    le = self.encoders[key]
                    try:
                        # Find the index of the value in the encoder's classes
                        val = val.lower()
                        mapped = 0
                        for i, cls in enumerate(le.classes_):
                            if cls.lower() == val:
                                mapped = int(i)
                                break
                    except Exception as e:
                        mapped = 0
                    categorical_vec.append(mapped)
                else:
                    # If not found or not string, default to 0
                    categorical_vec.append(0)
            
            # Combine: [numeric_features (6 floats), categorical_features (3 ints)]
            combined_features = numeric_vec + categorical_vec
            
            # Move to device
            input_ids = encoding['input_ids'].to(self.device)
            attention_mask = encoding['attention_mask'].to(self.device)
            additional_features = torch.tensor([combined_features], dtype=torch.float).to(self.device)
            
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
            
        except Exception as e:
            error_msg = f"Error during prediction: {str(e)}"
            print(f"[ERROR] {error_msg}")
            return {
                'error': True,
                'message': error_msg,
                'probability_high_risk': 0.0,
                'predicted_label': -1,
                'predicted_label_name': 'Error',
                'rule_triggered': False,
                'rule_reason': error_msg,
                'method': 'error',
                'threshold_used': threshold
            }


# Create a singleton instance with auto-load enabled
model_service = ModelService(auto_load=True)