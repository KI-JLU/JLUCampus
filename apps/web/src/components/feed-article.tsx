import { useId, useLayoutEffect, useRef, useState } from 'react'
import { ChevronDownIcon, ChevronUpIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Badge, Button, Card } from '@ki4jlu/design-system'
import type { FeedItem } from '@justcampus/shared'
import { externalLinkProps } from '@/lib/external'
import type { FeedDate } from '@/lib/feed'
import { cn } from '@/lib/utils'

interface FeedArticleProps {
  item: FeedItem
  date: FeedDate | null
  /** Published after the user's previous read of the feed. */
  isNew: boolean
}

/**
 * One entry on the feed page as a card of its own: date, the title as a link
 * to the entry, and its summary. A summary longer than a few lines is clamped
 * with a button that shows the rest.
 */
export function FeedArticle({ item, date, isNew }: FeedArticleProps): React.JSX.Element {
  const { t } = useTranslation()
  const titleId = useId()
  const summaryId = useId()
  const summaryRef = useRef<HTMLParagraphElement>(null)
  const [expanded, setExpanded] = useState(false)
  const [clamped, setClamped] = useState(false)

  // Measured while collapsed only, so the button stays after expanding.
  useLayoutEffect(() => {
    const summary = summaryRef.current
    if (!summary || expanded) return
    const measure = (): void => setClamped(summary.scrollHeight > summary.clientHeight + 1)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(summary)
    return () => observer.disconnect()
  }, [expanded, item.summary])

  return (
    <Card>
      <article aria-labelledby={titleId} className="flex flex-col gap-stack-sm p-6 md:p-8">
        {date || isNew ? (
          <div className="flex flex-wrap items-center gap-2 text-sm text-on-surface-variant">
            {isNew ? (
              <Badge tone="primary" dot>
                {t('feed.newBadge')}
              </Badge>
            ) : null}
            {date ? (
              <time dateTime={item.publishedAt ?? undefined} title={date.full}>
                {date.long}
              </time>
            ) : null}
          </div>
        ) : null}
        <h2
          id={titleId}
          className="m-0 font-headline-md text-headline-md-mobile font-semibold text-on-surface"
        >
          {item.link ? (
            <a
              {...externalLinkProps(item.link)}
              className="text-on-surface no-underline hover:underline"
            >
              {item.title}
            </a>
          ) : (
            item.title
          )}
        </h2>
        {item.summary ? (
          <p
            ref={summaryRef}
            id={summaryId}
            className={cn(
              'm-0 text-body-base leading-relaxed text-on-surface',
              !expanded && 'line-clamp-5'
            )}
          >
            {item.summary}
          </p>
        ) : null}
        {clamped ? (
          <Button
            variant="ghost"
            size="sm"
            aria-expanded={expanded}
            aria-controls={summaryId}
            onClick={() => setExpanded((current) => !current)}
            className="-ml-4 self-start"
          >
            {expanded ? t('feed.showLess') : t('feed.readMore')}
            {expanded ? (
              <ChevronUpIcon aria-hidden="true" width="1em" height="1em" />
            ) : (
              <ChevronDownIcon aria-hidden="true" width="1em" height="1em" />
            )}
          </Button>
        ) : null}
      </article>
    </Card>
  )
}
