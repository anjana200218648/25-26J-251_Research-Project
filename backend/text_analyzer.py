import json
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime
import logging

# Try to import ollama and requests with fallbacks
try:
    import ollama
    OLLAMA_AVAILABLE = True
except ImportError:
    OLLAMA_AVAILABLE = False
    print("⚠️ Warning: ollama module not installed. Run: pip install ollama")

try:
    import requests
    REQUESTS_AVAILABLE = True
except ImportError:
    REQUESTS_AVAILABLE = False
    print("⚠️ Warning: requests module not installed. Run: pip install requests")

# ========== LOGGING SETUP ==========
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ========== OLLAMA MANAGER WITH SINHALA SUPPORT ==========
class OllamaManager:
    def __init__(self):
        self.available_models = []
        self.active_model = None
        self.ollama_running = False
        self.server_url = "http://127.0.0.1:11434"
        
        # SINHALA SUPPORTED MODELS (in priority order)
        self.SINHALA_SUPPORTED_MODELS = [
            # Best for Sinhala (multilingual with Asian language support)
            {'name': 'qwen2.5:3b', 'size': '2.1GB', 'description': 'Excellent Asian language support'},
            {'name': 'qwen:7b', 'size': '4.6GB', 'description': 'Good Chinese/Asian language model'},
            {'name': 'mistral', 'size': '4.1GB', 'description': 'Good multilingual support'},
            {'name': 'llama3.2:3b', 'size': '2.0GB', 'description': 'Latest Llama with multilingual'},
            {'name': 'llama3.2:1b', 'size': '0.7GB', 'description': 'Small but capable'},
            {'name': 'llama2:7b', 'size': '3.8GB', 'description': 'Decent multilingual'},
            {'name': 'gemma2:2b', 'size': '1.6GB', 'description': 'Google model with multilingual'},
            # Fallback models (basic multilingual)
            {'name': 'gemma:2b', 'size': '1.4GB', 'description': 'Basic multilingual'},
            {'name': 'tinyllama', 'size': '0.6GB', 'description': 'Very small, basic support'},
        ]
        
        self.modules_available = OLLAMA_AVAILABLE and REQUESTS_AVAILABLE
        
        if self.modules_available:
            self.check_ollama_status()
        else:
            logger.warning("⚠️ Required modules not available for Ollama")
    
    def check_ollama_status(self):
        """Check if Ollama server is running and find best model for Sinhala"""
        if not self.modules_available:
            return
            
        try:
            # Try to connect to Ollama server
            response = requests.get(f"{self.server_url}/api/tags", timeout=10)
            if response.status_code == 200:
                self.ollama_running = True
                data = response.json()
                self.available_models = [model['name'] for model in data.get('models', [])]
                
                if self.available_models:
                    logger.info(f"✅ Ollama server running. Found {len(self.available_models)} models")
                    
                    # Find the BEST model for Sinhala support
                    self.find_best_sinhala_model()
                    
                else:
                    logger.warning("⚠️ Ollama running but no models found")
                    self.active_model = None
                    self.suggest_sinhala_model()
            else:
                logger.warning(f"⚠️ Ollama server responded with status: {response.status_code}")
                self.ollama_running = False
                
        except requests.exceptions.ConnectionError:
            logger.warning("⚠️ Ollama server not running")
            self.ollama_running = False
        except Exception as e:
            logger.error(f"❌ Error checking Ollama: {e}")
            self.ollama_running = False
    
    def find_best_sinhala_model(self):
        """Find the best available model for Sinhala language support"""
        best_model = None
        best_score = -1
        
        for available in self.available_models:
            available_lower = available.lower()
            score = 0
            
            # Score each model based on Sinhala support capability
            for idx, supported in enumerate(self.SINHALA_SUPPORTED_MODELS):
                if supported['name'] in available_lower:
                    # Higher priority models get higher scores
                    score = len(self.SINHALA_SUPPORTED_MODELS) - idx
                    
                    # Bonus points for Asian language models
                    if 'qwen' in available_lower:
                        score += 5  # Qwen is excellent for Asian languages
                    if 'mistral' in available_lower:
                        score += 3  # Mistral has good multilingual
                    if 'llama3' in available_lower:
                        score += 4  # Latest Llama versions
                    if 'llama2' in available_lower:
                        score += 2
                    
                    break
            
            if score > best_score:
                best_score = score
                best_model = available
        
        if best_model:
            self.active_model = best_model
            logger.info(f"✅ Selected best model for Sinhala: {best_model} (Score: {best_score})")
            
            # Check if it's a good model for Sinhala
            if best_score >= 5:
                logger.info(f"   🎯 Excellent choice for Sinhala content analysis!")
            elif best_score >= 3:
                logger.info(f"   👍 Good choice for Sinhala content analysis")
            else:
                logger.info(f"   ⚠️ Basic model - Sinhala support may be limited")
        else:
            # No preferred model found, use the first available
            self.active_model = self.available_models[0]
            logger.info(f"⚠️ No preferred Sinhala model found. Using: {self.active_model}")
            logger.info(f"   Consider downloading: qwen2.5:3b or mistral for better Sinhala support")
    
    def suggest_sinhala_model(self):
        """Suggest which model to download for Sinhala support"""
        logger.info("\n📥 RECOMMENDED MODELS FOR SINHALA SUPPORT:")
        logger.info("=" * 50)
        
        for i, model in enumerate(self.SINHALA_SUPPORTED_MODELS[:5], 1):
            logger.info(f"{i}. {model['name']} ({model['size']})")
            logger.info(f"   {model['description']}")
        
        logger.info("\n💡 To download the best model for Sinhala:")
        logger.info("   Open terminal and run: ollama pull qwen2.5:3b")
        logger.info("   Or for smaller size: ollama pull llama3.2:3b")
        logger.info("=" * 50)
    
    def is_available(self):
        """Check if Ollama is ready to use"""
        return (self.modules_available and 
                self.ollama_running and 
                self.active_model is not None and 
                len(self.available_models) > 0)
    
    def get_model(self):
        """Get active model name"""
        return self.active_model
    
    def get_model_info(self):
        """Get information about the active model"""
        if not self.active_model:
            return None
        
        for model_info in self.SINHALA_SUPPORTED_MODELS:
            if model_info['name'] in self.active_model.lower():
                return model_info
        
        return {
            'name': self.active_model,
            'size': 'Unknown',
            'description': 'Custom/Unknown model',
            'sinhala_support': 'Unknown'
        }
    
    def analyze_with_llm(self, text: str, has_sinhala: bool = False) -> Dict[str, Any]:
        """Analyze text using Ollama LLM with Sinhala awareness - 0-100 RISK SCORE"""
        if not self.is_available() or not OLLAMA_AVAILABLE:
            raise Exception("Ollama not available")
        
        try:
            model_name = self.active_model
            model_info = self.get_model_info()
            
            # Prepare context based on language
            if has_sinhala:
                language_context = """
IMPORTANT: This text contains Sinhala language (Sri Lankan language).
Please analyze it carefully considering:
1. Sinhala cultural context
2. Sri Lankan social norms
3. Local expressions and idioms
"""
                # Check if model is known to support Sinhala well
                if model_info and any(x in model_info['name'] for x in ['qwen', 'mistral', 'llama3']):
                    language_context += "\nNote: You have good multilingual capabilities for analyzing Sinhala content."
            else:
                language_context = "This text is primarily in English or mixed languages."
            
            text_for_analysis = text[:1800]  # Slightly more tokens for multilingual
            
            prompt = f"""Analyze this text for child safety (children aged 10-18 years).

{language_context}

Text to analyze:
{text_for_analysis}

Calculate a RISK SCORE from 0 to 100 where:
- 0-10: Very safe, appropriate content
- 11-30: Mostly safe, minor concerns
- 31-60: Moderate risk, needs supervision
- 61-80: High risk, inappropriate for children
- 81-100: Very high risk, dangerous content

Respond ONLY in valid JSON format with these EXACT fields:
{{
    "is_appropriate": boolean,
    "risk_level": "very low" or "low" or "medium" or "high" or "very high",
    "risk_score": number between 0.0 and 100.0,
    "max_risk_score": 100.0,
    "risk_categories": ["category1", "category2"],
    "explanation": "Brief explanation including the risk score calculation",
    "confidence": number between 0.0 and 1.0,
    "recommendations": ["rec1", "rec2", "rec3"]
}}

IMPORTANT RISK CATEGORIES TO CHECK (score each appropriately):
1. Gambling or betting content (සූදු, බෙට්) - add 5-15 points
2. Violence or aggression (පහර, මරණ) - add 10-20 points
3. Sexual or explicit content (ලිංගික, අශ්ලීල) - add 15-25 points
4. Drug or alcohol promotion (මත්ද්රව්ය, මත්පැන්) - add 10-20 points
5. Online addiction (social media, gaming) - add 5-15 points
6. Cyberbullying or harassment (වධක, පීඩා) - add 10-20 points
7. Financial scams or fraud (වංචා, පැටලිලි) - add 5-15 points
8. Hate speech or discrimination (වෛරය, වෙනස්කම්) - add 10-20 points
9. Self-harm or suicide references (සියදිවි, මරණ) - add 20-30 points

If the text is completely safe and appropriate, risk_score should be 0-10.
If unsure, use a score between 20-40 with low confidence."""

            response = ollama.chat(
                model=model_name,
                messages=[
                    {
                        'role': 'system', 
                        'content': 'You are a multilingual child safety expert. You analyze text in multiple languages including Sinhala. Always respond with valid JSON only. Provide a risk score from 0-100.'
                    },
                    {
                        'role': 'user',
                        'content': prompt
                    }
                ],
                options={
                    'temperature': 0.1,
                    'num_predict': 800 if has_sinhala else 600
                }
            )
            
            result_text = response['message']['content'].strip()
            
            # Clean the response
            result_text = result_text.replace('```json', '').replace('```', '').strip()
            
            try:
                analysis = json.loads(result_text)
                
                # Ensure risk_score is between 0-100
                risk_score = analysis.get('risk_score', 0.0)
                if risk_score < 0:
                    analysis['risk_score'] = 0.0
                elif risk_score > 100:
                    analysis['risk_score'] = 100.0
                
                # Set max_risk_score if not present
                if 'max_risk_score' not in analysis:
                    analysis['max_risk_score'] = 100.0
                
                logger.info(f"✅ LLM analysis successful with {model_name}")
                logger.info(f"   Risk Score: {analysis['risk_score']:.1f}/100")
                
                # Add model info to analysis
                analysis['model_used'] = model_name
                analysis['model_supports_sinhala'] = has_sinhala and model_info is not None
                
                return analysis
            except json.JSONDecodeError as e:
                logger.error(f"❌ Failed to parse LLM response as JSON: {e}")
                
                # Try to extract JSON from response
                json_start = result_text.find('{')
                json_end = result_text.rfind('}') + 1
                if json_start >= 0 and json_end > json_start:
                    json_str = result_text[json_start:json_end]
                    try:
                        analysis = json.loads(json_str)
                        
                        # Ensure risk_score is between 0-100
                        risk_score = analysis.get('risk_score', 0.0)
                        if risk_score < 0:
                            analysis['risk_score'] = 0.0
                        elif risk_score > 100:
                            analysis['risk_score'] = 100.0
                        
                        analysis['model_used'] = model_name + " (JSON extracted)"
                        return analysis
                    except:
                        pass
                
                # If still failing, create a basic analysis
                logger.warning("⚠️ Creating fallback analysis")
                return {
                    "is_appropriate": True,
                    "risk_level": "low",
                    "risk_score": 15.0,
                    "max_risk_score": 100.0,
                    "risk_categories": [],
                    "explanation": f"Analysis inconclusive - using safe default. Model: {model_name}",
                    "confidence": 0.3,
                    "recommendations": [
                        "Review content manually",
                        "Supervise child's online activities",
                        "Consider cultural context for Sinhala content"
                    ],
                    "model_used": model_name,
                    "note": "JSON parsing failed, using fallback"
                }
                
        except Exception as e:
            logger.error(f"❌ LLM analysis failed: {e}")
            raise

