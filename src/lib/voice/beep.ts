import { voiceLog } from './debugLog';

/**
 * Short generated tones for voice-mode feedback (no speech, so the recognizer
 * doesn't transcribe them). The AudioContext must be created/resumed during a
 * user tap on iOS, so call unlockBeep() from the mic button handler.
 * Disable for testing: localStorage.voiceBeep = '0'.
 */
let ctx: AudioContext | null = null;

const beepEnabled = () => {
  try { return localStorage.getItem('voiceBeep') !== '0'; } catch { return true; }
};

export const unlockBeep = () => {
  if (!beepEnabled()) return;
  try {
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    ctx ??= new Ctor();
    if (ctx.state !== 'running') ctx.resume().catch(() => {});
  } catch (e) {
    voiceLog(`beep unavailable: ${e instanceof Error ? e.message : String(e)}`);
  }
};

/** Plays tones (Hz) one after another, each `ms` long. */
const playTones = (tones: number[], ms = 110, gap = 40) => {
  if (!ctx || !beepEnabled()) return;
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

/** Two rising tones: moved on to a new row. */
export const beepNewRow = () => playTones([880, 1320]);
