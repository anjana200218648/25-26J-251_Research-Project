import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, AlertCircle, CheckCircle, Mic, FileText, RefreshCw } from 'lucide-react';
import { Header } from '@/components/Header';
import { useToast } from '@/hooks/use-toast';
import { VoiceRecorder } from '@/components/VoiceRecorder';
import ComplaintLoadingScreen from '@/components/ComplaintLoadingScreen';
import { useLanguage } from '@/contexts/LanguageContext';

// API Base URL - 8001 port එකට connect වෙන්න
const API_BASE_URL = 'http://localhost:8001';

interface ComplaintFormData {
  guardian_name: string;
  child_id: string;
  child_name: string;
  age: string;
  phone_number: string;
  region: string;
  complaint: string;
  child_gender: string;
  hours_per_day_on_social_media: string;
  reporter_role: string;
  device_type: string;
}

interface Child {
  id: string;
  name: string;
  age: number;
  gender: string;
}

type SubmissionMethod = 'text' | 'voice';

const ComplaintForm = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { t } = useLanguage();
  const cf = t?.complaintForm || {} as any;
  
  // State variables
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [children, setChildren] = useState<Child[]>([]);
  const [user, setUser] = useState<any>(null);
  const [submissionMethod, setSubmissionMethod] = useState<SubmissionMethod>('text');
  const [voiceAudioBlob, setVoiceAudioBlob] = useState<Blob | null>(null);
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [voiceLanguage, setVoiceLanguage] = useState('en-US');
  const [textLanguage, setTextLanguage] = useState('en-US');
  const [isTranscribingVoice, setIsTranscribingVoice] = useState(false);
  const [voiceConfidence, setVoiceConfidence] = useState<number | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isLoadingChildren, setIsLoadingChildren] = useState(false);
  const [complaintValidation, setComplaintValidation] = useState<{
    isValid: boolean;
    message: string;
    suggestions: string[];
    extractedDeviceType?: string;
    extractedHours?: number;
  } | null>(null);
  const [isValidatingComplaint, setIsValidatingComplaint] = useState(false);

  // Form data
  const [formData, setFormData] = useState<ComplaintFormData>({
    guardian_name: '',
    child_id: '',
    child_name: '',
    age: '',
    phone_number: '',
    region: '',
    complaint: '',
    child_gender: '',
    hours_per_day_on_social_media: '',
    reporter_role: '',
    device_type: '',
  });

  // Check if we have data from upload page
  useEffect(() => {
    const uploadData = location.state;
    
    if (uploadData) {
      console.log('Received data from upload:', uploadData);
      
      // Store the uploaded file data in sessionStorage for later use
      if (uploadData.uploadedFile) {
        const reader = new FileReader();
        reader.onloadend = () => {
          sessionStorage.setItem('uploadedImage', reader.result as string);
          sessionStorage.setItem('uploadedFileName', uploadData.uploadedFile.name);
          console.log('Image saved to sessionStorage');
        };
        reader.readAsDataURL(uploadData.uploadedFile);
      }
      
      if (uploadData.formData) {
        console.log('Form data from upload:', uploadData.formData);
        sessionStorage.setItem('guardianFormData', JSON.stringify(uploadData.formData));
        
        // Pre-fill form with guardian data from upload
        setFormData(prev => ({
          ...prev,
          guardian_name: uploadData.formData.guardianName || '',
          phone_number: uploadData.formData.guardianPhone || '',
          region: uploadData.formData.region || '',
          child_name: uploadData.formData.childName || prev.child_name,
          age: uploadData.formData.childAge || prev.age,
        }));
      }
    }
  }, [location.state]);

  // Helper to get translated device name
  const getTranslatedDevice = (device: string) => {
    if (!device) return '';
    const deviceLower = device.toLowerCase();
    
    return device.charAt(0).toUpperCase() + device.slice(1);
  };

  // Load user data and fetch children on component mount
  useEffect(() => {
    const userData = localStorage.getItem('user');
    const token = localStorage.getItem('token');

    console.log('Component mounted');
    console.log('User data exists:', !!userData);
    console.log('Token exists:', !!token);

    if (!userData || !token) {
      console.log('No user/token, redirecting to login');
      navigate('/login');
      return;
    }

    try {
      const parsedUser = JSON.parse(userData);
      console.log('Parsed user:', parsedUser);
      setUser(parsedUser);
      
      setFormData(prev => ({
        ...prev,
        guardian_name: parsedUser.name || '',
        phone_number: parsedUser.phone || '',
        reporter_role: parsedUser.role || '',
      }));

      // Fetch children immediately
      fetchChildren();
    } catch (error) {
      console.error(' Error parsing user data:', error);
      navigate('/login');
    }
  }, [navigate]);

  // Function to fetch children from backend
  const fetchChildren = async () => {
    const token = localStorage.getItem('token');
    
    if (!token) {
      console.error(' No token found');
      return;
    }

    setIsLoadingChildren(true);
    setError(null);

    try {
      console.log('Fetching children from:', `${API_BASE_URL}/api/children`);
      
      const response = await fetch(`${API_BASE_URL}/api/children`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      console.log(' Response status:', response.status);

      if (response.status === 401) {
        console.error('❌ Unauthorized - Token expired');
        toast({
          title: cf.sessionExpired,
          description: cf.loginAgain,
          variant: 'destructive',
        });
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/login');
        return;
      }

      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }

      const data = await response.json();
      console.log(' Children data received:', data);

      // Handle different response formats
      let childrenArray: Child[] = [];
      
      if (Array.isArray(data)) {
        childrenArray = data;
        console.log(' Data is array with', data.length, 'children');
      } else if (data.children && Array.isArray(data.children)) {
        childrenArray = data.children;
        console.log(' Data has children array with', data.children.length, 'children');
      } else {
        console.log(' Unexpected data format:', data);
        childrenArray = [];
      }

      setChildren(childrenArray);

      if (childrenArray.length === 0) {
        toast({
          title: cf.noChildrenFoundTitle,
          description: cf.noChildrenFoundDesc,
          variant: 'default',
        });
      } else {
        console.log('Children loaded successfully:', childrenArray);
      }

    } catch (err) {
      console.error(' Error fetching children:', err);
      setError('Failed to load children. Please try refreshing.');
      toast({
        title: cf.errorTitle,
        description: 'Failed to load children from server',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingChildren(false);
    }
  };

  // Handle child selection
  const handleChildSelect = (childId: string) => {
    console.log('Selected child ID:', childId);
    
    const selectedChild = children.find(c => c.id === childId);
    
    if (selectedChild) {
      console.log(' Found child:', selectedChild);
      
      // Map gender from database format to form format
      let mappedGender = 'Male'; // Default
      
      if (selectedChild.gender === 'M' || selectedChild.gender === 'Male' || selectedChild.gender === 'male') {
        mappedGender = 'Male';
      } else if (selectedChild.gender === 'F' || selectedChild.gender === 'Female' || selectedChild.gender === 'female') {
        mappedGender = 'Female';
      } else if (selectedChild.gender === 'Other' || selectedChild.gender === 'other') {
        mappedGender = 'Other';
      }

      console.log('Mapping gender:', selectedChild.gender, '->', mappedGender);

      // Update form with child data
      setFormData(prev => ({
        ...prev,
        child_id: childId,
        child_name: selectedChild.name,
        age: selectedChild.age.toString(),
        child_gender: mappedGender,
      }));

      // Clear any errors
      setError(null);

      // Show success message
      toast({
        title: cf.childSelected,
        description: `${selectedChild.name} (Age: ${selectedChild.age})`,
      });
    } else {
      console.log('Child not found with ID:', childId);
    }
  };

  // Handle input changes
  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setError(null);
  };

  // Handle select changes
  const handleSelectChange = (name: string, value: string) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
    setError(null);
  };

  // Transcribe voice audio
  const transcribeVoiceAudio = async (audioBlob: Blob, languageCode: string) => {
    const token = localStorage.getItem('token');
    if (!token) {
      throw new Error('Please log in again');
    }

    // Create file from blob
    const audioFile = new File([audioBlob], 'voice-recording.webm', {
      type: audioBlob.type || 'audio/webm',
    });

    const formData = new FormData();
    formData.append('audio_file', audioFile);
    formData.append('language', languageCode);

    const response = await fetch(`${API_BASE_URL}/api/complaints/voice-transcribe`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.details || errorData.error || 'Transcription failed');
    }

    return response.json();
  };

  // Handle voice recording ready
  const handleVoiceAudioReady = async (audioBlob: Blob) => {
    setVoiceAudioBlob(audioBlob);
    setVoiceTranscript('');
    setVoiceConfidence(null);
    setError(null);

    try {
      setIsTranscribingVoice(true);
      const data = await transcribeVoiceAudio(audioBlob, voiceLanguage);
      setVoiceTranscript(data.transcript || '');
      setVoiceConfidence(data.confidence || null);

      toast({
        title: cf.voiceReadyTitle,
        description: cf.voiceReadyDesc,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Voice transcription failed';
      console.error('Voice transcription error:', err);
      setError(errorMessage);
      toast({
        title: cf.voiceErrorTitle,
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsTranscribingVoice(false);
    }
  };

  // Handle submission method change
  const handleSubmissionMethodChange = (method: SubmissionMethod) => {
    setSubmissionMethod(method);
    setError(null);
  };

  // Validate complaint description
  const validateComplaintDescription = async (text: string) => {
    if (!text || text.trim().length < 5) {
      setComplaintValidation(null);
      return;
    }

    try {
      // Clear old validation results while loading
      setComplaintValidation(prev => prev ? { ...prev, extractedHours: null, extractedDeviceType: null } : null);
      setIsValidatingComplaint(true);
      setError(null);

      const token = localStorage.getItem('token');
      if (!token) {
        console.error('No token found for validation');
        return;
      }

      const languageCode = submissionMethod === 'text' ? textLanguage : voiceLanguage;
      const isSinhala = languageCode === 'si-LK';

      const response = await fetch(`${API_BASE_URL}/api/complaints/validate-description`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          complaint: text,
          age: formData.age,
          gender: formData.child_gender,
          hours: formData.hours_per_day_on_social_media,
          device: formData.device_type,
          reporter_role: formData.reporter_role,
          language: isSinhala ? 'si' : 'en',
        }),
      });

      if (!response.ok) {
        console.error('Validation request failed:', response.status);
        // Don't block submission if validation fails
        setComplaintValidation(null);
        return;
      }

      const data = await response.json();
      console.log('Validation result:', data);

      const extractedDevice = data.extracted_device_type;
      const extractedHours = data.extracted_hours;

      setComplaintValidation({
        isValid: data.valid,
        message: data.message || '',
        suggestions: data.suggestions || [],
        extractedDeviceType: extractedDevice,
        extractedHours: extractedHours,
      });

      // Update formData with new values (or clear if null)
      setFormData(prev => ({
        ...prev,
        device_type: extractedDevice ? String(extractedDevice).toLowerCase() : '',
        hours_per_day_on_social_media: (extractedHours !== null && extractedHours !== undefined) ? String(extractedHours) : ''
      }));
    } catch (err) {
      console.error('Error validating complaint:', err);
      // Don't block submission if validation fails
      setComplaintValidation(null);
    } finally {
      setIsValidatingComplaint(false);
    }
  };

  // Debounced validation for text complaints
  useEffect(() => {
    if (submissionMethod === 'text' && formData.complaint.trim().length >= 5) {
      // Debounce validation by 800ms
      const timeoutId = setTimeout(() => {
        validateComplaintDescription(formData.complaint);
      }, 800);

      return () => clearTimeout(timeoutId);
    } else {
      setComplaintValidation(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.complaint, formData.age, formData.child_gender, formData.reporter_role, submissionMethod, textLanguage]);

  // Debounced validation for voice transcripts
  useEffect(() => {
    if (submissionMethod === 'voice' && voiceTranscript.trim().length >= 5) {
      // Debounce validation by 800ms
      const timeoutId = setTimeout(() => {
        validateComplaintDescription(voiceTranscript);
      }, 800);

      return () => clearTimeout(timeoutId);
    } else if (submissionMethod === 'voice') {
      setComplaintValidation(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voiceTranscript, formData.age, formData.child_gender, formData.reporter_role, submissionMethod, voiceLanguage]);

  // Validation helpers
  const ageValue = parseInt(formData.age);
  const hoursValue = parseFloat(formData.hours_per_day_on_social_media);

  const isGuardianInfoComplete =
    formData.guardian_name.trim().length > 0 &&
    formData.phone_number.trim().length >= 10 &&
    formData.region.trim().length > 0;

  const isChildBasicInfoComplete =
    (formData.child_id ? true : formData.child_name.trim().length > 0) &&
    !Number.isNaN(ageValue) &&
    ageValue >= 10 &&
    ageValue <= 18 &&
    formData.child_gender.trim().length > 0;

  const isComplaintSectionEnabled = isGuardianInfoComplete && isChildBasicInfoComplete;

  const isComplaintContentReady = submissionMethod === 'text'
    ? formData.complaint.trim().length > 0 && complaintValidation?.isValid === true
    : !!voiceAudioBlob && voiceTranscript.trim().length > 0 && complaintValidation?.isValid === true;
    
  const isUsageMetricsEnabled = isComplaintSectionEnabled && isComplaintContentReady && !isTranscribingVoice && !isValidatingComplaint;

  const isChildInfoComplete =
    isChildBasicInfoComplete &&
    formData.reporter_role.trim().length > 0;

  const isFormReadyToSubmit = isComplaintSectionEnabled && isComplaintContentReady && isChildInfoComplete;

  // Validate form
  const validateForm = (): boolean => {
    if (!formData.guardian_name.trim()) {
      setError(cf.errorGuardianRequired);
      return false;
    }
    if (!formData.child_name.trim()) {
      setError(cf.errorChildNameRequired);
      return false;
    }
    const age = parseInt(formData.age);
    if (!formData.age || age < 10 || age > 18) {
      setError(cf.errorInvalidAge);
      return false;
    }
    if (!formData.phone_number.trim() || formData.phone_number.length < 10) {
      setError(cf.errorInvalidPhone);
      return false;
    }
    if (!formData.region.trim()) {
      setError(cf.errorRegionRequired);
      return false;
    }
    if (submissionMethod === 'text' && !formData.complaint.trim()) {
      setError(cf.errorEnterComplaint);
      return false;
    }
    if (submissionMethod === 'text' && complaintValidation && !complaintValidation.isValid) {
      setError(cf.errorFixComplaint);
      return false;
    }
    if (submissionMethod === 'voice' && !voiceAudioBlob) {
      setError(cf.errorRecordAudio);
      return false;
    }
    if (submissionMethod === 'voice' && !voiceTranscript.trim()) {
      setError(cf.errorProvideTranscript);
      return false;
    }
    if (submissionMethod === 'voice' && complaintValidation && !complaintValidation.isValid) {
      setError(cf.errorFixTranscript);
      return false;
    }
    if (!formData.child_gender) {
      setError(cf.errorSelectGender);
      return false;
    }
    if (!formData.reporter_role) {
      setError(cf.errorSelectRole);
      return false;
    }
    return true;
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const token = localStorage.getItem('token');
      const userData = localStorage.getItem('user');
      const currentUser = userData ? JSON.parse(userData) : null;

      if (!currentUser || !currentUser._id || !token) {
        throw new Error('Please login again');
      }

      let result: any;
      const uploadedImage = sessionStorage.getItem('uploadedImage');

      if (submissionMethod === 'voice') {
        // Voice submission
        if (!voiceAudioBlob) {
          throw new Error('No voice recording found');
        }

        const formDataObj = new FormData();
        formDataObj.append('audio_file', voiceAudioBlob, 'voice-recording.webm');
        formDataObj.append('language', voiceLanguage);
        formDataObj.append('guardian_name', formData.guardian_name);
        formDataObj.append('child_name', formData.child_name);
        formDataObj.append('age', formData.age);
        formDataObj.append('phone_number', formData.phone_number);
        formDataObj.append('region', formData.region);
        formDataObj.append('child_gender', formData.child_gender);
        formDataObj.append('hours_per_day_on_social_media', formData.hours_per_day_on_social_media);
        formDataObj.append('reporter_role', formData.reporter_role);
        formDataObj.append('device_type', formData.device_type);
        formDataObj.append('complaint', voiceTranscript);
        
        if (uploadedImage) {
          formDataObj.append('uploaded_image', uploadedImage);
        }

        const response = await fetch(`${API_BASE_URL}/api/complaints/voice-submit`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
          body: formDataObj,
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || 'Failed to submit voice complaint');
        }

        result = await response.json();
      } else {
        // Text submission
        const submissionData = {
          ...formData,
          user_id: currentUser._id,
          age: parseInt(formData.age),
          hours_per_day_on_social_media: parseFloat(formData.hours_per_day_on_social_media),
          uploaded_image: uploadedImage,
          language: textLanguage,
        };

        const response = await fetch(`${API_BASE_URL}/api/complaints/submit`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify(submissionData),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || 'Failed to submit complaint');
        }

        result = await response.json();
      }

      console.log('=== Backend Response ===');
      console.log('Full result from backend:', result);
      console.log('Keys:', Object.keys(result));
      console.log('======================');

      // Show success message
      toast({
        title: cf.successTitle,
        description: cf.successDesc,
      });

      // Show analysis loading screen
      setIsAnalyzing(true);

      // Navigate to results page
      setTimeout(() => {
        navigate('/complaint-result', { 
          state: { result }
        });
        setIsAnalyzing(false);
      }, 2000);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to submit';
      console.error('Submission error:', err);
      setError(errorMessage);
      toast({
        title: cf.errorTitle,
        description: errorMessage,
        variant: 'destructive',
      });
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      <Header />
      <ComplaintLoadingScreen isAnalyzing={isAnalyzing} />
      
      <div className="container mx-auto px-4 py-8 max-w-3xl">
        <Card className="shadow-xl">
          <CardHeader className="space-y-1 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-t-lg">
            <CardTitle className="text-3xl font-bold">{cf.title}</CardTitle>
            <CardDescription className="text-blue-50">
              {cf.subtitle}
            </CardDescription>
          </CardHeader>

          <CardContent className="pt-6">
            {/* Error Display */}
            {error && (
              <Alert variant="destructive" className="mb-6">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Guardian Information */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-800 border-b pb-2">
                  {cf.guardianSection}
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="guardian_name">
                      {cf.fullName} <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="guardian_name"
                      name="guardian_name"
                      value={formData.guardian_name}
                      onChange={handleInputChange}
                      placeholder={cf.fullNamePlaceholder}
                      disabled={isSubmitting}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone_number">
                      {cf.phoneNumber} <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="phone_number"
                      name="phone_number"
                      value={formData.phone_number}
                      onChange={handleInputChange}
                      placeholder={cf.phoneNumberPlaceholder}
                      type="tel"
                      disabled={isSubmitting}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="region">
                      {cf.region} <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="region"
                      name="region"
                      value={formData.region}
                      onChange={handleInputChange}
                      placeholder={cf.regionPlaceholder}
                      disabled={isSubmitting}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="reporter_role">
                      {cf.yourRole} <span className="text-red-500">*</span>
                    </Label>
                    <Select
                      value={formData.reporter_role}
                      onValueChange={(value) => handleSelectChange('reporter_role', value)}
                      disabled={isSubmitting || !!user?.role}
                    >
                      <SelectTrigger className={!!user?.role ? 'bg-gray-100' : ''}>
                        <SelectValue placeholder={cf.selectRole} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="guardian">{cf.roleGuardian}</SelectItem>
                        <SelectItem value="mother">{cf.roleMother}</SelectItem>
                        <SelectItem value="father">{cf.roleFather}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Child Basic Information */}
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b pb-2">
                  <h3 className="text-lg font-semibold text-gray-800">
                    {cf.childSection}
                  </h3>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={fetchChildren}
                    disabled={isLoadingChildren || isSubmitting}
                    className="h-8 px-2 text-blue-600"
                  >
                    <RefreshCw className={`h-4 w-4 mr-1 ${isLoadingChildren ? 'animate-spin' : ''}`} />
                    {cf.refresh}
                  </Button>
                </div>

                {!isGuardianInfoComplete && (
                  <p className="text-sm text-amber-600">
                    {cf.completeGuardianFirst}
                  </p>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="child_select">
                      {cf.selectChild} <span className="text-red-500">*</span>
                    </Label>
                    
                    {isLoadingChildren ? (
                      <div className="flex items-center space-x-2 h-10 px-3 border rounded-md bg-gray-50">
                        <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                        <span className="text-sm text-gray-600">{cf.loadingChildren}</span>
                      </div>
                    ) : children.length > 0 ? (
                      <Select
                        value={formData.child_id}
                        onValueChange={handleChildSelect}
                        disabled={!isGuardianInfoComplete || isSubmitting}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={cf.chooseChild} />
                        </SelectTrigger>
                        <SelectContent>
                          {children.map((child) => (
                            <SelectItem key={child.id} value={child.id}>
                              {child.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <div className="space-y-2">
                        <Input
                          id="child_name"
                          name="child_name"
                          value={formData.child_name}
                          onChange={handleInputChange}
                          placeholder={cf.enterChildName}
                          disabled={!isGuardianInfoComplete || isSubmitting}
                        />
                        <p className="text-xs text-amber-600">
                          {cf.noChildrenFound}{' '}
                          <button
                            type="button"
                            onClick={() => navigate('/profile', { state: { activeTab: 'children' } })}
                            className="text-blue-600 hover:underline"
                          >
                            {cf.addChildrenInProfile}
                          </button>
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="age">
                      {cf.age} <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="age"
                      name="age"
                      type="number"
                      min="10"
                      max="18"
                      value={formData.age}
                      onChange={handleInputChange}
                      placeholder={cf.agePlaceholder}
                      disabled={!isGuardianInfoComplete || isSubmitting || formData.child_id !== ''}
                      className={formData.child_id !== '' ? 'bg-gray-100' : ''}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="child_gender">
                    {cf.gender} <span className="text-red-500">*</span>
                  </Label>
                  <Select
                    value={formData.child_gender}
                    onValueChange={(value) => handleSelectChange('child_gender', value)}
                    disabled={!isGuardianInfoComplete || formData.child_id !== '' || isSubmitting}
                  >
                    <SelectTrigger className={formData.child_id !== '' ? 'bg-gray-100' : ''}>
                      <SelectValue placeholder={cf.selectGender} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Male">{cf.male}</SelectItem>
                      <SelectItem value="Female">{cf.female}</SelectItem>
                      <SelectItem value="Other">{cf.other}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Complaint Section */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-800 border-b pb-2">
                  {cf.complaintSection}
                </h3>

                {!isChildBasicInfoComplete && (
                  <p className="text-sm text-amber-600">
                    {cf.completeChildFirst}
                  </p>
                )}

                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={submissionMethod === 'text' ? 'default' : 'outline'}
                    onClick={() => handleSubmissionMethodChange('text')}
                    disabled={!isComplaintSectionEnabled || isSubmitting}
                    className={submissionMethod === 'text' ? 'bg-blue-600' : ''}
                  >
                    <FileText className="mr-2 h-4 w-4" />
                    {cf.textMethod}
                  </Button>
                  <Button
                    type="button"
                    variant={submissionMethod === 'voice' ? 'default' : 'outline'}
                    onClick={() => handleSubmissionMethodChange('voice')}
                    disabled={!isComplaintSectionEnabled || isSubmitting}
                    className={submissionMethod === 'voice' ? 'bg-blue-600' : ''}
                  >
                    <Mic className="mr-2 h-4 w-4" />
                    {cf.voiceMethod}
                  </Button>
                </div>

                {isComplaintSectionEnabled && submissionMethod === 'text' && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>{cf.language}</Label>
                      <Select
                        value={textLanguage}
                        onValueChange={setTextLanguage}
                        disabled={isSubmitting}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={cf.language} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="en-US">{cf.english}</SelectItem>
                          <SelectItem value="si-LK">{cf.sinhala}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="complaint">
                        {cf.complaintDescription} <span className="text-red-500">*</span>
                      </Label>
                      <Textarea
                        id="complaint"
                        name="complaint"
                        value={formData.complaint}
                        onChange={handleInputChange}
                        placeholder={cf.complaintPlaceholder}
                        className={`min-h-[150px] ${
                          complaintValidation && !complaintValidation.isValid
                            ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
                            : complaintValidation?.isValid
                            ? 'border-green-500 focus:border-green-500 focus:ring-green-500'
                            : ''
                        }`}
                        disabled={isSubmitting}
                      />
                      {isValidatingComplaint && (
                        <p className="text-sm text-blue-600 flex items-center gap-1">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          {cf.validatingComplaint}
                        </p>
                      )}
                      {complaintValidation && !complaintValidation.isValid && (
                        <Alert className="border-red-200 bg-red-50">
                          <AlertCircle className="h-4 w-4 text-red-600" />
                          <AlertDescription className="text-red-700">
                            <p className="font-medium mb-1">{complaintValidation.message}</p>
                            {complaintValidation.suggestions.length > 0 && (
                              <ul className="list-disc list-inside text-sm space-y-1 mt-2">
                                {complaintValidation.suggestions.map((suggestion, idx) => (
                                  <li key={idx}>{suggestion}</li>
                                ))}
                              </ul>
                            )}
                          </AlertDescription>
                        </Alert>
                      )}
                      {complaintValidation?.isValid && formData.complaint.trim().length >= 10 && (
                        <p className="text-sm text-green-600 flex items-center gap-1">
                          <CheckCircle className="h-3 w-3" />
                          {cf.complaintLooksGood}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {isComplaintSectionEnabled && submissionMethod === 'voice' && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>{cf.language}</Label>
                      <Select
                        value={voiceLanguage}
                        onValueChange={setVoiceLanguage}
                        disabled={isSubmitting || isTranscribingVoice}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={cf.language} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="en-US">{cf.english}</SelectItem>
                          <SelectItem value="si-LK">{cf.sinhala}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <VoiceRecorder onAudioReady={handleVoiceAudioReady} />

                    <div className="space-y-2">
                      <Label htmlFor="voice_transcript">{cf.transcript}</Label>
                      <Textarea
                        id="voice_transcript"
                        value={voiceTranscript}
                        onChange={(e) => setVoiceTranscript(e.target.value)}
                        placeholder={cf.transcriptPlaceholder}
                        className={`min-h-[100px] ${
                          complaintValidation && !complaintValidation.isValid
                            ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
                            : complaintValidation?.isValid
                            ? 'border-green-500 focus:border-green-500 focus:ring-green-500'
                            : ''
                        }`}
                        disabled={isSubmitting || isTranscribingVoice}
                      />
                      {isTranscribingVoice && (
                        <p className="text-sm text-blue-600">
                          <Loader2 className="inline h-3 w-3 animate-spin mr-1" />
                          {cf.transcribing}
                        </p>
                      )}
                      {voiceConfidence !== null && !isTranscribingVoice && (
                        <p className="text-sm text-green-600">
                          {cf.confidence} {(voiceConfidence * 100).toFixed(0)}%
                        </p>
                      )}
                      {isValidatingComplaint && (
                        <p className="text-sm text-blue-600 flex items-center gap-1">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          {cf.validatingTranscript}
                        </p>
                      )}
                      {complaintValidation && !complaintValidation.isValid && (
                        <Alert className="border-red-200 bg-red-50">
                          <AlertCircle className="h-4 w-4 text-red-600" />
                          <AlertDescription className="text-red-700">
                            <p className="font-medium mb-1">{complaintValidation.message}</p>
                            {complaintValidation.suggestions.length > 0 && (
                              <ul className="list-disc list-inside text-sm space-y-1 mt-2">
                                {complaintValidation.suggestions.map((suggestion, idx) => (
                                  <li key={idx}>{suggestion}</li>
                                ))}
                              </ul>
                            )}
                          </AlertDescription>
                        </Alert>
                      )}
                      {complaintValidation?.isValid && voiceTranscript.trim().length >= 10 && (
                        <p className="text-sm text-green-600 flex items-center gap-1">
                          <CheckCircle className="h-3 w-3" />
                          {cf.transcriptLooksGood}
                        </p>
                      )}
                    </div>

                    {voiceAudioBlob && (
                      <Alert className="border-green-200 bg-green-50">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        <AlertDescription className="text-green-700">
                          {cf.voiceReadyAlert}
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                )}
              </div>

              {/* Usage Metrics (Derived from Analysis) */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-800 border-b pb-2">
                  {cf.usageSection}
                </h3>
                
                {/* Show info when nothing extracted yet */}
                {(!complaintValidation?.extractedHours && !complaintValidation?.extractedDeviceType) && (
                  <p className="text-sm text-amber-600">
                    {cf.usageAutoFillHint || '💡 Mention daily screen time and device used in your complaint description to auto-fill these fields.'}
                  </p>
                )}

                {/* Auto-filled by AI indicator */}
                {(complaintValidation?.extractedHours !== undefined && complaintValidation?.extractedHours !== null ||
                  complaintValidation?.extractedDeviceType) && (
                  <Alert className="border-blue-200 bg-blue-50">
                    <CheckCircle className="h-4 w-4 text-blue-600" />
                    <AlertDescription className="text-blue-700">
                      {cf.autoFilledByAI || '✨ Usage details were automatically extracted from your complaint description.'}
                    </AlertDescription>
                  </Alert>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Daily Hours — read-only, auto-filled */}
                  <div className="space-y-2">
                    <Label htmlFor="hours_per_day_on_social_media">
                      {cf.dailyHours} {formData.hours_per_day_on_social_media ? `(${formData.hours_per_day_on_social_media} ${t.complaintResult.hoursPerDay || 'h/day'})` : ''}
                    </Label>
                    <Input
                      id="hours_per_day_on_social_media"
                      name="hours_per_day_on_social_media"
                      type="text"
                      value={formData.hours_per_day_on_social_media ? `${formData.hours_per_day_on_social_media}` : ''}
                      readOnly
                      placeholder={cf.waitingForDescription || 'Waiting for description...'}
                      className={formData.hours_per_day_on_social_media ? 'bg-green-50 border-green-300 cursor-default' : 'bg-gray-50 cursor-default'}
                    />
                    {formData.hours_per_day_on_social_media && (
                      <p className="text-xs text-green-600">✨ {cf.autoFilledFromDescription || 'Auto-filled from description'}</p>
                    )}
                  </div>

                  {/* Device Type — read-only text input, auto-filled (no dropdown) */}
                  <div className="space-y-2">
                    <Label htmlFor="device_type">
                      {cf.deviceType}
                    </Label>
                    <Input
                      id="device_type"
                      name="device_type"
                      type="text"
                      value={getTranslatedDevice(formData.device_type)}
                      readOnly
                      placeholder={cf.waitingForDescription || 'Waiting for description...'}
                      className={formData.device_type ? 'bg-green-50 border-green-300 cursor-default' : 'bg-gray-50 cursor-default'}
                    />
                    {formData.device_type && (
                      <p className="text-xs text-green-600">✨ {cf.autoFilledFromDescription || 'Auto-filled from description'}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="flex gap-4 pt-4">
                {!isFormReadyToSubmit && formData.complaint.trim().length > 0 && complaintValidation && !complaintValidation.isValid && (
                  <Alert className="w-full border-amber-200 bg-amber-50">
                    <AlertCircle className="h-4 w-4 text-amber-600" />
                    <AlertDescription className="text-amber-700">
                      {cf.fixIssuesFirst}
                    </AlertDescription>
                  </Alert>
                )}
                <Button
                  type="submit"
                  className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                  disabled={isSubmitting || !isFormReadyToSubmit || isTranscribingVoice || isValidatingComplaint}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {cf.submitting}
                    </>
                  ) : (
                    <>
                      <CheckCircle className="mr-2 h-4 w-4" />
                      {cf.submit}
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate('/dashboard')}
                  disabled={isSubmitting}
                >
                  {cf.cancel}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <div className="mt-4 text-center text-sm text-gray-500">
          <p>{cf.confidential}</p>
        </div>
      </div>
    </div>
  );
};

export default ComplaintForm;