import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { ArrowLeftRightIcon, LanguagesIcon, WandSparklesIcon, XIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button, Card, Label, Textarea } from '@ki4jlu/design-system'
import { TRANSLATE_TEXT_MAX } from '@justcampus/shared'
import { cn } from '@/lib/utils'
import { sourceBoardHtml } from './board-html'
import { CopyButton, IconAction } from './copy-button'
import { LanguageMenu } from './language-menu'
import { isTranslateShortcut, textErrorMessage } from './languages'
import { OutputBoard } from './output-board'
import { splitIntoSentences } from './sentences'
import type { TranslatorStore } from './translator-store'

interface TextBoardProps {
  id: string
  store: TranslatorStore
  /** The module lacks its settings: nothing can be sent. */
  disabled: boolean
}

/**
 * A count as HAWKI writes it: in the browser's number format. The limit is part of its text and
 * written the German way in every language.
 */
const count = (length: number): string => length.toLocaleString()
const LIMIT = TRANSLATE_TEXT_MAX.toLocaleString('de-DE')

/**
 * Translating and rewriting, laid out after HAWKI's translator: the languages on top, the source
 * and the editable result side by side with their counts and actions below, and the main button
 * across the foot of the card. The button only works when something changed since the result;
 * live editing needs none and hides it.
 */
