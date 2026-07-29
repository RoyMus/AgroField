import { DriveStore } from './DriveStore';
import { EditorStore } from './EditorStore';
import { LangStore } from './LangStore';
import { SettingsStore } from './SettingsStore';
import { VoiceStore } from './VoiceStore';

// ponytail: module-level singletons instead of React context providers. The app
// is single-tenant in the browser tab; swap to a StoreProvider only if a second
// independent instance is ever needed (tests, SSR).
export const lang = new LangStore();
export const settings = new SettingsStore();
export const drive = new DriveStore();
export const voice = new VoiceStore(lang);
export const editor = new EditorStore(drive, lang, settings, voice);

export { DriveStore, EditorStore, LangStore, SettingsStore, VoiceStore };
export type { DriveFile } from './DriveStore';
export type { SupportedLang } from './LangStore';
