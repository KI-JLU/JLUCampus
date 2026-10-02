import { useEffect, useId, useRef, useState } from 'react'
import {
  BookOpenIcon,
  ClockIcon,
  EyeIcon,
  GlobeIcon,
  HouseIcon,
  LayersIcon,
  LockIcon,
  PencilIcon,
  PlusIcon,
  RotateCwIcon,
  SquarePenIcon,
  Trash2Icon,
  UploadIcon,
  UserIcon
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import {
  Badge,
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  FileDropzone,
  Grid,
  Input,
  PanelSection,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SettingsRow,
  Spinner,
  Textarea
} from '@ki4jlu/design-system'
import {
  TRANSLATOR_GLOSSARY_DEFAULT_CATEGORY,
  TRANSLATOR_GLOSSARY_IMPORT_TOO_LARGE,
  TRANSLATOR_GLOSSARY_LANGUAGES,
  TRANSLATOR_GLOSSARY_ROLE_NAMES,
  TRANSLATOR_GLOSSARY_VISIBILITIES,
  translatorGlossaryLanguageSchema,
  translatorGlossaryRoleSchema,
  translatorGlossaryVisibilitySchema,
  type TranslatorGlossary,
  type TranslatorGlossaryDetail,
  type TranslatorGlossaryLanguage,
  type TranslatorGlossaryList,
  type TranslatorGlossaryPatch,
  type TranslatorGlossaryRole,
  type TranslatorGlossaryVisibility
} from '@justcampus/shared'
import { Field } from '@/components/field'
import { ApiRequestError } from '@/lib/api'
import {
  fetchGlossary,
  useDeleteGlossary,
  useImportGlossary,
  usePatchGlossary,
  useSaveGlossary
} from '@/lib/queries'
import { toast } from '@/lib/toast'
import { IconAction } from './copy-button'
import { formatGlossaryDate } from './format'

const ICON = { 'aria-hidden': true, className: 'size-4' } as const

/** How long "Created" or "Updated" shows on the button before the list comes back. */
const SAVED_MS = 1000

type View =
  | { name: 'list' }
  | { name: 'form'; glossary: TranslatorGlossaryDetail | null }
  | { name: 'import' }
  | { name: 'details'; glossary: TranslatorGlossary }

interface GlossaryDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  list: TranslatorGlossaryList | undefined
}

/**
 * "Glossare verwalten", after HAWKI's: the glossaries with new, import, edit and delete, and a
 * view of each glossary's details. Public glossaries are marked; only their owner edits them.
 */
