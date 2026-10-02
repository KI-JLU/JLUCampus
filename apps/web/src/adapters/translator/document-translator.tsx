import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import {
  ArrowRightIcon,
  ChevronDownIcon,
  DownloadIcon,
  FileTextIcon,
  Trash2Icon,
  XIcon
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Badge, Button, Card, FileDropzone, Input, Spinner } from '@ki4jlu/design-system'
import {
  API,
  TRANSLATOR_DOCUMENT_ACTIVE_MAX,
  TRANSLATOR_DOCUMENT_TOO_LARGE,
  TRANSLATOR_THROTTLED_MESSAGE,
  TRANSLATOR_DOCUMENT_EXTENSIONS,
  translatorDocumentExtension,
  translatorDocumentSchema,
  type TranslatorDocument,
  type TranslatorFormality,
  type TranslatorLanguage
} from '@justcampus/shared'
import { ApiRequestError, apiBase, apiFetch } from '@/lib/api'
import {
  useDeleteTranslatorDocument,
  useTranslatorDocuments,
  useUploadTranslatorDocument
} from '@/lib/queries'
import { toast } from '@/lib/toast'
import { cn } from '@/lib/utils'
import { IconAction } from './copy-button'
import { formatSize } from './format'
import { LanguageMenu } from './language-menu'

const ICON = { 'aria-hidden': true, className: 'size-4' } as const

const ACCEPT = TRANSLATOR_DOCUMENT_EXTENSIONS.map((extension) => `.${extension}`).join(',')

/** How long to wait between looks at a running job: from 3 s, half a second more each time. */
const POLL_START_MS = 3000
const POLL_STEP_MS = 500
const POLL_MAX_MS = 5000
/** A job still running after this counts as failed. */
const POLL_TIMEOUT_MS = 5 * 60 * 1000

/** One selected file and where its translation stands. */
interface Item {
  key: string
  file: File
  /** `selected` until the batch starts; then its way through upload and DeepL. */
  state: 'selected' | 'waiting' | 'uploading' | 'queued' | 'translating' | 'done' | 'error'
  progress: number
  secondsRemaining: number | null
  job: TranslatorDocument | null
  error: string | null
}

/**
 * What the card shows, as in HAWKI three parts of their own: the drop zone, the selection (which
 * turns into the progress list while it is translated), and the last batch's results. A new
 * selection may stand above the results of the batch before.
 */
interface View {
  upload: boolean
  selection: boolean
  /** The last batch's files with their downloads or errors; `null`: none shown. */
  results: Item[] | null
  /** The target language can be chosen, from choosing files until they are declined. */
  languageActive: boolean
}
const START_VIEW: View = { upload: true, selection: false, results: null, languageActive: false }

/** Files dropped anywhere on the page's work area land here. */
export interface DocumentDropTarget {
  addFiles: (files: File[]) => void
}

interface DocumentTranslatorProps {
  target: TranslatorLanguage
  onTarget: (language: TranslatorLanguage) => void
  formality: TranslatorFormality
  glossaryIds: readonly string[]
}

/**
 * Document translation (DeepL), after HAWKI's: files are chosen first (a list with type, name,
 * size and a way to remove each), then translated one after another with their progress, and
 * finally listed with their downloads or errors. Earlier translations wait below in a list of
 * their own, which survives closing the tab for `TRANSLATOR_DOCUMENT_TTL_HOURS`.
 */
