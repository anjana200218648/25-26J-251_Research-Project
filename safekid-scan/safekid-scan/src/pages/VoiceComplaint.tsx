import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Alert, AlertDescription } from '../components/ui/alert';
import VoiceRecorderAdvanced from '../components/VoiceRecorderAdvanced';
import { Mic, CheckCircle, AlertCircle, Shield, Loader2, ArrowLeft, FileText } from 'lucide-react';
import { API_BASE_URL } from '../config/api';

const VoiceComplaint: React.FC = () => {
  const navigate = useNavigate();
  const [sessionValid, setSessionValid] = useState<boolean>(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const audioPrevUrlRef = useRef<string>('');
  const [audioUrl, setAudioUrl] = useState<string>('');
  const [status, setStatus] = useState<'idle' | 'recording' | 'uploading' | 'success' | 'error'>('idle');
  const [error, setError] = useState<string>('');
  const [transcribedText, setTranscribedText] = useState<string>('');
  const [complaintId, setComplaintId] = useState<number | null>(null);
  const [verificationDetails, setVerificationDetails] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedLanguage, setSelectedLanguage] = useState<string>('auto');
  const speakerRetryRef = useRef<number>(0);

  // ── Session validation ───────────────────────────────────────────────
  useEffect(() => {
    validateSession();
  }, []);

  const validateSession = async (): Promise<boolean> => {
    try {
      const sessionToken = localStorage.getItem('voiceSessionToken');
      if (!sessionToken) {
        setError('No active voice session. Please login with voice authentication.');
        setLoading(false);
        return false;
      }
      const response = await fetch(`${API_BASE_URL}/voice-auth/session/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_token: sessionToken }),
      });
      const data = await response.json();
      if (response.ok && data.valid) {
        setSessionValid(true);
        setLoading(false);
        return true;
      } else {
        setError('Voice session expired. Redirecting to login...');
        setTimeout(() => navigate('/voice-login'), 3000);
        setLoading(false);
        return false;
      }
    } catch (err) {
      console.error('[VoiceComplaint] Session validation error:', err);
      setError('Failed to validate session.');
      setLoading(false);
      return false;
    }
  };

  // ── Audio preview management ─────────────────────────────────────────
  useEffect(() => {
    if (audioBlob) {
      if (audioPrevUrlRef.current) URL.revokeObjectURL(audioPrevUrlRef.current);
      const url = URL.createObjectURL(audioBlob);
      audioPrevUrlRef.current = url;
      setAudioUrl(url);
    }

    return () => {
      if (audioPrevUrlRef.current) URL.revokeObjectURL(audioPrevUrlRef.current);
      audioPrevUrlRef.current = '';
    };
  }, [audioBlob]);

  const handleRecordingComplete = (blob: Blob, _duration?: number) => {
    if (!blob || blob.size < 1000) { // 1KB minimal check (WebM/Opus can be small)
      setError('Recording too short. Please record at least 2 seconds of speech.');
      return;
    }
    setAudioBlob(blob);
    setStatus('recording');
    setError('');
  };

  // ── Submit complaint ─────────────────────────────────────────────────
  const submitLiveComplaint = async (blob: Blob) => {
    setStatus('uploading');
    setError('');

    try {
      const sessionToken = localStorage.getItem('voiceSessionToken');
      if (!sessionToken) {
        setError('Session expired. Please log in again.');
        navigate('/voice-login');
        return;
      }

      const sessionCheck = await fetch(`${API_BASE_URL}/voice-auth/session/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_token: sessionToken }),
      });
      const sessionData = await sessionCheck.json();
      if (!sessionData.valid) {
        setError('Session expired before submission. Redirecting...');
        setTimeout(() => navigate('/voice-login'), 3000);
        return;
      }

      const ext = blob.type.includes('webm') ? 'webm' :
                  blob.type.includes('mp4') ? 'mp4' :
                  blob.type.includes('ogg') ? 'ogg' : 'webm';

      const formData = new FormData();
      formData.append('session_token', sessionToken);
      formData.append('audio', new File([blob], `complaint.${ext}`, { type: blob.type }));
      formData.append('language', selectedLanguage);

      const response = await fetch(`${API_BASE_URL}/voice-auth/complaint/voice-submit`, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      console.log('[VoiceComplaint] Server response:', data);

      if (response.ok) {
        setStatus('success');
        setTranscribedText(data.transcribed_text);
        setComplaintId(data.complaint_id);
        setVerificationDetails(data.verification);
        speakerRetryRef.current = 0;
      } else if (response.status === 403) {
        if (speakerRetryRef.current < 1) {
          speakerRetryRef.current += 1;
          setError('Voice mismatch detected. Please record again.');
          setAudioBlob(null);
          setAudioUrl('');
          setStatus('idle');
        } else {
          setError('Could not verify voice after two attempts. Redirecting...');
          setStatus('error');
          setTimeout(() => navigate('/voice-login'), 4000);
        }
      } else {
        setError(data.error || 'Failed to submit complaint.');
        setStatus('error');
      }
    } catch (err) {
      console.error('[VoiceComplaint] Submit error:', err);
      setError('Network error. Check your connection and try again.');
      setStatus('error');
    }
  };

  const handleProceedToAnalysis = () => {
    navigate('/complaint', { state: { voiceComplaint: true, transcribedText, complaintId } });
  };

  const handleRecordAgain = () => {
    if (audioPrevUrlRef.current) URL.revokeObjectURL(audioPrevUrlRef.current);
    audioPrevUrlRef.current = '';
    setAudioBlob(null);
    setAudioUrl('');
    setStatus('idle');
    setError('');
  };

  // ── Render ───────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
        <p className="ml-4">Validating session...</p>
      </div>
    );
  }

  if (!sessionValid) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-md w-full shadow-xl">
          <CardContent className="text-center space-y-4 pt-6">
            <AlertCircle className="w-16 h-16 text-red-600 mx-auto" />
            <p>{error}</p>
            <Button onClick={() => navigate('/voice-login')}>Go to Voice Login</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-12 px-4 bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="max-w-3xl mx-auto space-y-6">
        <h1 className="text-4xl font-bold text-center">Voice Complaint Submission</h1>

        <Button variant="ghost" onClick={() => navigate('/dashboard')}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Dashboard
        </Button>

        <Card className="shadow-xl">
          <CardHeader>
            <CardTitle>Record Your Complaint</CardTitle>
            <CardDescription>Speak naturally in your chosen language about your concern</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Language selector */}
            {status !== 'success' && status !== 'uploading' && (
              <div className="flex flex-col gap-2">
                <p className="text-sm font-medium text-gray-700">Select language for transcription:</p>
                <div className="flex gap-2">
                  {(['auto', 'en', 'si'] as const).map((lang) => (
                    <button
                      key={lang}
                      onClick={() => setSelectedLanguage(lang)}
                      className={`px-4 py-2 rounded border text-sm font-medium transition-colors ${
                        selectedLanguage === lang
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      {lang === 'auto' ? '🌐 Auto-detect' : lang === 'en' ? '🇬🇧 English' : '🇱🇰 සිංහල'}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {status !== 'success' && !audioBlob && status !== 'uploading' && (
              <VoiceRecorderAdvanced
                onRecordingComplete={handleRecordingComplete}
                minDuration={2}
                maxDuration={120}
              />
            )}

            {audioBlob && status !== 'success' && status !== 'uploading' && (
              <div className="space-y-4">
                <audio key={audioUrl} controls src={audioUrl} className="w-full" preload="auto" />
                <div className="flex gap-2">
                  <Button onClick={() => submitLiveComplaint(audioBlob)} className="flex-1">
                    Submit Complaint
                  </Button>
                  <Button variant="outline" onClick={handleRecordAgain}>
                    Record Again
                  </Button>
                </div>
              </div>
            )}

            {status === 'uploading' && (
              <div className="text-center py-8 space-y-4">
                <Loader2 className="w-16 h-16 text-blue-600 animate-spin mx-auto" />
                <p>Processing your voice complaint…</p>
              </div>
            )}

            {status === 'success' && (
              <Card className="bg-blue-50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    Complaint Submitted Successfully
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {audioUrl && <audio key={audioUrl} controls src={audioUrl} className="w-full" />}
                  {transcribedText && (
                    <div className="p-3 bg-gray-50 rounded border text-sm">
                      <FileText className="w-4 h-4 inline mr-2 text-gray-500" />
                      <span className="font-medium">Transcription:</span> {transcribedText}
                    </div>
                  )}
                  {verificationDetails && (
                    <Alert className="border-green-600 bg-green-50">
                      <Shield className="h-4 w-4 text-green-600" />
                      <AlertDescription>
                        Voice verified — Similarity: {(verificationDetails.similarity * 100).toFixed(1)}% (threshold: {(verificationDetails.threshold * 100).toFixed(0)}%)
                      </AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </Card>
            )}

            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {status === 'success' && (
              <div className="space-y-2">
                <Button onClick={handleProceedToAnalysis} className="w-full">
                  Proceed to Risk Analysis
                </Button>
                <Button onClick={() => navigate('/dashboard')} variant="outline" className="w-full">
                  Return to Dashboard
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default VoiceComplaint;