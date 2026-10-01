import { describe, expect, it } from 'vitest'
import type { TFunction } from 'i18next'
import { TRANSLATOR_LANGUAGES } from '@justcampus/shared'
import { ApiRequestError } from '@/lib/api'
import de from '@/i18n/de.json'
import {
  alternativeTarget,
  isTranslateShortcut,
  languageOptions,
  textErrorMessage
} from './languages'

const t = ((key: string) => {
  const code = key.split('.').pop() as keyof typeof de.component.translator.languages
  return de.component.translator.languages[code]
}) as unknown as TFunction

describe('languageOptions', () => {
  it('lists every language in the fixed order, English variants first', () => {
    const options = languageOptions(t)
    expect(options.map((option) => option.code)).toEqual([...TRANSLATOR_LANGUAGES])
    expect(options.slice(0, 3).map((option) => option.name)).toEqual([
      'Englisch (UK)',
      'Englisch (US)',
      'Deutsch'
    ])
  })
})

describe('alternativeTarget', () => {
  it('replaces a target equal to the source with German, or British English for German', () => {
    expect(alternativeTarget('en-gb')).toBe('de')
    expect(alternativeTarget('fr')).toBe('de')
    expect(alternativeTarget('de')).toBe('en-gb')
  })
})

describe('isTranslateShortcut', () => {
  it('accepts Ctrl+Enter and Cmd+Enter only', () => {
    expect(isTranslateShortcut({ key: 'Enter', ctrlKey: true, metaKey: false })).toBe(true)
    expect(isTranslateShortcut({ key: 'Enter', ctrlKey: false, metaKey: true })).toBe(true)
    expect(isTranslateShortcut({ key: 'Enter', ctrlKey: false, metaKey: false })).toBe(false)
    expect(isTranslateShortcut({ key: 'a', ctrlKey: true, metaKey: false })).toBe(false)
  })
})

describe('textErrorMessage', () => {
  it('words a failed request as HAWKI does', () => {
    expect(textErrorMessage(new TypeError('Failed to fetch'), 'translate')).toEqual({
      text: 'Failed to fetch'
    })
    const upstream = new ApiRequestError(502, {
      error: { code: 'module_unavailable', message: 'down' }
    })
    expect(textErrorMessage(upstream, 'translate')).toEqual({
      key: 'component.translator.errors.translateFailed'
    })
    expect(textErrorMessage(upstream, 'rephrase')).toEqual({
      key: 'component.translator.errors.rephraseFailed'
    })
    expect(
      textErrorMessage(
        new ApiRequestError(404, { error: { code: 'not_found', message: 'gone' } }),
        'translate'
      )
    ).toEqual({ key: 'component.translator.errors.disabled' })
    expect(
      textErrorMessage(
        new ApiRequestError(429, {
          error: { code: 'rate_limited', message: 'Too Many Attempts.' }
        }),
        'rephrase'
      )
    ).toEqual({ text: 'Too Many Attempts.' })
  })
})
