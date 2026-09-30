import { CopyIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@ki4jlu/design-system'
import { toast } from '@/lib/toast'

interface CopyButtonProps {
  /** The text to copy; without it the button is disabled. */
  text: string | undefined
  /** Accessible name; "copy translation" by default. */
  label?: string
  className?: string
}

/** Copies the result to the clipboard; the toast confirms it. */
export function CopyButton({ text, label, className }: CopyButtonProps): React.JSX.Element {
  const { t } = useTranslation()
  const name = label ?? t('component.translator.copy')

  const copy = async (): Promise<void> => {
    if (!text) return
    try {
      await navigator.clipboard.writeText(text)
      toast({ variant: 'success', title: t('component.translator.copied') })
    } catch {
      toast({ variant: 'error', title: t('component.translator.copyFailed') })
    }
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      disabled={!text}
      aria-label={name}
      title={name}
      onClick={() => void copy()}
      className={className}
    >
      <CopyIcon aria-hidden="true" className="size-4" />
    </Button>
  )
}
