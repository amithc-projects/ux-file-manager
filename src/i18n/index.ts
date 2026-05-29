import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import en from './locales/en.json';
import de from './locales/de.json';

// ── i18n bootstrap ────────────────────────────────────────────────────────────
// English is the bundled base + fallback. Additional locales are added by
// dropping a JSON file in ./locales and registering it in `resources` below.
//
// This ships inside a single IIFE web component, so locales are bundled (no
// runtime HTTP fetch). Language is auto-detected from the browser, but the host
// can override it via the <zumilabs-file-browser lang="..."> attribute (see
// setLanguage()).
export const resources = {
  en: { translation: en },
  de: { translation: de },
} as const;

export const SUPPORTED_LANGUAGES = Object.keys(resources);

if (!i18n.isInitialized) {
  i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
      resources,
      fallbackLng: 'en',
      supportedLngs: SUPPORTED_LANGUAGES,
      nonExplicitSupportedLngs: true, // map en-GB → en
      interpolation: { escapeValue: false }, // React already escapes
      detection: {
        order: ['querystring', 'localStorage', 'navigator', 'htmlTag'],
        lookupQuerystring: 'lang',
        lookupLocalStorage: 'zl-fm-lang',
        caches: ['localStorage'],
      },
      returnNull: false,
    });
}

/** Host override from the web component's `lang` attribute. */
export function setLanguage(lang: string | null | undefined) {
  if (lang && i18n.language !== lang) i18n.changeLanguage(lang);
}

export default i18n;
