import { useState } from 'react'
import {
  TRANSLATE_TEXT_MAX,
  type TranslateRequest,
  type TranslateResponse,
  type TranslatorEngineId,
  type TranslatorFormality,
  type TranslatorLanguage
} from '@justcampus/shared'
import { useTranslate } from '@/lib/queries'
import { useLatestRequest } from './use-latest-request'

export interface TranslateResult {
  response: TranslateResponse
  /** The text as sent, trimmed. */
  submitted: string
  /** The language translated into. */
  language: TranslatorLanguage
  /** The translation this one replaced, if it was into the same language; for "show changes". */
  previous: string | null
}

/** Engine and formality for one translation, where they differ from the hook's. */
export type TranslateOverrides = Partial<Pick<TranslateRequest, 'engine' | 'formality'>>

export interface Translator {
  /** `null` lets the service detect the language. */
  source: TranslatorLanguage | null
  setSource: (source: TranslatorLanguage | null) => void
  target: TranslatorLanguage
  setTarget: (target: TranslatorLanguage) => void
  /** The latest translation, kept while the text is edited until the next one arrives. */
  result: TranslateResult | null
  pending: boolean
  error: Error | null
  /** There is text to translate and no translation on its way. */
  canTranslate: boolean
  /** Translates the text; a translation on its way is aborted. */
  translate: (overrides?: TranslateOverrides) => void
  /** Swapping needs a known source language: chosen, or detected by the last translation. */
  canSwap: boolean
  /** Swaps the languages and, once translated, the texts. */
  swap: () => void
  /** Aborts a translation on its way and forgets the result. */
  clear: () => void
}

interface TranslatorOptions {
  text: string
  setText: (text: string) => void
  defaultTarget: TranslatorLanguage
  /** Left out: the default engine. */
  engine?: TranslatorEngineId
  formality?: TranslatorFormality
}

/**
 * The translation state behind the translator page and tile; the text
 * belongs to the caller. Changing a language while a translation is shown
 * translates again, so the result always matches the languages on screen.
 */
export function useTranslator({
  text,
  setText,
  defaultTarget,
  engine,
  formality
}: TranslatorOptions): Translator {
  const [source, setSourceState] = useState<TranslatorLanguage | null>(null)
  const [target, setTargetState] = useState<TranslatorLanguage>(defaultTarget)
  const [result, setResult] = useState<TranslateResult | null>(null)
  const request = useLatestRequest(useTranslate())

  const trimmed = text.trim()
  const hasText = trimmed.length > 0 && trimmed.length <= TRANSLATE_TEXT_MAX
  const knownSource = source ?? result?.response.detectedSource ?? null

  const run = (
    nextSource: TranslatorLanguage | null,
    nextTarget: TranslatorLanguage,
    overrides: TranslateOverrides = {}
  ): void => {
    if (!hasText) return
    request.run(
      { text: trimmed, source: nextSource, target: nextTarget, engine, formality, ...overrides },
      (response) =>
        setResult((current) => ({
          response,
          submitted: trimmed,
          language: nextTarget,
          previous: current?.language === nextTarget ? current.response.translation : null
        }))
    )
  }

  return {
    source,
    setSource: (next) => {
      setSourceState(next)
      if (result) run(next, target)
    },
    target,
    setTarget: (next) => {
      setTargetState(next)
      if (result) run(source, next)
    },
    result,
    pending: request.pending,
    error: request.error,
    canTranslate: hasText && !request.pending,
    translate: (overrides) => run(source, target, overrides),
    canSwap: knownSource !== null && knownSource !== target && !request.pending,
    swap: () => {
      if (knownSource === null || knownSource === target) return
      setSourceState(target)
      setTargetState(knownSource)
      request.cancel()
      if (result) {
        setText(result.response.translation)
        setResult({
          response: { translation: text, detectedSource: null },
          submitted: result.response.translation.trim(),
          language: knownSource,
          previous: null
        })
      }
    },
    clear: () => {
      request.cancel()
      setResult(null)
    }
  }
}
