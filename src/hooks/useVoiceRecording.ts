
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
  const accumulatedTranscriptRef = useRef<string>('');
  const resolvePromiseRef = useRef<((value: string | null) => void) | null>(null);

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
      
      // Reset accumulated transcript
      accumulatedTranscriptRef.current = '';
      
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
          accumulatedTranscriptRef.current += finalTranscript;
          console.log('Final transcript added:', finalTranscript);
          console.log('Total accumulated:', accumulatedTranscriptRef.current);
        }
        
        // Log interim results for debugging
        if (interimTranscript) {
          console.log('Interim transcript:', interimTranscript);
        }
      };
      
      recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        setError(`Speech recognition error: ${event.error}`);
        setIsRecording(false);
        
        // Resolve promise with error
        if (resolvePromiseRef.current) {
          resolvePromiseRef.current(null);
          resolvePromiseRef.current = null;
        }
      };
      
      recognition.onend = () => {
        setIsRecording(false);
        console.log('Speech recognition ended');
        console.log('Final accumulated transcript:', accumulatedTranscriptRef.current);
        
        // Resolve the promise when recognition ends
        if (resolvePromiseRef.current) {
          const finalResult = accumulatedTranscriptRef.current.trim();
          resolvePromiseRef.current(finalResult || null);
          resolvePromiseRef.current = null;
        }
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

      // Store the resolve function to be called when recognition ends
      resolvePromiseRef.current = resolve;
      
      // Stop the recognition - this will trigger onend
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
