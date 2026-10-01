import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { EditorContent, useEditor, useEditorState, type Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Markdown } from '@tiptap/markdown'
import { TableKit } from '@tiptap/extension-table'
import {
  Code2Icon,
  CodeIcon,
  FileDownIcon,
  FileTextIcon,
  FileTypeIcon,
  IndentDecreaseIcon,
  IndentIncreaseIcon,
  ListIcon,
  ListOrderedIcon,
  Maximize2Icon,
  Minimize2Icon,
  RedoIcon,
  TableIcon,
  TextQuoteIcon,
  UndoIcon
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import {
  Button,
  Card,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from '@ki4jlu/design-system'
import { toast } from '@/lib/toast'
import { cn } from '@/lib/utils'
import { CopyButton, IconAction } from '../copy-button'
import type { TranslatorStore } from '../translator-store'
import { AiMenu } from './ai-menu'
import { EditorCodeBlock } from './code-block'
import { detectCodeBlockLanguages, detectCodeLanguage } from './code-language'
import { applyMarkdownTool, type MarkdownTool } from './markdown-format'
import { PassageHighlight } from './passage-highlight'
import {
  documentDocx,
  documentPdf,
  documentText,
  download,
  exportFilename,
  hasBlockText
} from './export'

const ICON = { 'aria-hidden': true, className: 'size-4' } as const

/** The document's look: headings, lists, quotes, code and tables, in the theme's tokens. */
const PROSE =
  'min-h-72 px-8 py-8 text-base text-on-surface outline-none [&_blockquote]:border-s-4 [&_blockquote]:border-outline-variant [&_blockquote]:ps-4 [&_blockquote]:text-on-surface-variant [&_code]:rounded [&_code]:bg-surface-container-high [&_code]:px-1 [&_code]:font-mono [&_code]:text-sm [&_h1]:mt-4 [&_h1]:mb-2 [&_h1]:text-3xl [&_h1]:font-bold [&_h2]:mt-3 [&_h2]:mb-2 [&_h2]:text-2xl [&_h2]:font-semibold [&_h3]:mt-3 [&_h3]:mb-1 [&_h3]:text-xl [&_h3]:font-semibold [&_li]:my-0.5 [&_ol]:list-decimal [&_ol]:ps-6 [&_p]:my-2 [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_table]:my-2 [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-outline-variant [&_td]:p-2 [&_th]:border [&_th]:border-outline-variant [&_th]:bg-surface-container [&_th]:p-2 [&_th]:text-start [&_ul]:list-disc [&_ul]:ps-6 [&_.selectedCell]:bg-secondary-container'

interface KiEditorProps {
  store: TranslatorStore
  /** The maximised view: the editor fills the height of the work area it is in. */
  maximized: boolean
  onMaximized: (maximized: boolean) => void
}

/**
 * "Text erstellen", HAWKI's AI editor: a rich-text document with its toolbar (or Markdown while
 * formatting is off), an AI menu for the marked passage, word and character counts, undo and
 * redo, a maximised view, copying, and export as Word, PDF, text or Markdown.
 */
export function KiEditor({ store, maximized, onMaximized }: KiEditorProps): React.JSX.Element {
  const { t } = useTranslation()
  const state = store.getState()
  const [tab, setTab] = useState<'edit' | 'export'>('edit')
  const container = useRef<HTMLDivElement>(null)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ codeBlock: false }),
      EditorCodeBlock,
      TableKit.configure({ table: { resizable: false } }),
      Markdown,
      PassageHighlight
    ],
    content: state.createHtml || '',
    editorProps: {
      attributes: {
        class: PROSE,
        'aria-label': t('component.translator.editor.document'),
        'aria-multiline': 'true',
        role: 'textbox'
      }
    },
    // A change of the document counts it again (HAWKI's counts follow its update event).
    onUpdate: ({ editor: current }) => {
      store.setCreateHtml(current.getHTML(), current.getMarkdown())
      store.setCreateCount(null)
    },
    immediatelyRender: true
  })

  const counts = useEditorState({
    editor,
    selector: ({ editor: current }) => ({
      markdown: current?.getMarkdown() ?? '',
      empty: isPristine(current),
      // What HAWKI's copy checks: no text anywhere, an empty code block included.
      blank: current?.isEmpty ?? true,
      canUndo: current?.can().undo() ?? false,
      canRedo: current?.can().redo() ?? false
    })
  })

  // Turning formatting off shows the document as Markdown; the document itself takes the
  // Markdown back only when formatting is turned on again, as in HAWKI. Meanwhile the session
  // keeps the formatted document, and a reload shows that, with formatting on.
  useLayoutEffect(() => {
    if (!editor) return
    const { formatting, createMarkdown } = store.getState()
    if (!formatting && createMarkdown === null) {
      store.setCreateMarkdown(editor.getMarkdown())
    } else if (formatting && createMarkdown !== null) {
      editor.commands.setContent(createMarkdown, { contentType: 'markdown' })
      store.setCreateHtml(editor.getHTML(), editor.getMarkdown())
      store.setCreateMarkdown(null)
    }
  }, [editor, store, state.formatting])

  // As in HAWKI, a code block without a language gets the one its code looks like, after each
  // change of the formatted document and when formatting is turned on.
  useEffect(() => {
    if (!editor || !state.formatting) return
    let timer: ReturnType<typeof setTimeout> | undefined
    const detect = (): void => {
      clearTimeout(timer)
      timer = setTimeout(() => {
        if (!editor.isDestroyed) detectCodeBlockLanguages(editor)
      })
    }
    detect()
    editor.on('update', detect)
    return () => {
      clearTimeout(timer)
      editor.off('update', detect)
    }
  }, [editor, state.formatting])

  if (!editor) return <Card className="min-h-96" />
  // Copied is what is shown: the document, or its Markdown while formatting is off. Counted is
  // the document, or the Markdown as last typed (see `createCount`).
  const markdownText = state.formatting ? null : (state.createMarkdown ?? '')
  const currentMarkdown = markdownText ?? counts?.markdown ?? ''
  const counted = state.createCount ?? counts?.markdown ?? ''
  const words = counted.trim() ? counted.trim().split(/\s+/).length : 0
  const characters = counted.length

  return (
    <Card className={cn('flex flex-col overflow-hidden', maximized && 'min-h-0 flex-1')}>
      <Tabs
        value={tab}
        onValueChange={(value) => setTab(value === 'export' ? 'export' : 'edit')}
        className="flex min-h-0 flex-1 flex-col"
      >
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 border-b border-outline-variant px-4 py-3">
          <span className="text-xs font-bold tracking-widest text-on-surface-variant uppercase">
            {t('component.translator.editor.title')}
          </span>
          <TabsList aria-label={t('component.translator.editor.views')}>
            <TabsTrigger value="edit">{t('component.translator.editor.edit')}</TabsTrigger>
            <TabsTrigger value="export">{t('component.translator.editor.export')}</TabsTrigger>
          </TabsList>
          <div className="flex justify-end gap-1">
            <IconAction
              label={t('component.translator.editor.undo')}
              disabled={!counts?.canUndo}
              onClick={() =>
                state.formatting ? editor.chain().focus().undo().run() : editor.commands.undo()
              }
            >
              <UndoIcon {...ICON} />
            </IconAction>
            <IconAction
              label={t('component.translator.editor.redo')}
              disabled={!counts?.canRedo}
              onClick={() =>
                state.formatting ? editor.chain().focus().redo().run() : editor.commands.redo()
              }
            >
              <RedoIcon {...ICON} />
            </IconAction>
          </div>
        </div>
        <TabsContent
          value="edit"
          forceMount
          className="flex min-h-0 flex-1 flex-col data-[state=inactive]:hidden"
        >
          <Toolbar
            editor={editor}
            onMarkdown={
              state.formatting
                ? null
                : (tool) =>
                    formatMarkdown(store, container.current, tool, {
                      column: (n) => t('component.translator.editor.tableColumn', { n }),
                      cell: t('component.translator.editor.tableCell')
                    })
            }
          />
          <div ref={container} className="relative min-h-0 flex-1 overflow-y-auto">
            {state.formatting ? (
              <>
                {/* The document fills the area, so a click anywhere below its text types in it. */}
                <EditorContent
                  editor={editor}
                  className={cn(
                    'flex flex-col [&>.tiptap]:flex-1',
                    maximized ? 'min-h-full' : 'min-h-80'
                  )}
                />
                {counts?.empty ? <Placeholder /> : null}
              </>
            ) : (
              <MarkdownView editor={editor} store={store} container={container} />
            )}
            {state.aiContextMenu && state.formatting ? (
              <AiMenu editor={editor} store={store} container={container} markdownMode={false} />
            ) : null}
          </div>
          <div className="flex min-h-14 items-center justify-between gap-2 border-t border-outline-variant px-4 py-2">
            <p className="m-0 text-sm text-on-surface-variant">
              {/* In the browser's number format, as HAWKI writes them. */}
              {t('component.translator.editor.counts', {
                words: words.toLocaleString(),
                characters: characters.toLocaleString()
              })}
            </p>
            <div className="flex items-center gap-1">
              <IconAction
                label={t(
                  maximized
                    ? 'component.translator.editor.minimize'
                    : 'component.translator.editor.maximize'
                )}
                onClick={() => onMaximized(!maximized)}
              >
                {maximized ? <Minimize2Icon {...ICON} /> : <Maximize2Icon {...ICON} />}
              </IconAction>
              {/* Usable while empty too, as in HAWKI, where it then copies nothing. */}
              <CopyButton
                text={
                  markdownText ?? (counts?.blank === false ? currentMarkdown.trim() : undefined)
                }
                html={state.formatting && counts?.blank === false ? editor.getHTML() : undefined}
                whenEmpty="ignore"
              />
            </div>
          </div>
        </TabsContent>
        <TabsContent
          value="export"
          forceMount
          className="min-h-0 flex-1 overflow-y-auto data-[state=inactive]:hidden"
        >
          <ExportView editor={editor} />
        </TabsContent>
      </Tabs>
    </Card>
  )
}