export function GlossaryDialog({
  open,
  onOpenChange,
  list
}: GlossaryDialogProps): React.JSX.Element {
  const { t } = useTranslation()
  const [view, setView] = useState<View>({ name: 'list' })
  const [deleting, setDeleting] = useState<TranslatorGlossary | null>(null)
  const [loadingEdit, setLoadingEdit] = useState<string | null>(null)
  const toList = (): void => setView({ name: 'list' })

  const title =
    view.name === 'form'
      ? t(
          view.glossary
            ? 'component.translator.glossaries.edit'
            : 'component.translator.glossaries.new'
        )
      : view.name === 'import'
        ? t('component.translator.glossaries.import')
        : view.name === 'details'
          ? t('component.translator.glossaries.details')
          : t('component.translator.glossaries.dialogTitle')

  const edit = async (glossary: TranslatorGlossary): Promise<void> => {
    setLoadingEdit(glossary.id)
    try {
      setView({ name: 'form', glossary: await fetchGlossary(glossary.id) })
    } catch {
      toast({ variant: 'error', title: t('component.translator.glossaries.loadFailed') })
    } finally {
      setLoadingEdit(null)
    }
  }

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          onOpenChange(next)
          if (!next) toList()
        }}
      >
        <DialogContent
          closeLabel={t('common.close')}
          // DS gap: DialogContent has no height cap of its own; a long form scrolls in it.
          className="max-h-9/10 overflow-y-auto sm:max-w-2xl"
          // Only the list explains itself, once, below its actions as in HAWKI.
          {...(view.name === 'list' ? {} : { 'aria-describedby': undefined })}
        >
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>
          {view.name === 'list' ? (
            <PanelSection
              title={t('component.translator.glossaries.choose')}
              className="gap-stack-md"
            >
              <div className="flex flex-wrap gap-stack-sm">
                <Button type="button" onClick={() => setView({ name: 'form', glossary: null })}>
                  <PlusIcon {...ICON} />
                  {t('component.translator.glossaries.new')}
                </Button>
                <Button type="button" variant="outline" onClick={() => setView({ name: 'import' })}>
                  <UploadIcon {...ICON} />
                  {t('component.translator.glossaries.import')}
                </Button>
              </div>
              <DialogDescription>{t('component.translator.glossaries.explain')}</DialogDescription>
              {!list ? (
                <Spinner label={t('component.translator.glossaries.loading')} />
              ) : list.glossaries.length === 0 ? (
                // DS gap: no empty-state or muted body text; the line is plain text.
                <p className="m-0">{t('component.translator.glossaries.empty')}</p>
              ) : (
                <div role="list">
                  {list.glossaries.map((glossary) => (
                    <SettingsRow
                      key={glossary.id}
                      role="listitem"
                      label={
                        <span className="flex min-w-0 items-center gap-stack-sm">
                          <BookOpenIcon {...ICON} />
                          <span className="truncate">{glossary.name}</span>
                        </span>
                      }
                      description={t('component.translator.glossaries.terms', {
                        count: glossary.entryCount
                      })}
                      control={
                        <span className="flex items-center">
                          <IconAction
                            label={t(
                              `component.translator.glossaries.visibility.${glossary.visibility}`
                            )}
                            onClick={() => setView({ name: 'details', glossary })}
                          >
                            {glossary.visibility === 'public' ? (
                              <GlobeIcon {...ICON} />
                            ) : glossary.visibility === 'organization' ? (
                              <HouseIcon {...ICON} />
                            ) : (
                              <LockIcon {...ICON} />
                            )}
                          </IconAction>
                          {glossary.canEdit ? (
                            <IconAction
                              label={t('component.translator.glossaries.editOne', {
                                name: glossary.name
                              })}
                              disabled={loadingEdit === glossary.id}
                              onClick={() => void edit(glossary)}
                            >
                              <PencilIcon {...ICON} />
                            </IconAction>
                          ) : null}
                          {glossary.canDelete ? (
                            <IconAction
                              label={t('component.translator.glossaries.deleteOne', {
                                name: glossary.name
                              })}
                              onClick={() => setDeleting(glossary)}
                            >
                              <Trash2Icon {...ICON} />
                            </IconAction>
                          ) : null}
                        </span>
                      }
                    />
                  ))}
                </div>
              )}
            </PanelSection>
          ) : view.name === 'form' ? (
            <GlossaryForm glossary={view.glossary} onDone={toList} />
          ) : view.name === 'import' ? (
            <ImportForm onDone={toList} />
          ) : (
            <Details
              glossary={
                list?.glossaries.find((item) => item.id === view.glossary.id) ?? view.glossary
              }
              roles={list?.roles ?? []}
              onBack={toList}
            />
          )}
        </DialogContent>
      </Dialog>
      <DeleteGlossaryDialog glossary={deleting} onClose={() => setDeleting(null)} />
    </>
  )
}

interface TermRow {
  key: string
  sourceLanguage: TranslatorGlossaryLanguage
  sourceTerm: string
  targetLanguage: TranslatorGlossaryLanguage
  targetTerm: string
}

/**
 * The languages of a term pair in the form, in HAWKI's order: German or English (importing
 * offers more). A term in another language shows the first one, as HAWKI's form does.
 */
const TERM_LANGUAGES = {
  source: ['de', 'en'],
  target: ['en', 'de']
} as const satisfies Record<string, readonly TranslatorGlossaryLanguage[]>

function termLanguage(
  language: TranslatorGlossaryLanguage,
  side: keyof typeof TERM_LANGUAGES
): TranslatorGlossaryLanguage {
  const offered: readonly TranslatorGlossaryLanguage[] = TERM_LANGUAGES[side]
  return offered.includes(language) ? language : offered[0]!
}

