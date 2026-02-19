import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { Loader2, AlertCircle, CheckCircle, Mic, FileText } from 'lucide-react';
import { Header } from '@/components/Header';
import { useToast } from '@/hooks/use-toast';
import { VoiceRecorder } from '@/components/VoiceRecorder';

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

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const ComplaintForm = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [children, setChildren] = useState<Child[]>([]);
  const [user, setUser] = useState<any>(null);
  const [submissionMethod, setSubmissionMethod] = useState<SubmissionMethod>('text');
  const [voiceAudioBlob, setVoiceAudioBlob] = useState<Blob | null>(null);
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [voiceLanguage, setVoiceLanguage] = useState('en-US');
  const [isTranscribingVoice, setIsTranscribingVoice] = useState(false);
  const [voiceConfidence, setVoiceConfidence] = useState<number | null>(null);

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

  useEffect(() => {
    const userData = localStorage.getItem('user');
    const token = localStorage.getItem('token');

    if (!userData || !token) {
      navigate('/login');
      return;
    }

    const parsedUser = JSON.parse(userData);
    setUser(parsedUser);
    setFormData(prev => ({
      ...prev,
      guardian_name: parsedUser.name,
      phone_number: parsedUser.phone,
    }));

    fetchChildren();
  }, [navigate]);

  const fetchChildren = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/children`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setChildren(data.children || []);
      }
    } catch (err) {
      console.error('Error fetching children:', err);
    }
  };

  const handleChildSelect = (childId: string) => {
    const selectedChild = children.find(c => c.id === childId);
    if (selectedChild) {
      // Map database gender format to form format
      const genderMap: { [key: string]: string } = {
        'M': 'Male',
        'F': 'Female',
        'Other': 'Other',
        'Male': 'Male',
        'Female': 'Female',
        'male': 'Male',
        'female': 'Female'
      };

      setFormData(prev => ({
        ...prev,
        child_id: childId,
        child_name: selectedChild.name,
        age: selectedChild.age.toString(),
        child_gender: genderMap[selectedChild.gender] || 'Male',
      }));
    }
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setError(null);
  };

  const handleSelectChange = (name: string, value: string) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
    setError(null);
  };

  const transcribeVoiceAudio = async (audioBlob: Blob, languageCode: string) => {
    const token = localStorage.getItem('token');
    if (!token) {
      throw new Error('Please log in again and retry voice transcription');
    }

    const audioMimeType = audioBlob.type || 'audio/webm';
    let fileExtension = 'webm';
    if (audioMimeType.includes('wav')) fileExtension = 'wav';
    else if (audioMimeType.includes('mpeg') || audioMimeType.includes('mp3')) fileExtension = 'mp3';
    else if (audioMimeType.includes('ogg')) fileExtension = 'ogg';
    else if (audioMimeType.includes('flac')) fileExtension = 'flac';

    const audioFile = new File([audioBlob], `voice-complaint.${fileExtension}`, {
      type: audioMimeType,
    });

    const formPayload = new FormData();
    formPayload.append('audio_file', audioFile);
    formPayload.append('language', languageCode);

    const response = await fetch(`${API_BASE_URL}/api/complaints/voice-transcribe`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: formPayload,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      let errorData: Record<string, unknown> = {};
      if (errorText) {
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { error: errorText };
        }
      }

      console.error('Voice transcription request failed', {
        status: response.status,
        statusText: response.statusText,
        response: errorData,
      });

      throw new Error(
        (errorData?.details as string) ||
        (errorData?.error as string) ||
        'Voice transcription failed'
      );
    }

    return response.json();
  };

  const handleVoiceAudioReady = async (audioBlob: Blob) => {
    setVoiceAudioBlob(audioBlob);
    setVoiceTranscript('');
    setVoiceConfidence(null);
    setError(null);

    try {
      setIsTranscribingVoice(true);
      const data = await transcribeVoiceAudio(audioBlob, voiceLanguage);
      setVoiceTranscript(data?.transcript || '');
      const confidenceValue = typeof data?.confidence === 'number' ? data.confidence : null;
      setVoiceConfidence(confidenceValue);

      if (data?.warning) {
        toast({
          title: 'Voice Recording Ready',
          description: `${data.warning} Please type or correct transcript manually before submitting.`,
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Voice Recording Ready',
          description: 'Transcript generated. Please review before submitting.',
        });
      }
    } catch (err) {
      const transcriptionError = err instanceof Error ? err.message : 'Voice transcription failed';
      console.error('Voice transcription error:', err);
      setError(transcriptionError);
      toast({
        title: 'Voice Transcription Error',
        description: transcriptionError,
        variant: 'destructive',
      });
    } finally {
      setIsTranscribingVoice(false);
    }
  };

  const handleSubmissionMethodChange = (method: SubmissionMethod) => {
    setSubmissionMethod(method);
    setError(null);
  };

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
    ? formData.complaint.trim().length > 0
    : !!voiceAudioBlob && voiceTranscript.trim().length > 0;
  const isFormReadyToSubmit = isComplaintSectionEnabled && isComplaintContentReady && !isTranscribingVoice;

  const validateForm = (): boolean => {
    if (!formData.guardian_name.trim()) {
      setError('Guardian/Parent name is required');
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
      setError('Please enter a valid phone number (minimum 10 digits)');
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
    if (submissionMethod === 'voice' && !voiceAudioBlob) {
      setError('Please record an audio complaint before submitting');
      return false;
    }
    if (submissionMethod === 'voice' && !voiceTranscript.trim()) {
      setError('Please provide transcript text for the recorded voice complaint');
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // Get current user from localStorage
      const userData = localStorage.getItem('user');
      const token = localStorage.getItem('token');
      const currentUser = userData ? JSON.parse(userData) : null;

      if (!currentUser || !currentUser._id || !token) {
        setError('User not logged in. Please log in and try again.');
        setIsSubmitting(false);
        return;
      }

      let result: any;

      if (submissionMethod === 'voice') {
        if (!voiceAudioBlob) {
          throw new Error('Please record an audio complaint before submitting');
        }

        const formPayload = new FormData();
        const audioMimeType = voiceAudioBlob.type || 'audio/webm';

        let fileExtension = 'webm';
        if (audioMimeType.includes('wav')) fileExtension = 'wav';
        else if (audioMimeType.includes('mpeg') || audioMimeType.includes('mp3')) fileExtension = 'mp3';
        else if (audioMimeType.includes('ogg')) fileExtension = 'ogg';
        else if (audioMimeType.includes('flac')) fileExtension = 'flac';

        const audioFile = new File([voiceAudioBlob], `voice-complaint.${fileExtension}`, {
          type: audioMimeType,
        });

        formPayload.append('audio_file', audioFile);
        formPayload.append('language', voiceLanguage);
        formPayload.append('guardian_name', formData.guardian_name.trim());
        formPayload.append('child_name', formData.child_name.trim());
        formPayload.append('age', formData.age);
        formPayload.append('phone_number', formData.phone_number.trim());
        formPayload.append('region', formData.region.trim());
        formPayload.append('child_gender', formData.child_gender);
        formPayload.append('hours_per_day_on_social_media', formData.hours_per_day_on_social_media);
        formPayload.append('reporter_role', formData.reporter_role);
        formPayload.append('device_type', formData.device_type);
        formPayload.append('complaint', voiceTranscript.trim());
        if (voiceConfidence !== null) {
          formPayload.append('voice_confidence', String(voiceConfidence));
        }

        const response = await fetch(`${API_BASE_URL}/api/complaints/voice-submit`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
          body: formPayload,
        });

        if (!response.ok) {
          const errorText = await response.text().catch(() => '');
          let errorData: Record<string, unknown> = {};
          if (errorText) {
            try {
              errorData = JSON.parse(errorText);
            } catch {
              errorData = { error: errorText };
            }
          }

          console.error('Voice complaint submission failed', {
            status: response.status,
            statusText: response.statusText,
            response: errorData,
          });

          throw new Error(
            (errorData?.details as string) ||
            (errorData?.error as string) ||
            (errorData?.message as string) ||
            'Failed to submit voice complaint'
          );
        }

        result = await response.json();
        setVoiceAudioBlob(null);
        setVoiceTranscript('');
        setVoiceConfidence(null);

        toast({
          title: 'Voice Complaint Submitted Successfully',
          description: `Risk Assessment: ${result.risk_level}`,
        });
      } else {
        const submissionData = {
          ...formData,
          user_id: currentUser._id,
          age: parseInt(formData.age),
          hours_per_day_on_social_media: parseFloat(formData.hours_per_day_on_social_media),
        };

        const response = await fetch(`${API_BASE_URL}/api/complaints/submit`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(submissionData),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData?.detail || errorData?.error || errorData?.message || 'Failed to submit complaint');
        }

        result = await response.json();
        toast({
          title: 'Complaint Submitted Successfully',
          description: `Risk Assessment: ${result.risk_level}`,
        });
      }

      // Navigate to results page with the complaint data
      navigate('/complaint-result', { state: { result } });

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to submit complaint';
      console.error('Complaint submission error:', err);
      setError(errorMessage);
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      <Header />
      <div className="container mx-auto px-4 py-8 max-w-3xl">
        <Card className="shadow-xl">
          <CardHeader className="space-y-1 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-t-lg">
            <CardTitle className="text-3xl font-bold">Submit Complaint</CardTitle>
            <CardDescription className="text-blue-50">
              Report concerns about your child's social media usage and online safety
            </CardDescription>
          </CardHeader>

          <CardContent className="pt-6">
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
                      Guardian/Parent Name <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="guardian_name"
                      name="guardian_name"
                      value={formData.guardian_name}
                      onChange={handleInputChange}
                      placeholder="Enter your full name"
                      disabled={isSubmitting}
                      required
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
                      placeholder="e.g., +1234567890"
                      type="tel"
                      disabled={isSubmitting}
                      required
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
                    placeholder="City, State, or Country"
                    disabled={isSubmitting}
                    required
                  />
                </div>
              </div>

              {/* Child Information */}
              <div className={`space-y-4 ${!isParentInfoComplete ? 'opacity-60' : ''}`}>
                <h3 className="text-lg font-semibold text-gray-800 border-b pb-2 flex items-center justify-between">
                  Child Information
                  {children.length === 0 && (
                    <Button
                      type="button"
                      variant="link"
                      onClick={() => navigate('/profile')}
                      className="text-sm text-blue-600"
                      disabled={!isParentInfoComplete || isSubmitting}
                    >
                      Add a child first
                    </Button>
                  )}
                </h3>
                {!isParentInfoComplete && (
                  <p className="text-sm text-blue-700">Complete Guardian/Parent Information first.</p>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="child_select">
                      Child Name <span className="text-red-500">*</span>
                    </Label>
                    {children.length > 0 ? (
                      <Select
                        value={formData.child_id}
                        onValueChange={handleChildSelect}
                        disabled={!isParentInfoComplete || isSubmitting}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select child" />
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
                      <Input
                        id="child_name"
                        name="child_name"
                        value={formData.child_name}
                        onChange={handleInputChange}
                        placeholder="Enter child's name"
                        disabled={!isParentInfoComplete || isSubmitting}
                        required
                      />
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
                      placeholder="Child's age"
                      required
                      disabled={!isParentInfoComplete || isSubmitting}
                      readOnly={formData.child_id !== ''}
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
                      required
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
                      placeholder="e.g., 3.5"
                      disabled={!isParentInfoComplete || isSubmitting}
                      required
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
                      required
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
                      Primary Device Used <span className="text-red-500">*</span>
                    </Label>
                    <Select
                      value={formData.device_type}
                      onValueChange={(value) => handleSelectChange('device_type', value)}
                      disabled={!isParentInfoComplete || isSubmitting}
                      required
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select device" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="mobile">Smart Phone</SelectItem>
                        <SelectItem value="tablet">Tablet</SelectItem>
                        <SelectItem value="laptop">Laptop</SelectItem>
                        <SelectItem value="desktop">Desktop </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Complaint */}
              <div className={`space-y-4 ${!isComplaintSectionEnabled ? 'opacity-60' : ''}`}>
                <h3 className="text-lg font-semibold text-gray-800 border-b pb-2">
                  Complaint Details
                </h3>

                {!isComplaintSectionEnabled && (
                  <p className="text-sm text-blue-700">Complete Child Information first.</p>
                )}

                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant={submissionMethod === 'text' ? 'default' : 'outline'}
                    onClick={() => handleSubmissionMethodChange('text')}
                    className={submissionMethod === 'text' ? 'bg-blue-600 hover:bg-blue-700' : ''}
                    disabled={!isComplaintSectionEnabled || isSubmitting}
                  >
                    <FileText className="mr-2 h-4 w-4" />
                    Text Complaint
                  </Button>
                  <Button
                    type="button"
                    variant={submissionMethod === 'voice' ? 'default' : 'outline'}
                    onClick={() => handleSubmissionMethodChange('voice')}
                    className={submissionMethod === 'voice' ? 'bg-blue-600 hover:bg-blue-700' : ''}
                    disabled={!isComplaintSectionEnabled || isSubmitting}
                  >
                    <Mic className="mr-2 h-4 w-4" />
                    Voice Complaint
                  </Button>
                </div>

                {isComplaintSectionEnabled && (
                  <p className="text-sm text-blue-700">
                    {submissionMethod === 'text'
                      ? 'Text mode selected: add complaint description and submit.'
                      : 'Voice mode selected: record voice complaint and submit.'}
                  </p>
                )}

                {isComplaintSectionEnabled && submissionMethod === 'text' ? (
                  <div className="space-y-2">
                    <Label htmlFor="complaint">
                      Complaint Description <span className="text-red-500">*</span>
                    </Label>

                    <Textarea
                      id="complaint"
                      name="complaint"
                      value={formData.complaint}
                      onChange={handleInputChange}
                      placeholder="Please describe your concerns about your child's social media usage, behavior, or any incidents..."
                      className="min-h-[150px] resize-y"
                      disabled={!isComplaintSectionEnabled || isSubmitting}
                      required={submissionMethod === 'text'}
                    />
                  </div>
                ) : isComplaintSectionEnabled ? (
                  <div className="space-y-3">
                    <div className="space-y-2">
      
                      <Select
                        value={voiceLanguage}
                        onValueChange={setVoiceLanguage}
                        disabled={isSubmitting || isTranscribingVoice}
                      >
                      </Select>
                    </div>
                    <VoiceRecorder onAudioReady={handleVoiceAudioReady} className="border border-blue-100" />
                    <div className="space-y-2">
                      <Label htmlFor="voice_transcript">Transcript Preview</Label>
                      <Textarea
                        id="voice_transcript"
                        value={voiceTranscript}
                        onChange={(e) => setVoiceTranscript(e.target.value)}
                        placeholder="Transcript will appear here after recording..."
                        className="min-h-[120px] resize-y"
                        disabled={isSubmitting || isTranscribingVoice}
                      />
                      {isTranscribingVoice && (
                        <p className="text-xs text-blue-700">Generating transcript from recording...</p>
                      )}
                      {voiceConfidence !== null && !isTranscribingVoice && (
                        <p className="text-xs text-blue-700">Transcript confidence: {(voiceConfidence * 100).toFixed(0)}%</p>
                      )}
                      <p className="text-xs text-gray-500">
                        Review and correct transcript text before submitting for best accuracy.
                      </p>
                    </div>
                    {voiceAudioBlob && (
                      <Alert className="border-blue-200 bg-blue-50">
                        <CheckCircle className="h-4 w-4 text-blue-700" />
                        <AlertDescription className="text-blue-800">
                          Voice recording attached. Submit the form to run risk analysis.
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                ) : null}
              </div>

              {/* Submit Button */}
              <div className="flex gap-4 pt-4">
                <Button
                  type="submit"
                  className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                  disabled={isSubmitting || !isFormReadyToSubmit}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Analyzing...
                    </>
                  ) : isTranscribingVoice ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Transcribing...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="mr-2 h-4 w-4" />
                      {submissionMethod === 'text' ? 'Submit Text Complaint' : 'Submit Voice Complaint'}
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

        <div className="mt-6 text-center text-sm text-gray-600">
          <p>
            Your information will be kept confidential and used only for risk assessment purposes.
          </p>
        </div>
      </div>
    </div>
  );
};

export default ComplaintForm;
