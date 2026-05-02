import React, { useRef, useState, useEffect, useCallback } from "react";

interface Props {
  onRecordingComplete: (blob: Blob, duration: number) => void;
  minDuration?: number;
  maxDuration?: number;
  disabled?: boolean;
}

export const VoiceRecorderAdvanced: React.FC<Props> = ({
  onRecordingComplete,
  minDuration = 3,
  maxDuration = 15,
  disabled = false,
}) => {
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startTimeRef = useRef<number>(0);
  const streamRef = useRef<MediaStream | null>(null);
  const audioUrlRef = useRef<string>("");

  const [recording, setRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string>("");
  const [recordingTime, setRecordingTime] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
      cleanupStream();
    };
  }, []);

  const setAudioUrlSafe = useCallback((url: string) => {
    if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    audioUrlRef.current = url;
    setAudioUrl(url);
  }, []);

  const getSupportedMimeType = (): string => {
    const formats = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4"];
    for (const fmt of formats) if (MediaRecorder.isTypeSupported(fmt)) return fmt;
    return "";
  };

  const startRecording = async () => {
    try {
      chunksRef.current = [];
      setAudioUrlSafe("");
      setRecordingTime(0);

      const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, sampleRate: 16000 } });
      streamRef.current = stream;

      const mimeType = getSupportedMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : {});
      mediaRecorderRef.current = recorder;
      startTimeRef.current = Date.now();

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const validChunks = chunksRef.current.filter(c => c.size > 0);
        if (validChunks.length === 0) {
          alert("No audio captured. Check microphone.");
          cleanupStream();
          return;
        }
        const duration = (Date.now() - startTimeRef.current) / 1000;
        if (duration < minDuration) {
          alert(`Recording must be at least ${minDuration}s. You recorded ${duration.toFixed(1)}s.`);
          cleanupStream();
          return;
        }
        const blob = new Blob(validChunks, { type: recorder.mimeType || mimeType || "audio/webm" });
        setAudioUrlSafe(URL.createObjectURL(blob));
        cleanupStream();
        onRecordingComplete(blob, duration);
      };

      recorder.start(500);
      setRecording(true);

      timerRef.current = setInterval(() => setRecordingTime(prev => prev + 1), 1000);

      setTimeout(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") stopRecording();
      }, maxDuration * 1000);

    } catch (err: any) {
      console.error(err);
      alert("Could not access microphone.");
    }
  };

  const stopRecording = () => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.requestData();
      mediaRecorderRef.current.stop();
      setRecording(false);
    }
  };

  const cleanupStream = () => {
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
  };

  const formatTime = (s: number) => `${Math.floor(s/60).toString().padStart(2,'0')}:${(s%60).toString().padStart(2,'0')}`;

  return (
    <div className="space-y-4">
      {!recording ? (
        <button onClick={startRecording} disabled={disabled} className="bg-blue-600 text-white w-full py-2 rounded">
          🎙️ Start Recording
        </button>
      ) : (
        <div className="flex gap-2 items-center">
          <span>Recording: {formatTime(recordingTime)}</span>
          <button onClick={stopRecording} className="bg-red-600 text-white px-3 rounded">Stop</button>
        </div>
      )}
      {audioUrl && <audio src={audioUrl} controls />}
    </div>
  );
};

export default VoiceRecorderAdvanced;