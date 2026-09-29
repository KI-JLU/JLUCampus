import { TRANSLATOR_LANGUAGES, type TranslatorLanguage } from '@justcampus/shared'
import { ApiRequestError } from '@/lib/api'

export interface LanguageOption {
  code: TranslatorLanguage
  name: string
}

/**
 * The translator's languages named in `locale` (the UI language), sorted by
 * name. Names come from `Intl.DisplayNames`, so no language needs its own
 * translation; a runtime without it falls back to the code.
 */
export function languageOptions(locale: string): LanguageOption[] {
  let names: Intl.DisplayNames | null = null
  try {
    names = new Intl.DisplayNames([locale], { type: 'language' })
  } catch {
    names = null
  }
  return TRANSLATOR_LANGUAGES.map((code) => ({
    code,
    name: names?.of(code) ?? code.toUpperCase()
  })).sort((a, b) => a.name.localeCompare(b.name, locale))
}

/** The i18n key of the message a failed translation shows. */
export function translateErrorKey(
  error: unknown
):
  | 'component.translator.errors.unavailable'
  | 'component.translator.errors.disabled'
  | 'component.translator.errors.invalid'
  | 'component.translator.errors.failed' {
  if (!(error instanceof ApiRequestError)) return 'component.translator.errors.failed'
  switch (error.code) {
    case 'module_unavailable':
      return 'component.translator.errors.unavailable'
    case 'not_found':
      return 'component.translator.errors.disabled'
    case 'validation':
      return 'component.translator.errors.invalid'
    default:
      return 'component.translator.errors.failed'
  }
}

/** Ctrl+Enter, or Cmd+Enter on Apple keyboards: translate without leaving the text field. */
export function isTranslateShortcut(event: {
  key: string
  ctrlKey: boolean
  metaKey: boolean
}): boolean {
  return event.key === 'Enter' && (event.ctrlKey || event.metaKey)
}

export function isApplePlatform(): boolean {
  return typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)
}
