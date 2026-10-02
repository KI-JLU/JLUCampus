import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { LockIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import {
  Badge,
  fieldVariants,
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from '@ki4jlu/design-system'
import { cn } from '@/lib/utils'
import {
  BOARD_CLASSES,
  BOARD_INSET,
  boardHtml,
  boardTextSize,
  caretOffset,
  changesHtml,
  restoreCaret
} from './board-html'
import { SentenceMenu, type MenuAnchor } from './sentence-menu'
import type { TranslatorStore } from './translator-store'
import { TYPING_PAUSE_MS } from './translator-store'

interface OutputBoardProps {
  id: string
  store: TranslatorStore
  /** Accessible name of the result. */
  label: string
  /** The language of the result, for pronunciation. */
  language: string | undefined
  /** Text size, in step with the source. */
  small: boolean
  /** A sentence of the result is pointed at or opened: its source sentence, or `null`. */
  onSourceHover: (index: number | null) => void
  onSourceActive: (index: number | null) => void
}

/**
 * The result: an editable board of sentences. A click on a sentence opens its menu (undo,
 * other wordings, other words, into the source); typing edits the result, which is laid out
 * again once typing pauses. Rewriting with "show changes" shows the changes instead, locked.
 */
export function OutputBoard({
  id,
  store,
  label,
  language,
  small,
  onSourceHover,
  onSourceActive
}: OutputBoardProps): React.JSX.Element {
  const { t } = useTranslation()
  const state = store.getState()
  const mode = store.textMode
  const buffer = store.buffer
  const ref = useRef<HTMLDivElement>(null)
  const group = useRef<HTMLDivElement>(null)
  const typing = useRef(false)
  const relayout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [anchor, setAnchor] = useState<MenuAnchor | null>(null)

  const target = buffer.targetSentences.join('')
  const locked =
    mode === 'rephrase' && state.showChanges && !!buffer.lastSourceText && !!target.trim()
  const deletedLabel = t('component.translator.diff.deleted')
  const insertedLabel = t('component.translator.diff.inserted')
  const pending = state.pendingSentences
  const html = useMemo(
    () =>
      locked
        ? changesHtml(buffer.lastSourceText, target, {
            deleted: deletedLabel,
            inserted: insertedLabel
          })
        : boardHtml({
            sentences: buffer.targetSentences,
            mapping: buffer.baselineTargetSentences.length > 0 ? store.mapping() : null,
            highlightAgainst:
              mode === 'rephrase' && !state.showChanges && buffer.lastSourceText
                ? buffer.lastSourceText
                : null,
            loading: pending ?? []
          }),
    // The mapping follows the sentences, which the store replaces on every change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [locked, target, buffer, mode, state.showChanges, pending, deletedLabel, insertedLabel]
  )
  const latestHtml = useRef(html)
  useLayoutEffect(() => {
    latestHtml.current = html
  }, [html])

  // Rebuilt from the state, but not under the fingers of someone typing in it.
  useLayoutEffect(() => {
    const element = ref.current
    if (!element || typing.current) return
    if (element.innerHTML !== html) element.innerHTML = html
    if (anchor) {
      element
        .querySelectorAll(`.sentence-item[data-index="${anchor.index}"]`)
        .forEach((sentence) => sentence.setAttribute('data-active', 'true'))
    }
  }, [html, anchor])

  useEffect(
    () => () => {
      if (relayout.current) clearTimeout(relayout.current)
    },
    []
  )

  const layOut = (): void => {
    const element = ref.current
    if (relayout.current) clearTimeout(relayout.current)
    relayout.current = null
    typing.current = false
    if (!element) return
    const focused = document.activeElement === element
    const caret = focused ? caretOffset(element) : null
    if (element.innerHTML !== latestHtml.current) element.innerHTML = latestHtml.current
    if (caret !== null) restoreCaret(element, caret)
  }

  const closeMenu = (): void => {
    setAnchor(null)
    onSourceActive(null)
  }

  const open = (event: React.MouseEvent<HTMLDivElement>): void => {
    if (locked || state.loading) return
    const targetElement = event.target as HTMLElement
    const sentence = targetElement.closest<HTMLElement>('.sentence-item')
    if (!sentence || !group.current || !ref.current) return
    const word = targetElement.closest<HTMLElement>('.word-item')
    const index = Number(sentence.dataset.index)
    const source = sentence.dataset.sourceIndex
    const rect = sentence.getBoundingClientRect()
    const groupRect = group.current.getBoundingClientRect()
    const boardRect = ref.current.getBoundingClientRect()
    setAnchor({
      index,
      tokenIndex: word?.dataset.tokenIndex !== undefined ? Number(word.dataset.tokenIndex) : null,
      word: word?.textContent ?? null,
      hasSource: source !== undefined,
      top: rect.top - groupRect.top,
      bottom: rect.bottom - groupRect.top,
      left: Math.max(16, boardRect.left - groupRect.left)
    })
    onSourceActive(source !== undefined ? Number(source) : null)
  }

  const hover = (event: React.MouseEvent<HTMLDivElement>): void => {
    const sentence = (event.target as HTMLElement).closest<HTMLElement>('.sentence-item')
    const source = sentence?.dataset.sourceIndex
    onSourceHover(source !== undefined ? Number(source) : null)
  }

  const fullSkeleton = state.loading && state.pendingSentences === null

  return (
    <div ref={group} className="relative flex min-h-0 flex-1 flex-col">
      {locked ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge
              appearance="text"
              tone="neutral"
              tabIndex={0}
              aria-label={t('component.translator.locked')}
              className="absolute end-5 top-5 z-10"
            >
              <LockIcon aria-hidden="true" className="size-4" />
            </Badge>
          </TooltipTrigger>
          <TooltipContent>{t('component.translator.locked')}</TooltipContent>
        </Tooltip>
      ) : null}
      {fullSkeleton ? (
        <Skeleton
          source={buffer.source}
          label={t(
            mode === 'rephrase'
              ? 'component.translator.rephrasing'
              : 'component.translator.translating'
          )}
        />
      ) : null}
      <div
        ref={ref}
        id={id}
        role="textbox"
        aria-multiline="true"
        aria-label={label}
        aria-busy={state.loading}
        lang={language}
        dir="auto"
        contentEditable={!locked && !state.loading}
        suppressContentEditableWarning
        spellCheck={false}
        tabIndex={0}
        onClick={open}
        onMouseOver={hover}
        onMouseLeave={() => onSourceHover(null)}
        onInput={() => {
          const element = ref.current
          if (!element) return
          typing.current = true
          store.setTarget(element.innerText)
          closeMenu()
          if (relayout.current) clearTimeout(relayout.current)
          relayout.current = setTimeout(layOut, TYPING_PAUSE_MS)
        }}
        onBlur={() => setTimeout(layOut, 50)}
        onKeyUp={(event) => {
          if (event.key.startsWith('Arrow') && typing.current) setTimeout(layOut, 10)
        }}
        onMouseUp={() => {
          if (typing.current) setTimeout(layOut, 10)
        }}
        onPaste={(event) => {
          // Pasted rich text (tables, pictures) would not survive; its words do.
          event.preventDefault()
          document.execCommand('insertText', false, event.clipboardData.getData('text/plain'))
        }}
        // An editable field like the source beside it: the DS's inline field, with the insets
        // the two share. While sentences are redone it cannot be typed in, and shows the
        // fields' disabled look (a div takes no `:disabled`).
        className={cn(
          fieldVariants({ variant: 'inline' }),
          'min-h-72 flex-1 overflow-y-auto whitespace-pre-wrap break-words',
          BOARD_INSET,
          boardTextSize(small),
          fullSkeleton && 'hidden',
          state.pendingSentences && 'opacity-60'
        )}
      />
      {anchor ? (
        <SentenceMenu
          // A click on another sentence or word opens its menu afresh, suggestions closed.
          key={`${anchor.index}-${anchor.tokenIndex}`}
          store={store}
          anchor={anchor}
          containerRef={group}
          onClose={closeMenu}
        />
      ) : null}
    </div>
  )
}

/**
 * Lines standing in for the result while it is made, one per line of the source. Each line's
 * width follows its text, so it is set inline.
 *
 * DS gap: there is no Skeleton; the lines take the board's loading look.
 */
function Skeleton({ source, label }: { source: string; label: string }): React.JSX.Element {
  const small = source.length > 50
  const perLine = small ? 100 : 70
  const lines = source.split('\n').slice(0, 50)
  return (
    <div
      role="status"
      aria-label={label}
      className={cn('flex min-h-72 flex-1 flex-col gap-3 overflow-hidden', BOARD_INSET)}
    >
      {lines.flatMap((line, lineIndex) => {
        const text = line.trim()
        if (!text) return [<div key={`${lineIndex}-empty`} className="h-5" />]
        const count = Math.max(1, Math.ceil(text.length / perLine))
        return Array.from({ length: count }, (_, index) => {
          const last = index === count - 1
          const width =
            count === 1
              ? Math.min(100, Math.max(20, (text.length / perLine) * 100))
              : last
                ? Math.max(30, ((text.length % perLine) / perLine) * 100) || 100
                : 100
          return (
            <div
              key={`${lineIndex}-${index}`}
              style={{ width: `${width}%` }}
              className={cn('h-4', BOARD_CLASSES.loading)}
            />
          )
        })
      })}
    </div>
  )
}
