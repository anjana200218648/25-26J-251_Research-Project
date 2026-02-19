"""Multimodal-only training pipeline for child risk classification.
"""

import json
import os
import random
from dataclasses import dataclass
from typing import Dict, List, Tuple

import numpy as np
import pandas as pd
import torch
import torch.nn as nn
import torch.nn.functional as F
from sklearn.metrics import accuracy_score, f1_score
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder
from torch.utils.data import DataLoader, Dataset
from transformers import AutoModel, AutoTokenizer


# -------------------- CONFIG --------------------
BASE_MODEL_NAME = "mental/mental-roberta-base"
FALLBACK_MODEL_NAME = "roberta-base"
MAX_LENGTH = 256
BATCH_SIZE = 16
EPOCHS = 4
LEARNING_RATE = 3e-5
WEIGHT_DECAY = 0.01
DROPOUT_PROB = 0.2
SEED = 42
DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")

CSV_PATH = r"c:\Users\Poornima Gimhani\Documents\GitHub\25-26J-251\social_media_addiction_complaints_updated.csv"
OUTPUT_DIR = r"c:\Users\Poornima Gimhani\Documents\GitHub\25-26J-251\IT22563828\backend\trained_model"

TEXT_COLUMN = "complaint_text"
TARGET_COLUMN = "labeled_risk"

NUMERIC_FEATURES = [
    "age_of_child",
    "hours_per_day_on_social_media",
    "sentiment_score",
    "risk_word_count",
    "text_length",
    "risk_ratio",
]

CATEGORICAL_FEATURES = [
    "child_gender",
    "reporter_role",
    "device_type",
]

LABEL_ORDER = ["Low", "Medium", "High"]


@dataclass
class PreparedData:
    texts: np.ndarray
    numeric: np.ndarray
    categorical: np.ndarray
    labels: np.ndarray
    cat_encoders: Dict[str, LabelEncoder]
    categorical_cardinalities: List[int]


def set_seed(seed: int) -> None:
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    torch.cuda.manual_seed_all(seed)


def load_dataset() -> pd.DataFrame:
    df = pd.read_csv(CSV_PATH)
    df = df.dropna(subset=[TEXT_COLUMN, TARGET_COLUMN]).copy()

    if "text_length" not in df.columns:
        df["text_length"] = df[TEXT_COLUMN].astype(str).map(len)
    if "risk_word_count" not in df.columns:
        df["risk_word_count"] = 0.0
    if "risk_ratio" not in df.columns:
        df["risk_ratio"] = 0.0
    if "sentiment_score" not in df.columns:
        df["sentiment_score"] = 0.0

    for col in CATEGORICAL_FEATURES:
        if col not in df.columns:
            raise ValueError(f"Missing required categorical column: {col}")

    return df


def normalize_numeric(df: pd.DataFrame) -> np.ndarray:
    data = df[NUMERIC_FEATURES].astype(float).copy()
    data["age_of_child"] = np.clip(data["age_of_child"] / 20.0, 0, 1)
    data["hours_per_day_on_social_media"] = np.clip(data["hours_per_day_on_social_media"] / 15.0, 0, 1)
    data["text_length"] = np.clip(data["text_length"] / max(1.0, data["text_length"].max()), 0, 1)
    data["risk_word_count"] = np.clip(data["risk_word_count"] / max(1.0, data["risk_word_count"].max()), 0, 1)
    data["risk_ratio"] = np.clip(data["risk_ratio"], 0, 1)
    data["sentiment_score"] = (np.clip(data["sentiment_score"], -1, 1) + 1.0) / 2.0
    return data.values.astype(np.float32)


def encode_categoricals(df: pd.DataFrame) -> Tuple[np.ndarray, Dict[str, LabelEncoder], List[int]]:
    encoders: Dict[str, LabelEncoder] = {}
    encoded_cols: List[np.ndarray] = []
    cardinalities: List[int] = []

    for col in CATEGORICAL_FEATURES:
        encoder = LabelEncoder()
        values = df[col].astype(str).str.lower().str.strip()
        encoded = encoder.fit_transform(values)
        encoded_cols.append(encoded)
        encoders[col] = encoder
        cardinalities.append(len(encoder.classes_))

    return np.array(encoded_cols).T.astype(np.int64), encoders, cardinalities


def prepare_data(df: pd.DataFrame) -> PreparedData:
    label_map = {label: i for i, label in enumerate(LABEL_ORDER)}
    labels = df[TARGET_COLUMN].map(label_map).values
    if np.any(pd.isna(labels)):
        raise ValueError("Dataset contains labels outside LABEL_ORDER")

    numeric = normalize_numeric(df)
    categorical, encoders, cardinalities = encode_categoricals(df)
    texts = df[TEXT_COLUMN].astype(str).values

    return PreparedData(
        texts=texts,
        numeric=numeric,
        categorical=categorical,
        labels=labels.astype(np.int64),
        cat_encoders=encoders,
        categorical_cardinalities=cardinalities,
    )


