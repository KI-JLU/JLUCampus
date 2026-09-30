import { describe, expect, it } from 'vitest'
import type { FeedItem, UserFeed } from '@justcampus/shared'
import { newFeedEntries } from './new-feed-entries'

function item(id: string, publishedAt: string | null): FeedItem {
  return { id, title: `Entry ${id}`, link: null, publishedAt, summary: null }
}

function feed(readAt: string | null, items: FeedItem[]): UserFeed {
  return { title: 'Feed', link: null, items, fetchedAt: '2026-09-29T12:00:00Z', readAt }
}

const READ_AT = '2026-09-29T10:00:00Z'

describe('newFeedEntries', () => {
  it('notifies nothing on the first copy seen', () => {
    expect(newFeedEntries(undefined, feed(READ_AT, [item('a', '2026-09-29T11:00:00Z')]))).toEqual(
      []
    )
  })

  it('returns unread entries that were not in the previous copy', () => {
    const fresh = item('b', '2026-09-29T11:00:00Z')
    const seen = item('a', '2026-09-29T10:30:00Z')
    expect(newFeedEntries(new Set(['a']), feed(READ_AT, [fresh, seen]))).toEqual([fresh])
  })

  it('skips new ids the user has already read or that carry no date', () => {
    const current = feed(READ_AT, [item('old', '2026-09-29T09:00:00Z'), item('undated', null)])
    expect(newFeedEntries(new Set(), current)).toEqual([])
  })

  it('treats nothing as unread in a feed never read', () => {
    expect(newFeedEntries(new Set(), feed(null, [item('a', '2026-09-29T11:00:00Z')]))).toEqual([])
  })
})
