import { describe, expect, it } from 'vitest'

import { listEngines, resolveDefaultEngine, resolveEngine } from './engines.js'

const config = {
  defaultTargetLanguage: 'en' as const,
  deeplApiUrl: null,
  llmBaseUrl: 'https://llm.example.test/v1',
  llmModels: [{ id: 'campus-1', label: 'Campus model' }],
  defaultEngine: 'llm:campus-1'
}

describe('translator engines', () => {
  it('lists DeepL first and uses an offered configured default', () => {
    const engines = listEngines(config, { deeplApiKey: 'key', llmApiKey: null })

    expect(engines).toEqual([
      { id: 'deepl', kind: 'deepl', label: 'DeepL' },
      { id: 'llm:campus-1', kind: 'llm', label: 'Campus model' }
    ])
    expect(resolveDefaultEngine(config, engines)).toBe('llm:campus-1')
  })

  it('falls back to the first engine and rejects an unavailable requested engine', () => {
    const engines = listEngines(
      { ...config, defaultEngine: 'deepl' },
      { deeplApiKey: null, llmApiKey: null }
    )

    expect(resolveDefaultEngine({ ...config, defaultEngine: 'deepl' }, engines)).toBe(
      'llm:campus-1'
    )
    expect(() => resolveEngine('deepl', config, { deeplApiKey: null, llmApiKey: null })).toThrow(
      'Translation engine is not available'
    )
  })
})