const newRow = (): TermRow => ({
  key: crypto.randomUUID(),
  sourceLanguage: 'de',
  sourceTerm: '',
  targetLanguage: 'en',
  targetTerm: ''
})

/** A new glossary, or one being edited: name, description and its term pairs. */
function GlossaryForm({
  glossary,
  onDone
}: {
  glossary: TranslatorGlossaryDetail | null
  onDone: () => void
}): React.JSX.Element {
  const { t } = useTranslation()
  const id = useId()
  const save = useSaveGlossary()
  const [name, setName] = useState(glossary?.name ?? '')
  const [description, setDescription] = useState(glossary?.description ?? '')
  const [rows, setRows] = useState<TermRow[]>(() =>
    glossary && glossary.entries.length > 0
      ? glossary.entries.map((entry) => ({
          key: crypto.randomUUID(),
          ...entry,
          sourceLanguage: termLanguage(entry.sourceLanguage, 'source'),
          targetLanguage: termLanguage(entry.targetLanguage, 'target')
        }))
      : [newRow()]
  )
  const [alert, setAlert] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
    },
    []
  )

  const patchRow = (key: string, patch: Partial<TermRow>): void =>
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)))

  const submit = (): void => {
    if (save.isPending || saved) return
    const entries = rows
      .filter((row) => row.sourceTerm.trim() && row.targetTerm.trim())
      .map((row) => ({
        sourceLanguage: row.sourceLanguage,
        sourceTerm: row.sourceTerm.trim(),
        targetLanguage: row.targetLanguage,
        targetTerm: row.targetTerm.trim()
      }))
    if (!name.trim()) return setAlert(t('component.translator.glossaries.nameRequired'))
    if (entries.length === 0) return setAlert(t('component.translator.glossaries.termRequired'))
    save.mutate(
      {
        id: glossary?.id,
        input: {
          name: name.trim(),
          description: description.trim(),
          visibility: glossary?.visibility ?? 'private',
          entries
        }
      },
      {
        onSuccess: () => {
          setSaved(true)
          timer.current = setTimeout(onDone, SAVED_MS)
        },
        onError: (error) =>
          setAlert(
            t('component.translator.glossaries.saveFailed', { message: refusal(error) ?? '' })
          )
      }
    )
  }

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault()
        submit()
      }}
      className="grid gap-stack-md"
    >
      <Field id={`${id}-name`} label={t('component.translator.glossaries.nameLabel')}>
        {(props) => (
          <Input
            {...props}
            value={name}
            placeholder={t('component.translator.glossaries.namePlaceholder')}
            onChange={(event) => setName(event.target.value)}
          />
        )}
      </Field>
      <Field id={`${id}-description`} label={t('component.translator.glossaries.descriptionLabel')}>
        {(props) => (
          <Textarea
            {...props}
            value={description}
            placeholder={t('component.translator.glossaries.descriptionPlaceholder')}
            onChange={(event) => setDescription(event.target.value)}
            className="min-h-20"
          />
        )}
      </Field>
      {/* A group named by its title and described by its hint, as a fieldset would be. */}
      <PanelSection
        role="group"
        title={t('component.translator.glossaries.termsLabel')}
        hint={<span id={`${id}-terms-hint`}>{t('component.translator.glossaries.caseHint')}</span>}
        aria-describedby={`${id}-terms-hint`}
      >
        {rows.map((row, index) => (
          <div key={row.key} className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
            <TermLanguage
              label={t('component.translator.glossaries.sourceLanguageOf', { number: index + 1 })}
              options={TERM_LANGUAGES.source}
              value={row.sourceLanguage}
              onChange={(sourceLanguage) => patchRow(row.key, { sourceLanguage })}
            />
            <Input
              aria-label={t('component.translator.glossaries.sourceTermOf', { number: index + 1 })}
              value={row.sourceTerm}
              placeholder={t('component.translator.glossaries.sourceTerm')}
              onChange={(event) => patchRow(row.key, { sourceTerm: event.target.value })}
              className="min-w-0 flex-1"
            />
            <span aria-hidden="true">→</span>
            <TermLanguage
              label={t('component.translator.glossaries.targetLanguageOf', { number: index + 1 })}
              options={TERM_LANGUAGES.target}
              value={row.targetLanguage}
              onChange={(targetLanguage) => patchRow(row.key, { targetLanguage })}
            />
            <Input
              aria-label={t('component.translator.glossaries.targetTermOf', { number: index + 1 })}
              value={row.targetTerm}
              placeholder={t('component.translator.glossaries.targetTerm')}
              onChange={(event) => patchRow(row.key, { targetTerm: event.target.value })}
              className="min-w-0 flex-1"
            />
            <IconAction
              label={t('component.translator.glossaries.removePair')}
              onClick={() =>
                // The last pair is emptied, not removed: there is always one to fill in.
                rows.length > 1
                  ? setRows((current) => current.filter((other) => other.key !== row.key))
                  : patchRow(row.key, { sourceTerm: '', targetTerm: '' })
              }
            >
              <Trash2Icon {...ICON} />
            </IconAction>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setRows((current) => [...current, newRow()])}
          className="self-start"
        >
          {t('component.translator.glossaries.addPair')}
        </Button>
      </PanelSection>
      <DialogFooter>
        <Button type="button" variant="secondary" onClick={onDone}>
          {t('component.translator.back')}
        </Button>
        <Button type="submit" disabled={save.isPending}>
          {save.isPending ? <Spinner size="sm" /> : null}
          {saved
            ? t(
                glossary
                  ? 'component.translator.glossaries.updated'
                  : 'component.translator.glossaries.created'
              )
            : t(
                glossary
                  ? 'component.translator.glossaries.update'
                  : 'component.translator.glossaries.create'
              )}
        </Button>
      </DialogFooter>
      <p aria-live="polite" className="sr-only">
        {saved
          ? t(
              glossary
                ? 'component.translator.glossaries.updated'
                : 'component.translator.glossaries.created'
            )
          : ''}
      </p>
      <AlertMessage message={alert} onClose={() => setAlert(null)} />
    </form>
  )
}

