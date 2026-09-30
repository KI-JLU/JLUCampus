import { app } from 'electron'

type Language = 'de' | 'en'
const dictionary = {
  de: {
    open: 'JLU Campus öffnen',
    dashboard: 'Dashboard',
    notifications: 'Benachrichtigungen',
    quit: 'Beenden'
  },
  en: {
    open: 'Open JLU Campus',
    dashboard: 'Dashboard',
    notifications: 'Notifications',
    quit: 'Quit'
  }
} as const

export type TextKey = keyof (typeof dictionary)['en']
let language: Language = 'en'
const listeners = new Set<() => void>()

export function initializeLanguage(): void {
  language = app.getLocale().toLowerCase().startsWith('de') ? 'de' : 'en'
}

export function t(key: TextKey): string {
  return dictionary[language][key]
}

export function setLanguage(value: unknown): void {
  if (value !== 'de' && value !== 'en') return
  if (language === value) return
  language = value
  for (const listener of listeners) listener()
}

export function onLanguageChange(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
