import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import {
  AlertCircleIcon,
  ArrowRightIcon,
  ChevronDownIcon,
  DownloadIcon,
  FileTextIcon,
  Trash2Icon,
  XIcon
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  FileDropzone,
  Input,
  SettingsRow,
  Spinner,
  Stack,
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from '@ki4jlu/design-system'
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
      <Stack gap="lg">
        <Card>
          <CardHeader className="flex-row items-center justify-center gap-stack-md">
            {/* The source is always detected: shown as the card's muted line, not a control. */}
            <CardDescription>{t('component.translator.detect')}</CardDescription>
            <ArrowRightIcon {...ICON} />
            <LanguageMenu
              label={t('component.translator.target')}
              value={target}
              onChange={onTarget}
              disabled={!active}
            />
          </CardHeader>
          {view.upload ? (
            <CardContent>
              <FileDropzone
                icon={<FileTextIcon />}
                title={t('component.translator.documents.drop')}
                hint={
                  <span className="flex flex-col items-center gap-stack-md">
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
            </CardContent>
          ) : null}
          {view.selection ? (
            <>
              <CardContent role="list">
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
              </CardContent>
              <CardFooter className="flex-wrap justify-between gap-stack-sm">
                <CardDescription aria-live="polite">
                  {processing
                    ? t('component.translator.documents.progress', {
                        done: completed,
                        count: items.length
                      })
                    : t('component.translator.documents.selected', { count: listed.length })}
                </CardDescription>
                <div className="flex gap-stack-sm">
                  <Button type="button" variant="outline" disabled={processing} onClick={decline}>
                    {t('component.translator.documents.decline')}
                  </Button>
                  <Button type="button" disabled={processing} onClick={() => void translate()}>
                    {processing ? <Spinner size="sm" /> : null}
                    {t('component.translator.documents.translate')}
                  </Button>
                </div>
              </CardFooter>
            </>
          ) : null}
          {view.results ? (
            <>
              <CardContent role="list">
                {view.results.map((item) => (
                  <ResultRow key={item.key} item={item} />
                ))}
              </CardContent>
              <CardFooter className="justify-end">
                <Button type="button" onClick={uploadMore}>
                  {t('component.translator.documents.uploadMore')}
                </Button>
              </CardFooter>
            </>
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
      </Stack>
    )
  }
)

/** A job that ended with an error at DeepL. */
class JobError extends Error {
  constructor(readonly job: TranslatorDocument) {
    super(job.errorMessage ?? job.error ?? 'failed')
  }
}

/** The file's type as a short tag, e.g. `DOCX`, as `FilePreview` tags it. */
function TypeTag({ name, error }: { name: string; error?: boolean }): React.JSX.Element {
  const extension = name.includes('.') ? name.split('.').pop()!.toUpperCase() : '?'
  return (
    <Badge aria-hidden="true" tone={error ? 'error' : 'neutral'} className="shrink-0">
      {extension}
    </Badge>
  )
}

/** A file's line: its type tag and its name, cut short when it does not fit. */
function FileLabel({ name, error }: { name: string; error?: boolean }): React.JSX.Element {
  return (
    <span className="flex min-w-0 items-center gap-stack-sm">
      <TypeTag name={name} error={error} />
      <span className="truncate" title={name}>
        {name}
      </span>
    </span>
  )
}

/** The bar of a file on its way, colored by how it stands. */
function ProgressBar({ item }: { item: Item }): React.JSX.Element {
  // DS gap: no Progress component. The native bar (role progressbar, its value announced) takes
  // the state's token as its accent color.
  return (
    <progress
      aria-label={item.file.name}
      max={100}
      value={item.progress}
      className={cn(
        'w-24',
        item.state === 'error'
          ? 'accent-error'
          : item.state === 'done'
            ? 'accent-success'
            : 'accent-primary'
      )}
    />
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
    <SettingsRow
      role="listitem"
      label={<FileLabel name={item.file.name} />}
      description={formatSize(item.file.size)}
      control={
        item.state === 'selected' ? (
          <IconAction
            label={t('component.translator.documents.remove', { name: item.file.name })}
            onClick={onRemove}
          >
            <XIcon {...ICON} />
          </IconAction>
        ) : (
          <span className="flex items-center gap-stack-sm">
            <Badge
              appearance="text"
              tone={
                item.state === 'error' ? 'error' : item.state === 'done' ? 'success' : 'primary'
              }
            >
              {status}
            </Badge>
            <ProgressBar item={item} />
          </span>
        )
      }
    />
  )
}

/** A finished file: its translation to download, or why there is none. */
function ResultRow({ item }: { item: Item }): React.JSX.Element {
  const { t } = useTranslation()
  if (item.state === 'done' && item.job) {
    return (
      <SettingsRow
        role="listitem"
        label={<FileLabel name={item.job.resultFilename} />}
        control={
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
        }
      />
    )
  }
  return (
    <SettingsRow
      role="listitem"
      label={<FileLabel name={item.file.name} error />}
      description={
        <Badge appearance="text" tone="error">
          <AlertCircleIcon {...ICON} />
          <span>{item.error}</span>
        </Badge>
      }
    />
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
      <Badge role="alert" appearance="text" tone="error">
        <AlertCircleIcon {...ICON} />
        <span>{t('component.translator.documents.loadFailed')}</span>
      </Badge>
    )
  }
  if (done.length === 0) return null
  const listId = 'translator-document-history'
  return (
    <Card>
      {/* The whole head of the list opens and closes it, as in HAWKI. */}
      <Button
        type="button"
        variant="ghost"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((value) => !value)}
        className="w-full justify-between"
      >
        <span className="flex items-center gap-stack-sm">
          {t('component.translator.documents.history')}
          <Badge>{done.length}</Badge>
        </span>
        <ChevronDownIcon
          {...ICON}
          className={cn('size-4 transition-transform', !open && '-rotate-90')}
        />
      </Button>
      {open ? (
        <CardContent id={listId} role="list">
          {done.map((job) => (
            <SettingsRow
              key={job.id}
              role="listitem"
              label={<FileLabel name={job.resultFilename} />}
              description={job.resultSize !== null ? formatSize(job.resultSize) : undefined}
              control={
                <span className="flex items-center">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button asChild variant="ghost" size="icon">
                        <a
                          href={`${apiBase()}${API.translatorDocumentDownload(job.id)}`}
                          download={job.resultFilename}
                          aria-label={t('component.translator.documents.downloadFile', {
                            name: job.resultFilename
                          })}
                        >
                          <DownloadIcon {...ICON} />
                        </a>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      {t('component.translator.documents.downloadShort')}
                    </TooltipContent>
                  </Tooltip>
                  <IconAction
                    label={t('component.translator.documents.delete', {
                      name: job.resultFilename
                    })}
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
                </span>
              }
            />
          ))}
        </CardContent>
      ) : null}
    </Card>
  )
}
