import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Alert, AlertDescription } from '../components/ui/alert';
import VoiceRecorderAdvanced from '../components/VoiceRecorderAdvanced';
import { Mic, Volume2, CheckCircle, AlertCircle, Shield, Loader2 } from 'lucide-react';
import { API_BASE_URL } from '../config/api';

const VoiceLogin: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState<string>('');
  const [phrase, setPhrase] = useState<string>('');
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [status, setStatus] = useState<'email' | 'phrase' | 'recording' | 'authenticating' | 'success' | 'error'>('email');
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError('Email is required');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Get random phrase from backend
      const response = await fetch(`${API_BASE_URL}/voice-auth/login/get-phrase`);
      const data = await response.json();

      if (response.ok) {
        setPhrase(data.phrase);
        setStatus('phrase');
      } else {
        setError('Failed to load verification phrase');
      }
    } catch (err) {
      console.error('Error getting phrase:', err);
      setError('Network error. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  const handleStartRecording = () => {
    setStatus('recording');
    setError('');
  };

  const handleRecordingComplete = (blob: Blob, duration: number) => {
    setAudioBlob(blob);
  };

  const handleSubmitAuthentication = async () => {
    if (!audioBlob) {
      setError('Please record your voice first');
      return;
    }

    setStatus('authenticating');
    setError('');

    try {
      const formData = new FormData();
      formData.append('email', email);
      formData.append('phrase', phrase);
      const extension = audioBlob.type.split("/")[1] || "webm";

const file = new File([audioBlob], `recording.${extension}`, {
  type: audioBlob.type,
});

formData.append("audio", file);

      const response = await fetch(`${API_BASE_URL}/voice-auth/login/voice-authenticate`, {
        method: 'POST',
        body: formData
      });

      const data = await response.json();

      if (response.ok && data.authenticated) {
        // Store authentication data
        localStorage.setItem('token', data.session_token);
        localStorage.setItem('user', JSON.stringify(data.user));
        localStorage.setItem('voiceSessionToken', data.session_token);
        
        setStatus('success');
        
        // Redirect to dashboard after 2 seconds
        setTimeout(() => {
          navigate('/dashboard');
        }, 2000);
      } else {
        setError(data.message || 'Voice authentication failed. Please try again.');
        setStatus('error');
        
        // Reset to phrase state to allow retry
        setTimeout(() => {
          setStatus('phrase');
          setAudioBlob(null);
        }, 3000);
      }
    } catch (err) {
      console.error('Authentication error:', err);
      setError('Network error. Please check your connection and try again.');
      setStatus('error');
    }
  };

  const speakPhrase = () => {
    // Use Web Speech API to speak the phrase (if supported)
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(phrase);
      utterance.lang = 'si-LK'; // Sinhala
      window.speechSynthesis.speak(utterance);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center py-12 px-4">
      <div className="max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <Shield className="w-16 h-16 text-blue-600" />
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Voice Login
          </h1>
          <p className="text-gray-600">
            Secure biometric authentication
          </p>
        </div>

        <Card className="shadow-xl">
          <CardHeader>
            <CardTitle className="text-2xl">Authenticate with Voice</CardTitle>
            <CardDescription>
              {status === 'email' && 'Enter your email to begin'}
              {status === 'phrase' && 'Read the phrase aloud to verify your identity'}
              {status === 'recording' && 'Recording your voice...'}
              {status === 'authenticating' && 'Verifying your identity...'}
              {status === 'success' && 'Login successful!'}
              {status === 'error' && 'Authentication failed'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Step 1: Email Input */}
            {status === 'email' && (
              <form onSubmit={handleEmailSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="your.email@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full"
                  disabled={loading}
                  size="lg"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    'Continue'
                  )}
                </Button>
              </form>
            )}

            {/* Step 2: Display Phrase */}
            {status === 'phrase' && (
              <div className="space-y-4">
                <Alert className="border-blue-600 bg-blue-50">
                  <Mic className="h-4 w-4 text-blue-600" />
                  <AlertDescription className="text-blue-800">
                    Please read the following phrase clearly when recording
                  </AlertDescription>
                </Alert>

                <Card className="bg-gradient-to-br from-blue-100 to-indigo-100 border-2 border-blue-300">
                  <CardContent className="pt-6">
                    <div className="text-center space-y-4">
                      <div className="flex items-center justify-center space-x-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={speakPhrase}
                          className="text-blue-600"
                        >
                          <Volume2 className="w-5 h-5" />
                        </Button>
                      </div>
                      <p className="text-2xl font-bold text-blue-900 leading-relaxed">
                        {phrase}
                      </p>
                    </div>
                  </CardContent>
                </Card>

                <Button
                  onClick={handleStartRecording}
                  className="w-full"
                  size="lg"
                >
                  <Mic className="w-5 h-5 mr-2" />
                  Start Recording
                </Button>
              </div>
            )}

            {/* Step 3: Voice Recording */}
            {status === 'recording' && (
              <div className="space-y-4">
                <Alert className="border-blue-600 bg-blue-50">
                  <AlertDescription className="text-blue-800 font-medium">
                    Read: "{phrase}"
                  </AlertDescription>
                </Alert>

                <VoiceRecorderAdvanced
                  onRecordingComplete={handleRecordingComplete}
                  minDuration={3}
                  maxDuration={10}
                />

                {audioBlob && (
                  <Button
                    onClick={handleSubmitAuthentication}
                    className="w-full"
                    size="lg"
                  >
                    <CheckCircle className="w-5 h-5 mr-2" />
                    Verify Identity
                  </Button>
                )}
              </div>
            )}

            {/* Step 4: Authenticating */}
            {status === 'authenticating' && (
              <div className="text-center py-8 space-y-4">
                <Loader2 className="w-16 h-16 text-blue-600 animate-spin mx-auto" />
                <h3 className="text-xl font-semibold text-gray-900">
                  Verifying Your Identity
                </h3>
                <p className="text-gray-600">
                  Analyzing voice biometrics and phrase verification...
                </p>
              </div>
            )}

            {/* Step 5: Success */}
            {status === 'success' && (
              <div className="text-center py-8 space-y-4">
                <CheckCircle className="w-20 h-20 text-green-600 mx-auto" />
                <h3 className="text-2xl font-bold text-green-600">
                  Login Successful!
                </h3>
                <p className="text-gray-600">
                  Voice authentication verified. Redirecting to dashboard...
                </p>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Alternative Login */}
            <div className="text-center text-sm">
              <Link
                to="/login"
                className="text-blue-600 hover:underline"
              >
                Use standard login instead
              </Link>
            </div>

            {/* Security Notice */}
            <div className="bg-gray-50 p-3 rounded-lg">
              <p className="text-xs text-gray-600 text-center">
                <Shield className="w-3 h-3 inline mr-1" />
                Your voice data is encrypted and processed securely
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Back to Regular Login */}
        <div className="mt-6 text-center">
          <Link
            to="/register"
            className="text-sm text-gray-600 hover:text-gray-900"
          >
            Don't have an account? Register here
          </Link>
        </div>
      </div>
    </div>
  );
};

export default VoiceLogin;
