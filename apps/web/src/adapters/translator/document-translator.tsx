import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertCircleIcon,
  ArrowRightIcon,
  CheckCircle2Icon,
  DownloadIcon,
  FileTextIcon,
  Trash2Icon
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button, Card, FileDropzone, Label, Spinner } from '@ki4jlu/design-system'
import {
  API,
  TRANSLATOR_DOCUMENT_EXTENSIONS,
  TRANSLATOR_DOCUMENT_MAX_BYTES,
  TRANSLATOR_DOCUMENT_TTL_HOURS,
  translatorDocumentExtension,
  type TranslatorDocument,
  type TranslatorFormality,
  type TranslatorLanguage
} from '@justcampus/shared'
import { ApiRequestError, apiBase } from '@/lib/api'
import {
  useDeleteTranslatorDocument,
  useTranslatorDocuments,
  useUploadTranslatorDocument
} from '@/lib/queries'
import { toast } from '@/lib/toast'
import { cn } from '@/lib/utils'
import { LanguageSelect } from './language-select'
import { languageOptions } from './languages'

const ICON = { 'aria-hidden': true, className: 'size-4' } as const

const ACCEPT = TRANSLATOR_DOCUMENT_EXTENSIONS.map((extension) => `.${extension}`).join(',')

/** A file on its way to the server, until the server answers with its job. */
interface Upload {
  key: string
  name: string
  size: number
  /** Why the upload failed; `null` while it runs. */
  error: string | null
}

interface DocumentTranslatorProps {
  id: string
  defaultTarget: TranslatorLanguage
  formality: TranslatorFormality
}

/**
 * Document translation (DeepL only): the language bar, a dropzone that also opens the file
 * picker, and the user's jobs. The server follows each job at DeepL and keeps the translated
 * file for `TRANSLATOR_DOCUMENT_TTL_HOURS`, so the list survives closing the tab. Several
 * files are uploaded one after another, each with the languages chosen when it was added.
 */