export const DocumentTranslator = forwardRef<DocumentDropTarget, DocumentTranslatorProps>(
  function DocumentTranslator({ target, onTarget, formality, glossaryIds }, ref) {
    const { t } = useTranslation()
    const inputRef = useRef<HTMLInputElement>(null)
    const [items, setItems] = useState<Item[]>([])
    /**
     * The list a selection showed when "Weitere Dokumente hochladen" emptied it. HAWKI leaves that
     * list on screen below the drop zone, though nothing is selected any more: translating it does
     * nothing, removing a file or declining closes it, new files replace it.
     */
    const [stale, setStale] = useState<Item[] | null>(null)
    const [view, setView] = useState<View>(START_VIEW)
    const [processing, setProcessing] = useState(false)
    const [completed, setCompleted] = useState(0)
    const upload = useUploadTranslatorDocument()
    const jobs = useTranslatorDocuments(true)
    const unmounted = useRef(false)
    useEffect(() => {
      unmounted.current = false
      return () => {
        unmounted.current = true
      }
    }, [])

    /**
     * Takes the files the translator can do (others are left out), each once. As in HAWKI, only
     * "Ablehnen" and "Weitere Dokumente hochladen" empty the selection: files dropped after a
     * finished batch join the files of that batch, and its results stay shown below.
     */
    const addFiles = (files: File[]): void => {
      if (processing) return
      const next = items.map((item) =>
        item.state === 'selected'
          ? item
          : {
              ...item,
              state: 'selected' as const,
              progress: 0,
              secondsRemaining: null,
              job: null,
              error: null
            }
      )
      for (const file of files) {
        if (!translatorDocumentExtension(file.name)) continue
        if (next.some((item) => item.file.name === file.name && item.file.size === file.size))
          continue
        next.push({
          key: crypto.randomUUID(),
          file,
          state: 'selected',
          progress: 0,
          secondsRemaining: null,
          job: null,
          error: null
        })
      }
      if (next.length === 0) return
      setStale(null)
      setItems(next)
      setView((current) => ({ ...current, upload: false, selection: true, languageActive: true }))
    }
    useImperativeHandle(ref, () => ({ addFiles }))

    const update = (key: string, patch: Partial<Item>): void =>
      setItems((current) =>
        current.map((item) => (item.key === key ? { ...item, ...patch } : item))
      )

    /** "Ablehnen": the selection goes, the results of the batch before stay. */
    const decline = (): void => {
      setItems([])
      setStale(null)
      setView((current) => ({ ...current, upload: true, selection: false, languageActive: false }))
    }

    /** "Weitere Dokumente hochladen": back to the drop zone; a selection shown stays, stale. */
    const uploadMore = (): void => {
      if (view.selection && !processing) setStale(items)
      setItems([])
      setCompleted(0)
      setView((current) => ({ ...START_VIEW, selection: current.selection && !processing }))
    }

    /** The files one after another: upload, then follow the job until DeepL is done. */
    const translate = async (): Promise<void> => {
      const batch = items
      if (batch.length === 0) return
      setProcessing(true)
      setCompleted(0)
      const finished = new Map<string, Item>()
      const track = (key: string, patch: Partial<Item>): void => {
        const item = finished.get(key)
        if (item) finished.set(key, { ...item, ...patch })
        update(key, patch)
      }
      for (const item of batch) finished.set(item.key, { ...item, state: 'waiting', progress: 0 })
      setItems([...finished.values()])
      let done = 0
      for (const item of batch) {
        if (unmounted.current) return
        try {
          track(item.key, { state: 'uploading', progress: 10 })
          const job = await upload.mutateAsync({
            file: item.file,
            source: null,
            target,
            formality,
            glossaryIds
          })
          const result = await follow(job, (patch) => track(item.key, patch))
          track(item.key, { state: 'done', progress: 100, job: result })
          done++
        } catch (error) {
          track(item.key, { state: 'error', progress: 100, error: errorText(error) })
        }
        setCompleted(done)
      }
      void jobs.refetch()
      if (unmounted.current) return
      setProcessing(false)
      setView((current) => ({ ...current, selection: false, results: [...finished.values()] }))
    }

    /** Looks at the job until it is done; its error ends the wait. */
    const follow = async (
      job: TranslatorDocument,
      onProgress: (patch: Partial<Item>) => void
    ): Promise<TranslatorDocument> => {
      const start = Date.now()
      let wait = POLL_START_MS
      for (let current = job; ;) {
        if (Date.now() - start > POLL_TIMEOUT_MS) throw new Error('timeout')
        await new Promise((resolve) => setTimeout(resolve, wait))
        current = translatorDocumentSchema.parse(
          await apiFetch<unknown>(API.translatorDocument(current.id))
        )
        if (current.status === 'queued') onProgress({ state: 'queued', progress: 15 })
        else if (current.status === 'translating') {
          const seconds = current.secondsRemaining
          onProgress({
            state: 'translating',
            secondsRemaining: seconds,
            progress: seconds ? Math.min(85, Math.max(30, 90 - seconds * 2)) : 50
          })
        } else if (current.status === 'done') return current
        else throw new JobError(current)
        wait = Math.min(wait + POLL_STEP_MS, POLL_MAX_MS)
      }
    }

    /**
     * What a failed file's line says, as in HAWKI: DeepL's own words for a translation that
     * failed there, HAWKI's general message for a file DeepL did not take at all.
     */
    const errorText = (error: unknown): string => {
      if (error instanceof JobError) {
        return (
          error.job.errorMessage ??
          t(
            error.job.error === 'same_language'
              ? 'component.translator.documents.sameLanguage'
              : 'component.translator.documents.deeplError'
          )
        )
      }
      if (error instanceof Error && error.message === 'timeout') {
        return t('component.translator.documents.timeout')
      }
      if (error instanceof ApiRequestError) {
        // HAWKI's throttle answers with Laravel's message, which the line shows as it is.
        if (error.code === 'rate_limited' && error.message === TRANSLATOR_THROTTLED_MESSAGE) {
          return error.message
        }
        if (error.code === 'rate_limited') {
          return t('component.translator.documents.rateLimited', {
            active: TRANSLATOR_DOCUMENT_ACTIVE_MAX
          })
        }
        if (
          error.body?.error.issues?.some((issue) => issue.message === TRANSLATOR_DOCUMENT_TOO_LARGE)
        ) {
          return t('component.translator.documents.tooLarge')
        }
      }
      return t('component.translator.documents.failed')
    }

    const active = view.languageActive
    const listed = stale ?? items

    return (
      <div className="flex flex-col gap-stack-lg">
        <Card className="@container overflow-hidden">
          <div
            className={cn(
              'flex min-h-14 items-center justify-center gap-4 border-b border-outline-variant px-4 py-2',
              !active && 'text-on-surface-variant'
            )}
          >
            <span className="px-4 text-sm font-medium">{t('component.translator.detect')}</span>
            <ArrowRightIcon {...ICON} />
            <LanguageMenu
              label={t('component.translator.target')}
              value={target}
              onChange={onTarget}
              disabled={!active}
            />
          </div>
          {view.upload ? (
            <div className="p-4 @xl:p-6">
              <FileDropzone
                icon={<FileTextIcon />}
                title={t('component.translator.documents.drop')}
                hint={
                  <span className="flex flex-col items-center gap-4 pt-2">
                    <Button type="button" onClick={() => inputRef.current?.click()}>
                      {t('component.translator.documents.browse')}
                    </Button>
                    <span className="flex flex-col gap-1">
                      <span>{t('component.translator.documents.types')}</span>
                      <span>{t('component.translator.documents.images')}</span>
                    </span>
                  </span>
                }
                onFiles={addFiles}
                className="min-h-96"
              />
            </div>
          ) : null}
          {view.selection ? (
            <div className="flex flex-col gap-6 p-6 @xl:p-10">
              <ul className="m-0 flex list-none flex-col gap-3 p-0">
                {listed.map((item) => (
                  <FileRow
                    key={item.key}
                    item={item}
                    onRemove={() => {
                      const rest = items.filter((other) => other.key !== item.key)
                      setItems(rest)
                      if (rest.length === 0) decline()
                    }}
                  />
                ))}
              </ul>
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-outline-variant pt-5">
                <p aria-live="polite" className="m-0 text-sm text-on-surface-variant">
                  {processing
                    ? t('component.translator.documents.progress', {
                        done: completed,
                        count: items.length
                      })
                    : t('component.translator.documents.selected', { count: listed.length })}
                </p>
                <div className="flex gap-3">
                  <Button type="button" variant="outline" disabled={processing} onClick={decline}>
                    {t('component.translator.documents.decline')}
                  </Button>
                  <Button type="button" disabled={processing} onClick={() => void translate()}>
                    {processing ? <Spinner size="sm" /> : null}
                    {t('component.translator.documents.translate')}
                  </Button>
                </div>
              </div>
            </div>
          ) : null}
          {view.results ? (
            <div
              className={cn(
                'flex flex-col gap-6 p-6 @xl:p-10',
                (view.upload || view.selection) && 'pt-0 @xl:pt-0'
              )}
            >
              <ul className="m-0 flex list-none flex-col gap-3 p-0">
                {view.results.map((item) => (
                  <ResultRow key={item.key} item={item} />
                ))}
              </ul>
              <div className="flex justify-end border-t border-outline-variant pt-5">
                <Button type="button" onClick={uploadMore}>
                  {t('component.translator.documents.uploadMore')}
                </Button>
              </div>
            </div>
          ) : null}
          {/* The file picker behind the button, never shown itself. */}
          <Input
            ref={inputRef}
            type="file"
            multiple
            accept={ACCEPT}
            hidden
            tabIndex={-1}
            aria-hidden="true"
            onChange={(event) => {
              const files = Array.from(event.target.files ?? [])
              event.target.value = ''
              if (files.length > 0) addFiles(files)
            }}
          />
        </Card>
        <History jobs={jobs.data} loading={jobs.isPending} failed={jobs.isError} />
      </div>
    )
  }
)