export function TextBoard({ id, store, disabled }: TextBoardProps): React.JSX.Element {
  const { t } = useTranslation()
  const state = store.getState()
  const mode = store.textMode
  const buffer = store.buffer
  const translating = mode === 'translate'
  const textRef = useRef<HTMLTextAreaElement>(null)
  const replacedAll = useRef(false)
  const [focused, setFocused] = useState(false)
  const [hoveringSource, setHoveringSource] = useState(false)
  const [hoveredSource, setHoveredSource] = useState<number | null>(null)
  const [activeSource, setActiveSource] = useState<number | null>(null)
  // The result the source board was put away for, by pointing at or into the source.
  const [dismissed, setDismissed] = useState<object | null>(null)

  const target = store.targetText
  const small = buffer.source.length > 50 || target.length > 50
  const canRun = !disabled && store.hasChanges
  const run = (): void => {
    if (canRun) void store.run()
  }
  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>): void => {
    if (!isTranslateShortcut(event)) return
    event.preventDefault()
    run()
  }

  // As in HAWKI, a result lays the source out as the sentences it was made from, until the
  // pointer or the focus goes into the source; the sentence a result sentence belongs to is
  // marked there while that one is pointed at. So a swap whose request failed still shows the
  // text the result was made from.
  const processed = state.processed[mode]
  const unchanged = buffer.source.trim() === (processed?.text ?? '')
  const marked = activeSource ?? hoveredSource
  const showSourceBoard =
    !focused &&
    !hoveringSource &&
    !!target &&
    ((marked !== null && unchanged) || (processed !== null && dismissed !== processed))

  // HAWKI starts over on any input event of an emptied field, also one a script sends without a
  // change of the value, which React does not report.
  useEffect(() => {
    const element = textRef.current
    if (!element) return
    const onInput = (): void => {
      if (!element.value.trim()) store.setSource(element.value)
    }
    element.addEventListener('input', onInput)
    return () => element.removeEventListener('input', onInput)
  }, [store])
  const error = state.error ? textErrorMessage(state.error, mode) : null

  return (
    <Card className="@container overflow-hidden">
      <div
        className={cn(
          'grid min-h-14 items-center gap-1 border-b border-outline-variant px-2 py-2',
          translating ? 'grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]' : 'grid-cols-1'
        )}
      >
        <LanguageMenu
          label={t('component.translator.source')}
          allowAuto
          value={buffer.sourceLang}
          onChange={(language) => store.setSourceLang(language)}
          className={translating ? 'justify-self-end' : 'justify-self-center'}
        />
        {translating ? (
          <>
            <IconAction label={t('component.translator.swap')} onClick={() => store.swap()}>
              <ArrowLeftRightIcon aria-hidden="true" className="size-4" />
            </IconAction>
            <LanguageMenu
              label={t('component.translator.target')}
              value={buffer.targetLang}
              onChange={(language) => store.setTargetLang(language)}
              className="justify-self-start"
            />
          </>
        ) : null}
      </div>
      <div className="grid @2xl:grid-cols-2">
        <div className="flex min-w-0 flex-col">
          <div
            className="relative flex min-h-0 flex-1 flex-col"
            onMouseEnter={() => {
              setHoveringSource(true)
              setDismissed(processed)
            }}
            onMouseLeave={() => setHoveringSource(false)}
          >
            <Label htmlFor={`${id}-text`} className="sr-only">
              {t(translating ? 'component.translator.text' : 'component.translator.rephraseText')}
            </Label>
            <Textarea
              ref={textRef}
              id={`${id}-text`}
              variant="inline"
              value={buffer.source}
              maxLength={TRANSLATE_TEXT_MAX}
              dir="auto"
              lang={buffer.sourceLang === 'auto' ? undefined : buffer.sourceLang}
              aria-describedby={`${id}-count ${id}-hint`}
              aria-keyshortcuts="Control+Enter Meta+Enter"
              onBeforeInput={() => {
                const element = textRef.current
                replacedAll.current =
                  !!element &&
                  element.value.length > 0 &&
                  element.selectionStart === 0 &&
                  element.selectionEnd === element.value.length
              }}
              onChange={(event) => {
                store.setSource(event.target.value, replacedAll.current)
                replacedAll.current = false
              }}
              onKeyDown={onKeyDown}
              onFocus={() => {
                setFocused(true)
                setDismissed(processed)
              }}
              onBlur={() => setFocused(false)}
              className={cn(
                'min-h-72 flex-1 resize-none py-5 ps-6 pe-14',
                small ? 'text-base' : 'text-xl'
              )}
            />
            {showSourceBoard ? (
              <div
                aria-hidden="true"
                // Over the field, which stays there for the keyboard and screenreaders.
                className={cn(
                  'pointer-events-none absolute inset-0 overflow-hidden bg-surface-container-lowest py-5 ps-6 pe-14 whitespace-pre-wrap break-words text-on-surface',
                  small ? 'text-base' : 'text-xl'
                )}
                // Escaped in `sourceBoardHtml`.
                dangerouslySetInnerHTML={{
                  __html: sourceBoardHtml(
                    unchanged ? buffer.source : buffer.lastSourceText,
                    unchanged ? splitIntoSentences(buffer.source.trim()) : buffer.sourceSentences,
                    activeSource,
                    hoveredSource
                  )
                }}
              />
            ) : null}
            {buffer.source ? null : (
              <div
                id={`${id}-hint`}
                className="pointer-events-none absolute inset-x-0 top-0 grid gap-6 px-6 py-5"
              >
                <p className="m-0 text-xl text-on-surface-variant">
                  {t('component.translator.placeholder')}
                </p>
                <p className="m-0 max-w-md text-base text-on-surface-variant">
                  {t('component.translator.placeholderDocuments')}
                </p>
              </div>
            )}
            {buffer.source ? (
              <IconAction
                label={t('component.translator.clear')}
                onClick={() => {
                  store.clearSource()
                  textRef.current?.focus()
                }}
                className="absolute end-3 top-3"
              >
                <XIcon aria-hidden="true" className="size-4" />
              </IconAction>
            ) : null}
          </div>
          <PaneFooter>
            <p id={`${id}-count`} className="m-0 text-sm text-on-surface-variant">
              {t('component.translator.count', {
                length: count(buffer.source.length),
                max: LIMIT
              })}
            </p>
            <CopyButton text={buffer.source || undefined} whenEmpty="confirm" />
          </PaneFooter>
        </div>
        <div className="flex min-w-0 flex-col border-t border-outline-variant @2xl:border-t-0 @2xl:border-l">
          <OutputBoard
            id={`${id}-result`}
            store={store}
            label={t(
              translating ? 'component.translator.result' : 'component.translator.rephrased'
            )}
            language={
              translating
                ? buffer.targetLang
                : buffer.sourceLang === 'auto'
                  ? undefined
                  : buffer.sourceLang
            }
            small={small}
            onSourceHover={setHoveredSource}
            onSourceActive={setActiveSource}
          />
          <PaneFooter>
            <p className="m-0 text-sm text-on-surface-variant">
              {t('component.translator.resultCount', { length: count(target.length) })}
            </p>
            <div className="flex items-center gap-1">
              {target && translating ? (
                <IconAction
                  label={t('component.translator.improveResult')}
                  onClick={() => store.improveTarget()}
                  disabled={state.loading}
                >
                  <WandSparklesIcon aria-hidden="true" className="size-4" />
                </IconAction>
              ) : null}
              {target && !translating ? (
                <IconAction
                  label={t('component.translator.translateResult')}
                  onClick={() => store.translateTarget()}
                  disabled={state.loading}
                >
                  <LanguagesIcon aria-hidden="true" className="size-4" />
                </IconAction>
              ) : null}
              <CopyButton text={store.outputText || undefined} whenEmpty="confirm" />
            </div>
          </PaneFooter>
        </div>
      </div>
      {store.liveActive ? null : (
        <div className="border-t border-outline-variant p-3">
          <Button
            type="button"
            disabled={!canRun}
            aria-keyshortcuts="Control+Enter Meta+Enter"
            onClick={run}
            className="w-full"
          >
            {t(translating ? 'component.translator.translate' : 'component.translator.rephrase')}
          </Button>
        </div>
      )}
      {error ? (
        <p
          role="alert"
          className="m-0 border-t border-outline-variant px-4 py-3 text-sm text-error"
        >
          {'key' in error ? t(error.key) : error.text}
        </p>
      ) : null}
    </Card>
  )
}

/** The foot of a pane: its character count and what can be done with its text. */
function PaneFooter({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="flex min-h-14 items-center justify-between gap-2 border-t border-outline-variant px-4 py-2">
      {children}
    </div>
  )
}
