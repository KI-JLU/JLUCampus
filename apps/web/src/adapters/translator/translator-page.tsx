import {
  useEffect,
  useEffectEvent,
  useId,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent
} from 'react'
import {
  ArrowLeftRightIcon,
  ArrowLeftToLineIcon,
  LanguagesIcon,
  PenLineIcon,
  TriangleAlertIcon
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import {
  Button,
  Card,
  Container,
  Label,
  SegmentedControl,
  Spinner,
  Textarea
} from '@ki4jlu/design-system'
import {
  TRANSLATE_TEXT_MAX,
  TRANSLATOR_DOCUMENT_MAX_BYTES,
  TRANSLATOR_DOCUMENT_TTL_HOURS,
  type RephraseStyle,
  type RephraseTone,
  type TranslatorEngine,
  type TranslatorFormality
} from '@justcampus/shared'
import { ComponentIcon } from '@/components/component-icon'
import { PageHeader } from '@/components/page-header'
import { PageSidePanel } from '@/components/page-side-panel'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { SIDE_PANEL_MEDIA } from '@/lib/page-side-panel'
import { useDebouncedValue } from '@/lib/use-debounced-value'
import { useMediaQuery } from '@/lib/use-media-query'
import { cn } from '@/lib/utils'
import { useTranslatorEngines } from '@/lib/queries'
import type { ComponentViewProps } from '../types'
import { CopyButton } from './copy-button'
import { DocumentTranslator } from './document-translator'
import { LanguageSelect } from './language-select'
import { isApplePlatform, isTranslateShortcut, languageOptions } from './languages'
import { TranslationOutput } from './translation-output'
import { TranslatorSettingsCard, TranslatorSidebar } from './translator-settings-card'
import {
  rephraseOptions,
  offeredMode,
  resolveEngine,
  TRANSLATOR_MODES,
  translatorModeSchema,
  useTranslatorSettings,
  type TranslatorSettings
} from './translator-settings'
import { useRephraser } from './use-rephraser'
import { useTranslator } from './use-translator'

const ICON = { 'aria-hidden': true, width: '1em', height: '1em' } as const

/** How long typing has to pause before live editing sends the text. */
const LIVE_DELAY_MS = 800

/** What requests send under some settings. */
interface RequestOptions {
  /** `null` until the engines are known, or when there is none. */
  engine: TranslatorEngine | null
  live: boolean
  formality: TranslatorFormality
  style: RephraseStyle | null
  tone: RephraseTone | null
}

/**
 * The translator, laid out after HAWKI's: translate a text, translate documents (DeepL, while
 * offered), or rephrase a text in its own language. The text is shared between the text modes,
 * each keeps its own result. One card holds the
 * language bar, input and result side by side once it is wide enough, and the submit button.
 * From `lg` up the modes and the settings of the chosen one fill the column on the right of the
 * shell; below it the modes sit above the card and the settings below it.
 */
export function TranslatorPage({ component }: ComponentViewProps<'translator'>): React.JSX.Element {
  const { t, i18n } = useTranslation()
  const id = useId()
  const textRef = useRef<HTMLTextAreaElement>(null)
  const [text, setTextState] = useState('')
  const [settings, updateSettings] = useTranslatorSettings()
  const engines = useTranslatorEngines()
  const wide = useMediaQuery(SIDE_PANEL_MEDIA)
  const locale = i18n.resolvedLanguage ?? i18n.language
  const languages = useMemo(() => languageOptions(locale), [locale])

  /** The engine is resolved against the offer, so a withdrawn choice falls back to the default. */
  const optionsFor = (next: TranslatorSettings): RequestOptions => {
    const engine = engines.data ? resolveEngine(next.engine, engines.data) : null
    return {
      engine,
      // Live editing would send DeepL a request per pause in typing.
      // Only once an AI model is resolved: before the engine list arrives, a request would go
      // out without an engine and the server would pick its default, maybe DeepL.
      live: next.live && engine?.kind === 'llm',
      formality: next.formality,
      ...rephraseOptions(next, engine?.kind)
    }
  }
  const options = optionsFor(settings)
  const notSetUp = engines.data?.engines.length === 0

  const translator = useTranslator({
    text,
    setText: setTextState,
    defaultTarget: component.config.defaultTargetLanguage,
    engine: options.engine?.id,
    formality: options.formality
  })
  const rephraser = useRephraser({
    text,
    engine: options.engine?.id,
    style: options.style,
    tone: options.tone
  })
  const documents = engines.data?.documents
  const mode = offeredMode(settings.mode, documents)
  const documentMode = mode === 'documents'
  const translating = mode === 'translate'
  const current = translating ? translator : rephraser
  const canSubmit = !notSetUp && (translating ? translator.canTranslate : rephraser.canRephrase)
  const shortcut = t(
    isApplePlatform() ? 'component.translator.shortcutMac' : 'component.translator.shortcut'
  )

  const run = (): void => {
    if (translating) translator.translate()
    else rephraser.rephrase()
  }

  const setText = (next: string): void => {
    setTextState(next)
    if (options.live && !next.trim()) {
      translator.clear()
      rephraser.clear()
    }
  }

  const changeSettings = (patch: Partial<TranslatorSettings>): void => {
    const merged = updateSettings(patch)
    if (offeredMode(merged.mode, documents) === 'documents') return
    const next = optionsFor(merged)
    const changesRequest = ['engine', 'formality', 'style', 'tone'].some((key) => key in patch)
    if (!changesRequest || !next.live || notSetUp) return
    // Live editing keeps a shown result in step with the settings.
    if (translating && translator.result) {
      translator.translate({ engine: next.engine?.id, formality: next.formality })
    } else if (!translating && rephraser.result) {
      rephraser.rephrase({ engine: next.engine?.id, style: next.style, tone: next.tone })
    }
  }

  // Live editing: once typing pauses (or live editing starts, or the mode changes), the current
  // mode catches up with the text unless its result already belongs to it.
  const debouncedText = useDebouncedValue(text, LIVE_DELAY_MS)
  const runLive = useEffectEvent((settled: string) => {
    const trimmed = settled.trim()
    if (settled !== text || !trimmed || notSetUp) return
    if (current.result?.submitted !== trimmed) run()
  })
  useEffect(() => {
    if (options.live && !documentMode) runLive(debouncedText)
  }, [debouncedText, options.live, mode, documentMode])

  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault()
    if (canSubmit) run()
  }
  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>): void => {
    if (!isTranslateShortcut(event)) return
    event.preventDefault()
    if (canSubmit) run()
  }

  const settingsProps = {
    id: `${id}-settings`,
    settings: { ...settings, mode },
    documents,
    engines: engines.data?.engines,
    engine: options.engine,
    style: options.style,
    tone: options.tone,
    onChange: changeSettings
  }

  const translation = translator.result
  const rephrased = rephraser.result
  const resultText = translating ? translation?.response.translation : rephrased?.response.text
  /** The result on screen: none while a request runs or after it failed. */
  const shownResult = current.pending || current.error ? undefined : resultText
  const detectedName = rephrased?.response.detectedLanguage
    ? languages.find((option) => option.code === rephrased.response.detectedLanguage)?.name
    : undefined

  return (
    <Container size="page" className="flex flex-col gap-stack-lg py-gutter md:py-margin-page">
      <PageHeader
        title={
          <>
            <ComponentIcon icon={component.icon} iconUrl={component.iconUrl} />
            <span className="truncate">{component.name}</span>
          </>
        }
        description={
          documentMode
            ? t('component.translator.pageDescriptionDocuments', {
                max: `${TRANSLATOR_DOCUMENT_MAX_BYTES / (1024 * 1024)} MB`,
                hours: TRANSLATOR_DOCUMENT_TTL_HOURS
              })
            : t('component.translator.pageDescription', {
                max: TRANSLATE_TEXT_MAX.toLocaleString(locale)
              })
        }
      />
      {/* From `lg` up the modes head the column on the right. */}
      {wide ? null : (
        <SegmentedControl
          aria-label={t('component.translator.mode')}
          options={TRANSLATOR_MODES.filter((option) => option !== 'documents' || documents).map(
            (option) => ({
              value: option,
              label: t(`component.translator.modesShort.${option}`)
            })
          )}
          value={mode}
          onValueChange={(next) => {
            const mode = translatorModeSchema.safeParse(next)
            if (mode.success) changeSettings({ mode: mode.data })
          }}
          className="self-start"
        />
      )}
      {notSetUp ? (
        <Alert variant="warning">
          <TriangleAlertIcon aria-hidden="true" />
          <AlertTitle>{t('component.translator.notSetUpTitle')}</AlertTitle>
          <AlertDescription>{t('component.translator.notSetUpDescription')}</AlertDescription>
        </Alert>
      ) : null}
      {settings.mode === 'documents' && engines.isPending ? (
        // Documents were chosen last time; whether they are still offered is not known yet.
        <Spinner label={t('component.translator.documents.loading')} className="self-center" />
      ) : documentMode ? (
        <DocumentTranslator
          id={id}
          defaultTarget={component.config.defaultTargetLanguage}
          formality={settings.formality}
        />
      ) : (
        <Card className="@container overflow-hidden">
          <form noValidate onSubmit={submit} className="flex flex-col">
            <div
              className={cn(
                'min-h-14 items-center gap-1 border-b border-outline-variant px-2 py-2 @xl:px-4',
                // The swap button in the middle column, above the line between the panes.
                translating
                  ? 'grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]'
                  : 'flex justify-center'
              )}
            >
              {translating ? (
                <>
                  <Label htmlFor={`${id}-source`} className="sr-only">
                    {t('component.translator.source')}
                  </Label>
                  <LanguageSelect
                    id={`${id}-source`}
                    inBar
                    className="@xl:justify-self-end"
                    allowDetect
                    value={translator.source}
                    detected={translation?.response.detectedSource}
                    onChange={translator.setSource}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={t('component.translator.swap')}
                    title={t('component.translator.swap')}
                    disabled={!translator.canSwap}
                    onClick={translator.swap}
                  >
                    <ArrowLeftRightIcon aria-hidden="true" className="size-4" />
                  </Button>
                  <Label htmlFor={`${id}-target`} className="sr-only">
                    {t('component.translator.target')}
                  </Label>
                  <LanguageSelect
                    id={`${id}-target`}
                    inBar
                    className="@xl:justify-self-start"
                    value={translator.target}
                    onChange={translator.setTarget}
                  />
                </>
              ) : (
                <p className="m-0 font-label-sm text-label-sm text-on-surface-variant">
                  {detectedName
                    ? t('component.translator.detectedLanguage', { language: detectedName })
                    : t('component.translator.rephraseLanguage')}
                </p>
              )}
            </div>
            <div className="grid @xl:grid-cols-2">
              <div className="flex min-w-0 flex-col">
                <Label htmlFor={`${id}-text`} className="sr-only">
                  {t(
                    translating ? 'component.translator.text' : 'component.translator.rephraseText'
                  )}
                </Label>
                <Textarea
                  ref={textRef}
                  id={`${id}-text`}
                  variant="inline"
                  value={text}
                  maxLength={TRANSLATE_TEXT_MAX}
                  placeholder={t('component.translator.placeholder')}
                  dir="auto"
                  lang={translating ? (translator.source ?? undefined) : undefined}
                  aria-describedby={`${id}-count`}
                  aria-keyshortcuts="Control+Enter Meta+Enter"
                  onChange={(event) => setText(event.target.value)}
                  onKeyDown={handleKeyDown}
                  // eslint-disable-next-line design-system/layout-only-classname -- the text to translate reads at body size, like its result beside it
                  className="min-h-48 flex-1 resize-none px-6 py-5 text-base @xl:min-h-72"
                />
                <PaneFooter>
                  <p id={`${id}-count`} className="m-0 text-sm text-on-surface-variant">
                    {t('component.translator.count', {
                      length: text.length.toLocaleString(locale),
                      max: TRANSLATE_TEXT_MAX.toLocaleString(locale)
                    })}
                  </p>
                  <CopyButton text={text} label={t('component.translator.copyText')} />
                </PaneFooter>
              </div>
              <div className="flex min-w-0 flex-col border-t border-outline-variant @xl:border-t-0 @xl:border-l">
                <TranslationOutput
                  mode={mode === 'rephrase' ? 'rephrase' : 'translate'}
                  id={`${id}-result`}
                  label={t(
                    translating ? 'component.translator.result' : 'component.translator.rephrased'
                  )}
                  pending={current.pending}
                  error={current.error}
                  text={resultText}
                  compareTo={
                    !settings.showChanges
                      ? null
                      : translating
                        ? translation?.previous
                        : rephrased?.submitted
                  }
                  language={
                    translating ? translation?.language : rephrased?.response.detectedLanguage
                  }
                  htmlFor={`${id}-text`}
                  bare
                  className="min-h-48 flex-1 px-6 py-5 @xl:min-h-72"
                />
                <PaneFooter>
                  <p className="m-0 text-sm text-on-surface-variant">
                    {t('component.translator.resultCount', {
                      length: (shownResult?.length ?? 0).toLocaleString(locale)
                    })}
                  </p>
                  <div className="flex items-center gap-2">
                    {!translating ? (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        disabled={!rephrased || rephraser.pending || !!rephraser.error}
                        title={t('component.translator.applyHint')}
                        onClick={() => {
                          if (!rephrased) return
                          setText(rephrased.response.text)
                          textRef.current?.focus()
                        }}
                      >
                        <ArrowLeftToLineIcon {...ICON} />
                        {t('component.translator.apply')}
                      </Button>
                    ) : null}
                    <CopyButton
                      text={shownResult}
                      label={translating ? undefined : t('component.translator.copyRephrased')}
                    />
                  </div>
                </PaneFooter>
              </div>
            </div>
            <div className="border-t border-outline-variant p-3">
              <Button
                type="submit"
                disabled={!canSubmit}
                aria-keyshortcuts="Control+Enter Meta+Enter"
                className="w-full"
              >
                {translating ? <LanguagesIcon {...ICON} /> : <PenLineIcon {...ICON} />}
                {translating
                  ? t(
                      translator.pending
                        ? 'component.translator.translating'
                        : 'component.translator.translate'
                    )
                  : t(
                      rephraser.pending
                        ? 'component.translator.rephrasing'
                        : 'component.translator.rephrase'
                    )}
                <span aria-hidden="true" className="hidden font-normal opacity-75 sm:inline">
                  {shortcut}
                </span>
              </Button>
            </div>
          </form>
        </Card>
      )}
      <PageSidePanel
        label={t('component.translator.settings')}
        fallback={<TranslatorSettingsCard {...settingsProps} />}
      >
        <TranslatorSidebar {...settingsProps} />
      </PageSidePanel>
    </Container>
  )
}

/** The foot of a pane: its character count and what can be done with its text. */
function PaneFooter({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="flex min-h-14 flex-wrap items-center justify-between gap-2 border-t border-outline-variant px-4 py-2">
      {children}
    </div>
  )
}
