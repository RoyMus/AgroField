// Parses spoken numbers (as returned by speech-to-text) into numeric strings.
// Hebrew is fully supported (units, teens, tens, hundreds, thousands, fractions,
// decimals with "נקודה"); other languages get a simple digit-word fallback.

// Hebrew niqqud and cantillation marks (iOS adds these to transcripts).
const NIQQUD = /[֑-ֽֿ-ׇ]/g;
// Geresh / gershayim and ASCII quotes used in Hebrew abbreviations.
const QUOTES = /[׳״"'`]/g;

// Invisible bidi/direction marks (iOS inserts these around Hebrew words).
const BIDI_MARKS = /[\u200B-\u200F\u202A-\u202E\u2066-\u2069\u061C\uFEFF]/g;

export const normalizeHebrew = (text: string): string =>
  text
    .replace(BIDI_MARKS, '')
    .replace(/[\u00A0\u2007\u202F]/g, ' ') // non-breaking spaces
    .replace(/[\u3002\u2024\uFF0E]/g, '.') // other "dot" characters
    .replace(NIQQUD, '')
    .replace(/־/g, ' ') // maqaf (Hebrew hyphen)
    .replace(QUOTES, '')
    .trim();

type Lex =
  | { kind: 'unit'; value: number }      // 0–9: may combine with עשר/מאות/אלפים
  | { kind: 'add'; value: number }       // 10, tens, 100, 200, 2000 …
  | { kind: 'hundreds' }                 // "מאות" (multiplies the preceding unit)
  | { kind: 'thousands' }                // "אלף"/"אלפים" (multiplies everything before)
  | { kind: 'fraction'; value: number }  // חצי, רבע
  | { kind: 'quarters' }                 // "רבעי"/"רבעים" as in "שלושת רבעי"
  | { kind: 'decimal' }
  | { kind: 'minus' };

const HE_LEXICON: Record<string, Lex> = {};
const add = (words: string[], lex: Lex) => words.forEach(w => { HE_LEXICON[w] = lex; });

add(['אפס'], { kind: 'unit', value: 0 });
add(['אחת', 'אחד'], { kind: 'unit', value: 1 });
add(['שתיים', 'שתים', 'שניים', 'שנים', 'שני', 'שתי'], { kind: 'unit', value: 2 });
add(['שלוש', 'שלושה', 'שלושת', 'שלש', 'שלשה'], { kind: 'unit', value: 3 });
add(['ארבע', 'ארבעה', 'ארבעת'], { kind: 'unit', value: 4 });
add(['חמש', 'חמישה', 'חמשה', 'חמשת', 'חמישת'], { kind: 'unit', value: 5 });
add(['שש', 'שישה', 'ששה', 'ששת', 'שישת'], { kind: 'unit', value: 6 });
add(['שבע', 'שבעה', 'שבעת'], { kind: 'unit', value: 7 });
add(['שמונה', 'שמונת'], { kind: 'unit', value: 8 });
add(['תשע', 'תשעה', 'תשעת'], { kind: 'unit', value: 9 });
add(['עשר', 'עשרה', 'עשרת'], { kind: 'add', value: 10 });
add(['עשרים'], { kind: 'add', value: 20 });
add(['שלושים', 'שלשים'], { kind: 'add', value: 30 });
add(['ארבעים'], { kind: 'add', value: 40 });
add(['חמישים', 'חמשים'], { kind: 'add', value: 50 });
add(['שישים', 'ששים'], { kind: 'add', value: 60 });
add(['שבעים'], { kind: 'add', value: 70 });
add(['שמונים'], { kind: 'add', value: 80 });
add(['תשעים'], { kind: 'add', value: 90 });
add(['מאה', 'מאת'], { kind: 'add', value: 100 });
add(['מאתיים', 'מאתים'], { kind: 'add', value: 200 });
add(['מאות'], { kind: 'hundreds' });
add(['אלף', 'אלפים'], { kind: 'thousands' });
add(['אלפיים'], { kind: 'add', value: 2000 });
add(['חצי'], { kind: 'fraction', value: 0.5 });
add(['רבע'], { kind: 'fraction', value: 0.25 });
add(['רבעי', 'רבעים'], { kind: 'quarters' });
add(['נקודה', 'פסיק'], { kind: 'decimal' });
add(['מינוס'], { kind: 'minus' });

type Token = Lex | { kind: 'digits'; text: string };

const lookupHebrew = (word: string): Lex | undefined => {
  if (HE_LEXICON[word]) return HE_LEXICON[word];
  // Conjunction prefix: "ושלוש", "וחצי", "ועשרים"
  if (word.length > 1 && word.startsWith('ו')) {
    const rest = word.slice(1);
    if (HE_LEXICON[rest]) return HE_LEXICON[rest];
    // "ושש" may be written "וששה" etc.; also handle a doubled vav ("וו")
    if (rest.startsWith('ו') && HE_LEXICON[rest.slice(1)]) return HE_LEXICON[rest.slice(1)];
  }
  return undefined;
};

/** Splits a transcript into raw words, turning literal decimal dots into a marker. */
const splitWords = (text: string): string[] => {
  const words: string[] = [];
  const raw = text
    .replace(/(\d),(\d)/g, '$1.$2') // "2,5" → "2.5"
    .replace(/[!?;:()]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

  raw.forEach((w, i) => {
    const isLast = i === raw.length - 1;
    // A word ending in a comma, followed by more words, is a spoken decimal
    // separator on iOS ("אחת, שלוש" → 1.3)
    if (/[^\d,],$/.test(w) && !isLast) {
      const bare = w.replace(/,+$/, '');
      if (bare) { words.push(bare, '.'); return; }
    }
    // Strip edge commas/dashes
    const word = w.replace(/^[,\-–]+|[,\-–]+$/g, '');
    if (!word) return;
    if (word === '.') { words.push('.'); return; }
    // A pure numeric token (possibly with a decimal point) stays intact.
    if (/^\d+(\.\d+)?$/.test(word)) { words.push(word); return; }
    if (/^\d+\.$/.test(word)) {
      words.push(word.slice(0, -1));
      if (!isLast) words.push('.');
      return;
    }
    if (/^\.\d+$/.test(word)) { words.push('.', word.slice(1)); return; }
    // "אחת." / "אחת.9" → word + decimal marker (+ rest)
    const dot = word.indexOf('.');
    if (dot > 0) {
      const before = word.slice(0, dot);
      const after = word.slice(dot + 1).replace(/\.+$/, '');
      words.push(before);
      if (after) words.push('.', after);
      else if (!isLast) words.push('.');
      return;
    }
    words.push(word);
  });
  return words;
};

const tokenizeHebrew = (text: string): Token[] | null => {
  const tokens: Token[] = [];
  for (const word of splitWords(normalizeHebrew(text))) {
    if (word === '.') { tokens.push({ kind: 'decimal' }); continue; }
    if (/^\d+(\.\d+)?$/.test(word)) { tokens.push({ kind: 'digits', text: word }); continue; }
    const lex = lookupHebrew(word);
    if (!lex) return null; // a non-number word → not a number utterance
    tokens.push(lex);
  }
  return tokens;
};

interface IntResult { value: number; fraction: number; }

/** Evaluates a run of tokens (no decimal markers) as an integer plus an optional fraction. */
const evalInteger = (tokens: Token[]): IntResult | null => {
  if (tokens.length === 0) return null;
  let total = 0;     // completed thousands
  let current = 0;   // value below 1000
  let lastUnit: number | null = null;
  let fraction = 0;

  for (const tok of tokens) {
    switch (tok.kind) {
      case 'digits':
        if (tok.text.includes('.')) return null;
        current += parseInt(tok.text, 10);
        lastUnit = null;
        break;
      case 'unit':
        // Two units in a row ("אחת שלוש") is not a Hebrew number
        if (lastUnit !== null) return null;
        current += tok.value;
        lastUnit = tok.value;
        break;
      case 'add':
        current += tok.value;
        lastUnit = null;
        break;
      case 'hundreds':
        if (lastUnit === null) return null;
        current += lastUnit * 100 - lastUnit;
        lastUnit = null;
        break;
      case 'thousands':
        total += (current || 1) * 1000;
        current = 0;
        lastUnit = null;
        break;
      case 'fraction':
        fraction += tok.value;
        lastUnit = null;
        break;
      case 'quarters':
        if (lastUnit === null) return null;
        current -= lastUnit;
        fraction += lastUnit * 0.25;
        lastUnit = null;
        break;
      default:
        return null;
    }
  }
  return { value: total + current, fraction };
};

/** Evaluates the part after "נקודה": single digits are read one by one ("אפס חמש" → "05"). */
const evalDecimalPart = (tokens: Token[]): string | null => {
  if (tokens.length === 0) return null;
  const allDigits = tokens.every(
    t => (t.kind === 'unit') || (t.kind === 'digits' && !t.text.includes('.'))
  );
  if (allDigits) {
    return tokens.map(t => (t.kind === 'unit' ? String(t.value) : (t as { text: string }).text)).join('');
  }
  const r = evalInteger(tokens);
  if (!r || r.fraction) return null;
  return String(r.value);
};

const formatNumber = (n: number): string =>
  Number.isInteger(n) ? String(n) : String(parseFloat(n.toFixed(6)));

export const parseHebrewNumber = (text: string): string | null => {
  const whole = normalizeHebrew(text).replace(/(\d),(\d)/g, '$1.$2').replace(/\.$/, '').trim();
  if (/^-?\d+(\.\d+)?$/.test(whole)) return whole;

  const tokens = tokenizeHebrew(text);
  if (!tokens || tokens.length === 0) return null;

  let negative = false;
  if (tokens[0].kind === 'minus') { negative = true; tokens.shift(); }
  if (tokens.some(t => t.kind === 'minus')) return null;
  // A lone "נקודה"/"." is not a number
  if (tokens.every(t => t.kind === 'decimal')) return null;

  const sign = negative ? '-' : '';
  const decIdx = tokens.findIndex(t => t.kind === 'decimal');

  if (decIdx === -1) {
    // A single numeric token like "2.5" is already handled above.
    if (tokens.length === 1 && tokens[0].kind === 'digits') return sign + tokens[0].text;
    const r = evalInteger(tokens);
    if (!r) return null;
    return sign + formatNumber(r.value + r.fraction);
  }

  const left = tokens.slice(0, decIdx);
  const right = tokens.slice(decIdx + 1);
  if (right.some(t => t.kind === 'decimal')) return null;

  let leftStr = '0';
  if (left.length > 0) {
    const r = evalInteger(left);
    if (!r || r.fraction) return null;
    leftStr = String(r.value);
  }
  const rightStr = evalDecimalPart(right);
  if (rightStr === null) return null;
  return `${sign}${leftStr}.${rightStr}`;
};

/** Fallback for languages without a full grammar: maps digit words and a decimal word. */
export const parseSimpleNumber = (
  text: string,
  numberWords: Record<string, string>,
  decimalWord: string,
): string | null => {
  const cleaned = text.toLowerCase().replace(/(\d),(\d)/g, '$1.$2').replace(/[!?;:]/g, '').trim().replace(/\.$/, '');
  if (/^-?\d+(\.\d+)?$/.test(cleaned)) return cleaned;

  const words = cleaned.split(/\s+/).filter(Boolean);
  let left = '';
  let right = '';
  let seenDecimal = false;
  for (const w of words) {
    if (w === decimalWord.toLowerCase() || w === '.') {
      if (seenDecimal) return null;
      seenDecimal = true;
      continue;
    }
    const digit = /^\d+$/.test(w) ? w : numberWords[w];
    if (digit === undefined) return null;
    if (seenDecimal) right += digit; else left += digit;
  }
  if (!left && !right) return null;
  if (seenDecimal) {
    if (!right) return null;
    return `${left || '0'}.${right}`;
  }
  return left;
};

export const parseNumber = (
  text: string,
  lang: string,
  numberWords: Record<string, string> = {},
  decimalWord = '',
): string | null => {
  if (lang.startsWith('he')) return parseHebrewNumber(text);
  return parseSimpleNumber(text, numberWords, decimalWord);
};
