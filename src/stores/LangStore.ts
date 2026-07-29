import { makeAutoObservable } from 'mobx';
import i18n from '@/i18n';

export type SupportedLang = 'he' | 'en' | 'th';

export interface NumberWordMap { [word: string]: string; }

export interface VoiceCommands {
  skip: string[];
  back: string[];
  delete: string[];
  save: string[];
  decimal: string;
}

const NUMBER_WORDS: Record<SupportedLang, NumberWordMap> = {
  he: {
    "אפס": "0",
    "אחת": "1", "אחד": "1",
    "שתיים": "2", "שניים": "2",
    "שלוש": "3", "שלושה": "3",
    "ארבע": "4", "ארבעה": "4",
    "חמש": "5", "חמישה": "5",
    "שש": "6", "שישה": "6",
    "שבע": "7", "שבעה": "7",
    "שמונה": "8",
    "תשע": "9", "תשעה": "9",
  },
  en: {
    "zero": "0",
    "one": "1", "two": "2", "three": "3", "four": "4",
    "five": "5", "six": "6", "seven": "7", "eight": "8", "nine": "9",
  },
  th: {
    "ศูนย์": "0",
    "หนึ่ง": "1", "สอง": "2", "สาม": "3", "สี่": "4",
    "ห้า": "5", "หก": "6", "เจ็ด": "7", "แปด": "8", "เก้า": "9",
  },
};

const COMMANDS: Record<SupportedLang, VoiceCommands> = {
  he: {
    skip:    ["דלג", "הבא", "אבא", "דלק", "דלת"],
    back:    ["חזור", "אחורה"],
    delete:  ["מחק"],
    save:    ["שמור"],
    decimal: "נקודה",
  },
  en: {
    skip:    ["skip", "next"],
    back:    ["back", "previous"],
    delete:  ["delete", "clear"],
    save:    ["save", "record"],
    decimal: "point",
  },
  th: {
    skip:    ["ข้าม", "ถัดไป"],
    back:    ["ย้อนกลับ", "กลับ"],
    delete:  ["ลบ"],
    save:    ["บันทึก"],
    decimal: "จุด",
  },
};

const LOCALE_MAP: Record<SupportedLang, string> = { he: 'he-IL', en: 'en-US', th: 'th-TH' };
const TIMEZONE_MAP: Record<SupportedLang, string> = { he: 'Asia/Jerusalem', en: 'America/New_York', th: 'Asia/Bangkok' };
const TTS_PREFIX_MAP: Record<SupportedLang, string> = { he: 'he', en: 'en', th: 'th' };

export class LangStore {
  lang: SupportedLang = (localStorage.getItem('agrofield_language') as SupportedLang) || 'he';

  constructor() {
    makeAutoObservable(this, {}, { autoBind: true });
    i18n.on('languageChanged', (lng: string) => {
      if (['he', 'en', 'th'].includes(lng)) this.setLang(lng as SupportedLang);
    });
    this.applyToDocument();
  }

  get dir(): 'rtl' | 'ltr' { return 'ltr'; }
  get locale() { return LOCALE_MAP[this.lang]; }
  get timeZone() { return TIMEZONE_MAP[this.lang]; }
  get speechLang() { return LOCALE_MAP[this.lang]; }
  get ttsLangPrefix() { return TTS_PREFIX_MAP[this.lang]; }
  get numberWords() { return NUMBER_WORDS[this.lang]; }
  get commands() { return COMMANDS[this.lang]; }

  /** Character class of everything that is NOT a digit/dot/space in the current script. */
  get allowedCharPattern(): RegExp {
    if (this.speechLang.startsWith('he')) return /[^֐-׿0-9.\s]/g;
    if (this.speechLang.startsWith('th')) return /[^฀-๿0-9.\s]/g;
    return /[^a-zA-Z0-9.\s]/g;
  }

  setLang(lang: SupportedLang) {
    if (this.lang === lang && i18n.language === lang) return;
    this.lang = lang;
    localStorage.setItem('agrofield_language', lang);
    if (i18n.language !== lang) i18n.changeLanguage(lang);
    this.applyToDocument();
  }

  private applyToDocument() {
    document.documentElement.dir = this.dir;
    document.documentElement.lang = this.locale;
  }
}
