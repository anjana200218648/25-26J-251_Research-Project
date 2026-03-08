import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, X, Play, Pause } from 'lucide-react';
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
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  // FIX: Keep the original raw WebM blob separately so it is always sent to
  // the backend, regardless of whether client-side WAV conversion succeeds.
  // audioBlob (state) is used only for the preview <audio> element.
  const originalBlobRef = useRef<Blob | null>(null);

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
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  /**
   * Start recording audio from microphone
   */
  const startRecording = async () => {
    try {
      setError(null);
      
      // Add polyfill for older browsers
      if (!navigator.mediaDevices && navigator.getUserMedia) {
        // @ts-ignore - Polyfill for older browsers
        navigator.mediaDevices = {
          getUserMedia: function(constraints) {
            const getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia;
            if (!getUserMedia) {
              return Promise.reject(new Error('getUserMedia is not implemented in this browser'));
            }
            return new Promise((resolve, reject) => {
              getUserMedia.call(navigator, constraints, resolve, reject);
            });
          }
        };
      }
      
      // Check if MediaDevices API is supported
      if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') {
        const debugInfo = {
          hasNavigator: !!navigator,
          hasMediaDevices: !!navigator.mediaDevices,
          hasGetUserMedia: navigator.mediaDevices ? typeof navigator.mediaDevices.getUserMedia : 'no mediaDevices',
          userAgent: navigator.userAgent
        };
        console.error('MediaDevices API not supported', debugInfo);
        
        // Check if in device emulation mode
        const isMobileEmulation = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) && 
                                 debugInfo.hasNavigator && 
                                 !debugInfo.hasMediaDevices;
        
        if (isMobileEmulation) {
          setError('Chrome Device Emulation detected. Please turn OFF mobile device toolbar (Press Ctrl+Shift+M or click the device icon in DevTools) and refresh the page.');
        } else {
          setError('Your browser does not support audio recording. Please use Chrome, Edge, Firefox, or Safari (latest versions).');
        }
        return;
      }
      
      // Check if running over HTTPS or localhost (required for microphone access)
      const isSecureContext = window.isSecureContext !== undefined ? window.isSecureContext : true;
      const isLocalhost = window.location.hostname === 'localhost' || 
                         window.location.hostname === '127.0.0.1' || 
                         window.location.hostname === '[::1]';
      
      if (!isSecureContext && !isLocalhost) {
        setError('Microphone access requires HTTPS. Please use localhost for development or HTTPS for production.');
        console.error('Insecure context - HTTPS required');
        return;
      }
      
      console.log('Starting audio recording...');
      
      // Request microphone access with optimal settings
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 44100,
          channelCount: 1  // Mono
        } 
      });
      
      // CRITICAL: Verify stream has active audio tracks
      const audioTracks = stream.getAudioTracks();
      console.log('🎤 Audio tracks:', audioTracks.length);
      audioTracks.forEach((track, i) => {
        console.log(`  Track ${i}:`, {
          enabled: track.enabled,
          muted: track.muted,
          readyState: track.readyState,
          label: track.label,
          settings: track.getSettings()
        });
        
        // Ensure track is enabled and unmuted
        if (!track.enabled) {
          console.warn('⚠️ Track was disabled, enabling...');
          track.enabled = true;
        }
      });
      
      if (audioTracks.length === 0) {
        throw new Error('No audio tracks in stream!');
      }
      
      // Store stream reference for cleanup
      streamRef.current = stream;
      
      // Create AudioContext for visualization and better audio processing
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = audioContext;
      
      // Create analyser for visualization
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      analyserRef.current = analyser;
      
      // Connect microphone to analyser
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);
      
      // Start visualization
      visualize();
      
      console.log('Audio context created, visualization started'); 
      
      // Create MediaRecorder with best supported format
      // Test formats in order of reliability for recording AND playback
      let mimeType = '';
      let options: any = {};
      
      const testFormats = [
        { mime: 'audio/webm;codecs=opus', bitrate: 128000 },
        { mime: 'audio/webm', bitrate: null },
        { mime: 'audio/ogg;codecs=opus', bitrate: 128000 },
        { mime: 'audio/mp4', bitrate: null },
      ];
      
      for (const format of testFormats) {
        if (MediaRecorder.isTypeSupported(format.mime)) {
          mimeType = format.mime;
          options = format.bitrate 
            ? { mimeType: format.mime, audioBitsPerSecond: format.bitrate }
            : { mimeType: format.mime };
          console.log(`✅ Using format: ${format.mime}`, format.bitrate ? `at ${format.bitrate} bps` : '');
          break;
        }
      }
      
      if (!mimeType) {
        console.warn('⚠️ No supported format found, using browser default');
        options = {};
      }
      
      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      
      // Get the ACTUAL mimeType the MediaRecorder will use
      const actualMimeType = mediaRecorder.mimeType;
      console.log('🎙️ MediaRecorder initialized:', {
        requestedMimeType: mimeType,
        actualMimeType: actualMimeType,
        state: mediaRecorder.state,
        options: options
      });
      
      // Handle data available event
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          console.log('Audio chunk received:', event.data.size, 'bytes, type:', event.data.type);
          audioChunksRef.current.push(event.data);
        }
      };
      
      // Handle recording stop
      mediaRecorder.onstop = () => {
        console.log('⏹️ Recording stopped, processing', audioChunksRef.current.length, 'chunks');
        
        // Validate chunks exist
        if (audioChunksRef.current.length === 0) {
          console.error('❌ No audio chunks recorded!');
          setError('Recording failed - no audio data captured');
          if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
          }
          return;
        }
        
        // Log all chunk details
        const chunkSizes = audioChunksRef.current.map((c, i) => ({
          index: i,
          size: c.size,
          type: c.type
        }));
        const totalSize = audioChunksRef.current.reduce((sum, c) => sum + c.size, 0);
        console.log('📦 Chunk details:', chunkSizes);
        console.log('📈 Total audio data:', totalSize, 'bytes (', (totalSize/1024).toFixed(2), 'KB)');
        
        // Get the ACTUAL mimeType from the chunks (most reliable)
        const chunkMimeType = audioChunksRef.current[0]?.type;
        console.log('🎵 Chunk mimeType:', chunkMimeType);
        
        // Use the chunk's mimeType for the blob (this is what actually matters for playback)
        const blobMimeType = chunkMimeType || actualMimeType || 'audio/webm';
        const blob = new Blob(audioChunksRef.current, { type: blobMimeType });
        
        console.log('🎵 Created audio blob:', {
          size: blob.size,
          type: blob.type,
          chunks: audioChunksRef.current.length,
          sizeKB: (blob.size / 1024).toFixed(2),
          canPlay: document.createElement('audio').canPlayType(blob.type)
        });
        
        // Validate blob has data
        if (blob.size === 0) {
          console.error('❌ Audio blob is empty!');
          setError('Recording failed - no audio data captured. Please check microphone permissions.');
          if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
          }
          return;
        }
        
        if (blob.size < 5000) {
          console.warn('⚠️ Audio blob is very small:', blob.size, 'bytes');
          // Don't return error for small files - they might still be valid
        }
        
        // Check if browser can play this format
        const testAudio = document.createElement('audio');
        const canPlayType = testAudio.canPlayType(blob.type);
        console.log('🔊 Browser can play', blob.type, ':', canPlayType);
        
        if (canPlayType === '') {
          console.warn('⚠️ Browser may not support playback of', blob.type);
          setError(`Browser may not support ${blob.type} playback. Audio uploaded to backend will still be transcribed.`);
        }
        
        // CRITICAL: Try to verify audio blob contains actual audio data
        // Create temporary audio element to test
        const verifyAudio = new Audio();
        verifyAudio.src = URL.createObjectURL(blob);
        verifyAudio.volume = 0.01; // Very quiet for verification
        
        verifyAudio.onloadedmetadata = () => {
          const duration = verifyAudio.duration;
          console.log('✅ Audio blob verified - Duration:', duration, 'seconds');
          
          if (duration === Infinity || isNaN(duration)) {
            console.warn('⚠️ Audio duration is Infinity (WebM metadata issue) - backend transcription will still work');
          } else if (duration === 0) {
            console.error('❌ Audio blob may be corrupted - duration:', duration);
            setError('Audio recording may be corrupted. Please try recording again.');
          } else {
            console.log('✅ Audio blob OK - contains', duration.toFixed(2), 'seconds of audio');
          }
          
          URL.revokeObjectURL(verifyAudio.src);
        };
        
        verifyAudio.onerror = (e: any) => {
          console.error('❌ Audio blob verification failed:', e);
          setError('Audio blob appears corrupted. It will still be sent to backend for transcription.');
        };
        
        setAudioBlob(blob);
        
        // Create audio URL for playback
        const url = URL.createObjectURL(blob);
        console.log('🔗 Created audio URL:', url);
        console.log('✅ Audio ready for playback and submission');
        setAudioUrl(url);
        
        // Stop all tracks
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
        }
      };
      
      // Start recording - use timeslice to ensure consistent data chunks
      mediaRecorder.start(1000); // Collect data every 1 second for better reliability
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
      
      // Provide specific error messages based on error type
      if (err instanceof Error) {
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          setError('Microphone permission denied. Please allow microphone access in your browser settings.');
        } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
          setError('No microphone found. Please connect a microphone and try again.');
        } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
          setError('Microphone is already in use by another application. Please close other apps and try again.');
        } else if (err.name === 'OverconstrainedError' || err.name === 'ConstraintNotSatisfiedError') {
          setError('Could not meet audio recording requirements. Please check your microphone settings.');
        } else {
          setError(`Microphone error: ${err.message}`);
        }
      } else {
        setError('Could not access microphone. Please check permissions and try again.');
      }
    }
  };

  /**
   * Visualize audio input in real-time
   */
  const visualize = () => {
    if (!analyserRef.current || !canvasRef.current) return;
    
    const analyser = analyserRef.current;
    const canvas = canvasRef.current;
    const canvasCtx = canvas.getContext('2d');
    
    if (!canvasCtx) return;
    
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    
    const draw = () => {
      if (!isRecording && !isPaused) {
        // Stop visualization when not recording
        return;
      }
      
      animationFrameRef.current = requestAnimationFrame(draw);
      
      analyser.getByteTimeDomainData(dataArray);
      
      canvasCtx.fillStyle = 'rgb(245, 245, 245)';
      canvasCtx.fillRect(0, 0, canvas.width, canvas.height);
      
      canvasCtx.lineWidth = 2;
      canvasCtx.strokeStyle = isPaused ? 'rgb(239, 68, 68)' : 'rgb(59, 130, 246)';
      canvasCtx.beginPath();
      
      const sliceWidth = canvas.width / bufferLength;
      let x = 0;
      
      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0;
        const y = v * canvas.height / 2;
        
        if (i === 0) {
          canvasCtx.moveTo(x, y);
        } else {
          canvasCtx.lineTo(x, y);
        }
        
        x += sliceWidth;
      }
      
      canvasCtx.lineTo(canvas.width, canvas.height / 2);
      canvasCtx.stroke();
    };
    
    draw();
  };

  /**
   * Stop recording
   */
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      console.log('Stopping recording...');
      
      // Stop visualization
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      
      // Request any remaining data before stopping
      if (mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.requestData();
      }
      
      // Stop the recording
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsPaused(false);
      
      // Close audio context
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
      
      // Stop all media tracks
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      
      console.log('Recording stopped, waiting for blob creation...');
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
  const playAudio = async () => {
    if (!audioUrl || !audioBlob) {
      console.error('❌ No audio available for playback', { audioUrl, blobSize: audioBlob?.size });
      setError('No audio recorded. Please record audio first.');
      return;
    }
    
    console.log('🔊 Attempting to play audio:', {
      url: audioUrl,
      blobSize: audioBlob.size,
      blobType: audioBlob.type
    });
    
    // Check if browser can play this type
    const testAudio = document.createElement('audio');
    const canPlay = testAudio.canPlayType(audioBlob.type);
    console.log('🎵 Browser canPlayType("' + audioBlob.type + '"):', canPlay);
    
    if (canPlay === '') {
      console.error('❌ Browser cannot play', audioBlob.type);
      setError(`Your browser cannot play ${audioBlob.type} format. The audio will still be transcribed when submitted.`);
      // Don't return - still try to play
    }
    
    try {
      // Stop and cleanup any existing audio
      if (audioElementRef.current) {
        console.log('🛑 Stopping existing audio playback');
        audioElementRef.current.pause();
        audioElementRef.current.currentTime = 0;
        audioElementRef.current.src = '';
        audioElementRef.current.load(); // Force cleanup
        audioElementRef.current = null;
      }
      
      // Create new audio element
      console.log('🎤 Creating new Audio element');
      const audio = new Audio();
      audio.preload = 'auto';
      audio.volume = 1.0; // Maximum volume
      audio.muted = false; // Ensure not muted
      audioElementRef.current = audio;
      
      // Setup event handlers
      audio.onended = () => {
        console.log('Audio playback ended');
        setIsPlaying(false);
        setPlaybackTime(0);
      };
      
      audio.ontimeupdate = () => {
        setPlaybackTime(audio.currentTime);
      };
      
      audio.onerror = (e: any) => {
        console.error('Audio playback error:', e, {
          error: e.target?.error,
          code: e.target?.error?.code,
          message: e.target?.error?.message,
          readyState: e.target?.readyState,
          networkState: e.target?.networkState
        });
        
        const errorCode = e.target?.error?.code;
        let errorMsg = 'Failed to play audio. ';
        
        switch(errorCode) {
          case 1: errorMsg += 'Audio loading aborted.'; break;
          case 2: errorMsg += 'Network error.'; break;
          case 3: errorMsg += 'Audio decoding failed.'; break;
          case 4: errorMsg += 'Audio format not supported.'; break;
          default: errorMsg += 'Unknown error.'; break;
        }
        
        setError(errorMsg);
        setIsPlaying(false);
      };
      
      audio.onloadstart = () => {
        console.log('Audio loading started');
      };
      
      audio.onloadedmetadata = () => {
        console.log('Audio metadata loaded, duration:', audio.duration, 'seconds');
      };
      
      audio.oncanplay = () => {
        console.log('Audio can start playing');
      };
      
      audio.oncanplaythrough = () => {
        console.log('Audio can play through without buffering');
      };
      
      // Set source and explicitly load
      audio.src = audioUrl;
      console.log('Audio source set, calling load()...');
      audio.load();
      
      // Wait for audio to be ready
      await new Promise<void>((resolve, reject) => {
        const loadTimeout = setTimeout(() => {
          reject(new Error('Audio load timeout after 10 seconds'));
        }, 10000);
        
        audio.oncanplay = () => {
          clearTimeout(loadTimeout);
          console.log('Audio ready to play');
          resolve();
        };
        
        audio.onerror = (e) => {
          clearTimeout(loadTimeout);
          reject(e);
        };
      });
      
      // Start playback
      console.log('▶️ Starting audio playback with play()...');
      console.log('🔊 Volume:', audio.volume, 'Muted:', audio.muted);
      console.log('📱 Audio properties:', {
        duration: audio.duration,
        readyState: audio.readyState,
        paused: audio.paused,
        volume: audio.volume,
        muted: audio.muted
      });
      
      // Check system audio
      if (typeof navigator !== 'undefined' && 'mediaDevices' in navigator) {
        try {
          const devices = await navigator.mediaDevices.enumerateDevices();
          const audioOutputs = devices.filter(d => d.kind === 'audiooutput');
          console.log('🔊 Available audio outputs:', audioOutputs.length);
          if (audioOutputs.length === 0) {
            console.warn('⚠️ No audio output devices found!');
          }
        } catch (e) {
          console.warn('Could not enumerate audio devices:', e);
        }
      }
      
      const playPromise = audio.play();
      
      if (playPromise !== undefined) {
        await playPromise;
        console.log('✅ Audio playing successfully');
        console.log('   Duration:', audio.duration, 'seconds');
        console.log('   Current time:', audio.currentTime);
        console.log('   Volume:', audio.volume);
        console.log('   Paused:', audio.paused);
        setIsPlaying(true);
      }
    } catch (err: any) {
      console.error('Error playing audio:', err);
      setError(`Failed to play audio: ${err.message || 'Unknown error'}. Try recording again.`);
      setIsPlaying(false);
    }
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
    if (!audioBlob) {
      setError('No audio recorded yet');
      return;
    }

    // Validate minimum recording time (2 seconds)
    const MIN_RECORDING_SECONDS = 2;
    if (recordingTime < MIN_RECORDING_SECONDS) {
      setError(`Please record at least ${MIN_RECORDING_SECONDS} seconds of audio. Current: ${recordingTime}s`);
      return;
    }

    // Validate blob size (at least 5KB)
    const MIN_BLOB_SIZE = 5000;
    if (audioBlob.size < MIN_BLOB_SIZE) {
      setError(`Recording is too short or has no audio data. Please try again.`);
      return;
    }

    console.log('Submitting audio:', {
      duration: recordingTime,
      size: audioBlob.size,
      type: audioBlob.type
    });

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
            <p className="text-sm text-muted-foreground text-center">
              Please record at least 2 seconds. Maximum {maxDurationSeconds} seconds.
            </p>
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
              <div className="flex flex-col items-center">
                <span className="text-2xl font-mono">
                  {formatTime(recordingTime)}
                </span>
                {recordingTime < 2 && (
                  <span className="text-xs text-muted-foreground">
                    (min 2 seconds)
                  </span>
                )}
              </div>
            </div>
            
            {/* Audio Visualization */}
            <div className="flex flex-col items-center gap-2">
              <canvas 
                ref={canvasRef}
                width="400"
                height="100"
                className="w-full border border-gray-300 rounded-lg bg-gray-50"
              />
              <p className="text-xs text-muted-foreground">
                {isRecording && !isPaused && '🎤 Speak into your microphone'}
                {isPaused && '⏸ Paused'}
              </p>
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
              <span className="text-xs text-muted-foreground">
                ({(audioBlob.size / 1024).toFixed(1)} KB)
              </span>
            </div>
            
            {/* Native HTML5 Audio Player for Better Compatibility */}
            {audioUrl && (
              <div className="border rounded-lg p-3 bg-muted/50">
                <p className="text-xs text-muted-foreground mb-2">
                  Preview your recording: 
                  <span className="ml-2 font-mono text-[10px]">{audioBlob.type}</span>
                </p>
                <audio 
                  key={audioUrl}
                  controls 
                  src={audioUrl}
                  className="w-full"
                  style={{ height: '40px' }}
                  preload="auto"
                  onLoadStart={(e) => {
                    console.log('Native audio: load started');
                  }}
                  onLoadedMetadata={(e) => {
                    const target = e.target as HTMLAudioElement;
                    console.log('Native audio: metadata loaded, duration:', target.duration, 'readyState:', target.readyState);
                  }}
                  onCanPlay={(e) => {
                    console.log('Native audio: can play');
                  }}
                  onCanPlayThrough={(e) => {
                    console.log('Native audio: can play through');
                  }}
                  onPlay={(e) => {
                    console.log('Native audio: playing started');
                  }}
                  onError={(e) => {
                    console.error('Native audio element error:', e);
                    const target = e.target as HTMLAudioElement;
                    if (target.error) {
                      console.error('Error details:', {
                        code: target.error.code,
                        message: target.error.message,
                        src: target.src,
                        currentSrc: target.currentSrc,
                        readyState: target.readyState,
                        networkState: target.networkState
                      });
                      
                      // Show user-friendly error
                      let errorMsg = 'Audio playback error: ';
                      switch(target.error.code) {
                        case 1: errorMsg += 'Loading aborted'; break;
                        case 2: errorMsg += 'Network error'; break;
                        case 3: errorMsg += 'Decoding failed - unsupported format'; break;
                        case 4: errorMsg += 'Format not supported by browser'; break;
                        default: errorMsg += 'Unknown error';
                      }
                      setError(errorMsg);
                    }
                  }}
                />
                <p className="text-[10px] text-muted-foreground mt-1">
                  Audio recorded successfully. Download to verify if needed.
                </p>
                <a 
                  href={audioUrl} 
                  download={`voice-recording-${Date.now()}.webm`}
                  className="text-[10px] text-blue-600 hover:underline block mt-1"
                >
                  Download recording to test outside browser
                </a>
              </div>
            )}
            
            <div className="flex gap-2">
              <Button
                onClick={cancelRecording}
                variant="outline"
                className="flex-1"
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
