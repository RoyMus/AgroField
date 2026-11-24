import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
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

/*
 * How it works
 * ------------
 * Every listening session uses a brand-new recognizer. Its event handlers
 * only act while it is still the current one, so we never wait for an engine
 * to confirm a start or a stop (Android Chrome and iOS Safari sometimes never
 * do, which used to leave voice input stuck). To stop or pause we simply drop
 * the current recognizer; to start or resume we create a new one.
 *
 * A session ends after one utterance (or silence, or an error); if voice mode
 * is still on, the next session starts right away. A once-a-second check
 * restarts anything that went quiet.
 */

// Errors after which retrying is pointless.
const FATAL_ERRORS = ['service-not-allowed', 'language-not-supported'];
// Fatal only if voice input never worked since the user tapped the mic; once
// it has worked, Android also reports these briefly while the mic is busy.
const FATAL_UNTIL_WORKING = ['not-allowed', 'audio-capture'];
// Normal session endings, not worth reporting.
const SILENT_ERRORS = ['no-speech', 'aborted'];
// After a read-back, wait this long before listening again. Read-backs often
// come in pairs (the value, then the next column's name); without the wait a
// session would start and be aborted a moment later, and starting/aborting
// a recognizer before it is ready can leave Safari unable to listen. It also
// lets the audio switch from playback back to the mic, and skips the echo.
const RESUME_DELAY_MS = 300;
// Gap between one session ending and the next starting, so the engine can
// release the mic first.
const RESTART_DELAY_MS = 150;
// A session that hasn't started after this long, or has been silent this
// long, is considered dead and replaced.
const START_TIMEOUT_MS = 4000;
const SILENCE_TIMEOUT_MS = 15000;
// A session shorter than this "ended instantly".
const QUICK_END_MS = 500;
// Instant ends in a row, before anything was recognized, before giving up
// (iOS does this, without an error, when the mic was denied on the page).
const MAX_QUICK_ENDS = 5;
// Sessions in a row that heard nothing, before the first result, before
// telling the user we can't hear them.
const MAX_EMPTY_SESSIONS = 2;
// Unexpected errors in a row before telling the user.
const MAX_TRANSIENT_ERRORS = 3;
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

const getRecognitionCtor = () =>
  typeof window === 'undefined' ? undefined : window.SpeechRecognition || window.webkitSpeechRecognition;

