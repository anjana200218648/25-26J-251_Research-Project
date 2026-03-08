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
      console.log('📦 Received data from upload:', uploadData);
      
      // Store the uploaded file data in sessionStorage for later use
      if (uploadData.uploadedFile) {
        const reader = new FileReader();
        reader.onloadend = () => {
          sessionStorage.setItem('uploadedImage', reader.result as string);
          sessionStorage.setItem('uploadedFileName', uploadData.uploadedFile.name);
          console.log('✅ Image saved to sessionStorage');
        };
        reader.readAsDataURL(uploadData.uploadedFile);
      }
      
      if (uploadData.formData) {
        console.log('📝 Form data from upload:', uploadData.formData);
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

  // Load user data and fetch children on component mount
  useEffect(() => {
    const userData = localStorage.getItem('user');
    const token = localStorage.getItem('token');

    console.log('🔍 Component mounted');
    console.log('🔍 User data exists:', !!userData);
    console.log('🔍 Token exists:', !!token);

    if (!userData || !token) {
      console.log('🔍 No user/token, redirecting to login');
      navigate('/login');
      return;
    }

    try {
      const parsedUser = JSON.parse(userData);
      console.log('🔍 Parsed user:', parsedUser);
      setUser(parsedUser);
      
      setFormData(prev => ({
        ...prev,
        guardian_name: parsedUser.name || '',
        phone_number: parsedUser.phone || '',
      }));

      // Fetch children immediately
      fetchChildren();
    } catch (error) {
      console.error('❌ Error parsing user data:', error);
      navigate('/login');
    }
  }, [navigate]);

  // Function to fetch children from backend
  const fetchChildren = async () => {
    const token = localStorage.getItem('token');
    
    if (!token) {
      console.error('❌ No token found');
      return;
    }

    setIsLoadingChildren(true);
    setError(null);

    try {
      console.log('🔍 Fetching children from:', `${API_BASE_URL}/api/children`);
      
      const response = await fetch(`${API_BASE_URL}/api/children`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      console.log('📥 Response status:', response.status);

      if (response.status === 401) {
        console.error('❌ Unauthorized - Token expired');
        toast({
          title: 'Session Expired',
          description: 'Please login again',
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
      console.log('📦 Children data received:', data);

      // Handle different response formats
      let childrenArray: Child[] = [];
      
      if (Array.isArray(data)) {
        childrenArray = data;
        console.log('✅ Data is array with', data.length, 'children');
      } else if (data.children && Array.isArray(data.children)) {
        childrenArray = data.children;
        console.log('✅ Data has children array with', data.children.length, 'children');
      } else {
        console.log('⚠️ Unexpected data format:', data);
        childrenArray = [];
      }

      setChildren(childrenArray);

      if (childrenArray.length === 0) {
        toast({
          title: 'No Children Found',
          description: 'Please add children in Profile page first.',
          variant: 'default',
        });
      } else {
        console.log('✅ Children loaded successfully:', childrenArray);
      }

    } catch (err) {
      console.error('❌ Error fetching children:', err);
      setError('Failed to load children. Please try refreshing.');
      toast({
        title: 'Error',
        description: 'Failed to load children from server',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingChildren(false);
    }
  };

  // Handle child selection
  const handleChildSelect = (childId: string) => {
    console.log('🔍 Selected child ID:', childId);
    
    const selectedChild = children.find(c => c.id === childId);
    
    if (selectedChild) {
      console.log('✅ Found child:', selectedChild);
      
      // Map gender from database format to form format
      let mappedGender = 'Male'; // Default
      
      if (selectedChild.gender === 'M' || selectedChild.gender === 'Male' || selectedChild.gender === 'male') {
        mappedGender = 'Male';
      } else if (selectedChild.gender === 'F' || selectedChild.gender === 'Female' || selectedChild.gender === 'female') {
        mappedGender = 'Female';
      } else if (selectedChild.gender === 'Other' || selectedChild.gender === 'other') {
        mappedGender = 'Other';
      }

      console.log('🔄 Mapping gender:', selectedChild.gender, '->', mappedGender);

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
        title: 'Child Selected',
        description: `${selectedChild.name} (Age: ${selectedChild.age})`,
      });
    } else {
      console.log('❌ Child not found with ID:', childId);
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
        title: 'Voice Recording Ready',
        description: 'Transcript generated. Please review before submitting.',
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Voice transcription failed';
      console.error('Voice transcription error:', err);
      setError(errorMessage);
      toast({
        title: 'Voice Transcription Error',
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

    setIsValidatingComplaint(true);

    try {
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

      setComplaintValidation({
        isValid: data.valid,
        message: data.message || '',
        suggestions: data.suggestions || [],
      });
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
  }, [formData.complaint, formData.age, formData.child_gender, formData.hours_per_day_on_social_media, formData.device_type, formData.reporter_role, submissionMethod, textLanguage]);

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
  }, [voiceTranscript, formData.age, formData.child_gender, formData.hours_per_day_on_social_media, formData.device_type, formData.reporter_role, submissionMethod, voiceLanguage]);

  // Validation helpers
  const ageValue = parseInt(formData.age);
  const hoursValue = parseFloat(formData.hours_per_day_on_social_media);

  const isParentInfoComplete =
    formData.guardian_name.trim().length > 0 &&
    formData.phone_number.trim().length >= 10 &&
    formData.region.trim().length > 0;

  const isChildInfoComplete =
    formData.child_name.trim().length > 0 &&
    !Number.isNaN(ageValue) &&
    ageValue >= 10 &&
    ageValue <= 18 &&
    formData.child_gender.trim().length > 0 &&
    !Number.isNaN(hoursValue) &&
    hoursValue >= 0 &&
    hoursValue <= 24 &&
    formData.reporter_role.trim().length > 0 &&
    formData.device_type.trim().length > 0;

  const isComplaintSectionEnabled = isParentInfoComplete && isChildInfoComplete;
  const isComplaintContentReady = submissionMethod === 'text'
    ? formData.complaint.trim().length > 0 && complaintValidation?.isValid === true
    : !!voiceAudioBlob && voiceTranscript.trim().length > 0 && complaintValidation?.isValid === true;
  const isFormReadyToSubmit = isComplaintSectionEnabled && isComplaintContentReady && !isTranscribingVoice && !isValidatingComplaint;

  // Validate form
  const validateForm = (): boolean => {
    if (!formData.guardian_name.trim()) {
      setError('Guardian name is required');
      return false;
    }
    if (!formData.child_name.trim()) {
      setError("Child's name is required");
      return false;
    }
    const age = parseInt(formData.age);
    if (!formData.age || age < 10 || age > 18) {
      setError('Please enter a valid age (10-18)');
      return false;
    }
    if (!formData.phone_number.trim() || formData.phone_number.length < 10) {
      setError('Please enter a valid phone number');
      return false;
    }
    if (!formData.region.trim()) {
      setError('Region is required');
      return false;
    }
    if (submissionMethod === 'text' && !formData.complaint.trim()) {
      setError('Please enter a complaint');
      return false;
    }
    if (submissionMethod === 'text' && complaintValidation && !complaintValidation.isValid) {
      setError('Please fix the issues in your complaint description before submitting');
      return false;
    }
    if (submissionMethod === 'voice' && !voiceAudioBlob) {
      setError('Please record an audio complaint');
      return false;
    }
    if (submissionMethod === 'voice' && !voiceTranscript.trim()) {
      setError('Please provide transcript text');
      return false;
    }
    if (submissionMethod === 'voice' && complaintValidation && !complaintValidation.isValid) {
      setError('Please fix the issues in your voice transcript before submitting');
      return false;
    }
    if (!formData.child_gender) {
      setError('Please select child gender');
      return false;
    }
    const hours = parseFloat(formData.hours_per_day_on_social_media);
    if (!formData.hours_per_day_on_social_media || hours < 0 || hours > 24) {
      setError('Please enter valid hours (0-24)');
      return false;
    }
    if (!formData.reporter_role) {
      setError('Please select your role');
      return false;
    }
    if (!formData.device_type) {
      setError('Please select device type');
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
        title: 'Success',
        description: 'Complaint submitted successfully',
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
        title: 'Error',
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
            <CardTitle className="text-3xl font-bold">Submit Complaint</CardTitle>
            <CardDescription className="text-blue-50">
              Report concerns about your child's social media usage and online safety
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
                  Guardian/Parent Information
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="guardian_name">
                      Full Name <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="guardian_name"
                      name="guardian_name"
                      value={formData.guardian_name}
                      onChange={handleInputChange}
                      placeholder="Enter your full name"
                      disabled={isSubmitting}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone_number">
                      Phone Number <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="phone_number"
                      name="phone_number"
                      value={formData.phone_number}
                      onChange={handleInputChange}
                      placeholder="Enter phone number"
                      type="tel"
                      disabled={isSubmitting}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="region">
                    Region <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="region"
                    name="region"
                    value={formData.region}
                    onChange={handleInputChange}
                    placeholder="City, District, or Province"
                    disabled={isSubmitting}
                  />
                </div>
              </div>

              {/* Child Information */}
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b pb-2">
                  <h3 className="text-lg font-semibold text-gray-800">
                    Child Information
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
                    Refresh
                  </Button>
                </div>

                {!isParentInfoComplete && (
                  <p className="text-sm text-amber-600">
                    ⚠️ Complete guardian information first
                  </p>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="child_select">
                      Select Child <span className="text-red-500">*</span>
                    </Label>
                    
                    {isLoadingChildren ? (
                      <div className="flex items-center space-x-2 h-10 px-3 border rounded-md bg-gray-50">
                        <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                        <span className="text-sm text-gray-600">Loading children...</span>
                      </div>
                    ) : children.length > 0 ? (
                      <Select
                        value={formData.child_id}
                        onValueChange={handleChildSelect}
                        disabled={!isParentInfoComplete || isSubmitting}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Choose a child" />
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
                          placeholder="Enter child's name"
                          disabled={!isParentInfoComplete || isSubmitting}
                        />
                        <p className="text-xs text-amber-600">
                          No saved children found. Enter name manually or{' '}
                          <button
                            type="button"
                            onClick={() => navigate('/profile', { state: { activeTab: 'children' } })}
                            className="text-blue-600 hover:underline"
                          >
                            add children in Profile
                          </button>
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="age">
                      Age <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="age"
                      name="age"
                      type="number"
                      min="10"
                      max="18"
                      value={formData.age}
                      onChange={handleInputChange}
                      placeholder="10-18"
                      disabled={!isParentInfoComplete || isSubmitting || formData.child_id !== ''}
                      className={formData.child_id !== '' ? 'bg-gray-100' : ''}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="child_gender">
                      Gender <span className="text-red-500">*</span>
                    </Label>
                    <Select
                      value={formData.child_gender}
                      onValueChange={(value) => handleSelectChange('child_gender', value)}
                      disabled={!isParentInfoComplete || formData.child_id !== '' || isSubmitting}
                    >
                      <SelectTrigger className={formData.child_id !== '' ? 'bg-gray-100' : ''}>
                        <SelectValue placeholder="Select gender" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Male">Male</SelectItem>
                        <SelectItem value="Female">Female</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="hours_per_day_on_social_media">
                      Daily Social Media Hours <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="hours_per_day_on_social_media"
                      name="hours_per_day_on_social_media"
                      type="number"
                      min="0"
                      max="24"
                      step="0.5"
                      value={formData.hours_per_day_on_social_media}
                      onChange={handleInputChange}
                      placeholder="e.g., 2.5"
                      disabled={!isParentInfoComplete || isSubmitting}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="reporter_role">
                      Your Role <span className="text-red-500">*</span>
                    </Label>
                    <Select
                      value={formData.reporter_role}
                      onValueChange={(value) => handleSelectChange('reporter_role', value)}
                      disabled={!isParentInfoComplete || isSubmitting}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select role" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="guardian">Guardian</SelectItem>
                        <SelectItem value="mother">Mother</SelectItem>
                        <SelectItem value="father">Father</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="device_type">
                      Device Type <span className="text-red-500">*</span>
                    </Label>
                    <Select
                      value={formData.device_type}
                      onValueChange={(value) => handleSelectChange('device_type', value)}
                      disabled={!isParentInfoComplete || isSubmitting}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select device" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="mobile">Smartphone</SelectItem>
                        <SelectItem value="tablet">Tablet</SelectItem>
                        <SelectItem value="laptop">Laptop</SelectItem>
                        <SelectItem value="desktop">Desktop</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Complaint Section */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-800 border-b pb-2">
                  Complaint Details
                </h3>

                {!isComplaintSectionEnabled && (
                  <p className="text-sm text-amber-600">
                    ⚠️ Complete all child information first
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
                    Text
                  </Button>
                  <Button
                    type="button"
                    variant={submissionMethod === 'voice' ? 'default' : 'outline'}
                    onClick={() => handleSubmissionMethodChange('voice')}
                    disabled={!isComplaintSectionEnabled || isSubmitting}
                    className={submissionMethod === 'voice' ? 'bg-blue-600' : ''}
                  >
                    <Mic className="mr-2 h-4 w-4" />
                    Voice
                  </Button>
                </div>

                {isComplaintSectionEnabled && submissionMethod === 'text' && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Language</Label>
                      <Select
                        value={textLanguage}
                        onValueChange={setTextLanguage}
                        disabled={isSubmitting}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select language" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="en-US">English (US)</SelectItem>
                          <SelectItem value="si-LK">Sinhala</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="complaint">
                        Complaint Description <span className="text-red-500">*</span>
                      </Label>
                      <Textarea
                        id="complaint"
                        name="complaint"
                        value={formData.complaint}
                        onChange={handleInputChange}
                        placeholder="Describe your concerns about your child's social media usage, behavior changes, or any issues you've noticed..."
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
                          Validating complaint text...
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
                          Complaint description looks good
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {isComplaintSectionEnabled && submissionMethod === 'voice' && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Language</Label>
                      <Select
                        value={voiceLanguage}
                        onValueChange={setVoiceLanguage}
                        disabled={isSubmitting || isTranscribingVoice}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select language" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="en-US">English (US)</SelectItem>
                          <SelectItem value="si-LK">Sinhala</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <VoiceRecorder onAudioReady={handleVoiceAudioReady} />

                    <div className="space-y-2">
                      <Label htmlFor="voice_transcript">Transcript</Label>
                      <Textarea
                        id="voice_transcript"
                        value={voiceTranscript}
                        onChange={(e) => setVoiceTranscript(e.target.value)}
                        placeholder="Transcript will appear here..."
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
                          Transcribing...
                        </p>
                      )}
                      {voiceConfidence !== null && !isTranscribingVoice && (
                        <p className="text-sm text-green-600">
                          Confidence: {(voiceConfidence * 100).toFixed(0)}%
                        </p>
                      )}
                      {isValidatingComplaint && (
                        <p className="text-sm text-blue-600 flex items-center gap-1">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          Validating transcript...
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
                          Transcript looks good
                        </p>
                      )}
                    </div>

                    {voiceAudioBlob && (
                      <Alert className="border-green-200 bg-green-50">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        <AlertDescription className="text-green-700">
                          Voice recording ready for submission
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                )}
              </div>

              {/* Submit Buttons */}
              <div className="flex gap-4 pt-4">
                {!isFormReadyToSubmit && formData.complaint.trim().length > 0 && complaintValidation && !complaintValidation.isValid && (
                  <Alert className="w-full border-amber-200 bg-amber-50">
                    <AlertCircle className="h-4 w-4 text-amber-600" />
                    <AlertDescription className="text-amber-700">
                      Please fix the complaint description issues before submitting.
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
                      Submitting...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="mr-2 h-4 w-4" />
                      Submit Complaint
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate('/dashboard')}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <div className="mt-4 text-center text-sm text-gray-500">
          <p>Your information is kept confidential and secure</p>
        </div>
      </div>
    </div>
  );
};

export default ComplaintForm;