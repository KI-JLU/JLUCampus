import { describe, expect, it, vi } from 'vitest'

import { env } from '../../env.js'
import { encryptSecret } from '../../secrets.js'
import { pollDocument } from './documents.js'

const state = vi.hoisted(() => ({ claims: 0, writes: [] as Array<Record<string, unknown>> }))
vi.mock('../../db/index.js', () => ({
  db: {
    update: () => ({
      set: (values: Record<string, unknown>) => ({
        where: () => ({
          returning: async () => {
            state.claims++
            return state.claims === 1
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
            state.writes.push(values)
            resolve(undefined)
          }
        })
      })
    })
  }
}))

describe('document claim', () => {
  it('allows only one concurrent poll to download the result', async () => {
    state.claims = 0
    state.writes = []
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
    vi.unstubAllGlobals()
  })
})
