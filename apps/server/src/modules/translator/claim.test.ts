import { describe, expect, it, vi } from 'vitest'

import { env } from '../../env.js'
import { encryptSecret } from '../../secrets.js'
import { pollDocument, startDocumentWorker } from './documents.js'

const state = vi.hoisted(() => ({
  claims: 0,
  writes: [] as Array<Record<string, unknown>>,
  failStores: 0,
  jobs: [] as Array<Record<string, unknown>>
}))
vi.mock('../../db/index.js', () => ({
  db: {
    delete: () => ({ where: async () => undefined }),
    select: () => ({ from: () => ({ innerJoin: () => ({ where: async () => state.jobs }) }) }),
    update: () => ({
      set: (values: Record<string, unknown>) => ({
        where: () => ({
          returning: async () => {
            state.claims++
            return state.claims <= (state.jobs.length || 1)
              ? [
                  {
                    id: '00000000-0000-0000-0000-000000000001',
                    deeplDocumentId: 'remote',
                    deeplDocumentKey: encryptSecret(
                      'secret',
                      env.COMPONENT_SECRETS_KEY,
                      'translator_document:00000000-0000-0000-0000-000000000001',
                      'document_key'
                    )
                  }
                ]
              : []
          },
          then: (resolve: (value: unknown) => void) => {
            if (values.status === 'done' && state.failStores-- > 0) throw new Error('store failed')
            state.writes.push(values)
            resolve(undefined)
          }
        })
      })
    })
  }
}))

describe('document claim', () => {
  function reset(): void {
    state.claims = 0
    state.writes = []
    state.failStores = 0
    state.jobs = []
  }

  it('allows only one concurrent poll to download the result', async () => {
    reset()
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ document_id: 'remote', status: 'done' }))
      .mockResolvedValueOnce(new Response('result'))
    vi.stubGlobal('fetch', fetch)
    await Promise.all([
      pollDocument('00000000-0000-0000-0000-000000000001', null, 'key'),
      pollDocument('00000000-0000-0000-0000-000000000001', null, 'key')
    ])
    expect(state.claims).toBe(2)
    expect(fetch).toHaveBeenCalledTimes(2)
    expect(state.writes).toHaveLength(1)
    expect(state.writes[0]).toMatchObject({ status: 'done', result: Buffer.from('result') })
    expect((state.writes[0]!.expiresAt as Date).getTime()).toBeGreaterThan(Date.now())
    vi.unstubAllGlobals()
  })

  it('retries storing the one-shot result', async () => {
    reset()
    state.failStores = 2
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(Response.json({ document_id: 'remote', status: 'done' }))
        .mockResolvedValueOnce(new Response('result'))
    )
    await pollDocument('00000000-0000-0000-0000-000000000001', null, 'key')
    expect(state.writes).toHaveLength(1)
    expect(state.writes[0]).toMatchObject({ status: 'done', result: Buffer.from('result') })
    vi.unstubAllGlobals()
  })

  it('ends a job when DeepL no longer has its result', async () => {
    reset()
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(Response.json({ document_id: 'remote', status: 'done' }))
        .mockResolvedValueOnce(new Response('', { status: 404 }))
    )
    await pollDocument('00000000-0000-0000-0000-000000000001', null, 'key')
    expect(state.writes).toMatchObject([{ status: 'error', error: 'failed' }])
    vi.unstubAllGlobals()
  })

  it('leaves a job running after a transient result error', async () => {
    reset()
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(Response.json({ document_id: 'remote', status: 'done' }))
        .mockResolvedValueOnce(new Response('', { status: 503 }))
    )
    await expect(pollDocument('00000000-0000-0000-0000-000000000001', null, 'key')).rejects.toThrow(
      'DeepL returned 503'
    )
    expect(state.writes).toEqual([{ pollClaimedAt: null, polledAt: expect.any(Date) }])
    vi.unstubAllGlobals()
  })

  it('polls two slow jobs concurrently', async () => {
    reset()
    const componentId = '00000000-0000-0000-0000-000000000002'
    state.jobs = [1, 2].map((number) => ({
      id: `00000000-0000-0000-0000-00000000000${number}`,
      componentId,
      config: {
        defaultTargetLanguage: 'en',
        deeplApiUrl: null,
        llmBaseUrl: null,
        llmModels: [],
        defaultEngine: null,
        documentsEnabled: true
      },
      secrets: {
        deeplApiKey: encryptSecret('key', env.COMPONENT_SECRETS_KEY, componentId, 'deeplApiKey')
      }
    }))
    let release!: () => void
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const fetch = vi.fn(async () => {
      await gate
      return Response.json({ document_id: 'remote', status: 'queued' })
    })
    vi.stubGlobal('fetch', fetch)
    const stop = startDocumentWorker()
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(2))
    release()
    stop()
    vi.unstubAllGlobals()
  })
})
