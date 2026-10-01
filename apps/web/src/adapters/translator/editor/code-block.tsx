import { useEffect, useRef, useState } from 'react'
import {
  NodeViewContent,
  NodeViewWrapper,
  ReactNodeViewRenderer,
  type ReactNodeViewProps
} from '@tiptap/react'
import { CodeBlockLowlight } from '@tiptap/extension-code-block-lowlight'
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  CircleAlertIcon,
  Code2Icon,
  DownloadIcon,
  MinusIcon,
  PlayIcon,
  PlusIcon,
  PresentationIcon
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Input,
  Spinner,
  useTheme
} from '@ki4jlu/design-system'
import { ApiRequestError } from '@/lib/api'
import { executePython } from '@/lib/queries'
import { cn } from '@/lib/utils'
import { CopyButton, IconAction } from '../copy-button'
import { lowlight } from './code-language'
import { mermaidSource, preloadMermaid, renderMermaid } from './mermaid'
import { parseExecutionOutput, splitOutputImages, type ExecutionOutput } from './python-output'

const ICON = { 'aria-hidden': true, className: 'size-4' } as const

/** Colours of the highlighted code, in the theme's tokens. */
export const CODE_HIGHLIGHT =
  '[&_.hljs-built_in]:text-tertiary [&_.hljs-bullet]:text-tertiary [&_.hljs-number]:text-tertiary [&_.hljs-symbol]:text-tertiary [&_.hljs-type]:text-tertiary [&_.hljs-keyword]:text-error [&_.hljs-link]:text-error [&_.hljs-literal]:text-error [&_.hljs-section]:text-error [&_.hljs-selector-tag]:text-error [&_.hljs-addition]:text-success [&_.hljs-attribute]:text-success [&_.hljs-regexp]:text-success [&_.hljs-string]:text-success [&_.hljs-attr]:text-primary [&_.hljs-name]:text-primary [&_.hljs-template-variable]:text-primary [&_.hljs-title]:text-primary [&_.hljs-variable]:text-primary [&_.hljs-comment]:text-on-surface-variant [&_.hljs-comment]:italic [&_.hljs-meta]:text-on-surface-variant [&_.hljs-quote]:text-on-surface-variant [&_.hljs-deletion]:text-error'

/** The branches of a Git flow diagram, which HAWKI explains below it. */
const GIT_BRANCHES = [
  ['main', 'bg-primary'],
  ['develop', 'bg-success'],
  ['feature', 'bg-warning'],
  ['release', 'bg-tertiary'],
  ['hotfix', 'bg-error']
] as const

/**
 * A code block as in HAWKI's editor: highlighted, headed by its language (click to change it,
 * "code" while it has none), with buttons to copy the code and to fold it to its first line.
 * Mermaid blocks show their diagram, with a switch to the code; Python blocks can be run.
 */
function CodeBlockView(props: ReactNodeViewProps): React.JSX.Element {
  // A block that changes its language starts afresh, as HAWKI draws it anew.
  const language = (props.node.attrs.language as string | null) || null
  return <CodeBlockBody key={language ?? ''} {...props} language={language} />
}

