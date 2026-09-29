import { Hono } from 'hono'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '../../api.js'
import type { AppEnvironment } from '../types.js'
import {
  deeplBaseUrl,
  DeepLHttpError,
  deeplDetectedLanguage,
  downloadDocument,
  deeplTargetLanguage,
  translateWithDeepL
} from './deepl.js'
import { translatorApp } from './index.js'

afterEach(() => vi.unstubAllGlobals())

describe('DeepL', () => {
  it('chooses the free endpoint and maps languages', () => {
    expect(deeplBaseUrl(null, 'free:fx')).toBe('https://api-free.deepl.com')
    expect(deeplBaseUrl(null, 'paid')).toBe('https://api.deepl.com')
    expect(deeplBaseUrl('https://custom.example.test/', 'free:fx')).toBe(
      'https://custom.example.test'
    )
    expect(deeplTargetLanguage('en')).toBe('EN-GB')
    expect(deeplTargetLanguage('pt')).toBe('PT-PT')
    expect(deeplTargetLanguage('zh')).toBe('ZH-HANS')
    expect(deeplDetectedLanguage('en-GB')).toBe('en')
  })

  it('sends DeepL translation requests and reads their response', async () => {
    const fetch = vi.fn(async () =>
      Response.json({ translations: [{ text: 'Hallo', detected_source_language: 'en' }] })
    )
    vi.stubGlobal('fetch', fetch)

    await expect(
      translateWithDeepL(
        { text: 'Hello', source: null, target: 'de', formality: 'formal' },
        null,
        'free:fx',
        new AbortController().signal
      )
    ).resolves.toEqual({ translation: 'Hallo', detectedSource: 'en' })
    expect(fetch).toHaveBeenCalledWith(
      'https://api-free.deepl.com/v2/translate',
      expect.objectContaining({
        redirect: 'error',
        body: JSON.stringify({ text: ['Hello'], target_lang: 'DE', formality: 'prefer_more' })
      })
    )
  })

  it('maps malformed upstream responses to module_unavailable', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ translations: [] }))
    )
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

    const response = await app.request('http://test/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'Hello', source: null, target: 'de' })
    })
    expect(response.status).toBe(502)
    await expect(response.json()).resolves.toMatchObject({ error: { code: 'module_unavailable' } })
  })

  it('exposes the DeepL HTTP status on failed result downloads', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('', { status: 404 }))
    )
    await expect(
      downloadDocument('doc', 'secret', null, 'key', new AbortController().signal)
    ).rejects.toMatchObject({ status: 404 })
    expect(new DeepLHttpError(429).message).toBe('DeepL returned 429')
  })
})
