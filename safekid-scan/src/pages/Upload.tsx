import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useLanguage } from '@/contexts/LanguageContext';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Upload as UploadIcon, FileImage, X } from 'lucide-react';
import { toast } from 'sonner';
import uploadPlaceholder from '@/assets/upload-placeholder.png';
import { ConsentDialog } from '@/components/ConsentDialog';
import { API_CONFIG } from '@/config/api';

const formSchema = z.object({
  childName: z.string().min(1, 'required').max(100),
  age: z.number().min(1).max(18),
  guardianName: z.string().min(1, 'required').max(100),
  guardianPhone: z.string().min(10, 'invalidPhone').max(15),
  region: z.string().optional(),
  happiness: z.string().max(500).optional(),
});

type FormData = z.infer<typeof formSchema>;

export default function Upload() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isConsentOpen, setIsConsentOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const navigate = useNavigate();
  const { t } = useLanguage();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
  });

  const age = watch('age');

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

  const onSubmit = (data: FormData) => {
    if (!file) {
      toast.error(t.errors.noFile);
      return;
    }
    setIsConsentOpen(true);
  };

  const handleConsentConfirm = async () => {
    setIsConsentOpen(false);
    setIsUploading(true);

    try {
      const formData = new FormData();
      if (file) {
        formData.append('image', file);
        
        // Add form data to the request
        const formValues = watch();
        Object.entries(formValues).forEach(([key, value]) => {
          if (value) formData.append(key, value.toString());
        });
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
      
      // Navigate to results with ALL analysis data from backend
      const navigationState = {
        score: result.score || 50,
        fileName: result.fileName || file?.name || 'unknown.png',
        prediction: result.prediction || 'non-addictive',
        reasoning: result.reasoning || 'Analysis completed successfully.',
        confidence: result.confidence || 0.7,
        features: result.features || ['image_analysis', 'hashtag_analysis', 'text_extraction'],
        hashtagAnalysis: result.hashtagAnalysis || {
          total_hashtags: 0,
          addictive_hashtags: 0,
          safe_hashtags: 0,
          hashtag_details: [],
          addictive_percentage: 0,
          analysis_method: 'none'
        },
        extractedText: result.extractedText || '',
        extractedHashtags: result.extractedHashtags || []
      };

      console.log('🚀 Navigating to results with state:', navigationState);
      
      // Navigate to results page
      navigate('/results', {
        state: navigationState
      });

    } catch (error) {
      console.error('❌ Upload failed:', error);
      toast.error(t.errors.scanFailed || 'Analysis failed. Please try again.');
      
      // Fallback to mock data if backend fails
      const mockScore = Math.floor(Math.random() * 100);
      navigate('/results', {
        state: {
          score: mockScore,
          fileName: file?.name,
          prediction: mockScore > 50 ? 'addictive' : 'non-addictive',
          reasoning: 'Backend connection failed. Using mock data.',
          confidence: Math.random() * 0.3 + 0.7,
          features: ['image_analysis'],
          hashtagAnalysis: {
            total_hashtags: 0,
            addictive_hashtags: 0,
            safe_hashtags: 0,
            hashtag_details: [],
            addictive_percentage: 0,
            analysis_method: 'none'
          },
          extractedText: '',
          extractedHashtags: []
        }
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
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

          {/* Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="rounded-2xl border bg-card p-6 shadow-sm space-y-6">
              <h2 className="text-xl font-semibold text-foreground">
                {t.form.childName.split("'")[0]} Information
              </h2>
              
              <div className="grid gap-6 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="childName">{t.form.childName}</Label>
                  <Input
                    id="childName"
                    {...register('childName')}
                    placeholder={t.form.childNamePlaceholder}
                    className={errors.childName ? 'border-destructive' : ''}
                  />
                  {errors.childName && (
                    <p className="text-sm text-destructive">{t.form.required}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="age">{t.form.age}</Label>
                  <Select
                    value={age?.toString()}
                    onValueChange={(value) => setValue('age', parseInt(value))}
                  >
                    <SelectTrigger className={errors.age ? 'border-destructive' : ''}>
                      <SelectValue placeholder={t.form.agePlaceholder} />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 9 }, (_, i) => i + 10).map((num) => (
                        <SelectItem key={num} value={num.toString()}>
                          {num}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.age && (
                    <p className="text-sm text-destructive">{t.form.invalidAge}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="guardianName">{t.form.guardianName}</Label>
                  <Input
                    id="guardianName"
                    {...register('guardianName')}
                    placeholder={t.form.guardianNamePlaceholder}
                    className={errors.guardianName ? 'border-destructive' : ''}
                  />
                  {errors.guardianName && (
                    <p className="text-sm text-destructive">{t.form.required}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="guardianPhone">{t.form.guardianPhone}</Label>
                  <Input
                    id="guardianPhone"
                    type="tel"
                    {...register('guardianPhone')}
                    placeholder={t.form.guardianPhonePlaceholder}
                    className={errors.guardianPhone ? 'border-destructive' : ''}
                  />
                  {errors.guardianPhone && (
                    <p className="text-sm text-destructive">{t.form.invalidPhone}</p>
                  )}
                </div>

                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="region">{t.form.region}</Label>
                  <Input
                    id="region"
                    {...register('region')}
                    placeholder={t.form.regionPlaceholder}
                  />
                </div>

                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="happiness">{t.form.happiness}</Label>
                  <Textarea
                    id="happiness"
                    {...register('happiness')}
                    placeholder={t.form.happinessPlaceholder}
                    rows={3}
                  />
                </div>
              </div>
            </div>

            <Button
              type="submit"
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
                  {t.form.submit}
                </>
              )}
            </Button>
          </form>

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