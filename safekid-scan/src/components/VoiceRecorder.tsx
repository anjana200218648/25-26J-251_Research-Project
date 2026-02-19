import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, Play, Pause, X } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Alert, AlertDescription } from './ui/alert';


interface VoiceRecorderProps {
  onAudioReady: (audioBlob: Blob) => void;
  maxDurationSeconds?: number;
  className?: string;
}

export const VoiceRecorder: React.FC<VoiceRecorderProps> = ({
  onAudioReady,
  maxDurationSeconds = 120, // 2 minutes default
  className = ''
}) => {
  // Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  
  // Playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackTime, setPlaybackTime] = useState(0);
  
  const [error, setError] = useState<string | null>(null);
  
  // Refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopRecording();
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  /**
   * Start recording audio from microphone
   */
  const startRecording = async () => {
    try {
      setError(null);
      
      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000 // Optimal for speech recognition
        } 
      }); 
      
      // Create MediaRecorder
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') 
        ? 'audio/webm' 
        : 'audio/mp4';
      
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      
      // Handle data available event
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      
      // Handle recording stop
      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: mimeType });
        setAudioBlob(blob);
        
        // Create audio URL for playback
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
      };
      
      // Start recording
      mediaRecorder.start(100); // Collect data every 100ms
      setIsRecording(true);
      setRecordingTime(0);
      
      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => {
          const newTime = prev + 1;
          
          // Auto-stop at max duration
          if (newTime >= maxDurationSeconds) {
            stopRecording();
            return maxDurationSeconds;
          }
          
          return newTime;
        });
      }, 1000);
      
    } catch (err) {
      console.error('Error accessing microphone:', err);
      setError('Could not access microphone. Please check permissions.');
    }
  };

  /**
   * Stop recording
   */
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsPaused(false);
      
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  };

  /**
   * Pause/Resume recording
   */
  const togglePause = () => {
    if (!mediaRecorderRef.current) return;
    
    if (isPaused) {
      mediaRecorderRef.current.resume();
      setIsPaused(false);
    } else {
      mediaRecorderRef.current.pause();
      setIsPaused(true);
    }
  };

  /**
   * Cancel current recording
   */
  const cancelRecording = () => {
    stopRecording();
    setAudioBlob(null);
    setAudioUrl(null);
    setRecordingTime(0);
    setError(null);
    audioChunksRef.current = [];
  };

  /**
   * Play recorded audio
   */
  const playAudio = () => {
    if (!audioUrl) return;
    
    if (!audioElementRef.current) {
      const audio = new Audio(audioUrl);
      audioElementRef.current = audio;
      
      audio.onended = () => {
        setIsPlaying(false);
        setPlaybackTime(0);
      };
      
      audio.ontimeupdate = () => {
        setPlaybackTime(audio.currentTime);
      };
    }
    
    audioElementRef.current.play();
    setIsPlaying(true);
  };

  /**
   * Pause audio playback
   */
  const pauseAudio = () => {
    if (audioElementRef.current) {
      audioElementRef.current.pause();
      setIsPlaying(false);
    }
  };

  /**
   * Submit audio to parent component
   */
  const submitAudio = () => {
    if (!audioBlob) return;

    setError(null);

    onAudioReady(audioBlob);
    cancelRecording();
  };

  /**
   * Format time as MM:SS
   */
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Voice Complaint</CardTitle>
        <CardDescription>
          Record your complaint using your microphone
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Error Alert */}
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        
        {/* Recording Controls */}
        {!audioBlob && !isRecording && (
          <div className="flex flex-col gap-4">
            <Button
              onClick={startRecording}
              className="w-full"
              size="lg"
            >
              <Mic className="mr-2 h-5 w-5" />
              Start Recording
            </Button>
          </div>
        )}
        
        {/* Recording Progress */}
        {isRecording && (
          <div className="space-y-4">
            <div className="flex items-center justify-center gap-4">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-red-500 animate-pulse" />
                <span className="text-sm font-medium">Recording</span>
              </div>
              <span className="text-2xl font-mono">
                {formatTime(recordingTime)}
              </span>
            </div>
            
            <div className="flex gap-2">
              <Button
                onClick={togglePause}
                variant="outline"
                className="flex-1"
              >
                {isPaused ? (
                  <>
                    <Play className="mr-2 h-4 w-4" />
                    Resume
                  </>
                ) : (
                  <>
                    <Pause className="mr-2 h-4 w-4" />
                    Pause
                  </>
                )}
              </Button>
              
              <Button
                onClick={stopRecording}
                className="flex-1"
              >
                <Square className="mr-2 h-4 w-4" />
                Stop
              </Button>
              
              <Button
                onClick={cancelRecording}
                variant="destructive"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
        
        {/* Playback Controls */}
        {audioBlob && !isRecording && (
          <div className="space-y-4">
            <div className="flex items-center justify-center gap-4">
              <span className="text-sm font-medium">Recording Ready</span>
            </div>
            
            <div className="flex gap-2">
              {!isPlaying ? (
                <Button
                  onClick={playAudio}
                  variant="outline"
                  className="flex-1"
                >
                  <Play className="mr-2 h-4 w-4" />
                  Play
                </Button>
              ) : (
                <Button
                  onClick={pauseAudio}
                  variant="outline"
                  className="flex-1"
                >
                  <Pause className="mr-2 h-4 w-4" />
                  Pause
                </Button>
              )}
              
              <Button
                onClick={cancelRecording}
                variant="outline"
              >
                <X className="mr-2 h-4 w-4" />
                Cancel
              </Button>
            </div>
            
            <Button
              onClick={submitAudio}
              className="w-full"
              size="lg"
            >
              Submit Recording
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default VoiceRecorder;