function CodeBlockBody({
  node,
  updateAttributes,
  language
}: ReactNodeViewProps & { language: string | null }): React.JSX.Element {
  const { t } = useTranslation()
  const { resolvedTheme } = useTheme()
  const isMermaid = language === 'mermaid'
  const isPython = language === 'python' || language === 'py'
  const [minimized, setMinimized] = useState(false)
  const [editing, setEditing] = useState(false)
  const [diagramMode, setDiagramMode] = useState(isMermaid)
  /** The last drawing, for the code and theme it was drawn for. */
  const [drawn, setDrawn] = useState<{ key: string; diagram: Diagram } | null>(null)
  const [running, setRunning] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  // Focused right away with the old name marked, as HAWKI does.
  useEffect(() => {
    if (editing) input.current?.select()
  }, [editing])

  const code = node.textContent
  const dark = resolvedTheme === 'dark'
  const drawKey = `${dark ? 'dark' : 'light'}\n${code}`
  // The diagram is drawn when the block appears and again after each change of its code.
  useEffect(() => {
    if (!isMermaid) return
    preloadMermaid()
    if (!diagramMode) return
    let current = true
    renderMermaid(code, dark).then(
      (svg) => current && setDrawn({ key: drawKey, diagram: { state: 'done', svg } }),
      (error: unknown) =>
        current &&
        setDrawn({
          key: drawKey,
          diagram: {
            state: 'error',
            message: error instanceof Error ? error.message : String(error)
          }
        })
    )
    return () => {
      current = false
    }
  }, [isMermaid, diagramMode, code, dark, drawKey])
  const diagram: Diagram = drawn?.key === drawKey ? drawn.diagram : { state: 'loading' }

  // Enter, leaving the field and Escape all keep the name typed, as in HAWKI.
  const save = (value: string): void => {
    setEditing(false)
    updateAttributes({ language: value.trim().toLowerCase() || null })
  }

  const saved = parseExecutionOutput(node.attrs.executionOutput)
  const keep = (output: ExecutionOutput | null): void =>
    updateAttributes({ executionOutput: output ? JSON.stringify(output) : null })

  const run = async (): Promise<void> => {
    setRunning(true)
    try {
      const result = await executePython(code)
      if (result.success) {
        const { text, images } = splitOutputImages(result.output)
        keep({ text, images, isError: false })
      } else {
        keep({
          text: result.output || t('component.translator.editor.outputFailed'),
          images: [],
          isError: true
        })
      }
    } catch (error) {
      // A refused run shows the server's message, as HAWKI shows its answer's message.
      if (error instanceof ApiRequestError && error.body) {
        keep({
          text: error.body.error.message || t('component.translator.editor.outputFailed'),
          images: [],
          isError: true
        })
        return
      }
      keep({
        text: t('component.translator.editor.outputConnection', {
          message: error instanceof Error ? error.message : String(error)
        }),
        images: [],
        isError: true
      })
    } finally {
      setRunning(false)
    }
  }

  const showDiagram = isMermaid && diagramMode

  return (
    <NodeViewWrapper className="my-2 grid gap-3">
      <div className="relative rounded-lg bg-surface-container-high">
        <div
          contentEditable={false}
          className={cn(
            'mx-4 flex min-h-12 items-center justify-between gap-2 py-2 select-none',
            !showDiagram && 'border-b border-outline-variant'
          )}
        >
          {showDiagram ? (
            <span />
          ) : editing ? (
            <Input
              ref={input}
              defaultValue={language ?? 'code'}
              aria-label={t('component.translator.editor.codeLanguage')}
              onKeyDown={(event) => {
                event.stopPropagation()
                if (event.key === 'Enter' || event.key === 'Escape') {
                  event.preventDefault()
                  event.currentTarget.blur()
                }
              }}
              onBlur={(event) => save(event.currentTarget.value)}
              className="max-w-48"
            />
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-label={t('component.translator.editor.codeLanguageChange', {
                language: language ?? 'code'
              })}
              onClick={() => setEditing(true)}
            >
              {language ?? 'code'}
            </Button>
          )}
          <div className="flex items-center gap-1">
            {minimized ? null : (
              <>
                {isPython ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={running}
                    onClick={() => void run()}
                  >
                    {running ? <Spinner size="sm" /> : <PlayIcon {...ICON} />}
                    {t(
                      running
                        ? 'component.translator.editor.running'
                        : 'component.translator.editor.runCode'
                    )}
                  </Button>
                ) : null}
                {isMermaid ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-pressed={!diagramMode}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => setDiagramMode((value) => !value)}
                  >
                    {diagramMode ? <Code2Icon {...ICON} /> : <PresentationIcon {...ICON} />}
                    {t(
                      diagramMode
                        ? 'component.translator.editor.showSource'
                        : 'component.translator.editor.showDiagram'
                    )}
                  </Button>
                ) : null}
                {/* As in HAWKI an empty block copies its empty code; "Kopiert" stays 3 s, also
                    when the clipboard refuses the code. */}
                <CopyButton text={code} whenEmpty="copy" copiedMs={3000} fadeMs={500} unchecked />
              </>
            )}
            <IconAction
              label={t(
                minimized
                  ? 'component.translator.editor.codeExpand'
                  : 'component.translator.editor.codeCollapse'
              )}
              onClick={() => setMinimized((value) => !value)}
              expanded={!minimized}
            >
              {minimized ? <PlusIcon {...ICON} /> : <MinusIcon {...ICON} />}
            </IconAction>
          </div>
        </div>
        {showDiagram && !minimized ? (
          <MermaidPreview diagram={diagram} source={mermaidSource(code)} />
        ) : null}
        <pre
          className={cn(
            'm-0 overflow-x-auto p-4 font-mono text-sm',
            CODE_HIGHLIGHT,
            // The code stays in the document while the diagram stands in its place.
            showDiagram && 'pointer-events-none h-0 overflow-hidden p-0 opacity-0'
          )}
        >
          <NodeViewContent<'code'>
            as="code"
            className={cn(
              language ? `language-${language}` : 'language-code',
              minimized && 'block h-[1.5em] overflow-hidden text-ellipsis whitespace-nowrap'
            )}
          />
        </pre>
      </div>
      {isPython && !minimized && (running || saved) ? (
        <PythonOutput running={running} output={saved} onClear={() => keep(null)} />
      ) : null}
    </NodeViewWrapper>
  )
}

