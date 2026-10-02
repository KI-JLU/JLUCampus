import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import type { Editor, JSONContent } from '@tiptap/react'
import {
  ArrowLeftIcon,
  EyeIcon,
  GlobeIcon,
  GlobeOffIcon,
  ListIcon,
  ListMinusIcon,
  ListPlusIcon,
  MegaphoneIcon,
  MessageSquareQuoteIcon,
  PencilIcon,
  PenLineIcon,
  RedoIcon,
  RefreshCwIcon,
  SearchCheckIcon,
  SendIcon,
  SparklesIcon,
  TableIcon,
  UndoIcon
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import {
  Button,
  Input,
  MenuItem,
  Spinner,
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from '@ki4jlu/design-system'
import type { TranslatorComposeAction } from '@justcampus/shared'
import { composeText } from '@/lib/queries'
import { cn } from '@/lib/utils'
import { IconAction } from '../copy-button'
import {
  ACTION_INSTRUCTION_KEYS,
  agentFor,
  webSearchTrigger,
  withoutSearchCommand,
  type AgentTitle
} from './actions'
import { highlightPassage } from './passage-highlight'
import type { TranslatorStore } from '../translator-store'

const ICON = { 'aria-hidden': true, className: 'size-4' } as const

/** The menu's actions: two up top, the rest listed, in HAWKI's order and groups. */
const PRIMARY: Array<{ action: TranslatorComposeAction; icon: React.ReactNode }> = [
  { action: 'proofread', icon: <SearchCheckIcon {...ICON} /> },
  { action: 'rephrase', icon: <RefreshCwIcon {...ICON} /> }
]
const LISTED: Array<Array<{ action: TranslatorComposeAction; icon: React.ReactNode }>> = [
  [
    { action: 'key_points', icon: <MegaphoneIcon {...ICON} /> },
    { action: 'paraphrase', icon: <MessageSquareQuoteIcon {...ICON} /> },
    { action: 'shorten', icon: <ListMinusIcon {...ICON} /> },
    { action: 'expand', icon: <ListPlusIcon {...ICON} /> }
  ],
  [
    { action: 'list', icon: <ListIcon {...ICON} /> },
    { action: 'table', icon: <TableIcon {...ICON} /> }
  ]
]

/** A version of the passage: the original as the document had it, later ones as Markdown. */
type Version = { json: JSONContent[]; markdown: string } | string

interface History {
  versions: Version[]
  instructions: Array<string | null>
  titles: Array<string | null>
  index: number
  /** The last version other than the original, for "show original" to come back to. */
  lastActive: number
}

/** The passage being worked on: a range of the document, or of the Markdown text. */
interface Passage {
  from: number
  to: number
  markdown: string
  json: JSONContent[]
  compose: boolean
}

type Phase = 'hidden' | 'trigger' | 'menu' | 'compose' | 'result' | 'prompt'

interface AiMenuProps {
  editor: Editor
  store: TranslatorStore
  container: RefObject<HTMLDivElement | null>
  /** Formatting is off: the passage is marked in the Markdown text. */
  markdownMode: boolean
  /** Sets the Markdown text after the passage in it was replaced. */
  onMarkdown?: (markdown: string) => void
}

/**
 * The AI menu of the editor, after HAWKI's: a button beside the marked passage opens the
 * actions (proofread, rephrase, key points, paraphrase, shorten, expand, list, table, compose)
 * and a field for an instruction of one's own. The result replaces the passage; a bar over it
 * steps through its versions, regenerates, shows the original, takes a new instruction, resets,
 * or finishes.
 */
export function AiMenu(props: AiMenuProps): React.JSX.Element {
  // Over the page rather than inside the editor, whose scrolling would cut the menus off.
  return createPortal(<AiMenuPanel {...props} />, document.body)
}

function AiMenuPanel({
  editor,
  store,
  container,
  markdownMode,
  onMarkdown
}: AiMenuProps): React.JSX.Element | null {
  const { t } = useTranslation()
  const [phase, setPhase] = useState<Phase>('hidden')
  const [position, setPosition] = useState({ top: 0, left: 0, below: 0 })
  const [passage, setPassage] = useState<Passage | null>(null)
  const [history, setHistory] = useState<History | null>(null)
  const [loading, setLoading] = useState(false)
  const [instruction, setInstruction] = useState('')
  const [draft, setDraft] = useState('')
  const panel = useRef<HTMLDivElement>(null)
  const request = useRef<AbortController | null>(null)
  const phaseRef = useRef(phase)
  useEffect(() => {
    phaseRef.current = phase
  }, [phase])

  const textarea = (): HTMLTextAreaElement | null =>
    container.current?.querySelector<HTMLTextAreaElement>('textarea') ?? null

  /** Where the marked passage is, relative to the scrolling container. */
  /** Where the marked passage is on screen; the menus float over the page, fixed. */
  const measure = (): void => {
    const box = container.current
    if (!box) return
    const rect = box.getBoundingClientRect()
    if (markdownMode) {
      setPosition({ top: rect.top + 12, left: rect.left + 8, below: rect.top + 52 })
      return
    }
    const { from, to } = editor.state.selection
    try {
      const start = editor.view.coordsAtPos(from)
      const end = editor.view.coordsAtPos(to)
      setPosition({
        top: start.top,
        left: Math.max(rect.left + 4, start.left - 40),
        below: end.bottom + 8
      })
    } catch {
      setPosition({ top: rect.top + 12, left: rect.left + 8, below: rect.top + 52 })
    }
  }

  const empty = (): boolean => (markdownMode ? !(textarea()?.value.trim() ?? '') : editor.isEmpty)

  const selectedText = (): string => {
    if (markdownMode) {
      const area = textarea()
      return area ? area.value.slice(area.selectionStart, area.selectionEnd) : ''
    }
    const { from, to } = editor.state.selection
    return editor.state.doc.textBetween(from, to, '\n')
  }

  // The button shows beside a marked passage, and in an empty document to write into it.
  const follow = (): void => {
    if (!['hidden', 'trigger'].includes(phaseRef.current)) return
    const focused = markdownMode ? document.activeElement === textarea() : editor.isFocused
    const show = (selectedText().trim() !== '' || empty()) && focused
    if (show) measure()
    setPhase(show ? 'trigger' : 'hidden')
  }
  // Editor events call the latest `follow`, which sees the current mode and phase.
  const followRef = useRef(follow)
  useEffect(() => {
    followRef.current = follow
  })

  useEffect(() => {
    const handler = (): void => followRef.current()
    const later = (): void => {
      setTimeout(handler, 150)
    }
    editor.on('selectionUpdate', handler)
    editor.on('focus', handler)
    editor.on('blur', later)
    const area = container.current?.querySelector('textarea') ?? null
    const events = ['select', 'keyup', 'mouseup', 'focus'] as const
    for (const event of events) area?.addEventListener(event, handler)
    area?.addEventListener('blur', later)
    return () => {
      editor.off('selectionUpdate', handler)
      editor.off('focus', handler)
      editor.off('blur', later)
      for (const event of events) area?.removeEventListener(event, handler)
      area?.removeEventListener('blur', later)
    }
  }, [editor, markdownMode, container])

  useEffect(() => () => request.current?.abort(), [])

  // The passage stays marked while the menu works on it, the focus being in the menu.
  const passageFrom = passage?.from
  const passageTo = passage?.to
  useEffect(() => {
    if (markdownMode) return
    const marked = phase !== 'hidden' && phase !== 'trigger' && passageFrom !== undefined
    highlightPassage(editor, marked ? { from: passageFrom, to: passageTo ?? passageFrom } : null)
  }, [editor, markdownMode, phase, passageFrom, passageTo])
  useEffect(() => () => highlightPassage(editor, null), [editor])

  const close = (): void => {
    setPhase('hidden')
    setHistory(null)
    setPassage(null)
    setInstruction('')
  }

  // A click outside ends the menu; a result stays as it is.
  useEffect(() => {
    if (phase === 'hidden' || phase === 'trigger') return
    const onPointer = (event: PointerEvent): void => {
      if (panel.current?.contains(event.target as Node)) return
      if (loading) return
      close()
    }
    document.addEventListener('pointerdown', onPointer)
    return () => document.removeEventListener('pointerdown', onPointer)
  })

  /** Remembers the marked passage (or the whole empty document) before the menu takes focus. */
  const capture = (compose: boolean): Passage => {
    if (markdownMode) {
      const area = textarea()
      const start = area?.selectionStart ?? 0
      const end = area?.selectionEnd ?? 0
      const text = (area?.value ?? '').slice(start, end)
      return { from: start, to: end, markdown: text, json: [], compose }
    }
    const { doc } = editor.state
    let { from, to } = editor.state.selection
    if (editor.isEmpty) {
      from = 0
      to = doc.content.size
    }
    const slice = doc.slice(from, to)
    const json = (slice.content.toJSON() as JSONContent[] | null) ?? []
    let markdown = doc.textBetween(from, to, '\n\n')
    try {
      markdown = editor.markdown?.serialize({ type: 'doc', content: json }) ?? markdown
    } catch {
      // The plain text will do.
    }
    return { from, to, markdown: markdown.trim(), json, compose }
  }

  /** Puts a version in place of the passage and marks it. */
  const apply = (version: Version, range: Passage): Passage => {
    if (markdownMode) {
      const area = textarea()
      const value = area?.value ?? ''
      const text = typeof version === 'string' ? version : version.markdown
      const next = value.slice(0, range.from) + text + value.slice(range.to)
      onMarkdown?.(next)
      editor.commands.setContent(next, { contentType: 'markdown' })
      store.setCreateHtml(editor.getHTML(), editor.getMarkdown())
      requestAnimationFrame(() => {
        area?.focus()
        area?.setSelectionRange(range.from, range.from + text.length)
      })
      return { ...range, to: range.from + text.length }
    }
    const before = editor.state.doc.content.size
    const to = Math.min(range.to, before)
    const chain = editor.chain().focus()
    if (typeof version === 'string') {
      chain.insertContentAt({ from: range.from, to }, version, { contentType: 'markdown' })
    } else {
      chain.insertContentAt({ from: range.from, to }, version.json.length > 0 ? version.json : '')
    }
    chain.run()
    const after = editor.state.doc.content.size
    const next = Math.max(range.from, to + (after - before))
    editor.commands.setTextSelection({ from: range.from, to: Math.min(next, after) })
    return { ...range, to: next }
  }

  const show = (index: number, current = history, range = passage): void => {
    if (!current || !range) return
    const version = current.versions[index]
    if (version === undefined) return
    setPassage(apply(version, range))
    setHistory({ ...current, index, lastActive: index > 0 ? index : current.lastActive })
    setInstruction(current.instructions[index] ?? '')
    measure()
  }

  /** Asks the model and adds the answer as the newest version. */
  const process = async (
    action: TranslatorComposeAction,
    text: string,
    title: string
  ): Promise<void> => {
    const range = passage ?? capture(action === 'compose')
    const current: History = history ?? {
      versions: [{ json: range.json, markdown: range.markdown }],
      instructions: [null],
      titles: [null],
      index: 0,
      lastActive: 0
    }
    const compose = range.compose || action === 'compose'
    const original = current.versions[0]
    const originalMarkdown = typeof original === 'string' ? original : (original?.markdown ?? '')
    setPassage({ ...range, compose })
    setHistory(current)
    setInstruction(text)
    setPhase('result')
    setLoading(true)
    editor.setEditable(false)
    request.current?.abort()
    const controller = new AbortController()
    request.current = controller
    const { style, tone, formality, webSearch } = store.getState()
    try {
      const response = await composeText(
        {
          action: compose ? 'compose' : action,
          text: originalMarkdown,
          instruction: text,
          engine: store.engineFor('create')?.id,
          webSearch,
          style,
          tone,
          formality
        },
        controller.signal
      )
      let result = response.text
      // Writing on keeps what was there and adds the new text below it.
      if (
        compose &&
        originalMarkdown.trim() &&
        !result.trim().startsWith(originalMarkdown.trim())
      ) {
        result = `${originalMarkdown}\n\n${result}`
      }
      const next: History = {
        versions: [...current.versions, result],
        instructions: [...current.instructions, text],
        titles: [...current.titles, title],
        index: current.versions.length,
        lastActive: current.versions.length
      }
      editor.setEditable(true)
      show(next.index, next, { ...range, compose })
    } catch {
      if (controller.signal.aborted) return
      // As in HAWKI, a failed request closes the menus without a message; the text stays as it was.
      editor.setEditable(true)
      close()
    } finally {
      if (request.current === controller) {
        setLoading(false)
        editor.setEditable(true)
      }
    }
  }

  const titleOf = (action: TranslatorComposeAction): string =>
    t(`component.translator.editor.actions.${action}`)
  const titleText = (title: AgentTitle): string =>
    'text' in title ? title.text : t(`component.translator.editor.titles.${title.key}`)

  /** Sends an instruction: as HAWKI does, its words tell the action, composing aside. */
  const send = (instruction: string): void => {
    if (passage?.compose) {
      void process('compose', instruction, titleOf('compose'))
      return
    }
    const agent = agentFor(instruction)
    void process(agent.action, instruction, titleText(agent.title))
  }

  // A menu action sends its instruction in HAWKI's words; rephrasing sends what is typed.
  const runAction = (action: TranslatorComposeAction): void =>
    send(action === 'rephrase' && draft.trim() ? draft.trim() : t(ACTION_INSTRUCTION_KEYS[action]))

  const runInstruction = (text: string): void => {
    const trimmed = text.trim()
    if (trimmed) send(trimmed)
  }

  /** Composing sends the instruction without HAWKI's "/suche" command. */
  const compose = (text: string): void => {
    const trimmed = text.trim()
    if (!trimmed) return
    const instruction = withoutSearchCommand(trimmed).trim() || trimmed
    void process('compose', instruction, titleOf('compose'))
  }

  const openMenu = (): void => {
    const range = capture(empty())
    setPassage(range)
    setHistory(null)
    setDraft('')
    measure()
    setPhase(empty() ? 'compose' : 'menu')
  }

  useLayoutEffect(() => {
    if (phase === 'menu' || phase === 'compose' || phase === 'prompt') {
      panel.current?.querySelector<HTMLInputElement>('input')?.focus()
    }
  }, [phase])

  // Scrolling moves the passage; the floating parts follow it.
  const measureRef = useRef(measure)
  useEffect(() => {
    measureRef.current = measure
  })
  useEffect(() => {
    if (phase === 'hidden') return
    const update = (): void => measureRef.current()
    const box = container.current
    box?.addEventListener('scroll', update)
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => {
      box?.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [phase, container])

  // A panel that would reach past the bottom of the window opens above the passage instead.
  const [lift, setLift] = useState(0)
  useLayoutEffect(() => {
    const element = panel.current
    if (!element) {
      setLift(0)
      return
    }
    const height = element.offsetHeight
    const bottom = position.below + height
    setLift(
      bottom > window.innerHeight - 8
        ? Math.min(bottom - (window.innerHeight - 8), position.below - 8)
        : 0
    )
  }, [phase, position, loading])

  if (phase === 'hidden') return null

  if (phase === 'trigger') {
    return (
      <div style={{ top: position.top, left: position.left }} className="fixed z-30">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label={t('component.translator.editor.aiActions')}
              aria-haspopup="menu"
              onMouseDown={(event) => event.preventDefault()}
              onClick={openMenu}
            >
              <PenLineIcon {...ICON} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t('component.translator.editor.aiActions')}</TooltipContent>
        </Tooltip>
      </div>
    )
  }

  const floating =
    'fixed z-30 rounded-xl border border-outline-variant bg-surface-container-lowest shadow-overlay'

  if (phase === 'menu') {
    return (
      <div
        ref={panel}
        role="menu"
        aria-label={t('component.translator.editor.aiActions')}
        style={{ top: position.below - lift, left: Math.max(4, position.left) }}
        className={cn(floating, 'flex w-60 flex-col gap-1 p-1.5')}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault()
            close()
            editor.commands.focus()
          }
        }}
      >
        <div className="relative">
          <SparklesIcon
            aria-hidden="true"
            className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-on-surface-variant"
          />
          <Input
            aria-label={t('component.translator.editor.describe')}
            placeholder={t('component.translator.editor.describe')}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                runInstruction(draft)
              }
            }}
            className="ps-9"
          />
        </div>
        <div className="grid grid-cols-2 gap-1">
          {PRIMARY.map(({ action, icon }) => (
            <Button
              key={action}
              type="button"
              variant="outline"
              size="sm"
              role="menuitem"
              onClick={() => runAction(action)}
              // eslint-disable-next-line design-system/layout-only-classname -- the two main actions stack icon over label, as in HAWKI
              className="h-auto flex-col gap-1 py-2"
            >
              {icon}
              <span className="text-xs font-semibold">{titleOf(action)}</span>
            </Button>
          ))}
        </div>
        {LISTED.map((group, index) => (
          <div key={index} className="grid border-t border-outline-variant pt-1">
            {group.map(({ action, icon }) => (
              <MenuItem
                key={action}
                type="button"
                role="menuitem"
                onClick={() => runAction(action)}
              >
                {icon}
                <span className="font-semibold">{titleOf(action)}</span>
              </MenuItem>
            ))}
          </div>
        ))}
        <div className="grid border-t border-outline-variant pt-1">
          <MenuItem
            type="button"
            role="menuitem"
            onClick={() => {
              setDraft('')
              setPassage((current) => (current ? { ...current, compose: true } : current))
              setPhase('compose')
            }}
          >
            <PenLineIcon {...ICON} />
            <span className="font-semibold">{t('component.translator.editor.composeMenu')}</span>
          </MenuItem>
        </div>
      </div>
    )
  }

  if (phase === 'compose' || phase === 'prompt') {
    const composing = phase === 'compose'
    const trigger = webSearchTrigger(draft)
    const webSearch = store.getState().webSearch
    return (
      <div
        ref={panel}
        role="dialog"
        aria-label={t(
          composing
            ? 'component.translator.editor.composeTo'
            : 'component.translator.editor.describe'
        )}
        style={{
          top: composing ? position.below : Math.max(4, position.top - 56),
          left: Math.max(4, position.left)
        }}
        className={cn(floating, 'flex w-[min(30rem,calc(100%-1rem))] items-center gap-1 p-1.5')}
      >
        <IconAction
          label={t('component.translator.back')}
          onClick={() => {
            if (composing && (empty() || !history)) {
              if (empty()) close()
              else setPhase('menu')
            } else setPhase('result')
          }}
        >
          <ArrowLeftIcon {...ICON} />
        </IconAction>
        <Input
          aria-label={t(
            composing
              ? 'component.translator.editor.composeTo'
              : 'component.translator.editor.describe'
          )}
          placeholder={t(
            composing
              ? 'component.translator.editor.composeTo'
              : 'component.translator.editor.describe'
          )}
          value={draft}
          disabled={loading}
          onChange={(event) => {
            setDraft(event.target.value)
            // "/suche" asks for the web search, which it switches on.
            if (composing && webSearchTrigger(event.target.value).command) {
              store.setWebSearch(true)
            }
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              if (composing) compose(draft)
              else runInstruction(draft)
            } else if (event.key === 'Escape') {
              event.preventDefault()
              if (composing && empty()) close()
              else setPhase(history ? 'result' : 'menu')
            }
          }}
          className="flex-1"
        />
        {composing && trigger.shown ? (
          // A link or "/suche" brings up HAWKI's web search switch: on unless switched off.
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-pressed={webSearch}
                aria-label={t(
                  webSearch
                    ? 'component.translator.editor.webSearchOn'
                    : 'component.translator.editor.webSearchOff'
                )}
                disabled={loading}
                onClick={() => store.setWebSearch(!webSearch)}
                className={cn(
                  'shrink-0 rounded-full border',
                  webSearch ? 'border-primary text-primary' : 'border-error text-error'
                )}
              >
                {webSearch ? <GlobeIcon {...ICON} /> : <GlobeOffIcon {...ICON} />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {t(
                webSearch
                  ? 'component.translator.editor.webSearchOn'
                  : 'component.translator.editor.webSearchOff'
              )}
            </TooltipContent>
          </Tooltip>
        ) : null}
        <IconAction
          label={t('component.translator.editor.submit')}
          disabled={!draft.trim() || loading}
          onClick={() => {
            if (composing) compose(draft)
            else runInstruction(draft)
          }}
        >
          <SendIcon {...ICON} />
        </IconAction>
      </div>
    )
  }

  // The result bar over the passage.
  const count = history?.versions.length ?? 0
  const index = history?.index ?? 0
  const title = loading
    ? t('component.translator.editor.working')
    : index === 0
      ? t('component.translator.editor.originalText')
      : (history?.titles[index] ?? titleOf('rephrase'))
  return (
    <div
      ref={panel}
      role="toolbar"
      aria-label={t('component.translator.editor.resultBar')}
      aria-busy={loading}
      style={{ top: Math.max(4, position.top - 56), left: Math.max(4, position.left) }}
      className={cn(floating, 'flex flex-wrap items-center gap-1 p-1.5')}
    >
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={loading}
        onClick={() => {
          show(0)
          close()
        }}
      >
        {t('component.translator.editor.reset')}
      </Button>
      {passage?.compose ? null : (
        <IconAction
          label={t('component.translator.editor.showOriginal')}
          disabled={loading || count < 2}
          onClick={() => show(index === 0 ? Math.max(1, history?.lastActive ?? count - 1) : 0)}
        >
          <EyeIcon {...ICON} />
        </IconAction>
      )}
      <IconAction
        label={t('component.translator.editor.editPrompt')}
        disabled={loading}
        onClick={() => {
          setDraft(instruction)
          setPhase('prompt')
        }}
      >
        <PencilIcon {...ICON} />
      </IconAction>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            tabIndex={0}
            className="flex items-center gap-2 px-2 text-sm font-semibold text-on-surface"
          >
            {loading ? <Spinner size="sm" /> : null}
            {title}
          </span>
        </TooltipTrigger>
        <TooltipContent>
          {instruction || t('component.translator.editor.originalText')}
        </TooltipContent>
      </Tooltip>
      <span className="flex items-center rounded-lg border border-outline-variant">
        <IconAction
          label={t('component.translator.editor.previous')}
          disabled={loading || index <= 0}
          onClick={() => show(index - 1)}
        >
          <UndoIcon {...ICON} />
        </IconAction>
        <span aria-live="polite" className="px-1 text-xs text-on-surface-variant">
          {`${count > 0 ? index + 1 : 0}/${count}`}
        </span>
        <IconAction
          label={t('component.translator.editor.next')}
          disabled={loading || index >= count - 1}
          onClick={() => show(index + 1)}
        >
          <RedoIcon {...ICON} />
        </IconAction>
      </span>
      <IconAction
        label={t('component.translator.editor.regenerate')}
        disabled={loading}
        onClick={() => {
          // From the original, the instruction of the last version is asked again.
          const active = history?.lastActive ?? 0
          const text = instruction || history?.instructions[active] || titleOf('rephrase')
          const action = passage?.compose ? 'compose' : agentFor(text).action
          void process(action, text, history?.titles[index || active] ?? titleOf(action))
        }}
      >
        <RefreshCwIcon {...ICON} />
      </IconAction>
      <Button type="button" size="sm" disabled={loading} onClick={close}>
        {t('component.translator.editor.done')}
      </Button>
    </div>
  )
}
