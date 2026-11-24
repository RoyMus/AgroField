// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, createElement } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { useVoiceRecording, VoiceRecordingConfig } from './useVoiceRecording';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** Scriptable stand-in for the browser's SpeechRecognition. */
class FakeRecognition {
  static instances: FakeRecognition[] = [];
  /** The next start() call is silently ignored (no onstart, no onend). */
  static swallowNextStart = false;
  continuous = false; interimResults = false; lang = ''; maxAlternatives = 1;
  onstart: (() => void) | null = null;
  onresult: ((e: unknown) => void) | null = null;
  onerror: ((e: { error: string }) => void) | null = null;
  onend: (() => void) | null = null;
  running = false;
  constructor() { FakeRecognition.instances.push(this); }
  start() {
    if (this.running) throw new Error('InvalidStateError');
    if (FakeRecognition.swallowNextStart) { FakeRecognition.swallowNextStart = false; return; }
    this.running = true;
    setTimeout(() => this.onstart?.(), 10);
  }
  stop() { this.end(); }
  /** Like some real engines, abort() here never fires onend. */
  abort() { this.running = false; }
  end() {
    if (!this.running) return;
    this.running = false;
    setTimeout(() => this.onend?.(), 10);
  }
  sayInterim(text: string) {
    const alt = [{ transcript: text, confidence: 0.9 }];
    const result = Object.assign(alt, { isFinal: false });
    this.onresult?.({ resultIndex: 0, results: [result] });
  }
  say(text: string) {
    const alt = [{ transcript: text, confidence: 0.9 }];
    const result = Object.assign(alt, { isFinal: true });
    this.onresult?.({ resultIndex: 0, results: [result] });
  }
  /** Fires an error; by default without a following onend. */
  error(code: string, thenEnd = false) {
    this.onerror?.({ error: code });
    if (thenEnd) this.end(); else this.running = false;
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
  FakeRecognition.swallowNextStart = false;
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

const speakValue = async (text = 'five') => {
  await advance(700);
  await run(() => { rec().say(text); rec().stop(); });
  await advance(1000);
};

describe('useVoiceRecording', () => {
  it('keeps listening between utterances and delivers each one', async () => {
    await run(() => { hook.startRecording(); });
    await advance(20);
    expect(hook.isListening).toBe(true);
    for (let i = 0; i < 3; i++) await speakValue();
    expect(results).toHaveLength(3);
    expect(hook.isRecording).toBe(true);
    expect(rec().running).toBe(true);
  });

  it('keeps going when sessions end instantly after it already worked (Android)', async () => {
    await run(() => { hook.startRecording(); });
    await speakValue();
    await instantEnds(8);
    expect(hook.isRecording).toBe(true);
    expect(hook.error).toBeNull();
    for (let t = 0; t < 3000 && !rec().running; t += 10) await advance(10);
    await speakValue();
    expect(results).toHaveLength(2);
  });

  it('treats audio-capture as transient once voice input has worked', async () => {
    await run(() => { hook.startRecording(); });
    await speakValue();
    await run(() => rec().error('audio-capture'));
    await advance(1000);
    expect(hook.isRecording).toBe(true);
    expect(rec().running).toBe(true);
  });

  it('turns off with an error when audio-capture happens before anything worked', async () => {
    await run(() => { hook.startRecording(); });
    await advance(100);
    await run(() => rec().error('audio-capture'));
    expect(hook.isRecording).toBe(false);
    expect(hook.error).toBe('audio-capture');
  });

  it('turns off with an error when it never worked (mic blocked on iOS)', async () => {
    await run(() => { hook.startRecording(); });
    await instantEnds(8);
    expect(hook.isRecording).toBe(false);
    expect(hook.error).toBe('stalled');
  });

  it('restarts after an error even if onend never follows', async () => {
    await run(() => { hook.startRecording(); });
    await speakValue();
    await run(() => rec().error('network'));
    await advance(300);
    expect(rec().running).toBe(true);
    expect(hook.isListening).toBe(true);
  });

  it('can be re-activated right after stop', async () => {
    await run(() => { hook.startRecording(); });
    await speakValue();
    await run(() => { hook.stopRecording(); });
    expect(hook.isRecording).toBe(false);
    await run(() => { hook.startRecording(); });
    await advance(50);
    expect(rec().running).toBe(true);
    expect(hook.isListening).toBe(true);
  });

  it('listens again right after the read-back', async () => {
    await run(() => { hook.startRecording(); });
    await speakValue();
    await run(() => hook.pause());
    expect(hook.isListening).toBe(false);
    await advance(1000);
    await run(() => hook.resume());
    await advance(400);
    expect(rec().running).toBe(true);
    expect(hook.isListening).toBe(true);
  });

  it('pause stops a recording session gracefully and resolves once the mic is released', async () => {
    await run(() => { hook.startRecording(); });
    await advance(700);
    const live = rec();
    const stopSpy = vi.spyOn(live, 'stop');
    const abortSpy = vi.spyOn(live, 'abort');
    let released = false;
    await run(() => { hook.pause().then(() => { released = true; }); });
    expect(stopSpy).toHaveBeenCalled();
    expect(abortSpy).not.toHaveBeenCalled();
    expect(released).toBe(false);   // still releasing the mic
    await advance(20);              // engine fires onend
    expect(released).toBe(true);
    // A second pause while nothing runs resolves right away.
    let second = false;
    await run(() => { hook.pause().then(() => { second = true; }); });
    expect(second).toBe(true);
  });

  it('pause falls back to abort when the engine never ends', async () => {
    await run(() => { hook.startRecording(); });
    await advance(700);
    const live = rec();
    live.stop = () => { /* never ends */ };
    const abortSpy = vi.spyOn(live, 'abort');
    let released = false;
    await run(() => { hook.pause().then(() => { released = true; }); });
    await advance(900);
    expect(released).toBe(false);
    await advance(200);
    expect(released).toBe(true);
    expect(abortSpy).toHaveBeenCalled();
  });

  it('accepts a stable, unconfirmed number early and listens again', async () => {
    await run(() => { hook.startRecording(); });
    await advance(700);
    const first = rec();
    const stopSpy = vi.spyOn(first, 'stop');
    await run(() => first.sayInterim('five'));
    await advance(500);
    expect(results).toHaveLength(0);
    await advance(500);
    expect(results).toEqual([{ kind: 'number', value: '5' }]);
    expect(stopSpy).toHaveBeenCalled();
    await advance(300);
    expect(rec()).not.toBe(first);
    expect(rec().running).toBe(true);
  });

  it('waits for confirmation while the number is still changing, and never for text', async () => {
    await run(() => { hook.startRecording(); });
    await advance(700);
    await run(() => rec().sayInterim('five'));
    await advance(600);
    await run(() => rec().sayInterim('hello there'));
    await advance(2000);
    expect(results).toHaveLength(0);
    await run(() => { rec().say('hello there'); rec().stop(); });
    await advance(100);
    expect(results).toEqual([{ kind: 'text', text: 'hello there' }]);
  });

  it('does not start and abort a session between back-to-back read-backs', async () => {
    await run(() => { hook.startRecording(); });
    await speakValue();
    await run(() => hook.pause());   // read the value back
    await run(() => hook.resume());
    await advance(20);
    await run(() => hook.pause());   // then the next column's name
    const count = FakeRecognition.instances.length;
    await advance(1000);
    expect(FakeRecognition.instances.length).toBe(count);
    await run(() => hook.resume());
    await advance(400);
    expect(FakeRecognition.instances.length).toBe(count + 1);
    expect(rec().running).toBe(true);
  });

  it('ignores late events from a dropped session', async () => {
    await run(() => { hook.startRecording(); });
    await advance(700);
    const old = rec();
    const { onresult, onend } = old;
    await run(() => hook.pause());
    await run(() => hook.resume());
    await advance(400);
    await run(() => { onresult?.call(old, { resultIndex: 0, results: [Object.assign([{ transcript: 'five', confidence: 1 }], { isFinal: true })] }); onend?.call(old); });
    await advance(1000);
    expect(results).toHaveLength(0);
    expect(rec()).not.toBe(old);
    expect(rec().running).toBe(true);
  });

  it('replaces a session whose start() was never confirmed', async () => {
    await run(() => { hook.startRecording(); });
    await speakValue();
    FakeRecognition.swallowNextStart = true;
    await run(() => rec().stop());
    await advance(100);
    expect(hook.isListening).toBe(false);
    await advance(6000);
    expect(rec().running).toBe(true);
    expect(hook.isListening).toBe(true);
  });

  it('replaces a session that goes silent without ending', async () => {
    await run(() => { hook.startRecording(); });
    await speakValue();
    const stuck = rec();
    await advance(17000);
    expect(rec()).not.toBe(stuck);
    expect(rec().running).toBe(true);
  });

  it('tells the user when nothing is heard after starting, but keeps listening', async () => {
    await run(() => { hook.startRecording(); });
    for (let i = 0; i < 2; i++) {
      await advance(5000);
      await run(() => rec().error('no-speech', true));
      await advance(200);
    }
    expect(hook.error).toBe('no-input');
    expect(hook.isRecording).toBe(true);
    expect(rec().running).toBe(true);
  });

  it('does not deliver speech after stop', async () => {
    await run(() => { hook.startRecording(); });
    await advance(700);
    await run(() => rec().say('five')); // waiting to settle
    await run(() => { hook.stopRecording(); });
    await advance(2000);
    expect(results).toHaveLength(0);
    expect(FakeRecognition.instances.every(r => !r.running)).toBe(true);
  });
});
