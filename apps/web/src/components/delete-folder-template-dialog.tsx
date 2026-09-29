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
import type { FolderTemplate } from '@justcampus/shared'
import { useDeleteFolderTemplate } from '@/lib/queries'
import { toast } from '@/lib/toast'

interface DeleteFolderTemplateDialogProps {
  /** The template to delete; `null` closes the dialog. */
  template: FolderTemplate | null
  onClose: () => void
}

export function DeleteFolderTemplateDialog({
  template,
  onClose
}: DeleteFolderTemplateDialogProps): React.JSX.Element {
  const { t } = useTranslation()
  const remove = useDeleteFolderTemplate()

  const confirm = (): void => {
    if (!template) return
    remove.mutate(template.id, {
      onSuccess: () => {
        toast({
          variant: 'success',
          title: t('admin.folders.delete.done', { name: template.name })
        })
        onClose()
      },
      onError: () => toast({ variant: 'error', title: t('admin.folders.delete.failed') })
    })
  }

  return (
    <Dialog open={template !== null} onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent closeLabel={t('common.close')}>
        <DialogHeader>
          <DialogTitle>{t('admin.folders.delete.title')}</DialogTitle>
          <DialogDescription>
            {t('admin.folders.delete.description', { name: template?.name ?? '' })}
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
