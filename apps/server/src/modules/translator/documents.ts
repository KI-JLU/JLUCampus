import {
  TRANSLATOR_DOCUMENT_TTL_HOURS,
  translatorComponentConfigSchema,
  translatorDocumentExtension,
  translatorDocumentSchema,
  type TranslatorDocument
} from '@justcampus/shared'
import {
  and,
  count,
  desc,
  eq,
  getTableColumns,
  gt,
  inArray,
  isNull,
  lt,
  or,
  sql
} from 'drizzle-orm'

import { db } from '../../db/index.js'
import { component, translatorDocument } from '../../db/schema.js'
import { env } from '../../env.js'
import { decryptSecret } from '../../secrets.js'
import {
  DeepLHttpError,
  DocumentResultTooLargeError,
  deleteDeepLGlossary,
  documentError,
  documentStatus,
  downloadDocument
} from './deepl.js'

export type DocumentRow = typeof translatorDocument.$inferSelect
/** A job without its translated file, which only the download reads; its size instead. */
export type DocumentSummary = Omit<DocumentRow, 'result'> & { resultSize: number | null }
const running = ['queued', 'translating']

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- taken out so lists never load the file
const { result, ...tableColumns } = getTableColumns(translatorDocument)
const summaryColumns = {
  ...tableColumns,
  resultSize: sql<number | null>`octet_length(${translatorDocument.result})`
}

/** The values `error` had before it kept DeepL's own message. */
const LEGACY_ERRORS = new Set(['same_language', 'failed'])

/**
 * Temporary DeepL glossaries of running jobs (see `createDeepLGlossary`), removed once the job
 * ends. Held in this process only: after a restart the sweep removes them.
 */
const jobGlossaries = new Map<
  string,
  { glossaryId: string; apiUrl: string | null; apiKey: string }
>()

export function rememberJobGlossary(
  jobId: string,
  glossaryId: string,
  apiUrl: string | null,
  apiKey: string
): void {
  jobGlossaries.set(jobId, { glossaryId, apiUrl, apiKey })
}

function releaseJobGlossary(jobId: string): void {
  const glossary = jobGlossaries.get(jobId)
  if (!glossary) return
  jobGlossaries.delete(jobId)
  void deleteDeepLGlossary(glossary.glossaryId, glossary.apiUrl, glossary.apiKey)
}

/** The user's jobs still queued or translating at DeepL. */
export async function activeDocumentCount(userId: string): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(translatorDocument)
    .where(
      and(
        eq(translatorDocument.userId, userId),
        inArray(translatorDocument.status, running),
        isNull(translatorDocument.deletedAt),
        gt(translatorDocument.expiresAt, new Date())
      )
    )
  return row?.value ?? 0
}

/** DeepL returns an old Word file as DOCX, so its translation is named and marked that way. */
const RESULT_EXTENSIONS: Partial<Record<string, string>> = { doc: 'docx' }

export function resultFilename(filename: string, target: string): string {
  const extension = translatorDocumentExtension(filename)!
  const result = RESULT_EXTENSIONS[extension] ?? extension
  return `${filename.slice(0, -(extension.length + 1))}_${target}.${result}`
}

export function publicDocument(row: DocumentSummary): TranslatorDocument {
  const stored = row.error
  const raw = stored && !LEGACY_ERRORS.has(stored) ? stored : null
  return translatorDocumentSchema.parse({
    id: row.id,
    filename: row.filename,
    size: row.size,
    source: row.source,
    target: row.target,
    status: row.status,
    secondsRemaining: row.secondsRemaining,
    error: stored === null ? null : raw ? documentError(raw) : stored,
    errorMessage: raw,
    resultFilename: resultFilename(row.filename, row.target),
    resultSize: row.resultSize === null ? null : Number(row.resultSize),
    createdAt: row.createdAt.toISOString(),
    expiresAt: row.expiresAt.toISOString()
  })
}

export function documentExpiry(now = new Date()): Date {
  return new Date(now.getTime() + TRANSLATOR_DOCUMENT_TTL_HOURS * 60 * 60 * 1000)
}

export async function findDocument(
  id: string,
  componentId: string,
  userId: string
): Promise<DocumentSummary | undefined> {
  const [row] = await db
    .select(summaryColumns)
    .from(translatorDocument)
    .where(
      and(
        eq(translatorDocument.id, id),
        eq(translatorDocument.componentId, componentId),
        eq(translatorDocument.userId, userId),
        isNull(translatorDocument.deletedAt),
        gt(translatorDocument.expiresAt, new Date())
      )
    )
    .limit(1)
  return row
}

