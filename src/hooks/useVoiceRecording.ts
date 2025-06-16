
import { useState, useRef } from 'react';

interface UseVoiceRecordingReturn {
  isRecording: boolean;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<string | null>;
  error: string | null;
}

export const useVoiceRecording = (): UseVoiceRecordingReturn => {
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const resultRef = useRef<string>('');

  const startRecording = async () => {
    try {
      setError(null);
      
      // Check if Speech Recognition is supported
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      
      if (!SpeechRecognition) {
        throw new Error('Speech Recognition is not supported in this browser. Please use Chrome, Edge, or Safari.');
      }

      const recognition = new SpeechRecognition();
      
      // Configure recognition settings
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';
      
      resultRef.current = '';
      
      recognition.onstart = () => {
        setIsRecording(true);
        console.log('Speech recognition started');
      };
      
      recognition.onresult = (event) => {
        let finalTranscript = '';
        
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript;
          }
        }
        
        if (finalTranscript) {
          resultRef.current = finalTranscript;
          console.log('Speech result:', finalTranscript);
        }
      };
      
      recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        setError(`Speech recognition error: ${event.error}`);
        setIsRecording(false);
      };
      
      recognition.onend = () => {
        setIsRecording(false);
        console.log('Speech recognition ended');
      };
      
      recognitionRef.current = recognition;
      recognition.start();
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start speech recognition');
      console.error('Error starting speech recognition:', err);
    }
  };

  const stopRecording = async (): Promise<string | null> => {
    return new Promise((resolve) => {
      if (!recognitionRef.current || !isRecording) {
        resolve(null);
        return;
      }

      recognitionRef.current.onend = () => {
        setIsRecording(false);
        const result = resultRef.current.trim();
        console.log('Final speech result:', result);
        resolve(result || null);
      };

      recognitionRef.current.stop();
    });
  };

  return {
    isRecording,
    startRecording,
    stopRecording,
    error,
  };
};
