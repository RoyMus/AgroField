// Minimal browser globals so the store modules (i18n's language detector, the
// LangStore constructor) can be imported under plain node for the smoke check.
// Imported first by EditorStore.check.ts — ESM evaluates imports in order.
const store = new Map<string, string>();
(globalThis as any).localStorage ??= {
  getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
  setItem: (k: string, v: string) => store.set(k, String(v)),
  removeItem: (k: string) => store.delete(k),
};
(globalThis as any).document ??= { documentElement: {} };

export {};
