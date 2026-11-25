import { useSyncExternalStore } from 'react';
import { voiceLog } from './debugLog';

/**
 * Short generated tones for voice-mode feedback (no speech, so the recognizer
 * doesn't transcribe them). The AudioContext must be created/resumed during a
 * user tap on iOS, so call unlockBeep() from the mic button handler.
 *
 * Off by default: on iPhone, audio activity while the mic is in use may make
 * speech recognition unreliable (a test with beeps on went deaf right away).
 * The user can turn it on next to the mic; the choice is remembered.
 */
let ctx: AudioContext | null = null;

const KEY = 'voiceBeep';
let enabled = (() => {
  try { return localStorage.getItem(KEY) === '1'; } catch { return false; }
})();
const listeners = new Set<() => void>();
const beepEnabled = () => enabled;

export const setBeepEnabled = (on: boolean) => {
  enabled = on;
  try { localStorage.setItem(KEY, on ? '1' : '0'); } catch { /* ignore */ }
  voiceLog(`beeps ${on ? 'ON' : 'OFF'}`);
  listeners.forEach(l => l());
};

export const useBeepEnabled = () => useSyncExternalStore(
  (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; },
  beepEnabled,
);

export const unlockBeep = () => {
  if (!beepEnabled()) return;
  try {
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    ctx ??= new Ctor();
    if (ctx.state !== 'running') ctx.resume().catch(() => {});
    voiceLog('beep audio unlocked');
  } catch (e) {
    voiceLog(`beep unavailable: ${e instanceof Error ? e.message : String(e)}`);
  }
};

/** Plays tones (Hz) one after another, each `ms` long. */
const playTones = (tones: number[], ms = 110, gap = 40) => {
  if (!beepEnabled()) return;
  if (!ctx) {
    voiceLog('beep skipped: audio not unlocked');
    return;
  }
  try {
    if (ctx.state !== 'running') ctx.resume().catch(() => {});
    let t = ctx.currentTime + 0.02;
    for (const freq of tones) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      // Short fade in/out to avoid clicks.
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.3, t + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + ms / 1000);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + ms / 1000 + 0.02);
      t += (ms + gap) / 1000;
    }
    voiceLog(`beep ${tones.join('/')}Hz (audio ${ctx.state})`);
  } catch (e) {
    voiceLog(`beep failed: ${e instanceof Error ? e.message : String(e)}`);
  }
};

/** One short tick: a value was recorded. */
export const beepValue = () => playTones([1046], 70);

/** Two rising tones: moved on to a new row. */
export const beepNewRow = () => playTones([880, 1320]);
