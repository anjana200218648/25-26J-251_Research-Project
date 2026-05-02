import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Upload as UploadIcon, FileImage, X, Sparkles, Brain, Eye } from 'lucide-react';
import { toast } from 'sonner';
import uploadPlaceholder from '@/assets/upload-placeholder.png';
import { ConsentDialog } from '@/components/ConsentDialog';
import { API_CONFIG } from '@/config/api';

export default function Upload() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isConsentOpen, setIsConsentOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const navigate = useNavigate();
  const { t } = useLanguage();

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const files = e.dataTransfer.files;
    if (files && files[0]) {
      handleFileChange(files[0]);
    }
  };

  const handleFileChange = (selectedFile: File) => {
    // Validate file
    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    const maxSize = 10 * 1024 * 1024; // 10 MB

    if (!validTypes.includes(selectedFile.type)) {
      toast.error(t.errors.invalidFormat);
      return;
    }

    if (selectedFile.size > maxSize) {
      toast.error(t.errors.fileTooBig);
      return;
    }

    setFile(selectedFile);
    
    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreview(reader.result as string);
    };
    reader.readAsDataURL(selectedFile);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files[0]) {
      handleFileChange(files[0]);
    }
  };

  const removeFile = () => {
    setFile(null);
    setPreview(null);
  };

  const handleUploadAndScan = () => {
    if (!file) {
      toast.error(t.errors.noFile);
      return;
    }
    setIsConsentOpen(true);
  };

  // Function to call text analysis on port 8000
  const performTextAnalysis = async (imageFile: File) => {
    try {
      const textFormData = new FormData();
      textFormData.append('image', imageFile);
      
      const textApiUrl = `http://localhost:8000/api/analyze-text`; // Text analysis endpoint
      
      console.log('📝 Calling text analysis on port 8000:', textApiUrl);
      
      const response = await fetch(textApiUrl, {
        method: 'POST',
        body: textFormData,
      });

      if (!response.ok) {
        console.warn('Text analysis failed on port 8000');
        return null;
      }

      const textResult = await response.json();
      console.log('✅ Text analysis result from port 8000:', textResult);
      return textResult;
    } catch (error) {
      console.error('❌ Text analysis error on port 8000:', error);
      return null;
    }
  };

  const handleConsentConfirm = async () => {
    setIsConsentOpen(false);
    setIsUploading(true);

    try {
      // ===== STEP 1: Call main backend on port 5000 =====
      const mainFormData = new FormData();
      if (file) {
        mainFormData.append('image', file);
      }

      // Main backend on port 5000
      const mainApiUrl = `http://localhost:5000${API_CONFIG.ENDPOINTS.ANALYZE}`;
      
      console.log('🔄 Calling main backend on port 5000:', mainApiUrl);
      
      const mainResponse = await fetch(mainApiUrl, {
        method: 'POST',
        body: mainFormData,
      });

      if (!mainResponse.ok) {
        const errorText = await mainResponse.text();
        throw new Error(`Main server error: ${mainResponse.status} - ${errorText}`);
      }

      const mainResult = await mainResponse.json();
      
      console.log('✅ Main backend result from port 5000:', mainResult);
      
      // ===== STEP 2: Call text analysis on port 8000 (separately) =====
      let textAnalysisResult = null;
      if (file) {
        textAnalysisResult = await performTextAnalysis(file);
      }
      
      // ===== STEP 3: Merge both results =====
      const mergedResult = {
        ...mainResult,
        // Add text analysis data from port 8000 if available
        textAnalysisResult: textAnalysisResult || mainResult.textAnalysisResult || null,
        extractedText: textAnalysisResult?.extractedText || mainResult.extractedText || '',
        sinhalaText: textAnalysisResult?.sinhalaText || mainResult.sinhalaText || '',
        englishText: textAnalysisResult?.englishText || mainResult.englishText || '',
        ocrConfidence: textAnalysisResult?.ocrConfidence || mainResult.ocrConfidence || 0,
        safetyScore: textAnalysisResult?.safetyScore || mainResult.safetyScore || 0,
        ageAppropriateness: textAnalysisResult?.ageAppropriateness || mainResult.ageAppropriateness || 'unknown',
        riskCategories: textAnalysisResult?.riskCategories || mainResult.riskCategories || [],
        safetyRecommendations: textAnalysisResult?.safetyRecommendations || mainResult.safetyRecommendations || [],
        contentAnalysis: textAnalysisResult?.contentAnalysis || mainResult.contentAnalysis || {},
      };

      // ===== STEP 4: Create navigation state =====
      const navigationState = {
        // Main data from port 5000
        score: mergedResult.score || 50,
        fileName: mergedResult.fileName || file?.name || 'unknown.png',
        prediction: mergedResult.prediction || 'non-addictive',
        reasoning: mergedResult.reasoning || 'Analysis completed successfully.',
        confidence: mergedResult.confidence || 0.7,
        features: mergedResult.features || ['image_analysis', 'hashtag_analysis', 'text_extraction'],
        
        // Text Analysis Data (from port 8000 if available)
        textAnalysisResult: mergedResult.textAnalysisResult,
        extractedText: mergedResult.extractedText,
        sinhalaText: mergedResult.sinhalaText,
        englishText: mergedResult.englishText,
        ocrConfidence: mergedResult.ocrConfidence,
        safetyScore: mergedResult.safetyScore,
        ageAppropriateness: mergedResult.ageAppropriateness,
        riskCategories: mergedResult.riskCategories,
        safetyRecommendations: mergedResult.safetyRecommendations,
        contentAnalysis: mergedResult.contentAnalysis,
        
        // Content Category Analysis
        contentCategoryAnalysis: mergedResult.contentCategoryAnalysis || mergedResult.category_analysis || {
          detected_items: [],
          primary_category: null,
          category_hierarchy: 'Unknown',
          addictive_count: 0,
          non_addictive_count: 0,
          total_categories_found: 0,
          folder_structure_mapped: false,
          prediction_based: false
        },
        
        // Hashtag Analysis
        hashtagAnalysis: mergedResult.hashtagAnalysis || mergedResult.hashtag_analysis || {
          total_hashtags: 0,
          addictive_hashtags: 0,
          safe_hashtags: 0,
          hashtag_details: [],
          addictive_percentage: 0,
          analysis_method: 'none'
        },
        
        extractedHashtags: mergedResult.extractedHashtags || mergedResult.hashtags || [],
        
        // Error if exists
        error: mergedResult.error || null,
        message: mergedResult.message || null
      };

      console.log('🚀 Merged result from both ports:', {
        port5000: mainResult,
        port8000: textAnalysisResult,
        final: navigationState
      });
      
      // Save to sessionStorage as backup
      sessionStorage.setItem('analysisData', JSON.stringify(navigationState));
      
      // Navigate to results page
      navigate('/results', {
        state: navigationState
      });

    } catch (error) {
      console.error('❌ Upload failed:', error);
      toast.error('Analysis failed. Using mock data for demonstration.');
      
      // Mock data for both ports
      const mockScore = Math.floor(Math.random() * 100);
      const fallbackState = {
        score: mockScore,
        fileName: file?.name || 'uploaded_image.jpg',
        prediction: mockScore > 50 ? 'addictive' : 'non-addictive',
        reasoning: 'Using mock data for demonstration.',
        confidence: Math.random() * 0.3 + 0.7,
        features: ['image_analysis', 'text_extraction', 'hashtag_analysis', 'category_analysis'],
        
        // Text Analysis Data
        textAnalysisResult: {
          original_text: "This is sample extracted text for demonstration.",
          sinhala: { 
            text: "මෙය නිදර්ශනය සඳහා උපුටා ගත් සාම්පල පෙළකි.", 
            confidence: 85, 
            word_count: 8, 
            character_count: 50 
          },
          english: { 
            text: "This is sample extracted text for demonstration.", 
            confidence: 92, 
            word_count: 8, 
            character_count: 50 
          },
          ocr_confidence: 88,
          safety_score: 75,
          age_appropriateness: 'safe',
          content_analysis: {
            risk_level: 'low',
            explanation: 'Content appears to be safe for children.',
            risk_categories: [],
            recommendations: [
              'Monitor screen time',
              'Encourage educational content',
              'Discuss online safety with child'
            ],
            confidence: 0.85
          },
          processing_time: 2.5
        },
        extractedText: "This is sample extracted text for demonstration.",
        sinhalaText: "මෙය නිදර්ශනය සඳහා උපුටා ගත් සාම්පල පෙළකි.",
        englishText: "This is sample extracted text for demonstration.",
        ocrConfidence: 88,
        safetyScore: 75,
        ageAppropriateness: 'safe',
        riskCategories: [],
        safetyRecommendations: [
          'Monitor screen time',
          'Encourage educational content',
          'Discuss online safety with child'
        ],
        contentAnalysis: {
          risk_level: 'low',
          explanation: 'Content appears to be safe for children.',
          risk_categories: [],
          recommendations: [
            'Monitor screen time',
            'Encourage educational content',
            'Discuss online safety with child'
          ],
          confidence: 0.85
        },
        
        // Content Category Analysis
        contentCategoryAnalysis: {
          detected_items: [
            {
              content_type: 'educational',
              main_category: 'Non-addictive Content',
              detected_keyword: 'model_prediction',
              confidence: 0.78
            }
          ],
          primary_category: {
            content_type: 'educational',
            main_category: 'Non-addictive Content',
            detected_keyword: 'model_prediction',
            confidence: 0.78
          },
          category_hierarchy: 'Non-addictive Content → Educational',
          addictive_count: 0,
          non_addictive_count: 1,
          total_categories_found: 1,
          folder_structure_mapped: true,
          prediction_based: true
        },
        
        // Hashtag Analysis
        hashtagAnalysis: {
          total_hashtags: 3,
          addictive_hashtags: 0,
          safe_hashtags: 3,
          hashtag_details: [
            { hashtag: 'education', is_addictive: false, method: 'rule-based', prediction: 'safe', confidence: 0.9 },
            { hashtag: 'learning', is_addictive: false, method: 'rule-based', prediction: 'safe', confidence: 0.85 },
            { hashtag: 'kids', is_addictive: false, method: 'rule-based', prediction: 'safe', confidence: 0.8 }
          ],
          addictive_percentage: 0,
          analysis_method: 'hybrid'
        },
        
        extractedHashtags: ['education', 'learning', 'kids'],
        
        error: null,
        message: 'Using mock data'
      };
      
      sessionStorage.setItem('analysisData', JSON.stringify(fallbackState));
      
      navigate('/results', {
        state: fallbackState
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      {/* Loading Overlay - Improved for full page coverage */}
      {isUploading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur-sm">
          <div className="relative w-full max-w-2xl mx-4">
            {/* Animated background */}
            <div className="absolute inset-0 -z-10">
              <div className="absolute top-1/4 left-1/4 h-64 w-64 animate-pulse rounded-full bg-primary/10 blur-3xl" />
              <div className="absolute bottom-1/4 right-1/4 h-64 w-64 animate-pulse rounded-full bg-secondary/10 blur-3xl" />
            </div>
            
            {/* Main loading container */}
            <div className="relative flex flex-col items-center justify-center space-y-8 p-8">
              {/* Animated circles */}
              <div className="relative h-40 w-40 sm:h-48 sm:w-48">
                <div className="absolute inset-0 animate-spin rounded-full border-4 border-primary/20 border-t-primary" />
                <div className="absolute inset-4 animate-spin rounded-full border-4 border-secondary/20 border-t-secondary" style={{ animationDirection: 'reverse', animationDuration: '2s' }} />
                <div className="absolute inset-8 animate-spin rounded-full border-4 border-accent/20 border-t-accent" style={{ animationDuration: '1.5s' }} />
                
                {/* Central icon */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="relative">
                    <Brain className="h-12 w-12 sm:h-16 sm:w-16 animate-pulse text-primary" />
                    <Sparkles className="absolute -right-2 -top-2 h-6 w-6 sm:h-8 sm:w-8 animate-bounce text-yellow-500" />
                  </div>
                </div>
              </div>

              {/* Progress indicators */}
              <div className="text-center space-y-4 w-full">
                <h2 className="text-xl sm:text-2xl font-bold text-foreground">Analyzing Content</h2>
                <p className="text-sm sm:text-base text-muted-foreground max-w-lg mx-auto px-4">
                  ඔබ ඇතුළත් කළ screenshot එක addictive කාණ්ඩයට අයත් වේ නම්, මෙහි ඇති "Protect Your Child" බොත්තම ක්ලික් කර සුළු තොරතුරු කිහිපයක් ඇතුළත් කරන්න. එවිට ඔබගේ දරුවා පද්ධතියට ලියාපදිංචි කරමින් මෙම තත්ත්වයෙන් මිදීමට අවශ්‍ය සහය ලබා ගත හැක.
                </p>
                
                {/* Progress steps */}
                <div className="flex items-center justify-center space-x-4 sm:space-x-8 pt-4">
                  <div className="flex flex-col items-center">
                    <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-full bg-primary/10">
                      <Eye className="h-5 w-5 sm:h-6 sm:w-6 text-primary animate-pulse" />
                    </div>
                    <p className="mt-2 text-xs sm:text-sm font-medium">Extract All Data</p>
                  </div>
                  
                  <div className="h-0.5 w-6 sm:w-8 bg-primary/20">
                    <div className="h-full w-0 animate-[progress_1s_ease-in-out_infinite] bg-primary" />
                  </div>
                  
                  <div className="flex flex-col items-center">
                    <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-full bg-secondary/10">
                      <Brain className="h-5 w-5 sm:h-6 sm:w-6 text-secondary animate-pulse" style={{ animationDelay: '0.2s' }} />
                    </div>
                    <p className="mt-2 text-xs sm:text-sm font-medium">Deeply Analysing</p>
                  </div>
                </div>

                {/* Loading dots */}
                <div className="flex justify-center space-x-2 pt-4 sm:pt-6">
                  <div className="h-2 w-2 sm:h-3 sm:w-3 animate-bounce rounded-full bg-primary" />
                  <div className="h-2 w-2 sm:h-3 sm:w-3 animate-bounce rounded-full bg-secondary" style={{ animationDelay: '0.1s' }} />
                  <div className="h-2 w-2 sm:h-3 sm:w-3 animate-bounce rounded-full bg-accent" style={{ animationDelay: '0.2s' }} />
                </div>

                {/* Progress bar */}
                <div className="pt-4 max-w-sm mx-auto w-full px-4">
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div 
                      className="h-full w-0 animate-[loading_2s_ease-in-out_infinite] bg-gradient-to-r from-primary to-secondary"
                      style={{ animationDuration: '3s' }}
                    />
                  </div>
                  <p className="mt-2 text-xs sm:text-sm text-muted-foreground">Processing your content...</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="space-y-8 animate-fade-in">
          {/* Header */}
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-bold text-foreground sm:text-4xl">
              {t.upload.title}
            </h1>
            <p className="text-muted-foreground text-lg">
              {t.upload.subtitle}
            </p>
          </div>

          {/* Upload Area */}
          <div
            className={`relative rounded-2xl border-2 border-dashed p-8 transition-colors ${
              dragActive
                ? 'border-primary bg-primary/5'
                : 'border-border bg-card'
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            {!preview ? (
              <div className="flex flex-col items-center justify-center space-y-4 text-center">
                <div className="rounded-full bg-secondary p-6">
                  <img src={uploadPlaceholder} alt="Upload" className="h-24 w-24" />
                </div>
                <div className="space-y-2">
                  <p className="text-muted-foreground">
                    {t.upload.dragDrop}{' '}
                    <label className="cursor-pointer text-primary hover:underline">
                      {t.upload.chooseFile}
                      <input
                        type="file"
                        className="hidden"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={handleFileInput}
                      />
                    </label>
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {t.upload.supportedFormats}
                  </p>
                  <p className="text-sm text-muted-foreground italic">
                    {t.upload.helpText}
                  </p>
                </div>
              </div>
            ) : (
              <div className="relative">
                <img
                  src={preview}
                  alt="Preview"
                  className="max-h-96 w-full rounded-lg object-contain"
                />
                <Button
                  variant="destructive"
                  size="icon"
                  className="absolute right-2 top-2"
                  onClick={removeFile}
                >
                  <X className="h-4 w-4" />
                </Button>
                <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
                  <FileImage className="h-4 w-4" />
                  <span className="truncate">{file?.name}</span>
                </div>
              </div>
            )}
          </div>

          {/* Upload and Scan Button */}
          <Button
            onClick={handleUploadAndScan}
            size="lg"
            className="w-full gap-2 bg-primary hover:bg-primary-hover"
            disabled={isUploading}
          >
            {isUploading ? (
              <>
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                {t.upload.uploading}
              </>
            ) : (
              <>
                <UploadIcon className="h-5 w-5" />
                Upload and Scan
              </>
            )}
          </Button>

          {/* Privacy Notice */}
          <p className="text-center text-sm text-muted-foreground">
            {t.privacy.notice}
          </p>
        </div>
      </main>

      <ConsentDialog
        isOpen={isConsentOpen}
        onClose={() => setIsConsentOpen(false)}
        onConfirm={handleConsentConfirm}
      />
    </div>
  );
}