/** The translated file of a finished job, or `undefined` if there is none for this user. */
export async function findDocumentResult(
  id: string,
  componentId: string,
  userId: string
): Promise<Pick<DocumentRow, 'result' | 'resultContentType'> | undefined> {
  const [row] = await db
    .select({
      result: translatorDocument.result,
      resultContentType: translatorDocument.resultContentType
    })
    .from(translatorDocument)
    .where(
      and(
        eq(translatorDocument.id, id),
        eq(translatorDocument.componentId, componentId),
        eq(translatorDocument.userId, userId),
        isNull(translatorDocument.deletedAt),
        gt(translatorDocument.expiresAt, new Date())
      )
    )
    .limit(1)
  return row
}

export async function listDocuments(
  componentId: string,
  userId: string
): Promise<DocumentSummary[]> {
  return db
    .select(summaryColumns)
    .from(translatorDocument)
    .where(
      and(
        eq(translatorDocument.componentId, componentId),
        eq(translatorDocument.userId, userId),
        isNull(translatorDocument.deletedAt),
        gt(translatorDocument.expiresAt, new Date())
      )
    )
    .orderBy(desc(translatorDocument.createdAt))
}

/** One conditional update owns the status request and the one-shot result download. */
export async function pollDocument(
  id: string,
  apiUrl: string | null,
  apiKey: string,
  now = new Date()
): Promise<void> {
  const [row] = await db
    .update(translatorDocument)
    .set({ pollClaimedAt: now })
    .where(
      and(
        eq(translatorDocument.id, id),
        inArray(translatorDocument.status, running),
        isNull(translatorDocument.deletedAt),
        gt(translatorDocument.expiresAt, now),
        or(
          isNull(translatorDocument.pollClaimedAt),
          lt(translatorDocument.pollClaimedAt, new Date(now.getTime() - 300_000))
        ),
        or(
          isNull(translatorDocument.polledAt),
          lt(translatorDocument.polledAt, new Date(now.getTime() - 2_000))
        )
      )
    )
    .returning(summaryColumns)
  if (!row) return
  try {
    const key = decryptSecret(
      row.deeplDocumentKey,
      env.COMPONENT_SECRETS_KEY,
      `translator_document:${row.id}`,
      'document_key'
    )
    const status = await documentStatus(
      row.deeplDocumentId,
      key,
      apiUrl,
      apiKey,
      AbortSignal.timeout(15_000)
    )
    if (status.document_id !== row.deeplDocumentId)
      throw new Error('DeepL returned another document id')
    // Its glossary is no longer needed once the job ends, however it ends.
    if (status.status === 'done' || status.status === 'error') releaseJobGlossary(id)
    if (status.status === 'done') {
      let downloaded: Awaited<ReturnType<typeof downloadDocument>>
      try {
        downloaded = await downloadDocument(
          row.deeplDocumentId,
          key,
          apiUrl,
          apiKey,
          AbortSignal.timeout(60_000)
        )
      } catch (error) {
        // Gone at DeepL, or too large to keep: either way it cannot be fetched again.
        if (
          error instanceof DocumentResultTooLargeError ||
          (error instanceof DeepLHttpError &&
            error.status >= 400 &&
            error.status < 500 &&
            error.status !== 429)
        ) {
          await db
            .update(translatorDocument)
            .set({
              status: 'error',
              error: 'failed',
              secondsRemaining: null,
              pollClaimedAt: null,
              polledAt: now,
              updatedAt: new Date()
            })
            .where(
              and(
                eq(translatorDocument.id, id),
                eq(translatorDocument.pollClaimedAt, now),
                inArray(translatorDocument.status, running),
                isNull(translatorDocument.deletedAt)
              )
            )
          return
        }
        throw error
      }
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          await db
            .update(translatorDocument)
            .set({
              status: 'done',
              secondsRemaining: null,
              error: null,
              result: downloaded.bytes,
              resultContentType: downloaded.contentType,
              expiresAt: documentExpiry(),
              pollClaimedAt: null,
              polledAt: now,
              updatedAt: new Date()
            })
            .where(
              and(
                eq(translatorDocument.id, id),
                eq(translatorDocument.pollClaimedAt, now),
                inArray(translatorDocument.status, running),
                isNull(translatorDocument.deletedAt)
              )
            )
          break
        } catch (error) {
          if (attempt === 2) throw error
          await new Promise((resolve) => setTimeout(resolve, 100))
        }
      }
    } else {
      await db
        .update(translatorDocument)
        .set({
          status: status.status,
          secondsRemaining: status.seconds_remaining ?? null,
          // DeepL's own words, which the user sees; `failed` when it gave none.
          error: status.status === 'error' ? status.error_message?.trim() || 'failed' : null,
          pollClaimedAt: null,
          polledAt: now,
          updatedAt: new Date()
        })
        .where(
          and(
            eq(translatorDocument.id, id),
            eq(translatorDocument.pollClaimedAt, now),
            inArray(translatorDocument.status, running),
            isNull(translatorDocument.deletedAt)
          )
        )
    }
  } catch (error) {
    await db
      .update(translatorDocument)
      .set({ pollClaimedAt: null, polledAt: now })
      .where(
        and(
          eq(translatorDocument.id, id),
          eq(translatorDocument.pollClaimedAt, now),
          inArray(translatorDocument.status, running),
          isNull(translatorDocument.deletedAt)
        )
      )
    throw error
  }
}

