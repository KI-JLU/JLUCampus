import { useLayoutEffect, useRef, type ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import { CheckCheckIcon, ExternalLinkIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { externalLinkProps } from '@/lib/external'
import { hasUnreadEntries } from '@/lib/feed'
import { hostnameTitle } from '@/lib/links'
import { useMarkFeedRead } from '@/lib/queries'
import { toast } from '@/lib/toast'
import { useFeed } from '@/lib/use-feed'
import { cn } from '@/lib/utils'
import { FeedContent } from './feed-list'

interface FeedPanelProps {
  feedUrl: string
  /** Shown instead of the feed's own title; `null` uses the feed's. */
  title: string | null
  /** Decorative, before the title. */
  icon: ReactNode
  /**
   * A catalogue component's id: the title then opens its page and the feed's
   * site gets a button of its own. Without it the title links to the site.
   */
  pageComponentId?: string
}

const headerButton =
  'flex size-7 shrink-0 items-center justify-center rounded-md text-on-surface-variant transition-colors group-data-editing/tile:invisible hover:bg-surface-container focus-visible:bg-surface-container'

/**
 * A feed as a dashboard tile: a one-line header over its newest entries,
 * scrolling within the tile. Used by the RSS widget and by the user's own feeds.
 * Showing it does not mark the feed read; its header button does, while there
 * are new entries.
 */
export function FeedPanel({
  feedUrl,
  title,
  icon,
  pageComponentId
}: FeedPanelProps): React.JSX.Element {
  const { t } = useTranslation()
  const { data: feed, error, isPending, refetch, unreadSince } = useFeed(feedUrl)
  const { mutate: markRead } = useMarkFeedRead()
  const headingRef = useRef<HTMLHeadingElement>(null)
  const refocus = useRef(false)
  const name = title ?? feed?.title ?? hostnameTitle(feedUrl)
  const site = feed?.link ?? null
  const unread = feed ? hasUnreadEntries(feed) : false

  // The button goes with the last new entry. If it had focus, the tile's heading takes it over
  // (its link, or the heading itself), unless focus has moved on in the meantime.
  useLayoutEffect(() => {
    if (unread || !refocus.current) return
    refocus.current = false
    if (document.activeElement !== null && document.activeElement !== document.body) return
    const heading = headingRef.current
    const target = heading?.querySelector<HTMLElement>('a') ?? heading
    target?.focus()
  }, [unread])

  function markAllRead(button: HTMLButtonElement, fetchedAt: string): void {
    refocus.current = document.activeElement === button
    markRead(
      { url: feedUrl, readAt: fetchedAt },
      {
        onError: () => {
          refocus.current = false
          toast({ variant: 'error', title: t('feed.markReadFailed') })
        }
      }
    )
  }

  const heading = pageComponentId ? (
    <Link
      to="/c/$componentId"
      params={{ componentId: pageComponentId }}
      aria-label={t('dashboard.openPage', { name })}
      className="truncate text-on-surface no-underline hover:underline"
    >
      {name}
    </Link>
  ) : site ? (
    <a
      {...externalLinkProps(site)}
      aria-label={t('feed.openSite', { name })}
      className="truncate text-on-surface no-underline hover:underline"
    >
      {name}
    </a>
  ) : (
    <span className="truncate">{name}</span>
  )

  return (
    <div className="flex size-full flex-col">
      <div className="flex h-9 shrink-0 items-center gap-2 border-b border-outline-variant px-3">
        <span className="flex shrink-0 text-on-surface-variant">{icon}</span>
        <h2
          ref={headingRef}
          tabIndex={-1}
          className="m-0 flex min-w-0 flex-1 text-sm font-semibold text-on-surface"
        >
          {heading}
        </h2>
        {feed && unread ? (
          // eslint-disable-next-line design-system/no-raw-ui-elements -- the compact header control, twin of the site link beside it; `Button` has no size this small
          <button
            type="button"
            aria-label={t('feed.markRead', { name })}
            title={t('feed.markReadButton')}
            onClick={(event) => markAllRead(event.currentTarget, feed.fetchedAt)}
            className={cn(headerButton, !(pageComponentId && site) && '-mr-1')}
          >
            <CheckCheckIcon aria-hidden="true" width="1em" height="1em" />
          </button>
        ) : null}
        {pageComponentId && site ? (
          <a
            {...externalLinkProps(site)}
            aria-label={t('feed.openSite', { name })}
            className={cn(headerButton, '-mr-1')}
          >
            <ExternalLinkIcon aria-hidden="true" width="1em" height="1em" />
          </a>
        ) : null}
      </div>
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        <FeedContent
          feed={feed}
          error={error}
          pending={isPending}
          unreadSince={unreadSince}
          onRetry={() => void refetch()}
          variant="tile"
        />
      </div>
    </div>
  )
}