/** A Mermaid diagram being drawn, drawn, or not drawable. */
type Diagram =
  { state: 'loading' } | { state: 'done'; svg: string } | { state: 'error'; message: string }

/** The drawn diagram, "Generiere Diagramm..." meanwhile, or why Mermaid could not draw it. */
function MermaidPreview({
  diagram,
  source
}: {
  diagram: Diagram
  source: string
}): React.JSX.Element {
  const { t } = useTranslation()
  return (
    <div
      contentEditable={false}
      className="mx-4 mb-4 flex min-h-32 flex-col items-center justify-center gap-4 overflow-x-auto rounded-xl border border-outline-variant bg-surface p-10"
    >
      {diagram.state === 'loading' ? (
        <span className="text-sm text-on-surface-variant">
          {t('component.translator.editor.diagramRendering')}
        </span>
      ) : diagram.state === 'error' ? (
        <div role="alert" className="grid justify-items-center gap-1 text-sm text-error">
          <span className="flex items-center gap-1">
            <CircleAlertIcon {...ICON} />
            {t('component.translator.editor.diagramInvalid')}
          </span>
          <pre className="m-0 font-mono text-xs whitespace-pre-wrap">{diagram.message}</pre>
        </div>
      ) : (
        <>
          <div
            className="max-w-full [&_svg]:h-auto [&_svg]:max-w-full"
            // Mermaid's own SVG, drawn with `securityLevel: 'strict'`, which sanitises its labels.
            dangerouslySetInnerHTML={{ __html: diagram.svg }}
          />
          {source.includes('gitGraph') ? (
            <ul className="m-0 flex list-none flex-wrap justify-center gap-4 p-0 text-xs text-on-surface-variant">
              {GIT_BRANCHES.map(([branch, colour]) => (
                <li key={branch} className="flex items-center gap-2">
                  <span aria-hidden="true" className={cn('size-2.5 rounded-full', colour)} />
                  {t(`component.translator.editor.gitLegend.${branch}`)}
                </li>
              ))}
            </ul>
          ) : null}
        </>
      )}
    </div>
  )
}

/** "Ausgabe": what the Python code printed, its error, or its plots; "Löschen" removes it. */
function PythonOutput({
  running,
  output,
  onClear
}: {
  running: boolean
  output: ExecutionOutput | null
  onClear: () => void
}): React.JSX.Element {
  const { t } = useTranslation()
  const [preview, setPreview] = useState<number | null>(null)
  const images = running ? [] : (output?.images ?? [])
  const text = running ? '' : (output?.text ?? '')
  return (
    <section
      contentEditable={false}
      aria-label={t('component.translator.editor.output')}
      aria-busy={running}
      className="overflow-hidden rounded-lg border border-outline-variant bg-surface-container-low select-text"
    >
      <div className="flex items-center justify-between gap-2 border-b border-outline-variant px-4 py-1">
        <span className="text-xs font-semibold text-on-surface-variant">
          {t('component.translator.editor.output')}
        </span>
        <Button type="button" variant="ghost" size="sm" onClick={onClear}>
          {t('component.translator.editor.outputClear')}
        </Button>
      </div>
      <div
        aria-live="polite"
        className={cn(
          'grid gap-3 px-4 py-3 font-mono text-sm',
          output?.isError && !running ? 'text-error' : 'text-on-surface'
        )}
      >
        {running ? (
          t('component.translator.editor.outputRunning')
        ) : text.trim() || images.length > 0 ? (
          <>
            {text.trim() ? <div className="whitespace-pre-wrap">{text}</div> : null}
            {images.map((image, index) => (
              <div key={index} className="relative w-fit">
                <Button
                  type="button"
                  variant="ghost"
                  aria-label={t('component.translator.editor.imagePreview', { index: index + 1 })}
                  onClick={() => setPreview(index)}
                  className="h-auto p-0"
                >
                  <img
                    src={`data:image/png;base64,${image}`}
                    alt=""
                    className="max-h-80 max-w-full rounded-md"
                  />
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="absolute end-2 top-2"
                  onClick={(event) => {
                    event.preventDefault()
                    event.stopPropagation()
                    downloadPlot(image, index)
                  }}
                >
                  <DownloadIcon {...ICON} />
                  {t('component.translator.editor.imageDownload')}
                </Button>
              </div>
            ))}
          </>
        ) : (
          t('component.translator.editor.outputEmpty')
        )}
      </div>
      <ImagePreview images={images} index={preview} onIndex={setPreview} />
    </section>
  )
}

