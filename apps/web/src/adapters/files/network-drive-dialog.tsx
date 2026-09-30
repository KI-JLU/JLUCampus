import { useId, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input
} from '@ki4jlu/design-system'
import type { DesktopBridge } from '@justcampus/shared'
import { Field } from '@/components/field'

interface NetworkDriveDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Addresses are written the way the operating system writes them. */
  os: DesktopBridge['os'] | undefined
  /** Adds the share; rejects when the desktop app refuses the address. */
  onConnect: (address: string, name: string) => Promise<void>
}

/**
 * Address and optional name of a network share. The desktop app checks the address; its refusal
 * shows at the field. Rendered only while open, so every opening starts empty.
 */
export function NetworkDriveDialog({
  open,
  onOpenChange,
  os,
  onConnect
}: NetworkDriveDialogProps): React.JSX.Element {
  const { t } = useTranslation()
  const formId = useId()
  const [address, setAddress] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState<string | undefined>()
  const [pending, setPending] = useState(false)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault()
    const trimmed = address.trim()
    if (!trimmed) {
      setError(t('desktop.files.network.addressRequired'))
      return
    }
    setPending(true)
    try {
      await onConnect(trimmed, name.trim())
      onOpenChange(false)
    } catch {
      setError(t('desktop.files.network.addressInvalid'))
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent closeLabel={t('common.close')} className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('desktop.files.network.title')}</DialogTitle>
          <DialogDescription>{t('desktop.files.network.description')}</DialogDescription>
        </DialogHeader>
        <form
          noValidate
          onSubmit={(event) => void handleSubmit(event)}
          className="flex flex-col gap-stack-md"
        >
          <Field
            id={`${formId}-address`}
            label={t('desktop.files.network.address')}
            hint={t('desktop.files.network.addressHint')}
            error={error}
          >
            {(control) => (
              <Input
                {...control}
                value={address}
                placeholder={t(
                  os === 'windows'
                    ? 'desktop.files.network.placeholderWindows'
                    : 'desktop.files.network.placeholder'
                )}
                autoComplete="off"
                spellCheck={false}
                required
                autoFocus
                onChange={(event) => {
                  setAddress(event.target.value)
                  setError(undefined)
                }}
              />
            )}
          </Field>
          <Field
            id={`${formId}-name`}
            label={t('desktop.files.network.name')}
            hint={t('desktop.files.network.nameHint')}
          >
            {(control) => (
              <Input
                {...control}
                value={name}
                autoComplete="off"
                onChange={(event) => setName(event.target.value)}
              />
            )}
          </Field>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary">
                {t('common.cancel')}
              </Button>
            </DialogClose>
            <Button type="submit" disabled={pending}>
              {t(pending ? 'desktop.files.network.connecting' : 'desktop.files.network.connect')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