export function DocumentTranslator({
  id,
  defaultTarget,
  formality
}: DocumentTranslatorProps): React.JSX.Element {
  const { t, i18n } = useTranslation()
  const locale = i18n.resolvedLanguage ?? i18n.language
  const languages = useMemo(() => languageOptions(locale), [locale])
  const inputRef = useRef<HTMLInputElement>(null)
  const [source, setSource] = useState<TranslatorLanguage | null>(null)
  const [target, setTarget] = useState<TranslatorLanguage>(defaultTarget)
  const [uploads, setUploads] = useState<Upload[]>([])
  const jobs = useTranslatorDocuments(true)
  const upload = useUploadTranslatorDocument()
  const remove = useDeleteTranslatorDocument()
  const announcement = useJobAnnouncement(jobs.data)
  const max = formatSize(TRANSLATOR_DOCUMENT_MAX_BYTES, locale)

  const languageName = (code: TranslatorLanguage | null): string =>
    code
      ? (languages.find((option) => option.code === code)?.name ?? code)
      : t('component.translator.detect')

  const addFiles = async (files: File[]): Promise<void> => {
    const accepted = files.filter((file) => {
      if (!translatorDocumentExtension(file.name)) {
        toast({
          variant: 'error',
          title: t('component.translator.documents.unsupported', { name: file.name })
        })
        return false
      }
      if (file.size > TRANSLATOR_DOCUMENT_MAX_BYTES) {
        toast({
          variant: 'error',
          title: t('component.translator.documents.tooLarge', { name: file.name, max })
        })
        return false
      }
      return true
    })
    // The languages as they are now, even if they change while earlier files upload.
    const request = { source, target, formality }
    for (const file of accepted) {
      const key = crypto.randomUUID()
      setUploads((current) => [...current, { key, name: file.name, size: file.size, error: null }])
      try {
        await upload.mutateAsync({ file, ...request })
        setUploads((current) => current.filter((item) => item.key !== key))
      } catch (error) {
        const message = t(uploadErrorKey(error))
        setUploads((current) =>
          current.map((item) => (item.key === key ? { ...item, error: message } : item))
        )
      }
    }
  }

  const deleteJob = (job: TranslatorDocument): void => {
    remove.mutate(job.id, {
      onError: () =>
        toast({
          variant: 'error',
          title: t('component.translator.documents.deleteFailed', { name: job.filename })
        })
    })
  }

  const list = jobs.data ?? []

  return (
    <div className="flex flex-col gap-stack-lg">
      <Card className="@container overflow-hidden">
        <div className="grid min-h-14 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-1 border-b border-outline-variant px-2 py-2 @xl:px-4">
          <Label htmlFor={`${id}-doc-source`} className="sr-only">
            {t('component.translator.source')}
          </Label>
          <LanguageSelect
            id={`${id}-doc-source`}
            inBar
            allowDetect
            value={source}
            onChange={setSource}
            className="@xl:justify-self-end"
          />
          <span className="flex size-9 items-center justify-center text-on-surface-variant">
            <ArrowRightIcon {...ICON} />
          </span>
          <Label htmlFor={`${id}-doc-target`} className="sr-only">
            {t('component.translator.target')}
          </Label>
          <LanguageSelect
            id={`${id}-doc-target`}
            inBar
            value={target}
            onChange={setTarget}
            className="@xl:justify-self-start"
          />
        </div>
        <div className="p-4 @xl:p-6">
          <FileDropzone
            icon={<FileTextIcon />}
            title={t('component.translator.documents.drop')}
            hint={t('component.translator.documents.types', { max })}
            onFiles={(files) => void addFiles(files)}
            onBrowse={() => inputRef.current?.click()}
            className="min-h-52"
          />
          {/* eslint-disable-next-line design-system/no-raw-ui-elements -- hidden file picker behind the dropzone, never rendered as a field */}
          <input
            ref={inputRef}
            type="file"
            multiple
            accept={ACCEPT}
            hidden
            onChange={(event) => {
              const files = Array.from(event.target.files ?? [])
              event.target.value = ''
              if (files.length > 0) void addFiles(files)
            }}
          />
        </div>
      </Card>
      <section aria-labelledby={`${id}-jobs-title`} className="flex flex-col gap-stack-sm">
        <div className="flex flex-col gap-1">
          <h2 id={`${id}-jobs-title`} className="m-0 text-base font-semibold text-on-surface">
            {t('component.translator.documents.listTitle')}
          </h2>
          <p className="m-0 text-sm text-on-surface-variant">
            {t('component.translator.documents.listHint', { hours: TRANSLATOR_DOCUMENT_TTL_HOURS })}
          </p>
        </div>
        {jobs.isPending ? (
          <Spinner label={t('component.translator.documents.loading')} />
        ) : jobs.isError ? (
          <p className="m-0 flex items-center gap-1.5 text-sm text-error">
            <AlertCircleIcon {...ICON} />
            {t('component.translator.documents.loadFailed')}
          </p>
        ) : uploads.length === 0 && list.length === 0 ? (
          <p className="m-0 text-sm text-on-surface-variant">
            {t('component.translator.documents.empty')}
          </p>
        ) : (
          <ul className="m-0 list-none overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest p-0">
            {uploads.map((item) => (
              <JobRow
                key={item.key}
                name={item.name}
                meta={formatSize(item.size, locale)}
                status={
                  item.error ? (
                    <StatusText tone="error">{item.error}</StatusText>
                  ) : (
                    <StatusText tone="busy">
                      {t('component.translator.documents.uploading')}
                    </StatusText>
                  )
                }
                actions={
                  item.error ? (
                    <IconButton
                      label={t('component.translator.documents.dismiss', { name: item.name })}
                      onClick={() =>
                        setUploads((current) => current.filter((other) => other.key !== item.key))
                      }
                    >
                      <Trash2Icon {...ICON} />
                    </IconButton>
                  ) : null
                }
              />
            ))}
            {list.map((job) => (
              <JobRow
                key={job.id}
                name={job.filename}
                meta={`${languageName(job.source)} → ${languageName(job.target)} · ${formatSize(job.size, locale)}`}
                status={<JobStatus job={job} locale={locale} />}
                actions={
                  <>
                    {job.status === 'done' ? (
                      <Button asChild variant="secondary" size="sm">
                        <a
                          href={`${apiBase()}${API.translatorDocumentDownload(job.id)}`}
                          download={job.resultFilename}
                        >
                          <DownloadIcon {...ICON} />
                          {t('component.translator.documents.download')}
                          <span className="sr-only">{` ${job.resultFilename}`}</span>
                        </a>
                      </Button>
                    ) : null}
                    <IconButton
                      label={t('component.translator.documents.delete', { name: job.filename })}
                      disabled={remove.isPending && remove.variables === job.id}
                      onClick={() => deleteJob(job)}
                    >
                      <Trash2Icon {...ICON} />
                    </IconButton>
                  </>
                }
              />
            ))}
          </ul>
        )}
        <p aria-live="polite" className="sr-only">
          {announcement}
        </p>
      </section>
    </div>
  )
}

