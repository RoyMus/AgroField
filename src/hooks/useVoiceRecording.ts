
import { useState, useRef,useCallback, useEffect } from 'react';
import PlaySound from './playSound';
import startSound from '../voices/startSound.mp3';



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

  const hebrewToNumberMap: { [key: string]: string } = {
    "אפס": "0",
    "אחת": "1", "אחד": "1",
    "שתיים": "2", "שניים": "2",
    "שלוש": "3", "שלושה": "3",
    "ארבע": "4", "ארבעה": "4",
    "חמש": "5", "חמישה": "5",
    "שש": "6", "שישה": "6",
    "שבע": "7", "שבעה": "7",
    "שמונה": "8",
    "תשע": "9", "תשעה": "9",
  };

  useEffect(() => {
        
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
        let finalTranscript = '';
        
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript;
          }
        }
        
        if (finalTranscript) {
          console.log('Final transcript:', finalTranscript);
          processTranscript(finalTranscript);
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
  },[])

  const translateWord = (word: string): string => {
    const trimmed = word.trim();
    return hebrewToNumberMap[trimmed] ?? trimmed;
  };

  const processTranscript = (transcript: string): void => {
    if (!wordCallbackRef.current || !transcript.trim()) return;

    // Clean the transcript - keep only Hebrew letters, numbers, and dots
    const cleaned = transcript.replace(/[^\u0590-\u05FF0-9.\s]/g, '').trim();
    if (!cleaned) return;

    // Check if it looks like a decimal number (e.g., "אחת נקודה שתיים")
    const decimalMatch = cleaned.match(/^(.+?)[\s.]+נקודה?[\s.]+(.+)$|^(.+?)[\s.]*\.[\s.]*(.+)$/);
    if (decimalMatch) {
      const firstPart = (decimalMatch[1] || decimalMatch[3])?.trim();
      const secondPart = (decimalMatch[2] || decimalMatch[4])?.trim();

      if (firstPart && secondPart) {
        const firstNum = translateWord(firstPart);
        const secondNum = translateWord(secondPart);

        // Only treat as decimal if both parts are numbers
        if (/^\d+$/.test(firstNum) && /^\d+$/.test(secondNum)) {
          wordCallbackRef.current(`${firstNum}.${secondNum}`);
          return;
        }
      }
    }

    // Process as individual words
    const words = cleaned.split(/\s+/).filter(w => w && w !== 'נקודה');
    words.forEach(word => {
      const translated = translateWord(word);
      if (translated && wordCallbackRef.current) {
        wordCallbackRef.current(translated);
      }
    });
  };

  const startRecording = async () => {
    try {
      setError(null);
      recognitionRef.current.start();

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
