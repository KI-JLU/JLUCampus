import type { TFunction } from 'i18next'
import { TRANSLATOR_LANGUAGES, type TranslatorLanguage } from '@justcampus/shared'
import { ApiRequestError } from '@/lib/api'

export interface LanguageOption {
  code: TranslatorLanguage
  name: string
}

/**
 * The translator's languages in their fixed order (English variants first, as HAWKI lists them),
 * named in the UI language. The order does not follow the names, so it stays the same in every
 * UI language.
 */
export function languageOptions(t: TFunction): LanguageOption[] {
  return TRANSLATOR_LANGUAGES.map((code) => ({
    code,
    name: t(`component.translator.languages.${code}`)
  }))
}

/** A source language: `auto` lets the translator detect it. */
export type SourceLanguage = TranslatorLanguage | 'auto'

/**
 * The target that replaces one equal to the source: German, or British English for German, as
 * HAWKI's translator picks it for its German-speaking users.
 */
export function alternativeTarget(collision: TranslatorLanguage): TranslatorLanguage {
  return collision === 'de' ? 'en-gb' : 'de'
}

/** How long a failed request's message shows before the output is empty again. */
export const TEXT_ERROR_MS = 5000

/**
 * What a failed request of the page says, in HAWKI's words: the browser's own message when the
 * network failed (e.g. "Failed to fetch") or the server's when it throttled the request, its
 * general one for a failed translation or rewrite.
 */
export function textErrorMessage(
  error: unknown,
  mode: 'translate' | 'rephrase'
):
  | { text: string }
  | {
      key:
        | 'component.translator.errors.disabled'
        | 'component.translator.errors.invalid'
        | 'component.translator.errors.translateFailed'
        | 'component.translator.errors.rephraseFailed'
    } {
  if (error instanceof TypeError && error.message) return { text: error.message }
  // HAWKI's throttle ("Too Many Attempts."), shown as the server words it.
  if (error instanceof ApiRequestError && error.code === 'rate_limited')
    return { text: error.message }
  if (error instanceof ApiRequestError && error.code === 'not_found') {
    return { key: 'component.translator.errors.disabled' }
  }
  if (error instanceof ApiRequestError && error.code === 'validation') {
    return { key: 'component.translator.errors.invalid' }
  }
  return {
    key:
      mode === 'rephrase'
        ? 'component.translator.errors.rephraseFailed'
        : 'component.translator.errors.translateFailed'
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
