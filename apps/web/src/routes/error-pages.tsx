import { Link, useRouter, type ErrorComponentProps } from '@tanstack/react-router'
import { CloudOffIcon, SearchXIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@ki4jlu/design-system'
import { PageMessage } from '@/components/page-message'

export function NotFoundPage(): React.JSX.Element {
  const { t } = useTranslation()
  return (
    <PageMessage
      icon={<SearchXIcon />}
      title={t('errors.notFoundTitle')}
      description={t('errors.notFoundDescription')}
      actions={
        <Button asChild>
          <Link to="/">{t('errors.toDashboard')}</Link>
        </Button>
      }
    />
  )
}

/** The session could not be checked: the API is unreachable or failed. */
export function AppErrorPage({ reset }: ErrorComponentProps): React.JSX.Element {
  const { t } = useTranslation()
  const router = useRouter()
  return (
    <main className="flex min-h-dvh flex-col bg-surface">
      <PageMessage
        icon={<CloudOffIcon />}
        title={t('errors.unavailableTitle')}
        description={t('errors.unavailableDescription')}
        actions={
          <Button
            onClick={() => {
              reset()
              void router.invalidate()
            }}
          >
            {t('common.retry')}
          </Button>
        }
      />
    </main>
  )
}