/**
 * The document as Markdown while formatting is off, edited as text. The formatted document takes
 * it back when formatting is turned on again.
 */
function MarkdownView({
  editor,
  store,
  container
}: {
  editor: Editor
  store: TranslatorStore
  container: React.RefObject<HTMLDivElement | null>
}): React.JSX.Element {
  const { t } = useTranslation()
  const state = store.getState()
  const markdown = state.createMarkdown ?? ''
  return (
    <>
      <Textarea
        variant="inline"
        aria-label={t('component.translator.editor.markdown')}
        value={markdown}
        onChange={(event) => {
          store.setCreateMarkdown(event.target.value)
          store.setCreateCount(event.target.value)
        }}
        // eslint-disable-next-line design-system/layout-only-classname -- Markdown reads in a monospace font, like source text
        className="min-h-80 w-full resize-none px-8 py-8 font-mono text-sm"
      />
      {markdown ? null : <Placeholder />}
      {state.aiContextMenu ? (
        <AiMenu
          editor={editor}
          store={store}
          container={container}
          markdownMode
          onMarkdown={(next) => store.setCreateMarkdown(next)}
        />
      ) : null}
    </>
  )
}

/** A toolbar tool applied to the Markdown text, which keeps the new formatting's text marked. */
function formatMarkdown(
  store: TranslatorStore,
  container: HTMLDivElement | null,
  tool: MarkdownTool,
  table: { column: (n: number) => string; cell: string }
): void {
  const area = container?.querySelector('textarea')
  if (!area) return
  const next = applyMarkdownTool(
    { value: area.value, start: area.selectionStart, end: area.selectionEnd },
    tool,
    table
  )
  store.setCreateMarkdown(next.value)
  store.setCreateCount(next.value)
  requestAnimationFrame(() => {
    area.focus()
    area.setSelectionRange(next.start, next.end)
  })
}

