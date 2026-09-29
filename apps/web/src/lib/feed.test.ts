import { describe, expect, it } from 'vitest'
import { ApiRequestError } from './api'
import {
  feedErrorKey,
  formatFeedDate,
  hasUnreadEntries,
  isNewFeedItem,
  needsMarkRead
} from './feed'

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

describe('isNewFeedItem', () => {
  const READ = '2026-09-28T10:00:00Z'

  it('is new only when published after the previous read', () => {
    expect(isNewFeedItem({ publishedAt: '2026-09-28T10:00:01Z' }, READ)).toBe(true)
    expect(isNewFeedItem({ publishedAt: READ }, READ)).toBe(false)
    expect(isNewFeedItem({ publishedAt: '2026-09-28T09:00:00Z' }, READ)).toBe(false)
  })

  it('compares times, not strings', () => {
    expect(isNewFeedItem({ publishedAt: '2026-09-28T12:30:00+02:00' }, READ)).toBe(true)
    expect(isNewFeedItem({ publishedAt: '2026-09-28T11:30:00+02:00' }, READ)).toBe(false)
  })

  it('marks nothing before the first read, nor entries without a date', () => {
    expect(isNewFeedItem({ publishedAt: '2026-09-28T11:00:00Z' }, null)).toBe(false)
    expect(isNewFeedItem({ publishedAt: null }, READ)).toBe(false)
  })
})

describe('hasUnreadEntries', () => {
  const READ = '2026-09-28T10:00:00Z'
  const items = [{ publishedAt: '2026-09-28T09:00:00Z' }, { publishedAt: null }]

  it('is true once any entry was published after the last read', () => {
    const newer = [...items, { publishedAt: '2026-09-28T10:30:00Z' }]
    expect(hasUnreadEntries({ items: newer, readAt: READ })).toBe(true)
  })

  it('is false when every entry is older or undated, or the feed was never read', () => {
    expect(hasUnreadEntries({ items, readAt: READ })).toBe(false)
    expect(hasUnreadEntries({ items: [], readAt: READ })).toBe(false)
    expect(
      hasUnreadEntries({ items: [{ publishedAt: '2026-09-28T11:00:00Z' }], readAt: null })
    ).toBe(false)
  })
})

describe('needsMarkRead', () => {
  it('is needed for a feed never read or fetched after the last read', () => {
    expect(needsMarkRead({ fetchedAt: '2026-09-28T10:00:00Z', readAt: null })).toBe(true)
    expect(
      needsMarkRead({ fetchedAt: '2026-09-28T10:05:00Z', readAt: '2026-09-28T10:00:00Z' })
    ).toBe(true)
  })

  it('is not needed once the copy on screen was read', () => {
    expect(
      needsMarkRead({ fetchedAt: '2026-09-28T10:00:00Z', readAt: '2026-09-28T10:00:00Z' })
    ).toBe(false)
  })
})
