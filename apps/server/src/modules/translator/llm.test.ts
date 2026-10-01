import { describe, expect, it } from 'vitest'

import {
  buildComposePrompt,
  buildRephrasePrompt,
  buildSuggestPrompt,
  buildTranslationPrompt,
  parseComposeResponse,
  parseModelList,
  parseSegmentsResponse,
  parseSuggestions
} from './llm.js'

const adjustments = { formality: 'default', style: null, tone: null } as const

describe('LLM translator prompts', () => {
  it('includes formality, style and glossary terms in translation prompts', () => {
    expect(
      buildTranslationPrompt({ ...adjustments, source: 'en-gb', target: 'de', formality: 'formal' })
    ).toContain('formal and polite')
    expect(
      buildTranslationPrompt({
        ...adjustments,
        source: 'en-gb',
        target: 'de',
        formality: 'informal'
      })
    ).toContain('informal and casual')
    expect(
      buildTranslationPrompt({ ...adjustments, source: 'de', target: 'en-us', style: 'academic' })
    ).toContain('academic, objective')
    const withTerms = buildTranslationPrompt({ ...adjustments, source: 'de', target: 'en-gb' }, [
      { source: 'Prüfungsamt', target: 'Examinations Office' }
    ])
    expect(withTerms).toContain('"Prüfungsamt" → "Examinations Office"')
    expect(withTerms).toContain('British English')
  })

  it('includes style and tone in rephrase prompts', () => {
    expect(buildRephrasePrompt({ ...adjustments, language: null, style: 'business' })).toContain(
      'professional, crisp, and business-like'
    )
    expect(buildRephrasePrompt({ ...adjustments, language: 'de', tone: 'friendly' })).toContain(
      'friendly and warm'
    )
  })

  it('asks for suggestions without the ones already shown', () => {
    const prompt = buildSuggestPrompt({
      ...adjustments,
      kind: 'alternatives',
      text: 'Die Prüfung ist am Montag.',
      context: null,
      language: 'de',
      exclusions: ['Am Montag ist die Prüfung.']
    })
    expect(prompt).toContain('three alternative wordings')
    expect(prompt).toContain('"Am Montag ist die Prüfung."')
    expect(
      buildSuggestPrompt({
        ...adjustments,
        kind: 'synonyms',
        text: 'Prüfung',
        context: 'Die [[TARGET]]Prüfung[[TARGET]] ist am Montag.',
        language: 'de',
        exclusions: []
      })
    ).toContain('[[TARGET]]Prüfung[[TARGET]]')
  })

  it('tells the editor what each action does', () => {
    expect(
      buildComposePrompt({
        ...adjustments,
        action: 'table',
        text: 'a',
        instruction: 'als übersichtliche Tabelle darstellen',
        webSearch: false
      })
    ).toContain('Markdown table')
  })

  it('gives the editor the linked web pages to draw on', () => {
    const prompt = buildComposePrompt(
      {
        ...adjustments,
        action: 'compose',
        text: '',
        instruction: 'https://www.uni-giessen.de Ein Satz dazu',
        webSearch: true
      },
      [{ url: 'https://www.uni-giessen.de/', text: 'Justus-Liebig-Universität Gießen' }]
    )
    expect(prompt).toContain('<page url="https://www.uni-giessen.de/">')
    expect(prompt).toContain('Justus-Liebig-Universität Gießen')
  })
})

describe('LLM response parsing', () => {
  it('reads one sentence per sentence inside think blocks and code fences', () => {
    expect(
      parseSegmentsResponse(
        '<think>reasoning</think>```json\n{"text":["Hallo. ","Welt."],"detected_source_language":"en-GB"}\n```',
        2,
        'detected_source_language'
      )
    ).toEqual({ text: ['Hallo. ', 'Welt.'], detectedLanguage: 'en-gb' })
  })

  it('keeps an answer with the wrong number of sentences in the first one', () => {
    expect(parseSegmentsResponse('{"text":["Hallo Welt."]}', 2, 'detected_language')).toEqual({
      text: ['Hallo Welt.', ''],
      detectedLanguage: null
    })
    expect(parseSegmentsResponse('plain answer', 1, 'detected_language')).toEqual({
      text: ['plain answer'],
      detectedLanguage: null
    })
  })

  it('reads suggestions without blanks and repeats', () => {
    expect(parseSuggestions('{"suggestions":["A", " A ", "", "B"]}')).toEqual(['A', 'B'])
    expect(parseSuggestions('nothing')).toEqual([])
  })

  it('unwraps a Markdown answer fenced as a whole', () => {
    expect(parseComposeResponse('```markdown\n# Titel\n\nText\n```')).toBe('# Titel\n\nText')
    expect(parseComposeResponse('<think>x</think>- a\n- b')).toBe('- a\n- b')
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
