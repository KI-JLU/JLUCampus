import { Hono } from 'hono'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '../../api.js'
import type { AppEnvironment } from '../types.js'
import { documentError, documentStatus, downloadDocument, uploadDocument } from './deepl.js'
import { resultFilename } from './documents.js'
import { translatorApp } from './index.js'

afterEach(() => vi.unstubAllGlobals())

function app(enabled: boolean): Hono<AppEnvironment> {
  const testApp = new Hono<AppEnvironment>()
  testApp.use('*', async (context, next) => {
    context.set('module', {
      type: 'translator',
      componentId: '00000000-0000-0000-0000-000000000001',
      config: {
        defaultTargetLanguage: 'en',
        deeplApiUrl: null,
        llmBaseUrl: null,
        llmModels: [],
        defaultEngine: null,
        documentsEnabled: enabled
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

describe('DeepL documents', () => {
  it('sends multipart fields and maps the status and result', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ document_id: 'doc', document_key: 'secret' }))
      .mockResolvedValueOnce(
        Response.json({
          document_id: 'doc',
          status: 'error',
          error_message: 'Source and target language are equal'
        })
      )
      .mockResolvedValueOnce(
        new Response('translated', { headers: { 'content-type': 'application/pdf' } })
      )
    vi.stubGlobal('fetch', fetch)
    const signal = new AbortController().signal
    await expect(
      uploadDocument(
        new File(['hi'], 'Bericht.docx'),
        { source: null, target: 'en', formality: 'formal' },
        null,
        'key',
        signal
      )
    ).resolves.toEqual({ document_id: 'doc', document_key: 'secret' })
    const [url, options] = fetch.mock.calls[0]!
    expect(url).toBe('https://api.deepl.com/v2/document')
    expect(options.redirect).toBe('error')
    expect(options.body.get('file').name).toBe('Bericht.docx')
    expect(options.body.get('target_lang')).toBe('EN-GB')
    expect(options.body.get('source_lang')).toBeNull()
    expect(options.body.get('formality')).toBe('prefer_more')
    const status = await documentStatus('doc', 'secret', null, 'key', signal)
    expect(documentError(status.error_message)).toBe('same_language')
    expect(documentError('Other failure')).toBe('failed')
    expect(fetch.mock.calls[1]![1].body).toBe('{"document_key":"secret"}')
    await expect(downloadDocument('doc', 'secret', null, 'key', signal)).resolves.toMatchObject({
      bytes: Buffer.from('translated'),
      contentType: 'application/pdf'
    })
    expect(resultFilename('Bericht.docx', 'en')).toBe('Bericht_en.docx')
  })

  it('sends an explicit source and informal formality', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async () =>
      Response.json({ document_id: 'doc', document_key: 'secret' })
    )
    vi.stubGlobal('fetch', fetch)
    await uploadDocument(
      new File(['hello'], 'note.txt'),
      { source: 'de', target: 'fr', formality: 'informal' },
      null,
      'key',
      new AbortController().signal
    )
    const body = fetch.mock.calls[0]![1]!.body as FormData
    expect(body.get('source_lang')).toBe('DE')
    expect(body.get('target_lang')).toBe('FR')
    expect(body.get('formality')).toBe('prefer_less')
  })

  it('hides documents when disabled', async () => {
    const response = await app(false).request('http://test/documents')
    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({ error: { code: 'not_found' } })
  })

  it.each([
    ['missing', new FormData()],
    [
      'empty',
      (() => {
        const form = new FormData()
        form.set('file', new File([], 'a.pdf'))
        return form
      })()
    ],
    [
      'type',
      (() => {
        const form = new FormData()
        form.set('file', new File(['x'], 'a.exe'))
        return form
      })()
    ],
    [
      'size',
      (() => {
        const form = new FormData()
        form.set('file', new File([new Uint8Array(20 * 1024 * 1024 + 1)], 'a.pdf'))
        return form
      })()
    ]
  ])('rejects %s upload', async (_name, body) => {
    const response = await app(true).request('http://test/documents', { method: 'POST', body })
    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({ error: { code: 'validation' } })
  })
})