/**
 * DeepL's own words for a failed job whose row only says `failed` or `same_language` (written by
 * an older release): asked at DeepL once, while DeepL still knows the job, and stored.
 */
export async function recoverErrorMessage(
  row: DocumentSummary,
  apiUrl: string | null,
  apiKey: string
): Promise<DocumentSummary> {
  if (row.status !== 'error' || !row.error || !LEGACY_ERRORS.has(row.error)) return row
  try {
    const key = decryptSecret(
      row.deeplDocumentKey,
      env.COMPONENT_SECRETS_KEY,
      `translator_document:${row.id}`,
      'document_key'
    )
    const status = await documentStatus(
      row.deeplDocumentId,
      key,
      apiUrl,
      apiKey,
      AbortSignal.timeout(10_000)
    )
    const message = status.status === 'error' ? status.error_message?.trim() : undefined
    if (!message || LEGACY_ERRORS.has(message)) return row
    await db
      .update(translatorDocument)
      .set({ error: message })
      .where(and(eq(translatorDocument.id, row.id), eq(translatorDocument.status, 'error')))
    return { ...row, error: message }
  } catch {
    return row
  }
}

export function startDocumentWorker(): () => void {
  let busy = false
  let stopped = false
  async function tick(): Promise<void> {
    if (busy || stopped) return
    busy = true
    try {
      await db.delete(translatorDocument).where(lt(translatorDocument.expiresAt, new Date()))
      const jobs = await db
        .select({
          id: translatorDocument.id,
          componentId: translatorDocument.componentId,
          config: component.config,
          secrets: component.secrets
        })
        .from(translatorDocument)
        .innerJoin(component, eq(translatorDocument.componentId, component.id))
        .where(
          and(
            inArray(translatorDocument.status, running),
            isNull(translatorDocument.deletedAt),
            gt(translatorDocument.expiresAt, new Date()),
            eq(component.enabled, true),
            eq(component.type, 'translator')
          )
        )
      async function processJob(job: (typeof jobs)[number]): Promise<void> {
        try {
          const parsed = translatorComponentConfigSchema.safeParse(job.config)
          if (!parsed.success || !parsed.data.documentsEnabled || !job.secrets.deeplApiKey) return
          const config = parsed.data
          const key = decryptSecret(
            job.secrets.deeplApiKey,
            env.COMPONENT_SECRETS_KEY,
            job.componentId,
            'deeplApiKey'
          )
          await pollDocument(job.id, config.deeplApiUrl, key)
        } catch (error) {
          console.error('Translator document poll failed', job.id, error)
        }
      }
      for (let offset = 0; offset < jobs.length; offset += 4) {
        await Promise.all(jobs.slice(offset, offset + 4).map(processJob))
      }
    } catch (error) {
      console.error('Translator document worker failed', error)
    } finally {
      busy = false
    }
  }
  const timer = setInterval(() => {
    void tick()
  }, 5_000)
  void tick()
  return () => {
    stopped = true
    clearInterval(timer)
  }
}
