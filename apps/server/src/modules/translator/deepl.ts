import {
  toTranslatorLanguage,
  type rephraseRequestSchema,
  type RephraseResponse,
  type translateRequestSchema,
  type TranslateResponse,
  type TranslatorLanguage
} from '@justcampus/shared'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'

import type { GlossaryPair } from './glossaries.js'

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

/**
 * The most a translated document may take. Well above what a 20 MB original turns into, but
 * bounded: the result is held in memory and stored, and `deeplApiUrl` can point anywhere.
 */
export const DOCUMENT_RESULT_MAX_BYTES = 50 * 1024 * 1024

/** DeepL's result was larger than `DOCUMENT_RESULT_MAX_BYTES`; it cannot be fetched again. */
export class DocumentResultTooLargeError extends Error {
  constructor() {
    super('Translated document is too large')
  }
}

/** The body, read up to `max` bytes: refused early by `Content-Length`, else counted as it streams. */
export async function readLimited(response: Response, max: number): Promise<Buffer> {
  const declared = Number(response.headers.get('content-length'))
  if (declared > max) {
    await response.body?.cancel()
    throw new DocumentResultTooLargeError()
  }
  if (!response.body) return Buffer.alloc(0)
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > max) {
      await reader.cancel()
      throw new DocumentResultTooLargeError()
    }
    chunks.push(value)
  }
  return Buffer.concat(chunks)
}

/** DeepL's own message for a refused request, e.g. "The pdf file is encrypted…"; `null` if none. */
export class DeepLRefusedError extends DeepLHttpError {
  constructor(
    status: number,
    readonly detail: string | null
  ) {
    super(status)
  }
}

async function refusal(response: Response): Promise<DeepLHttpError> {
  if (response.status < 400 || response.status >= 500 || response.status === 429) {
    return new DeepLHttpError(response.status)
  }
  let detail: string | null = null
  try {
    const body = (await response.json()) as { message?: unknown; detail?: unknown }
    const message = typeof body.message === 'string' ? body.message : null
    const extra = typeof body.detail === 'string' ? body.detail : null
    detail = extra && message ? `${message} ${extra}` : (extra ?? message)
  } catch {
    detail = null
  }
  return new DeepLRefusedError(response.status, detail)
}

export async function uploadDocument(
  file: File,
  input: {
    source: TranslatorLanguage | null
    target: TranslatorLanguage
    formality: string
    glossaryId?: string | null
  },
  apiUrl: string | null,
  apiKey: string,
  signal: AbortSignal
): Promise<z.infer<typeof documentUploadResponseSchema>> {
  const body = new FormData()
  body.append('file', file, file.name)
  body.append('target_lang', deeplTargetLanguage(input.target))
  if (input.source) body.append('source_lang', deeplSourceLanguage(input.source))
  if (input.formality !== 'default') {
    body.append('formality', input.formality === 'formal' ? 'prefer_more' : 'prefer_less')
  }
  if (input.glossaryId) body.append('glossary_id', input.glossaryId)
  const response = await fetch(`${deeplBaseUrl(apiUrl, apiKey)}/v2/document`, {
    method: 'POST',
    redirect: 'error',
    signal,
    headers: { Authorization: `DeepL-Auth-Key ${apiKey}` },
    body
  })
  if (!response.ok) throw await refusal(response)
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
    bytes: await readLimited(response, DOCUMENT_RESULT_MAX_BYTES),
    contentType: response.headers.get('content-type') ?? 'application/octet-stream'
  }
}

export function deeplBaseUrl(apiUrl: string | null, apiKey: string): string {
  if (apiUrl) return apiUrl.replace(/\/$/, '')
  return apiKey.endsWith(':fx') ? 'https://api-free.deepl.com' : 'https://api.deepl.com'
}

export function deeplTargetLanguage(language: TranslatorLanguage): string {
  const overrides: Partial<Record<TranslatorLanguage, string>> = {
    pt: 'PT-PT',
    zh: 'ZH-HANS'
  }
  return overrides[language] ?? language.toUpperCase()
}

/** Source languages have no regional variants at DeepL. */
export function deeplSourceLanguage(language: TranslatorLanguage): string {
  return language.split('-')[0]!.toUpperCase()
}

