/**
 * Voice diagnostics log, for debugging devices we can't attach a console to.
 * Shown on screen by default (5 taps on the voice hint text toggle it) and
 * uploaded to Supabase (see voiceLogUpload.ts).
 *
 * TEMPORARY: remove (or default to hidden) once voice input is stable.
 */
const STORAGE_KEY = 'voiceDebug';
const MAX_ENTRIES = 150;

let entries: string[] = [];
const MAX_PENDING = 500;

// On unless the user closed it ('0').
let enabled = (() => {
  try { return localStorage.getItem(STORAGE_KEY) !== '0'; } catch { return true; }
})();
// Entries not yet uploaded.
let pending: { t: string; m: string }[] = [];
const listeners = new Set<() => void>();
const t0 = Date.now();
const notify = () => listeners.forEach(l => l());

/** Records an event (always, so the log is available as soon as it's opened). */
export const voiceLog = (message: string) => {
  const stamp = ((Date.now() - t0) / 1000).toFixed(1).padStart(6);
  entries = [...entries, `${stamp}s ${message}`].slice(-MAX_ENTRIES);
  pending.push({ t: new Date().toISOString(), m: message });
  if (pending.length > MAX_PENDING) pending = pending.slice(-MAX_PENDING);
  if (enabled) notify();
};

export const getVoiceLog = () => entries;
export const isVoiceDebugEnabled = () => enabled;

export const setVoiceDebugEnabled = (on: boolean) => {
  enabled = on;
  try { localStorage.setItem(STORAGE_KEY, on ? '1' : '0'); } catch { /* ignore */ }
  notify();
};

/** Hands over the entries not yet uploaded. */
export const takePendingVoiceLog = () => {
  const batch = pending;
  pending = [];
  return batch;
};

/** Puts entries back after a failed upload. */
export const restorePendingVoiceLog = (batch: { t: string; m: string }[]) => {
  pending = [...batch, ...pending].slice(-MAX_PENDING);
};

export const clearVoiceLog = () => { entries = []; notify(); };

export const subscribeVoiceLog = (listener: () => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};

/** Device details to put at the top of the log. */
export const voiceDeviceInfo = (): string[] => {
  const nav = navigator as Navigator & { standalone?: boolean };
  const standalone = nav.standalone ?? window.matchMedia?.('(display-mode: standalone)').matches ?? false;
  return [
    nav.userAgent,
    `lang=${nav.language} standalone=${standalone}`,
    `SpeechRecognition=${'SpeechRecognition' in window} webkitSpeechRecognition=${'webkitSpeechRecognition' in window} speechSynthesis=${'speechSynthesis' in window}`,
  ];
};
