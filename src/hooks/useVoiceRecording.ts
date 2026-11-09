import { useState, useRef, useCallback, useEffect } from 'react';
import { parseNumber, normalizeHebrew } from '@/lib/voice/hebrewNumbers';
import { matchCommand, tokenize, CommandName, CommandWords, SHORT_UTTERANCE_WORDS } from '@/lib/voice/commands';

export interface VoiceRecordingConfig {
  speechLang: string;
  numberWords: { [word: string]: string };
  decimalWord: string;
  commands: CommandWords;
}

export type VoiceResult =
  | { kind: 'command'; command: CommandName; rest: string }
  | { kind: 'number'; value: string }
  | { kind: 'text'; text: string };

interface UseVoiceRecordingReturn {
  isRecording: boolean;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<void>;
  /** Temporarily stop listening (e.g. while TTS speaks) without leaving voice mode. */
  pause: () => void;
  /** Resume listening after pause(); no-op if voice mode was turned off. */
  resume: () => void;
  error: string | null;
  /** Live, not-yet-final transcript. */
  interim: string;
  /** True only while the engine is actually capturing speech (not paused for TTS, not restarting). */
  isListening: boolean;
  /** The last final transcript, so the user can see what was heard. */
  lastHeard: { text: string; at: number } | null;
  onResult: (callback: (result: VoiceResult) => void) => void;
}

// Errors after which retrying is pointless.
const FATAL_ERRORS = ['not-allowed', 'service-not-allowed', 'audio-capture', 'language-not-supported'];
// Results arriving this soon after TTS ends are likely the TTS echo.
const ECHO_GUARD_MS = 350;
// iOS splits one utterance into several final segments ("אחת." + "שלוש").
// Wait this long after the last final segment before treating the utterance
// as complete, so the segments are parsed together.
const UTTERANCE_SETTLE_MS = 800;

interface Segment { transcripts: string[]; isFinal: boolean; }

/** Merges a session's segments into one list of alternatives. */
export const joinSegments = (segments: Segment[]): string[] => {
  const parts = segments.filter(s => s.transcripts[0]?.trim());
  if (parts.length === 0) return [];
  if (parts.length === 1) return parts[0].transcripts;
  return [parts.map(p => p.transcripts[0].trim()).join(' ').replace(/\s+/g, ' ')];
};

/** Classifies a final result (with its alternatives) into command / number / text. */
export const classifyTranscript = (
  alternatives: string[],
  config: VoiceRecordingConfig,
): VoiceResult | null => {
  const alts = alternatives.map(a => a.trim()).filter(Boolean);
  if (alts.length === 0) return null;
  const [top] = alts;
  const lang = config.speechLang;
  const topWords = tokenize(top).length;

  const cmd = matchCommand(top, config.commands, lang);
  if (cmd) return { kind: 'command', ...cmd };

  // The recognizer sometimes mishears a short command ("ship" for "skip") but
  // returns it as a lower-ranked alternative. Only consider this for short
  // utterances so dictated sentences are never hijacked.
  if (topWords <= 2) {
    for (const alt of alts.slice(1)) {
      if (tokenize(alt).length > 2) continue;
      const altCmd = matchCommand(alt, config.commands, lang);
      if (altCmd) return { kind: 'command', ...altCmd };
    }
  }

  const num = parseNumber(top, lang, config.numberWords, config.decimalWord);
  if (num !== null) return { kind: 'number', value: num };

  if (topWords <= SHORT_UTTERANCE_WORDS + 1) {
    for (const alt of alts.slice(1)) {
      const altNum = parseNumber(alt, lang, config.numberWords, config.decimalWord);
      if (altNum !== null) return { kind: 'number', value: altNum };
    }
  }

  const text = (lang.startsWith('he') ? normalizeHebrew(top) : top).replace(/\s+/g, ' ').trim();
  return text ? { kind: 'text', text } : null;
};

