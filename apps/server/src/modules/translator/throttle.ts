import { TRANSLATOR_THROTTLED_MESSAGE } from '@justcampus/shared'
import type { MiddlewareHandler } from 'hono'

import { ApiError } from '../../api.js'
import type { AppEnvironment } from '../types.js'

/**
 * HAWKI's (Laravel's) throttle of the translator's requests: one count per user that every
 * throttled route adds to, each route with its own limit on it. A user's first request opens a
 * minute; a request is refused once the count has reached its route's limit, and refused
 * requests do not count. Counted in this Node process; several server processes would each count.
 */

/** How a request fared: whether it may go on, and the numbers of Laravel's headers. */
export interface ThrottleResult {
  allowed: boolean
  limit: number
  remaining: number
  /** When the minute ends, in milliseconds since the epoch. */
  resetsAt: number
}

export type Throttle = (userId: string, limit: number, now?: number) => ThrottleResult

export function requestThrottle(windowMs = 60_000): Throttle {
  const windows = new Map<string, { start: number; count: number }>()
  return (userId, limit, now = Date.now()) => {
    let current = windows.get(userId)
    if (!current || now - current.start >= windowMs) {
      // Users whose minute is over are forgotten, so the map only holds the active ones.
      for (const [id, window] of windows) if (now - window.start >= windowMs) windows.delete(id)
      current = { start: now, count: 0 }
      windows.set(userId, current)
    }
    const resetsAt = current.start + windowMs
    if (current.count >= limit) return { allowed: false, limit, remaining: 0, resetsAt }
    current.count += 1
    return { allowed: true, limit, remaining: Math.max(0, limit - current.count), resetsAt }
  }
}

/**
 * The route counts against the user's requests of the minute with `limit`, before anything else
 * looks at the request (HAWKI's throttle comes before its validation). Over it: `429` with
 * Laravel's message and headers.
 */
export function throttled(throttle: Throttle, limit: number): MiddlewareHandler<AppEnvironment> {
  return async (context, next) => {
    const now = Date.now()
    const result = throttle(context.get('session').user.id, limit, now)
    context.header('X-RateLimit-Limit', String(result.limit))
    context.header('X-RateLimit-Remaining', String(result.remaining))
    if (!result.allowed) {
      context.header('Retry-After', String(Math.max(0, Math.ceil((result.resetsAt - now) / 1000))))
      context.header('X-RateLimit-Reset', String(Math.ceil(result.resetsAt / 1000)))
      throw new ApiError(429, 'rate_limited', TRANSLATOR_THROTTLED_MESSAGE)
    }
    await next()
  }
}
