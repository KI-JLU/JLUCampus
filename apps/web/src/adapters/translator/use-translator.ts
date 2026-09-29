import { useState } from 'react'
import {
  TRANSLATE_TEXT_MAX,
  type TranslateResponse,
  type TranslatorLanguage
} from '@justcampus/shared'
import { useTranslate } from '@/lib/queries'

export interface Translator {
  text: string
  setText: (text: string) => void
  /** `null` lets the service detect the language. */
  source: TranslatorLanguage | null
  setSource: (source: TranslatorLanguage | null) => void
  target: TranslatorLanguage
  setTarget: (target: TranslatorLanguage) => void
  /** The latest translation, kept while the text is edited until the next one arrives. */
  result: TranslateResponse | null
  pending: boolean
  error: Error | null
  /** There is text to translate and no translation on its way. */
  canTranslate: boolean
  translate: () => void
  /** Swapping needs a known source language: chosen, or detected by the last translation. */
  canSwap: boolean
  /** Swaps the languages and, once translated, the texts. */
  swap: () => void
}

/**
 * The state behind the translator page and tile. Changing a language while a
 * translation is shown translates again, so the result always matches the
 * languages on screen.
 */
export function useTranslator(defaultTarget: TranslatorLanguage): Translator {
  const [text, setText] = useState('')
  const [source, setSourceState] = useState<TranslatorLanguage | null>(null)
  const [target, setTargetState] = useState<TranslatorLanguage>(defaultTarget)
  const [result, setResult] = useState<TranslateResponse | null>(null)
  const mutation = useTranslate()

  const trimmed = text.trim()
  const canTranslate = trimmed.length > 0 && trimmed.length <= TRANSLATE_TEXT_MAX
  const knownSource = source ?? result?.detectedSource ?? null

  const run = (nextSource: TranslatorLanguage | null, nextTarget: TranslatorLanguage): void => {
    if (!canTranslate) return
    // Only the latest request's callbacks fire, so an older answer cannot overwrite a newer one.
    mutation.mutate(
      { text: trimmed, source: nextSource, target: nextTarget },
      { onSuccess: setResult }
    )
  }

  return {
    text,
    setText,
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
    pending: mutation.isPending,
    error: mutation.error,
    canTranslate: canTranslate && !mutation.isPending,
    translate: () => {
      if (!mutation.isPending) run(source, target)
    },
    canSwap: knownSource !== null && knownSource !== target && !mutation.isPending,
    swap: () => {
      if (knownSource === null || knownSource === target) return
      setSourceState(target)
      setTargetState(knownSource)
      mutation.reset()
      if (result) {
        setText(result.translation)
        setResult({ translation: text, detectedSource: null })
      }
    }
  }
}
