import { useEffect, useRef, useState } from 'react'
import { CopyIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button, Tooltip, TooltipContent, TooltipTrigger } from '@ki4jlu/design-system'
import { toast } from '@/lib/toast'

/** How long "Copied!" stays after copying. */
const COPIED_MS = 1500

interface CopyButtonProps {
  /**
   * The text to copy. Without it (or with an empty one and no `html`) the button is disabled,
   * unless `whenEmpty` says otherwise.
   */
  text: string | undefined
  /**
   * Without a text the button stays usable in HAWKI. `confirm`: it only says "Kopiert!",
   * leaving the clipboard as it is (the translator boards). `ignore`: it does nothing (the
   * editor). `copy`: it copies the empty text, emptying the clipboard (a code block).
   */
  whenEmpty?: 'disable' | 'confirm' | 'ignore' | 'copy'
  /** Rich text for targets that take it (Word, mail); `text` for the rest. */
  html?: string
  /** How long "Kopiert!" stays; 1.5 s by default. */
  copiedMs?: number
  /**
   * A fade after `copiedMs` at whose end HAWKI hides the reaction once more, even when a later
   * copy showed it again in between (the code block's 0.5 s).
   */
  fadeMs?: number
  /**
   * Says "Kopiert!" without waiting for the clipboard, also when it refuses the text, as HAWKI's
   * code block does (no failure notice then).
   */
  unchecked?: boolean
  /** Accessible name; "Kopieren" by default. */
  label?: string
  className?: string
}

/**
 * Copies a text to the clipboard. Its tooltip says "Kopieren" and, for a moment after a copy,
 * "Kopiert!", which screenreaders hear too.
 */
export function CopyButton({
  text,
  html,
  label,
  whenEmpty = 'disable',
  copiedMs = COPIED_MS,
  fadeMs,
  unchecked = false,
  className
}: CopyButtonProps): React.JSX.Element {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)
  const [hovered, setHovered] = useState(false)
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>())
  useEffect(() => {
    const pending = timers.current
    return () => {
      for (const timer of pending) clearTimeout(timer)
    }
  }, [])
  const name = label ?? t('component.translator.copy')
  const empty = text === undefined || (!text && !html)

  const hideAfter = (ms: number): void => {
    const timer = setTimeout(() => {
      timers.current.delete(timer)
      setCopied(false)
    }, ms)
    timers.current.add(timer)
  }

  // As in HAWKI every copy hides "Kopiert!" on its own timer, none is restarted: a second copy
  // does not keep it longer than the first one's time.
  const confirm = (): void => {
    setCopied(true)
    hideAfter(copiedMs)
    if (fadeMs !== undefined) hideAfter(copiedMs + fadeMs)
  }

  const copy = async (): Promise<void> => {
    if (empty && whenEmpty !== 'copy') {
      if (whenEmpty === 'confirm') confirm()
      return
    }
    if (unchecked) {
      navigator.clipboard.writeText(text ?? '').catch(() => undefined)
      confirm()
      return
    }
    try {
      if (html && typeof ClipboardItem !== 'undefined') {
        await navigator.clipboard.write([
          new ClipboardItem({
            'text/html': new Blob([html], { type: 'text/html' }),
            'text/plain': new Blob([text ?? ''], { type: 'text/plain' })
          })
        ])
      } else {
        await navigator.clipboard.writeText(text ?? '')
      }
      confirm()
    } catch {
      toast({ variant: 'error', title: t('component.translator.copyFailed') })
    }
  }

  return (
    <>
      <Tooltip open={copied || hovered} onOpenChange={setHovered}>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={empty && whenEmpty === 'disable'}
            aria-label={name}
            onClick={() => void copy()}
            className={className}
          >
            <CopyIcon aria-hidden="true" className="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{copied ? t('component.translator.copied') : name}</TooltipContent>
      </Tooltip>
      <span aria-live="polite" className="sr-only">
        {copied ? t('component.translator.copied') : ''}
      </span>
    </>
  )
}

/** An icon button with its name as a tooltip, as HAWKI's translator shows them. */
export function IconAction({
  label,
  onClick,
  disabled,
  expanded,
  controls,
  children,
  className
}: {
  label: string
  onClick: () => void
  disabled?: boolean
  /** For a button that opens and closes a region: whether it is open, and the region's id. */
  expanded?: boolean
  controls?: string
  children: React.ReactNode
  className?: string
}): React.JSX.Element {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={label}
          aria-expanded={expanded}
          aria-controls={controls}
          disabled={disabled}
          onClick={onClick}
          className={className}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}
