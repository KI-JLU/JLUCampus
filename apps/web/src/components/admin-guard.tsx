import type { ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import { useSuspenseQuery } from '@tanstack/react-query'
import { ShieldAlertIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@ki4jlu/design-system'
import { meQuery } from '@/lib/queries'
import { PageMessage } from './page-message'

/**
 * Admin pages for admins only. The server guards the admin API on its own;
 * this spares everyone else a page of failing requests.
 */
export function AdminGuard({ children }: { children: ReactNode }): React.JSX.Element {
  const { t } = useTranslation()
  const { data: me } = useSuspenseQuery(meQuery)

  if (me.role !== 'admin') {
    return (
      <PageMessage
        icon={<ShieldAlertIcon />}
        title={t('admin.forbiddenTitle')}
        description={t('admin.forbiddenDescription')}
        actions={
          <Button asChild>
            <Link to="/">{t('errors.toDashboard')}</Link>
          </Button>
        }
      />
    )
  }
  return <>{children}</>
}
