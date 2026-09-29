import { useTranslation } from 'react-i18next'
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport
} from '@ki4jlu/design-system'
import { dismissToast, useToasts } from '@/lib/toast'

/** The one toast viewport of the app; messages come from `toast()` in lib/toast. */
export function Toaster(): React.JSX.Element {
  const { t } = useTranslation()
  const toasts = useToasts()
  return (
    <ToastProvider label={t('toast.label')}>
      {toasts.map((item) => (
        <Toast
          key={item.id}
          variant={item.variant}
          onOpenChange={(open) => {
            if (!open) dismissToast(item.id)
          }}
        >
          <ToastTitle>{item.title}</ToastTitle>
          {item.description ? <ToastDescription>{item.description}</ToastDescription> : null}
          <ToastClose aria-label={t('common.close')} />
        </Toast>
      ))}
      <ToastViewport label={t('toast.viewport')} />
    </ToastProvider>
  )
}
