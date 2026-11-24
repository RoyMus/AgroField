// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, createElement } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { useVoiceRecording, VoiceRecordingConfig } from './useVoiceRecording';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** Scriptable stand-in for the browser's SpeechRecognition. */
class FakeRecognition {
  static instances: FakeRecognition[] = [];
  continuous = false; interimResults = false; lang = ''; maxAlternatives = 1;
  onstart: (() => void) | null = null;
  onresult: ((e: unknown) => void) | null = null;
  onerror: ((e: { error: string }) => void) | null = null;
  onend: (() => void) | null = null;
  running = false;
  starts = 0;
  /** What the next start() does; default: starts normally. */
  behavior: 'normal' | 'throw' = 'normal';
  /** abort() never fires onend (seen on Android Chrome). */
  dropAbortEnd = false;
  constructor() { FakeRecognition.instances.push(this); }
  start() {
    if (this.behavior === 'throw' || this.running) throw new Error('InvalidStateError');
    this.running = true;
    this.starts++;
    setTimeout(() => this.onstart?.(), 10);
  }
  stop() { this.end(); }
  abort() {
    if (this.dropAbortEnd) { this.running = false; return; }
    this.end();
  }
  end() {
    if (!this.running) return;
    this.running = false;
    setTimeout(() => this.onend?.(), 10);
  }
  say(text: string) {
    const alt = [{ transcript: text, confidence: 0.9 }];
    const result = Object.assign(alt, { isFinal: true });
    this.onresult?.({ resultIndex: 0, results: [result] });
  }
  error(code: string) {
    this.onerror?.({ error: code });
    this.end();
  }
}

const config: VoiceRecordingConfig = {
  speechLang: 'en-US', numberWords: { five: '5' }, decimalWord: 'point',
  commands: { skip: ['skip'], back: ['back'], delete: ['delete'], save: ['save'], stop: ['stop'] },
};

type Hook = ReturnType<typeof useVoiceRecording>;
let hook: Hook;
let root: Root;
let container: HTMLDivElement;
let results: unknown[];

const Harness = () => {
  hook = useVoiceRecording(config);
  hook.onResult(r => results.push(r));
  return null;
};

const rec = () => FakeRecognition.instances[FakeRecognition.instances.length - 1];
const advance = async (ms: number) => { await act(async () => { vi.advanceTimersByTime(ms); }); };
/** Each time the engine starts, it ends again within ~20ms. */
const instantEnds = async (n: number) => {
  for (let i = 0; i < n; i++) {
    for (let t = 0; t < 3000 && !rec().running; t += 10) await advance(10);
    await advance(20);
    await run(() => rec().stop());
    await advance(20);
  }
};
const run = async (fn: () => void) => { await act(async () => { fn(); }); };

beforeEach(async () => {
  vi.useFakeTimers();
  FakeRecognition.instances = [];
  results = [];
  (window as unknown as { webkitSpeechRecognition: unknown }).webkitSpeechRecognition = FakeRecognition;
  container = document.createElement('div');
  root = createRoot(container);
  await act(async () => { root.render(createElement(Harness)); });
});

afterEach(async () => {
  await act(async () => { root.unmount(); });
  vi.useRealTimers();
});

describe('useVoiceRecording', () => {
  it('keeps restarting between utterances and delivers each one', async () => {
    await run(() => { hook.startRecording(); });
    await advance(20);
    expect(hook.isListening).toBe(true);
    for (let i = 0; i < 3; i++) {
      await advance(700);
      await run(() => { rec().say('five'); rec().stop(); });
      await advance(1000);
    }
    expect(results).toHaveLength(3);
    expect(hook.isRecording).toBe(true);
    expect(rec().running).toBe(true);
  });

  it('keeps going when Android ends sessions instantly after it already worked', async () => {
    await run(() => { hook.startRecording(); });
    await advance(700);
    await run(() => { rec().say('five'); rec().stop(); });
    await advance(1000);
    // Many instant ends in a row (mic still busy after the read-back).
    await instantEnds(8);
    expect(hook.isRecording).toBe(true);
    expect(hook.error).not.toBe('stalled');
    // And it recovers once the engine behaves again.
    await advance(700);
    await run(() => { rec().say('five'); rec().stop(); });
    await advance(1000);
    expect(results).toHaveLength(2);
  });

  it('treats audio-capture as transient once voice input has worked', async () => {
    await run(() => { hook.startRecording(); });
    await advance(700);
    await run(() => { rec().say('five'); rec().stop(); });
    await advance(1000);
    await run(() => rec().error('audio-capture'));
    await advance(3000);
    expect(hook.isRecording).toBe(true);
    expect(rec().running).toBe(true);
  });

  it('stops with an error when it never worked (mic blocked on iOS)', async () => {
    await run(() => { hook.startRecording(); });
    await instantEnds(8);
    expect(hook.isRecording).toBe(false);
    expect(hook.error).toBe('stalled');
  });

  it('can be restarted right after stop even if the engine never confirms the stop', async () => {
    await run(() => { hook.startRecording(); });
    await advance(700);
    await run(() => { rec().say('five'); rec().stop(); });
    await advance(1000);
    rec().dropAbortEnd = true;
    await run(() => { hook.stopRecording(); });
    await advance(50);
    const startsBefore = rec().starts;
    await run(() => { hook.startRecording(); });
    await advance(50);
    expect(rec().starts).toBe(startsBefore + 1);
    expect(hook.isListening).toBe(true);
  });

  it('tells the user when nothing is heard after starting, but keeps listening', async () => {
    await run(() => { hook.startRecording(); });
    for (let i = 0; i < 2; i++) {
      await advance(5000);
      await run(() => rec().error('no-speech'));
      await advance(50);
    }
    expect(hook.error).toBe('no-input');
    expect(hook.isRecording).toBe(true);
    expect(rec().running).toBe(true);
  });

  it('starts listening again after the read-back even if the engine never confirms the pause', async () => {
    await run(() => { hook.startRecording(); });
    await advance(700);
    await run(() => { rec().say('five'); rec().stop(); });
    await advance(1000);
    rec().dropAbortEnd = true;
    await run(() => hook.pause());
    await advance(1000); // read-back
    rec().dropAbortEnd = false;
    await run(() => hook.resume());
    await advance(3000);
    expect(rec().running).toBe(true);
    expect(hook.isListening).toBe(true);
  });

  it('retries when start() is never confirmed', async () => {
    await run(() => { hook.startRecording(); });
    await advance(700);
    await run(() => { rec().say('five'); rec().stop(); });
    // Next start silently does nothing.
    const r = rec();
    const realStart = r.start.bind(r);
    let swallowed = false;
    r.start = () => { if (!swallowed) { swallowed = true; return; } realStart(); };
    await advance(7000);
    expect(r.running).toBe(true);
    expect(hook.isListening).toBe(true);
  });

  it('recovers after pausing for the read-back', async () => {
    await run(() => { hook.startRecording(); });
    await advance(700);
    await run(() => { rec().say('five'); rec().stop(); });
    await advance(1000);
    await run(() => hook.pause());
    await advance(50);
    expect(rec().running).toBe(false);
    await run(() => hook.resume());
    await advance(50);
    expect(rec().running).toBe(true);
    expect(hook.isListening).toBe(true);
  });
});
