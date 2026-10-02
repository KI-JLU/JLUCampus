import { lazy, Suspense, useEffect, useId, useRef, useState, useSyncExternalStore } from 'react'
import { PanelLeftCloseIcon, PanelLeftOpenIcon, TriangleAlertIcon, XIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Spinner } from '@ki4jlu/design-system'
import { toTranslatorLanguage } from '@justcampus/shared'
import { ComponentIcon } from '@/components/component-icon'
import { PageHeader } from '@/components/page-header'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  detectLanguage,
  fetchSuggestions,
  rephraseText,
  translateText,
  useTranslatorEngines,
  useTranslatorGlossaries
} from '@/lib/queries'
import { SIDE_PANEL_MEDIA } from '@/lib/page-side-panel'
import { useMediaQuery } from '@/lib/use-media-query'
import { cn } from '@/lib/utils'
import type { ComponentViewProps } from '../types'
import { IconAction } from './copy-button'
import { DocumentTranslator, type DocumentDropTarget } from './document-translator'
import { GlossaryDialog } from './glossary-dialog'
import { TextBoard } from './text-board'
import { TranslatorSidebar } from './translator-sidebar'
import {
  parseSession,
  SESSION_KEY,
  TRANSLATOR_MODES,
  TranslatorStore,
  type TranslatorMode
} from './translator-store'

// The editor brings a rich-text engine and the export libraries; only who opens it loads them.
const KiEditor = lazy(() =>
  import('./editor/ki-editor').then((module) => ({ default: module.KiEditor }))
)

/** Whether a drag carries files from the computer. */
function carriesFiles(event: React.DragEvent): boolean {
  return Array.from(event.dataTransfer.types).includes('Files')
}

/**
 * The translator, laid out after HAWKI's: its own column on the left with the modes (translate
 * a text, translate documents, rewrite a text, create a text with the AI editor), the language
 * model and the settings of the mode; the work area on the right under a notice that the feature
 * is being tested. The state lives in the tab's session, so a reload keeps text and settings.
 */
