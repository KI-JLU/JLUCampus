import {
  TRANSLATOR_LANGUAGES,
  type rephraseRequestSchema,
  type RephraseResponse,
  type translateRequestSchema,
  type TranslateResponse,
  type TranslatorLanguage
} from '@justcampus/shared'
import { z } from 'zod'

/** Requests as parsed, with their defaults filled in. */
type TranslateRequest = z.output<typeof translateRequestSchema>
type RephraseRequest = z.output<typeof rephraseRequestSchema>

const deeplTranslateResponseSchema = z.object({
  translations: z
    .array(z.object({ text: z.string(), detected_source_language: z.string().optional() }))
    .min(1)
})
const deeplRephraseResponseSchema = z.object({
  improvements: z
    .array(z.object({ text: z.string(), detected_source_language: z.string().optional() }))
    .min(1)
})

export function deeplBaseUrl(apiUrl: string | null, apiKey: string): string {
  if (apiUrl) return apiUrl.replace(/\/$/, '')
  return apiKey.endsWith(':fx') ? 'https://api-free.deepl.com' : 'https://api.deepl.com'
}

export function deeplTargetLanguage(language: TranslatorLanguage): string {
  const overrides: Partial<Record<TranslatorLanguage, string>> = {
    en: 'EN-GB',
    pt: 'PT-PT',
    zh: 'ZH-HANS'
  }
  return overrides[language] ?? language.toUpperCase()
}

export function deeplDetectedLanguage(value: string | undefined): TranslatorLanguage | null {
  const language = value?.split('-')[0]?.toLowerCase()
  return language && (TRANSLATOR_LANGUAGES as readonly string[]).includes(language)
    ? (language as TranslatorLanguage)
    : null
}

async function deeplFetch(
  baseUrl: string,
  apiKey: string,
  path: string,
  body: object,
  signal: AbortSignal
): Promise<unknown> {
  const response = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    redirect: 'error',
    signal,
    headers: { Authorization: `DeepL-Auth-Key ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
  if (!response.ok) throw new Error(`DeepL returned ${response.status}`)
  return response.json()
}

export async function translateWithDeepL(
  input: TranslateRequest,
  apiUrl: string | null,
  apiKey: string,
  signal: AbortSignal
): Promise<TranslateResponse> {
  const body = {
    text: [input.text],
    target_lang: deeplTargetLanguage(input.target),
    ...(input.source ? { source_lang: input.source.toUpperCase() } : {}),
    ...(input.formality === 'default'
      ? {}
      : { formality: input.formality === 'formal' ? 'prefer_more' : 'prefer_less' })
  }
  const data = deeplTranslateResponseSchema.parse(
    await deeplFetch(deeplBaseUrl(apiUrl, apiKey), apiKey, '/v2/translate', body, signal)
  )
  const translation = data.translations[0]!
  return {
    translation: translation.text,
    detectedSource: deeplDetectedLanguage(translation.detected_source_language)
  }
}

export async function rephraseWithDeepL(
  input: RephraseRequest,
  apiUrl: string | null,
  apiKey: string,
  signal: AbortSignal
): Promise<RephraseResponse> {
  const body = {
    text: [input.text],
    ...(input.style ? { writing_style: input.style } : {}),
    ...(input.tone ? { tone: input.tone } : {})
  }
  const data = deeplRephraseResponseSchema.parse(
    await deeplFetch(deeplBaseUrl(apiUrl, apiKey), apiKey, '/v2/write/rephrase', body, signal)
  )
  const improvement = data.improvements[0]!
  return {
    text: improvement.text,
    detectedLanguage: deeplDetectedLanguage(improvement.detected_source_language)
  }
}
