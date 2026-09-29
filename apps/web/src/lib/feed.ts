import { ApiRequestError } from './api'

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

export interface FeedDate {
  /** Short: "5 min. ago", "yesterday", "3 Mar". */
  label: string
  /** Date and time in full, for a tooltip. */
  full: string
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
  const ago = now.getTime() - date.getTime()
  if (ago >= 0 && ago < 7 * DAY) {
    const relative = new Intl.RelativeTimeFormat(language, { numeric: 'auto', style: 'short' })
    const label =
      ago < HOUR
        ? relative.format(-Math.floor(ago / MINUTE), 'minute')
        : ago < DAY
          ? relative.format(-Math.floor(ago / HOUR), 'hour')
          : relative.format(-Math.floor(ago / DAY), 'day')
    return { label, full }
  }
  const sameYear = date.getFullYear() === now.getFullYear()
  const label = new Intl.DateTimeFormat(language, {
    day: 'numeric',
    month: 'short',
    ...(sameYear ? {} : { year: 'numeric' })
  }).format(date)
  return { label, full }
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