export function deeplDetectedLanguage(value: string | undefined): TranslatorLanguage | null {
  return toTranslatorLanguage(value)
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

/** Runs a sentence-wise DeepL request with the sentences that have text; blank ones stay as they are. */
async function withBlankSegments<T extends { text: string[] }>(
  segments: readonly string[],
  run: (filled: string[]) => Promise<T>
): Promise<T> {
  const indices = segments.flatMap((segment, index) => (segment.trim() ? [index] : []))
  const result = await run(indices.map((index) => segments[index]!))
  const text = [...segments]
  indices.forEach((segmentIndex, resultIndex) => {
    text[segmentIndex] = result.text[resultIndex] ?? ''
  })
  return { ...result, text }
}

/** Temporary glossaries carry this name, so stale ones can be found and removed. */
export const TEMPORARY_GLOSSARY_PREFIX = 'justcampus-tmp-'

/** Terms as DeepL's TSV takes them: no tabs or line breaks inside, no empty or repeated sources. */
export function glossaryTsv(pairs: readonly GlossaryPair[]): string {
  const clean = (term: string): string => term.replace(/[\t\r\n]+/g, ' ').trim()
  const seen = new Set<string>()
  const lines: string[] = []
  for (const pair of pairs) {
    const source = clean(pair.source)
    const target = clean(pair.target)
    if (!source || !target || seen.has(source)) continue
    seen.add(source)
    lines.push(`${source}\t${target}`)
  }
  return lines.join('\n')
}

/**
 * Creates a DeepL glossary for one translation; `null` when no term applies. DeepL needs the
 * source language for a glossary, so without one there is none.
 */
export async function createDeepLGlossary(
  pairs: readonly GlossaryPair[],
  source: TranslatorLanguage | null,
  target: TranslatorLanguage,
  apiUrl: string | null,
  apiKey: string,
  signal: AbortSignal
): Promise<string | null> {
  const entries = glossaryTsv(pairs)
  if (!source || !entries) return null
  const data = z.object({ glossary_id: z.string().min(1) }).parse(
    await deeplFetch(
      deeplBaseUrl(apiUrl, apiKey),
      apiKey,
      '/v2/glossaries',
      {
        name: `${TEMPORARY_GLOSSARY_PREFIX}${Date.now()}-${randomUUID().slice(0, 8)}`,
        source_lang: deeplSourceLanguage(source).toLowerCase(),
        target_lang: deeplSourceLanguage(target).toLowerCase(),
        entries,
        entries_format: 'tsv'
      },
      signal
    )
  )
  return data.glossary_id
}

/** Removes a temporary glossary; a failure only costs a stale glossary, which the sweep removes. */
export async function deleteDeepLGlossary(
  glossaryId: string,
  apiUrl: string | null,
  apiKey: string
): Promise<void> {
  try {
    await fetch(`${deeplBaseUrl(apiUrl, apiKey)}/v2/glossaries/${encodeURIComponent(glossaryId)}`, {
      method: 'DELETE',
      redirect: 'error',
      signal: AbortSignal.timeout(15_000),
      headers: { Authorization: `DeepL-Auth-Key ${apiKey}` }
    })
  } catch (error) {
    console.error('Temporary DeepL glossary could not be deleted', glossaryId, error)
  }
}

/** Removes temporary glossaries older than `maxAgeMs`, left behind by a restart or a failure. */
export async function sweepDeepLGlossaries(
  apiUrl: string | null,
  apiKey: string,
  maxAgeMs: number,
  now = Date.now()
): Promise<void> {
  const response = await fetch(`${deeplBaseUrl(apiUrl, apiKey)}/v2/glossaries`, {
    redirect: 'error',
    signal: AbortSignal.timeout(15_000),
    headers: { Authorization: `DeepL-Auth-Key ${apiKey}` }
  })
  if (!response.ok) return
  const list = z
    .object({
      glossaries: z.array(
        z.object({ glossary_id: z.string(), name: z.string(), creation_time: z.string() })
      )
    })
    .safeParse(await response.json())
  if (!list.success) return
  for (const glossary of list.data.glossaries) {
    const created = Date.parse(glossary.creation_time)
    if (glossary.name.startsWith(TEMPORARY_GLOSSARY_PREFIX) && now - created > maxAgeMs) {
      await deleteDeepLGlossary(glossary.glossary_id, apiUrl, apiKey)
    }
  }
}

/** Whether a text holds markup, as HAWKI tells it: then DeepL is asked to keep the tags. */
export function hasMarkup(text: string): boolean {
  return text.includes('<') && text.includes('>') && /<[a-z/][^>]*>/i.test(text)
}

/**
 * The source language as HAWKI sends it: its code in capitals. DeepL knows no regional source
 * variants, so English (UK) or English (US) as the source fails there, as it does in HAWKI.
 */
export function deeplTextSourceLanguage(language: TranslatorLanguage): string {
  return language.toUpperCase()
}

export async function translateWithDeepL(
  input: TranslateRequest,
  apiUrl: string | null,
  apiKey: string,
  signal: AbortSignal,
  glossary: readonly GlossaryPair[] = []
): Promise<TranslateResponse> {
  const glossaryId = await createDeepLGlossary(
    glossary,
    input.source,
    input.target,
    apiUrl,
    apiKey,
    signal
  )
  try {
    let detectedSource: TranslatorLanguage | null = null
    const result = await withBlankSegments(input.text, async (text) => {
      const body = {
        text,
        target_lang: deeplTargetLanguage(input.target),
        ...(input.source ? { source_lang: deeplTextSourceLanguage(input.source) } : {}),
        // Markup anywhere makes DeepL treat all sentences as HTML, which escapes `&` and `"`.
        ...(hasMarkup(text.join('')) ? { tag_handling: 'html' } : {}),
        ...(input.formality === 'default'
          ? {}
          : { formality: input.formality === 'formal' ? 'prefer_more' : 'prefer_less' }),
        ...(glossaryId ? { glossary_id: glossaryId } : {})
      }
      const data = deeplTranslateResponseSchema.parse(
        await deeplFetch(deeplBaseUrl(apiUrl, apiKey), apiKey, '/v2/translate', body, signal)
      )
      detectedSource = deeplDetectedLanguage(data.translations[0]?.detected_source_language)
      return { text: data.translations.map((translation) => translation.text) }
    })
    return { text: result.text, detectedSource }
  } finally {
    if (glossaryId) void deleteDeepLGlossary(glossaryId, apiUrl, apiKey)
  }
}

/** The languages DeepL Write rewrites in; for others it keeps the text's own language. */
const deeplWriteLanguages: Partial<Record<TranslatorLanguage, string>> = {
  'en-gb': 'en-GB',
  'en-us': 'en-US'
}

export async function rephraseWithDeepL(
  input: RephraseRequest,
  apiUrl: string | null,
  apiKey: string,
  signal: AbortSignal
): Promise<RephraseResponse> {
  let detectedLanguage: TranslatorLanguage | null = null
  const variant = input.language ? deeplWriteLanguages[input.language] : undefined
  const result = await withBlankSegments(input.text, async (text) => {
    const body = {
      text,
      ...(variant ? { target_lang: variant } : {}),
      // DeepL Write takes a style or a tone, not both; the style panel never sends both.
      ...(input.style ? { writing_style: input.style } : input.tone ? { tone: input.tone } : {})
    }
    const data = deeplRephraseResponseSchema.parse(
      await deeplFetch(deeplBaseUrl(apiUrl, apiKey), apiKey, '/v2/write/rephrase', body, signal)
    )
    detectedLanguage = deeplDetectedLanguage(data.improvements[0]?.detected_source_language)
    return { text: data.improvements.map((improvement) => improvement.text) }
  })
  return { text: result.text, detectedLanguage }
}

/**
 * Detects a text's language with DeepL, which tells it with any translation: the sample is
 * translated into German, or into English when it is German.
 */
export async function detectWithDeepL(
  text: string,
  apiUrl: string | null,
  apiKey: string,
  signal: AbortSignal
): Promise<TranslatorLanguage | null> {
  const data = deeplTranslateResponseSchema.parse(
    await deeplFetch(
      deeplBaseUrl(apiUrl, apiKey),
      apiKey,
      '/v2/translate',
      { text: [text], target_lang: 'DE' },
      signal
    )
  )
  return deeplDetectedLanguage(data.translations[0]?.detected_source_language)
}
