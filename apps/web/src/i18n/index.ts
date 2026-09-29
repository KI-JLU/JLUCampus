import i18n from 'i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import { initReactI18next } from 'react-i18next'
import { DEFAULT_LANGUAGE, LANGUAGES, languageSchema, type Language } from '@justcampus/shared'
import de from './de.json'
import en from './en.json'

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation'
    resources: { translation: typeof de }
  }
}

function syncDocumentLanguage(language: string): void {
  document.documentElement.lang = language
}

i18n.on('languageChanged', syncDocumentLanguage)

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: { de: { translation: de }, en: { translation: en } },
    fallbackLng: DEFAULT_LANGUAGE,
    supportedLngs: [...LANGUAGES],
    nonExplicitSupportedLngs: true,
    load: 'languageOnly',
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'justcampus.language',
      caches: ['localStorage']
    },
    returnNull: false
  })

/** The active language, narrowed to the two the app ships. */
export function currentLanguage(): Language {
  const parsed = languageSchema.safeParse(i18n.resolvedLanguage)
  return parsed.success ? parsed.data : DEFAULT_LANGUAGE
}

export { i18n }
