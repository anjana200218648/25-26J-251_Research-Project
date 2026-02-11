import { useLocation, useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Download,
  Home,
  Share2,
  RotateCcw,
  AlertTriangle,
  CheckCircle,
  AlertCircle,
  Hash,
  MessageSquare,
  Gift,
  Eye,
  Brain,
  FileText,
  RefreshCcw,
  Folder,
  ChevronRight,
  Wine,
  Droplets,
  Cigarette,
  Zap,
  Skull,
  Book,
  Newspaper,
  Leaf,
  Gamepad2,
  Target,
  Shield,
  Languages,
  Copy,
  UserCheck,
  Clock,
  BarChart3,
  Type,
  Search,
  BookOpen
} from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { useEffect, useState } from 'react';

const getRiskLevel = (score: number) => {
  if (score <= 30) return 'low';
  if (score <= 60) return 'medium';
  return 'high';
};

const getRiskColor = (level: string) => {
  switch (level) {
    case 'low':
      return 'text-green-600';
    case 'medium':
      return 'text-yellow-600';
    case 'high':
      return 'text-red-600';
    default:
      return 'text-gray-500';
  }
};

const getRiskBgColor = (level: string) => {
  switch (level) {
    case 'low':
      return 'bg-green-50 border-green-200';
    case 'medium':
      return 'bg-yellow-50 border-yellow-200';
    case 'high':
      return 'bg-red-50 border-red-200';
    default:
      return 'bg-gray-50 border-gray-200';
  }
};

const getProgressColor = (score: number) => {
  if (score <= 30) return 'bg-green-500';
  if (score <= 60) return 'bg-yellow-500';
  return 'bg-red-500';
};

const featureIcons = {
  captions: MessageSquare,
  rewards: Gift,
  visuals: Eye,
  text_extraction: FileText,
  image_analysis: Brain,
  hashtag_analysis: Hash,
  category_analysis: Folder
};

// Icon mapping for content types
const contentTypeIcons: Record<string, any> = {
  'Alcohol': Wine,
  'Blood': Droplets,
  'Cigarette': Cigarette,
  'Gun': Zap,
  'illegal drugs': Skull,
  'Knife': Skull,
  'Fight': AlertTriangle,
  'Graphical Violence': Skull,
  'Insultion-gesture': AlertCircle,
  'Anime': Gamepad2,
  'Harmful Meme': AlertTriangle,
  'Video Game': Gamepad2,
  'educational': Book,
  'informational': Newspaper,
  'neutral_content': Leaf,
  'General': Folder,
  'model_prediction': Target,
  'possible_match': Eye,
  'default': Folder
};

