import { LinkIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@ki4jlu/design-system'
import { toast } from '@/lib/toast'
import { desktopModule } from '../bridge'

/**
 * Copies the `jlucampus://` link to an in-app path, which opens the desktop app there. Renders
 * nothing where the desktop app does not offer links (the browser, the PWA).
 */
export function CopyDesktopLinkButton({ path }: { path: string }): React.JSX.Element | null {
  const { t } = useTranslation()
  const system = desktopModule('system')
  if (!system) return null
  const label = t('desktop.system.copyLink')

  const copy = async (): Promise<void> => {
    try {
      await system.copyLink(path)
      toast({ variant: 'success', title: t('desktop.system.linkCopied') })
    } catch {
      toast({ variant: 'error', title: t('desktop.system.copyLinkFailed') })
    }
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={label}
      title={label}
      onClick={() => void copy()}
    >
      <LinkIcon aria-hidden="true" width="1em" height="1em" />
    </Button>
  )
}
