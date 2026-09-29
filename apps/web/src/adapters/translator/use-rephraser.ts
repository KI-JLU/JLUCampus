import { useState } from 'react'
import {
  TRANSLATE_TEXT_MAX,
  type RephraseRequest,
  type RephraseResponse,
  type RephraseStyle,
  type RephraseTone,
  type TranslatorEngineId
} from '@justcampus/shared'
import { useRephrase } from '@/lib/queries'
import { useLatestRequest } from './use-latest-request'

export interface RephraseResult {
  response: RephraseResponse
  /** The text as sent, trimmed; "show changes" compares against it. */
  submitted: string
}

/** Engine, style and tone for one request, where they differ from the hook's. */
export type RephraseOverrides = Partial<Pick<RephraseRequest, 'engine' | 'style' | 'tone'>>

export interface Rephraser {
  /** The latest result, kept while the text is edited until the next one arrives. */
  result: RephraseResult | null
  pending: boolean
  error: Error | null
  /** There is text to rephrase and no request on its way. */
  canRephrase: boolean
  /** Rephrases the text; a request on its way is aborted. */
  rephrase: (overrides?: RephraseOverrides) => void
  /** Aborts a request on its way and forgets the result. */
  clear: () => void
}

interface RephraserOptions {
  text: string
  engine?: TranslatorEngineId
  style: RephraseStyle | null
  tone: RephraseTone | null
}

/** The state behind the page's rephrase mode, for the text the page owns. */
export function useRephraser({ text, engine, style, tone }: RephraserOptions): Rephraser {
  const [result, setResult] = useState<RephraseResult | null>(null)
  const request = useLatestRequest(useRephrase())

  const trimmed = text.trim()
  const hasText = trimmed.length > 0 && trimmed.length <= TRANSLATE_TEXT_MAX

  return {
    result,
    pending: request.pending,
    error: request.error,
    canRephrase: hasText && !request.pending,
    rephrase: (overrides = {}) => {
      if (!hasText) return
      request.run({ text: trimmed, engine, style, tone, ...overrides }, (response) =>
        setResult({ response, submitted: trimmed })
      )
    },
    clear: () => {
      request.cancel()
      setResult(null)
    }
  }
}
