import React, { createContext, useContext, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

export type SupportedLang = 'he' | 'en' | 'th';

export interface NumberWordMap { [word: string]: string; }

export interface VoiceCommands {
  skip: string[];
  back: string[];
  delete: string[];
  save: string[];
  decimal: string;
}

export interface LanguageConfig {
  lang: SupportedLang;
  dir: 'rtl' | 'ltr';
  locale: string;
  timeZone: string;
  speechLang: string;
  ttsLangPrefix: string;
  numberWords: NumberWordMap;
  commands: VoiceCommands;
  setLang: (lang: SupportedLang) => void;
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

const LOCALE_MAP: Record<SupportedLang, string> = {
  he: 'he-IL', en: 'en-US', th: 'th-TH',
};

const TIMEZONE_MAP: Record<SupportedLang, string> = {
  he: 'Asia/Jerusalem', en: 'America/New_York', th: 'Asia/Bangkok',
};

const TTS_PREFIX_MAP: Record<SupportedLang, string> = {
  he: 'he', en: 'en', th: 'th',
};

const LanguageContext = createContext<LanguageConfig | null>(null);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { i18n } = useTranslation();
  const [lang, setLangState] = useState<SupportedLang>(
    () => (localStorage.getItem('agrofield_language') as SupportedLang) || 'he'
  );

  const setLang = (newLang: SupportedLang) => {
    i18n.changeLanguage(newLang);
    localStorage.setItem('agrofield_language', newLang);
    setLangState(newLang);
  };

  useEffect(() => {
    const handler = (lng: string) => {
      if (['he', 'en', 'th'].includes(lng)) setLangState(lng as SupportedLang);
    };
    i18n.on('languageChanged', handler);
    return () => i18n.off('languageChanged', handler);
  }, [i18n]);

  useEffect(() => {
    document.documentElement.dir = 'ltr';
    document.documentElement.lang = LOCALE_MAP[lang];
  }, [lang]);

  const value: LanguageConfig = {
    lang,
    dir: 'ltr',
    locale: LOCALE_MAP[lang],
    timeZone: TIMEZONE_MAP[lang],
    speechLang: LOCALE_MAP[lang],
    ttsLangPrefix: TTS_PREFIX_MAP[lang],
    numberWords: NUMBER_WORDS[lang],
    commands: COMMANDS[lang],
    setLang,
  };

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
};

export const useLang = (): LanguageConfig => {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLang must be used inside LanguageProvider');
  return ctx;
};
