import { Hono } from 'hono'
import { describe, expect, it, vi } from 'vitest'

import { ApiError } from '../../api.js'
import type { AppEnvironment } from '../types.js'
import { findDocument } from './documents.js'
import { translatorApp } from './index.js'

vi.mock('./documents.js', () => ({
  findDocument: vi.fn(),
  findDocumentResult: vi.fn(),
  resultFilename: () => 'a_en.pdf',
  publicDocument: vi.fn(),
  documentExpiry: vi.fn(),
  listDocuments: vi.fn(),
  pollDocument: vi.fn(),
  startDocumentWorker: vi.fn()
}))

function app(userId: string): Hono<AppEnvironment> {
  const testApp = new Hono<AppEnvironment>()
  testApp.use('*', async (context, next) => {
    context.set('session', { user: { id: userId } } as AppEnvironment['Variables']['session'])
    context.set('module', {
      type: 'translator',
      componentId: '00000000-0000-0000-0000-000000000001',
      config: {
        defaultTargetLanguage: 'en',
        deeplApiUrl: null,
        llmBaseUrl: null,
        llmModels: [],
        defaultEngine: null,
        documentsEnabled: true
      },
      secrets: { deeplApiKey: 'key', llmApiKey: null }
    })
    await next()
  })
  testApp.onError((error, context) => {
    if (error instanceof ApiError)
      return context.json({ error: { code: error.code } }, error.status)
    throw error
  })
  testApp.route('/', translatorApp)
  return testApp
}

const id = '123e4567-e89b-42d3-a456-426614174000'

describe('document routes', () => {
  it('answers 404 for another user’s job', async () => {
    vi.mocked(findDocument).mockImplementation(async (_id, _componentId, userId) =>
      userId === 'owner'
        ? ({ status: 'queued' } as Awaited<ReturnType<typeof findDocument>>)
        : undefined
    )
    const response = await app('other').request(`http://test/documents/${id}`)
    expect(response.status).toBe(404)
    expect(findDocument).toHaveBeenCalledWith(id, '00000000-0000-0000-0000-000000000001', 'other')
  })

  it('answers 409 before the translated file is stored', async () => {
    vi.mocked(findDocument).mockResolvedValue({ status: 'translating' } as Awaited<
      ReturnType<typeof findDocument>
    >)
    const response = await app('owner').request(`http://test/documents/${id}/download`)
    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toEqual({ error: { code: 'conflict' } })
  })
})
