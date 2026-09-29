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
import { Button, Card, Container, Label, SegmentedControl, Textarea } from '@ki4jlu/design-system'
import {
  TRANSLATE_TEXT_MAX,
  type RephraseStyle,
  type RephraseTone,
  type TranslatorEngine,
  type TranslatorFormality
} from '@justcampus/shared'
import { ComponentIcon } from '@/components/component-icon'
import { Field } from '@/components/field'
import { PageHeader } from '@/components/page-header'
import { PageSidePanel } from '@/components/page-side-panel'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { useDebouncedValue } from '@/lib/use-debounced-value'
import { useTranslatorEngines } from '@/lib/queries'
import type { ComponentViewProps } from '../types'
import { CopyButton } from './copy-button'
import { LanguageSelect } from './language-select'
import { isApplePlatform, isTranslateShortcut, languageOptions } from './languages'
import { TranslationOutput } from './translation-output'
import { TranslatorSettingsCard, TranslatorSettingsFields } from './translator-settings-card'
import {
  rephraseOptions,
  resolveEngine,
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
 * The translator: translate a text, or rephrase it in its own language. The
 * text is shared between the two modes, each keeps its own result. Input and
 * result sit side by side once the card is wide enough; the settings go
 * into a column on the right of the shell from `lg` up, below the card
 * otherwise.
 */
export function TranslatorPage({ component }: ComponentViewProps<'translator'>): React.JSX.Element {
  const { t, i18n } = useTranslation()
  const id = useId()
  const textRef = useRef<HTMLTextAreaElement>(null)
  const [text, setTextState] = useState('')
  const [settings, updateSettings] = useTranslatorSettings()
  const engines = useTranslatorEngines()
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
  const translating = settings.mode === 'translate'
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
    const next = optionsFor(updateSettings(patch))
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
    if (options.live) runLive(debouncedText)
  }, [debouncedText, options.live, settings.mode])

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
    settings,
    engines: engines.data?.engines,
    engine: options.engine,
    style: options.style,
    tone: options.tone,
    onChange: changeSettings
  }

  const translation = translator.result
  const rephrased = rephraser.result
  const resultText = translating ? translation?.response.translation : rephrased?.response.text
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
        description={t('component.translator.pageDescription', {
          max: TRANSLATE_TEXT_MAX.toLocaleString(locale)
        })}
      />
      <SegmentedControl
        aria-label={t('component.translator.mode')}
        options={[
          { value: 'translate', label: t('component.translator.modes.translate') },
          { value: 'rephrase', label: t('component.translator.modes.rephrase') }
        ]}
        value={settings.mode}
        onValueChange={(next) => {
          const mode = translatorModeSchema.safeParse(next)
          if (mode.success) changeSettings({ mode: mode.data })
        }}
        className="self-start"
      />
      {notSetUp ? (
        <Alert variant="warning">
          <TriangleAlertIcon aria-hidden="true" />
          <AlertTitle>{t('component.translator.notSetUpTitle')}</AlertTitle>
          <AlertDescription>{t('component.translator.notSetUpDescription')}</AlertDescription>
        </Alert>
      ) : null}
      <div className="grid items-start gap-gutter">
        <Card className="@container">
          <form noValidate onSubmit={submit} className="grid gap-gutter p-4 @xl:grid-cols-2 md:p-6">
            <div className="flex min-w-0 flex-col gap-stack-sm">
              {translating ? (
                <div className="flex items-end gap-2">
                  <Field
                    id={`${id}-source`}
                    label={t('component.translator.source')}
                    className="min-w-0 flex-1"
                  >
                    {(control) => (
                      <LanguageSelect
                        {...control}
                        allowDetect
                        value={translator.source}
                        detected={translation?.response.detectedSource}
                        onChange={translator.setSource}
                      />
                    )}
                  </Field>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={t('component.translator.swap')}
                    title={t('component.translator.swap')}
                    disabled={!translator.canSwap}
                    onClick={translator.swap}
                    className="mb-2"
                  >
                    <ArrowLeftRightIcon {...ICON} />
                  </Button>
                </div>
              ) : null}
              <Label htmlFor={`${id}-text`} className={translating ? 'sr-only' : undefined}>
                {t(translating ? 'component.translator.text' : 'component.translator.rephraseText')}
              </Label>
              <Textarea
                ref={textRef}
                id={`${id}-text`}
                value={text}
                maxLength={TRANSLATE_TEXT_MAX}
                placeholder={t('component.translator.placeholder')}
                dir="auto"
                lang={translating ? (translator.source ?? undefined) : undefined}
                aria-describedby={`${id}-count`}
                aria-keyshortcuts="Control+Enter Meta+Enter"
                onChange={(event) => setText(event.target.value)}
                onKeyDown={handleKeyDown}
                className="min-h-56 flex-1"
              />
              <div className="flex min-h-11 flex-wrap items-center justify-between gap-2">
                <p id={`${id}-count`} className="m-0 text-sm text-on-surface-variant">
                  {t('component.translator.count', {
                    length: text.length.toLocaleString(locale),
                    max: TRANSLATE_TEXT_MAX.toLocaleString(locale)
                  })}
                </p>
                <div className="flex items-center gap-stack-sm">
                  <span
                    aria-hidden="true"
                    className="hidden text-sm text-on-surface-variant sm:inline"
                  >
                    {shortcut}
                  </span>
                  <Button
                    type="submit"
                    disabled={!canSubmit}
                    aria-keyshortcuts="Control+Enter Meta+Enter"
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
                  </Button>
                </div>
              </div>
            </div>
            <div className="flex min-w-0 flex-col gap-stack-sm">
              {translating ? (
                <Field id={`${id}-target`} label={t('component.translator.target')}>
                  {(control) => (
                    <LanguageSelect
                      {...control}
                      value={translator.target}
                      onChange={translator.setTarget}
                    />
                  )}
                </Field>
              ) : (
                <Label htmlFor={`${id}-result`}>{t('component.translator.rephrased')}</Label>
              )}
              <TranslationOutput
                mode={settings.mode}
                id={`${id}-result`}
                label={translating ? t('component.translator.result') : undefined}
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
                className="min-h-56 flex-1"
              />
              <div className="flex min-h-11 items-center justify-end gap-2">
                {!translating && detectedName ? (
                  <p className="m-0 mr-auto text-sm text-on-surface-variant">
                    {t('component.translator.detectedLanguage', { language: detectedName })}
                  </p>
                ) : null}
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
                  text={current.pending || current.error ? undefined : resultText}
                  label={translating ? undefined : t('component.translator.copyRephrased')}
                />
              </div>
            </div>
          </form>
        </Card>
        <PageSidePanel
          label={t('component.translator.settings')}
          fallback={<TranslatorSettingsCard {...settingsProps} />}
        >
          <TranslatorSettingsFields {...settingsProps} />
        </PageSidePanel>
      </div>
    </Container>
  )
}
