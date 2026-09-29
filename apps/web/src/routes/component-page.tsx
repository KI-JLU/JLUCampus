import { getRouteApi, Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { CloudOffIcon, SearchXIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@ki4jlu/design-system'
import { adapterOf } from '@/adapters/registry'
import { PageLoading, PageMessage } from '@/components/page-message'
import { componentsQuery } from '@/lib/queries'

const route = getRouteApi('/app/c/$componentId')

export function ComponentPage(): React.JSX.Element {
  const { t } = useTranslation()
  const { componentId } = route.useParams()
  const { data: components, isPending, isError, refetch } = useQuery(componentsQuery)

  if (isPending) return <PageLoading label={t('common.loading')} />
  if (isError) {
    return (
      <PageMessage
        icon={<CloudOffIcon />}
        title={t('component.loadFailedTitle')}
        description={t('component.loadFailedDescription')}
        actions={<Button onClick={() => void refetch()}>{t('common.retry')}</Button>}
      />
    )
  }

  const component = components.find((item) => item.id === componentId)
  if (!component) {
    return (
      <PageMessage
        icon={<SearchXIcon />}
        title={t('component.notFoundTitle')}
        description={t('component.notFoundDescription')}
        actions={
          <Button asChild>
            <Link to="/">{t('errors.toDashboard')}</Link>
          </Button>
        }
      />
    )
  }

  const adapter = adapterOf(component)
  return <adapter.Page key={component.id} component={component} />
}