/** Whether the document is still empty: one empty paragraph. */
function isPristine(editor: Editor | null): boolean {
  const doc = editor?.state.doc
  if (!doc || doc.childCount === 0) return true
  return (
    doc.childCount === 1 &&
    doc.firstChild?.type.name === 'paragraph' &&
    doc.firstChild.content.size === 0
  )
}

function Placeholder(): React.JSX.Element {
  const { t } = useTranslation()
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 grid max-w-xl gap-4 px-8 py-8">
      <p className="m-0 text-xl text-on-surface-variant">
        {t('component.translator.editor.placeholder')}
      </p>
      <p className="m-0 text-base text-on-surface-variant">
        {t('component.translator.editor.placeholderHint')}
      </p>
    </div>
  )
}

/**
 * The formatting toolbar: headings, marks, quote, lists, code, table. While formatting is off
 * (`onMarkdown`), the same tools write their Markdown into the text, as in HAWKI.
 */
function Toolbar({
  editor,
  onMarkdown
}: {
  editor: Editor
  onMarkdown: ((tool: MarkdownTool) => void) | null
}): React.JSX.Element {
  const { t } = useTranslation()
  const active = useEditorState({
    editor,
    selector: ({ editor: current }) => ({
      h1: current.isActive('heading', { level: 1 }),
      h2: current.isActive('heading', { level: 2 }),
      h3: current.isActive('heading', { level: 3 }),
      bold: current.isActive('bold'),
      italic: current.isActive('italic'),
      strike: current.isActive('strike'),
      quote: current.isActive('blockquote'),
      bullet: current.isActive('bulletList'),
      ordered: current.isActive('orderedList'),
      code: current.isActive('code'),
      codeBlock: current.isActive('codeBlock')
    })
  })
  const chain = (): ReturnType<Editor['chain']> => editor.chain().focus()
  const tool = (
    key: string,
    label: string,
    pressed: boolean | undefined,
    markdown: MarkdownTool,
    run: () => void,
    content: ReactNode
  ): React.JSX.Element => (
    <Tooltip key={key}>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant={pressed && !onMarkdown ? 'secondary' : 'ghost'}
          size="icon"
          aria-label={label}
          aria-pressed={onMarkdown ? undefined : pressed}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => (onMarkdown ? onMarkdown(markdown) : run())}
        >
          {content}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
  const divider = (key: string): React.JSX.Element => (
    <span key={key} aria-hidden="true" className="mx-1 h-5 w-px bg-outline-variant" />
  )
  return (
    <div
      role="toolbar"
      aria-label={t('component.translator.editor.toolbar')}
      className="flex flex-wrap items-center gap-0.5 border-b border-outline-variant px-4 py-2"
    >
      {([1, 2, 3] as const).map((level) =>
        tool(
          `h${level}`,
          t(`component.translator.editor.heading${level}`),
          active?.[`h${level}`],
          { kind: 'heading', level },
          () => chain().toggleHeading({ level }).run(),
          <span className="text-sm font-medium">{`H${level}`}</span>
        )
      )}
      {divider('d1')}
      {tool(
        'bold',
        t('component.translator.editor.bold'),
        active?.bold,
        { kind: 'bold' },
        () => chain().toggleBold().run(),
        <b>B</b>
      )}
      {tool(
        'italic',
        t('component.translator.editor.italic'),
        active?.italic,
        { kind: 'italic' },
        () => chain().toggleItalic().run(),
        <i>I</i>
      )}
      {tool(
        'strike',
        t('component.translator.editor.strike'),
        active?.strike,
        { kind: 'strike' },
        () => chain().toggleStrike().run(),
        <s>S</s>
      )}
      {divider('d2')}
      {tool(
        'quote',
        t('component.translator.editor.quote'),
        active?.quote,
        { kind: 'quote' },
        () => chain().toggleBlockquote().run(),
        <TextQuoteIcon {...ICON} />
      )}
      {divider('d3')}
      {tool(
        'bullet',
        t('component.translator.editor.bulletList'),
        active?.bullet,
        { kind: 'bullet' },
        () => chain().toggleBulletList().run(),
        <ListIcon {...ICON} />
      )}
      {tool(
        'ordered',
        t('component.translator.editor.orderedList'),
        active?.ordered,
        { kind: 'ordered' },
        () => chain().toggleOrderedList().run(),
        <ListOrderedIcon {...ICON} />
      )}
      {tool(
        'outdent',
        t('component.translator.editor.outdent'),
        undefined,
        { kind: 'outdent' },
        () => chain().liftListItem('listItem').run(),
        <IndentDecreaseIcon {...ICON} />
      )}
      {tool(
        'indent',
        t('component.translator.editor.indent'),
        undefined,
        { kind: 'indent' },
        // Outside a list, indenting starts one, as in HAWKI.
        () =>
          editor.isActive('listItem')
            ? chain().sinkListItem('listItem').run()
            : chain().toggleBulletList().run(),
        <IndentIncreaseIcon {...ICON} />
      )}
      {divider('d4')}
      {tool(
        'code',
        t('component.translator.editor.code'),
        active?.code,
        { kind: 'code' },
        () => chain().toggleCode().run(),
        <CodeIcon {...ICON} />
      )}
      {tool(
        'codeBlock',
        t('component.translator.editor.codeBlock'),
        active?.codeBlock,
        { kind: 'codeBlock' },
        () => {
          // A new block takes the language of the code it is made from, as in HAWKI.
          if (editor.isActive('codeBlock')) return void chain().toggleCodeBlock().run()
          const { from, to, $from } = editor.state.selection
          const code =
            from === to ? $from.parent.textContent : editor.state.doc.textBetween(from, to, '\n')
          const language = detectCodeLanguage(code)
          chain()
            .toggleCodeBlock(language ? { language } : undefined)
            .run()
        },
        <Code2Icon {...ICON} />
      )}
      {divider('d5')}
      {tool(
        'table',
        t('component.translator.editor.table'),
        undefined,
        { kind: 'table' },
        () => chain().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
        <TableIcon {...ICON} />
      )}
    </div>
  )
}

