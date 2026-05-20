
import { useState, useRef, useCallback, useEffect } from 'react';
import PlaySound from './playSound';
import startSound from '../voices/startSound.mp3';

export interface VoiceRecordingConfig {
  speechLang: string;
  numberWords: { [word: string]: string };
  decimalWord: string;
  allowedCharPattern: RegExp;
  commands?: {
    skip: string[];
    back: string[];
    delete: string[];
    save: string[];
  };
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
  // Tracks user intent so onend can distinguish "user stopped" from "utterance ended".
  const wantsRecordingRef = useRef(false);

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

    // continuous=false makes the engine finalize each utterance as soon as it
    // detects end-of-speech, eliminating the lag caused by waiting for a long
    // silence. onend auto-restarts the session so recording feels continuous.
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = config.speechLang;
    // Request multiple alternatives so we can scan all of them for command words
    // before committing to the top result as a value.
    // maxAlternatives is missing from TypeScript's SpeechRecognition types.
    (recognition as any).maxAlternatives = 5;

    recognition.onstart = () => {
      setIsRecording(true);
      console.log('Speech recognition started');
    };

    recognition.onresult = (event) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (!event.results[i].isFinal) continue;

        const alternatives: string[] = [];
        for (let j = 0; j < event.results[i].length; j++) {
          alternatives.push(event.results[i][j].transcript);
        }

        if (alternatives.length > 0) {
          console.log('Final alternatives:', alternatives);
          processTranscript(alternatives);
        }
      }
    };

    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      setError(`Speech recognition error: ${event.error}`);
      setIsRecording(false);
    };

    recognition.onend = () => {
      if (wantsRecordingRef.current) {
        // Utterance finished — restart immediately for the next one.
        try {
          recognition.start();
        } catch {
          // start() can throw if called while already active; safe to ignore.
        }
      } else {
        setIsRecording(false);
        console.log('Speech recognition ended');
      }
    };

    recognitionRef.current = recognition;

    return () => {
      recognitionRef.current?.stop();
    };
  }, [config.speechLang]); // Restart recognition instance when language changes

  const translateWord = (word: string): string => {
    const trimmed = word.trim();
    const lower = trimmed.toLowerCase();
    return configRef.current.numberWords[lower] ?? configRef.current.numberWords[trimmed] ?? trimmed;
  };

  const processValue = (transcript: string): void => {
    if (!wordCallbackRef.current) return;

    const { allowedCharPattern, decimalWord } = configRef.current;

    const cleaned = transcript.replace(allowedCharPattern, '').trim();
    if (!cleaned) return;

    // Escape the decimal word for use in regex
    const decEscaped = decimalWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // Check for decimal pattern (e.g. "one point two" / "אחת נקודה שתיים")
    const decimalMatch = cleaned.match(
      new RegExp(`^(.+?)\\s+${decEscaped}\\s+(.+)$`)
    );
    if (decimalMatch) {
      const firstPart = decimalMatch[1]?.trim();
      const secondPart = decimalMatch[2]?.trim();

      if (firstPart && secondPart) {
        const firstNum = translateWord(firstPart);
        const secondNum = translateWord(secondPart);

        if (/^\d+$/.test(firstNum) && /^\d+$/.test(secondNum)) {
          wordCallbackRef.current(`${firstNum}.${secondNum}`);
          return;
        }
      }
    }

    // Translate all words and fire a single callback so a transcript like
    // "skip fifteen" doesn't trigger two separate actions (command + value).
    const words = cleaned.split(/\s+/).filter(w => w && w !== decimalWord);
    const translated = words.map(w => translateWord(w)).filter(Boolean).join(' ')
      .replace(/(\d+)\s+(\.\d+)/g, '$1$2');
    if (translated && wordCallbackRef.current) {
      wordCallbackRef.current(translated);
    }
  };

  const processTranscript = (alternatives: string[]): void => {
    if (!wordCallbackRef.current || alternatives.length === 0) return;

    const { commands } = configRef.current;

    // Scan every alternative for a command word before falling back to the
    // top result as a value. This catches cases where the recognizer mishears
    // the command (e.g. "ship" instead of "skip") but returns the correct word
    // as a lower-ranked alternative.
    if (commands) {
      const allCommands = [
        ...commands.skip,
        ...commands.back,
        ...commands.delete,
        ...commands.save,
      ];
      for (const alt of alternatives) {
        const lower = alt.toLowerCase().trim();
        if (allCommands.some(cmd => lower.includes(cmd.toLowerCase()))) {
          console.log('Command matched in alternative:', alt);
          wordCallbackRef.current(alt);
          return;
        }
      }
    }

    // No command match — treat the highest-confidence alternative as a value.
    processValue(alternatives[0]);
  };

  const startRecording = async () => {
    try {
      setError(null);
      wantsRecordingRef.current = true;
      recognitionRef.current.start();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start speech recognition');
      console.error('Error starting speech recognition:', err);
    }
  };

  const stopRecording = async (): Promise<void> => {
    wantsRecordingRef.current = false;
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
