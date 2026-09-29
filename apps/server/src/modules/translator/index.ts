import {
  rephraseRequestSchema,
  rephraseResponseSchema,
  translateRequestSchema,
  translateResponseSchema,
  translatorComponentConfigSchema,
  translatorEngineListSchema,
  translatorDocumentExtension,
  translatorDocumentListSchema,
  translatorDocumentUploadSchema,
  TRANSLATOR_DOCUMENT_ACTIVE_MAX,
  TRANSLATOR_DOCUMENT_DAILY_MAX,
  TRANSLATOR_DOCUMENT_FILENAME_MAX,
  TRANSLATOR_DOCUMENT_MAX_BYTES
} from '@justcampus/shared'
import { and, eq, gt, isNull } from 'drizzle-orm'
import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { basename } from 'node:path'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'

import { ApiError, parseBody, validationIssues } from '../../api.js'
import { db } from '../../db/index.js'
import { translatorDocument } from '../../db/schema.js'
import { env } from '../../env.js'
import { encryptSecret } from '../../secrets.js'
import { getModuleRuntime } from '../context.js'
import type { AppEnvironment, ModuleRuntime, ServerModule } from '../types.js'
import { rephraseWithDeepL, translateWithDeepL, uploadDocument } from './deepl.js'
import {
  documentExpiry,
  documentQuotaCounts,
  findDocument,
  findDocumentResult,
  listDocuments,
  pollDocument,
  publicDocument,
  resultFilename,
  startDocumentWorker
} from './documents.js'
import { listEngines, resolveDefaultEngine, resolveEngine } from './engines.js'
import { rephraseWithLlm, translateWithLlm } from './llm.js'

export const translatorApp = new Hono<AppEnvironment>()

// Reservations cover overlapping requests in this Node process. Multiple server processes need a shared lock.
const uploadsInFlight = new Map<string, number>()

function upstreamSignal(signal: AbortSignal): AbortSignal {
  return AbortSignal.any([signal, AbortSignal.timeout(60_000)])
}

translatorApp.get('/engines', (context) => {
  const { config, secrets } = getModuleRuntime(context, 'translator')
  const engines = listEngines(config, secrets)
  return context.json(
    translatorEngineListSchema.parse({
      engines,
      defaultEngine: resolveDefaultEngine(config, engines),
      documents: Boolean(config.documentsEnabled && secrets.deeplApiKey)
    })
  )
})

function documentsRuntime(
  context: Parameters<typeof getModuleRuntime>[0]
): ModuleRuntime<'translator'> {
  const runtime = getModuleRuntime(context, 'translator')
  if (!runtime.config.documentsEnabled || !runtime.secrets.deeplApiKey) {
    throw new ApiError(404, 'not_found', 'Documents are not available')
  }
  return runtime
}

function documentId(value: string): string {
  return z.uuid().safeParse(value).success ? value : '00000000-0000-0000-0000-000000000000'
}

function validation(path: string, message: string): never {
  throw new ApiError(400, 'validation', 'Request validation failed', [{ path: [path], message }])
}

// Unavailable documents answer 404 before anything else looks at the request, the body limit too.
translatorApp.use('/documents', async (context, next) => {
  documentsRuntime(context)
  await next()
})
translatorApp.use('/documents/*', async (context, next) => {
  documentsRuntime(context)
  await next()
})

translatorApp.use(
  '/documents',
  bodyLimit({
    maxSize: TRANSLATOR_DOCUMENT_MAX_BYTES + 64 * 1024,
    onError: () => {
      throw new ApiError(400, 'validation', 'File is too large', [
        { path: ['file'], message: 'File is too large' }
      ])
    }
  })
)

translatorApp.get('/documents', async (context) => {
  const { componentId } = documentsRuntime(context)
  const rows = await listDocuments(componentId, context.get('session').user.id)
  return context.json(translatorDocumentListSchema.parse({ documents: rows.map(publicDocument) }))
})

translatorApp.post('/documents', async (context) => {
  const { componentId, config, secrets } = documentsRuntime(context)
  const userId = context.get('session').user.id
  // Reserved before the body is read, so parallel uploads cannot pile up 20 MB bodies unchecked.
  const inFlight = uploadsInFlight.get(userId) ?? 0
  uploadsInFlight.set(userId, inFlight + 1)
  try {
    const quota = await documentQuotaCounts(userId)
    if (
      quota.active + inFlight >= TRANSLATOR_DOCUMENT_ACTIVE_MAX ||
      quota.daily + inFlight >= TRANSLATOR_DOCUMENT_DAILY_MAX
    ) {
      throw new ApiError(429, 'rate_limited', 'Document upload limit reached')
    }
    let body: FormData
    try {
      body = await context.req.raw.formData()
    } catch {
      return validation('file', 'Expected multipart form data')
    }
    const uploaded = body.get('file')
    if (!(uploaded instanceof File) || uploaded.size === 0)
      return validation('file', 'Select a non-empty file')
    const filename = basename(uploaded.name.replaceAll('\\', '/')).trim()
    if (!filename || filename.length > TRANSLATOR_DOCUMENT_FILENAME_MAX)
      return validation('file', 'Invalid filename')
    if (!translatorDocumentExtension(filename)) return validation('file', 'Unsupported file type')
    if (uploaded.size > TRANSLATOR_DOCUMENT_MAX_BYTES)
      return validation('file', 'File is too large')
    const fields = Object.fromEntries(
      ['source', 'target', 'formality'].map((key) => [key, body.get(key) ?? undefined])
    )
    const parsed = translatorDocumentUploadSchema.safeParse(fields)
    if (!parsed.success)
      throw new ApiError(
        400,
        'validation',
        'Request validation failed',
        validationIssues(parsed.error)
      )
    const file = new File([uploaded], filename, { type: uploaded.type })
    let remote: Awaited<ReturnType<typeof uploadDocument>>
    try {
      remote = await uploadDocument(
        file,
        parsed.data,
        config.deeplApiUrl,
        secrets.deeplApiKey!,
        upstreamSignal(context.req.raw.signal)
      )
    } catch {
      throw new ApiError(502, 'module_unavailable', 'Translation service is unavailable')
    }
    const id = randomUUID()
    const [row] = await db
      .insert(translatorDocument)
      .values({
        id,
        componentId,
        userId,
        filename,
        size: uploaded.size,
        source: parsed.data.source,
        target: parsed.data.target,
        formality: parsed.data.formality,
        deeplDocumentId: remote.document_id,
        deeplDocumentKey: encryptSecret(
          remote.document_key,
          env.COMPONENT_SECRETS_KEY,
          `translator_document:${id}`,
          'document_key'
        ),
        expiresAt: documentExpiry()
      })
      .returning()
    return context.json(publicDocument(row!), 201)
  } finally {
    const remaining = (uploadsInFlight.get(userId) ?? 1) - 1
    if (remaining === 0) uploadsInFlight.delete(userId)
    else uploadsInFlight.set(userId, remaining)
  }
})