/** Where a job stands: waiting, translating (with DeepL's estimate), done until when, or why not. */
function JobStatus({ job, locale }: { job: TranslatorDocument; locale: string }): React.ReactNode {
  const { t } = useTranslation()
  switch (job.status) {
    case 'queued':
      return <StatusText tone="busy">{t('component.translator.documents.queued')}</StatusText>
    case 'translating':
      return (
        <StatusText tone="busy">
          {job.secondsRemaining
            ? t('component.translator.documents.translatingFor', {
                seconds: job.secondsRemaining
              })
            : t('component.translator.documents.translating')}
        </StatusText>
      )
    case 'done':
      return (
        <StatusText tone="done">
          {t('component.translator.documents.done', {
            until: new Date(job.expiresAt).toLocaleString(locale, {
              dateStyle: 'short',
              timeStyle: 'short'
            })
          })}
        </StatusText>
      )
    case 'error':
      return (
        <StatusText tone="error">
          {t(
            job.error === 'same_language'
              ? 'component.translator.documents.sameLanguage'
              : 'component.translator.documents.failed'
          )}
        </StatusText>
      )
  }
}

function StatusText({
  tone,
  children
}: {
  tone: 'busy' | 'done' | 'error'
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <span
      className={cn(
        'flex items-center gap-1.5 text-xs',
        tone === 'error' ? 'text-error' : 'text-on-surface-variant'
      )}
    >
      {tone === 'busy' ? (
        <span aria-hidden="true" className="flex size-3.5 items-center">
          <Spinner size="sm" />
        </span>
      ) : tone === 'done' ? (
        <CheckCircle2Icon aria-hidden="true" className="size-3.5 text-success" />
      ) : (
        <AlertCircleIcon aria-hidden="true" className="size-3.5" />
      )}
      {children}
    </span>
  )
}

interface JobRowProps {
  name: string
  meta: string
  status: React.ReactNode
  actions: React.ReactNode
}

/** One file in the list: icon, name, languages and size, status, then what can be done with it. */
function JobRow({ name, meta, status, actions }: JobRowProps): React.JSX.Element {
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-2 border-outline-variant px-4 py-3 not-first:border-t">
      <span
        aria-hidden="true"
        className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary-container text-on-secondary-container"
      >
        <FileTextIcon className="size-4" />
      </span>
      <div className="grid min-w-0 flex-1 gap-0.5">
        <p className="m-0 truncate text-sm font-medium text-on-surface" title={name}>
          {name}
        </p>
        <p className="m-0 truncate text-xs text-on-surface-variant">{meta}</p>
        {status}
      </div>
      <div className="flex shrink-0 items-center gap-1">{actions}</div>
    </li>
  )
}

function IconButton({
  label,
  disabled,
  onClick,
  children
}: {
  label: string
  disabled?: boolean
  onClick: () => void
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </Button>
  )
}

/**
 * What a screenreader hears when a job finishes: the list refreshes itself, so without this a
 * finished translation would go unnoticed.
 */
function useJobAnnouncement(jobs: TranslatorDocument[] | undefined): string {
  const { t } = useTranslation()
  const previous = useRef<Map<string, TranslatorDocument['status']> | null>(null)
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!jobs) return
    const before = previous.current
    previous.current = new Map(jobs.map((job) => [job.id, job.status]))
    // The first list is what was there before; only changes after it are news.
    if (!before) return
    const finished = jobs.filter((job) => {
      const was = before.get(job.id)
      return (
        was !== undefined && was !== job.status && (job.status === 'done' || job.status === 'error')
      )
    })
    const last = finished.at(-1)
    if (!last) return
    setMessage(
      t(
        last.status === 'done'
          ? 'component.translator.documents.announceDone'
          : 'component.translator.documents.announceFailed',
        { name: last.filename }
      )
    )
  }, [jobs, t])

  return message
}

function uploadErrorKey(
  error: unknown
):
  | 'component.translator.documents.uploadInvalid'
  | 'component.translator.errors.unavailable'
  | 'component.translator.errors.disabled'
  | 'component.translator.errors.failed' {
  if (!(error instanceof ApiRequestError)) return 'component.translator.errors.failed'
  switch (error.code) {
    case 'validation':
      return 'component.translator.documents.uploadInvalid'
    case 'module_unavailable':
      return 'component.translator.errors.unavailable'
    case 'not_found':
      return 'component.translator.errors.disabled'
    default:
      return 'component.translator.errors.failed'
  }
}

/** Bytes as kB or MB in the UI language. */
function formatSize(bytes: number, locale: string): string {
  const megabytes = bytes / (1024 * 1024)
  return megabytes >= 1
    ? new Intl.NumberFormat(locale, {
        style: 'unit',
        unit: 'megabyte',
        maximumFractionDigits: 1
      }).format(megabytes)
    : new Intl.NumberFormat(locale, {
        style: 'unit',
        unit: 'kilobyte',
        maximumFractionDigits: 0
      }).format(Math.max(1, Math.round(bytes / 1024)))
}
