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

const documentUploadResponseSchema = z.object({
  document_id: z.string().min(1),
  document_key: z.string().min(1)
})
const documentStatusResponseSchema = z.object({
  document_id: z.string().min(1),
  status: z.enum(['queued', 'translating', 'done', 'error']),
  seconds_remaining: z.number().int().nonnegative().optional(),
  billed_characters: z.number().int().nonnegative().optional(),
  error_message: z.string().optional()
})

export function documentError(message: string | undefined): 'same_language' | 'failed' {
  return message && /language/i.test(message) && /same|equal/i.test(message)
    ? 'same_language'
    : 'failed'
}

export class DeepLHttpError extends Error {
  constructor(readonly status: number) {
    super(`DeepL returned ${status}`)
  }
}

export async function uploadDocument(
  file: File,
  input: { source: TranslatorLanguage | null; target: TranslatorLanguage; formality: string },
  apiUrl: string | null,
  apiKey: string,
  signal: AbortSignal
): Promise<z.infer<typeof documentUploadResponseSchema>> {
  const body = new FormData()
  body.append('file', file, file.name)
  body.append('target_lang', deeplTargetLanguage(input.target))
  if (input.source) body.append('source_lang', input.source.toUpperCase())
  if (input.formality !== 'default') {
    body.append('formality', input.formality === 'formal' ? 'prefer_more' : 'prefer_less')
  }
  const response = await fetch(`${deeplBaseUrl(apiUrl, apiKey)}/v2/document`, {
    method: 'POST',
    redirect: 'error',
    signal,
    headers: { Authorization: `DeepL-Auth-Key ${apiKey}` },
    body
  })
  if (!response.ok) throw new DeepLHttpError(response.status)
  return documentUploadResponseSchema.parse(await response.json())
}

export async function documentStatus(
  documentId: string,
  documentKey: string,
  apiUrl: string | null,
  apiKey: string,
  signal: AbortSignal
): Promise<z.infer<typeof documentStatusResponseSchema>> {
  return documentStatusResponseSchema.parse(
    await deeplFetch(
      deeplBaseUrl(apiUrl, apiKey),
      apiKey,
      `/v2/document/${encodeURIComponent(documentId)}`,
      { document_key: documentKey },
      signal
    )
  )
}

export async function downloadDocument(
  documentId: string,
  documentKey: string,
  apiUrl: string | null,
  apiKey: string,
  signal: AbortSignal
): Promise<{ bytes: Buffer; contentType: string }> {
  const response = await fetch(
    `${deeplBaseUrl(apiUrl, apiKey)}/v2/document/${encodeURIComponent(documentId)}/result`,
    {
      method: 'POST',
      redirect: 'error',
      signal,
      headers: { Authorization: `DeepL-Auth-Key ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ document_key: documentKey })
    }
  )
  if (!response.ok) throw new DeepLHttpError(response.status)
  return {
    bytes: Buffer.from(await response.arrayBuffer()),
    contentType: response.headers.get('content-type') ?? 'application/octet-stream'
  }
}

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
  if (!response.ok) throw new DeepLHttpError(response.status)
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
