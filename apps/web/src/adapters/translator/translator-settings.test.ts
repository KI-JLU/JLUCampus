import { describe, expect, it } from 'vitest'
import type { TranslatorEngineList } from '@justcampus/shared'
import {
  DEFAULT_SETTINGS,
  parseSettings,
  rephraseOptions,
  resolveEngine
} from './translator-settings'

describe('parseSettings', () => {
  it('starts with the defaults', () => {
    expect(parseSettings(null)).toEqual({
      mode: 'translate',
      engine: null,
      live: false,
      showChanges: false,
      formality: 'default',
      style: null,
      tone: null
    })
  })

  it('reads stored settings', () => {
    const stored = {
      mode: 'rephrase',
      engine: 'llm:mistral',
      live: true,
      showChanges: true,
      formality: 'formal',
      style: 'academic',
      tone: 'friendly'
    }
    expect(parseSettings(JSON.stringify(stored))).toEqual(stored)
  })

  it('replaces each invalid value with its default', () => {
    expect(
      parseSettings(JSON.stringify({ mode: 'summarise', engine: 'google', live: 'yes', tone: 'x' }))
    ).toEqual(DEFAULT_SETTINGS)
    expect(parseSettings(JSON.stringify({ live: true, style: 'poetic' }))).toEqual({
      ...DEFAULT_SETTINGS,
      live: true
    })
  })

  it('falls back to the defaults for anything but a settings object', () => {
    expect(parseSettings('{not json')).toEqual(DEFAULT_SETTINGS)
    expect(parseSettings('null')).toEqual(DEFAULT_SETTINGS)
    expect(parseSettings('[1, 2]')).toEqual(DEFAULT_SETTINGS)
  })
})

describe('resolveEngine', () => {
  const list: TranslatorEngineList = {
    engines: [
      { id: 'deepl', kind: 'deepl', label: 'DeepL' },
      { id: 'llm:mistral', kind: 'llm', label: 'Mistral' }
    ],
    defaultEngine: 'llm:mistral'
  }

  it('keeps an offered engine', () => {
    expect(resolveEngine('deepl', list)?.id).toBe('deepl')
  })

  it('falls back to the default engine', () => {
    expect(resolveEngine(null, list)?.id).toBe('llm:mistral')
    expect(resolveEngine('llm:removed', list)?.id).toBe('llm:mistral')
  })

  it('has nothing to offer without engines', () => {
    expect(resolveEngine('deepl', { engines: [], defaultEngine: null })).toBeNull()
  })
})

describe('rephraseOptions', () => {
  it('sends style and tone to a model', () => {
    expect(rephraseOptions({ style: 'academic', tone: 'friendly' }, 'llm')).toEqual({
      style: 'academic',
      tone: 'friendly'
    })
  })

  it('sends DeepL a style or a tone, never both', () => {
    expect(rephraseOptions({ style: 'academic', tone: 'friendly' }, 'deepl')).toEqual({
      style: 'academic',
      tone: null
    })
    expect(rephraseOptions({ style: null, tone: 'friendly' }, 'deepl')).toEqual({
      style: null,
      tone: 'friendly'
    })
  })
})
