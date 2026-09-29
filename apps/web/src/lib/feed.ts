import type { FeedItem, UserFeed } from '@justcampus/shared'
import { ApiRequestError } from './api'

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

export interface FeedDate {
  /** Short: "5 min. ago", "yesterday", "3 Mar". */
  label: string
  /** Date and time in full, for a tooltip. */
  full: string
  /** The day spelled out: "16 September 2026". */
  long: string
}

/**
 * An entry's date in the given language: relative within the last week,
 * otherwise day and month (plus the year when it is not the current one).
 */
export function formatFeedDate(iso: string, language: string, now = new Date()): FeedDate | null {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null
  const full = new Intl.DateTimeFormat(language, {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(date)
  const long = new Intl.DateTimeFormat(language, { dateStyle: 'long' }).format(date)
  const ago = now.getTime() - date.getTime()
  if (ago >= 0 && ago < 7 * DAY) {
    const relative = new Intl.RelativeTimeFormat(language, { numeric: 'auto', style: 'short' })
    const label =
      ago < HOUR
        ? relative.format(-Math.floor(ago / MINUTE), 'minute')
        : ago < DAY
          ? relative.format(-Math.floor(ago / HOUR), 'hour')
          : relative.format(-Math.floor(ago / DAY), 'day')
    return { label, full, long }
  }
  const sameYear = date.getFullYear() === now.getFullYear()
  const label = new Intl.DateTimeFormat(language, {
    day: 'numeric',
    month: 'short',
    ...(sameYear ? {} : { year: 'numeric' })
  }).format(date)
  return { label, full, long }
}

export type FeedErrorKey =
  'feed.errors.unavailable' | 'feed.errors.invalidUrl' | 'feed.errors.failed'

/** The message for a failed `API.feed` request: unreachable feed, bad URL, or anything else. */
export function feedErrorKey(error: unknown): FeedErrorKey {
  if (error instanceof ApiRequestError) {
    if (error.code === 'feed_unavailable') return 'feed.errors.unavailable'
    if (error.code === 'validation') return 'feed.errors.invalidUrl'
  }
  return 'feed.errors.failed'
}

/** Whether both times are readable and `iso` is the later one. */
export function isLater(iso: string, than: string): boolean {
  const time = new Date(iso).getTime()
  const other = new Date(than).getTime()
  return !Number.isNaN(time) && !Number.isNaN(other) && time > other
}

/**
 * An entry is new when it was published after `unreadSince`, the user's previous read of its
 * feed. Nothing is new before the first read (`null`), and entries without a date never are.
 */
export function isNewFeedItem(
  item: Pick<FeedItem, 'publishedAt'>,
  unreadSince: string | null
): boolean {
  return item.publishedAt !== null && unreadSince !== null && isLater(item.publishedAt, unreadSince)
}

/** Whether the feed has entries published after the user last read it (its live `readAt`). */
export function hasUnreadEntries(
  feed: Pick<UserFeed, 'readAt'> & { items: Pick<FeedItem, 'publishedAt'>[] }
): boolean {
  return feed.items.some((item) => isNewFeedItem(item, feed.readAt))
}

/** Whether the copy on screen was fetched after the user last read the feed. */
export function needsMarkRead(feed: Pick<UserFeed, 'fetchedAt' | 'readAt'>): boolean {
  return feed.readAt === null || isLater(feed.fetchedAt, feed.readAt)
}
