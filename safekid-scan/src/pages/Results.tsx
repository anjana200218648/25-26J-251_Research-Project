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
  Play,
  Eye,
  Brain,
  FileText,
  RefreshCw
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
  hashtag_analysis: Hash
};

export default function Results() {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  
  // Safe data extraction with comprehensive fallbacks
  const score = location.state?.score ?? 50;
  const fileName = location.state?.fileName ?? 'unknown.png';
  const prediction = location.state?.prediction ?? 'non-addictive';
  const reasoning = location.state?.reasoning ?? 'Analysis completed successfully. Consider reviewing the content for any concerning elements.';
  const confidence = location.state?.confidence ?? 0.7;
  const features = location.state?.features ?? ['image_analysis'];
  const error = location.state?.error; 
  
  // Hashtag analysis data with fallbacks
  const hashtagAnalysis = location.state?.hashtagAnalysis ?? {
    total_hashtags: 0,
    addictive_hashtags: 0,
    safe_hashtags: 0,
    hashtag_details: [],
    addictive_percentage: 0,
    analysis_method: 'none'
  };
  
  const extractedText = location.state?.extractedText ?? 'No text could be extracted from the image.';
  const extractedHashtags = location.state?.extractedHashtags ?? [];

  const riskLevel = getRiskLevel(score);
  const riskColor = getRiskColor(riskLevel);
  const riskBgColor = getRiskBgColor(riskLevel);
  const progressColor = getProgressColor(score);

  // Mock detected features based on score and actual features
  const detectedFeatures = [
    { key: 'hashtags', detected: score > 40 || features.includes('hashtag_analysis') },
    { key: 'captions', detected: score > 30 },
    { key: 'rewards', detected: score > 50 },
    { key: 'autoplay', detected: score > 60 },
    { key: 'visuals', detected: score > 70 },
    { key: 'text_extraction', detected: features.includes('text_extraction') },
    { key: 'image_analysis', detected: features.includes('image_analysis') },
    { key: 'hashtag_analysis', detected: features.includes('hashtag_analysis') }
  ].filter(f => f.detected);

  const RiskIcon = 
    riskLevel === 'low' ? CheckCircle :
    riskLevel === 'medium' ? AlertCircle :
    AlertTriangle;

  // Debug: Log received data
  useEffect(() => {
    console.log('📊 Results page received data:', {
      score,
      fileName,
      prediction,
      reasoning,
      confidence,
      features,
      hashtagAnalysis,
      extractedText,
      extractedHashtags,
      error
    });

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
  }, [location.state, error, confidence]);

  const handleDownloadReport = () => {
    const reportData = {
      analysisReport: {
        score,
        riskLevel,
        prediction,
        confidence,
        reasoning,
        fileName,
        timestamp: new Date().toISOString(),
        analyzedAt: new Date().toLocaleString()
      },
      hashtagAnalysis,
      extractedContent: {
        text: extractedText,
        hashtags: extractedHashtags
      },
      recommendations: Object.entries(t.results.actions || {}).map(([key, action]) => action)
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
    
    const shareText = `Content Analysis Result: ${score}/100 (${riskLevel} risk). ${hashtagInfo}${reasoning}`;

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
                    <RefreshCw className="h-4 w-4 text-blue-600" />
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
                <RefreshCw className="h-5 w-5" />
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
      
      <main className="container mx-auto px-4 py-8 max-w-4xl">
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
          {/* Blur Overlay */}
          <div className="absolute inset-0 bg-white/80 backdrop-blur-sm rounded-lg z-10 flex items-center justify-center">
            <div className="text-center p-6 max-w-md">
              <AlertTriangle className="h-12 w-12 text-yellow-600 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                Score Engine Under Maintenance 
              </h3>
              <p className="text-gray-700 mb-4">
                This Score Engine has not been fully completed yet, but it is expected to be fully completed in the future.
              </p>
              
            </div>
          </div>

          <div className="flex flex-col items-center space-y-6">
            <div className="relative">
              <div className="flex h-32 w-32 items-center justify-center rounded-full bg-white shadow-lg ring-2 ring-white">
                <div className="text-center">
                  <div className={`text-4xl font-bold ${riskColor}`}>
                    {score}
                  </div>
                  <div className="text-xs text-gray-500">/ 100</div>
                </div>
              </div>
              <div className={`absolute -right-2 -top-2 rounded-full p-2 ${riskBgColor} border`}>
                <RiskIcon className={`h-8 w-8 ${riskColor}`} />
              </div>
            </div>

            <div className="w-full max-w-md space-y-2">
              <div className="flex justify-between text-sm text-gray-600 mb-1">
                <span className="font-medium">Low Risk</span>
                <span className="font-medium">Medium Risk</span>
                <span className="font-medium">High Risk</span>
              </div>
              <Progress value={score} className={`h-3 ${progressColor}`} />
              <div className="flex justify-between text-xs text-gray-500">
                <span>0</span>
                <span>50</span>
                <span>100</span>
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

          {/* AI Analysis Results */}
         
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
                    <RefreshCw className="h-4 w-4" />
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

          {/* Rest of your existing components remain the same */}
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

          {/* Extracted Text Preview */}
          {extractedText && extractedText.trim() !== '' && extractedText !== 'No text could be extracted from the image.' && (
            <Card className="p-6 border shadow-sm">
              <h3 className="text-xl font-semibold mb-4 text-gray-900 flex items-center gap-2">
                <FileText className="h-5 w-5 text-blue-600" />
                Extracted Text from Image
              </h3>
              <div className="p-4 bg-gray-50 rounded-lg border max-h-40 overflow-y-auto">
                <p className="text-sm text-gray-600 whitespace-pre-wrap">
                  {extractedText}
                </p>
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

          {/* Suggested Actions */}
          <Card className="p-6 border shadow-sm">
            <h3 className="text-xl font-semibold mb-4 text-gray-900">
              {t.results?.suggestions || 'Recommended Actions'}
            </h3>
            <ul className="space-y-3">
              {Object.entries(t.results?.actions || {
                monitor: 'Monitor content consumption habits',
                discuss: 'Discuss online safety with family',
                limit: 'Set reasonable time limits',
                diversify: 'Encourage diverse activities'
              }).map(([key, action]) => (
                <li key={key} className="flex items-start gap-3">
                  <div className="mt-1 rounded-full bg-green-100 p-1">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  </div>
                  <span className="text-sm leading-relaxed text-gray-700">
                    {action}
                  </span>
                </li>
              ))}
            </ul>
          </Card>

          {/* Action Buttons */}
          <div className="grid gap-3 sm:grid-cols-2">
            <Button
              variant="outline"
              size="lg"
              className="gap-2 border-gray-300 hover:bg-gray-50"
              onClick={handleDownloadReport}
            >
              <Download className="h-5 w-5" />
              {t.results?.downloadReport || 'Download Report'}
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
    </div>
  );
}