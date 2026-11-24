/**
 * Voice diagnostics log, shown on screen for debugging devices we can't attach
 * a console to. Hidden by default: tapping the voice hint text 5 times toggles it.
 */
const STORAGE_KEY = 'voiceDebug';
const MAX_ENTRIES = 150;

let entries: string[] = [];
let enabled = (() => {
  try { return localStorage.getItem(STORAGE_KEY) === '1'; } catch { return false; }
})();
const listeners = new Set<() => void>();
const t0 = Date.now();
const notify = () => listeners.forEach(l => l());

/** Records an event (always, so the log is available as soon as it's opened). */
export const voiceLog = (message: string) => {
  const stamp = ((Date.now() - t0) / 1000).toFixed(1).padStart(6);
  entries = [...entries, `${stamp}s ${message}`].slice(-MAX_ENTRIES);
  if (enabled) notify();
};

export const getVoiceLog = () => entries;
export const isVoiceDebugEnabled = () => enabled;

export const setVoiceDebugEnabled = (on: boolean) => {
  enabled = on;
  try { if (on) localStorage.setItem(STORAGE_KEY, '1'); else localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
  notify();
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