/** The language of a term, as its code (DE, EN). */
function TermLanguage({
  label,
  options,
  value,
  onChange
}: {
  label: string
  options: readonly TranslatorGlossaryLanguage[]
  value: TranslatorGlossaryLanguage
  onChange: (language: TranslatorGlossaryLanguage) => void
}): React.JSX.Element {
  return (
    <Select
      value={value}
      onValueChange={(next) => {
        const parsed = translatorGlossaryLanguageSchema.safeParse(next)
        if (parsed.success) onChange(parsed.data)
      }}
    >
      <SelectTrigger aria-label={label} className="w-20 shrink-0">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((language) => (
          <SelectItem key={language} value={language}>
            {language.toUpperCase()}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

/** "Glossar aus CSV importieren": name, description, languages and the file. */
function ImportForm({ onDone }: { onDone: () => void }): React.JSX.Element {
  const { t } = useTranslation()
  const id = useId()
  const importGlossary = useImportGlossary()
  const inputRef = useRef<HTMLInputElement>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [sourceLanguage, setSourceLanguage] = useState<TranslatorGlossaryLanguage>('de')
  const [targetLanguage, setTargetLanguage] = useState<TranslatorGlossaryLanguage>('en')
  const [file, setFile] = useState<File | null>(null)
  const [alert, setAlert] = useState<string | null>(null)

  const pick = (picked: File | undefined): void => {
    if (!picked) return
    setFile(picked)
    // The file's name is a good first name for the glossary.
    if (!name.trim()) setName(picked.name.replace(/\.[^/.]+$/, ''))
  }

  const submit = (): void => {
    if (!name.trim()) return setAlert(t('component.translator.glossaries.nameRequired'))
    if (!file) return setAlert(t('component.translator.glossaries.fileRequired'))
    importGlossary.mutate(
      { file, name: name.trim(), description: description.trim(), sourceLanguage, targetLanguage },
      {
        onSuccess: onDone,
        onError: (error) => {
          const issues = error instanceof ApiRequestError ? error.body?.error.issues : undefined
          const issue = issues?.find((item) => item.path[0] === 'file')
          const tooLong = issues?.some((item) => item.path[0] === 'name') ? refusal(error) : null
          // A file too large and a name too long are told in HAWKI's words; any other file
          // without pairs as such.
          setAlert(
            tooLong
              ? t('component.translator.glossaries.saveFailed', { message: tooLong })
              : !issue
                ? t('component.translator.glossaries.importFailed')
                : issue.message === TRANSLATOR_GLOSSARY_IMPORT_TOO_LARGE
                  ? t('component.translator.glossaries.saveFailed', { message: issue.message })
                  : t('component.translator.glossaries.csvInvalid')
          )
        }
      }
    )
  }

  const languageNames = (language: TranslatorGlossaryLanguage): string =>
    t(`component.translator.glossaries.languages.${language}`)

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault()
        submit()
      }}
      className="grid gap-stack-md"
    >
      <PanelSection title={t('component.translator.glossaries.importTitle')} />
      <Field id={`${id}-name`} label={t('component.translator.glossaries.importName')}>
        {(props) => (
          <Input
            {...props}
            value={name}
            placeholder={t('component.translator.glossaries.namePlaceholder')}
            onChange={(event) => setName(event.target.value)}
          />
        )}
      </Field>
      <Field id={`${id}-description`} label={t('component.translator.glossaries.descriptionLabel')}>
        {(props) => (
          <Textarea
            {...props}
            value={description}
            placeholder={t('component.translator.glossaries.descriptionPlaceholder')}
            onChange={(event) => setDescription(event.target.value)}
            className="min-h-20"
          />
        )}
      </Field>
      <Grid cols={2} gap="md">
        {(
          [
            ['source', sourceLanguage, setSourceLanguage],
            ['target', targetLanguage, setTargetLanguage]
          ] as const
        ).map(([side, value, set]) => (
          <Field
            key={side}
            id={`${id}-${side}`}
            label={t(
              side === 'source'
                ? 'component.translator.glossaries.sourceLanguage'
                : 'component.translator.glossaries.targetLanguage'
            )}
          >
            {(control) => (
              <Select
                value={value}
                onValueChange={(next) => {
                  const parsed = translatorGlossaryLanguageSchema.safeParse(next)
                  if (parsed.success) set(parsed.data)
                }}
              >
                <SelectTrigger {...control}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TRANSLATOR_GLOSSARY_LANGUAGES.map((language) => (
                    <SelectItem key={language} value={language}>
                      {`${languageNames(language)} (${language.toUpperCase()})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </Field>
        ))}
      </Grid>
      <FileDropzone
        icon={<UploadIcon />}
        title={t('component.translator.glossaries.csvDrop')}
        hint={file ? file.name : t('component.translator.glossaries.csvFormat')}
        onBrowse={() => inputRef.current?.click()}
        onFiles={(files) => pick(files.find((item) => /\.(csv|txt)$/i.test(item.name)))}
        className="min-h-36"
      />
      {/* The file picker behind the dropzone, never shown itself. */}
      <Input
        ref={inputRef}
        type="file"
        accept=".csv,.txt"
        hidden
        tabIndex={-1}
        aria-hidden="true"
        onChange={(event) => {
          pick(event.target.files?.[0])
          event.target.value = ''
        }}
      />
      <DialogFooter>
        <Button type="button" variant="secondary" onClick={onDone}>
          {t('component.translator.back')}
        </Button>
        <Button type="submit" disabled={importGlossary.isPending}>
          {importGlossary.isPending ? <Spinner size="sm" /> : null}
          {t('component.translator.glossaries.importSubmit')}
        </Button>
      </DialogFooter>
      <AlertMessage message={alert} onClose={() => setAlert(null)} />
    </form>
  )
}

/**
 * What the server says to a refused glossary, as HAWKI's page shows it: HAWKI's own words for a
 * name or a category too long, else the message. `null` without an answer from the server.
 */
function refusal(error: unknown): string | null {
  if (!(error instanceof ApiRequestError)) return null
  const issue = error.body?.error.issues?.find(
    (item) => item.path[0] === 'name' || item.path[0] === 'category'
  )
  return issue?.message ?? error.message
}

/**
 * What stops a glossary form, told as HAWKI tells it in a browser alert: a message over the form
 * that is confirmed with OK. The form keeps its input.
 */
function AlertMessage({
  message,
  onClose
}: {
  message: string | null
  onClose: () => void
}): React.JSX.Element {
  const { t } = useTranslation()
  const ok = useRef<HTMLButtonElement>(null)
  const back = useRef<HTMLElement | null>(null)
  return (
    <Dialog open={message !== null} onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent
        role="alertdialog"
        aria-describedby={undefined}
        closeLabel={t('common.close')}
        className="sm:max-w-md"
        // OK has the focus, and as after an alert it goes back where it was.
        onOpenAutoFocus={(event) => {
          event.preventDefault()
          back.current =
            document.activeElement instanceof HTMLElement ? document.activeElement : null
          ok.current?.focus()
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault()
          back.current?.focus()
        }}
        // Like an alert, it waits for OK (or Escape); a click beside it does not dismiss it.
        onInteractOutside={(event) => event.preventDefault()}
      >
        <DialogHeader className="min-w-0">
          {/*
           * The message alone, as an alert has it, names the dialog; its line breaks stay. DS gap:
           * no alert dialog whose message is body text, so it takes the title's headline type.
           */}
          <DialogTitle className="pe-8 whitespace-pre-wrap wrap-anywhere">{message}</DialogTitle>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button ref={ok} type="button">
              {t('component.translator.glossaries.alertOk')}
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Radix selects take no empty value: these stand for the owner as editor and for no role. */
const OWNER = 'owner'
const NO_ROLE = 'none'

/**
 * A glossary's description and category, who made, edits and sees it, and when, as HAWKI shows
 * them. Whoever edits it changes both the first two and the rights in place, as in HAWKI.
 */
function Details({
  glossary,
  roles,
  onBack
}: {
  glossary: TranslatorGlossary
  roles: readonly TranslatorGlossaryRole[]
  onBack: () => void
}): React.JSX.Element {
  const { t } = useTranslation()
  const patch = usePatchGlossary()
  const [editing, setEditing] = useState<'description' | 'rights' | null>(null)
  const [description, setDescription] = useState(glossary.description)
  const [category, setCategory] = useState(glossary.category)
  const [visibility, setVisibility] = useState<TranslatorGlossaryVisibility>(glossary.visibility)
  const [visibleTo, setVisibleTo] = useState<TranslatorGlossaryRole | null>(glossary.visibleTo)
  const [editorRole, setEditorRole] = useState<TranslatorGlossaryRole | null>(glossary.editorRole)
  const [alert, setAlert] = useState<string | null>(null)

  const saveChange = (change: TranslatorGlossaryPatch): void =>
    patch.mutate(
      { id: glossary.id, patch: change },
      {
        onSuccess: () => setEditing(null),
        // HAWKI shows the server's message alone here, or "Update failed".
        onError: (error) =>
          setAlert(refusal(error) || t('component.translator.glossaries.updateFailed'))
      }
    )

  const visibleFor =
    glossary.visibility === 'public'
      ? t('component.translator.glossaries.visibleForAll')
      : glossary.visibility === 'private'
        ? t('component.translator.glossaries.visibleForOwner')
        : glossary.visibleTo
          ? TRANSLATOR_GLOSSARY_ROLE_NAMES[glossary.visibleTo]
          : t('component.translator.glossaries.visibility.organization')

  const editActions = (onSave: () => void): React.JSX.Element => (
    <div className="flex justify-end gap-2">
      <Button type="button" variant="secondary" size="sm" onClick={() => setEditing(null)}>
        {t('component.translator.glossaries.decline')}
      </Button>
      <Button type="button" size="sm" disabled={patch.isPending} onClick={onSave}>
        {t('common.save')}
      </Button>
    </div>
  )

  return (
    <div className="grid gap-stack-md">
      <PanelSection
        title={<span className="wrap-anywhere">{glossary.name}</span>}
        aside={
          <Badge tone="primary" appearance="filled">
            {glossary.category || TRANSLATOR_GLOSSARY_DEFAULT_CATEGORY}
          </Badge>
        }
        // Unlike the list, the details say "1 Begriff", as in HAWKI.
        hint={t('component.translator.glossaries.detailTerms', { count: glossary.entryCount })}
      />
      <DetailSection
        title={t('component.translator.glossaries.descriptionLabel')}
        editLabel={
          glossary.canEdit && editing !== 'description'
            ? t('component.translator.glossaries.editDescription')
            : undefined
        }
        onEdit={() => {
          setDescription(glossary.description)
          setCategory(glossary.category)
          setEditing('description')
        }}
      >
        {editing === 'description' ? (
          <div className="grid gap-stack-sm">
            <Textarea
              aria-label={t('component.translator.glossaries.descriptionLabel')}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className="min-h-20"
            />
            <InfoRow
              icon={<LayersIcon {...ICON} />}
              label={t('component.translator.glossaries.category')}
            >
              <Input
                aria-label={t('component.translator.glossaries.category')}
                value={category}
                placeholder={t('component.translator.glossaries.categoryPlaceholder')}
                onChange={(event) => setCategory(event.target.value)}
                className="w-auto min-w-40"
              />
            </InfoRow>
            {editActions(() =>
              saveChange({ description: description.trim(), category: category.trim() })
            )}
          </div>
        ) : (
          <p className="m-0">{glossary.description || '-'}</p>
        )}
      </DetailSection>
      <DetailSection
        title={t('component.translator.glossaries.permissions')}
        editLabel={
          glossary.canEdit && editing !== 'rights'
            ? t('component.translator.glossaries.editRightsAction')
            : undefined
        }
        onEdit={() => {
          setVisibility(glossary.visibility)
          setVisibleTo(glossary.visibleTo)
          setEditorRole(glossary.editorRole)
          setEditing('rights')
        }}
      >
        <div>
          <InfoRow
            icon={<UserIcon {...ICON} />}
            label={t('component.translator.glossaries.creator')}
          >
            {glossary.creatorName}
          </InfoRow>
          {editing !== 'rights' ? (
            <InfoRow
              icon={<SquarePenIcon {...ICON} />}
              label={t('component.translator.glossaries.editRights')}
            >
              {glossary.editorRole
                ? TRANSLATOR_GLOSSARY_ROLE_NAMES[glossary.editorRole]
                : t('component.translator.glossaries.ownerOnly')}
            </InfoRow>
          ) : visibility !== 'private' ? (
            <InfoRow
              icon={<SquarePenIcon {...ICON} />}
              label={t('component.translator.glossaries.editRights')}
            >
              <RoleSelect
                label={t('component.translator.glossaries.editRights')}
                value={editorRole ?? OWNER}
                empty={{ value: OWNER, label: t('component.translator.glossaries.ownerOnly') }}
                roles={roles}
                onChange={(next) => setEditorRole(next === OWNER ? null : next)}
              />
            </InfoRow>
          ) : null}
          <InfoRow
            icon={<GlobeIcon {...ICON} />}
            label={t('component.translator.glossaries.visibilityLabel')}
          >
            {editing === 'rights' ? (
              <Select
                value={visibility}
                onValueChange={(next) => {
                  const parsed = translatorGlossaryVisibilitySchema.safeParse(next)
                  if (!parsed.success) return
                  setVisibility(parsed.data)
                  // Private takes the edit rights back to the owner, as in HAWKI.
                  if (parsed.data === 'private') setEditorRole(null)
                }}
              >
                <SelectTrigger
                  aria-label={t('component.translator.glossaries.visibilityLabel')}
                  className="w-40"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TRANSLATOR_GLOSSARY_VISIBILITIES.map((option) => (
                    <SelectItem key={option} value={option}>
                      {t(`component.translator.glossaries.visibility.${option}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              t(`component.translator.glossaries.visibility.${glossary.visibility}`)
            )}
          </InfoRow>
          {editing !== 'rights' ? (
            <InfoRow
              icon={<EyeIcon {...ICON} />}
              label={t('component.translator.glossaries.visibleFor')}
            >
              {visibleFor}
            </InfoRow>
          ) : visibility === 'organization' ? (
            <InfoRow
              icon={<EyeIcon {...ICON} />}
              label={t('component.translator.glossaries.visibleFor')}
            >
              <RoleSelect
                label={t('component.translator.glossaries.visibleFor')}
                value={visibleTo ?? NO_ROLE}
                empty={{
                  value: NO_ROLE,
                  label: t('component.translator.glossaries.selectRole')
                }}
                roles={roles}
                onChange={(next) => setVisibleTo(next === NO_ROLE ? null : next)}
              />
            </InfoRow>
          ) : null}
        </div>
        {editing === 'rights'
          ? editActions(() => saveChange({ visibility, visibleTo, editorRole }))
          : null}
      </DetailSection>
      <DetailSection title={t('component.translator.glossaries.meta')}>
        <div>
          <InfoRow
            icon={<ClockIcon {...ICON} />}
            label={t('component.translator.glossaries.createdAt')}
          >
            {formatGlossaryDate(glossary.createdAt)}
          </InfoRow>
          <InfoRow
            icon={<RotateCwIcon {...ICON} />}
            label={t('component.translator.glossaries.updatedAt')}
          >
            {formatGlossaryDate(glossary.updatedAt)}
          </InfoRow>
        </div>
      </DetailSection>
      <DialogFooter>
        <Button type="button" variant="secondary" onClick={onBack}>
          {t('component.translator.back')}
        </Button>
      </DialogFooter>
      <AlertMessage message={alert} onClose={() => setAlert(null)} />
    </div>
  )
}

/** A role to pick, with a first option for none (the owner, or no role yet). */
function RoleSelect<Empty extends string>({
  label,
  value,
  empty,
  roles,
  onChange
}: {
  label: string
  value: TranslatorGlossaryRole | Empty
  empty: { value: Empty; label: string }
  roles: readonly TranslatorGlossaryRole[]
  onChange: (value: TranslatorGlossaryRole | Empty) => void
}): React.JSX.Element {
  return (
    <Select
      value={value}
      onValueChange={(next) => {
        if (next === empty.value) onChange(empty.value)
        else {
          const role = translatorGlossaryRoleSchema.safeParse(next)
          if (role.success && roles.includes(role.data)) onChange(role.data)
        }
      }}
    >
      <SelectTrigger aria-label={label} className="w-40">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={empty.value}>{empty.label}</SelectItem>
        {roles.map((role) => (
          <SelectItem key={role} value={role}>
            {TRANSLATOR_GLOSSARY_ROLE_NAMES[role]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

/** One titled part of the details, with its edit button beside the title. */
function DetailSection({
  title,
  editLabel,
  onEdit,
  children
}: {
  title: string
  editLabel?: string
  onEdit?: () => void
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <PanelSection
      title={title}
      aside={
        editLabel && onEdit ? (
          <IconAction label={editLabel} onClick={onEdit}>
            <SquarePenIcon {...ICON} />
          </IconAction>
        ) : undefined
      }
    >
      {children}
    </PanelSection>
  )
}

/** One fact with its icon: the label on the left, the value (or its control) on the right. */
function InfoRow({
  icon,
  label,
  children
}: {
  icon: React.ReactNode
  label: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <SettingsRow
      label={
        <span className="flex items-center gap-stack-sm">
          {icon}
          {label}
        </span>
      }
      control={children}
    />
  )
}

/** Asks before a glossary is deleted for good. */
function DeleteGlossaryDialog({
  glossary,
  onClose
}: {
  glossary: TranslatorGlossary | null
  onClose: () => void
}): React.JSX.Element {
  const { t } = useTranslation()
  const remove = useDeleteGlossary()
  return (
    <Dialog open={glossary !== null} onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent closeLabel={t('common.close')}>
        {/* A long name wraps rather than push the buttons out. */}
        <DialogHeader className="min-w-0">
          <DialogTitle className="pe-8 wrap-anywhere">
            {t('component.translator.glossaries.deleteTitle', { name: glossary?.name ?? '' })}
          </DialogTitle>
          <DialogDescription>
            {t('component.translator.glossaries.deleteConfirm')}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="secondary">{t('common.cancel')}</Button>
          </DialogClose>
          <Button
            variant="destructive"
            disabled={remove.isPending}
            onClick={() => {
              if (!glossary) return
              remove.mutate(glossary.id, {
                onSuccess: onClose,
                onError: () =>
                  toast({
                    variant: 'error',
                    title: t('component.translator.glossaries.deleteFailed')
                  })
              })
            }}
          >
            {t('common.delete')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
