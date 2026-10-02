import { useEffect, useRef, useState } from 'react'
import { CheckIcon, ChevronDownIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@ki4jlu/design-system'
import type { TranslatorLanguage } from '@justcampus/shared'
import { languageOptions, type SourceLanguage } from './languages'

type LanguageMenuProps = {
  /** Names the menu for screenreaders, e.g. "Ausgangssprache". */
  label: string
  disabled?: boolean
  className?: string
} & (
  | {
      /** Offers "Automatisch" first. */
      allowAuto: true
      value: SourceLanguage
      onChange: (language: SourceLanguage) => void
    }
  | {
      allowAuto?: false
      value: TranslatorLanguage
      onChange: (language: TranslatorLanguage) => void
    }
)

/**
 * Opened, the menu leaves the focus where it is. Radix's menu content takes `onOpenAutoFocus`,
 * though the dropdown's types leave it out.
 */
const KEEP_FOCUS = { onOpenAutoFocus: (event: Event): void => event.preventDefault() }

/** What the Tab key can reach, in the order of the page. */
const TABBABLE =
  'a[href], button, input, select, textarea, [tabindex], [contenteditable]:not([contenteditable="false"])'

/** Focuses the first element the Tab key reaches after (or before) `anchor`, leaving out `skip`. */
function focusBeside(anchor: HTMLElement, forward: boolean, skip: Array<HTMLElement | null>): void {
  const reachable = [...document.querySelectorAll<HTMLElement>(TABBABLE)].filter(
    (element) =>
      element.tabIndex >= 0 &&
      !element.matches(':disabled') &&
      !element.closest('[inert]') &&
      element.getClientRects().length > 0 &&
      !skip.some((other) => other?.contains(element))
  )
  const side = forward ? Node.DOCUMENT_POSITION_FOLLOWING : Node.DOCUMENT_POSITION_PRECEDING
  const beside = reachable.filter((element) => anchor.compareDocumentPosition(element) & side)
  ;(forward ? beside[0] : beside[beside.length - 1])?.focus()
}

/**
 * A language of the translator's bar: its name with a chevron, opening the fixed list of
 * languages (no search, as in HAWKI). The chosen one is marked.
 *
 * HAWKI's list is a mouse-only div: it is not in the tab order, a click opens it and leaves the
 * focus on the page, its keys choose nothing, and only a choice or a click elsewhere (which still
 * reaches its target) closes it, not the focus leaving the window. The menu does the same. HAWKI's open list scrolls in the page
 * right after its trigger, so the Tab key stops on it there (its keys scroll it) before going on;
 * the menu's list lies at the end of the page, so a stop after the trigger hands the focus to it
 * and the Tab key goes on from the trigger.
 */
export function LanguageMenu(props: LanguageMenuProps): React.JSX.Element {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [hovered, setHovered] = useState<SourceLanguage | null>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const stop = useRef<HTMLSpanElement>(null)
  const content = useRef<HTMLDivElement>(null)
  const list = useRef<HTMLDivElement>(null)
  const options = languageOptions(t)
  const name =
    props.value === 'auto'
      ? t('component.translator.detect')
      : (options.find((option) => option.code === props.value)?.name ?? props.value)
  const items: Array<{ code: SourceLanguage; name: string }> = props.allowAuto
    ? [{ code: 'auto', name: t('component.translator.detect') }, ...options]
    : options

  // The open menu puts Radix's focus guards at both ends of the page, which the Tab key would stop
  // on. HAWKI's page has none: past its last element the Tab key leaves the page. The guards are
  // left out of the tab order while the list is open (the menu traps no focus).
  // The guards come with the (portaled) content after this effect, so they are watched for.
  useEffect(() => {
    if (!open) return
    const guards = new Set<HTMLElement>()
    const leaveOut = (): void => {
      for (const guard of document.querySelectorAll<HTMLElement>('[data-radix-focus-guard]')) {
        guard.tabIndex = -1
        guards.add(guard)
      }
    }
    leaveOut()
    const observer = new MutationObserver(leaveOut)
    observer.observe(document.body, { childList: true })
    return () => {
      observer.disconnect()
      for (const guard of guards) if (guard.isConnected) guard.tabIndex = 0
    }
  }, [open])

  return (
    <DropdownMenu
      modal={false}
      open={open}
      onOpenChange={(next) => {
        // Radix closes the menu when the window loses the focus (the Tab key past the page's end,
        // another window); HAWKI's list stays open then.
        if (!next && !document.hasFocus()) return
        setOpen(next)
        setHovered(null)
      }}
    >
      <DropdownMenuTrigger asChild disabled={props.disabled}>
        <Button
          ref={trigger}
          type="button"
          variant="ghost"
          tabIndex={-1}
          aria-label={`${props.label}: ${name}`}
          className={props.className}
          // A click on HAWKI's div takes the focus from where it was (e.g. the text) and does
          // not focus the div.
          onPointerDown={() => {
            if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
          }}
          onMouseDown={(event) => event.preventDefault()}
        >
          <span className="truncate">{name}</span>
          <ChevronDownIcon aria-hidden="true" className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      {open ? (
        <span ref={stop} tabIndex={0} className="sr-only" onFocus={() => list.current?.focus()} />
      ) : null}
      <DropdownMenuContent
        ref={content}
        aria-label={props.label}
        // The list is reached by the stop after the trigger only.
        tabIndex={-1}
        {...KEEP_FOCUS}
        onCloseAutoFocus={(event) => event.preventDefault()}
        onEscapeKeyDown={(event) => event.preventDefault()}
        onFocusOutside={(event) => event.preventDefault()}
        onKeyDownCapture={(event) => {
          event.stopPropagation()
          if (event.key === 'Tab') {
            event.preventDefault()
            if (event.target !== list.current && !event.shiftKey) list.current?.focus()
            else if (trigger.current) {
              focusBeside(trigger.current, !event.shiftKey, [stop.current, content.current])
            }
          } else if (event.target !== list.current) {
            // The keys choose nothing; on the list itself they scroll it.
            event.preventDefault()
          }
        }}
      >
        <div
          ref={list}
          role="group"
          // Out of the page's tab order (the menu lies at its end): only the stop focuses it.
          tabIndex={-1}
          className="max-h-[min(28rem,70vh)] overflow-y-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus-ring"
        >
          {items.map((item) => {
            const selected = item.code === props.value
            return (
              <DropdownMenuItem
                key={item.code}
                role="menuitemradio"
                aria-checked={selected}
                selected={selected}
                // The pointer only highlights an item, as on HAWKI's list: it takes no focus.
                data-highlighted={hovered === item.code ? '' : undefined}
                onPointerMove={(event) => {
                  event.preventDefault()
                  setHovered(item.code)
                }}
                onPointerLeave={(event) => {
                  event.preventDefault()
                  setHovered(null)
                }}
                onSelect={() => {
                  if (props.allowAuto) props.onChange(item.code)
                  else if (item.code !== 'auto') props.onChange(item.code)
                }}
              >
                <span className="flex-1">{item.name}</span>
                {selected ? <CheckIcon aria-hidden="true" className="size-4" /> : null}
              </DropdownMenuItem>
            )
          })}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
