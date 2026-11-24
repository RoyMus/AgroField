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
  /**
   * Error code: a SpeechRecognition error ('not-allowed', 'service-not-allowed',
   * 'network', ...), 'unsupported' when the browser has no speech API, or
   * 'stalled' when the engine keeps stopping without saying why, or
   * 'no-input' when nothing was heard since voice mode started (still listening).
   */
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
const FATAL_ERRORS = ['service-not-allowed', 'language-not-supported'];
// Fatal only if voice input never worked since the user tapped the mic.
// Once it has worked, Android also reports these briefly while the mic is
// still busy (e.g. right after the read-back), so retry instead.
const FATAL_UNTIL_WORKING = ['not-allowed', 'audio-capture'];
// Results arriving this soon after TTS ends are likely the TTS echo.
const ECHO_GUARD_MS = 350;
// Some engines (Android Chrome, iOS Safari) occasionally never confirm a
// stop (no onend after abort) or a start (no onstart). Treat the engine as
// stopped after these delays instead of waiting forever.
const ABORT_CONFIRM_MS = 1500;
const START_CONFIRM_MS = 4000;
// Transient errors in a row before we tell the user something is wrong.
const MAX_TRANSIENT_ERRORS = 3;
// Sessions in a row that end almost immediately before we give up. iOS does
// this without any error event when the microphone was denied earlier on the
// page, which used to leave the UI looking like it was listening.
const MAX_QUICK_ENDS = 5;
// Sessions in a row that end without hearing anything, before the first
// result, after which we tell the user we can't hear them.
const MAX_EMPTY_SESSIONS = 2;
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

  // A clearly recognized number wins over a command found only in a
  // lower-ranked alternative (e.g. "שמונה" with "הבא" as alternative #4).
  const num = parseNumber(top, lang, config.numberWords, config.decimalWord);
  if (num !== null) return { kind: 'number', value: num };

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
  const transientErrorsRef = useRef(0);
  // When we last asked the engine to abort, until it confirms with onend (0 = none pending).
  const abortRequestedAtRef = useRef(0);
  // Whether the engine confirmed the last start() with onstart.
  const startConfirmedRef = useRef(false);
  // Since the user last tapped the mic: has anything been recognized?
  const hadResultRef = useRef(false);
  // Did the current session produce any result? / Sessions in a row without one.
  const sessionHadResultRef = useRef(false);
  const emptySessionsRef = useRef(0);

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
      startConfirmedRef.current = false;
      abortRequestedAtRef.current = 0;
      recognition.start();
    } catch {
      // start() throws if already started; onend (or the watchdog) will retry.
      runningRef.current = false;
    }
  }, []);

  useEffect(() => {
    const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) {
      setError('unsupported');
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
      startConfirmedRef.current = true;
      sessionHadResultRef.current = false;
      resetSegments();
      setIsRecording(true);
      if (!pausedRef.current) setIsListening(true);
    };

    recognition.onresult = (event) => {
      lastEventRef.current = Date.now();
      transientErrorsRef.current = 0;
      hadResultRef.current = true;
      sessionHadResultRef.current = true;
      emptySessionsRef.current = 0;
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
      const fatal = FATAL_ERRORS.includes(event.error)
        || (FATAL_UNTIL_WORKING.includes(event.error) && !hadResultRef.current);
      if (fatal) {
        console.error('Speech recognition error:', event.error);
        wantsRecordingRef.current = false;
        clearRestartTimer();
        setError(event.error);
        setIsRecording(false);
        setIsListening(false);
      } else if (event.error !== 'no-speech' && event.error !== 'aborted') {
        console.warn('Speech recognition transient error:', event.error);
        // e.g. 'network' when the device can't reach the speech service:
        // keep retrying, but let the user know after a few failures.
        transientErrorsRef.current += 1;
        if (transientErrorsRef.current === MAX_TRANSIENT_ERRORS) setError(event.error);
      }
    };

    recognition.onend = () => {
      lastEventRef.current = Date.now();
      runningRef.current = false;
      abortRequestedAtRef.current = 0;
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

      // Nothing heard at all since the mic was tapped: tell the user once,
      // but keep listening (they may just not have spoken yet).
      if (!sessionHadResultRef.current && lived >= 500 && !hadResultRef.current) {
        emptySessionsRef.current += 1;
        if (emptySessionsRef.current === MAX_EMPTY_SESSIONS) setError('no-input');
      }

      // Give up only if it never worked: that's a blocked mic (iOS ends every
      // session instantly without an error). Once it has worked, an instant
      // end is a transient hiccup, so keep retrying with backoff.
      if (quickEndsRef.current >= MAX_QUICK_ENDS && !hadResultRef.current) {
        console.error('Speech recognition keeps ending immediately; giving up');
        wantsRecordingRef.current = false;
        quickEndsRef.current = 0;
        setIsRecording(false);
        setError('stalled');
        return;
      }
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
      const now = Date.now();
      // Asked to stop but never confirmed: consider it stopped, so voice
      // input doesn't stay dead after a read-back or a stop/start.
      if (runningRef.current && abortRequestedAtRef.current && now - abortRequestedAtRef.current > ABORT_CONFIRM_MS) {
        console.warn('Speech recognition never confirmed abort; treating as stopped');
        runningRef.current = false;
        abortRequestedAtRef.current = 0;
      }
      // Asked to start but it never did: reset and try again.
      if (runningRef.current && !startConfirmedRef.current && !abortRequestedAtRef.current
          && now - lastStartRef.current > START_CONFIRM_MS) {
        console.warn('Speech recognition never started; retrying');
        runningRef.current = false;
        try { recognition.abort(); } catch { /* ignore */ }
      }
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
    }, 1000);

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
    if (!recognitionRef.current) {
      setError('unsupported');
      return;
    }
    wantsRecordingRef.current = true;
    pausedRef.current = false;
    quickEndsRef.current = 0;
    transientErrorsRef.current = 0;
    hadResultRef.current = false;
    emptySessionsRef.current = 0;
    clearRestartTimer();
    // After stop(), some browsers (Android Chrome) never confirm the old
    // session ended, which used to block restarting. The user just tapped,
    // so start fresh; if the old session is in fact still closing, start()
    // throws and its onend (or the watchdog) restarts us.
    if (runningRef.current) {
      runningRef.current = false;
      abortRequestedAtRef.current = 0;
      try { recognitionRef.current.abort(); } catch { /* ignore */ }
    }
    // start() must run synchronously in the tap handler (iOS needs the user
    // gesture), so check the microphone permission alongside it, not before.
    navigator.permissions?.query({ name: 'microphone' as PermissionName })
      .then(status => {
        if (status.state !== 'denied' || !wantsRecordingRef.current) return;
        wantsRecordingRef.current = false;
        clearRestartTimer();
        recognitionRef.current?.abort();
        setIsRecording(false);
        setIsListening(false);
        setError('not-allowed');
      })
      .catch(() => { /* Permissions API or 'microphone' name not supported */ });
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
    if (runningRef.current) abortRequestedAtRef.current = Date.now();
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
    if (runningRef.current) abortRequestedAtRef.current = Date.now();
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
