/**
 * On-screen voice diagnostics, for debugging devices we can't attach a
 * console to. Enabled by opening the app with "voicedebug" in the URL
 * (e.g. https://…/?voicedebug=1); stays on for the browser tab.
 */
const KEY = 'voicedebug';
const MAX_ENTRIES = 60;

export const voiceDebugEnabled = (): boolean => {
  try {
    if (window.location.href.includes(KEY)) sessionStorage.setItem(KEY, '1');
    return sessionStorage.getItem(KEY) === '1';
  } catch {
    return window.location.href.includes(KEY);
  }
};

let entries: string[] = [];
const listeners = new Set<(entries: string[]) => void>();
let t0 = 0;

export const voiceLog = (message: string) => {
  const now = Date.now();
  if (!t0) t0 = now;
  const stamp = ((now - t0) / 1000).toFixed(1).padStart(6);
  entries = [...entries, `${stamp}s ${message}`].slice(-MAX_ENTRIES);
  listeners.forEach(l => l(entries));
};

export const subscribeVoiceLog = (listener: (entries: string[]) => void) => {
  listeners.add(listener);
  listener(entries);
  return () => { listeners.delete(listener); };
};

export const getVoiceLog = () => entries;
