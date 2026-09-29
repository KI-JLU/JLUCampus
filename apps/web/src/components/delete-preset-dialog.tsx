import { useTranslation } from 'react-i18next'
import {
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@ki4jlu/design-system'
import type { LayoutPreset } from '@justcampus/shared'
import { useDeleteLayoutPreset } from '@/lib/queries'
import { toast } from '@/lib/toast'

interface DeletePresetDialogProps {
  /** The preset to delete; `null` closes the dialog. */
  preset: LayoutPreset | null
  onClose: () => void
  /** After the preset is gone, e.g. to leave its editor. */
  onDeleted?: () => void
}

export function DeletePresetDialog({
  preset,
  onClose,
  onDeleted
}: DeletePresetDialogProps): React.JSX.Element {
  const { t } = useTranslation()
  const remove = useDeleteLayoutPreset()

  const confirm = (): void => {
    if (!preset) return
    remove.mutate(preset.id, {
      onSuccess: () => {
        toast({ variant: 'success', title: t('admin.presets.delete.done', { name: preset.name }) })
        onClose()
        onDeleted?.()
      },
      onError: () => toast({ variant: 'error', title: t('admin.presets.delete.failed') })
    })
  }

  return (
    <Dialog open={preset !== null} onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent closeLabel={t('common.close')}>
        <DialogHeader>
          <DialogTitle>{t('admin.presets.delete.title')}</DialogTitle>
          <DialogDescription>
            {t('admin.presets.delete.description', { name: preset?.name ?? '' })}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="secondary">{t('common.cancel')}</Button>
          </DialogClose>
          <Button variant="destructive" disabled={remove.isPending} onClick={confirm}>
            {t('common.delete')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
