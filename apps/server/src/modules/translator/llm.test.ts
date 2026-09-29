import { describe, expect, it } from 'vitest'

import { buildRephrasePrompt, buildTranslationPrompt, parseLlmResponse } from './llm.js'

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