export const useVoiceRecording = (config: VoiceRecordingConfig): UseVoiceRecordingReturn => {
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [interim, setInterim] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [lastHeard, setLastHeard] = useState<{ text: string; at: number } | null>(null);

  const configRef = useRef(config);
  configRef.current = config;
  const resultCallbackRef = useRef<((result: VoiceResult) => void) | null>(null);

  // All mutable state lives here, so the controller below is created once.
  const s = useRef({
    wanted: false,      // voice mode is on (user intent)
    paused: false,      // suspended while TTS speaks
    rec: null as SpeechRecognition | null, // the current session's recognizer
    startedAt: 0,       // when the current session was created
    lastEventAt: 0,     // last event from the current session
    confirmed: false,   // current session fired onstart
    gotResult: false,   // current session recognized something
    everWorked: false,  // something was recognized since the user tapped the mic
    quickEnds: 0,
    emptySessions: 0,
    transientErrors: 0,
    segments: [] as Segment[],
    delivered: 0,       // segments of the current session already delivered
    restartTimer: null as ReturnType<typeof setTimeout> | null,
    settleTimer: null as ReturnType<typeof setTimeout> | null,
  }).current;

  const ctl = useMemo(() => {
    const clearRestart = () => {
      if (s.restartTimer) clearTimeout(s.restartTimer);
      s.restartTimer = null;
    };
    const clearSettle = () => {
      if (s.settleTimer) clearTimeout(s.settleTimer);
      s.settleTimer = null;
    };

    const deliver = (alternatives: string[]) => {
      if (alternatives[0]?.trim()) setLastHeard({ text: alternatives[0].trim(), at: Date.now() });
      const classified = classifyTranscript(alternatives, configRef.current);
      if (classified) resultCallbackRef.current?.(classified);
    };

    /** Delivers everything heard since the last delivery as one utterance. */
    const flush = () => {
      clearSettle();
      const pending = s.segments.slice(s.delivered);
      s.delivered = s.segments.length;
      setInterim('');
      const alternatives = joinSegments(pending);
      if (alternatives.length) deliver(alternatives);
    };

    /** Drops the current recognizer without waiting for it; discards unsent speech. */
    const kill = () => {
      clearSettle();
      const rec = s.rec;
      s.rec = null;
      setInterim('');
      setIsListening(false);
      if (!rec) return;
      rec.onstart = rec.onresult = rec.onerror = rec.onend = null;
      try { rec.abort(); } catch { /* already stopped */ }
    };

    const scheduleRestart = (delay: number) => {
      clearRestart();
      s.restartTimer = setTimeout(() => { s.restartTimer = null; startSession(); }, delay);
    };

    /** Turns voice mode off and shows an error. */
    const fail = (code: string) => {
      console.error('Speech recognition stopped:', code);
      s.wanted = false;
      clearRestart();
      kill();
      setIsRecording(false);
      setError(code);
    };

    /** The current session is over: deliver what's left and start the next one. */
    const endSession = () => {
      if (!s.rec) return;
      const lived = Date.now() - s.startedAt;
      const gotResult = s.gotResult;
      flush(); // may pause us (the result triggers a read-back)
      kill();
      if (!s.wanted || s.paused) return;

      s.quickEnds = lived < QUICK_END_MS ? s.quickEnds + 1 : 0;
      if (!s.everWorked) {
        if (s.quickEnds >= MAX_QUICK_ENDS) return fail('stalled');
        if (!gotResult && lived >= QUICK_END_MS && ++s.emptySessions === MAX_EMPTY_SESSIONS) setError('no-input');
      }
      // Back off if the engine keeps ending instantly.
      scheduleRestart(s.quickEnds ? Math.min(2000, 100 * 2 ** s.quickEnds) : RESTART_DELAY_MS);
    };

    const startSession = () => {
      clearRestart();
      if (!s.wanted || s.paused || s.rec) return;
      const Ctor = getRecognitionCtor();
      if (!Ctor) return fail('unsupported');

      const rec = new Ctor();
      // One utterance per session: continuous=true is unreliable on iOS
      // Safari and duplicates results on Android Chrome.
      rec.continuous = false;
      rec.interimResults = true;
      rec.lang = configRef.current.speechLang;
      rec.maxAlternatives = 5;

      s.rec = rec;
      s.startedAt = s.lastEventAt = Date.now();
      s.confirmed = false;
      s.gotResult = false;
      s.segments = [];
      s.delivered = 0;
      const current = () => s.rec === rec;

      rec.onstart = () => {
        if (!current()) return;
        s.confirmed = true;
        s.lastEventAt = Date.now();
        setIsListening(true);
      };

      rec.onresult = (event) => {
        if (!current()) return;
        s.lastEventAt = Date.now();
        s.gotResult = s.everWorked = true;
        s.emptySessions = 0;
        s.transientErrors = 0;

        // Snapshot every segment (resultIndex is unreliable on iOS).
        const segments: Segment[] = [];
        for (let i = 0; i < event.results.length; i++) {
          const result = event.results[i];
          const transcripts: string[] = [];
          for (let j = 0; j < result.length; j++) transcripts.push(result[j].transcript);
          segments.push({ transcripts, isFinal: result.isFinal });
        }
        s.segments = segments;
        if (s.delivered > segments.length) s.delivered = 0;

        const pending = segments.slice(s.delivered);
        setInterim(pending.map(p => p.transcripts[0]?.trim() ?? '').join(' ').trim());
        // iOS may split one utterance into several final segments: wait a
        // moment for more before delivering.
        clearSettle();
        if (pending.length > 0 && pending.every(p => p.isFinal)) s.settleTimer = setTimeout(flush, UTTERANCE_SETTLE_MS);
      };

      rec.onerror = (event) => {
        if (!current()) return;
        const code = event.error;
        if (FATAL_ERRORS.includes(code) || (FATAL_UNTIL_WORKING.includes(code) && !s.everWorked)) return fail(code);
        if (!SILENT_ERRORS.includes(code)) {
          console.warn('Speech recognition error:', code);
          if (++s.transientErrors === MAX_TRANSIENT_ERRORS) setError(code);
        }
        // Don't rely on onend following an error.
        endSession();
      };

      rec.onend = () => { if (current()) endSession(); };

      try {
        rec.start();
      } catch (e) {
        console.warn('Speech recognition start() failed:', e);
        s.rec = null;
        scheduleRestart(500);
      }
    };

    /** Replaces a session that never started or went silent; restarts if none is running. */
    const watchdog = () => {
      if (!s.wanted || s.paused) return;
      if (!s.rec) {
        if (!s.restartTimer) startSession();
        return;
      }
      const now = Date.now();
      const dead = (!s.confirmed && now - s.startedAt > START_TIMEOUT_MS)
        || now - s.lastEventAt > SILENCE_TIMEOUT_MS;
      if (dead) {
        console.warn('Speech recognition session unresponsive; replacing it');
        kill();
        startSession();
      }
    };

    const start = () => {
      setError(null);
      if (!getRecognitionCtor()) {
        setError('unsupported');
        return;
      }
      clearRestart();
      kill(); // a tap always starts fresh
      Object.assign(s, { wanted: true, paused: false, everWorked: false, quickEnds: 0, emptySessions: 0, transientErrors: 0 });
      setIsRecording(true);
      // start() must run synchronously in the tap handler (iOS needs the user
      // gesture), so check the microphone permission alongside it.
      navigator.permissions?.query({ name: 'microphone' as PermissionName })
        .then(status => { if (status.state === 'denied' && s.wanted && !s.everWorked) fail('not-allowed'); })
        .catch(() => { /* Permissions API or 'microphone' not supported */ });
      startSession();
    };

    const stop = () => {
      s.wanted = false;
      s.paused = false;
      clearRestart();
      kill();
      setIsRecording(false);
    };

    const pause = () => {
      if (!s.wanted) return;
      s.paused = true;
      clearRestart();
      kill(); // so the read-back isn't captured as input
    };

    const resume = () => {
      if (!s.paused) return;
      s.paused = false;
      if (!s.wanted) return;
      s.quickEnds = 0;
      scheduleRestart(RESUME_DELAY_MS); // cancelled if pause() comes first
    };

    /** Language changed: restart the running session with the new language. */
    const restartIfRunning = () => {
      if (!s.rec) return;
      kill();
      startSession();
    };

    return { start, stop, pause, resume, watchdog, restartIfRunning };
  }, [s]);

  useEffect(() => {
    const timer = setInterval(ctl.watchdog, 1000);
    return () => {
      clearInterval(timer);
      ctl.stop();
    };
  }, [ctl]);

  const langRef = useRef(config.speechLang);
  useEffect(() => {
    if (langRef.current === config.speechLang) return;
    langRef.current = config.speechLang;
    ctl.restartIfRunning();
  }, [config.speechLang, ctl]);

  const onResult = useCallback((callback: (result: VoiceResult) => void) => {
    resultCallbackRef.current = callback;
  }, []);

  const startRecording = useCallback(async () => ctl.start(), [ctl]);
  const stopRecording = useCallback(async () => ctl.stop(), [ctl]);

  return {
    isRecording,
    startRecording,
    stopRecording,
    pause: ctl.pause,
    resume: ctl.resume,
    error,
    interim,
    isListening,
    lastHeard,
    onResult,
  };
};
