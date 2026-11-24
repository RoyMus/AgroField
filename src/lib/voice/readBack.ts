import { useSyncExternalStore } from 'react';

/**
 * Whether values and column names are read aloud. Users can turn it off:
 * on iPhones in silent mode, reading aloud leaves the mic deaf until reload.
 */
const KEY = 'voiceReadBack';
let enabled = (() => {
  try { return localStorage.getItem(KEY) !== '0'; } catch { return true; }
})();
const listeners = new Set<() => void>();

export const isReadBackEnabled = () => enabled;

export const setReadBackEnabled = (on: boolean) => {
  enabled = on;
  try { localStorage.setItem(KEY, on ? '1' : '0'); } catch { /* ignore */ }
  listeners.forEach(l => l());
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};

export const useReadBack = () => useSyncExternalStore(subscribe, isReadBackEnabled);
