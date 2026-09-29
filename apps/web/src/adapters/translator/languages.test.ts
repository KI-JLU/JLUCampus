import { describe, expect, it } from 'vitest'
import { TRANSLATOR_LANGUAGES } from '@justcampus/shared'
import { ApiRequestError } from '@/lib/api'
import { isTranslateShortcut, languageOptions, translateErrorKey } from './languages'

describe('languageOptions', () => {
  it('names every language in the UI language, sorted by name', () => {
    const options = languageOptions('de')
    expect(options.map((option) => option.code).sort()).toEqual([...TRANSLATOR_LANGUAGES].sort())
    expect(options.find((option) => option.code === 'en')?.name).toBe('Englisch')
    const names = options.map((option) => option.name)
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, 'de')))
  })

  it('follows the locale', () => {
    expect(languageOptions('en').find((option) => option.code === 'de')?.name).toBe('German')
  })
})

describe('translateErrorKey', () => {
  const apiError = (
    status: number,
    code: 'module_unavailable' | 'not_found' | 'validation'
  ): ApiRequestError => new ApiRequestError(status, { error: { code, message: code } })

  it('explains an unavailable service, a disabled module and a rejected text', () => {
    expect(translateErrorKey(apiError(502, 'module_unavailable'))).toBe(
      'component.translator.errors.unavailable'
    )
    expect(translateErrorKey(apiError(404, 'not_found'))).toBe(
      'component.translator.errors.disabled'
    )
    expect(translateErrorKey(apiError(400, 'validation'))).toBe(
      'component.translator.errors.invalid'
    )
  })

  it('falls back to a general message', () => {
    expect(translateErrorKey(new TypeError('Failed to fetch'))).toBe(
      'component.translator.errors.failed'
    )
    expect(translateErrorKey(new ApiRequestError(500, null))).toBe(
      'component.translator.errors.failed'
    )
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