export default function Results() {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [textTabValue, setTextTabValue] = useState(0);
  
  // Debug: Check what data we received
  useEffect(() => {
    console.log('📊 Results page received location.state:', location.state);
    console.log('📝 Text Analysis Data:', location.state?.textAnalysisResult);
  }, [location.state]);

  // ✅ FIXED: Safe data extraction with comprehensive fallbacks
  const score = location.state?.score ?? 50;
  const fileName = location.state?.fileName ?? 'unknown.png';
  const prediction = location.state?.prediction ?? 'non-addictive';
  const reasoning = location.state?.reasoning ?? 'Analysis completed successfully. Consider reviewing the content for any concerning elements.';
  const confidence = location.state?.confidence ?? 0.7;
  const features = location.state?.features ?? ['image_analysis'];
  
  // ✅ Text Analysis Data
  const textAnalysisResult = location.state?.textAnalysisResult;
  const extractedText = location.state?.extractedText ?? 'No text could be extracted from the image.';
  const sinhalaText = location.state?.sinhalaText ?? '';
  const englishText = location.state?.englishText ?? '';
  const ocrConfidence = location.state?.ocrConfidence ?? 0;
  const safetyScore = location.state?.safetyScore ?? 0;
  const ageAppropriateness = location.state?.ageAppropriateness ?? 'unknown';
  const riskCategories = location.state?.riskCategories ?? [];
  const safetyRecommendations = location.state?.safetyRecommendations ?? [];
  const contentAnalysis = location.state?.contentAnalysis ?? {};
  
  // ✅ FIXED: Proper hashtag analysis data extraction
  const hashtagAnalysis = location.state?.hashtagAnalysis || {
    total_hashtags: 0,
    addictive_hashtags: 0,
    safe_hashtags: 0,
    hashtag_details: [],
    addictive_percentage: 0,
    analysis_method: 'none'
  };
  
  // ✅ FIXED: Proper content category analysis data extraction
  const contentCategoryAnalysis = location.state?.contentCategoryAnalysis || {
    detected_items: [],
    primary_category: null,
    category_hierarchy: 'Unknown',
    addictive_count: 0,
    non_addictive_count: 0,
    total_categories_found: 0,
    folder_structure_mapped: false,
    prediction_based: false
  };
  
  const extractedHashtags = location.state?.extractedHashtags ?? [];
  const error = location.state?.error;

  // Debug: Show what we got
  useEffect(() => {
    console.log('🔍 Extracted Data:', {
      score,
      fileName,
      prediction,
      reasoning,
      confidence,
      features,
      contentCategoryAnalysis,
      categoryHierarchy: contentCategoryAnalysis?.category_hierarchy,
      hashtagAnalysis,
      extractedText,
      extractedHashtags,
      error,
      textAnalysisResult,
      sinhalaText,
      englishText,
      safetyScore,
      ageAppropriateness
    });
  }, [score, fileName, prediction, reasoning, confidence, features, contentCategoryAnalysis, hashtagAnalysis, extractedText, extractedHashtags, error, textAnalysisResult, sinhalaText, englishText, safetyScore, ageAppropriateness]);

  // ========== SCORE ENGINE CALCULATION ==========

  // Get category-based image score from folder mapping
  const getImageScoreFromCategory = () => {
    if (!contentCategoryAnalysis?.category_hierarchy) return 5; // Default for non-addictive
    
    const categoryPath = contentCategoryAnalysis.category_hierarchy.toLowerCase();
    
    // Check for explicit harmful content
    if (categoryPath.includes("explicit_harmful") || 
        categoryPath.includes("explicit")) {
      return 50; // 50/100 for explicit harmful
    }
    
    // Check for psychological triggers
    if (categoryPath.includes("psychological_triggers") || 
        categoryPath.includes("psychological")) {
      return 20; // 20/100 for psychological triggers
    }
    
    // Check for visual addiction
    if (categoryPath.includes("visual_addiction") || 
        categoryPath.includes("visual")) {
      return 25; // 25/100 for visual addiction
    }
    
    // Check for non-addictive content
    if (categoryPath.includes("non-addictive") || 
        prediction === 'non-addictive') {
      return 5; // 5/100 for non-addictive
    }
    
    // Default for addictive content
    if (prediction === 'addictive') {
      return 60; // 60/100 for general addictive
    }
    
    return 5; // Default safe score
  };

  // Calculate hashtag score
  const calculateHashtagScore = () => {
    if (!hashtagAnalysis || hashtagAnalysis.total_hashtags === 0) {
      return 0;
    }
    
    // Formula: (additive_hashtags / total_hashtags) * 100
    const additivePercentage = hashtagAnalysis.addictive_percentage || 
      ((hashtagAnalysis.addictive_hashtags / hashtagAnalysis.total_hashtags) * 100);
    
    return Math.min(additivePercentage, 100);
  };

  // Get text risk score from backend (0-100)
  const getTextRiskScore = () => {
    if (textAnalysisResult?.content_analysis?.risk_score) {
      return textAnalysisResult.content_analysis.risk_score;
    }
    
    // Fallback to safety score conversion
    if (safetyScore > 0) {
      return 100 - safetyScore; // Convert safety score to risk score
    }
    
    return 0;
  };

  // Calculate Age Factor (A_f)
  const calculateAgeFactor = () => {
    // Based on age appropriateness
    switch(ageAppropriateness) {
      case 'safe':
        return 0.9; // Younger audience (10-13)
      case 'caution':
        return 1.0; // Baseline (14-16)
      case 'unsafe':
        return 1.2; // Older audience (17-18)
      default:
        return 1.0; // Default baseline
    }
  };

  // Calculate Gender Adjustment (G_a) - 0 to 15
  const calculateGenderAdjustment = () => {
    // Since gender is not considered, use a fixed moderate value
    return 7.5; // Mid-range value (0-15)
  };

  // Calculate Context Modifier (C_m) based on posting time - 0 to 5
  const calculateContextModifier = () => {
    const now = new Date();
    const hour = now.getHours();
    
    // Higher risk during late night/early morning
    if (hour >= 22 || hour <= 6) {
      return 5; // Late night posting
    } else if (hour >= 18 || hour <= 8) {
      return 2.5; // Evening/morning
    } else {
      return 0; // Normal hours
    }
  };

  // ========== FINAL SCORE CALCULATION ==========

  // Component scores
  const imageScore = getImageScoreFromCategory();
  const textScore = getTextRiskScore();
  const hashtagScore = calculateHashtagScore();

  // Modifiers
  const Af = calculateAgeFactor();
  const Ga = calculateGenderAdjustment();
  const Cm = calculateContextModifier();

  // Main formula: R = (0.40 × S₁ + 0.35 × S₂ + 0.25 × S₃) × A_f + G_a + C_m
  const baseScore = (0.40 * imageScore) + (0.35 * textScore) + (0.25 * hashtagScore);
  const calculatedScore = Math.min(Math.max((baseScore * Af) + Ga + Cm, 0), 100);

  // Use calculated score instead of mock score
  const finalScore = hasError ? score : calculatedScore;
  const riskLevel = getRiskLevel(finalScore);
  const riskColor = getRiskColor(riskLevel);
  const riskBgColor = getRiskBgColor(riskLevel);
  const progressColor = getProgressColor(finalScore);

  // Update RiskIcon based on calculated score
  const RiskIcon = 
    riskLevel === 'low' ? CheckCircle :
    riskLevel === 'medium' ? AlertCircle :
    AlertTriangle;

  // Mock detected features based on score and actual features
  const detectedFeatures = [
    { key: 'hashtags', detected: finalScore > 40 || features.includes('hashtag_analysis') },
    { key: 'captions', detected: finalScore > 30 },
    { key: 'rewards', detected: finalScore > 50 },
    { key: 'autoplay', detected: finalScore > 60 },
    { key: 'visuals', detected: finalScore > 70 },
    { key: 'text_extraction', detected: features.includes('text_extraction') || textAnalysisResult },
    { key: 'image_analysis', detected: features.includes('image_analysis') },
    { key: 'hashtag_analysis', detected: features.includes('hashtag_analysis') },
    { key: 'category_analysis', detected: features.includes('category_analysis') }
  ].filter(f => f.detected);

  // Check for errors
  useEffect(() => {
    // Check if there's an error from backend
    if (error) {
      setHasError(true);
      setErrorMessage(location.state?.message || 'Analysis failed due to low confidence');
    }

    // Check if confidence is too low (under 55%)
    if (confidence < 0.55 && !error) {
      setHasError(true);
      setErrorMessage('The analysis confidence is too low (below 55%). Please try with a different image.');
    }
  }, [error, confidence, location.state?.message]);

  const handleDownloadReport = () => {
    const reportData = {
      analysisReport: {
        score: finalScore,
        riskLevel,
        prediction,
        confidence,
        reasoning,
        fileName,
        timestamp: new Date().toISOString(),
        analyzedAt: new Date().toLocaleString(),
        scoreBreakdown: {
          imageScore,
          textScore,
          hashtagScore,
          ageFactor: Af,
          genderAdjustment: Ga,
          contextModifier: Cm,
          baseScore,
          calculatedScore: finalScore
        }
      },
      textAnalysis: textAnalysisResult || {
        extractedText,
        sinhalaText,
        englishText,
        ocrConfidence,
        safetyScore,
        ageAppropriateness,
        riskCategories,
        safetyRecommendations,
        contentAnalysis
      },
      hashtagAnalysis,
      contentCategoryAnalysis,
      extractedContent: {
        text: extractedText,
        hashtags: extractedHashtags
      },
      recommendations: Object.entries(t.results?.actions || {}).map(([key, action]) => action)
    };

    const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `content-analysis-report-${fileName.replace(/\.[^/.]+$/, "")}-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleShare = async () => {
    const hashtagInfo = hashtagAnalysis?.total_hashtags > 0 ? 
      `Found ${hashtagAnalysis.addictive_hashtags} potentially addictive hashtags. ` : '';
    
    const categoryInfo = contentCategoryAnalysis?.primary_category ? 
      `Content mapped to: ${contentCategoryAnalysis.category_hierarchy}. ` : '';
    
    const safetyInfo = textAnalysisResult ? 
      `Text Safety Score: ${safetyScore}/100 (${ageAppropriateness}). ` : '';
    
    const shareText = `Content Analysis Result: ${finalScore}/100 (${riskLevel} risk). ${safetyInfo}${hashtagInfo}${categoryInfo}${reasoning}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Content Addiction Analysis',
          text: shareText,
          url: window.location.href,
        });
      } catch (error) {
        console.log('Share cancelled:', error);
      }
    } else {
      // Fallback for browsers that don't support Web Share API
      navigator.clipboard.writeText(shareText).then(() => {
        alert('Analysis results copied to clipboard!');
      }).catch(() => {
        alert(`Analysis Results:\n${shareText}`);
      });
    }
  };

  const handleRetry = () => {
    navigate('/upload');
  };

  const handleCopyText = (text: string, type: string) => {
    navigator.clipboard.writeText(text).then(() => {
      alert(`${type} text copied to clipboard!`);
    }).catch(() => {
      alert('Failed to copy text');
    });
  };

  // Function to render text analysis section
  const renderTextAnalysisSection = () => {
    // Check if there's no text at all
    const hasNoText = 
      (!textAnalysisResult && !extractedText) ||
      (extractedText === 'No text could be extracted from the image.') ||
      (textAnalysisResult?.sinhala?.character_count === 0 && 
       textAnalysisResult?.english?.character_count === 0 &&
       (!textAnalysisResult?.original_text || textAnalysisResult.original_text.trim().length === 0));

    if (hasNoText) {
      return (
        <Card className="p-6 border shadow-sm mt-6 relative">
          {/* Blur Overlay */}
          <div className="absolute inset-0 bg-white/80 backdrop-blur-sm rounded-lg z-10 flex items-center justify-center">
            <div className="text-center p-6 max-w-md">
              <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                No Text Detected
              </h3>
              <p className="text-gray-700 mb-4">
                This image doesn't contain any readable text. Text analysis features are not available.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between mb-6 opacity-50">
            <h3 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
              <div className="rounded-full bg-blue-100 p-2">
                <FileText className="h-6 w-6 text-blue-600" />
              </div>
              <span>Text Analysis & Safety Results</span>
            </h3>
            <div className="flex items-center gap-2">
              <div className="px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-800">
                No Text
              </div>
            </div>
          </div>
        </Card>
      );
    }

    if (!textAnalysisResult && !extractedText) {
      return null;
    }

    const textData = textAnalysisResult || {
      original_text: extractedText,
      sinhala: { text: sinhalaText, confidence: 0, word_count: 0, character_count: 0 },
      english: { text: englishText, confidence: 0, word_count: 0, character_count: 0 },
      ocr_confidence: ocrConfidence,
      safety_score: safetyScore,
      age_appropriateness: ageAppropriateness,
      content_analysis: contentAnalysis || {}
    };

    // ✅ FIXED: Ensure content_analysis exists with defaults
    const contentAnalysisData = textData.content_analysis || {
      risk_level: 'unknown',
      explanation: 'No content analysis available.',
      risk_categories: [],
      recommendations: [],
      confidence: 0
    };

    // ✅ FIXED: Use safe access
    const getSafetyColor = () => {
      switch(textData.age_appropriateness) {
        case 'safe': return 'green';
        case 'caution': return 'yellow';
        case 'unsafe': return 'red';
        default: return 'gray';
      }
    };

    const safetyColor = getSafetyColor();

    return (
      <Card className="p-6 border shadow-sm mt-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            <div className="rounded-full bg-blue-100 p-2">
              <FileText className="h-6 w-6 text-blue-600" />
            </div>
            <span>Text Analysis & Safety Results</span>
          </h3>
          <div className="flex items-center gap-2">
            <div className={`px-3 py-1 rounded-full text-sm font-medium ${
              textData.age_appropriateness === 'safe' 
                ? 'bg-green-100 text-green-800' 
                : textData.age_appropriateness === 'caution'
                ? 'bg-yellow-100 text-yellow-800'
                : textData.age_appropriateness === 'unsafe'
                ? 'bg-red-100 text-red-800'
                : 'bg-gray-100 text-gray-800'
            }`}>
              {textData.age_appropriateness === 'safe' 
                ? 'Child Safe ✓' 
                : textData.age_appropriateness === 'caution'
                ? 'Needs Review ⚠️'
                : textData.age_appropriateness === 'unsafe'
                ? 'Not Safe ✗'
                : 'Unknown'}
            </div>
          </div>
        </div>

        {/* Safety Score Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className={`p-4 rounded-lg border-2 ${
            textData.safety_score >= 80 
              ? 'border-green-300 bg-green-50' 
              : textData.safety_score >= 60
              ? 'border-yellow-300 bg-yellow-50'
              : 'border-red-300 bg-red-50'
          }`}>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-600 mb-1">Safety Score</div>
                <div className={`text-3xl font-bold ${
                  textData.safety_score >= 80 ? 'text-green-600' :
                  textData.safety_score >= 60 ? 'text-yellow-600' : 'text-red-600'
                }`}>
                  {textData.safety_score || 0}/100
                </div>
              </div>
              <Shield className={`h-8 w-8 ${
                textData.safety_score >= 80 ? 'text-green-500' :
                textData.safety_score >= 60 ? 'text-yellow-500' : 'text-red-500'
              }`} />
            </div>
            <div className="mt-2">
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div 
                  className={`h-full ${
                    textData.safety_score >= 80 ? 'bg-green-500' :
                    textData.safety_score >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                  }`}
                  style={{ width: `${textData.safety_score || 0}%` }}
                ></div>
              </div>
            </div>
          </div>

          <div className="p-4 rounded-lg border border-blue-200 bg-blue-50">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-600 mb-1">OCR Confidence</div>
                <div className="text-3xl font-bold text-blue-600">
                  {textData.ocr_confidence || 0}%
                </div>
              </div>
              <Search className="h-8 w-8 text-blue-500" />
            </div>
            <div className="mt-2">
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-blue-500"
                  style={{ width: `${textData.ocr_confidence || 0}%` }}
                ></div>
              </div>
            </div>
          </div>

          <div className="p-4 rounded-lg border border-purple-200 bg-purple-50">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-600 mb-1">Text Statistics</div>
                <div className="flex items-center gap-4">
                  <div>
                    <div className="text-lg font-bold text-purple-600">
                      {textData.sinhala?.word_count || 0}
                    </div>
                    <div className="text-xs text-gray-600">Sinhala</div>
                  </div>
                  <div className="h-8 w-px bg-gray-300"></div>
                  <div>
                    <div className="text-lg font-bold text-purple-600">
                      {textData.english?.word_count || 0}
                    </div>
                    <div className="text-xs text-gray-600">English</div>
                  </div>
                </div>
              </div>
              <BarChart3 className="h-8 w-8 text-purple-500" />
            </div>
          </div>
        </div>

        {/* ✅ FIXED: Content Analysis Summary with null checks */}
        {contentAnalysisData && (
          <div className="mb-6 p-4 rounded-lg border bg-gray-50">
            <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <UserCheck className="h-5 w-5 text-blue-600" />
              Content Safety Analysis
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-gray-600 mb-1">Risk Level</div>
                <div className={`px-3 py-1 inline-block rounded-full text-sm font-medium ${
                  contentAnalysisData.risk_level === 'low' 
                    ? 'bg-green-100 text-green-800' 
                    : contentAnalysisData.risk_level === 'medium'
                    ? 'bg-yellow-100 text-yellow-800'
                    : contentAnalysisData.risk_level === 'high'
                    ? 'bg-red-100 text-red-800'
                    : 'bg-gray-100 text-gray-800'
                }`}>
                  {(contentAnalysisData.risk_level || 'unknown').toUpperCase()} RISK
                </div>
                <p className="text-sm text-gray-600 mt-2">
                  {contentAnalysisData.explanation || 'No explanation available.'}
                </p>
              </div>
              <div>
                <div className="text-sm text-gray-600 mb-2">Risk Categories Detected:</div>
                <div className="flex flex-wrap gap-2">
                  {contentAnalysisData.risk_categories?.map((category: string, index: number) => (
                    <span key={index} className="text-xs bg-red-100 text-red-800 px-3 py-1 rounded-full">
                      {category}
                    </span>
                  ))}
                  {(!contentAnalysisData.risk_categories || contentAnalysisData.risk_categories.length === 0) && (
                    <span className="text-xs text-gray-500">No risk categories detected</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Text Content Tabs */}
        <div className="mb-6">
          <div className="flex border-b">
            <button
              className={`flex-1 py-3 text-center font-medium ${
                textTabValue === 0 ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600' : 'text-gray-600'
              }`}
              onClick={() => setTextTabValue(0)}
            >
              <div className="flex items-center justify-center gap-2">
                <span className="font-bold text-lg">සි</span>
                Sinhala Text
                {textData.sinhala?.word_count && textData.sinhala.word_count > 0 && (
                  <span className="bg-blue-100 text-blue-600 text-xs px-2 py-0.5 rounded-full">
                    {textData.sinhala.word_count} words
                  </span>
                )}
              </div>
            </button>
            <button
              className={`flex-1 py-3 text-center font-medium ${
                textTabValue === 1 ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600' : 'text-gray-600'
              }`}
              onClick={() => setTextTabValue(1)}
            >
              <div className="flex items-center justify-center gap-2">
                <span className="font-bold text-lg">EN</span>
                English Text
                {textData.english?.word_count && textData.english.word_count > 0 && (
                  <span className="bg-blue-100 text-blue-600 text-xs px-2 py-0.5 rounded-full">
                    {textData.english.word_count} words
                  </span>
                )}
              </div>
            </button>
            <button
              className={`flex-1 py-3 text-center font-medium ${
                textTabValue === 2 ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600' : 'text-gray-600'
              }`}
              onClick={() => setTextTabValue(2)}
            >
              <div className="flex items-center justify-center gap-2">
                <Type className="h-4 w-4" />
                Original Text
              </div>
            </button>
          </div>
          
          <div className="p-4 border border-t-0 rounded-b-lg">
            {textTabValue === 0 && (
              <div>
                <div className="flex justify-between items-center mb-4">
                  <div className="text-sm text-gray-600">
                    Language: {textData.sinhala?.language || 'Sinhala'} • 
                    Confidence: {textData.sinhala?.confidence || 0}% • 
                    Characters: {textData.sinhala?.character_count || 0}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1"
                      onClick={() => handleCopyText(textData.sinhala?.text || '', 'Sinhala')}
                    >
                      <Copy className="h-3 w-3" />
                      Copy
                    </Button>
                  </div>
                </div>
                <div className="bg-gray-50 p-4 rounded border max-h-60 overflow-y-auto">
                  <p className="text-sm whitespace-pre-wrap leading-relaxed font-sinhala">
                    {textData.sinhala?.text || 'No Sinhala text detected'}
                  </p>
                </div>
              </div>
            )}
            
            {textTabValue === 1 && (
              <div>
                <div className="flex justify-between items-center mb-4">
                  <div className="text-sm text-gray-600">
                    Language: {textData.english?.language || 'English'} • 
                    Confidence: {textData.english?.confidence || 0}% • 
                    Characters: {textData.english?.character_count || 0}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1"
                      onClick={() => handleCopyText(textData.english?.text || '', 'English')}
                    >
                      <Copy className="h-3 w-3" />
                      Copy
                    </Button>
                  </div>
                </div>
                <div className="bg-gray-50 p-4 rounded border max-h-60 overflow-y-auto">
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">
                    {textData.english?.text || 'No English text detected'}
                  </p>
                </div>
              </div>
            )}
            
            {textTabValue === 2 && (
              <div>
                <div className="flex justify-between items-center mb-4">
                  <div className="text-sm text-gray-600">
                    Original OCR Output • Characters: {textData.original_text?.length || 0}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1"
                      onClick={() => handleCopyText(textData.original_text || extractedText, 'Original')}
                    >
                      <Copy className="h-3 w-3" />
                      Copy
                    </Button>
                  </div>
                </div>
                <div className="bg-gray-50 p-4 rounded border max-h-60 overflow-y-auto">
                  <p className="text-sm whitespace-pre-wrap leading-relaxed font-mono">
                    {textData.original_text || extractedText}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Safety Recommendations */}
        {contentAnalysisData?.recommendations && contentAnalysisData.recommendations.length > 0 && (
          <div className="p-4 rounded-lg border border-green-200 bg-green-50">
            <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-green-600" />
              Safety Recommendations
            </h4>
            <ul className="space-y-2">
              {contentAnalysisData.recommendations.map((rec: string, index: number) => (
                <li key={index} className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-gray-700">{rec}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Technical Details */}
        <div className="mt-6 p-4 rounded-lg border bg-gray-50">
          <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <Clock className="h-5 w-5 text-gray-600" />
            Technical Details
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <div className="text-gray-600">Processing Time</div>
              <div className="font-medium">{textData.processing_time || 0}s</div>
            </div>
            <div>
              <div className="text-gray-600">Total Words</div>
              <div className="font-medium">
                {(textData.sinhala?.word_count || 0) + (textData.english?.word_count || 0)}
              </div>
            </div>
            <div>
              <div className="text-gray-600">Total Characters</div>
              <div className="font-medium">
                {(textData.sinhala?.character_count || 0) + (textData.english?.character_count || 0)}
              </div>
            </div>
            <div>
              <div className="text-gray-600">Analysis Confidence</div>
              <div className="font-medium">
                {contentAnalysisData?.confidence ? `${(contentAnalysisData.confidence * 100).toFixed(0)}%` : 'N/A'}
              </div>
            </div>
          </div>
        </div>
      </Card>
    );
  };

  // If there's an error, show error state
  if (hasError) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        
        <main className="container mx-auto px-4 py-8 max-w-4xl">
          <div className="space-y-6 animate-fade-in">
            {/* Error Header */}
            <div className="text-center space-y-2">
              <div className="flex justify-center mb-4">
                <div className="rounded-full bg-red-100 p-4">
                  <AlertTriangle className="h-12 w-12 text-red-600" />
                </div>
              </div>
              <h1 className="text-3xl font-bold text-gray-900 sm:text-4xl">
                Analysis Inconclusive
              </h1>
              <p className="text-gray-600 text-lg">
                File: <span className="font-medium">{fileName}</span>
              </p>
            </div>

            {/* Error Card */}
            <Card className="p-8 bg-red-50 border-red-200 border-2">
              <div className="text-center space-y-4">
                <h2 className="text-2xl font-bold text-red-700">
                  Low Confidence Analysis
                </h2>
                
                <div className="bg-white rounded-lg p-6 border border-red-300 max-w-2xl mx-auto">
                  <p className="text-gray-700 mb-4">
                    {errorMessage || 'The analysis could not provide confident results for this image.'}
                  </p>
                  
                  <div className="flex items-center justify-center gap-4 text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
                    <div className="text-center">
                      <div className="font-semibold">Confidence Level</div>
                      <div className="text-red-600 font-bold text-lg">
                        {(confidence * 100).toFixed(1)}%
                      </div>
                    </div>
                    <div className="h-8 w-px bg-gray-300"></div>
                    <div className="text-center">
                      <div className="font-semibold">Required</div>
                      <div className="text-green-600 font-bold text-lg">55%</div>
                    </div>
                  </div>
                </div>

                <p className="text-gray-600 max-w-2xl mx-auto">
                  This usually happens when the image is unclear, contains complex patterns, 
                  or doesn't have enough recognizable features for accurate analysis.
                </p>
              </div>
            </Card>

            {/* Suggested Solutions */}
            <Card className="p-6 border shadow-sm">
              <h3 className="text-xl font-semibold mb-4 text-gray-900">
                Suggested Solutions
              </h3>
              <ul className="space-y-3">
                <li className="flex items-start gap-3">
                  <div className="mt-1 rounded-full bg-blue-100 p-1">
                    <RefreshCcw className="h-4 w-4 text-blue-600" />
                  </div>
                  <span className="text-sm leading-relaxed text-gray-700">
                    <strong>Try a different image</strong> - Use a clearer or higher quality image
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="mt-1 rounded-full bg-blue-100 p-1">
                    <Eye className="h-4 w-4 text-blue-600" />
                  </div>
                  <span className="text-sm leading-relaxed text-gray-700">
                    <strong>Check image clarity</strong> - Ensure the image is not blurry or too dark
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="mt-1 rounded-full bg-blue-100 p-1">
                    <FileText className="h-4 w-4 text-blue-600" />
                  </div>
                  <span className="text-sm leading-relaxed text-gray-700">
                    <strong>Include relevant content</strong> - Make sure the image contains analyzable content
                  </span>
                </li>
              </ul>
            </Card>

            {/* Action Buttons for Error State */}
            <div className="grid gap-3 sm:grid-cols-2">
              <Button
                size="lg"
                className="gap-2 bg-blue-600 hover:bg-blue-700 text-white"
                onClick={handleRetry}
              >
                <RefreshCcw className="h-5 w-5" />
                Try Another Image
              </Button>

              <Button
                variant="secondary"
                size="lg"
                className="gap-2 bg-gray-600 hover:bg-gray-700 text-white"
                onClick={() => navigate('/')}
              >
                <Home className="h-5 w-5" />
                Back to Home
              </Button>
            </div>

            {/* Additional Help */}
            <div className="text-center">
              <p className="text-sm text-gray-500">
                Need help? Contact support if this issue persists.
              </p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Normal results display (when no error)
  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <main className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="space-y-6 animate-fade-in">
          {/* Header */}
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-bold text-gray-900 sm:text-4xl">
              {t.results?.title || 'Analysis Results'}
            </h1>
            <p className="text-gray-600 text-lg">
              Analysis for: <span className="font-medium">{fileName}</span>
            </p>
          </div>

          {/* Score Card */}
          <Card className={`p-8 ${riskBgColor} border-2 transition-all duration-300 relative`}>
            <div className="flex flex-col items-center space-y-6">
              <div className="relative">
                <div className="flex h-32 w-32 items-center justify-center rounded-full bg-white shadow-lg ring-2 ring-white">
                  <div className="text-center">
                    <div className={`text-4xl font-bold ${riskColor}`}>
                      {finalScore.toFixed(1)}
                    </div>
                    <div className="text-xs text-gray-500">/ 100</div>
                  </div>
                </div>
                <div className={`absolute -right-2 -top-2 rounded-full p-2 ${riskBgColor} border`}>
                  <RiskIcon className={`h-8 w-8 ${riskColor}`} />
                </div>
              </div>

              {/* Score Breakdown */}
              <div className="w-full max-w-lg space-y-4">
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div className="text-center p-2 bg-blue-50 rounded">
                    <div className="font-semibold">Image Score</div>
                    <div className="text-lg font-bold">{imageScore.toFixed(1)}</div>
                  </div>
                  <div className="text-center p-2 bg-green-50 rounded">
                    <div className="font-semibold">Text Score</div>
                    <div className="text-lg font-bold">{textScore.toFixed(1)}</div>
                  </div>
                  <div className="text-center p-2 bg-purple-50 rounded">
                    <div className="font-semibold">Hashtag Score</div>
                    <div className="text-lg font-bold">{hashtagScore.toFixed(1)}</div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm text-gray-600 mb-1">
                    <span className="font-medium">Low Risk (0-30)</span>
                    <span className="font-medium">Medium Risk (31-70)</span>
                    <span className="font-medium">High Risk (71-100)</span>
                  </div>
                  <Progress value={finalScore} className={`h-3 ${progressColor}`} />
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>0</span>
                    <span>50</span>
                    <span>100</span>
                  </div>
                </div>
              </div>

              <div className="text-center">
                <h2 className={`text-2xl font-bold ${riskColor} mb-2`}>
                  {t.results?.[riskLevel] || 
                    (riskLevel === 'low' ? 'Low Risk' : 
                    riskLevel === 'medium' ? 'Medium Risk' : 'High Risk')}
                </h2>
                <p className="text-gray-600 max-w-md">
                  {t.results?.[`${riskLevel}Description`] || 
                    (riskLevel === 'low' ? 'This content appears to have minimal addictive features.' :
                    riskLevel === 'medium' ? 'This content shows some potentially addictive elements.' :
                    'This content displays significant addictive characteristics.')}
                </p>
              </div>

              
            </div>
          </Card>

    
          {/* Confidence Warning for borderline cases */}
          {confidence < 0.7 && confidence >= 0.55 && (
            <Card className="p-4 border-yellow-200 bg-yellow-50">
              <div className="flex items-center gap-3">
                <AlertCircle className="h-5 w-5 text-yellow-600" />
                <div>
                  <p className="text-sm font-medium text-yellow-800">
                    Moderate Confidence Analysis
                  </p>
                  <p className="text-sm text-yellow-700">
                    Analysis confidence is {(confidence * 100).toFixed(1)}%. Results should be interpreted with caution.
                  </p>
                </div>
              </div>
            </Card>
          )}

          {/* AI Analysis Details */}
          <Card className="p-6 border shadow-sm relative">
            {/* Show blur overlay when using mock data or low confidence */}
            {(reasoning.includes("Backend connection failed") || confidence < 0.55 || hasError) && (
              <div className="absolute inset-0 bg-white/80 backdrop-blur-sm rounded-lg z-10 flex items-center justify-center">
                <div className="text-center p-6 max-w-md">
                  <AlertTriangle className="h-12 w-12 text-yellow-600 mx-auto mb-4" />
                  <h3 className="text-xl font-bold text-gray-900 mb-2">
                    Low Confidence Analysis
                  </h3>
                  <p className="text-gray-700 mb-4">
                    Identifying this image is very difficult; therefore, uploading another image may allow for more accurate recognition.
                  </p>
                  <div className="flex gap-2 justify-center">
                    <Button
                      onClick={handleRetry}
                      className="gap-2 bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      <RefreshCcw className="h-4 w-4" />
                      Try Another Image
                    </Button>
                  </div>
                </div>
              </div>
            )}
            
            <h3 className="text-xl font-semibold mb-4 text-gray-900 flex items-center gap-2">
              <Brain className="h-5 w-5 text-blue-600" />
              AI Analysis Details
            </h3>
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex items-start gap-3 p-3 rounded-lg border bg-gray-50/50">
                  <div className="rounded-full bg-blue-100 p-2">
                    <Hash className="h-4 w-4 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">Prediction</p>
                    <p className="text-sm text-gray-600 capitalize">{prediction}</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3 p-3 rounded-lg border bg-gray-50/50">
                  <div className="rounded-full bg-blue-100 p-2">
                    <CheckCircle className="h-4 w-4 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">Confidence</p>
                    <p className="text-sm text-gray-600">{(confidence * 100).toFixed(1)}%</p>
                  </div>
                </div>
              </div>
              
              <div className="flex items-start gap-3 p-3 rounded-lg border bg-gray-50/50">
                <div className="rounded-full bg-blue-100 p-2">
                  <MessageSquare className="h-4 w-4 text-blue-600" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900 mb-1">AI Reasoning</p>
                  <p className="text-sm text-gray-600 leading-relaxed">
                    {reasoning}
                  </p>
                </div>
              </div>
            </div>
          </Card>

          {/* TEXT ANALYSIS SECTION */}
          {renderTextAnalysisSection()}

          {/* Dataset Folder Structure Analysis - BASED ON MODEL PREDICTION */}
          {contentCategoryAnalysis && contentCategoryAnalysis.detected_items && contentCategoryAnalysis.detected_items.length > 0 && (
            <Card className="p-6 border shadow-sm">
              <h3 className="text-xl font-semibold mb-4 text-gray-900 flex items-center gap-2">
                <Folder className="h-5 w-5 text-indigo-600" />
                Model-Based Content Mapping
                {contentCategoryAnalysis.folder_structure_mapped && (
                  <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
                    {contentCategoryAnalysis.prediction_based ? 'Model-Based' : 'Text-Based'}
                  </span>
                )}
              </h3>
              
              {/* Mapping Method Indicator */}
              {contentCategoryAnalysis.prediction_based && (
                <div className="mb-6 p-4 bg-indigo-50 rounded-lg border border-indigo-200">
                  <div className="flex items-center gap-3">
                    <Target className="h-5 w-5 text-indigo-600" />
                    <div>
                      <p className="text-sm font-medium text-indigo-800">
                        Content mapped based on AI Model Prediction
                      </p>
                      <p className="text-sm text-indigo-700 mt-1">
                        The AI model identified this content as <span className="font-bold">{prediction}</span>. 
                        Based on this prediction, it has been mapped to the corresponding dataset folder structure.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Category Statistics */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className={`text-center p-4 rounded-lg border ${
                  contentCategoryAnalysis.addictive_count > 0 ? 
                  'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'
                }`}>
                  <div className={`text-2xl font-bold ${
                    contentCategoryAnalysis.addictive_count > 0 ? 'text-red-600' : 'text-green-600'
                  }`}>
                    {contentCategoryAnalysis.addictive_count}
                  </div>
                  <div className="text-sm text-gray-600">Addictive Categories</div>
                </div>
                <div className={`text-center p-4 rounded-lg border ${
                  contentCategoryAnalysis.non_addictive_count > 0 ? 
                  'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'
                }`}>
                  <div className={`text-2xl font-bold ${
                    contentCategoryAnalysis.non_addictive_count > 0 ? 'text-green-600' : 'text-gray-600'
                  }`}>
                    {contentCategoryAnalysis.non_addictive_count}
                  </div>
                  <div className="text-sm text-gray-600">Non-Addictive Categories</div>
                </div>
              </div>

              {/* Primary Category Hierarchy */}
              {contentCategoryAnalysis.primary_category && (
                <div className="mb-6">
                  <h4 className="font-medium text-gray-900 mb-3">Primary Category Path:</h4>
                  <div className={`p-4 rounded-lg border ${
                    contentCategoryAnalysis.primary_category.main_category === 'Addictive Content' ? 
                    'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'
                  }`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`rounded-full p-2 ${
                          contentCategoryAnalysis.primary_category.main_category === 'Addictive Content' ? 
                          'bg-red-100' : 'bg-green-100'
                        }`}>
                          {contentCategoryAnalysis.primary_category.main_category === 'Addictive Content' ? (
                            <AlertTriangle className="h-5 w-5 text-red-600" />
                          ) : (
                            <CheckCircle className="h-5 w-5 text-green-600" />
                          )}
                        </div>
                        <div>
                          <div className="font-semibold text-gray-900">
                            {contentCategoryAnalysis.category_hierarchy}
                          </div>
                          <div className="text-sm text-gray-600 flex items-center gap-1 mt-1">
                            <span>Mapping Method:</span>
                            <span className="font-medium">
                              {contentCategoryAnalysis.primary_category.detected_keyword === 'model_prediction' 
                                ? 'AI Model Prediction' 
                                : 'Text Analysis'}
                            </span>
                            <span className="text-xs bg-gray-100 px-2 py-0.5 rounded">
                              {(contentCategoryAnalysis.primary_category.confidence * 100).toFixed(0)}% confidence
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                        contentCategoryAnalysis.primary_category.main_category === 'Addictive Content' ? 
                        'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                      }`}>
                        {contentCategoryAnalysis.primary_category.main_category === 'Addictive Content' ? 'HIGH RISK' : 'LOW RISK'}
                      </div>
                    </div>
                    
                    {/* Visual Hierarchy Path */}
                    <div className="mt-4 flex items-center justify-center gap-2">
                      {contentCategoryAnalysis.category_hierarchy.split(' → ').map((level, index, array) => {
                        const IconComponent = contentTypeIcons[level] || contentTypeIcons['default'];
                        return (
                          <div key={index} className="flex items-center">
                            <div className={`px-3 py-2 rounded-lg ${
                              index === 0 ? 'bg-indigo-100 text-indigo-700' :
                              index === 1 ? 'bg-purple-100 text-purple-700' :
                              'bg-pink-100 text-pink-700'
                            }`}>
                              <div className="flex items-center gap-2">
                                {index === 2 && IconComponent && (
                                  <IconComponent className="h-4 w-4" />
                                )}
                                <span className="font-medium">{level}</span>
                              </div>
                            </div>
                            {index < array.length - 1 && (
                              <ChevronRight className="h-5 w-5 text-gray-400 mx-2" />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* All Detected Categories */}
              <div className="space-y-4">
                <h4 className="font-medium text-gray-900">Detected Content Types:</h4>
                <div className="grid gap-3">
                  {contentCategoryAnalysis.detected_items.map((item: any, index: number) => {
                    const Icon = contentTypeIcons[item.content_type] || contentTypeIcons['default'];
                    const isPrimary = index === 0;
                    
                    return (
                      <div
                        key={index}
                        className={`flex items-center justify-between p-4 rounded-lg border ${
                          item.main_category === 'Addictive Content' ? 
                          'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'
                        } ${isPrimary ? 'ring-2 ring-offset-1 ring-opacity-50' : ''} ${
                          isPrimary && item.main_category === 'Addictive Content' ? 'ring-red-300' :
                          isPrimary && item.main_category === 'Non-addictive Content' ? 'ring-green-300' : ''
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`rounded-full p-2 ${
                            item.main_category === 'Addictive Content' ? 
                            'bg-red-100' : 'bg-green-100'
                          }`}>
                            <Icon className={`h-5 w-5 ${
                              item.main_category === 'Addictive Content' ? 
                              'text-red-600' : 'text-green-600'
                            }`} />
                          </div>
                          <div>
                            <div className="font-medium text-gray-900 flex items-center gap-2">
                              {item.content_type}
                              {isPrimary && (
                                <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full">
                                  Primary
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-gray-500 mt-1">
                              {item.detected_keyword === 'model_prediction' 
                                ? 'Based on AI model prediction' 
                                : item.detected_keyword === 'possible_match' 
                                  ? 'Possible content type' 
                                  : `Keyword: ${item.detected_keyword}`}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-medium text-gray-900">
                            {item.main_category}
                          </div>
                          <div className="text-xs text-gray-500">
                            {(item.confidence * 100).toFixed(0)}% confidence
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Folder Structure Info */}
              {contentCategoryAnalysis.folder_structure_mapped && (
                <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="flex items-start gap-3">
                    <Folder className="h-5 w-5 text-blue-600 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-blue-800">
                        {contentCategoryAnalysis.prediction_based
                          ? 'Content mapped to dataset folder structure based on AI Model Prediction'
                          : 'Content successfully mapped to dataset folder structure'}
                      </p>
                      <p className="text-sm text-blue-700 mt-1">
                        The AI model's prediction has been mapped to the training dataset's folder hierarchy.
                        This mapping helps identify the specific type of content and its potential risk level based on model classification.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </Card>
          )}

          {/* Hashtag Analysis Results */}
          {hashtagAnalysis && hashtagAnalysis.total_hashtags > 0 && (
            <Card className="p-6 border shadow-sm">
              <h3 className="text-xl font-semibold mb-4 text-gray-900 flex items-center gap-2">
                <Hash className="h-5 w-5 text-purple-600" />
                Hashtag Analysis
                <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full">
                  {hashtagAnalysis.analysis_method || 'rule-based'}
                </span>
              </h3>
              
              {/* Summary Stats */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="text-center p-4 rounded-lg bg-gray-50 border">
                  <div className="text-2xl font-bold text-gray-900">
                    {hashtagAnalysis.total_hashtags}
                  </div>
                  <div className="text-sm text-gray-600">Total Hashtags</div>
                </div>
                <div className="text-center p-4 rounded-lg bg-red-50 border border-red-200">
                  <div className="text-2xl font-bold text-red-600">
                    {hashtagAnalysis.addictive_hashtags}
                  </div>
                  <div className="text-sm text-gray-600">Potentially Addictive</div>
                </div>
                <div className="text-center p-4 rounded-lg bg-green-50 border border-green-200">
                  <div className="text-2xl font-bold text-green-600">
                    {hashtagAnalysis.safe_hashtags}
                  </div>
                  <div className="text-sm text-gray-600">Safe</div>
                </div>
              </div>

              {/* Individual Hashtag Details */}
              <div className="space-y-3">
                <h4 className="font-medium text-gray-900">Detected Hashtags Analysis:</h4>
                {hashtagAnalysis.hashtag_details.map((detail: any, index: number) => (
                  <div
                    key={index}
                    className={`flex items-center justify-between p-3 rounded-lg border ${
                      detail.is_addictive ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`rounded-full p-2 ${
                        detail.is_addictive ? 'bg-red-100' : 'bg-green-100'
                      }`}>
                        {detail.is_addictive ? (
                          <AlertTriangle className="h-4 w-4 text-red-600" />
                        ) : (
                          <CheckCircle className="h-4 w-4 text-green-600" />
                        )}
                      </div>
                      <div>
                        <span className="font-medium text-gray-900">#{detail.hashtag}</span>
                        <div className="text-xs text-gray-500 mt-1">
                          Method: {detail.method}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`text-sm font-medium ${
                        detail.is_addictive ? 'text-red-600' : 'text-green-600'
                      }`}>
                        {detail.prediction}
                      </div>
                      <div className="text-xs text-gray-500">
                        {(detail.confidence * 100).toFixed(0)}% confidence
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Percentage Summary */}
              {hashtagAnalysis.addictive_percentage > 0 && (
                <div className="mt-4 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-yellow-600" />
                    <span className="text-sm font-medium text-yellow-700">
                      {hashtagAnalysis.addictive_percentage}% of detected hashtags are potentially addictive
                    </span>
                  </div>
                </div>
              )}
            </Card>
          )}

          {/* Show message if no hashtags found */}
          {hashtagAnalysis && hashtagAnalysis.total_hashtags === 0 && (
            <Card className="p-6 border shadow-sm">
              <div className="text-center text-gray-500">
                <Hash className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No hashtags detected in the image</p>
                <p className="text-sm mt-1">The image may not contain text or hashtags</p>
              </div>
            </Card>
          )}

          {/* Detected Features */}
          {detectedFeatures.length > 0 && (
            <Card className="p-6 border shadow-sm">
              <h3 className="text-xl font-semibold mb-4 text-gray-900">
                Analysis Features Used
              </h3>
              <div className="grid gap-3 sm:grid-cols-2">
                {detectedFeatures.map((feature) => {
                  const Icon = featureIcons[feature.key as keyof typeof featureIcons] || Hash;
                  return (
                    <div
                      key={feature.key}
                      className="flex items-center gap-3 rounded-lg border bg-gray-50/50 p-3"
                    >
                      <div className="rounded-full bg-blue-100 p-2">
                        <Icon className="h-5 w-5 text-blue-600" />
                      </div>
                      <span className="text-sm font-medium text-gray-900 capitalize">
                        {feature.key.replace('_', ' ')}
                      </span>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          {/* Category-Specific Recommendations */}
          <Card className="p-6 border shadow-sm">
            <h3 className="text-xl font-semibold mb-4 text-gray-900 flex items-center gap-2">
              <Shield className="h-5 w-5 text-blue-600" />
              Category-Specific Recommendations
            </h3>
            
            <div className="space-y-6">
              {/* Category Detection Logic */}
              {(() => {
                const categoryPath = contentCategoryAnalysis?.category_hierarchy || "";
                
                console.log("🔍 Checking category in Results.tsx:", {
                  categoryPath,
                  prediction,
                  confidence
                });

                // Check for Visual Addiction
                if (categoryPath.includes("Visual_addiction") || 
                    categoryPath.includes("Visual") ||
                    categoryPath.includes("visual")) {
                  return (
                    <div className="space-y-4 p-4 rounded-lg border border-blue-200 bg-blue-50">
                      <div className="flex items-center gap-3">
                        <Eye className="h-5 w-5 text-blue-600" />
                        <h4 className="text-lg font-semibold text-blue-800">
                          Visual Addiction
                        </h4>
                      </div>
                      
                      <div className="grid md:grid-cols-2 gap-4">
                        <div>
                          <h5 className="font-bold text-gray-900 mb-2">What to Do:</h5>
                          <ul className="space-y-2 text-sm text-gray-700">
                            <li className="flex items-start gap-2">
                              <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                              <span>Limit screen time to 1-2 hours daily</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                              <span>Encourage educational games</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                              <span>Schedule outdoor activities</span>
                            </li>
                          </ul>
                        </div>
                        
                        <div>
                          <h5 className="font-bold text-gray-900 mb-2">සිංහල:</h5>
                          <ul className="space-y-2 text-sm text-gray-700">
                            <li className="flex items-start gap-2">
                              <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                              <span>දිනකට 1-2 පැය තිර කාලය සීමා කරන්න</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                              <span>රසික ක්‍රීඩා දිරිමත් කරන්න</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                              <span>බාහිර ක්‍රියාකාරකම් සැලසුම් කරන්න</span>
                            </li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  );
                }
                
                
                if (categoryPath.includes("explicit_harmful") || 
                    categoryPath.includes("Explicit") ||
                    categoryPath.includes("explicit")) {
                  return (
                    <div className="space-y-4 p-4 rounded-lg border border-red-200 bg-red-50">
                      <div className="flex items-center gap-3">
                        <Skull className="h-5 w-5 text-red-600" />
                        <h4 className="text-lg font-semibold text-red-800">
                          Explicit Harmful Content
                        </h4>
                      </div>
                      
                      <div className="grid md:grid-cols-2 gap-4">
                        <div>
                          <h5 className="font-bold text-gray-900 mb-2">What to Do:</h5>
                          <ul className="space-y-2 text-sm text-gray-700">
                            <li className="flex items-start gap-2">
                              <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                              <span>Have serious conversation about dangers</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                              <span>Secure dangerous items in home</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                              <span>Use parental controls</span>
                            </li>
                          </ul>
                        </div>
                        
                        <div>
                          <h5 className="font-bold text-gray-900 mb-2">Sinhala:</h5>
                          <ul className="space-y-2 text-sm text-gray-700">
                            <li className="flex items-start gap-2">
                              <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                              <span>අවදානම් ගැන ගරුත්වයෙන් කතා කරන්න</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                              <span>ගෙදර අනතුරු උපකරණ සුරක්ෂිත කරන්න</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                              <span>Parental controls භාවිතා කරන්න</span>
                            </li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  );
                }
                
                
                if (categoryPath.includes("Psychological_triggers") || 
                    categoryPath.includes("psychological_triggers") ||
                    categoryPath.includes("Psychological")) {
                  return (
                    <div className="space-y-4 p-4 rounded-lg border border-yellow-200 bg-yellow-50">
                      <div className="flex items-center gap-3">
                        <AlertTriangle className="h-5 w-5 text-yellow-600" />
                        <h4 className="text-lg font-semibold text-yellow-800">
                          Psychological Triggers
                        </h4>
                      </div>
                      
                      <div className="grid md:grid-cols-2 gap-4">
                        <div>
                          <h5 className="font-bold text-gray-900 mb-2">What to Do:</h5>
                          <ul className="space-y-2 text-sm text-gray-700">
                            <li className="flex items-start gap-2">
                              <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                              <span>Watch content together and discuss</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                              <span>Teach difference between fiction and reality</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                              <span>Follow age ratings</span>
                            </li>
                          </ul>
                        </div>
                        
                        <div>
                          <h5 className="font-bold text-gray-900 mb-2">Sinhala:</h5>
                          <ul className="space-y-2 text-sm text-gray-700">
                            <li className="flex items-start gap-2">
                              <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                              <span>එකට නැරඹීම සහ සාකච්ඡා කිරීම</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                              <span>කල්පිතය හා යථාර්ථය අතර වෙනස උගන්වන්න</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                              <span>වයස් ශ්‍රේණිගත කිරීම් පිළිපදින්න</span>
                            </li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  );
                }
                
                
                if (prediction === 'non-addictive' || 
                    categoryPath.includes("Non-addictive") ||
                    categoryPath.includes("non-addictive")) {
                  return (
                    <div className="space-y-4 p-4 rounded-lg border border-green-200 bg-green-50">
                      <div className="flex items-center gap-3">
                        <CheckCircle className="h-5 w-5 text-green-600" />
                        <h4 className="text-lg font-semibold text-green-800">
                          Safe / Educational Content
                        </h4>
                      </div>
                      
                      <div className="grid md:grid-cols-2 gap-4">
                        <div>
                          <h5 className="font-bold text-gray-900 mb-2">What to Do:</h5>
                          <ul className="space-y-2 text-sm text-gray-700">
                            <li className="flex items-start gap-2">
                              <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                              <span>Encourage educational content</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                              <span>Maintain balanced screen time</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                              <span>Discuss learning topics</span>
                            </li>
                          </ul>
                        </div>
                        
                        <div>
                          <h5 className="font-bold text-gray-900 mb-2">Sinhala:</h5>
                          <ul className="space-y-2 text-sm text-gray-700">
                            <li className="flex items-start gap-2">
                              <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                              <span>රසික අන්තර්ගත දිරිමත් කරන්න</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                              <span>සමතුලිත තිර කාලය පවත්වාගන්න</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                              <span>ඉගෙන ගන්නා දේ ගැන සාකච්ඡා කරන්න</span>
                            </li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  );
                }
                
                
                if (prediction === 'addictive') {
                  return (
                    <div className="space-y-4 p-4 rounded-lg border border-orange-200 bg-orange-50">
                      <div className="flex items-center gap-3">
                        <AlertTriangle className="h-5 w-5 text-orange-600" />
                        <h4 className="text-lg font-semibold text-orange-800">
                          General Addictive Content
                        </h4>
                      </div>
                      
                      <div className="grid md:grid-cols-2 gap-4">
                        <div>
                          <h5 className="font-bold text-gray-900 mb-2">What to Do:</h5>
                          <ul className="space-y-2 text-sm text-gray-700">
                            <li className="flex items-start gap-2">
                              <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                              <span>Monitor content consumption</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                              <span>Set screen time limits</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                              <span>Encourage offline activities</span>
                            </li>
                          </ul>
                        </div>
                        
                        <div>
                          <h5 className="font-bold text-gray-900 mb-2">Sinhala:</h5>
                          <ul className="space-y-2 text-sm text-gray-700">
                            <li className="flex items-start gap-2">
                              <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                              <span>අන්තර්ගත පරිභෝජනය නිරීක්ෂණය කරන්න</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                              <span>තිර කාලය සීමා කරන්න</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                              <span>නිර්වාහිත ක්‍රියාකාරකම් දිරිමත් කරන්න</span>
                            </li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  );
                }
                
                
                return (
                  <div className="text-center text-gray-500 p-8">
                    <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No specific category detected</p>
                    <p className="text-sm mt-1">Upload completed successfully</p>
                  </div>
                );
              })()}
            </div>
          </Card>

          
          <div className="grid gap-3 sm:grid-cols-2">
            <Button
              variant="outline"
              size="lg"
              className="gap-2 border-gray-300 hover:bg-gray-50"
              onClick={handleDownloadReport}
            >
              <Download className="h-5 w-5" />
              {t.results?.downloadReport || 'Download Full Report'}
            </Button>

            <Button
              variant="outline"
              size="lg"
              className="gap-2 border-gray-300 hover:bg-gray-50"
              onClick={handleShare}
            >
              <Share2 className="h-5 w-5" />
              {t.results?.share || 'Share Results'}
            </Button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Button
              size="lg"
              className="gap-2 bg-blue-600 hover:bg-blue-700 text-white"
              onClick={() => navigate('/upload')}
            >
              <RotateCcw className="h-5 w-5" />
              {t.results?.scanAnother || 'Scan Another Image'}
            </Button>

            <Button
              variant="secondary"
              size="lg"
              className="gap-2 bg-gray-600 hover:bg-gray-700 text-white"
              onClick={() => navigate('/')}
            >
              <Home className="h-5 w-5" />
              {t.results?.backToHome || 'Back to Home'}
            </Button>
          </div>

         
          <p className="text-center text-sm text-gray-500">
            {t.privacy?.notice || 'Your privacy is protected. All analysis is performed securely.'}
          </p>
        </div>
      </main>
    </div>
  );
}