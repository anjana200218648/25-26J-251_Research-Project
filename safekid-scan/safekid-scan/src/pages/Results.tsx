import { useLocation, useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

import toast, { Toaster } from 'react-hot-toast';
import { saveReportToAPI, checkBackendHealth } from '@/components/reportService';
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
import { downloadReport , generatePDFBase64 } from '@/pages/pdfGenerator';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

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
  const [showReportModal, setShowReportModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [dbInitialized, setDbInitialized] = useState(false);

  
  // Debug: Check what data we received
  useEffect(() => {
    console.log('📊 Results page received location.state:', location.state);
    
    // Also check sessionStorage for backup data
    const savedData = sessionStorage.getItem('analysisData');
    if (savedData && !location.state) {
      console.log('📦 Using backup data from sessionStorage');
      const parsedData = JSON.parse(savedData);
      // You might want to set this to state if needed
    }
  }, [location.state]);

  // ✅ Helper function to safely get nested values
  const getNestedValue = (obj: any, path: string, defaultValue: any = null) => {
    try {
      return path.split('.').reduce((current, key) => current?.[key], obj) ?? defaultValue;
    } catch {
      return defaultValue;
    }
  };

  // ===== MAIN DATA FROM BACKEND (Port 5000) =====
  const mainData = location.state || {};
  
  // Basic analysis data
  const score = mainData.score ?? 50;
  const fileName = mainData.fileName || mainData.filename || 'unknown.png';
  const prediction = mainData.prediction || 'non-addictive';
  const reasoning = mainData.reasoning || 'Analysis completed successfully.';
  const confidence = mainData.confidence || 0.7;
  const features = mainData.features || ['image_analysis'];
  
  // ===== TEXT ANALYSIS DATA (Port 8000) =====
  // Try multiple possible paths for text analysis data
  const textData = mainData.textAnalysisResult || 
                   mainData.text_analysis || 
                   mainData.textResult || 
                   {};
  
  const extractedText = textData.extractedText || 
                       textData.text || 
                       textData.original_text || 
                       mainData.extractedText || 
                       'No text could be extracted from the image.';
  
  const sinhalaText = textData.sinhalaText || 
                     textData.sinhala?.text || 
                     textData.sinhala || 
                     mainData.sinhalaText || 
                     '';
  
  const englishText = textData.englishText || 
                     textData.english?.text || 
                     textData.english || 
                     mainData.englishText || 
                     '';
  
  const ocrConfidence = textData.ocrConfidence || 
                       textData.ocr_confidence || 
                       textData.confidence || 
                       mainData.ocrConfidence || 
                       0;
  
  const safetyScore = textData.safetyScore || 
                     textData.safety_score || 
                     textData.safety || 
                     mainData.safetyScore || 
                     0;
  
  const ageAppropriateness = textData.ageAppropriateness || 
                            textData.age_appropriateness || 
                            textData.age || 
                            mainData.ageAppropriateness || 
                            'unknown';
  
  const riskCategories = textData.riskCategories || 
                        textData.risk_categories || 
                        textData.categories || 
                        mainData.riskCategories || 
                        [];
  
  const safetyRecommendations = textData.safetyRecommendations || 
                               textData.recommendations || 
                               textData.safety_recommendations || 
                               mainData.safetyRecommendations || 
                               [];
  
  const contentAnalysis = textData.contentAnalysis || 
                         textData.content_analysis || 
                         textData.analysis || 
                         mainData.contentAnalysis || 
                         {};
  
  // ===== CONTENT CATEGORY ANALYSIS =====
  const categoryData = mainData.contentCategoryAnalysis || 
                      mainData.category_analysis || 
                      mainData.categoryData || 
                      {};
  
  const contentCategoryAnalysis = {
    detected_items: categoryData.detected_items || categoryData.items || [],
    primary_category: categoryData.primary_category || categoryData.primary || null,
    category_hierarchy: categoryData.category_hierarchy || categoryData.hierarchy || 'Unknown',
    addictive_count: categoryData.addictive_count || categoryData.addictive || 0,
    non_addictive_count: categoryData.non_addictive_count || categoryData.safe || 0,
    total_categories_found: categoryData.total_categories_found || categoryData.total || 0,
    folder_structure_mapped: categoryData.folder_structure_mapped || categoryData.mapped || false,
    prediction_based: categoryData.prediction_based || categoryData.predictionBased || false
  };
  
  // ===== HASHTAG ANALYSIS =====
  const hashtagData = mainData.hashtagAnalysis || 
                     mainData.hashtag_analysis || 
                     mainData.hashtags || 
                     {};
  
  const hashtagAnalysis = {
    total_hashtags: hashtagData.total_hashtags || hashtagData.total || 0,
    addictive_hashtags: hashtagData.addictive_hashtags || hashtagData.addictive || 0,
    safe_hashtags: hashtagData.safe_hashtags || hashtagData.safe || 0,
    hashtag_details: hashtagData.hashtag_details || hashtagData.details || [],
    addictive_percentage: hashtagData.addictive_percentage || hashtagData.percentage || 0,
    analysis_method: hashtagData.analysis_method || hashtagData.method || 'none'
  };
  
  const extractedHashtags = mainData.extractedHashtags || 
                           mainData.hashtags || 
                           hashtagData.hashtags || 
                           [];

  // Debug: Show parsed data
  useEffect(() => {
    console.log('🔍 Parsed Data:', {
      // Main
      score, fileName, prediction, reasoning, confidence, features,
      // Text
      extractedText, sinhalaText, englishText, ocrConfidence, safetyScore, ageAppropriateness,
      // Categories
      contentCategoryAnalysis,
      // Hashtags
      hashtagAnalysis,
      extractedHashtags
    });
  }, [score, fileName, prediction, reasoning, confidence, features, 
      extractedText, sinhalaText, englishText, ocrConfidence, safetyScore, ageAppropriateness,
      contentCategoryAnalysis, hashtagAnalysis, extractedHashtags]);

  // ========== SCORE ENGINE CALCULATION ==========

  // Get category-based image score from folder mapping
  const getImageScoreFromCategory = () => {
    if (!contentCategoryAnalysis?.category_hierarchy) return 5; // Default for non-addictive
    
    const categoryPath = contentCategoryAnalysis.category_hierarchy.toLowerCase();
    
    // Check for explicit harmful content
    if (categoryPath.includes("explicit_harmful") || 
        categoryPath.includes("explicit") ||
        categoryPath.includes("harmful")) {
      return 50;
    }
    
    // Check for psychological triggers
    if (categoryPath.includes("psychological_triggers") || 
        categoryPath.includes("psychological")) {
      return 20;
    }
    
    // Check for visual addiction
    if (categoryPath.includes("visual_addiction") || 
        categoryPath.includes("visual")) {
      return 25;
    }
    
    // Check for non-addictive content
    if (categoryPath.includes("non-addictive") || 
        prediction === 'non-addictive') {
      return 5;
    }
    
    // Default for addictive content
    if (prediction === 'addictive') {
      return 60;
    }
    
    return 5;
  };

  // Calculate hashtag score
  const calculateHashtagScore = () => {
    if (!hashtagAnalysis || hashtagAnalysis.total_hashtags === 0) {
      return 0;
    }
    
    const additivePercentage = hashtagAnalysis.addictive_percentage || 
      ((hashtagAnalysis.addictive_hashtags / hashtagAnalysis.total_hashtags) * 100);
    
    return Math.min(additivePercentage, 100);
  };

  // Get text risk score
  const getTextRiskScore = () => {
    if (contentAnalysis?.risk_score) {
      return contentAnalysis.risk_score;
    }
    if (safetyScore > 0) {
      return 100 - safetyScore;
    }
    return 0;
  };

  // Calculate Age Factor
  const calculateAgeFactor = () => {
    switch(ageAppropriateness?.toLowerCase()) {
      case 'safe':
      case 'child_safe':
        return 0.9;
      case 'caution':
      case 'moderate':
        return 1.0;
      case 'unsafe':
      case 'risky':
        return 1.2;
      default:
        return 1.0;
    }
  };

  // Calculate Gender Adjustment
  const calculateGenderAdjustment = () => {
    return 7.5;
  };

  // Calculate Context Modifier
  const calculateContextModifier = () => {
    const now = new Date();
    const hour = now.getHours();
    
    if (hour >= 22 || hour <= 6) {
      return 5;
    } else if (hour >= 18 || hour <= 8) {
      return 2.5;
    } else {
      return 0;
    }
  };

  // ========== FINAL SCORE CALCULATION ==========

  const imageScore = getImageScoreFromCategory();
  const textScore = getTextRiskScore();
  const hashtagScore = calculateHashtagScore();

  const Af = calculateAgeFactor();
  const Ga = calculateGenderAdjustment();
  const Cm = calculateContextModifier();

  const baseScore = (0.40 * imageScore) + (0.35 * textScore) + (0.25 * hashtagScore);
  const calculatedScore = Math.min(Math.max((baseScore * Af) + Ga + Cm, 0), 100);

  const finalScore = hasError ? score : calculatedScore;
  const riskLevel = getRiskLevel(finalScore);
  const riskColor = getRiskColor(riskLevel);
  const riskBgColor = getRiskBgColor(riskLevel);
  const progressColor = getProgressColor(finalScore);

  const RiskIcon = 
    riskLevel === 'low' ? CheckCircle :
    riskLevel === 'medium' ? AlertCircle :
    AlertTriangle;

  // Detected features
  const detectedFeatures = [
    { key: 'hashtags', detected: finalScore > 40 || features.includes('hashtag_analysis') || hashtagAnalysis.total_hashtags > 0 },
    { key: 'captions', detected: finalScore > 30 },
    { key: 'rewards', detected: finalScore > 50 },
    { key: 'autoplay', detected: finalScore > 60 },
    { key: 'visuals', detected: finalScore > 70 },
    { key: 'text_extraction', detected: features.includes('text_extraction') || extractedText.length > 0 },
    { key: 'image_analysis', detected: features.includes('image_analysis') },
    { key: 'hashtag_analysis', detected: features.includes('hashtag_analysis') || hashtagAnalysis.total_hashtags > 0 },
    { key: 'category_analysis', detected: features.includes('category_analysis') || contentCategoryAnalysis.total_categories_found > 0 }
  ].filter(f => f.detected);

  // Check for errors
  useEffect(() => {
    const error = mainData.error;
    if (error) {
      setHasError(true);
      setErrorMessage(mainData.message || 'Analysis failed');
    } else if (confidence < 0.55 && !error) {
      setHasError(true);
      setErrorMessage('The analysis confidence is too low (below 55%). Please try with a different image.');
    }
  }, [mainData.error, mainData.message, confidence]);

  const handleDownloadReport = async (language: 'english' | 'sinhala' | 'both') => {
    try {
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
        textAnalysis: {
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
        recommendations: [
          ...(safetyRecommendations || []),
          ...(contentAnalysis?.recommendations || [])
        ]
      };

      await downloadReport(reportData, language);
      setShowReportModal(false);
      
    } catch (error) {
      console.error('Error generating report:', error);
      alert('Failed to generate PDF report. Please try again.');
    }
  };

  const handleShare = async () => {
    const hashtagInfo = hashtagAnalysis?.total_hashtags > 0 ? 
      `Found ${hashtagAnalysis.addictive_hashtags} potentially addictive hashtags. ` : '';
    
    const categoryInfo = contentCategoryAnalysis?.primary_category ? 
      `Content mapped to: ${contentCategoryAnalysis.category_hierarchy}. ` : '';
    
    const safetyInfo = textData ? 
      `Text Safety Score: ${safetyScore}/100 (${ageAppropriateness}). ` : '';
    
    const shareText = `Content Analysis Result: ${finalScore.toFixed(1)}/100 (${riskLevel} risk). ${safetyInfo}${hashtagInfo}${categoryInfo}${reasoning}`;

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
    const hasNoText = !extractedText || 
                     extractedText === 'No text could be extracted from the image.' ||
                     (extractedText.trim().length === 0 && 
                      sinhalaText.trim().length === 0 && 
                      englishText.trim().length === 0);

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

    // Prepare text data for display
    const displayTextData = {
      original_text: extractedText,
      sinhala: {
        text: sinhalaText,
        confidence: ocrConfidence,
        word_count: sinhalaText.split(/\s+/).filter(w => w.length > 0).length,
        character_count: sinhalaText.length
      },
      english: {
        text: englishText,
        confidence: ocrConfidence,
        word_count: englishText.split(/\s+/).filter(w => w.length > 0).length,
        character_count: englishText.length
      },
      ocr_confidence: ocrConfidence,
      safety_score: safetyScore,
      age_appropriateness: ageAppropriateness,
      content_analysis: contentAnalysis
    };

    // Get safety color
    const getSafetyColor = () => {
      switch(ageAppropriateness?.toLowerCase()) {
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
              ageAppropriateness === 'safe' 
                ? 'bg-green-100 text-green-800' 
                : ageAppropriateness === 'caution'
                ? 'bg-yellow-100 text-yellow-800'
                : ageAppropriateness === 'unsafe'
                ? 'bg-red-100 text-red-800'
                : 'bg-gray-100 text-gray-800'
            }`}>
              {ageAppropriateness === 'safe' 
                ? 'Child Safe ✓' 
                : ageAppropriateness === 'caution'
                ? 'Needs Review ⚠️'
                : ageAppropriateness === 'unsafe'
                ? 'Not Safe ✗'
                : 'Unknown'}
            </div>
          </div>
        </div>

        {/* Safety Score Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className={`p-4 rounded-lg border-2 ${
            safetyScore >= 80 
              ? 'border-green-300 bg-green-50' 
              : safetyScore >= 60
              ? 'border-yellow-300 bg-yellow-50'
              : 'border-red-300 bg-red-50'
          }`}>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-600 mb-1">Safety Score</div>
                <div className={`text-3xl font-bold ${
                  safetyScore >= 80 ? 'text-green-600' :
                  safetyScore >= 60 ? 'text-yellow-600' : 'text-red-600'
                }`}>
                  {safetyScore || 0}/100
                </div>
              </div>
              <Shield className={`h-8 w-8 ${
                safetyScore >= 80 ? 'text-green-500' :
                safetyScore >= 60 ? 'text-yellow-500' : 'text-red-500'
              }`} />
            </div>
            <div className="mt-2">
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div 
                  className={`h-full ${
                    safetyScore >= 80 ? 'bg-green-500' :
                    safetyScore >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                  }`}
                  style={{ width: `${safetyScore || 0}%` }}
                ></div>
              </div>
            </div>
          </div>

          <div className="p-4 rounded-lg border border-blue-200 bg-blue-50">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-600 mb-1">OCR Confidence</div>
                <div className="text-3xl font-bold text-blue-600">
                  {ocrConfidence || 0}%
                </div>
              </div>
              <Search className="h-8 w-8 text-blue-500" />
            </div>
            <div className="mt-2">
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-blue-500"
                  style={{ width: `${ocrConfidence || 0}%` }}
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
                      {displayTextData.sinhala.word_count || 0}
                    </div>
                    <div className="text-xs text-gray-600">Sinhala</div>
                  </div>
                  <div className="h-8 w-px bg-gray-300"></div>
                  <div>
                    <div className="text-lg font-bold text-purple-600">
                      {displayTextData.english.word_count || 0}
                    </div>
                    <div className="text-xs text-gray-600">English</div>
                  </div>
                </div>
              </div>
              <BarChart3 className="h-8 w-8 text-purple-500" />
            </div>
          </div>
        </div>

        {/* Content Analysis Summary */}
        {contentAnalysis && Object.keys(contentAnalysis).length > 0 && (
          <div className="mb-6 p-4 rounded-lg border bg-gray-50">
            <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <UserCheck className="h-5 w-5 text-blue-600" />
              Content Safety Analysis
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-gray-600 mb-1">Risk Level</div>
                <div className={`px-3 py-1 inline-block rounded-full text-sm font-medium ${
                  contentAnalysis.risk_level === 'low' 
                    ? 'bg-green-100 text-green-800' 
                    : contentAnalysis.risk_level === 'medium'
                    ? 'bg-yellow-100 text-yellow-800'
                    : contentAnalysis.risk_level === 'high'
                    ? 'bg-red-100 text-red-800'
                    : 'bg-gray-100 text-gray-800'
                }`}>
                  {(contentAnalysis.risk_level || 'unknown').toUpperCase()} RISK
                </div>
                <p className="text-sm text-gray-600 mt-2">
                  {contentAnalysis.explanation || 'No explanation available.'}
                </p>
              </div>
              <div>
                <div className="text-sm text-gray-600 mb-2">Risk Categories Detected:</div>
                <div className="flex flex-wrap gap-2">
                  {(riskCategories.length > 0 ? riskCategories : contentAnalysis.risk_categories || []).map((category: string, index: number) => (
                    <span key={index} className="text-xs bg-red-100 text-red-800 px-3 py-1 rounded-full">
                      {category}
                    </span>
                  ))}
                  {(!riskCategories || riskCategories.length === 0) && 
                   (!contentAnalysis.risk_categories || contentAnalysis.risk_categories.length === 0) && (
                    <span className="text-xs text-gray-500">No risk categories detected</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Text Content Tabs */}
        {(sinhalaText || englishText || extractedText) && (
          <div className="mb-6">
            <div className="flex border-b">
              {sinhalaText && (
                <button
                  className={`flex-1 py-3 text-center font-medium ${
                    textTabValue === 0 ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600' : 'text-gray-600'
                  }`}
                  onClick={() => setTextTabValue(0)}
                >
                  <div className="flex items-center justify-center gap-2">
                    <span className="font-bold text-lg">සි</span>
                    Sinhala Text
                    {displayTextData.sinhala.word_count > 0 && (
                      <span className="bg-blue-100 text-blue-600 text-xs px-2 py-0.5 rounded-full">
                        {displayTextData.sinhala.word_count} words
                      </span>
                    )}
                  </div>
                </button>
              )}
              
              {englishText && (
                <button
                  className={`flex-1 py-3 text-center font-medium ${
                    textTabValue === 1 ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600' : 'text-gray-600'
                  }`}
                  onClick={() => setTextTabValue(1)}
                >
                  <div className="flex items-center justify-center gap-2">
                    <span className="font-bold text-lg">EN</span>
                    English Text
                    {displayTextData.english.word_count > 0 && (
                      <span className="bg-blue-100 text-blue-600 text-xs px-2 py-0.5 rounded-full">
                        {displayTextData.english.word_count} words
                      </span>
                    )}
                  </div>
                </button>
              )}
              
              {extractedText && (
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
              )}
            </div>
            
            <div className="p-4 border border-t-0 rounded-b-lg">
              {textTabValue === 0 && sinhalaText && (
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <div className="text-sm text-gray-600">
                      Language: Sinhala • 
                      Confidence: {ocrConfidence}% • 
                      Characters: {displayTextData.sinhala.character_count}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1"
                        onClick={() => handleCopyText(sinhalaText, 'Sinhala')}
                      >
                        <Copy className="h-3 w-3" />
                        Copy
                      </Button>
                    </div>
                  </div>
                  <div className="bg-gray-50 p-4 rounded border max-h-60 overflow-y-auto">
                    <p className="text-sm whitespace-pre-wrap leading-relaxed font-sinhala">
                      {sinhalaText}
                    </p>
                  </div>
                </div>
              )}
              
              {textTabValue === 1 && englishText && (
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <div className="text-sm text-gray-600">
                      Language: English • 
                      Confidence: {ocrConfidence}% • 
                      Characters: {displayTextData.english.character_count}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1"
                        onClick={() => handleCopyText(englishText, 'English')}
                      >
                        <Copy className="h-3 w-3" />
                        Copy
                      </Button>
                    </div>
                  </div>
                  <div className="bg-gray-50 p-4 rounded border max-h-60 overflow-y-auto">
                    <p className="text-sm whitespace-pre-wrap leading-relaxed">
                      {englishText}
                    </p>
                  </div>
                </div>
              )}
              
              {textTabValue === 2 && extractedText && (
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <div className="text-sm text-gray-600">
                      Original OCR Output • Characters: {extractedText.length}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1"
                        onClick={() => handleCopyText(extractedText, 'Original')}
                      >
                        <Copy className="h-3 w-3" />
                        Copy
                      </Button>
                    </div>
                  </div>
                  <div className="bg-gray-50 p-4 rounded border max-h-60 overflow-y-auto">
                    <p className="text-sm whitespace-pre-wrap leading-relaxed font-mono">
                      {extractedText}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Safety Recommendations */}
        {safetyRecommendations && safetyRecommendations.length > 0 && (
          <div className="p-4 rounded-lg border border-green-200 bg-green-50">
            <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-green-600" />
              Safety Recommendations
            </h4>
            <ul className="space-y-2">
              {safetyRecommendations.map((rec: string, index: number) => (
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
                {displayTextData.sinhala.word_count + displayTextData.english.word_count}
              </div>
            </div>
            <div>
              <div className="text-gray-600">Total Characters</div>
              <div className="font-medium">
                {displayTextData.sinhala.character_count + displayTextData.english.character_count}
              </div>
            </div>
            <div>
              <div className="text-gray-600">Analysis Confidence</div>
              <div className="font-medium">
                {contentAnalysis?.confidence ? `${(contentAnalysis.confidence * 100).toFixed(0)}%` : 'N/A'}
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

  // Normal results display
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
            <div className="flex justify-center gap-4 text-sm">
              <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full">
                Main Analysis: Port 5000
              </span>
              <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full">
                Text Analysis: Port 8000
              </span>
            </div>
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
            {(reasoning.includes("Backend connection failed") || reasoning.includes("mock data") || confidence < 0.55 || hasError) && (
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

          {/* Dataset Folder Structure Analysis */}
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
                    <div className="mt-4 flex items-center justify-center gap-2 flex-wrap">
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
                                {IconComponent && (
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
              {hashtagAnalysis.hashtag_details && hashtagAnalysis.hashtag_details.length > 0 && (
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
              )}

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
                const categoryPath = contentCategoryAnalysis?.category_hierarchy?.toLowerCase() || "";
                const primaryCategory = contentCategoryAnalysis?.primary_category?.content_type?.toLowerCase() || "";
                
                // Check for Visual Addiction
                if (categoryPath.includes("visual") || primaryCategory.includes("visual")) {
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
                              <span>අධ්‍යාපනික ක්‍රීඩා දිරිමත් කරන්න</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                              <span>එළිමහන් ක්‍රියාකාරකම් සැලසුම් කරන්න</span>
                            </li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  );
                }
                
                // Check for Explicit Harmful
                if (categoryPath.includes("explicit") || categoryPath.includes("harmful") || 
                    primaryCategory.includes("explicit") || primaryCategory.includes("harmful")) {
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
                          <h5 className="font-bold text-gray-900 mb-2">සිංහල:</h5>
                          <ul className="space-y-2 text-sm text-gray-700">
                            <li className="flex items-start gap-2">
                              <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                              <span>අවදානම් ගැන බැරෑරුම් ලෙස කතා කරන්න</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                              <span>නිවසේ ඇති අනතුරුදායක අයිතම ආරක්ෂිත කරන්න</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                              <span>දෙමාපිය පාලන ක්‍රම භාවිතා කරන්න</span>
                            </li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  );
                }
                
                // Check for Psychological Triggers
                if (categoryPath.includes("psychological") || primaryCategory.includes("psychological")) {
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
                          <h5 className="font-bold text-gray-900 mb-2">සිංහල:</h5>
                          <ul className="space-y-2 text-sm text-gray-700">
                            <li className="flex items-start gap-2">
                              <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                              <span>එකට නරඹා සාකච්ඡා කරන්න</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                              <span>මනඃකල්පිත හා යථාර්ථය අතර වෙනස උගන්වන්න</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                              <span>වයස් සීමා නිර්දේශ අනුගමනය කරන්න</span>
                            </li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  );
                }
                
                // Non-addictive content
                if (prediction === 'non-addictive' || 
                    categoryPath.includes("non-addictive") ||
                    primaryCategory.includes("educational") ||
                    primaryCategory.includes("informational")) {
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
                          <h5 className="font-bold text-gray-900 mb-2">සිංහල:</h5>
                          <ul className="space-y-2 text-sm text-gray-700">
                            <li className="flex items-start gap-2">
                              <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                              <span>අධ්‍යාපනික අන්තර්ගත දිරිමත් කරන්න</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                              <span>සමබර තිර කාලයක් පවත්වා ගන්න</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                              <span>ඉගෙනුම් විෂයයන් ගැන සාකච්ඡා කරන්න</span>
                            </li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  );
                }
                
                // Fallback for addictive content
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
                          <h5 className="font-bold text-gray-900 mb-2">සිංහල:</h5>
                          <ul className="space-y-2 text-sm text-gray-700">
                            <li className="flex items-start gap-2">
                              <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                              <span>අන්තර්ගත පරිභෝජනය නිරීක්ෂණය කරන්න</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                              <span>තිර කාල සීමා නියම කරන්න</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                              <span>අන්තර්ජාලයෙන් පිටත ක්‍රියාකාරකම් දිරිමත් කරන්න</span>
                            </li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  );
                }
                
                // Default fallback
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

          {/* Action Buttons */}
          <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-7 flex justify-center">
              <Button
  variant="default"
  size="lg"
  className={`gap-2 font-semibold shadow-lg hover:shadow-xl transition-all duration-200 ${
    prediction === 'addictive' 
      ? 'bg-red-600 hover:bg-red-700 animate-pulse' 
      : 'bg-green-600 hover:bg-green-700'
  }`}
  onClick={async () => {
    // Prevent double clicks
    if (isSaving) return;
    
    setIsSaving(true);
    const loadingToast = toast.loading('Generating and saving report...');
    
    try {
      // Prepare report data
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
        textAnalysis: {
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
        recommendations: [
          ...(safetyRecommendations || []),
          ...(contentAnalysis?.recommendations || [])
        ]
      };

      console.log('📄 Generating PDF...');
      
      // Generate PDF and get base64
      const pdfBase64 = await generatePDFBase64(reportData, 'both');
      
      // Add PDF to report data
      const fullReportData = {
        ...reportData,
        pdfBase64,
        language: 'both'
      };
      
      console.log('💾 Saving to database...');
      
      // Save to backend API
      const result = await saveReportToAPI(fullReportData);
      
      // Dismiss loading toast
      toast.dismiss(loadingToast);
      
      if (result.success) {
        // Success notification
        toast.success(
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <span style={{ fontSize: '20px' }}>✅</span>
              <strong style={{ fontSize: '16px' }}>Report Saved Successfully!</strong>
            </div>
            <p style={{ margin: '4px 0', fontSize: '14px' }}>
              ID: <span style={{ fontWeight: 500, color: '#2563eb' }}>{result.id}</span>
            </p>
            <p style={{ margin: '2px 0', fontSize: '12px', color: '#6b7280' }}>
              Filename: {result.filename}
            </p>
          </div>,
          { 
            duration: 5000,
            position: 'top-right',
            style: {
              background: '#10b981',
              color: 'white',
              padding: '12px',
              borderRadius: '8px'
            }
          }
        );
        
        // Navigate to complaint form after short delay
        setTimeout(() => {
          navigate('/complaint-form', {
            state: {
              reportId: result.id,
              reportFilename: result.filename,
              analysisData: reportData.analysisReport,
              fromResults: true,
              timestamp: new Date().toISOString()
            }
          });
        }, 1500);
        
      } else {
        // Error notification
        toast.error(
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <span style={{ fontSize: '20px' }}>❌</span>
              <strong style={{ fontSize: '16px' }}>Failed to Save Report</strong>
            </div>
            <p style={{ margin: '4px 0', fontSize: '13px' }}>
              {result.error || 'Unknown error occurred'}
            </p>
            <p style={{ margin: '2px 0', fontSize: '11px', opacity: 0.8 }}>
              Please check if backend servers are running
            </p>
          </div>,
          {
            duration: 5000,
            position: 'top-right',
            style: {
              background: '#ef4444',
              color: 'white',
              padding: '12px',
              borderRadius: '8px'
            }
          }
        );
      }
      
    } catch (error) {
      // Dismiss loading toast
      toast.dismiss(loadingToast);
      
      console.error('❌ Error:', error);
      
      // Error notification
      toast.error(
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span style={{ fontSize: '20px' }}>❌</span>
            <strong style={{ fontSize: '16px' }}>Something Went Wrong</strong>
          </div>
          <p style={{ margin: '4px 0', fontSize: '13px' }}>
            {error instanceof Error ? error.message : 'Unknown error'}
          </p>
          <p style={{ margin: '2px 0', fontSize: '11px', opacity: 0.8 }}>
            Please try again
          </p>
        </div>,
        {
          duration: 5000,
          position: 'top-right',
          style: {
            background: '#ef4444',
            color: 'white',
            padding: '12px',
            borderRadius: '8px'
          }
        }
      );
      
    } finally {
      setIsSaving(false);
    }
  }}
  disabled={isSaving}
>
  <Shield className="h-7 w-7" />
  {isSaving ? 'Saving Report...' : 'Protect Your Child'}
</Button>
            </div>
            <Button
              variant="outline"
              size="lg"
              className="gap-2 border-gray-300 hover:bg-gray-50"
              onClick={() => setShowReportModal(true)}
            >
              <Download className="h-5 w-5" />
              {t.results?.downloadReport || 'Download Report (PDF)'}
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

          {/* Privacy Notice */}
          <p className="text-center text-sm text-gray-500">
            {t.privacy?.notice || 'Your privacy is protected. All analysis is performed securely.'}
          </p>
        </div>
      </main>

      {/* Report Language Selection Modal */}
      <Dialog open={showReportModal} onOpenChange={setShowReportModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <Languages className="h-5 w-5 text-blue-600" />
              Download Report
            </DialogTitle>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <Button
              onClick={() => handleDownloadReport('both')}
              className="gap-2 bg-blue-600 hover:bg-blue-700 text-white py-6"
            >
              <Download className="h-5 w-5" />
              Bilingual Report (English & සිංහල)
            </Button>
            
            <div className="grid grid-cols-2 gap-3">
              <Button
                variant="outline"
                onClick={() => handleDownloadReport('english')}
                className="gap-2 py-6"
              >
                <span className="font-bold">EN</span>
                English Only
              </Button>
              
              <Button
                variant="outline"
                onClick={() => handleDownloadReport('sinhala')}
                className="gap-2 py-6"
              >
                <span className="font-bold text-lg">සි</span>
                සිංහල පමණි
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}