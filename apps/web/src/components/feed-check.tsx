import { useQuery } from '@tanstack/react-query'
import { CheckCircle2Icon, CircleAlertIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Spinner } from '@ki4jlu/design-system'
import { externalUrlSchema } from '@justcampus/shared'
import { feedErrorKey } from '@/lib/feed'
import { hostnameTitle, withScheme } from '@/lib/links'
import { feedQuery } from '@/lib/queries'
import { useDebouncedValue } from '@/lib/use-debounced-value'

const CHECK_DELAY_MS = 500

/**
 * A live check under a feed URL field: once the typed address is a valid URL
 * and the user paused, the server fetches the feed, and this line names it or
 * says why it failed. It does not block saving; the tile shows the same state.
 */
export function FeedCheck({ url }: { url: string }): React.JSX.Element {
  const { t } = useTranslation()
  const debounced = useDebouncedValue(withScheme(url), CHECK_DELAY_MS)
  const parsed = externalUrlSchema.safeParse(debounced)
  const feedUrl = parsed.success ? parsed.data : ''
  const { data, error, isFetching } = useQuery({ ...feedQuery(feedUrl), enabled: feedUrl !== '' })

  let content: React.ReactNode = null
  if (feedUrl === '') content = null
  else if (isFetching && !data) {
    content = (
      <>
        <Spinner size="sm" aria-hidden="true" />
        <span>{t('feed.check.checking')}</span>
      </>
    )
  } else if (data) {
    content = (
      <>
        <CheckCircle2Icon aria-hidden="true" className="size-4 shrink-0 text-success" />
        <span>
          {t('feed.check.found', {
            title: data.title ?? hostnameTitle(feedUrl),
            count: data.items.length
          })}
        </span>
      </>
    )
  } else if (error) {
    content = (
      <>
        <CircleAlertIcon aria-hidden="true" className="size-4 shrink-0 text-error" />
        <span>{t(feedErrorKey(error))}</span>
      </>
    )
  }

  return (
    <p
      role="status"
      className="m-0 flex min-h-5 items-center gap-2 text-sm text-on-surface-variant"
    >
      {content}
    </p>
  )
}
