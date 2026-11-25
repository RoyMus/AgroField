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
  it('loops one session per utterance and delivers each one', async () => {
    await run(() => { hook.startRecording(); });
    await advance(20);
    expect(hook.isListening).toBe(true);
    for (let i = 0; i < 3; i++) await speakValue();
    expect(results).toEqual([
      { kind: 'number', value: '5' }, { kind: 'number', value: '5' }, { kind: 'number', value: '5' },
    ]);
    expect(hook.isRecording).toBe(true);
    expect(rec().running).toBe(true);
  });

  it('never stops or aborts a working session itself', async () => {
    const abortSpy = vi.spyOn(FakeRecognition.prototype, 'abort');
    const stopSpy = vi.spyOn(FakeRecognition.prototype, 'stop');
    await run(() => { hook.startRecording(); });
    await advance(700);
    await run(() => rec().sayInterim('five'));
    await advance(5000);              // however long the engine takes to confirm
    expect(abortSpy).not.toHaveBeenCalled();
    expect(stopSpy).not.toHaveBeenCalled();
    expect(results).toHaveLength(0);  // delivered when the session ends
    abortSpy.mockRestore();
    stopSpy.mockRestore();
  });

  it('delivers an utterance split into several segments as one (iOS)', async () => {
    await run(() => { hook.startRecording(); });
    await advance(700);
    const r = rec();
    const seg = (t: string) => Object.assign([{ transcript: t, confidence: 1 }], { isFinal: true });
    await run(() => { r.onresult?.({ resultIndex: 0, results: [seg('twenty'), seg('five')] }); r.stop(); });
    await advance(50);
    expect(results).toHaveLength(1);
  });

  it('delivers what was heard even if the final result never comes (Android)', async () => {
    await run(() => { hook.startRecording(); });
    await advance(700);
    await run(() => { rec().sayInterim('five'); rec().stop(); });
    await advance(50);
    expect(results).toEqual([{ kind: 'number', value: '5' }]);
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
    await advance(400);
    expect(rec().running).toBe(true);
    expect(hook.isListening).toBe(true);
  });

  it('can be re-activated right after stop, ignoring the old session', async () => {
    await run(() => { hook.startRecording(); });
    await advance(700);
    const old = rec();
    const { onresult, onend } = old;
    await run(() => { hook.stopRecording(); });
    expect(hook.isRecording).toBe(false);
    await run(() => { hook.startRecording(); });
    await advance(50);
    expect(rec()).not.toBe(old);
    expect(hook.isListening).toBe(true);
    // Late events from the old session change nothing.
    await run(() => { onresult?.call(old, { resultIndex: 0, results: [Object.assign([{ transcript: 'five', confidence: 1 }], { isFinal: true })] }); onend?.call(old); });
    expect(results).toHaveLength(0);
    expect(rec().running).toBe(true);
  });

  it('replaces a session whose start() was never confirmed', async () => {
    await run(() => { hook.startRecording(); });
    await speakValue();
    FakeRecognition.swallowNextStart = true;
    await run(() => rec().stop());
    await advance(300);
    expect(hook.isListening).toBe(false);
    await advance(6000);
    expect(rec().running).toBe(true);
    expect(hook.isListening).toBe(true);
  });

  it('replaces a session that reports nothing for 30s', async () => {
    await run(() => { hook.startRecording(); });
    await speakValue();
    const stuck = rec();
    await advance(20000);
    expect(rec()).toBe(stuck);        // a quiet session is left alone for a while
    await advance(12000);
    expect(rec()).not.toBe(stuck);
    expect(rec().running).toBe(true);
  });

  it('tells the user when nothing is heard after starting, but keeps listening', async () => {
    await run(() => { hook.startRecording(); });
    for (let i = 0; i < 2; i++) {
      await advance(5000);
      await run(() => rec().error('no-speech', true));
      await advance(300);
    }
    expect(hook.error).toBe('no-input');
    expect(hook.isRecording).toBe(true);
    expect(rec().running).toBe(true);
  });

  it('does not deliver speech after stop, and starts nothing new', async () => {
    await run(() => { hook.startRecording(); });
    await advance(700);
    await run(() => rec().sayInterim('five'));
    const count = FakeRecognition.instances.length;
    await run(() => { hook.stopRecording(); });
    await advance(40000);
    expect(results).toHaveLength(0);
    expect(FakeRecognition.instances.length).toBe(count);
    expect(FakeRecognition.instances.every(r => !r.running)).toBe(true);
  });

  describe('continuous mode (iOS)', () => {
    const emit = (r: FakeRecognition, segs: [string, boolean][]) =>
      r.onresult?.({ resultIndex: 0, results: segs.map(([t, fin]) => Object.assign([{ transcript: t, confidence: 1 }], { isFinal: fin })) });

    beforeEach(() => { localStorage.setItem('voiceContinuous', '1'); });
    afterEach(() => { localStorage.removeItem('voiceContinuous'); });

    it('uses one session and delivers each phrase after a pause, without ending it', async () => {
      await run(() => { hook.startRecording(); });
      await advance(700);
      const r = rec();
      expect(r.continuous).toBe(true);
      await run(() => emit(r, [['five', false]]));
      await advance(1300);
      expect(results).toEqual([{ kind: 'number', value: '5' }]);
      // iOS keeps growing the same transcript; only the new words count.
      await run(() => emit(r, [['five hello there', false]]));
      await advance(1300);
      expect(results).toEqual([{ kind: 'number', value: '5' }, { kind: 'text', text: 'hello there' }]);
      expect(rec()).toBe(r);
      expect(r.running).toBe(true);
      expect(FakeRecognition.instances).toHaveLength(1);
    });

    it('delivers final segments shortly after they arrive', async () => {
      await run(() => { hook.startRecording(); });
      await advance(700);
      const r = rec();
      await run(() => emit(r, [['five', true]]));
      await advance(700);
      expect(results).toEqual([{ kind: 'number', value: '5' }]);
      await run(() => emit(r, [['five', true], ['hello', true]]));
      await advance(700);
      expect(results).toEqual([{ kind: 'number', value: '5' }, { kind: 'text', text: 'hello' }]);
    });

    it('does not take a punctuation-only placeholder as a phrase (iOS shows "." first)', async () => {
      await run(() => { hook.startRecording(); });
      await advance(700);
      const r = rec();
      await run(() => emit(r, [['\u200f.', false]]));
      await advance(2000);
      expect(results).toHaveLength(0);
      await run(() => emit(r, [['five', true]]));
      await advance(700);
      expect(results).toEqual([{ kind: 'number', value: '5' }]);
    });

    it('waits while the phrase is still changing', async () => {
      await run(() => { hook.startRecording(); });
      await advance(700);
      const r = rec();
      await run(() => emit(r, [['hello', false]]));
      await advance(800);
      await run(() => emit(r, [['hello there', false]]));
      await advance(800);
      expect(results).toHaveLength(0);
      await advance(500);
      expect(results).toEqual([{ kind: 'text', text: 'hello there' }]);
    });

    it('leaves a quiet session alone', async () => {
      await run(() => { hook.startRecording(); });
      await advance(700);
      const r = rec();
      await advance(120000);
      expect(rec()).toBe(r);
      expect(FakeRecognition.instances).toHaveLength(1);
    });

    it('delivers the rest and starts a new session if iOS ends it', async () => {
      await run(() => { hook.startRecording(); });
      await advance(700);
      const r = rec();
      await run(() => { emit(r, [['five', false]]); r.stop(); });
      await advance(400);
      expect(results).toEqual([{ kind: 'number', value: '5' }]);
      expect(rec()).not.toBe(r);
      expect(rec().running).toBe(true);
    });
  });
});