# Initialize Ollama manager
ollama_manager = OllamaManager()

# ========== FASTAPI APP ==========
app = FastAPI(
    title="Sinhala Complaint Text Analyzer with Ollama",
    description="Analyze Sinhala and English complaint text using Ollama LLM for child safety assessment",
    version="1.0.0"
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ========== DATA MODELS ==========
class TextAnalysisRequest(BaseModel):
    text: str
    force_sinhala: Optional[bool] = None  # Force Sinhala analysis even if auto-detect fails

class ContentAnalysis(BaseModel):
    is_appropriate: bool
    risk_level: str
    risk_score: float  # 0-100 scale
    max_risk_score: float = 100.0
    risk_categories: List[str]
    explanation: str
    confidence: float
    recommendations: List[str]
    model_used: Optional[str] = None
    model_supports_sinhala: Optional[bool] = None

class TextAnalysisResponse(BaseModel):
    success: bool
    message: str
    text_length: int
    has_sinhala: bool
    language_detected: str
    analysis: Optional[ContentAnalysis]
    error: Optional[str]
    timestamp: str
    processing_time_ms: float

# ========== HELPER FUNCTIONS ==========
def detect_sinhala(text: str) -> bool:
    """Detect if text contains Sinhala characters"""
    return any(0x0D80 <= ord(char) <= 0x0DFF for char in text)

def rule_based_analysis(text: str) -> Dict[str, Any]:
    """Fallback rule-based analysis when Ollama is not available"""
    text_lower = text.lower()
    
    # ENHANCED risk keywords with Sinhala coverage
    risk_keywords = {
        'gambling': ['bet', 'gamble', 'casino', 'lottery', 'සූදු', 'බෙට්', 'බෙටින්', 'කාසින්', 'ලොතරි'],
        'violence': ['kill', 'fight', 'hit', 'attack', 'murder', 'මරනවා', 'මරා', 'පහර', 'වෙඩි'],
        'sexual': ['sex', 'porn', 'nude', 'xxx', 'adult', 'ලිංගික', 'සේක්ස්', 'අශ්ලීල'],
        'drugs': ['drug', 'weed', 'heroin', 'cocaine', 'මත්ද්රව්ය', 'කබා', 'හෙරොයින්'],
        'alcohol': ['beer', 'whisky', 'arrack', 'vodka', 'drunk', 'බියර්', 'විස්කි', 'අරක්කු', 'මත්පැන්'],
        'scams': ['scam', 'fraud', 'phishing', 'hack', 'වංචා', 'පැටලිලි', 'සොරකම'],
        'bullying': ['bully', 'harass', 'abuse', 'threat', 'වධක', 'බලහත්කාර', 'පීඩා'],
        'suicide': ['suicide', 'kill myself', 'end life', 'මරණය', 'සියදිවි', 'නසාගන්න'],
        'hate': ['hate', 'racist', 'discriminate', 'වෙනස්කම්', 'වෛරය', 'අපකීර්තිය']
    }
    
    detected_categories = []
    total_risk_score = 0.0
    
    for category, keywords in risk_keywords.items():
        for keyword in keywords:
            if keyword in text_lower:
                if category not in detected_categories:
                    detected_categories.append(category)
                
                count = text_lower.count(keyword)
                severity = 1.5 if category in ['sexual', 'suicide', 'drugs'] else 1.3 if category in ['violence', 'bullying'] else 1.0
                total_risk_score += (2.0 + count * 1.5) * severity
    
    final_risk_score = min(total_risk_score, 100.0)
    
    if final_risk_score >= 60:
        risk_level = "high"
        is_appropriate = False
    elif final_risk_score >= 30:
        risk_level = "medium"
        is_appropriate = False
    elif final_risk_score >= 10:
        risk_level = "low"
        is_appropriate = True
    else:
        risk_level = "very low"
        is_appropriate = True
    
    has_sinhala = detect_sinhala(text)
    explanation = f"Rule-based analysis detected risks: {', '.join(detected_categories) if detected_categories else 'none'}. Risk score: {final_risk_score:.1f}/100"
    if has_sinhala:
        explanation += " (Sinhala content analyzed)"
    
    return {
        "is_appropriate": is_appropriate,
        "risk_level": risk_level,
        "risk_score": round(final_risk_score, 1),
        "max_risk_score": 100.0,
        "risk_categories": detected_categories,
        "explanation": explanation,
        "confidence": min(0.7 + (len(detected_categories) * 0.05), 0.95),
        "recommendations": [
            "Always supervise children's online activities",
            "Discuss online safety with children regularly",
            "Use parental control software when necessary"
        ],
        "model_used": "rule_based",
        "model_supports_sinhala": True
    }

# ========== MAIN ENDPOINT ==========
@app.post("/api/analyze-text", response_model=TextAnalysisResponse)
async def analyze_text_endpoint(request: TextAnalysisRequest):
    """Analyze complaint text using Ollama LLM (with Sinhala support)"""
    import time
    start_time = time.time()
    
    try:
        text = request.text.strip()
        
        if not text:
            return TextAnalysisResponse(
                success=False,
                message="Empty text provided",
                text_length=0,
                has_sinhala=False,
                language_detected="none",
                analysis=None,
                error="Text cannot be empty",
                timestamp=datetime.now().isoformat(),
                processing_time_ms=0
            )
        
        # Detect Sinhala
        has_sinhala = detect_sinhala(text) or request.force_sinhala
        language_detected = "sinhala" if has_sinhala else "english"
        
        logger.info(f"\n📝 Analyzing text ({len(text)} chars)")
        logger.info(f"🌐 Language: {language_detected}")
        
        # Try Ollama analysis first
        analysis_result = None
        analysis_method = "unknown"
        error_msg = None
        
        if ollama_manager.is_available():
            try:
                logger.info(f"🤖 Using Ollama model: {ollama_manager.get_model()}")
                analysis_result = ollama_manager.analyze_with_llm(text, has_sinhala)
                analysis_method = "ollama"
                logger.info(f"✅ Ollama analysis complete - Risk: {analysis_result['risk_score']:.1f}/100")
            except Exception as e:
                error_msg = f"Ollama analysis failed: {str(e)}"
                logger.warning(f"⚠️ {error_msg}")
                logger.info("🔄 Falling back to rule-based analysis")
        else:
            error_msg = "Ollama not available"
            logger.warning("⚠️ Ollama not available, using rule-based analysis")
        
        # Fallback to rule-based if Ollama failed
        if not analysis_result:
            analysis_result = rule_based_analysis(text)
            analysis_method = "rule_based"
        
        processing_time = (time.time() - start_time) * 1000  # Convert to ms
        
        return TextAnalysisResponse(
            success=True,
            message=f"Analysis completed using {analysis_method}",
            text_length=len(text),
            has_sinhala=has_sinhala,
            language_detected=language_detected,
            analysis=ContentAnalysis(**analysis_result),
            error=error_msg,
            timestamp=datetime.now().isoformat(),
            processing_time_ms=round(processing_time, 2)
        )
        
    except Exception as e:
        logger.error(f"❌ Analysis error: {str(e)}")
        import traceback
        traceback.print_exc()
        
        processing_time = (time.time() - start_time) * 1000
        
        return TextAnalysisResponse(
            success=False,
            message="Analysis failed",
            text_length=len(request.text) if request.text else 0,
            has_sinhala=False,
            language_detected="unknown",
            analysis=None,
            error=str(e),
            timestamp=datetime.now().isoformat(),
            processing_time_ms=round(processing_time, 2)
        )

# ========== HEALTH CHECK ==========
@app.get("/")
async def root():
    ollama_status = {
        "available": ollama_manager.is_available(),
        "running": ollama_manager.ollama_running,
        "active_model": ollama_manager.get_model(),
        "total_models": len(ollama_manager.available_models),
        "models": ollama_manager.available_models
    }
    
    if not ollama_manager.is_available():
        if not OLLAMA_AVAILABLE:
            ollama_status["error"] = "ollama module not installed - Run: pip install ollama"
        elif not REQUESTS_AVAILABLE:
            ollama_status["error"] = "requests module not installed - Run: pip install requests"
        elif not ollama_manager.ollama_running:
            ollama_status["error"] = "Ollama server not running - Run: ollama serve"
        elif not ollama_manager.available_models:
            ollama_status["error"] = "No models downloaded - Run: ollama pull qwen2.5:3b"
    
    return {
        "app": "Sinhala Complaint Text Analyzer",
        "version": "1.0.0",
        "status": "running",
        "features": {
            "sinhala_support": True,
            "english_support": True,
            "ollama_integration": True,
            "rule_based_fallback": True,
            "risk_scoring": "0-100 scale"
        },
        "ollama": ollama_status,
        "endpoints": {
            "analyze": "/api/analyze-text",
            "health": "/health",
            "docs": "/docs"
        },
        "recommended_models": [
            "qwen2.5:3b (Best for Sinhala)",
            "mistral (Good multilingual)",
            "llama3.2:3b (Latest, good support)"
        ]
    }

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "ollama_available": ollama_manager.is_available(),
        "active_model": ollama_manager.get_model()
    }

if __name__ == "__main__":
    import uvicorn
    logger.info("🚀 Starting Sinhala Complaint Text Analyzer API")
    logger.info("🤖 Ollama Integration: ENABLED")
    logger.info("🌐 Sinhala & English Support: ENABLED")
    logger.info("📊 Risk Scoring: 0-100 scale")
    
    if ollama_manager.is_available():
        logger.info(f"✅ Using Ollama model: {ollama_manager.get_model()}")
    else:
        logger.warning("⚠️ Ollama not available - will use rule-based fallback")
        logger.info("💡 To enable Ollama:")
        logger.info("   1. Install: pip install ollama requests")
        logger.info("   2. Start server: ollama serve")
        logger.info("   3. Download model: ollama pull qwen2.5:3b")
    
    uvicorn.run(app, host="0.0.0.0", port=8001)
