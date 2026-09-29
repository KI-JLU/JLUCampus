import { useEffect, useRef, useState } from 'react'
import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import type { UserFeed } from '@justcampus/shared'
import { needsMarkRead } from './feed'
import { feedQuery, useMarkFeedRead } from './queries'

export type UseFeedResult = Pick<
  UseQueryResult<UserFeed, Error>,
  'data' | 'error' | 'isPending' | 'refetch'
> & {
  /** When the user read the feed before this view; entries published later are new. */
  unreadSince: string | null
}

/**
 * A feed the user is shown, which marks it read. `unreadSince` is the `readAt` of the first copy
 * this view sees and stays for as long as the view does, so its new entries keep their markers
 * through refetches and the mark-read request; the next view starts from the new read.
 */
export function useFeed(url: string): UseFeedResult {
  const { data: feed, error, isPending, refetch } = useQuery(feedQuery(url))
  const { mutate: markRead } = useMarkFeedRead()

  const [baseline, setBaseline] = useState<{ url: string; readAt: string | null } | null>(null)
  if (feed && baseline?.url !== url) setBaseline({ url, readAt: feed.readAt })
  const unreadSince = baseline?.url === url ? baseline.readAt : null

  // One request per copy shown, also when it fails.
  const sent = useRef<string | null>(null)
  const fetchedAt = feed?.fetchedAt
  const readAt = feed?.readAt ?? null
  useEffect(() => {
    if (fetchedAt === undefined || !needsMarkRead({ fetchedAt, readAt })) return
    const key = `${url} ${fetchedAt}`
    if (sent.current === key) return
    sent.current = key
    markRead({ url, readAt: fetchedAt })
  }, [url, fetchedAt, readAt, markRead])

  return { data: feed, error, isPending, refetch, unreadSince }
}
