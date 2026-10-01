import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react'
import { ArrowLeftToLineIcon, Undo2Icon, WandSparklesIcon, XIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button, MenuItem, Spinner } from '@ki4jlu/design-system'
import { cn } from '@/lib/utils'
import { IconAction } from './copy-button'
import { diffWords } from './diff'
import { sentenceTokens } from './sentences'
import type { SuggestionTarget, TranslatorStore } from './translator-store'

/** Where a sentence of the result was clicked, relative to the board. */
export interface MenuAnchor {
  index: number
  /** The clicked word, if the click hit one. */
  tokenIndex: number | null
  word: string | null
  /** Whether the sentence came from the source; the user's own ones can go into it. */
  hasSource: boolean
  top: number
  bottom: number
  left: number
}

interface SentenceMenuProps {
  store: TranslatorStore
  anchor: MenuAnchor
  containerRef: RefObject<HTMLDivElement | null>
  onClose: () => void
}

/**
 * The menu over a clicked sentence of the result: undo the user's change of it, move a sentence
 * of their own into the source, ask for other wordings of the sentence or other words for the
 * clicked word. Suggestions open below it; picking one puts it in.
 */
export function SentenceMenu({
  store,
  anchor,
  containerRef,
  onClose
}: SentenceMenuProps): React.JSX.Element {
  const { t } = useTranslation()
  const menu = useRef<HTMLDivElement>(null)
  const list = useRef<HTMLDivElement>(null)
  const [kind, setKind] = useState<SuggestionTarget['kind'] | null>(null)
  const [suggestions, setSuggestions] = useState<string[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [failed, setFailed] = useState(false)
  const [size, setSize] = useState({ menu: 42, container: 0 })
  const request = useRef<AbortController | null>(null)
  // Whether there is a change to undo, as the menu opened: HAWKI does not look again on undoing.
  const [changed] = useState(() => store.isSentenceChanged(anchor.index))

  useLayoutEffect(() => {
    setSize({
      menu: menu.current?.offsetHeight ?? 42,
      container: containerRef.current?.offsetHeight ?? 0
    })
  }, [containerRef])

  // Closes on a click anywhere else; as in HAWKI, Escape leaves it open and "Schließen" closes
  // it. The latest `onClose` is used, so the listener (and a request on its way) outlive the
  // parent's renders.
  const close = useRef(onClose)
  useEffect(() => {
    close.current = onClose
  })
  useEffect(() => {
    const onPointer = (event: PointerEvent): void => {
      const target = event.target as Node
      if (menu.current?.contains(target) || list.current?.contains(target)) return
      if ((target as HTMLElement).closest?.('.sentence-item')) return
      close.current()
    }
    document.addEventListener('pointerdown', onPointer)
    return () => document.removeEventListener('pointerdown', onPointer)
  }, [])
  useEffect(() => () => request.current?.abort(), [])

  const target = (which: SuggestionTarget['kind']): SuggestionTarget => ({
    index: anchor.index,
    tokenIndex: anchor.tokenIndex,
    kind: which
  })

  const load = async (which: SuggestionTarget['kind'], more = false): Promise<void> => {
    setKind(which)
    setFailed(false)
    const cached = more ? undefined : store.cachedSuggestions(target(which))
    if (cached) {
      setSuggestions(cached)
      return
    }
    request.current?.abort()
    const controller = new AbortController()
    request.current = controller
    setLoading(true)
    if (!more) setSuggestions(null)
    try {
      const next = await store.loadSuggestions(target(which), more, controller.signal)
      if (!controller.signal.aborted) setSuggestions(next)
    } catch {
      if (!controller.signal.aborted) setFailed(true)
    } finally {
      if (request.current === controller) setLoading(false)
    }
  }

  const apply = (text: string): void => {
    if (!kind) return
    const which = target(kind)
    onClose()
    void store.applySuggestion(which, text)
  }

  const height = size.menu
  // Above the sentence, over the language bar if need be; below it where even that is short.
  const above = anchor.top - height - 12
  const top =
    above >= -48 ? above : Math.min(anchor.bottom + 8, Math.max(0, size.container - height))
  const original = kind ? store.suggestionOriginal(target(kind)) : ''
  const options = suggestions?.filter((suggestion) => suggestion && suggestion !== original) ?? []

  return (
    <>
      <div
        ref={menu}
        role="toolbar"
        aria-label={t('component.translator.sentence.menu')}
        style={{ top, left: anchor.left }}
        className="absolute z-20 flex items-center gap-0.5 rounded-xl border border-outline-variant bg-surface-container-lowest p-1 shadow-overlay"
      >
        {anchor.hasSource ? (
          <IconAction
            label={t('component.translator.sentence.undo')}
            // Without a change HAWKI only shuts the mouse out: the button looks disabled but stays
            // in the tab order, and the keys still put the sentence back (to what it is).
            className={changed ? undefined : 'pointer-events-none opacity-60'}
            // As in HAWKI the menu stays open over the sentence put back.
            onClick={() => store.undoSentence(anchor.index)}
          >
            <Undo2Icon aria-hidden="true" className="size-4" />
          </IconAction>
        ) : (
          <IconAction
            label={t('component.translator.sentence.pushToSource')}
            onClick={() => {
              onClose()
              void store.pushToSource(anchor.index)
            }}
          >
            <ArrowLeftToLineIcon aria-hidden="true" className="size-4" />
          </IconAction>
        )}
        <Separator />
        <Button
          type="button"
          variant={kind === 'sentence' ? 'secondary' : 'ghost'}
          size="sm"
          aria-pressed={kind === 'sentence'}
          onClick={() => void load('sentence')}
        >
          {t('component.translator.sentence.rephrase')}
        </Button>
        <Separator />
        <Button
          type="button"
          variant={kind === 'word' ? 'secondary' : 'ghost'}
          size="sm"
          aria-pressed={kind === 'word'}
          disabled={anchor.tokenIndex === null}
          onClick={() => void load('word')}
        >
          {t('component.translator.sentence.replaceWord')}
        </Button>
        <Separator />
        <IconAction label={t('component.translator.sentence.close')} onClick={onClose}>
          <XIcon aria-hidden="true" className="size-4" />
        </IconAction>
      </div>
      {kind ? (
        <div
          ref={list}
          role="listbox"
          aria-label={t(
            kind === 'word'
              ? 'component.translator.sentence.words'
              : 'component.translator.sentence.alternatives'
          )}
          aria-busy={loading}
          style={{ top: top + height + 4, left: anchor.left }}
          className="absolute z-20 flex w-[min(32rem,calc(100%-2rem))] flex-col overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest py-1 shadow-overlay"
        >
          <Proposal
            text={original}
            kind={kind}
            store={store}
            anchor={anchor}
            original
            onPick={() => apply(original)}
          />
          {options.map((option) => (
            <Proposal
              key={option}
              text={option}
              compareTo={original}
              kind={kind}
              store={store}
              anchor={anchor}
              onPick={() => apply(option)}
            />
          ))}
          {loading ? (
            <div className="flex items-center gap-2 px-4 py-3 text-sm text-on-surface-variant">
              <Spinner size="sm" />
              <span className="animate-pulse rounded-sm bg-surface-container-high text-transparent">
                {original || '...'}
              </span>
            </div>
          ) : failed ? (
            <p role="alert" className="m-0 px-4 py-3 text-sm text-error">
              {t('component.translator.sentence.failed')}
            </p>
          ) : (
            <MenuItem type="button" onClick={() => void load(kind, true)}>
              <WandSparklesIcon aria-hidden="true" className="size-4" />
              <span>{t('component.translator.sentence.more')}</span>
            </MenuItem>
          )}
        </div>
      ) : null}
    </>
  )
}

function Separator(): React.JSX.Element {
  return <span aria-hidden="true" className="mx-0.5 h-5 w-px bg-outline-variant" />
}

/**
 * One suggestion: a sentence with its new words highlighted, or the word in its context with the
 * new word in bold. The first one is the text as it is.
 */
function Proposal({
  text,
  compareTo,
  kind,
  store,
  anchor,
  original,
  onPick
}: {
  text: string
  compareTo?: string
  kind: SuggestionTarget['kind']
  store: TranslatorStore
  anchor: MenuAnchor
  original?: boolean
  onPick: () => void
}): React.JSX.Element {
  let content: React.ReactNode
  // Cut contexts are marked with three dots, as in HAWKI.
  if (kind === 'word' && anchor.tokenIndex !== null) {
    const tokens = sentenceTokens(store.buffer.targetSentences[anchor.index] ?? '')
    const from = Math.max(0, anchor.tokenIndex - 2)
    const to = Math.min(tokens.length, anchor.tokenIndex + 3)
    content = (
      <>
        {'„'}
        {from > 0 ? '...' : null}
        {tokens
          .slice(from, to)
          .map((token, index) =>
            from + index === anchor.tokenIndex ? <b key={index}>{text}</b> : token
          )}
        {to < tokens.length ? '...' : null}
        {'“'}
      </>
    )
  } else if (compareTo !== undefined && compareTo !== text) {
    content = diffWords(compareTo, text)
      .filter((part) => part.type !== 'delete')
      .map((part, index) =>
        part.type === 'insert' ? (
          <span key={index} className="rounded-sm bg-success-container text-on-success-container">
            {part.text}
          </span>
        ) : (
          part.text
        )
      )
  } else {
    content = `„${text.trim()}“`
  }
  return (
    <MenuItem
      type="button"
      role="option"
      aria-selected={false}
      onClick={onPick}
      className={cn('whitespace-normal', original && 'border-b border-outline-variant')}
    >
      <span className={cn('block', original && 'text-on-surface-variant')}>{content}</span>
    </MenuItem>
  )
}