export function TranslatorPage({ component }: ComponentViewProps<'translator'>): React.JSX.Element {
  const { t } = useTranslation()
  const id = useId()
  const engines = useTranslatorEngines()
  const glossaries = useTranslatorGlossaries()
  const [manageGlossaries, setManageGlossaries] = useState(false)
  const dropTarget = useRef<DocumentDropTarget | null>(null)
  const wide = useMediaQuery(SIDE_PANEL_MEDIA)
  // The column is open on wide screens and closed on narrow ones until the user says otherwise.
  // Narrow, it opens over the work area, as HAWKI's does.
  const [columnChoice, setColumnChoice] = useState<boolean | null>(null)
  const columnOpen = columnChoice ?? wide
  // The AI editor's maximised view, kept while other modes are shown, as HAWKI's is. It fills the
  // work area beside the column, which stays usable.
  const [editorMaximized, setEditorMaximized] = useState(false)

  const [store] = useState(() => {
    const defaultTarget = toTranslatorLanguage(component.config.defaultTargetLanguage) ?? 'en-gb'
    let stored: string | null = null
    let storage: Storage | null = null
    try {
      storage = window.sessionStorage
      stored = storage.getItem(SESSION_KEY)
    } catch {
      storage = null
    }
    return new TranslatorStore(
      {
        translate: translateText,
        rephrase: rephraseText,
        detect: detectLanguage,
        suggest: fetchSuggestions
      },
      parseSession(stored, defaultTarget),
      storage
    )
  })
  useEffect(() => () => store.dispose(), [store])
  const state = useSyncExternalStore(store.subscribe, store.getState)

  const list = engines.data
  useEffect(() => {
    store.setContext({
      engines: list?.engines ?? [],
      defaultEngine: list?.defaultEngine ?? null,
      documents: list?.documents ?? false,
      glossaryIds: glossaries.data
        ? glossaries.data.glossaries.map((glossary) => glossary.id)
        : null
    })
  }, [store, list, glossaries.data])

  const notSetUp = list?.engines.length === 0
  const hasLlm = list?.engines.some((engine) => engine.kind === 'llm') ?? false
  const modes = TRANSLATOR_MODES.filter(
    (mode) => (mode !== 'documents' || list?.documents) && (mode !== 'create' || hasLlm)
  )
  // A mode that is not offered (any more) shows translating instead.
  const mode: TranslatorMode = list && !modes.includes(state.mode) ? 'translate' : state.mode
  const engine = store.engineFor(mode)
  const maximized = mode === 'create' && editorMaximized

  const switchMode = (next: TranslatorMode): void => store.switchMode(next)

  const columnToggle = (className?: string): React.JSX.Element => (
    <IconAction
      label={t(
        columnOpen ? 'component.translator.collapseColumn' : 'component.translator.expandColumn'
      )}
      onClick={() => setColumnChoice(!columnOpen)}
      expanded={columnOpen}
      controls={`${id}-column`}
      className={className}
    >
      {columnOpen ? (
        <PanelLeftCloseIcon aria-hidden="true" className="size-4" />
      ) : (
        <PanelLeftOpenIcon aria-hidden="true" className="size-4" />
      )}
    </IconAction>
  )

  return (
    <>
      <PageHeader
        className="px-gutter pt-gutter"
        title={
          <>
            <ComponentIcon icon={component.icon} iconUrl={component.iconUrl} />
            <span className="truncate">{component.name}</span>
          </>
        }
        // Narrow, the closed column takes no room, as HAWKI's: the header opens it.
        actions={wide ? undefined : columnToggle()}
      />
      <div className="relative flex min-h-0 flex-1">
        <aside
          id={`${id}-column`}
          aria-label={t('component.translator.settings')}
          className={cn(
            'shrink-0 border-e border-outline-variant bg-surface',
            columnOpen
              ? wide
                ? 'relative w-80'
                : 'absolute inset-y-0 start-0 z-20 w-80 max-w-full shadow-overlay'
              : wide
                ? 'relative w-14'
                : 'hidden'
          )}
        >
          {wide ? columnToggle(cn('absolute top-2 z-10', columnOpen ? 'end-2' : 'start-2')) : null}
          <div
            id={`${id}-sidebar-body`}
            hidden={!columnOpen}
            className={cn('h-full', wide ? 'pt-10' : 'pt-4')}
          >
            <TranslatorSidebar
              id={`${id}-sidebar`}
              state={{ ...state, mode }}
              modes={modes}
              engines={list?.engines ?? []}
              engine={engine}
              llmProvider={list?.llmProvider ?? null}
              glossaries={glossaries.data?.glossaries}
              onMode={switchMode}
              onEngine={(choice) => store.selectEngine(choice.id)}
              onLive={(live) => store.setLive(live)}
              onShowChanges={(show) => store.setShowChanges(show)}
              onAiContextMenu={(on) => store.setAiContextMenu(on)}
              onFormatting={(on) => store.setFormatting(on)}
              onGlossaries={(ids) => store.setGlossaries(ids)}
              onManageGlossaries={() => setManageGlossaries(true)}
              onStyle={(style) => store.selectStyle(style)}
              onTone={(tone) => store.selectTone(tone)}
              onFormality={(formality) => store.selectFormality(formality)}
              onResetStyle={() => store.resetStyle()}
            />
          </div>
        </aside>
        <div
          className={cn('min-w-0 flex-1', maximized ? 'overflow-hidden' : 'overflow-y-auto')}
          onDragEnter={(event) => {
            // Files dragged over the text go to the document translator, as in HAWKI.
            if (!carriesFiles(event) || mode === 'documents' || !list?.documents) return
            if (mode === 'translate' || mode === 'rephrase') {
              event.preventDefault()
              switchMode('documents')
            }
          }}
          onDragOver={(event) => {
            if (carriesFiles(event) && mode === 'documents') event.preventDefault()
          }}
          onDrop={(event) => {
            if (!carriesFiles(event) || mode !== 'documents') return
            event.preventDefault()
            dropTarget.current?.addFiles(Array.from(event.dataTransfer.files))
          }}
        >
          <div className={cn('flex flex-col gap-stack-lg p-gutter md:p-6', maximized && 'h-full')}>
            {state.noticeClosed ? null : (
              <Alert variant="warning" className="pe-14">
                <AlertDescription>{t('component.translator.notice')}</AlertDescription>
                <IconAction
                  label={t('component.translator.closeNotice')}
                  onClick={() => store.closeNotice()}
                  className="absolute end-2 top-1/2 -translate-y-1/2"
                >
                  <XIcon aria-hidden="true" className="size-4" />
                </IconAction>
              </Alert>
            )}
            {notSetUp ? (
              <Alert variant="warning">
                <TriangleAlertIcon aria-hidden="true" />
                <AlertTitle>{t('component.translator.notSetUpTitle')}</AlertTitle>
                <AlertDescription>{t('component.translator.notSetUpDescription')}</AlertDescription>
              </Alert>
            ) : null}
            {list?.documents ? (
              // Kept while other modes are shown, so a batch goes on translating meanwhile.
              <div hidden={mode !== 'documents'}>
                <DocumentTranslator
                  ref={dropTarget}
                  target={state.docTargetLang}
                  onTarget={(language) => store.setDocTargetLang(language)}
                  formality={state.formality}
                  glossaryIds={state.glossaryIds}
                />
              </div>
            ) : null}
            {mode === 'documents' ? null : mode === 'create' ? (
              <Suspense
                fallback={
                  <Spinner
                    label={t('component.translator.editor.loading')}
                    className="self-center"
                  />
                }
              >
                <KiEditor
                  store={store}
                  maximized={editorMaximized}
                  onMaximized={setEditorMaximized}
                />
              </Suspense>
            ) : (
              <TextBoard id={id} store={store} disabled={notSetUp || !list} />
            )}
          </div>
        </div>
      </div>
      <GlossaryDialog
        open={manageGlossaries}
        onOpenChange={setManageGlossaries}
        list={glossaries.data}
      />
    </>
  )
}
