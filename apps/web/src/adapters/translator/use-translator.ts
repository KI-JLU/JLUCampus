import { useEffect, useState } from 'react'
import {
  TRANSLATE_TEXT_MAX,
  type TranslatorEngineId,
  type TranslatorLanguage
} from '@justcampus/shared'
import { useTranslate } from '@/lib/queries'
import { TEXT_ERROR_MS } from './languages'
import { useLatestRequest } from './use-latest-request'

export interface TranslateResult {
  translation: string
  /** The language translated into. */
  language: TranslatorLanguage
}

export interface Translator {
  target: TranslatorLanguage
  setTarget: (target: TranslatorLanguage) => void
  /** The latest translation, kept while the text is edited until the next one arrives. */
  result: TranslateResult | null
  pending: boolean
  error: Error | null
  /** There is text to translate and no translation on its way. */
  canTranslate: boolean
  /** Translates the text; a translation on its way is aborted. */
  translate: () => void
}

interface TranslatorOptions {
  text: string
  defaultTarget: TranslatorLanguage
  /** Left out: the default engine. */
  engine?: TranslatorEngineId
}

/**
 * The quick translation of the dashboard tile: the source language is detected, the text goes
 * as one piece. Changing the language while a translation is shown translates again. A failure
 * shows for `TEXT_ERROR_MS`, as on the page.
 */
export function useTranslator({ text, defaultTarget, engine }: TranslatorOptions): Translator {
  const [target, setTargetState] = useState<TranslatorLanguage>(defaultTarget)
  const [result, setResult] = useState<TranslateResult | null>(null)
  const mutation = useTranslate()
  const request = useLatestRequest(mutation)
  // A failure shows as long as on the page, then the output is empty again.
  const { error, reset } = mutation
  useEffect(() => {
    if (!error) return
    const timer = setTimeout(reset, TEXT_ERROR_MS)
    return () => clearTimeout(timer)
  }, [error, reset])

  const trimmed = text.trim()
  const hasText = trimmed.length > 0 && trimmed.length <= TRANSLATE_TEXT_MAX

  const run = (nextTarget: TranslatorLanguage): void => {
    if (!hasText) return
    request.run({ text: [trimmed], source: null, target: nextTarget, engine }, (response) =>
      setResult({ translation: response.text.join(''), language: nextTarget })
    )
  }

  return {
    target,
    setTarget: (next) => {
      setTargetState(next)
      if (result) run(next)
    },
    result,
    pending: request.pending,
    error: request.error,
    canTranslate: hasText && !request.pending,
    translate: () => run(target)
  }
}
