"""
Configuration settings for the AI Risk Assessment System
"""

import os
from pathlib import Path

# Project paths
PROJECT_ROOT = Path(__file__).parent.parent
UPLOADS_DIR = PROJECT_ROOT / "uploads"
OUTPUTS_DIR = PROJECT_ROOT / "outputs"
MODELS_DIR = PROJECT_ROOT / "models"

# Create directories if they don't exist
UPLOADS_DIR.mkdir(exist_ok=True)
OUTPUTS_DIR.mkdir(exist_ok=True)
MODELS_DIR.mkdir(exist_ok=True)

# Optional .env support (recommended for local dev)
# Load from project root regardless of where you run `python app.py` from.
try:
    from dotenv import load_dotenv
    load_dotenv(PROJECT_ROOT / ".env")
except Exception:
    pass

# Database configuration
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:123123123@localhost:5432/maindgard2")
MODEL_CONFIG = {
    "parser_model": "google/flan-t5-base",
    "generator_model": "google/flan-t5-base",
    "use_gpu": False,  # Set to True if you have CUDA-capable GPU
    "cache_dir": str(MODELS_DIR)
}

# Risk assessment thresholds
RISK_THRESHOLDS = {
    "low": (0, 40),
    "medium": (41, 70),
    "high": (71, 100)
}

# Conflict detection thresholds
CONFLICT_THRESHOLDS = {
    "consistent": (0, 15),
    "partial_inconsistency": (16, 40),
    "high_inconsistency": (41, 100)
}

# Report metadata
SYSTEM_VERSION = "v2.1"
EVALUATION_MODE = "Automated Conflict-Aware Decision System"

# ---------------- Blockchain / Sepolia ----------------
#
# This project originally used Sepolia-only env vars (SEPOLIA_*). To support
# local chains (Ganache/Hardhat/etc.) we allow selecting a network via
# BLOCKCHAIN_NETWORK and reading the corresponding *_ vars.
#
# Supported networks:
#   - sepolia (default)
#   - ganache
#
BLOCKCHAIN_NETWORK = (os.getenv("BLOCKCHAIN_NETWORK", "sepolia") or "sepolia").strip().lower()
BLOCKCHAIN_ENABLED = bool(int(os.getenv("BLOCKCHAIN_ENABLED", "1")))

# Backward-compatible Sepolia env vars
SEPOLIA_RPC_URL = os.getenv("SEPOLIA_RPC_URL")
SEPOLIA_PRIVATE_KEY = os.getenv("SEPOLIA_PRIVATE_KEY")
SEPOLIA_FROM_ADDRESS = os.getenv("SEPOLIA_FROM_ADDRESS")
SEPOLIA_CONTRACT_ADDRESS = os.getenv("SEPOLIA_CONTRACT_ADDRESS")
SEPOLIA_CHAIN_ID = int(os.getenv("SEPOLIA_CHAIN_ID", "11155111"))

# Ganache env vars
GANACHE_RPC_URL = os.getenv("GANACHE_RPC_URL") or os.getenv("GANACHE_HTTP_URL")
GANACHE_PRIVATE_KEY = os.getenv("GANACHE_PRIVATE_KEY")
GANACHE_USE_PRIVATE_KEY = bool(int(os.getenv("GANACHE_USE_PRIVATE_KEY", "0")))
GANACHE_FROM_ADDRESS = os.getenv("GANACHE_FROM_ADDRESS")
GANACHE_CONTRACT_ADDRESS = os.getenv("GANACHE_CONTRACT_ADDRESS")
GANACHE_CHAIN_ID = int(os.getenv("GANACHE_CHAIN_ID", "5777"))  # Ganache GUI default is often 5777

# Generic aliases used by the blockchain module
if BLOCKCHAIN_NETWORK == "ganache":
    BLOCKCHAIN_RPC_URL = GANACHE_RPC_URL
    # Default to node-managed unlocked accounts for Ganache.
    # Opt-in to local signing with GANACHE_USE_PRIVATE_KEY=1.
    BLOCKCHAIN_PRIVATE_KEY = GANACHE_PRIVATE_KEY if GANACHE_USE_PRIVATE_KEY else None
    BLOCKCHAIN_FROM_ADDRESS = GANACHE_FROM_ADDRESS
    BLOCKCHAIN_CONTRACT_ADDRESS = GANACHE_CONTRACT_ADDRESS
    BLOCKCHAIN_CHAIN_ID = GANACHE_CHAIN_ID
else:
    # default: sepolia
    BLOCKCHAIN_RPC_URL = SEPOLIA_RPC_URL
    BLOCKCHAIN_PRIVATE_KEY = SEPOLIA_PRIVATE_KEY
    BLOCKCHAIN_FROM_ADDRESS = SEPOLIA_FROM_ADDRESS
    BLOCKCHAIN_CONTRACT_ADDRESS = SEPOLIA_CONTRACT_ADDRESS
    BLOCKCHAIN_CHAIN_ID = SEPOLIA_CHAIN_ID

# ABI path (export your deployed contract ABI here)
CONTRACT_ABI_PATH = PROJECT_ROOT / "src" / "contract_abi.json"