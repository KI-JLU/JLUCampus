import type { ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import { ExternalLinkIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { externalLinkProps } from '@/lib/external'
import { hostnameTitle } from '@/lib/links'
import { useFeed } from '@/lib/use-feed'
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

/**
 * A feed as a dashboard tile: a one-line header over its newest entries,
 * scrolling within the tile. Used by the RSS widget and by the user's own feeds.
 */
export function FeedPanel({
  feedUrl,
  title,
  icon,
  pageComponentId
}: FeedPanelProps): React.JSX.Element {
  const { t } = useTranslation()
  const { data: feed, error, isPending, refetch, unreadSince } = useFeed(feedUrl)
  const name = title ?? feed?.title ?? hostnameTitle(feedUrl)
  const site = feed?.link ?? null

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
        <h2 className="m-0 flex min-w-0 flex-1 text-sm font-semibold text-on-surface">{heading}</h2>
        {pageComponentId && site ? (
          <a
            {...externalLinkProps(site)}
            aria-label={t('feed.openSite', { name })}
            className="-mr-1 flex size-7 shrink-0 items-center justify-center rounded-md text-on-surface-variant transition-colors group-data-editing/tile:invisible hover:bg-surface-container focus-visible:bg-surface-container"
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
