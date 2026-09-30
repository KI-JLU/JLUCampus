import { getRouteApi, Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { CloudOffIcon, SearchXIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@ki4jlu/design-system'
import { adapterOf, isAvailableHere } from '@/adapters/registry'
import { PageLoading, PageMessage } from '@/components/page-message'
import { desktopModule } from '@/desktop/bridge'
import { CopyDesktopLinkButton } from '@/desktop/system/copy-desktop-link-button'
import { PageHeaderExtraActionsContext } from '@/lib/page-header-slots'
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

  // A desktop component outside the desktop app is not there, as far as the user can tell.
  const component = components.find((item) => item.id === componentId && isAvailableHere(item))
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
  // In the desktop app, every component page can hand out a link that opens it there.
  const extraActions = desktopModule('system') ? (
    <CopyDesktopLinkButton path={`/c/${component.id}`} />
  ) : null
  return (
    <PageHeaderExtraActionsContext.Provider value={extraActions}>
      <adapter.Page key={component.id} component={component} />
    </PageHeaderExtraActionsContext.Provider>
  )
}
