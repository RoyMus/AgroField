
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
  const hebrewToNumberMap: { [key: string]: number } = {
    "אפס": 0,
    "אחת": 1, "אחד": 1,
    "שתיים": 2, "שניים": 2,
    "שלוש": 3,
    "ארבע": 4,
    "חמש": 5,
    "שש": 6,
    "שבע": 7,
    "שמונה": 8,
    "תשע": 9,
  };
  const tryTranslate = (word: string): string => {
    const normalizedWord = word.trim().toLowerCase();
    if (hebrewToNumberMap[normalizedWord] !== undefined) {
      return hebrewToNumberMap[normalizedWord].toString();
    }
    return word;
  };

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
          console.log('Final transcript:', finalTranscript);
          
          // Clean up the transcript (normalize dots, spaces, and Hebrew word for dot)
          const cleanTranscript = finalTranscript.trim()
            .replace(/\s*\.\s*/g, '.') // normalize spaces around dots
            .replace(/\s*נקודה\s*/g, '.') // replace Hebrew word for dot
            .replace(/\s+/g, ' '); // normalize other spaces
          
          console.log('Cleaned transcript:', cleanTranscript);
          
          // Try to match various decimal number patterns
          const numericDecimal = cleanTranscript.match(/\d+\.\d+/);
          const wordDecimal = cleanTranscript.match(/(\w+)\.(\w+)/);
          
          if (numericDecimal) {
            // Handle numeric decimal (e.g., "1.8")
            console.log('Found numeric decimal:', numericDecimal[0]);
            wordCallbackRef.current(numericDecimal[0]);
          } else if (wordDecimal) {
            // Handle word decimal (e.g., "one.eight")
            const firstPart = tryTranslate(wordDecimal[1]);
            const secondPart = tryTranslate(wordDecimal[2]);
            if (!isNaN(Number(firstPart)) && !isNaN(Number(secondPart))) {
              const result = `${firstPart}.${secondPart}`;
              console.log('Found word decimal:', result);
              wordCallbackRef.current(result);
            } else {
              // If parts don't translate to numbers, process as regular words
              const words = cleanTranscript.split(/\s+/);
              words.forEach(word => {
                if (word) {
                  wordCallbackRef.current(tryTranslate(word));
                }
              });
            }
          } else {
            // If no decimal pattern found, process words normally
            const words = cleanTranscript.split(/\s+/);
            words.forEach(word => {
              if (word) {
                wordCallbackRef.current(tryTranslate(word));
              }
            });
          }
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
