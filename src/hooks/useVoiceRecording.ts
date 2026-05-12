
import { useState, useRef, useCallback, useEffect } from 'react';
import PlaySound from './playSound';
import startSound from '../voices/startSound.mp3';

export interface VoiceRecordingConfig {
  speechLang: string;
  numberWords: { [word: string]: string };
  decimalWord: string;
  allowedCharPattern: RegExp;
}

interface UseVoiceRecordingReturn {
  isRecording: boolean;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<void>;
  error: string | null;
  onWordRecognized: (callback: (word: string) => void) => void;
}

export const useVoiceRecording = (config: VoiceRecordingConfig): UseVoiceRecordingReturn => {
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const wordCallbackRef = useRef<((word: string) => void) | null>(null);
  const configRef = useRef(config);

  // Keep configRef current so processTranscript always uses the latest config
  // without needing to re-create the recognition instance on every render
  useEffect(() => {
    configRef.current = config;
  });

  const onWordRecognized = useCallback((callback: (word: string) => void) => {
    wordCallbackRef.current = callback;
  }, []);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      throw new Error('Speech Recognition is not supported in this browser. Please use Chrome, Edge, or Safari.');
    }

    const recognition = new SpeechRecognition();

    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = config.speechLang;

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
    };

    recognitionRef.current = recognition;

    return () => {
      recognitionRef.current?.stop();
    };
  }, [config.speechLang]); // Restart recognition instance when language changes

  const translateWord = (word: string): string => {
    const trimmed = word.trim();
    return configRef.current.numberWords[trimmed] ?? trimmed;
  };

  const processTranscript = (transcript: string): void => {
    if (!wordCallbackRef.current || !transcript.trim()) return;

    const { allowedCharPattern, decimalWord } = configRef.current;

    // Keep only characters valid for the current language
    const cleaned = transcript.replace(allowedCharPattern, '').trim();
    if (!cleaned) return;

    // Escape the decimal word for use in regex
    const decEscaped = decimalWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // Check for decimal pattern (e.g. "one point two" / "אחת נקודה שתיים")
    const decimalMatch = cleaned.match(
      new RegExp(`^(.+?)[\\s.]+${decEscaped}?[\\s.]+(.+)$|^(.+?)[\\s.]*\\.[\\s.]*(.+)$`)
    );
    if (decimalMatch) {
      const firstPart = (decimalMatch[1] || decimalMatch[3])?.trim();
      const secondPart = (decimalMatch[2] || decimalMatch[4])?.trim();

      if (firstPart && secondPart) {
        const firstNum = translateWord(firstPart);
        const secondNum = translateWord(secondPart);

        if (/^\d+$/.test(firstNum) && /^\d+$/.test(secondNum)) {
          wordCallbackRef.current(`${firstNum}.${secondNum}`);
          return;
        }
      }
    }

    // Process as individual words, filtering out the decimal separator word
    const words = cleaned.split(/\s+/).filter(w => w && w !== decimalWord);
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
