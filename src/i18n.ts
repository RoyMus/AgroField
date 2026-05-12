import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import he from './locales/he.json';
import en from './locales/en.json';
import th from './locales/th.json';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      he: { translation: he },
      en: { translation: en },
      th: { translation: th },
    },
    fallbackLng: 'he',
    supportedLngs: ['he', 'en', 'th'],
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'agrofield_language',
    },
    interpolation: { escapeValue: false },
  });

export default i18n;
