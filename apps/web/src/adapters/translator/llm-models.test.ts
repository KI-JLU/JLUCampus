import { describe, expect, it } from 'vitest'
import { TRANSLATOR_LLM_MODELS_MAX, type TranslatorComponentConfig } from '@justcampus/shared'
import { applyFetchedModels } from './llm-models'

const config: TranslatorComponentConfig = {
  defaultTargetLanguage: 'en',
  deeplApiUrl: null,
  llmBaseUrl: 'https://llm.example.test/v1',
  llmModels: [
    { id: 'qwen', label: 'Qwen (campus)' },
    { id: 'retired', label: 'Retired' }
  ],
  defaultEngine: 'llm:qwen',
  documentsEnabled: false
}

describe('applyFetchedModels', () => {
  it('takes the endpoint order and keeps display names of models still offered', () => {
    const result = applyFetchedModels(config, [
      { id: 'gemma', label: 'Gemma' },
      { id: 'qwen', label: 'Qwen 3' }
    ])

    expect(result.config.llmModels).toEqual([
      { id: 'gemma', label: 'Gemma' },
      { id: 'qwen', label: 'Qwen (campus)' }
    ])
    expect(result.config.defaultEngine).toBe('llm:qwen')
    expect(result.omitted).toBe(0)
  })

  it('clears a default engine whose model is gone and leaves DeepL alone', () => {
    const fetched = [{ id: 'gemma', label: 'Gemma' }]

    expect(applyFetchedModels(config, fetched).config.defaultEngine).toBeNull()
    expect(
      applyFetchedModels({ ...config, defaultEngine: 'deepl' }, fetched).config.defaultEngine
    ).toBe('deepl')
  })

  it('keeps at most the allowed number of models', () => {
    const fetched = Array.from({ length: TRANSLATOR_LLM_MODELS_MAX + 3 }, (_, index) => ({
      id: `model-${index}`,
      label: `Model ${index}`
    }))
    const result = applyFetchedModels(config, fetched)

    expect(result.config.llmModels).toHaveLength(TRANSLATOR_LLM_MODELS_MAX)
    expect(result.omitted).toBe(3)
  })
})
