import { describe, expect, it } from 'vitest'
import type { TFunction } from 'i18next'
import type { AdminComponent } from '@justcampus/shared'
import { ApiRequestError } from './api'
import {
  initialFormState,
  selectableTypes,
  serverFieldErrors,
  validateComponentForm
} from './component-form'

// Messages come back as their keys, so the tests see which one was chosen.
const t = ((key: string) => key) as unknown as TFunction

const translator: AdminComponent = {
  id: '00000000-0000-4000-8000-000000000001',
  name: 'Übersetzer',
  icon: null,
  iconUrl: null,
  enabled: false,
  sortOrder: 0,
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
  type: 'translator',
  config: { defaultTargetLanguage: 'en' },
  secrets: { apiKey: false }
}

describe('selectableTypes', () => {
  it('offers only ordinary types for new and ordinary components', () => {
    expect(selectableTypes(null)).toEqual(['iframe', 'rss', 'link'])
    expect(
      selectableTypes({
        ...translator,
        type: 'link',
        config: { url: 'https://x.org' },
        secrets: {}
      })
    ).toEqual(['iframe', 'rss', 'link'])
  })

  it('keeps a module on its own type', () => {
    expect(selectableTypes(translator)).toEqual(['translator'])
  })
})

describe('validateComponentForm', () => {
  it('sends secrets only when one changed', () => {
    const state = initialFormState(translator)
    const unchanged = validateComponentForm(state, t)
    expect(unchanged.ok && 'secrets' in unchanged.input).toBe(false)

    const changed = validateComponentForm(
      { ...state, secrets: { apiKey: { value: ' key ', remove: false } } },
      t
    )
    expect(changed).toMatchObject({ ok: true, input: { secrets: { apiKey: 'key' } } })
  })

  it('reports an overlong secret on its field', () => {
    const result = validateComponentForm(
      {
        ...initialFormState(translator),
        secrets: { apiKey: { value: 'x'.repeat(5000), remove: false } }
      },
      t
    )
    expect(result).toEqual({ ok: false, errors: { 'secrets.apiKey': 'admin.form.errors.secret' } })
  })
})

describe('serverFieldErrors', () => {
  it('maps a rejected secret onto its field', () => {
    const error = new ApiRequestError(400, {
      error: {
        code: 'validation',
        message: 'Invalid',
        issues: [{ path: ['secrets', 'apiKey'], message: 'Too long' }]
      }
    })
    expect(serverFieldErrors(error, 'translator', t)).toEqual({
      'secrets.apiKey': 'admin.form.errors.secret'
    })
  })
})
