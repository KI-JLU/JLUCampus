import type { ReactNode } from 'react'
import { CloudOffIcon, RefreshCwIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button, Card, Spinner } from '@ki4jlu/design-system'
import type { Feed, FeedItem } from '@justcampus/shared'
import { externalLinkProps } from '@/lib/external'
import { feedErrorKey, formatFeedDate, isNewFeedItem } from '@/lib/feed'
import { cn } from '@/lib/utils'
import { FeedArticle } from './feed-article'

/** `tile`: titles and dates, compact. `page`: a card per entry, with its summary. */
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
      <FeedMessage variant={variant}>
        <Spinner label={t('feed.loading')} />
      </FeedMessage>
    )
  }
  if (!feed) {
    return (
      <FeedMessage variant={variant}>
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
  if (feed.items.length === 0) {
    return <FeedMessage variant={variant}>{t('feed.empty')}</FeedMessage>
  }
  if (variant === 'page') return <FeedArticleList items={feed.items} unreadSince={unreadSince} />
  return <FeedItemList items={feed.items} unreadSince={unreadSince} />
}

function FeedMessage({
  variant,
  children
}: {
  variant: FeedVariant
  children: ReactNode
}): React.JSX.Element {
  const message = (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 p-3 text-center text-sm text-on-surface-variant">
      {children}
    </div>
  )
  return variant === 'page' ? <Card className="flex min-h-40 flex-col">{message}</Card> : message
}

interface FeedItemListProps {
  items: FeedItem[]
  /** See `FeedContentProps.unreadSince`. */
  unreadSince: string | null
}

/** The feed page's entries, one card each; a new one is marked with a badge. */
function FeedArticleList({ items, unreadSince }: FeedItemListProps): React.JSX.Element {
  const { i18n } = useTranslation()
  const language = i18n.resolvedLanguage ?? i18n.language
  const now = new Date()

  return (
    <ul className="m-0 flex list-none flex-col gap-stack-md p-0">
      {items.map((item) => (
        <li key={item.id}>
          <FeedArticle
            item={item}
            date={item.publishedAt ? formatFeedDate(item.publishedAt, language, now) : null}
            isNew={isNewFeedItem(item, unreadSince)}
          />
        </li>
      ))}
    </ul>
  )
}

/**
 * A tile's entries as plain text; each with a link opens outside the app. A new entry gets a
 * dot and a bolder title, and screen readers hear "New" before it.
 */
export function FeedItemList({ items, unreadSince }: FeedItemListProps): React.JSX.Element {
  const { t, i18n } = useTranslation()
  const language = i18n.resolvedLanguage ?? i18n.language
  const now = new Date()

  return (
    <ul className="m-0 flex list-none flex-col p-0">
      {items.map((item) => {
        const date = item.publishedAt ? formatFeedDate(item.publishedAt, language, now) : null
        const isNew = isNewFeedItem(item, unreadSince)
        const body = (
          <>
            <span
              className={cn(
                'line-clamp-2 text-sm font-medium text-on-surface',
                isNew && 'font-semibold'
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
          </>
        )
        const className = 'flex flex-col gap-0.5 px-3 py-2 no-underline'
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