/** A job that ended with an error at DeepL. */
class JobError extends Error {
  constructor(readonly job: TranslatorDocument) {
    super(job.errorMessage ?? job.error ?? 'failed')
  }
}

/** The file's type as a short tag, e.g. `DOCX`. */
function TypeTag({ name, error }: { name: string; error?: boolean }): React.JSX.Element {
  const extension = name.includes('.') ? name.split('.').pop()!.toUpperCase() : '?'
  return (
    <span
      aria-hidden="true"
      className={cn(
        'flex h-8 min-w-10 shrink-0 items-center justify-center rounded-md border px-1 text-xs font-bold',
        error ? 'border-error text-error' : 'border-outline-variant text-on-surface-variant'
      )}
    >
      {extension}
    </span>
  )
}

function FileRow({ item, onRemove }: { item: Item; onRemove: () => void }): React.JSX.Element {
  const { t } = useTranslation()
  const status =
    item.state === 'waiting'
      ? t('component.translator.documents.waiting')
      : item.state === 'uploading'
        ? t('component.translator.documents.uploading')
        : item.state === 'queued'
          ? t('component.translator.documents.translating')
          : item.state === 'translating'
            ? item.secondsRemaining
              ? t('component.translator.documents.translatingFor', {
                  seconds: item.secondsRemaining
                })
              : t('component.translator.documents.translating')
            : item.state === 'done'
              ? t('component.translator.documents.done')
              : item.state === 'error'
                ? t('component.translator.documents.error')
                : null
  return (
    <li className="flex items-center gap-4 rounded-xl border border-outline-variant px-5 py-4">
      <TypeTag name={item.file.name} />
      <div className="grid min-w-0 flex-1 gap-0.5">
        <p className="m-0 truncate text-base font-semibold text-on-surface" title={item.file.name}>
          {item.file.name}
        </p>
        <p className="m-0 text-xs text-on-surface-variant">{formatSize(item.file.size)}</p>
      </div>
      {item.state === 'selected' ? (
        <IconAction
          label={t('component.translator.documents.remove', { name: item.file.name })}
          onClick={onRemove}
        >
          <XIcon {...ICON} />
        </IconAction>
      ) : (
        <div className="flex shrink-0 items-center gap-3">
          <span
            className={cn(
              'text-sm',
              item.state === 'error'
                ? 'text-error'
                : item.state === 'done'
                  ? 'text-success'
                  : 'text-primary'
            )}
          >
            {status}
          </span>
          <span
            role="progressbar"
            aria-label={item.file.name}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={item.progress}
            className="h-1 w-24 overflow-hidden rounded-full bg-surface-container-high"
          >
            <span
              style={{ width: `${item.progress}%` }}
              className={cn(
                'block h-full rounded-full transition-[width] duration-500',
                item.state === 'error'
                  ? 'bg-error'
                  : item.state === 'done'
                    ? 'bg-success'
                    : 'bg-primary'
              )}
            />
          </span>
        </div>
      )}
    </li>
  )
}

