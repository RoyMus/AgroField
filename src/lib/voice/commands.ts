import { normalizeHebrew } from './hebrewNumbers';

export type CommandName = 'skip' | 'back' | 'delete' | 'save' | 'stop';

export interface CommandWords {
  skip: string[];
  back: string[];
  delete: string[];
  save: string[];
  /** Turns voice mode off. */
  stop: string[];
  /** Mis-recognitions that count as a command only when they are the entire utterance. */
  exactOnly?: Partial<Record<CommandName, string[]>>;
}

export interface CommandMatch {
  command: CommandName;
  /** The utterance with the command word removed (e.g. dictated text before "שמור"). */
  rest: string;
}

const COMMAND_ORDER: CommandName[] = ['stop', 'skip', 'back', 'delete', 'save'];

/** Utterances up to this many words may contain a command anywhere. */
export const SHORT_UTTERANCE_WORDS = 3;

const normalizeWord = (w: string) =>
  normalizeHebrew(w).toLowerCase().replace(/^[.,!?;:-]+|[.,!?;:-]+$/g, '');

export const tokenize = (text: string): string[] =>
  text.split(/\s+/).map(normalizeWord).filter(Boolean);

// Languages written without spaces between words (Thai) can't be tokenized,
// so short utterances fall back to substring matching.
const NO_SPACE_LANGS = ['th'];

/**
 * Detects a voice command in a transcript.
 * - Commands are matched on whole words, never substrings ("הבא" in "העלה הבא נראה בריא" mid-sentence is ignored).
 * - Short utterances (≤ 3 words) match a command word anywhere.
 * - Long utterances match only "save" as the last word, so a dictated sentence
 *   can be ended with "… שמור".
 */
export const matchCommand = (
  text: string,
  words: CommandWords,
  lang = 'he',
): CommandMatch | null => {
  const rawWords = text.split(/\s+/).filter(w => normalizeWord(w));
  const tokens = rawWords.map(normalizeWord);
  if (tokens.length === 0) return null;

  const lists = Object.fromEntries(
    COMMAND_ORDER.map(c => [c, words[c].map(w => normalizeWord(w))]),
  ) as Record<CommandName, string[]>;

  if (NO_SPACE_LANGS.includes(lang.slice(0, 2))) {
    const joined = tokens.join('');
    if (joined.length <= 15) {
      for (const c of COMMAND_ORDER) {
        const hit = lists[c].find(w => joined.includes(w));
        if (hit) return { command: c, rest: joined.replace(hit, '').trim() };
      }
    }
    return null;
  }

  if (tokens.length === 1 && words.exactOnly) {
    for (const c of COMMAND_ORDER) {
      if (words.exactOnly[c]?.map(normalizeWord).includes(tokens[0])) {
        return { command: c, rest: '' };
      }
    }
  }

  const restWithout = (idx: number) =>
    rawWords.filter((_, i) => i !== idx).join(' ').trim();

  if (tokens.length <= SHORT_UTTERANCE_WORDS) {
    for (let i = 0; i < tokens.length; i++) {
      for (const c of COMMAND_ORDER) {
        if (lists[c].includes(tokens[i])) return { command: c, rest: restWithout(i) };
      }
    }
    return null;
  }

  const last = tokens.length - 1;
  if (lists.save.includes(tokens[last])) {
    return { command: 'save', rest: restWithout(last) };
  }
  return null;
};
