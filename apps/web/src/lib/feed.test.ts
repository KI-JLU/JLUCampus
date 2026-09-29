import { describe, expect, it } from 'vitest'
import { ApiRequestError } from './api'
import { feedErrorKey, formatFeedDate } from './feed'

const NOW = new Date('2026-09-28T12:00:00Z')

describe('formatFeedDate', () => {
  it('is relative within the last week', () => {
    expect(formatFeedDate('2026-09-28T11:55:00Z', 'en', NOW)?.label).toBe('5 min. ago')
    expect(formatFeedDate('2026-09-28T09:00:00Z', 'en', NOW)?.label).toBe('3 hr. ago')
    expect(formatFeedDate('2026-09-27T12:00:00Z', 'de', NOW)?.label).toBe('gestern')
  })

  it('shows day and month for older entries, with the year only when it differs', () => {
    expect(formatFeedDate('2026-03-03T12:00:00Z', 'en', NOW)?.label).toBe('Mar 3')
    expect(formatFeedDate('2025-03-03T12:00:00Z', 'de', NOW)?.label).toBe('3. März 2025')
  })

  it('returns null for an unreadable date', () => {
    expect(formatFeedDate('soon', 'en', NOW)).toBeNull()
  })
})

describe('feedErrorKey', () => {
  const error = (code: 'feed_unavailable' | 'validation' | 'internal'): ApiRequestError =>
    new ApiRequestError(code === 'validation' ? 400 : 502, { error: { code, message: code } })

  it('tells an unreachable feed from a bad URL and anything else', () => {
    expect(feedErrorKey(error('feed_unavailable'))).toBe('feed.errors.unavailable')
    expect(feedErrorKey(error('validation'))).toBe('feed.errors.invalidUrl')
    expect(feedErrorKey(error('internal'))).toBe('feed.errors.failed')
    expect(feedErrorKey(new TypeError('Failed to fetch'))).toBe('feed.errors.failed')
  })
})
