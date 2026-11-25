import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { parseNumber, normalizeHebrew } from '@/lib/voice/hebrewNumbers';
import { voiceLog } from '@/lib/voice/debugLog';
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
  /**
   * Error code: a SpeechRecognition error ('not-allowed', 'service-not-allowed',
   * 'network', ...), 'unsupported' when the browser has no speech API, or
   * 'stalled' when the engine keeps stopping without saying why, or
   * 'no-input' when nothing was heard since voice mode started (still listening).
   */
  error: string | null;
  /** Live, not-yet-final transcript. */
  interim: string;
  /** True only while the engine is actually capturing speech (not between sessions). */
  isListening: boolean;
  /** The last final transcript, so the user can see what was heard. */
  lastHeard: { text: string; at: number } | null;
  onResult: (callback: (result: VoiceResult) => void) => void;
}

/*
 * How it works (kept deliberately simple)
 * ----------------------------------------
 * Voice mode is a loop of short listening sessions. Each session uses a new
 * recognizer, hears one utterance and ends by itself (continuous = false);
 * its transcript is delivered when it ends, and the next session starts a
 * moment later.
 *
 * The app never stops or aborts a working session (no read-back, no early
 * acceptance, no pausing): on iOS Safari, interrupting sessions and switching
 * audio is what left the mic deaf. The only exceptions are the user turning
 * voice mode off, and a watchdog that replaces a session that never starts
 * or reports nothing for a long time.
 */

// Errors after which retrying is pointless.
const FATAL_ERRORS = ['service-not-allowed', 'language-not-supported'];
// Fatal only if voice input never worked since the user tapped the mic; once
// it has worked, Android also reports these briefly while the mic is busy.
const FATAL_UNTIL_WORKING = ['not-allowed', 'audio-capture'];
// Normal session endings, not worth reporting.
const SILENT_ERRORS = ['no-speech', 'aborted'];
// Pause between one session ending and the next starting.
const RESTART_DELAY_MS = 250;
// A session that hasn't started after this long, or has reported nothing for
// this long, is replaced.
const START_TIMEOUT_MS = 5000;
const SILENCE_TIMEOUT_MS = 30000;
// Continuous mode (iOS): a phrase is delivered this long after its words
// stop changing, or shortly after the recognizer marks it final (iOS may
// split one phrase into several final segments: "אחת." + "שלוש").
const PHRASE_PAUSE_MS = 1200;
const FINAL_SETTLE_MS = 600;
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

/**
 * Use one continuous session for the whole of voice mode? On iOS Safari,
 * starting a new session after the previous one ended often gives a deaf
 * session (field logs), so iOS uses a single continuous session and splits
 * phrases itself. Elsewhere one session per utterance works.
 * Override for testing: localStorage.voiceContinuous = '1' | '0'.
 */
const shouldUseContinuousMode = (): boolean => {
  try {
    const override = localStorage.getItem('voiceContinuous');
    if (override === '1' || override === '0') return override === '1';
  } catch { /* ignore */ }
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
};

