
import { useState, useRef,useCallback } from 'react';

interface UseVoiceRecordingReturn {
  isRecording: boolean;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<void>;
  error: string | null;
  onWordRecognized: (callback: (word: string) => void) => void;
}

export const useVoiceRecording = (): UseVoiceRecordingReturn => {
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const wordCallbackRef = useRef<((word: string) => void) | null>(null);

  const onWordRecognized = useCallback((callback: (word: string) => void) => {
    wordCallbackRef.current = callback;
  }, []);
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
      recognition.lang = 'he-IL'; // Set language to Hebrew
      
      recognition.onstart = () => {
        setIsRecording(true);
        console.log('Speech recognition started');
      };
      
      recognition.onresult = (event) => {
        let interimTranscript = '';
        let finalTranscript = '';
        
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript;
            
          } else {
            interimTranscript += transcript;
          }
        }
        
        // Accumulate final transcripts
        if (finalTranscript) {
          console.log(finalTranscript);
          const words = finalTranscript.trim().split(/\s+/);
          words.forEach(word => {
              if (word) {
                wordCallbackRef.current(word);
              }
          });
        }
        
        // Log interim results for debugging
        if (interimTranscript) {
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
        // Resolve the promise when recognition ends
      };
      
      recognitionRef.current = recognition;
      recognition.start();
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start speech recognition');
      console.error('Error starting speech recognition:', err);
    }
  };

  const stopRecording = async (): Promise<void> => {
      // Stop the recognition - this will trigger onend
      recognitionRef.current.stop();
    };

  return {
    isRecording,
    startRecording,
    stopRecording,
    error,
    onWordRecognized,
  };
};
