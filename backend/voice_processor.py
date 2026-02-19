"""
Voice-to-Text Processing Module

This module handles voice complaint submission by converting audio input
to text using Google Speech-to-Text API, enabling accessible complaint
submission for parents and guardians.

Key Features:
- Audio file validation and processing
- Speech-to-text conversion using Google Cloud Speech API
- Text normalization and cleaning
- Error handling for audio quality issues
"""

import os
import io
import traceback
from typing import Dict, Optional, Tuple
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Check if Google Cloud Speech is available
try:
    from google.cloud import speech
    GOOGLE_SPEECH_AVAILABLE = True
except ImportError:
    GOOGLE_SPEECH_AVAILABLE = False
    print("Warning: google-cloud-speech not installed. Voice processing will not work.")
    print("Install with: pip install google-cloud-speech")


class VoiceProcessor:
    """
    Handles voice-based complaint input processing.
    
    Converts audio files to text and prepares them for ML analysis.
    """
    
    def __init__(self):
        """
        Initialize the voice processor with Google Cloud credentials.
        
        Requires GOOGLE_APPLICATION_CREDENTIALS environment variable
        pointing to service account JSON file.
        """
        if not GOOGLE_SPEECH_AVAILABLE:
            raise ImportError(
                "google-cloud-speech library not installed. "
                "Install with: pip install google-cloud-speech"
            )
        
        # Initialize Google Cloud Speech client
        try:
            self.client = speech.SpeechClient()
            print("Google Cloud Speech API initialized successfully")
        except Exception as e:
            print(f"Warning: Failed to initialize Google Cloud Speech API: {e}")
            print("Make sure GOOGLE_APPLICATION_CREDENTIALS environment variable is set")
            self.client = None
        
        # Supported audio formats and configurations
        self.SUPPORTED_FORMATS = ['wav', 'mp3', 'ogg', 'flac', 'webm', 'mp4', 'm4a']
        self.MAX_AUDIO_SIZE_MB = 10  # Maximum audio file size
        
    def process_audio_file(
        self, 
        audio_data: bytes, 
        file_extension: str,
        language_code: str = "en-US"
    ) -> Dict:
        """
        Process audio file and convert to text.
        
        Args:
            audio_data: Raw audio file bytes
            file_extension: File extension (wav, mp3, etc.)
            language_code: Language for recognition (default: en-US)
            
        Returns:
            Dict containing:
            - success: Boolean indicating success/failure
            - transcript: Extracted text from audio
            - confidence: Recognition confidence score
            - error: Error message if failed
        """
        
        # Validate client initialization
        if not self.client:
            return {
                'success': False,
                'transcript': '',
                'confidence': 0.0,
                'error': 'Speech API not initialized. Check credentials.'
            }
        
        # Validate file format
        if file_extension.lower() not in self.SUPPORTED_FORMATS:
            return {
                'success': False,
                'transcript': '',
                'confidence': 0.0,
                'error': f'Unsupported format: {file_extension}. Supported: {", ".join(self.SUPPORTED_FORMATS)}'
            }
        
        # Validate file size
        size_mb = len(audio_data) / (1024 * 1024)
        if size_mb > self.MAX_AUDIO_SIZE_MB:
            return {
                'success': False,
                'transcript': '',
                'confidence': 0.0,
                'error': f'File too large: {size_mb:.1f}MB. Maximum: {self.MAX_AUDIO_SIZE_MB}MB'
            }
        
        try:
            # Configure audio and recognition settings
            audio = speech.RecognitionAudio(content=audio_data)
            
            # Determine encoding based on file extension
            encoding_map = {
                'wav': speech.RecognitionConfig.AudioEncoding.LINEAR16,
                'mp3': speech.RecognitionConfig.AudioEncoding.MP3,
                'ogg': speech.RecognitionConfig.AudioEncoding.OGG_OPUS,
                'flac': speech.RecognitionConfig.AudioEncoding.FLAC,
                'webm': speech.RecognitionConfig.AudioEncoding.WEBM_OPUS,
                'mp4': speech.RecognitionConfig.AudioEncoding.ENCODING_UNSPECIFIED,
                'm4a': speech.RecognitionConfig.AudioEncoding.ENCODING_UNSPECIFIED
            }
            
            encoding = encoding_map.get(
                file_extension.lower(),
                speech.RecognitionConfig.AudioEncoding.ENCODING_UNSPECIFIED
            )
            
            # Configure recognition
            config_kwargs = {
                "encoding": encoding,
                "language_code": language_code,
                "enable_automatic_punctuation": True,
                "model": "default",
                "use_enhanced": True,
            }

            # Avoid forcing sample rate for container/compressed formats.
            # Let Google detect sample rate from audio headers where possible.
            if file_extension.lower() in ['wav', 'flac']:
                config_kwargs["sample_rate_hertz"] = 16000

            config = speech.RecognitionConfig(**config_kwargs)
            
            # Perform speech recognition
            print(f"Processing audio ({size_mb:.2f}MB, format: {file_extension})...")
            response = self.client.recognize(config=config, audio=audio)
            
            # Extract transcript from response
            if not response.results:
                return {
                    'success': False,
                    'transcript': '',
                    'confidence': 0.0,
                    'error': 'No speech detected in audio. Please ensure clear audio with minimal background noise.'
                }
            
            # Combine all transcript alternatives (take best confidence)
            transcript_parts = []
            confidences = []
            
            for result in response.results:
                if result.alternatives:
                    best_alternative = result.alternatives[0]
                    transcript_parts.append(best_alternative.transcript)
                    confidences.append(best_alternative.confidence)
            
            # Combine transcript
            full_transcript = ' '.join(transcript_parts)
            avg_confidence = sum(confidences) / len(confidences) if confidences else 0.0
            
            # Clean and normalize transcript
            cleaned_transcript = self._clean_transcript(full_transcript)
            
            print(f"Speech recognition successful. Confidence: {avg_confidence:.2%}")
            
            return {
                'success': True,
                'transcript': cleaned_transcript,
                'confidence': avg_confidence,
                'error': None
            }
            
        except Exception as e:
            print(f"Error during speech recognition: {str(e)}")
            traceback.print_exc()
            return {
                'success': False,
                'transcript': '',
                'confidence': 0.0,
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
    language: str = "en-US"
) -> Dict:
    """
    High-level function to process voice complaint.
    
    Wrapper function that handles the complete voice-to-text pipeline.
    
    Args:
        audio_data: Audio file bytes
        file_extension: File extension
        language: Recognition language code
        
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
            'error': 'Voice processing not available. Missing dependencies.'
        }
    except Exception as e:
        return {
            'success': False,
            'transcript': '',
            'error': f'Voice processing error: {str(e)}'
        }