/** A finished file: its translation to download, or why there is none. */
function ResultRow({ item }: { item: Item }): React.JSX.Element {
  const { t } = useTranslation()
  if (item.state === 'done' && item.job) {
    return (
      <li className="flex items-center gap-4 rounded-xl border border-outline-variant px-5 py-4">
        <TypeTag name={item.file.name} />
        <p className="m-0 min-w-0 flex-1 truncate text-base font-semibold text-on-surface">
          {item.job.resultFilename}
        </p>
        <Button asChild variant="outline" size="sm">
          <a
            href={`${apiBase()}${API.translatorDocumentDownload(item.job.id)}`}
            download={item.job.resultFilename}
          >
            <DownloadIcon {...ICON} />
            {t('component.translator.documents.download')}
            <span className="sr-only">{` ${item.job.resultFilename}`}</span>
          </a>
        </Button>
      </li>
    )
  }
  return (
    <li className="flex items-center gap-4 rounded-xl border border-error px-5 py-4">
      <TypeTag name={item.file.name} error />
      <div className="grid min-w-0 flex-1 gap-0.5">
        <p className="m-0 truncate text-base font-semibold text-on-surface">{item.file.name}</p>
        <p className="m-0 text-sm text-error">{item.error}</p>
      </div>
    </li>
  )
}

