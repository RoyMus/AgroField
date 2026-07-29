import { makeAutoObservable, reaction, runInAction } from 'mobx';
import type { LangStore } from './LangStore';

/**
 * Speech recognition + text-to-speech. Replaces the useVoiceRecording hook and
 * the speak() helper that used to live inside SheetDataEditor.
 */
export class VoiceStore {
  isRecording = false;
  error: string | null = null;

  private recognition: SpeechRecognition | null = null;
  private voices: SpeechSynthesisVoice[] = [];
  /** Tracks user intent so onend can tell "user stopped" from "utterance ended". */
  private wantsRecording = false;
  /** Set to true when speak() paused an active recording, so onend can resume it. */
  private pausedForSpeech = false;

  onWord: ((word: string) => void) | null = null;

  constructor(private lang: LangStore) {
    makeAutoObservable<this, 'recognition' | 'voices' | 'lang'>(this, {
      recognition: false,
      voices: false,
      lang: false,
    }, { autoBind: true });

    this.loadVoices();
    if (window.speechSynthesis) window.speechSynthesis.onvoiceschanged = () => this.loadVoices();

    // Recreate the recognition instance whenever the speech language changes.
    reaction(
      () => this.lang.speechLang,
      () => this.createRecognition(),
      { fireImmediately: true }
    );
  }

  private loadVoices() {
    this.voices = window.speechSynthesis?.getVoices() ?? [];
  }

  private createRecognition() {
    this.recognition?.stop();

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      this.error = 'Speech Recognition is not supported in this browser. Please use Chrome, Edge, or Safari.';
      this.recognition = null;
      return;
    }

    const recognition = new SR();
    // continuous=false finalizes each utterance as soon as speech stops, which
    // avoids the long-silence lag. onend restarts it so it feels continuous.
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = this.lang.speechLang;
    // maxAlternatives is missing from TypeScript's SpeechRecognition types.
    (recognition as any).maxAlternatives = 5;

    recognition.onstart = () => runInAction(() => { this.isRecording = true; });

    recognition.onresult = (event) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (!event.results[i].isFinal) continue;
        const alternatives: string[] = [];
        for (let j = 0; j < event.results[i].length; j++) {
          alternatives.push(event.results[i][j].transcript);
        }
        if (alternatives.length > 0) this.processTranscript(alternatives);
      }
    };

    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      runInAction(() => {
        this.error = `Speech recognition error: ${event.error}`;
        this.isRecording = false;
      });
    };

    recognition.onend = () => {
      if (this.wantsRecording) {
        // Utterance finished — restart immediately for the next one.
        try { recognition.start(); } catch { /* already active; safe to ignore */ }
      } else {
        runInAction(() => { this.isRecording = false; });
      }
    };

    this.recognition = recognition;
  }

  // ------------------------------------------------------------ recognition

  async startRecording() {
    try {
      this.error = null;
      this.wantsRecording = true;
      this.recognition?.start();
    } catch (err) {
      runInAction(() => {
        this.error = err instanceof Error ? err.message : 'Failed to start speech recognition';
      });
      console.error('Error starting speech recognition:', err);
    }
  }

  async stopRecording() {
    this.wantsRecording = false;
    this.recognition?.stop();
  }

  private translateWord(word: string): string {
    // Strip trailing punctuation so "אחת." looks up the same as "אחת"
    const trimmed = word.trim().replace(/[.,!?;:]+$/, '');
    const lower = trimmed.toLowerCase();
    // iOS adds Hebrew niqqud (U+05B0–U+05C7); strip them before lookup
    const stripped = lower.replace(/[ְ-ׇ]/g, '');
    const words = this.lang.numberWords;
    return words[stripped] ?? words[lower] ?? words[trimmed] ?? trimmed;
  }

  private processValue(transcript: string) {
    if (!this.onWord) return;
    const { allowedCharPattern, commands } = this.lang;
    const decimalWord = commands.decimal;

    const cleaned = transcript.replace(allowedCharPattern, '').trim();
    if (!cleaned) return;

    const decEscaped = decimalWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // "one point two" / "אחת נקודה שתיים", and the variant where the recognizer
    // emits a literal "." instead of the decimal word ("אחת. 9").
    for (const re of [new RegExp(`^(.+?)\\s+${decEscaped}\\s+(.+)$`), /^(.+?)\.\s*(.+)$/]) {
      const match = cleaned.match(re);
      const first = match?.[1]?.trim();
      const second = match?.[2]?.trim();
      if (!first || !second) continue;
      const a = this.translateWord(first);
      const b = this.translateWord(second);
      if (/^\d+$/.test(a) && /^\d+$/.test(b)) {
        this.onWord(`${a}.${b}`);
        return;
      }
    }

    // Translate all words and fire a single callback so "skip fifteen" doesn't
    // trigger two separate actions (command + value).
    const translated = cleaned.split(/\s+/)
      .filter(w => w && w !== decimalWord)
      .map(w => this.translateWord(w))
      .filter(Boolean)
      .join(' ')
      .replace(/(\d+)\s+(\.\d+)/g, '$1$2');
    if (translated) this.onWord(translated);
  }

  private processTranscript(alternatives: string[]) {
    if (!this.onWord || alternatives.length === 0) return;
    const { skip, back, delete: del, save } = this.lang.commands;

    // Scan every alternative for a command before falling back to the top result
    // as a value — the recognizer often mishears the command but returns the
    // right word as a lower-ranked alternative.
    const allCommands = [...skip, ...back, ...del, ...save];
    for (const alt of alternatives) {
      const lower = alt.toLowerCase().trim();
      if (allCommands.some(cmd => lower.includes(cmd.toLowerCase()))) {
        this.onWord(alt);
        return;
      }
    }

    this.processValue(alternatives[0]);
  }

  // -------------------------------------------------------------------- tts

  /** iOS refuses to speak unless synthesis was first triggered by a user gesture. */
  unlockSpeechIOS() {
    if (!window.speechSynthesis) return;
    const utterance = new SpeechSynthesisUtterance('');
    utterance.volume = 0;
    window.speechSynthesis.speak(utterance);
  }

  speak(text: string, onEnd?: () => void) {
    if (!('speechSynthesis' in window)) {
      onEnd?.();
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    const voice = this.voices.find(v => v.lang.startsWith(this.lang.ttsLangPrefix));
    if (voice) utterance.voice = voice;

    utterance.onstart = () => {
      if (this.isRecording) {
        this.stopRecording();
        this.pausedForSpeech = true;
      }
    };

    utterance.onend = () => {
      if (this.pausedForSpeech) this.startRecording();
      this.pausedForSpeech = false;
      onEnd?.();
    };

    window.speechSynthesis.speak(utterance);
  }
}
