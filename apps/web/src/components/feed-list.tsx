import type { ReactNode } from 'react'
import { CloudOffIcon, RefreshCwIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button, Spinner } from '@ki4jlu/design-system'
import type { Feed, FeedItem } from '@justcampus/shared'
import { externalLinkProps } from '@/lib/external'
import { feedErrorKey, formatFeedDate, isNewFeedItem } from '@/lib/feed'
import { cn } from '@/lib/utils'

/** `tile`: titles and dates, compact. `page`: roomier, with each entry's summary. */
export type FeedVariant = 'tile' | 'page'

interface FeedContentProps {
  feed: Feed | undefined
  error: Error | null
  pending: boolean
  /** The user's previous read of the feed; entries published later are marked new. */
  unreadSince: string | null
  onRetry: () => void
  variant: FeedVariant
}

/** A feed's entries, or its loading, error or empty state in their place. */
export function FeedContent({
  feed,
  error,
  pending,
  unreadSince,
  onRetry,
  variant
}: FeedContentProps): React.JSX.Element {
  const { t } = useTranslation()
  if (pending) {
    return (
      <FeedMessage>
        <Spinner label={t('feed.loading')} />
      </FeedMessage>
    )
  }
  if (!feed) {
    return (
      <FeedMessage>
        <CloudOffIcon aria-hidden="true" className="size-6 text-on-surface-variant" />
        <p role="alert" className="m-0">
          {t(feedErrorKey(error))}
        </p>
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RefreshCwIcon aria-hidden="true" width="1em" height="1em" />
          {t('common.retry')}
        </Button>
      </FeedMessage>
    )
  }
  if (feed.items.length === 0) return <FeedMessage>{t('feed.empty')}</FeedMessage>
  return <FeedItemList items={feed.items} unreadSince={unreadSince} variant={variant} />
}

function FeedMessage({ children }: { children: ReactNode }): React.JSX.Element {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 p-3 text-center text-sm text-on-surface-variant">
      {children}
    </div>
  )
}

interface FeedItemListProps {
  items: FeedItem[]
  /** See `FeedContentProps.unreadSince`. */
  unreadSince: string | null
  variant: FeedVariant
}

/**
 * Entries as plain text; each with a link opens outside the app. A new entry gets a dot and a
 * bolder title, and screen readers hear "New" before it.
 */
export function FeedItemList({
  items,
  unreadSince,
  variant
}: FeedItemListProps): React.JSX.Element {
  const { t, i18n } = useTranslation()
  const language = i18n.resolvedLanguage ?? i18n.language
  const now = new Date()
  const page = variant === 'page'

  return (
    <ul className="m-0 flex list-none flex-col p-0">
      {items.map((item) => {
        const date = item.publishedAt ? formatFeedDate(item.publishedAt, language, now) : null
        const isNew = isNewFeedItem(item, unreadSince)
        const body = (
          <>
            <span
              className={cn(
                'text-on-surface',
                page ? 'font-semibold' : 'line-clamp-2 text-sm font-medium',
                isNew && (page ? 'font-bold' : 'font-semibold')
              )}
            >
              {isNew ? (
                <>
                  {/* Inline, so it sits on the first line and the title still clamps. */}
                  <span
                    aria-hidden="true"
                    className="mr-1.5 inline-block size-2 rounded-full bg-primary align-middle forced-colors:bg-[CanvasText]"
                  />
                  <span className="sr-only">{t('feed.newEntry')} </span>
                </>
              ) : null}
              {item.title}
            </span>
            {date ? (
              <time
                dateTime={item.publishedAt ?? undefined}
                title={date.full}
                className="text-xs text-on-surface-variant"
              >
                {date.label}
              </time>
            ) : null}
            {page && item.summary ? (
              <span className="line-clamp-4 text-sm text-on-surface-variant">{item.summary}</span>
            ) : null}
          </>
        )
        const className = cn('flex flex-col gap-0.5 no-underline', page ? 'px-4 py-3' : 'px-3 py-2')
        return (
          <li key={item.id} className="border-b border-outline-variant last:border-b-0">
            {item.link ? (
              <a
                {...externalLinkProps(item.link)}
                className={cn(
                  className,
                  'transition-colors hover:bg-surface-container focus-visible:bg-surface-container focus-visible:-outline-offset-2'
                )}
              >
                {body}
              </a>
            ) : (
              <div className={className}>{body}</div>
            )}
          </li>
        )
      })}
    </ul>
  )
}
