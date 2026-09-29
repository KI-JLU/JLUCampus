import { useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query'
import type { UserFeed } from '@justcampus/shared'
import { hasUnreadEntries, needsMarkRead } from './feed'
import { feedQuery, isMarkingFeedRead, useMarkFeedRead } from './queries'

export interface UseFeedOptions {
  /**
   * Showing the feed marks it read (its page). `unreadSince` is then the `readAt` of the first copy
   * this view sees and stays for as long as the view does, so its new entries keep their markers
   * through refetches and the mark-read request; the next view starts from the new read.
   */
  markReadOnView?: boolean
}

export type UseFeedResult = Pick<
  UseQueryResult<UserFeed, Error>,
  'data' | 'error' | 'isPending' | 'refetch'
> & {
  /** When the user read the feed before; entries published later are new. */
  unreadSince: string | null
}

/**
 * A feed the user is shown. Without `markReadOnView` its markers follow the cached `readAt`, so
 * they go as soon as the feed is marked read anywhere. A feed never read is marked read on first
 * sight either way, so that later entries can be new.
 */
export function useFeed(
  url: string,
  { markReadOnView = false }: UseFeedOptions = {}
): UseFeedResult {
  const { data: feed, error, isPending, refetch } = useQuery(feedQuery(url))

  const [baseline, setBaseline] = useState<{ url: string; readAt: string | null } | null>(null)
  if (markReadOnView && feed && baseline?.url !== url) setBaseline({ url, readAt: feed.readAt })
  const viewReadAt = baseline?.url === url ? baseline.readAt : null
  const unreadSince = markReadOnView ? viewReadAt : (feed?.readAt ?? null)

  useMarkReadOnce(url, feed, markReadOnView ? needsMarkRead : neverRead)

  return { data: feed, error, isPending, refetch, unreadSince }
}

/**
 * Whether the feed has entries newer than the user's last read, for a marker beside a link to it.
 * Shares the cache, and so the requests, with the feed's tiles and page.
 */
export function useFeedHasUnread(url: string): boolean {
  const { data: feed } = useQuery(feedQuery(url))
  useMarkReadOnce(url, feed, neverRead)
  return feed ? hasUnreadEntries(feed) : false
}

type ReadCheck = (feed: Pick<UserFeed, 'fetchedAt' | 'readAt'>) => boolean

function neverRead(feed: Pick<UserFeed, 'fetchedAt' | 'readAt'>): boolean {
  return feed.readAt === null
}

/**
 * Marks the feed read as of the copy shown when `due` says so: one request per copy, also when it
 * fails, and none while another view's request for the same copy is on its way.
 */
function useMarkReadOnce(url: string, feed: UserFeed | undefined, due: ReadCheck): void {
  const client = useQueryClient()
  const { mutate: markRead } = useMarkFeedRead()
  const sent = useRef<string | null>(null)
  const fetchedAt = feed?.fetchedAt
  const readAt = feed?.readAt ?? null
  useEffect(() => {
    if (fetchedAt === undefined || !due({ fetchedAt, readAt })) return
    const key = `${url} ${fetchedAt}`
    if (sent.current === key) return
    sent.current = key
    const read = { url, readAt: fetchedAt }
    if (!isMarkingFeedRead(client, read)) markRead(read)
  }, [url, fetchedAt, readAt, due, client, markRead])
}
