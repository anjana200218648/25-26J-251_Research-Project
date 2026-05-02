import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Alert, AlertDescription } from '../components/ui/alert';
import VoiceRecorderAdvanced from '../components/VoiceRecorderAdvanced';
import { Mic, CheckCircle, AlertCircle, ArrowLeft, Shield, Volume2 } from 'lucide-react';
import { API_BASE_URL } from '../config/api';

const VoiceEnrollment: React.FC = () => {
  const navigate = useNavigate();
  const [enrollmentStatus, setEnrollmentStatus] = useState<'not-started' | 'recording' | 'uploading' | 'success' | 'error'>('not-started');
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [duration, setDuration] = useState<number>(0);
  const [error, setError] = useState<string>('');
  const [alreadyEnrolled, setAlreadyEnrolled] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [phrase, setPhrase] = useState<string>('');

  useEffect(() => {
    checkEnrollmentStatus();
    fetchPhrase();
  }, []);

  const checkEnrollmentStatus = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        navigate('/login');
        return;
      }

      const response = await fetch(`${API_BASE_URL}/voice-auth/enrollment/status`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setAlreadyEnrolled(data.enrolled);
      }
    } catch (err) {
      console.error('Failed to check enrollment status:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchPhrase = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/voice-auth/login/get-phrase`);
      const data = await response.json();
      if (response.ok && data.phrase) {
        setPhrase(data.phrase);
      }
    } catch (err) {
      console.error('Failed to fetch phrase:', err);
      // Use a default phrase if fetch fails
      setPhrase('මම අද පද්ධතියට පිවිසෙමි');
    }
  };

  const speakPhrase = () => {
    if ('speechSynthesis' in window && phrase) {
      const utterance = new SpeechSynthesisUtterance(phrase);
      utterance.lang = 'si-LK';
      window.speechSynthesis.speak(utterance);
    }
  };

  const handleRecordingComplete = (blob: Blob, recordingDuration: number) => {
    setAudioBlob(blob);
    setDuration(recordingDuration);
    setEnrollmentStatus('recording');
  };

  const handleSubmitEnrollment = async () => {
    if (!audioBlob) {
      setError('No recording found. Please record your voice first.');
      return;
    }

    setEnrollmentStatus('uploading');
    setError('');

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        navigate('/login');
        return;
      }

      const formData = new FormData();
      const extension = audioBlob.type.split("/")[1] || "webm";

const file = new File([audioBlob], `recording.${extension}`, {
  type: audioBlob.type,
});

formData.append("audio", file);

      const response = await fetch(`${API_BASE_URL}/voice-auth/enrollment/submit`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      const data = await response.json();

      if (response.ok) {
        setEnrollmentStatus('success');
        // Redirect to dashboard after 3 seconds
        setTimeout(() => {
          navigate('/dashboard');
        }, 3000);
      } else {
        setError(data.error || 'Enrollment failed. Please try again.');
        setEnrollmentStatus('error');
      }
    } catch (err) {
      console.error('Enrollment error:', err);
      setError('Network error. Please check your connection and try again.');
      setEnrollmentStatus('error');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="flex items-center justify-center mb-4">
            <Shield className="w-16 h-16 text-blue-600" />
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Voice Enrollment
          </h1>
          <p className="text-gray-600">
            Secure your account with voice biometric authentication
          </p>
        </div>

        {/* Back Button */}
        <Button
          variant="ghost"
          onClick={() => navigate('/dashboard')}
          className="mb-6"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Dashboard
        </Button>

        {/* Already Enrolled Notice */}
        {alreadyEnrolled && (
          <Alert className="mb-6 border-blue-600 bg-blue-50">
            <CheckCircle className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-blue-800">
              You are already enrolled in voice authentication. You can re-enroll to update your voice profile.
            </AlertDescription>
          </Alert>
        )}

        {/* Main Content */}
        <Card className="shadow-xl">
          <CardHeader>
            <CardTitle className="text-2xl">Enroll Your Voice</CardTitle>
            <CardDescription>
              Record a 5-second voice sample to enable voice authentication
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Instructions */}
            <Alert className="border-blue-600 bg-blue-50">
              <Mic className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-800">
                Read the following phrase clearly to enroll your voice
              </AlertDescription>
            </Alert>

            {/* Display Phrase */}
            {phrase && (
              <Card className="bg-gradient-to-br from-blue-100 to-indigo-100 border-2 border-blue-300">
                <CardContent className="pt-6">
                  <div className="text-center space-y-4">
                    <div className="flex items-center justify-center space-x-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={speakPhrase}
                        className="text-blue-600"
                        type="button"
                      >
                        <Volume2 className="w-5 h-5" />
                      </Button>
                    </div>
                    <p className="text-xl font-bold text-blue-900 leading-relaxed">
                      {phrase}
                    </p>
                    <p className="text-sm text-blue-700">
                      (Read this phrase aloud when recording)
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="bg-blue-50 p-4 rounded-lg space-y-2">
              <h3 className="font-semibold text-blue-900 flex items-center">
                <Mic className="w-5 h-5 mr-2" />
                Instructions
              </h3>
              <ul className="text-sm text-blue-800 space-y-1 ml-7 list-disc">
                <li>Find a quiet environment</li>
                <li>Read the phrase shown above clearly</li>
                <li>Record for at least 5 seconds</li>
                <li>Speak clearly and at normal volume</li>
              </ul>
            </div>

            {/* Voice Recorder */}
            {enrollmentStatus !== 'success' && (
              <VoiceRecorderAdvanced
                onRecordingComplete={handleRecordingComplete}
                minDuration={5}
                maxDuration={15}
                disabled={enrollmentStatus === 'uploading'}
              />
            )}

            {/* Submit Button */}
            {audioBlob && (enrollmentStatus === 'recording' || enrollmentStatus === 'uploading') && (
              <div className="space-y-4">
                <Alert className="border-green-600 bg-green-50">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-800">
                    Recording completed! Duration: {duration.toFixed(1)} seconds
                  </AlertDescription>
                </Alert>
                <Button
                  onClick={handleSubmitEnrollment}
                  disabled={enrollmentStatus === 'uploading'}
                  className="w-full"
                  size="lg"
                >
                  {enrollmentStatus === 'uploading' ? (
                    <>
                      <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full mr-2"></div>
                      Processing...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-5 h-5 mr-2" />
                      Complete Enrollment
                    </>
                  )}
                </Button>
              </div>
            )}

            {/* Error Message */}
            {error && enrollmentStatus === 'error' && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Success Message */}
            {enrollmentStatus === 'success' && (
              <div className="text-center space-y-4 py-8">
                <div className="flex justify-center">
                  <CheckCircle className="w-20 h-20 text-green-600" />
                </div>
                <h3 className="text-2xl font-bold text-green-600">
                  Enrollment Successful!
                </h3>
                <p className="text-gray-600">
                  Your voice has been securely enrolled.
                </p>
                <p className="text-sm text-gray-500">
                  Redirecting to dashboard...
                </p>
              </div>
            )}

            {/* Security Notice */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="font-semibold text-gray-900 mb-2 flex items-center text-sm">
                <Shield className="w-4 h-4 mr-2" />
                Privacy & Security
              </h4>
              <p className="text-xs text-gray-600">
                Your voice data is encrypted and securely stored. We only store a mathematical representation (embedding) of your voice, not the actual audio. This ensures your privacy while maintaining strong security.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default VoiceEnrollment;
