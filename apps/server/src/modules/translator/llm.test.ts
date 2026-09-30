import { describe, expect, it } from 'vitest'

import {
  buildRephrasePrompt,
  buildTranslationPrompt,
  parseLlmResponse,
  parseModelList
} from './llm.js'

describe('LLM translator prompts', () => {
  it('includes formality in translation prompts', () => {
    expect(
      buildTranslationPrompt({ text: 'Hello', source: 'en', target: 'de', formality: 'formal' })
    ).toContain('formal and polite')
    expect(
      buildTranslationPrompt({ text: 'Hello', source: 'en', target: 'de', formality: 'informal' })
    ).toContain('informal and casual')
  })

  it('includes style and tone in rephrase prompts', () => {
    const prompt = buildRephrasePrompt({ text: 'Hi', style: 'business', tone: 'friendly' })
    expect(prompt).toContain('professional, crisp, and business-like')
    expect(prompt).toContain('friendly and warm')
  })
})

describe('LLM response parsing', () => {
  it('reads JSON inside think blocks and code fences', () => {
    expect(
      parseLlmResponse(
        '<think>reasoning</think>```json\n{"text":"Hallo","detected_source_language":"en-GB"}\n```',
        'detected_source_language'
      )
    ).toEqual({ text: 'Hallo', detectedLanguage: 'en' })
  })

  it('keeps non-JSON content with an unknown language', () => {
    expect(parseLlmResponse('plain answer', 'detected_language')).toEqual({
      text: 'plain answer',
      detectedLanguage: null
    })
  })
})

describe('LLM model list', () => {
  it('keeps chat models in order, labelled by name or id', () => {
    expect(
      parseModelList({
        object: 'list',
        data: [
          { id: 'jlu/qwen3.8-27b', object: 'model', name: 'Qwen 3.8 27B' },
          { id: 'text-embedding-3-small', object: 'model' },
          { id: 'jlu/gemma-4-26b-it', object: 'model', name: '  ' },
          { id: 'whisper-1' },
          { id: 'jlu/qwen3.8-27b', name: 'Duplicate' }
        ]
      })
    ).toEqual([
      { id: 'jlu/qwen3.8-27b', label: 'Qwen 3.8 27B' },
      { id: 'jlu/gemma-4-26b-it', label: 'jlu/gemma-4-26b-it' }
    ])
  })

  it('rejects an answer that is not a model list', () => {
    expect(() => parseModelList({ models: [] })).toThrow()
  })
})