class ComplaintDataset(Dataset):
    def __init__(
        self,
        texts: np.ndarray,
        numeric: np.ndarray,
        categorical: np.ndarray,
        labels: np.ndarray,
        tokenizer: AutoTokenizer,
    ) -> None:
        self.texts = texts
        self.numeric = numeric
        self.categorical = categorical
        self.labels = labels
        self.tokenizer = tokenizer

    def __len__(self) -> int:
        return len(self.texts)

    def __getitem__(self, idx: int) -> Dict[str, torch.Tensor]:
        encoded = self.tokenizer(
            str(self.texts[idx]),
            padding="max_length",
            truncation=True,
            max_length=MAX_LENGTH,
            return_tensors="pt",
        )
        return {
            "input_ids": encoded["input_ids"].squeeze(0),
            "attention_mask": encoded["attention_mask"].squeeze(0),
            "numeric": torch.tensor(self.numeric[idx], dtype=torch.float),
            "categorical": torch.tensor(self.categorical[idx], dtype=torch.long),
            "label": torch.tensor(self.labels[idx], dtype=torch.long),
        }


class MultimodalClassifier(nn.Module):
    """Enhanced multimodal architecture with additional custom layers."""

    def __init__(
        self,
        base_model_name: str,
        num_numeric: int,
        categorical_cardinalities: List[int],
        dropout_prob: float = DROPOUT_PROB,
    ) -> None:
        super().__init__()
        self.base = AutoModel.from_pretrained(base_model_name)
        hidden_size = self.base.config.hidden_size

        self.numeric_mlp = nn.Sequential(
            nn.Linear(num_numeric, 64),
            nn.ReLU(),
            nn.Dropout(dropout_prob),
            nn.Linear(64, 32),
            nn.ReLU(),
        )

        embedding_dim = 8
        self.categorical_embeddings = nn.ModuleList(
            [nn.Embedding(max(2, int(size)), embedding_dim) for size in categorical_cardinalities]
        )

        categorical_dim = embedding_dim * len(self.categorical_embeddings)
        fusion_dim = hidden_size + 32 + categorical_dim

        self.dropout = nn.Dropout(dropout_prob)
        self.classifier = nn.Sequential(
            nn.Linear(fusion_dim, 512),
            nn.GELU(),
            nn.Dropout(dropout_prob),
            nn.Linear(512, 128),
            nn.GELU(),
            nn.Dropout(dropout_prob),
            nn.Linear(128, len(LABEL_ORDER)),
        )

    def forward(
        self,
        input_ids: torch.Tensor,
        attention_mask: torch.Tensor,
        numeric: torch.Tensor,
        categorical: torch.Tensor,
    ) -> torch.Tensor:
        base_out = self.base(input_ids=input_ids, attention_mask=attention_mask)
        text_repr = base_out.last_hidden_state[:, 0, :]

        numeric_repr = self.numeric_mlp(numeric)

        categorical_embs = []
        for idx, emb in enumerate(self.categorical_embeddings):
            cat_ids = categorical[:, idx].clamp(min=0, max=emb.num_embeddings - 1)
            categorical_embs.append(emb(cat_ids))
        categorical_repr = torch.cat(categorical_embs, dim=1)

        fused = torch.cat([text_repr, numeric_repr, categorical_repr], dim=1)
        fused = self.dropout(fused)
        return self.classifier(fused)


def evaluate(model: nn.Module, loader: DataLoader) -> Tuple[float, float]:
    model.eval()
    all_preds: List[int] = []
    all_labels: List[int] = []

    with torch.no_grad():
        for batch in loader:
            logits = model(
                input_ids=batch["input_ids"].to(DEVICE),
                attention_mask=batch["attention_mask"].to(DEVICE),
                numeric=batch["numeric"].to(DEVICE),
                categorical=batch["categorical"].to(DEVICE),
            )
            preds = torch.argmax(logits, dim=1)
            all_preds.extend(preds.cpu().tolist())
            all_labels.extend(batch["label"].cpu().tolist())

    acc = accuracy_score(all_labels, all_preds)
    macro_f1 = f1_score(all_labels, all_preds, average="macro")
    return acc, macro_f1