/** "Übersetzte Dokumente": the finished translations, newest first, to download or delete. */
function History({
  jobs,
  loading,
  failed
}: {
  jobs: TranslatorDocument[] | undefined
  loading: boolean
  failed: boolean
}): React.JSX.Element | null {
  const { t } = useTranslation()
  const [open, setOpen] = useState(true)
  const remove = useDeleteTranslatorDocument()
  const done = (jobs ?? []).filter((job) => job.status === 'done')
  if (loading) return null
  if (failed) {
    return (
      <p role="alert" className="m-0 text-sm text-error">
        {t('component.translator.documents.loadFailed')}
      </p>
    )
  }
  if (done.length === 0) return null
  const listId = 'translator-document-history'
  return (
    <Card className="overflow-hidden">
      <Button
        type="button"
        variant="ghost"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((value) => !value)}
        // eslint-disable-next-line design-system/layout-only-classname -- the whole head of the list opens and closes it, as in HAWKI
        className="flex h-auto w-full justify-between rounded-none px-5 py-4"
      >
        <span className="flex items-center gap-2 text-base font-semibold text-on-surface">
          {t('component.translator.documents.history')}
          <Badge>{done.length}</Badge>
        </span>
        <ChevronDownIcon
          {...ICON}
          className={cn('size-4 transition-transform', !open && '-rotate-90')}
        />
      </Button>
      {open ? (
        <ul id={listId} className="m-0 list-none border-t border-outline-variant p-0">
          {done.map((job) => (
            <li
              key={job.id}
              className="flex items-center gap-3 border-outline-variant px-5 py-3 not-first:border-t"
            >
              <TypeTag name={job.resultFilename} />
              <div className="grid min-w-0 flex-1 gap-0.5">
                <p className="m-0 truncate text-sm text-on-surface" title={job.resultFilename}>
                  {job.resultFilename}
                </p>
                <p className="m-0 text-xs text-on-surface-variant">
                  {job.resultSize !== null ? formatSize(job.resultSize) : ''}
                </p>
              </div>
              <Button asChild variant="ghost" size="icon">
                <a
                  href={`${apiBase()}${API.translatorDocumentDownload(job.id)}`}
                  download={job.resultFilename}
                  aria-label={t('component.translator.documents.downloadFile', {
                    name: job.resultFilename
                  })}
                  title={t('component.translator.documents.downloadShort')}
                >
                  <DownloadIcon {...ICON} />
                </a>
              </Button>
              <IconAction
                label={t('component.translator.documents.delete', { name: job.resultFilename })}
                disabled={remove.isPending && remove.variables === job.id}
                onClick={() =>
                  remove.mutate(job.id, {
                    onError: () =>
                      toast({
                        variant: 'error',
                        title: t('component.translator.documents.deleteFailed', {
                          name: job.resultFilename
                        })
                      })
                  })
                }
              >
                <Trash2Icon {...ICON} />
              </IconAction>
            </li>
          ))}
        </ul>
      ) : null}
    </Card>
  )
}
