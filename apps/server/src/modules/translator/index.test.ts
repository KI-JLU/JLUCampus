import { Hono } from 'hono'
import { describe, expect, it } from 'vitest'

import { ApiError } from '../../api.js'
import type { AppEnvironment } from '../types.js'
import { translatorApp } from './index.js'

describe('translator routes', () => {
  it('rejects a DeepL rephrase request that combines style and tone', async () => {
    const app = new Hono<AppEnvironment>()
    app.use('*', async (context, next) => {
      context.set('module', {
        type: 'translator',
        componentId: 'component',
        config: {
          defaultTargetLanguage: 'en',
          deeplApiUrl: null,
          llmBaseUrl: null,
          llmModels: [],
          defaultEngine: null,
          documentsEnabled: false
        },
        secrets: { deeplApiKey: 'key', llmApiKey: null }
      })
      await next()
    })
    app.onError((error, context) => {
      if (error instanceof ApiError) {
        return context.json({ error: { code: error.code, message: error.message } }, error.status)
      }
      throw error
    })
    app.route('/', translatorApp)

    const response = await app.request('http://test/rephrase', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'Hello', engine: 'deepl', style: 'business', tone: 'friendly' })
    })
    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({ error: { code: 'validation' } })
  })
})