def train_multimodal(df: pd.DataFrame) -> Tuple[float, float, Dict[str, object]]:
    prepared = prepare_data(df)

    idx = np.arange(len(prepared.labels))
    train_idx, val_idx = train_test_split(
        idx,
        test_size=0.2,
        stratify=prepared.labels,
        random_state=SEED,
    )

    model_name = BASE_MODEL_NAME
    try:
        tokenizer = AutoTokenizer.from_pretrained(model_name)
        model = MultimodalClassifier(
            base_model_name=model_name,
            num_numeric=prepared.numeric.shape[1],
            categorical_cardinalities=prepared.categorical_cardinalities,
        )
    except Exception:
        model_name = FALLBACK_MODEL_NAME
        tokenizer = AutoTokenizer.from_pretrained(model_name)
        model = MultimodalClassifier(
            base_model_name=model_name,
            num_numeric=prepared.numeric.shape[1],
            categorical_cardinalities=prepared.categorical_cardinalities,
        )

    model.to(DEVICE)

    train_ds = ComplaintDataset(
        prepared.texts[train_idx],
        prepared.numeric[train_idx],
        prepared.categorical[train_idx],
        prepared.labels[train_idx],
        tokenizer,
    )
    val_ds = ComplaintDataset(
        prepared.texts[val_idx],
        prepared.numeric[val_idx],
        prepared.categorical[val_idx],
        prepared.labels[val_idx],
        tokenizer,
    )

    train_loader = DataLoader(train_ds, batch_size=BATCH_SIZE, shuffle=True)
    val_loader = DataLoader(val_ds, batch_size=BATCH_SIZE)

    optimizer = torch.optim.AdamW(model.parameters(), lr=LEARNING_RATE, weight_decay=WEIGHT_DECAY)

    best_acc = 0.0
    best_f1 = 0.0
    best_state = None

    for epoch in range(EPOCHS):
        model.train()
        for batch in train_loader:
            optimizer.zero_grad()
            logits = model(
                input_ids=batch["input_ids"].to(DEVICE),
                attention_mask=batch["attention_mask"].to(DEVICE),
                numeric=batch["numeric"].to(DEVICE),
                categorical=batch["categorical"].to(DEVICE),
            )
            loss = F.cross_entropy(logits, batch["label"].to(DEVICE))
            loss.backward()
            nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            optimizer.step()

        val_acc, val_f1 = evaluate(model, val_loader)
        print(f"Epoch {epoch + 1}/{EPOCHS} - Val Acc: {val_acc:.4f}, Macro F1: {val_f1:.4f}")

        if val_acc > best_acc or (val_acc == best_acc and val_f1 > best_f1):
            best_acc = val_acc
            best_f1 = val_f1
            best_state = {
                "model_state_dict": model.state_dict(),
                "base_model_name": model_name,
                "num_numeric": prepared.numeric.shape[1],
                "categorical_cardinalities": prepared.categorical_cardinalities,
                "architecture_type": "enhanced_multimodal_v2",
            }

    return best_acc, best_f1, {
        "model_type": "roberta_multimodal",
        "state": best_state,
        "encoders": prepared.cat_encoders,
        "numeric_features": NUMERIC_FEATURES,
        "categorical_features": CATEGORICAL_FEATURES,
    }


def save_model(result: Dict[str, object]) -> None:
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    state = result["state"]
    torch.save(state, os.path.join(OUTPUT_DIR, "classifier_head.pt"))

    encoders = {k: list(v.classes_) for k, v in result["encoders"].items()}
    with open(os.path.join(OUTPUT_DIR, "label_encoders.json"), "w", encoding="utf-8") as f:
        json.dump(encoders, f, ensure_ascii=False, indent=2)

    metadata = {
        "model_type": result["model_type"],
        "label_order": LABEL_ORDER,
        "numeric_features": result["numeric_features"],
        "categorical_features": result["categorical_features"],
        "text_column": TEXT_COLUMN,
        "base_model_name": state["base_model_name"],
        "architecture_type": state["architecture_type"],
        "categorical_cardinalities": state["categorical_cardinalities"],
        "num_numeric": state["num_numeric"],
    }
    with open(os.path.join(OUTPUT_DIR, "metadata.json"), "w", encoding="utf-8") as f:
        json.dump(metadata, f, ensure_ascii=False, indent=2)


def main() -> None:
    set_seed(SEED)
    df = load_dataset()

    val_acc, val_f1, result = train_multimodal(df)

    print("Validation results:")
    print(f"  RoBERTa multimodal - acc: {val_acc:.4f}, f1: {val_f1:.4f}")
    print(f"Selected model: {result['model_type']}")

    save_model(result)
    print(f"Saved artifacts to: {OUTPUT_DIR}")


if __name__ == "__main__":
    main()