type Format = 'docx' | 'pdf' | 'txt' | 'md'

/** "Exportieren als": Word, PDF, text or Markdown, each a download of the document. */
function ExportView({ editor }: { editor: Editor }): React.JSX.Element {
  const { t } = useTranslation()
  const [busy, setBusy] = useState<Format | null>(null)
  const heading = t('component.translator.editor.exportHeading')

  const run = async (format: Format): Promise<void> => {
    const doc = editor.getJSON()
    const markdown = editor.getMarkdown().trim()
    // Each format is "empty" as in HAWKI: Word and PDF look at the top-level blocks' own text.
    const text = format === 'txt' ? documentText(doc) : null
    const empty = format === 'md' ? !markdown : format === 'txt' ? !text : !hasBlockText(doc)
    if (empty) {
      toast({ variant: 'error', title: t('component.translator.editor.exportEmpty') })
      return
    }
    const filename = exportFilename(markdown, format)
    setBusy(format)
    try {
      if (text !== null) download(text, filename, 'text/plain;charset=utf-8')
      else if (format === 'md') download(markdown, filename, 'text/markdown;charset=utf-8')
      else if (format === 'docx')
        download(
          await documentDocx(doc, {
            dated: (date) => t('component.translator.editor.exportDated', { heading, date }),
            pageHeader: t('component.translator.editor.exportPageHeader'),
            output: t('component.translator.editor.exportOutput')
          }),
          filename,
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        )
      else
        download(
          await documentPdf(doc, heading, (page, count) =>
            t('component.translator.editor.exportPage', { page, count })
          ),
          filename,
          'application/pdf'
        )
    } catch {
      toast({
        variant: 'error',
        title: t('component.translator.editor.exportFailed', { format: format.toUpperCase() })
      })
    } finally {
      setBusy(null)
    }
  }

  const cards: Array<{ format: Format; icon: ReactNode }> = [
    { format: 'docx', icon: <FileTextIcon className="size-6" aria-hidden="true" /> },
    { format: 'pdf', icon: <FileDownIcon className="size-6" aria-hidden="true" /> },
    { format: 'txt', icon: <FileTypeIcon className="size-6" aria-hidden="true" /> },
    { format: 'md', icon: <Code2Icon className="size-6" aria-hidden="true" /> }
  ]
  return (
    <section aria-labelledby="translator-export-title" className="grid gap-6 p-8">
      <h3
        id="translator-export-title"
        className="m-0 text-xs font-bold tracking-widest text-on-surface-variant uppercase"
      >
        {t('component.translator.editor.exportAs')}
      </h3>
      <ul className="m-0 grid max-w-lg list-none gap-3 p-0">
        {cards.map(({ format, icon }) => (
          <li key={format}>
            <Button
              type="button"
              variant="outline"
              disabled={busy !== null}
              onClick={() => void run(format)}
              // eslint-disable-next-line design-system/layout-only-classname -- export cards: icon at the start, name and format at the end, as in HAWKI
              className="flex h-auto w-full items-center justify-between gap-4 p-5 text-start"
            >
              {icon}
              <span className="grid">
                <span className="font-semibold">
                  {t(`component.translator.editor.formats.${format}`)}
                </span>
                <span className="text-xs text-on-surface-variant">
                  {busy === format
                    ? t('component.translator.editor.generating')
                    : format.toUpperCase()}
                </span>
              </span>
            </Button>
          </li>
        ))}
      </ul>
    </section>
  )
}
