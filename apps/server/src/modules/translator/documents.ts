import {
  TRANSLATOR_DOCUMENT_TTL_HOURS,
  translatorComponentConfigSchema,
  translatorDocumentExtension,
  translatorDocumentSchema,
  type TranslatorDocument
} from '@justcampus/shared'
import { and, desc, eq, getTableColumns, gt, inArray, isNull, lt, or } from 'drizzle-orm'

import { db } from '../../db/index.js'
import { component, translatorDocument } from '../../db/schema.js'
import { env } from '../../env.js'
import { decryptSecret } from '../../secrets.js'
import { documentError, documentStatus, downloadDocument } from './deepl.js'

export type DocumentRow = typeof translatorDocument.$inferSelect
/** A job without its translated file, which only the download reads. */
export type DocumentSummary = Omit<DocumentRow, 'result'>
const running = ['queued', 'translating']

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- taken out so lists never load the file
const { result, ...summaryColumns } = getTableColumns(translatorDocument)

export function resultFilename(filename: string, target: string): string {
  const extension = translatorDocumentExtension(filename)!
  return `${filename.slice(0, -(extension.length + 1))}_${target}.${extension}`
}

export function publicDocument(row: DocumentSummary): TranslatorDocument {
  return translatorDocumentSchema.parse({
    id: row.id,
    filename: row.filename,
    size: row.size,
    source: row.source,
    target: row.target,
    status: row.status,
    secondsRemaining: row.secondsRemaining,
    error: row.error,
    resultFilename: resultFilename(row.filename, row.target),
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
    const signal = AbortSignal.timeout(60_000)
    const status = await documentStatus(row.deeplDocumentId, key, apiUrl, apiKey, signal)
    if (status.document_id !== row.deeplDocumentId)
      throw new Error('DeepL returned another document id')
    if (status.status === 'done') {
      const result = await downloadDocument(row.deeplDocumentId, key, apiUrl, apiKey, signal)
      await db
        .update(translatorDocument)
        .set({
          status: 'done',
          secondsRemaining: null,
          error: null,
          result: result.bytes,
          resultContentType: result.contentType,
          pollClaimedAt: null,
          polledAt: now,
          updatedAt: new Date()
        })
        .where(
          and(
            eq(translatorDocument.id, id),
            eq(translatorDocument.pollClaimedAt, now),
            inArray(translatorDocument.status, running)
          )
        )
    } else {
      await db
        .update(translatorDocument)
        .set({
          status: status.status,
          secondsRemaining: status.seconds_remaining ?? null,
          error: status.status === 'error' ? documentError(status.error_message) : null,
          pollClaimedAt: null,
          polledAt: now,
          updatedAt: new Date()
        })
        .where(
          and(
            eq(translatorDocument.id, id),
            eq(translatorDocument.pollClaimedAt, now),
            inArray(translatorDocument.status, running)
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
          inArray(translatorDocument.status, running)
        )
      )
    throw error
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
            gt(translatorDocument.expiresAt, new Date()),
            eq(component.enabled, true),
            eq(component.type, 'translator')
          )
        )
      for (const job of jobs) {
        try {
          const parsed = translatorComponentConfigSchema.safeParse(job.config)
          if (!parsed.success || !parsed.data.documentsEnabled || !job.secrets.deeplApiKey) continue
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
