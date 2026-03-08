"""
Configuration module for SafeKid backend application.
All paths and settings are defined here for easy maintenance and portability.
"""

import os
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Base directory (backend folder)
BASE_DIR = Path(__file__).resolve().parent

# Database Configuration
DATABASE_URL = os.getenv('DATABASE_URL', 'postgresql+psycopg2://postgres:password@localhost:5432/user_complaints')

# JWT Configuration
SECRET_KEY = os.getenv('SECRET_KEY', 'your-super-secret-key-change-this-in-production')

# Directory Paths (all relative to BASE_DIR)
TRAINED_MODEL_DIR = BASE_DIR / 'trained_model'
PRETRAINED_MODELS_DIR = BASE_DIR / 'pretrained_models'
TEMP_VOICE_UPLOADS_DIR = BASE_DIR / 'temp_voice_uploads'

# Voice Authentication Settings
VOICE_SPKREC_MODEL = PRETRAINED_MODELS_DIR / 'spkrec-ecapa-voxceleb'
MAX_VOICE_DURATION = 120  # seconds (allow up to 2 minutes per requirements)
MIN_VOICE_DURATION = 2   # seconds

# FFmpeg Configuration
# If FFMPEG_PATH is not set, it will try to find FFmpeg in common locations
FFMPEG_PATH = os.getenv('FFMPEG_PATH', None)

# Hugging Face Configuration
HF_HUB_DISABLE_SYMLINKS_WARNING = os.getenv('HF_HUB_DISABLE_SYMLINKS_WARNING', '1')

# Whisper Model Configuration
WHISPER_MODEL_SIZE = os.getenv('WHISPER_MODEL_SIZE', 'medium')  # tiny, base, small, medium, large
# Path to pre-downloaded Whisper model (faster loading)

WHISPER_LOCAL_MODEL_PATH = os.getenv('WHISPER_LOCAL_MODEL_PATH', None)
if WHISPER_LOCAL_MODEL_PATH:
    WHISPER_LOCAL_MODEL_PATH = BASE_DIR / WHISPER_LOCAL_MODEL_PATH

# Create necessary directories
def create_required_directories():
    """Create all required directories if they don't exist."""
    directories = [
        TEMP_VOICE_UPLOADS_DIR,
        PRETRAINED_MODELS_DIR,
        TRAINED_MODEL_DIR,
    ]
    
    for directory in directories:
        directory.mkdir(parents=True, exist_ok=True)
        # Silently ensure directory exists (only log on creation to reduce spam)

# Find FFmpeg on system
def find_ffmpeg():
    """
    Try to locate FFmpeg on the system.
    Returns the path to FFmpeg binary directory or None if not found.
    """
    import shutil
    import sys
    
    # First, check if already in PATH
    if shutil.which('ffmpeg'):
        return None  # Already accessible
    
    # Check environment variable
    if FFMPEG_PATH and Path(FFMPEG_PATH).exists():
        return str(Path(FFMPEG_PATH))
    
    # Try common Windows locations
    if sys.platform == 'win32':
        common_locations = [
            Path.home() / 'ffmpeg',
            Path('C:/ffmpeg'),
            Path('C:/Program Files/ffmpeg'),
        ]
        
        for location in common_locations:
            if location.exists():
                # Search for bin directory containing ffmpeg.exe
                for bin_dir in location.rglob('bin'):
                    if (bin_dir / 'ffmpeg.exe').exists():
                        return str(bin_dir)
    
    # Try common Linux/Mac locations
    elif sys.platform in ['linux', 'darwin']:
        common_locations = [
            '/usr/local/bin',
            '/usr/bin',
            '/opt/homebrew/bin',
        ] 
        
        for location in common_locations:
            if Path(location).exists() and (Path(location) / 'ffmpeg').exists():
                return location
    
    return None

# Export all configuration
__all__ = [
    'BASE_DIR',
    'DATABASE_URL',
    'SECRET_KEY',
    'TRAINED_MODEL_DIR',
    'PRETRAINED_MODELS_DIR',
    'TEMP_VOICE_UPLOADS_DIR',
    'VOICE_SPKREC_MODEL',
    'MAX_VOICE_DURATION',
    'MIN_VOICE_DURATION',
    'FFMPEG_PATH',
    'WHISPER_MODEL_SIZE',
    'create_required_directories',
    'find_ffmpeg',
]
