import os
import traceback

import train_model


# Reduce runtime for artifact refresh
train_model.EPOCHS = 1
train_model.BATCH_SIZE = 8

# Reduce noisy progress output from model download/load
os.environ["HF_HUB_DISABLE_PROGRESS_BARS"] = "1"
os.environ["TRANSFORMERS_VERBOSITY"] = "error"


def main() -> None:
    try:
        train_model.set_seed(train_model.SEED)
        df = train_model.load_dataset()
        val_acc, val_f1, result = train_model.train_multimodal(df)
        print("Validation results:")
        print(f"  acc: {val_acc:.4f}, f1: {val_f1:.4f}")
        train_model.save_model(result)
        print(f"Saved artifacts to: {train_model.OUTPUT_DIR}")
    except Exception:
        traceback.print_exc()
        raise


if __name__ == "__main__":
    main()
