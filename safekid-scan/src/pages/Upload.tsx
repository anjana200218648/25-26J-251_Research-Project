import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Upload as UploadIcon, FileImage, X, Sparkles, Brain, Shield, Eye } from 'lucide-react';
import { toast } from 'sonner';
import uploadPlaceholder from '@/assets/upload-placeholder.png';
import { API_CONFIG } from '@/config/api';

export default function Upload() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
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

  const handleUploadAndScan = async () => {
    if (!file) {
      toast.error(t.errors.noFile);
      return;
    }

    setIsUploading(true);

    try {
      const formData = new FormData();
      if (file) {
        formData.append('image', file);
      }

      const apiUrl = `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.ANALYZE}`;
      
      console.log('🔄 Sending request to:', apiUrl);
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Server error: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      
      console.log('✅ Backend result received:', result);
      
      // ✅ FIXED: සම්පූර්ණ data object එකක් සාදන්න
      const navigationState = {
        // ප්‍රධාන score data
        score: result.score || 50,
        fileName: result.fileName || file?.name || 'unknown.png',
        prediction: result.prediction || 'non-addictive',
        reasoning: result.reasoning || 'Analysis completed successfully.',
        confidence: result.confidence || 0.7,
        features: result.features || ['image_analysis', 'hashtag_analysis', 'text_extraction'],
        
        // ✅ Text Analysis Data (Results.tsx එහි ඇති ලෙසම)
        textAnalysisResult: result.textAnalysisResult || null,
        extractedText: result.extractedText || '',
        sinhalaText: result.sinhalaText || '',
        englishText: result.englishText || '',
        ocrConfidence: result.ocrConfidence || 0,
        safetyScore: result.safetyScore || 0,
        ageAppropriateness: result.ageAppropriateness || 'unknown',
        riskCategories: result.riskCategories || [],
        safetyRecommendations: result.safetyRecommendations || [],
        contentAnalysis: result.contentAnalysis || {},
        
        // ✅ Content Category Analysis
        contentCategoryAnalysis: result.contentCategoryAnalysis || {
          detected_items: [],
          primary_category: null,
          category_hierarchy: 'Unknown',
          addictive_count: 0,
          non_addictive_count: 0,
          total_categories_found: 0,
          folder_structure_mapped: false,
          prediction_based: false
        },
        
        // ✅ Hashtag Analysis
        hashtagAnalysis: result.hashtagAnalysis || {
          total_hashtags: 0,
          addictive_hashtags: 0,
          safe_hashtags: 0,
          hashtag_details: [],
          addictive_percentage: 0,
          analysis_method: 'none'
        },
        
        extractedHashtags: result.extractedHashtags || [],
        
        // ✅ Error if exists
        error: result.error || null,
        message: result.message || null
      };

      console.log('🚀 Navigating to results with state:', navigationState);
      
      // ✅ FIXED: Save to sessionStorage as backup
      sessionStorage.setItem('analysisData', JSON.stringify(navigationState));
      
      // Navigate to results page
      navigate('/results', {
        state: navigationState
      });

    } catch (error) {
      console.error('❌ Upload failed:', error);
      toast.error(t.errors.scanFailed || 'Analysis failed. Please try again.');
      
      // ✅ FIXED: Include ALL data in fallback state
      const mockScore = Math.floor(Math.random() * 100);
      const fallbackState = {
        score: mockScore,
        fileName: file?.name || 'uploaded_image.jpg',
        prediction: mockScore > 50 ? 'addictive' : 'non-addictive',
        reasoning: 'Backend connection failed. Using mock data for demonstration.',
        confidence: Math.random() * 0.3 + 0.7,
        features: ['image_analysis', 'text_extraction', 'hashtag_analysis', 'category_analysis'],
        
        // ✅ Text Analysis Data
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
        
        // ✅ Content Category Analysis
        contentCategoryAnalysis: {
          detected_items: [
            {
              content_type: 'educational',
              main_category: 'Non-addictive Content',
              detected_keyword: 'model_prediction',
              confidence: 0.78
            },
            {
              content_type: 'informational',
              main_category: 'Non-addictive Content',
              detected_keyword: 'possible_match',
              confidence: 0.65
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
          non_addictive_count: 2,
          total_categories_found: 2,
          folder_structure_mapped: true,
          prediction_based: true
        },
        
        // ✅ Hashtag Analysis
        hashtagAnalysis: {
          total_hashtags: 5,
          addictive_hashtags: 1,
          safe_hashtags: 4,
          hashtag_details: [
            { hashtag: 'education', is_addictive: false, method: 'rule-based', prediction: 'safe', confidence: 0.9 },
            { hashtag: 'learning', is_addictive: false, method: 'rule-based', prediction: 'safe', confidence: 0.85 },
            { hashtag: 'kids', is_addictive: false, method: 'rule-based', prediction: 'safe', confidence: 0.8 },
            { hashtag: 'parenting', is_addictive: false, method: 'rule-based', prediction: 'safe', confidence: 0.88 },
            { hashtag: 'gaming', is_addictive: true, method: 'ml-model', prediction: 'addictive', confidence: 0.75 }
          ],
          addictive_percentage: 20,
          analysis_method: 'hybrid'
        },
        
        extractedHashtags: ['education', 'learning', 'kids', 'parenting', 'gaming'],
        
        error: null,
        message: 'Using mock data due to backend connection failure'
      };
      
      // ✅ Save fallback to sessionStorage too
      sessionStorage.setItem('analysisData', JSON.stringify(fallbackState));
      
      // Navigate with fallback data
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
      
      {/* Loading Overlay */}
      {isUploading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur-sm">
          <div className="relative">
            {/* Animated background */}
            <div className="absolute inset-0 -z-10">
              <div className="absolute top-1/4 left-1/4 h-64 w-64 animate-pulse rounded-full bg-primary/10 blur-3xl" />
              <div className="absolute bottom-1/4 right-1/4 h-64 w-64 animate-pulse rounded-full bg-secondary/10 blur-3xl" />
            </div>
            
            {/* Main loading container */}
            <div className="relative flex flex-col items-center justify-center space-y-8">
              {/* Animated circles */}
              <div className="relative h-48 w-48">
                <div className="absolute inset-0 animate-spin rounded-full border-4 border-primary/20 border-t-primary" />
                <div className="absolute inset-4 animate-spin rounded-full border-4 border-secondary/20 border-t-secondary" style={{ animationDirection: 'reverse', animationDuration: '2s' }} />
                <div className="absolute inset-8 animate-spin rounded-full border-4 border-accent/20 border-t-accent" style={{ animationDuration: '1.5s' }} />
                
                {/* Central icon */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="relative">
                    <Brain className="h-16 w-16 animate-pulse text-primary" />
                    <Sparkles className="absolute -right-2 -top-2 h-8 w-8 animate-bounce text-yellow-500" />
                  </div>
                </div>
              </div>

              {/* Progress indicators */}
              <div className="text-center space-y-4 max-w-md">
                <h2 className="text-2xl font-bold text-foreground">Analyzing Content</h2>
                <p className="text-muted-foreground">We're scanning for potential addictive elements...</p>
                
                {/* Progress steps */}
                <div className="flex items-center justify-center space-x-8 pt-4">
                  <div className="flex flex-col items-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                      <Eye className="h-6 w-6 text-primary animate-pulse" />
                    </div>
                    <p className="mt-2 text-sm font-medium">Image Analysis</p>
                  </div>
                  
                  <div className="h-0.5 w-8 bg-primary/20">
                    <div className="h-full w-0 animate-[progress_1s_ease-in-out_infinite] bg-primary" />
                  </div>
                  
                  <div className="flex flex-col items-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary/10">
                      <Brain className="h-6 w-6 text-secondary animate-pulse" style={{ animationDelay: '0.2s' }} />
                    </div>
                    <p className="mt-2 text-sm font-medium">AI Processing</p>
                  </div>
                  
                  <div className="h-0.5 w-8 bg-secondary/20">
                    <div className="h-full w-0 animate-[progress_1s_ease-in-out_infinite] bg-secondary" style={{ animationDelay: '0.2s' }} />
                  </div>
                  
                  <div className="flex flex-col items-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent/10">
                      <Shield className="h-6 w-6 text-accent animate-pulse" style={{ animationDelay: '0.4s' }} />
                    </div>
                    <p className="mt-2 text-sm font-medium">Safety Check</p>
                  </div>
                </div>

                {/* Loading dots */}
                <div className="flex justify-center space-x-2 pt-6">
                  <div className="h-3 w-3 animate-bounce rounded-full bg-primary" />
                  <div className="h-3 w-3 animate-bounce rounded-full bg-secondary" style={{ animationDelay: '0.1s' }} />
                  <div className="h-3 w-3 animate-bounce rounded-full bg-accent" style={{ animationDelay: '0.2s' }} />
                </div>

                {/* Percentage */}
                <div className="pt-4">
                  <div className="h-2 w-64 overflow-hidden rounded-full bg-muted">
                    <div 
                      className="h-full w-0 animate-[loading_2s_ease-in-out_infinite] bg-gradient-to-r from-primary via-secondary to-accent"
                      style={{ animationDuration: '3s' }}
                    />
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">Processing your content...</p>
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

          <Button
            type="button"
            size="lg"
            onClick={handleUploadAndScan}
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
    </div>
  );
}