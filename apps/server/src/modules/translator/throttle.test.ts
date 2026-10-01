import { Hono } from 'hono'
import { describe, expect, it } from 'vitest'

import { ApiError } from '../../api.js'
import type { AppEnvironment } from '../types.js'
import { requestThrottle, throttled } from './throttle.js'

describe('requestThrottle', () => {
  it('opens a minute with the first request and refuses at each route its own limit', () => {
    const throttle = requestThrottle(60_000)
    expect([1, 2, 3].map(() => throttle('alice', 60, 1_000).remaining)).toEqual([59, 58, 57])
    // Three requests counted: an upload may still go up to ten.
    expect(throttle('alice', 4, 2_000)).toEqual({
      allowed: true,
      limit: 4,
      remaining: 0,
      resetsAt: 61_000
    })
    expect(throttle('alice', 4, 3_000).allowed).toBe(false)
    // The refused request did not count.
    expect(throttle('alice', 60, 4_000).remaining).toBe(55)
    expect(throttle('bob', 60, 4_000).remaining).toBe(59)
    expect(throttle('alice', 5, 60_999).allowed).toBe(false)
    expect(throttle('alice', 5, 61_000)).toMatchObject({ allowed: true, remaining: 4 })
  })
})

describe('throttled', () => {
  it("answers with Laravel's headers, and 429 once the count is used up", async () => {
    const throttle = requestThrottle()
    const app = new Hono<AppEnvironment>()
    app.use('*', async (context, next) => {
      context.set('session', { user: { id: 'alice' } } as AppEnvironment['Variables']['session'])
      await next()
    })
    app.onError((error, context) =>
      error instanceof ApiError
        ? context.json({ error: { code: error.code, message: error.message } }, error.status)
        : context.json({}, 500)
    )
    app.post('/text', throttled(throttle, 2), (context) => context.json({ ok: true }))
    app.post('/upload', throttled(throttle, 1), (context) => context.json({ ok: true }))

    const first = await app.request('http://test/text', { method: 'POST' })
    expect(first.status).toBe(200)
    expect(first.headers.get('X-RateLimit-Limit')).toBe('2')
    expect(first.headers.get('X-RateLimit-Remaining')).toBe('1')

    const upload = await app.request('http://test/upload', { method: 'POST' })
    expect(upload.status).toBe(429)
    expect(upload.headers.get('X-RateLimit-Remaining')).toBe('0')
    expect(Number(upload.headers.get('Retry-After'))).toBeGreaterThan(55)
    expect(upload.headers.get('X-RateLimit-Reset')).toMatch(/^\d+$/)
    await expect(upload.json()).resolves.toEqual({
      error: { code: 'rate_limited', message: 'Too Many Attempts.' }
    })
    expect((await app.request('http://test/text', { method: 'POST' })).status).toBe(200)
    expect((await app.request('http://test/text', { method: 'POST' })).status).toBe(429)
  })
})