export const useVoiceRecording = (config: VoiceRecordingConfig): UseVoiceRecordingReturn => {
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [interim, setInterim] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [lastHeard, setLastHeard] = useState<{ text: string; at: number } | null>(null);
  // Segments of the current session, and how many were already delivered.
  const segmentsRef = useRef<Segment[]>([]);
  const deliveredCountRef = useRef(0);
  const settleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const resultCallbackRef = useRef<((result: VoiceResult) => void) | null>(null);
  const configRef = useRef(config);

  // User intent: voice mode is on.
  const wantsRecordingRef = useRef(false);
  // Listening is suspended (TTS speaking).
  const pausedRef = useRef(false);
  // The engine is currently running (between onstart and onend).
  const runningRef = useRef(false);
  const ignoreUntilRef = useRef(0);
  const lastStartRef = useRef(0);
  // Last time the engine reported anything (start/result/end).
  const lastEventRef = useRef(0);
  const quickEndsRef = useRef(0);
  const restartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    configRef.current = config;
  });

  const onResult = useCallback((callback: (result: VoiceResult) => void) => {
    resultCallbackRef.current = callback;
  }, []);

  const clearRestartTimer = () => {
    if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
    restartTimerRef.current = null;
  };

  const clearSettleTimer = () => {
    if (settleTimerRef.current) clearTimeout(settleTimerRef.current);
    settleTimerRef.current = null;
  };

  const resetSegments = () => {
    clearSettleTimer();
    segmentsRef.current = [];
    deliveredCountRef.current = 0;
  };

  /** Delivers everything heard since the last delivery as one utterance. */
  const flushUtterance = () => {
    clearSettleTimer();
    const pending = segmentsRef.current.slice(deliveredCountRef.current);
    deliveredCountRef.current = segmentsRef.current.length;
    setInterim('');
    const alternatives = joinSegments(pending);
    if (alternatives.length) deliver(alternatives);
  };

  const deliver = (alternatives: string[]) => {
    console.log('Final alternatives:', alternatives);
    if (alternatives[0]?.trim()) setLastHeard({ text: alternatives[0].trim(), at: Date.now() });
    const classified = classifyTranscript(alternatives, configRef.current);
    if (classified) {
      console.log('Voice result:', classified);
      resultCallbackRef.current?.(classified);
    }
  };

  const safeStart = useCallback(() => {
    const recognition = recognitionRef.current;
    if (!recognition || runningRef.current) return;
    if (!wantsRecordingRef.current || pausedRef.current) return;
    try {
      lastStartRef.current = Date.now();
      lastEventRef.current = Date.now();
      // Mark as running right away so the watchdog doesn't double-start
      // before onstart arrives; onend/onerror clear it.
      runningRef.current = true;
      recognition.start();
    } catch {
      // start() throws if already started; onend (or the watchdog) will retry.
      runningRef.current = false;
    }
  }, []);

  useEffect(() => {
    const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) {
      setError('Speech Recognition is not supported in this browser. Please use Chrome or Safari.');
      return;
    }

    const recognition = new SpeechRecognitionCtor();
    // One utterance per session: the engine finalizes quickly after the user
    // stops talking, and onend restarts it. continuous=true is unreliable on
    // iOS Safari and duplicates results on Android Chrome.
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = config.speechLang;
    recognition.maxAlternatives = 5;

    recognition.onstart = () => {
      lastEventRef.current = Date.now();
      runningRef.current = true;
      resetSegments();
      setIsRecording(true);
      if (!pausedRef.current) setIsListening(true);
    };

    recognition.onresult = (event) => {
      lastEventRef.current = Date.now();
      if (pausedRef.current || Date.now() < ignoreUntilRef.current) return;

      // Snapshot every segment of the session. resultIndex is unreliable on
      // iOS, so always read the full list.
      const segments: Segment[] = [];
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        const transcripts: string[] = [];
        for (let j = 0; j < result.length; j++) transcripts.push(result[j].transcript);
        segments.push({ transcripts, isFinal: result.isFinal });
      }
      segmentsRef.current = segments;
      if (deliveredCountRef.current > segments.length) deliveredCountRef.current = 0;

      const pending = segments.slice(deliveredCountRef.current);
      setInterim(pending.map(s => s.transcripts[0]?.trim() ?? '').join(' ').trim());

      clearSettleTimer();
      if (pending.length > 0 && pending.every(s => s.isFinal)) {
        settleTimerRef.current = setTimeout(flushUtterance, UTTERANCE_SETTLE_MS);
      }
    };

    recognition.onerror = (event) => {
      if (FATAL_ERRORS.includes(event.error)) {
        console.error('Speech recognition error:', event.error);
        wantsRecordingRef.current = false;
        setError(`Speech recognition error: ${event.error}`);
        setIsRecording(false);
      } else if (event.error !== 'no-speech' && event.error !== 'aborted') {
        console.warn('Speech recognition transient error:', event.error);
      }
    };

    recognition.onend = () => {
      lastEventRef.current = Date.now();
      runningRef.current = false;
      setIsListening(false);

      // Session over: deliver whatever is left, including segments that were
      // never marked final (Android Chrome sometimes skips the final result).
      if (wantsRecordingRef.current && !pausedRef.current) flushUtterance();
      else resetSegments();
      setInterim('');

      if (!wantsRecordingRef.current) {
        setIsRecording(false);
        return;
      }
      if (pausedRef.current) return; // resume() will restart

      // Back off if the engine keeps ending immediately (e.g. network trouble).
      const lived = Date.now() - lastStartRef.current;
      quickEndsRef.current = lived < 500 ? quickEndsRef.current + 1 : 0;
      const delay = quickEndsRef.current === 0 ? 0 : Math.min(2000, 100 * 2 ** quickEndsRef.current);
      clearRestartTimer();
      restartTimerRef.current = setTimeout(() => {
        restartTimerRef.current = null;
        safeStart();
      }, delay);
    };

    recognitionRef.current = recognition;

    // Watchdog: if voice mode is on but the engine silently stopped (a missed
    // onend, or a start() that threw), start it again.
    const watchdog = setInterval(() => {
      // A session that has said nothing for 15s is hung (normal ones end
      // within ~10s of silence): reset it.
      if (runningRef.current && !pausedRef.current && Date.now() - lastEventRef.current > 15000) {
        console.warn('Speech recognition appears stuck; restarting');
        runningRef.current = false;
        lastEventRef.current = Date.now();
        try { recognition.abort(); } catch { /* ignore */ }
        return;
      }
      if (wantsRecordingRef.current && !pausedRef.current && !runningRef.current && !restartTimerRef.current) {
        safeStart();
      }
    }, 2000);

    return () => {
      clearInterval(watchdog);
      clearRestartTimer();
      clearSettleTimer();
      recognition.onend = null;
      recognition.abort();
      runningRef.current = false;
      recognitionRef.current = null;
      // A language change creates a new engine; keep voice mode going if it was on.
      if (wantsRecordingRef.current) setTimeout(safeStart, 0);
    };
  }, [config.speechLang, safeStart]);

  const startRecording = useCallback(async () => {
    setError(null);
    wantsRecordingRef.current = true;
    pausedRef.current = false;
    quickEndsRef.current = 0;
    safeStart();
  }, [safeStart]);

  const stopRecording = useCallback(async () => {
    wantsRecordingRef.current = false;
    pausedRef.current = false;
    clearRestartTimer();
    resetSegments();
    setInterim('');
    setIsRecording(false);
    setIsListening(false);
    recognitionRef.current?.abort();
  }, []);

  const pause = useCallback(() => {
    if (!wantsRecordingRef.current) return;
    pausedRef.current = true;
    clearRestartTimer();
    resetSegments();
    setInterim('');
    setIsListening(false);
    // abort() discards any pending result so TTS isn't captured as input.
    recognitionRef.current?.abort();
  }, []);

  const resume = useCallback(() => {
    if (!pausedRef.current) return;
    pausedRef.current = false;
    if (!wantsRecordingRef.current) return;
    ignoreUntilRef.current = Date.now() + ECHO_GUARD_MS;
    quickEndsRef.current = 0;
    safeStart(); // if still shutting down, onend restarts it
  }, [safeStart]);

  return {
    isRecording,
    startRecording,
    stopRecording,
    pause,
    resume,
    error,
    interim,
    isListening,
    lastHeard,
    onResult,
  };
};