const wordsOf = (segments: Segment[]) =>
  segments.flatMap(seg => (seg.transcripts[0] ?? '').trim().split(/\s+/).filter(Boolean));

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
    rec: null as SpeechRecognition | null, // the current session's recognizer
    session: 0,         // number of the current session (for the debug log)
    startedAt: 0,
    lastEventAt: 0,
    confirmed: false,   // current session fired onstart
    segments: [] as Segment[], // what the current session has heard so far
    deliveredWords: 0,  // words of the current session already delivered
    phraseTimer: null as ReturnType<typeof setTimeout> | null,
    everWorked: false,  // something was recognized since the user tapped the mic
    quickEnds: 0,
    emptySessions: 0,
    transientErrors: 0,
    restartTimer: null as ReturnType<typeof setTimeout> | null,
  }).current;

  const ctl = useMemo(() => {
    const clearRestart = () => {
      if (s.restartTimer) clearTimeout(s.restartTimer);
      s.restartTimer = null;
    };

    const scheduleRestart = (delay: number) => {
      clearRestart();
      s.restartTimer = setTimeout(() => { s.restartTimer = null; startSession(); }, delay);
    };

    /** Drops the current recognizer immediately. Not used in the normal flow. */
    const kill = (reason: string) => {
      clearPhrase();
      const rec = s.rec;
      s.rec = null;
      setInterim('');
      setIsListening(false);
      if (!rec) return;
      voiceLog(`#${s.session} kill (${reason})`);
      rec.onstart = rec.onresult = rec.onerror = rec.onend = null;
      try { rec.abort(); } catch { /* already stopped */ }
    };

    /** Turns voice mode off and shows an error. */
    const fail = (code: string) => {
      console.error('Speech recognition stopped:', code);
      voiceLog(`FAIL: ${code} (voice mode off)`);
      s.wanted = false;
      clearRestart();
      kill('fail');
      setIsRecording(false);
      setError(code);
    };

    const clearPhrase = () => {
      if (s.phraseTimer) clearTimeout(s.phraseTimer);
      s.phraseTimer = null;
    };

    /** Delivers what the current session heard since the last delivery. */
    const deliverPending = (why: string) => {
      clearPhrase();
      const words = wordsOf(s.segments);
      const from = Math.min(s.deliveredWords, words.length);
      s.deliveredWords = words.length;
      setInterim('');
      if (from >= words.length) return;
      // Keep the recognizer's alternatives when the new part is exactly one
      // whole segment (they help with misheard commands); otherwise top text.
      let alternatives = [words.slice(from).join(' ')];
      let at = 0;
      for (const seg of s.segments) {
        const n = wordsOf([seg]).length;
        if (at === from && at + n === words.length) alternatives = seg.transcripts;
        at += n;
      }
      if (from === 0 && s.segments.length > 1) alternatives = joinSegments(s.segments);
      voiceLog(`deliver (${why}): ${JSON.stringify(alternatives.slice(0, 3))}`);
      deliver(alternatives);
    };

    const deliver = (alternatives: string[]) => {
      if (!alternatives.length || !alternatives[0]?.trim()) return;
      setLastHeard({ text: alternatives[0].trim(), at: Date.now() });
      const classified = classifyTranscript(alternatives, configRef.current);
      if (classified) resultCallbackRef.current?.(classified);
    };

    /** The session ended by itself (or errored): deliver what it heard, start the next. */
    const endSession = () => {
      const rec = s.rec;
      if (!rec) return;
      const lived = Date.now() - s.startedAt;
      const segments = s.segments;
      voiceLog(`#${s.session} ended after ${lived}ms`);
      rec.onstart = rec.onresult = rec.onerror = rec.onend = null;
      s.rec = null;
      setIsListening(false);
      deliverPending('session ended');
      if (!s.wanted) return;

      s.quickEnds = lived < QUICK_END_MS ? s.quickEnds + 1 : 0;
      if (!s.everWorked) {
        if (s.quickEnds >= MAX_QUICK_ENDS) return fail('stalled');
        if (segments.length === 0 && lived >= QUICK_END_MS && ++s.emptySessions === MAX_EMPTY_SESSIONS) setError('no-input');
      }
      // Back off if the engine keeps ending instantly.
      scheduleRestart(s.quickEnds ? Math.min(2000, 100 * 2 ** s.quickEnds) : RESTART_DELAY_MS);
    };

    const startSession = () => {
      clearRestart();
      if (!s.wanted || s.rec) return;
      const Ctor = getRecognitionCtor();
      if (!Ctor) return fail('unsupported');

      const rec = new Ctor();
      // One utterance per session (it ends by itself), or on iOS a single
      // continuous session for the whole of voice mode.
      rec.continuous = shouldUseContinuousMode();
      rec.interimResults = true;
      rec.lang = configRef.current.speechLang;
      rec.maxAlternatives = 5;

      s.rec = rec;
      s.session += 1;
      s.startedAt = s.lastEventAt = Date.now();
      s.confirmed = false;
      s.segments = [];
      s.deliveredWords = 0;
      clearPhrase();
      const id = s.session;
      const log = (m: string) => voiceLog(`#${id} ${m}`);
      const current = () => s.rec === rec;
      log(`start() lang=${rec.lang} continuous=${rec.continuous}`);

      rec.onstart = () => {
        log('onstart');
        if (!current()) return;
        s.confirmed = true;
        s.lastEventAt = Date.now();
        setIsListening(true);
      };
      rec.onaudiostart = () => log('audiostart');
      rec.onspeechstart = () => log('speechstart');
      rec.onaudioend = () => log('audioend');

      rec.onresult = (event) => {
        if (!current()) return;
        s.lastEventAt = Date.now();
        s.everWorked = true;
        s.emptySessions = 0;
        s.transientErrors = 0;
        // Keep every segment (resultIndex is unreliable on iOS); all of them
        // are delivered together when the session ends.
        const segments: Segment[] = [];
        for (let i = 0; i < event.results.length; i++) {
          const result = event.results[i];
          const transcripts: string[] = [];
          for (let j = 0; j < result.length; j++) transcripts.push(result[j].transcript);
          segments.push({ transcripts, isFinal: result.isFinal });
        }
        s.segments = segments;
        const words = wordsOf(segments);
        if (s.deliveredWords > words.length) {
          log(`transcript shrank below what was delivered (${words.length} < ${s.deliveredWords})`);
          s.deliveredWords = words.length;
        }
        const pending = words.slice(s.deliveredWords).join(' ');
        const allFinal = segments.every(p => p.isFinal);
        log(`heard: "${pending}"${allFinal ? ' (final)' : ''}`);
        setInterim(pending);
        // In continuous mode the session doesn't end after a phrase: deliver
        // it once it is final, or once the words stop changing.
        if (rec.continuous) {
          clearPhrase();
          if (pending) {
            s.phraseTimer = setTimeout(
              () => { if (current()) deliverPending(allFinal ? 'final' : 'pause'); },
              allFinal ? FINAL_SETTLE_MS : PHRASE_PAUSE_MS,
            );
          }
        }
      };

      rec.onerror = (event) => {
        log(`error: ${event.error}`);
        if (!current()) return;
        const code = event.error;
        if (FATAL_ERRORS.includes(code) || (FATAL_UNTIL_WORKING.includes(code) && !s.everWorked)) return fail(code);
        if (!SILENT_ERRORS.includes(code)) {
          console.warn('Speech recognition error:', code);
          if (++s.transientErrors === MAX_TRANSIENT_ERRORS) setError(code);
        }
        endSession(); // don't rely on onend following an error
      };

      rec.onend = () => { if (current()) endSession(); };

      try {
        rec.start();
      } catch (e) {
        log(`start() threw: ${e instanceof Error ? e.message : String(e)}`);
        s.rec = null;
        scheduleRestart(1000);
      }
    };

    /** Safety net: replaces a session that never started or went quiet for long. */
    const watchdog = () => {
      if (!s.wanted) return;
      if (!s.rec) {
        if (!s.restartTimer) startSession();
        return;
      }
      const now = Date.now();
      if (!s.confirmed && now - s.startedAt > START_TIMEOUT_MS) {
        kill('never started');
        startSession();
      } else if (!s.rec.continuous && now - s.lastEventAt > SILENCE_TIMEOUT_MS) {
        // (A continuous session is quiet whenever the user is; leave it.)
        kill('no events for 30s');
        startSession();
      }
    };

    const start = () => {
      setError(null);
      if (!getRecognitionCtor()) {
        setError('unsupported');
        return;
      }
      voiceLog('== mic tapped: voice mode ON');
      clearRestart();
      kill('tap');
      Object.assign(s, { wanted: true, everWorked: false, quickEnds: 0, emptySessions: 0, transientErrors: 0 });
      setIsRecording(true);
      // start() must run synchronously in the tap handler (iOS needs the user
      // gesture), so check the microphone permission alongside it.
      navigator.permissions?.query({ name: 'microphone' as PermissionName })
        .then(status => { if (status.state === 'denied' && s.wanted && !s.everWorked) fail('not-allowed'); })
        .catch(() => { /* Permissions API or 'microphone' not supported */ });
      startSession();
    };

    const stop = () => {
      if (s.wanted) voiceLog('== voice mode OFF');
      s.wanted = false;
      clearRestart();
      kill('stop');
      setIsRecording(false);
    };

    return { start, stop, watchdog };
  }, [s]);

  useEffect(() => {
    const timer = setInterval(ctl.watchdog, 1000);
    return () => {
      clearInterval(timer);
      ctl.stop();
    };
  }, [ctl]);

  // A language change takes effect from the next session.

  const onResult = useCallback((callback: (result: VoiceResult) => void) => {
    resultCallbackRef.current = callback;
  }, []);

  const startRecording = useCallback(async () => ctl.start(), [ctl]);
  const stopRecording = useCallback(async () => ctl.stop(), [ctl]);

  return {
    isRecording,
    startRecording,
    stopRecording,
    error,
    interim,
    isListening,
    lastHeard,
    onResult,
  };
};
