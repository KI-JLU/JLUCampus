import { useId, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input
} from '@ki4jlu/design-system'
import { externalUrlSchema, TILE_TITLE_MAX } from '@justcampus/shared'
import type { FeedFields } from '@/lib/dashboard'
import { withScheme } from '@/lib/links'
import { FeedCheck } from './feed-check'
import { Field } from './field'

interface FeedDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The feed tile to edit; `null` creates one. */
  feed: FeedFields | null
  onSave: (feed: FeedFields) => void
}

type Errors = Partial<Record<'feedUrl' | 'title', string>>

/**
 * Address and optional title of a personal feed tile. While typing, the feed
 * is fetched once to show whether it can be read. Rendered only while open.
 */
export function FeedDialog({
  open,
  onOpenChange,
  feed,
  onSave
}: FeedDialogProps): React.JSX.Element {
  const { t } = useTranslation()
  const formId = useId()
  const [feedUrl, setFeedUrl] = useState(feed?.feedUrl ?? '')
  const [title, setTitle] = useState(feed?.title ?? '')
  const [errors, setErrors] = useState<Errors>({})

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault()
    const url = externalUrlSchema.safeParse(withScheme(feedUrl))
    const trimmed = title.trim()
    const next: Errors = {
      feedUrl: url.success ? undefined : t('feed.dialog.errors.url'),
      title:
        trimmed.length > TILE_TITLE_MAX
          ? t('shortcut.errors.title', { max: TILE_TITLE_MAX })
          : undefined
    }
    if (!url.success || next.title) {
      setErrors(next)
      return
    }
    onSave({ feedUrl: url.data, title: trimmed || null })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent closeLabel={t('common.close')} className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t(feed ? 'feed.dialog.editTitle' : 'feed.dialog.createTitle')}</DialogTitle>
          <DialogDescription>{t('feed.dialog.description')}</DialogDescription>
        </DialogHeader>
        <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-stack-md">
          <div className="grid gap-2">
            <Field
              id={`${formId}-url`}
              label={t('feed.dialog.url')}
              hint={t('feed.dialog.urlHint')}
              error={errors.feedUrl}
            >
              {(control) => (
                <Input
                  {...control}
                  type="url"
                  inputMode="url"
                  autoComplete="url"
                  placeholder="https://"
                  value={feedUrl}
                  required
                  autoFocus
                  onChange={(event) => {
                    setFeedUrl(event.target.value)
                    setErrors((current) => ({ ...current, feedUrl: undefined }))
                  }}
                  onBlur={() => setFeedUrl(withScheme(feedUrl))}
                />
              )}
            </Field>
            <FeedCheck url={feedUrl} />
          </div>
          <Field
            id={`${formId}-title`}
            label={t('feed.dialog.title')}
            hint={t('feed.dialog.titleHint')}
            error={errors.title}
          >
            {(control) => (
              <Input
                {...control}
                value={title}
                maxLength={TILE_TITLE_MAX}
                onChange={(event) => {
                  setTitle(event.target.value)
                  setErrors((current) => ({ ...current, title: undefined }))
                }}
              />
            )}
          </Field>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary">
                {t('common.cancel')}
              </Button>
            </DialogClose>
            <Button type="submit">{t(feed ? 'common.save' : 'feed.dialog.add')}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