/**
 * Saves a plot as `plot-<n>.png`. Through a link outside the editor, as HAWKI does: a link inside
 * it would be opened by the editor's link handling, in a new tab.
 */
function downloadPlot(image: string, index: number): void {
  const link = document.createElement('a')
  link.href = `data:image/png;base64,${image}`
  link.download = `plot-${index + 1}.png`
  document.body.appendChild(link)
  link.click()
  link.remove()
}

/** A plot enlarged, with the others a step away (arrow keys too) and its download. */
function ImagePreview({
  images,
  index,
  onIndex
}: {
  images: string[]
  index: number | null
  onIndex: (index: number | null) => void
}): React.JSX.Element {
  const { t } = useTranslation()
  const count = images.length
  const image = index === null ? undefined : images[index]
  const step = (by: number): void => {
    if (index !== null && count > 0) onIndex((index + by + count) % count)
  }
  return (
    <Dialog open={image !== undefined} onOpenChange={(open) => (open ? undefined : onIndex(null))}>
      <DialogContent
        closeLabel={t('common.close')}
        className="sm:max-w-4xl"
        // The dialog itself takes the focus, so the first Escape closes it, as in HAWKI: on a
        // focused arrow button it would only close the button's tooltip.
        onOpenAutoFocus={(event) => {
          event.preventDefault()
          ;(event.currentTarget as HTMLElement).focus()
        }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowRight') step(1)
          else if (event.key === 'ArrowLeft') step(-1)
        }}
      >
        <DialogHeader>
          <DialogTitle>{t('component.translator.editor.imageTitle')}</DialogTitle>
          <DialogDescription>
            {t('component.translator.editor.imageCounter', {
              index: (index ?? 0) + 1,
              count
            })}
          </DialogDescription>
        </DialogHeader>
        {image ? (
          <div className="flex items-center gap-2">
            {count > 1 ? (
              <IconAction
                label={t('component.translator.editor.imagePrevious')}
                onClick={() => step(-1)}
              >
                <ChevronLeftIcon {...ICON} />
              </IconAction>
            ) : null}
            <img
              src={`data:image/png;base64,${image}`}
              alt=""
              className="max-h-[70dvh] min-w-0 flex-1 object-contain"
            />
            {count > 1 ? (
              <IconAction
                label={t('component.translator.editor.imageNext')}
                onClick={() => step(1)}
              >
                <ChevronRightIcon {...ICON} />
              </IconAction>
            ) : null}
          </div>
        ) : null}
        {image ? (
          <Button asChild variant="outline" className="justify-self-start">
            <a href={`data:image/png;base64,${image}`} download={`plot-${(index ?? 0) + 1}.png`}>
              <DownloadIcon {...ICON} />
              {t('component.translator.editor.imageDownload')}
            </a>
          </Button>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

/**
 * The editor's code block: highlighted by lowlight, shown by `CodeBlockView`. A Python block
 * keeps the output of its last run (`data-execution-output`), so the session brings it back.
 */
export const EditorCodeBlock = CodeBlockLowlight.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      executionOutput: {
        default: null,
        parseHTML: (element: HTMLElement) => element.getAttribute('data-execution-output'),
        renderHTML: (attributes: { executionOutput?: string | null }) =>
          attributes.executionOutput ? { 'data-execution-output': attributes.executionOutput } : {}
      }
    }
  },
  addNodeView() {
    return ReactNodeViewRenderer(CodeBlockView)
  }
}).configure({ lowlight })