translatorApp.get('/documents/:id/download', async (context) => {
  const { componentId } = documentsRuntime(context)
  const row = await findDocument(
    documentId(context.req.param('id')),
    componentId,
    context.get('session').user.id
  )
  if (!row) throw new ApiError(404, 'not_found', 'Document not found')
  const stored =
    row.status === 'done'
      ? await findDocumentResult(row.id, componentId, context.get('session').user.id)
      : undefined
  if (!stored?.result) throw new ApiError(409, 'conflict', 'Document is not ready')
  const filename = resultFilename(row.filename, row.target)
  const fallback = filename.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_')
  return new Response(new Uint8Array(stored.result), {
    headers: {
      'Content-Type': stored.resultContentType ?? 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'private, no-store'
    }
  })
})

translatorApp.get('/documents/:id', async (context) => {
  const { componentId, config, secrets } = documentsRuntime(context)
  const id = documentId(context.req.param('id'))
  let row = await findDocument(id, componentId, context.get('session').user.id)
  if (!row) throw new ApiError(404, 'not_found', 'Document not found')
  if (row.status === 'queued' || row.status === 'translating') {
    try {
      await pollDocument(id, config.deeplApiUrl, secrets.deeplApiKey!)
    } catch (error) {
      console.error('Translator document poll failed', id, error)
    }
    row = await findDocument(id, componentId, context.get('session').user.id)
    if (!row) throw new ApiError(404, 'not_found', 'Document not found')
  }
  return context.json(publicDocument(row))
})

translatorApp.delete('/documents/:id', async (context) => {
  const { componentId } = documentsRuntime(context)
  const [deleted] = await db
    .update(translatorDocument)
    .set({ deletedAt: new Date(), result: null, resultContentType: null })
    .where(
      and(
        eq(translatorDocument.id, documentId(context.req.param('id'))),
        eq(translatorDocument.componentId, componentId),
        eq(translatorDocument.userId, context.get('session').user.id),
        isNull(translatorDocument.deletedAt),
        gt(translatorDocument.expiresAt, new Date())
      )
    )
    .returning({ id: translatorDocument.id })
  if (!deleted) throw new ApiError(404, 'not_found', 'Document not found')
  return context.body(null, 204)
})

translatorApp.post('/translate', async (context) => {
  const input = await parseBody(context, translateRequestSchema)
  const { config, secrets } = getModuleRuntime(context, 'translator')
  try {
    const engine = resolveEngine(input.engine, config, secrets)
    const signal = upstreamSignal(context.req.raw.signal)
    const result =
      engine.kind === 'deepl'
        ? await translateWithDeepL(input, config.deeplApiUrl, secrets.deeplApiKey!, signal)
        : await translateWithLlm(input, config.llmBaseUrl!, secrets.llmApiKey, engine.model, signal)
    return context.json(translateResponseSchema.parse(result))
  } catch (error) {
    if (error instanceof ApiError) throw error
    throw new ApiError(502, 'module_unavailable', 'Translation service is unavailable')
  }
})

translatorApp.post('/rephrase', async (context) => {
  const input = await parseBody(context, rephraseRequestSchema)
  const { config, secrets } = getModuleRuntime(context, 'translator')
  try {
    const engine = resolveEngine(input.engine, config, secrets)
    if (engine.kind === 'deepl' && input.style && input.tone) {
      throw new ApiError(400, 'validation', 'DeepL accepts either a style or a tone', [
        { path: ['tone'], message: 'DeepL cannot combine style and tone' }
      ])
    }
    const signal = upstreamSignal(context.req.raw.signal)
    const result =
      engine.kind === 'deepl'
        ? await rephraseWithDeepL(input, config.deeplApiUrl, secrets.deeplApiKey!, signal)
        : await rephraseWithLlm(input, config.llmBaseUrl!, secrets.llmApiKey, engine.model, signal)
    return context.json(rephraseResponseSchema.parse(result))
  } catch (error) {
    if (error instanceof ApiError) throw error
    throw new ApiError(502, 'module_unavailable', 'Translation service is unavailable')
  }
})

export const translatorModule: ServerModule<'translator'> = {
  type: 'translator',
  defaultName: 'Übersetzer',
  defaultIcon: 'languages',
  defaultConfig: {
    defaultTargetLanguage: 'en',
    deeplApiUrl: null,
    llmBaseUrl: null,
    llmModels: [],
    defaultEngine: null,
    documentsEnabled: false
  },
  configSchema: translatorComponentConfigSchema,
  app: translatorApp,
  start: startDocumentWorker
}
