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
import { folderItemSchema, TILE_TITLE_MAX } from '@justcampus/shared'
import type { ShortcutFields } from '@/lib/dashboard'
import { hostnameOf, hostnameTitle, withScheme } from '@/lib/links'
import { Field } from './field'
import { IconPicker } from './icon-picker'
import { SiteIcon } from './site-icon'

interface ShortcutDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The shortcut to edit; `null` creates one. */
  shortcut: ShortcutFields | null
  onSave: (shortcut: ShortcutFields) => void
}

type Errors = Partial<Record<'url' | 'title' | 'icon', string>>

/**
 * Address, title and icon of a personal shortcut. An empty title becomes the
 * site's host name; without a chosen icon the tile shows the site's favicon.
 * Rendered only while open, so every opening starts from `shortcut`.
 */
export function ShortcutDialog({
  open,
  onOpenChange,
  shortcut,
  onSave
}: ShortcutDialogProps): React.JSX.Element {
  const { t } = useTranslation()
  const formId = useId()
  const [url, setUrl] = useState(shortcut?.url ?? '')
  const [title, setTitle] = useState(shortcut?.title ?? '')
  const [icon, setIcon] = useState<string | null>(shortcut?.icon ?? null)
  const [errors, setErrors] = useState<Errors>({})
  const normalizedUrl = withScheme(url)
  const host = hostnameOf(normalizedUrl)

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault()
    // The folder entry schema is the shortcut schema; the id only satisfies it.
    const result = folderItemSchema.safeParse({
      kind: 'link',
      id: crypto.randomUUID(),
      title: title.trim() || hostnameTitle(normalizedUrl),
      url: normalizedUrl,
      icon
    })
    if (!result.success) {
      const fields = new Set(result.error.issues.map((issue) => String(issue.path[0])))
      setErrors({
        url: fields.has('url') ? t('shortcut.errors.url') : undefined,
        title: fields.has('title')
          ? t('shortcut.errors.title', { max: TILE_TITLE_MAX })
          : undefined,
        icon: fields.has('icon') ? t('admin.form.errors.icon') : undefined
      })
      return
    }
    if (result.data.kind !== 'link') return
    onSave({ title: result.data.title, url: result.data.url, icon: result.data.icon })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent closeLabel={t('common.close')} className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t(shortcut ? 'shortcut.editTitle' : 'shortcut.createTitle')}</DialogTitle>
          <DialogDescription>{t('shortcut.description')}</DialogDescription>
        </DialogHeader>
        <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-stack-md">
          <Field
            id={`${formId}-url`}
            label={t('shortcut.url')}
            hint={t('shortcut.urlHint')}
            error={errors.url}
          >
            {(control) => (
              <Input
                {...control}
                type="url"
                inputMode="url"
                autoComplete="url"
                placeholder="https://"
                value={url}
                required
                autoFocus
                onChange={(event) => {
                  setUrl(event.target.value)
                  setErrors((current) => ({ ...current, url: undefined }))
                }}
                onBlur={() => setUrl(withScheme(url))}
              />
            )}
          </Field>
          <Field
            id={`${formId}-title`}
            label={t('shortcut.title')}
            hint={t('shortcut.titleHint')}
            error={errors.title}
          >
            {(control) => (
              <Input
                {...control}
                value={title}
                maxLength={TILE_TITLE_MAX}
                placeholder={host ?? undefined}
                onChange={(event) => {
                  setTitle(event.target.value)
                  setErrors((current) => ({ ...current, title: undefined }))
                }}
              />
            )}
          </Field>
          <Field
            id={`${formId}-icon`}
            label={t('shortcut.icon')}
            hint={t('shortcut.iconHint')}
            error={errors.icon}
          >
            {(control) => (
              <div className="flex items-center gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary-container text-lg text-on-primary-container">
                  <SiteIcon url={host ? normalizedUrl : ''} icon={icon} />
                </span>
                <div className="min-w-0 flex-1">
                  <IconPicker {...control} value={icon} onChange={setIcon} />
                </div>
              </div>
            )}
          </Field>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary">
                {t('common.cancel')}
              </Button>
            </DialogClose>
            <Button type="submit">{t(shortcut ? 'common.save' : 'shortcut.add')}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
