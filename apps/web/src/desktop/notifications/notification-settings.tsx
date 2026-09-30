import { useId } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Button, SettingsRow, Switch } from '@ki4jlu/design-system'
import type { DesktopNotificationSettings } from '@justcampus/shared'
import { toast } from '@/lib/toast'
import type { DesktopModuleProps } from '../types'

const SETTINGS_KEY = ['desktop', 'notifications', 'settings'] as const

/** Feed notifications on or off, running on in the tray, and a test notification. */
export function NotificationSettings({
  bridge
}: DesktopModuleProps<'notifications'>): React.JSX.Element {
  const { t } = useTranslation()
  const client = useQueryClient()
  const enabledId = useId()
  const trayId = useId()
  const { data: settings, isError } = useQuery({
    queryKey: SETTINGS_KEY,
    queryFn: () => bridge.getSettings(),
    // The desktop app answers locally; a second try would not answer differently.
    retry: false
  })
  // Switches move at once; a failed change puts them back.
  const { mutate: update } = useMutation({
    mutationFn: (patch: Partial<DesktopNotificationSettings>) => bridge.setSettings(patch),
    onMutate: async (patch) => {
      await client.cancelQueries({ queryKey: SETTINGS_KEY })
      const previous = client.getQueryData<DesktopNotificationSettings>(SETTINGS_KEY)
      if (previous) client.setQueryData(SETTINGS_KEY, { ...previous, ...patch })
      return { previous }
    },
    onError: (_error, _patch, context) => {
      if (context?.previous) client.setQueryData(SETTINGS_KEY, context.previous)
      toast({ variant: 'error', title: t('desktop.settingsSaveFailed') })
    },
    onSuccess: (next) => client.setQueryData(SETTINGS_KEY, next)
  })

  const sendTest = async (): Promise<void> => {
    try {
      await bridge.show({
        title: 'JLU Campus',
        body: t('desktop.notifications.testBody'),
        path: '/'
      })
    } catch {
      toast({ variant: 'error', title: t('desktop.notifications.testFailed') })
    }
  }

  if (isError) {
    return <p className="m-0 py-5 text-sm text-error">{t('desktop.settingsLoadFailed')}</p>
  }

  return (
    <>
      <SettingsRow
        label={t('desktop.notifications.enabled')}
        description={t('desktop.notifications.enabledDescription')}
        labelId={enabledId}
        control={
          <Switch
            aria-labelledby={enabledId}
            checked={settings?.enabled ?? false}
            disabled={!settings}
            onCheckedChange={(enabled) => update({ enabled })}
          />
        }
      />
      <SettingsRow
        label={t('desktop.notifications.closeToTray')}
        description={t('desktop.notifications.closeToTrayDescription')}
        labelId={trayId}
        control={
          <Switch
            aria-labelledby={trayId}
            checked={settings?.closeToTray ?? false}
            disabled={!settings}
            onCheckedChange={(closeToTray) => update({ closeToTray })}
          />
        }
      />
      <SettingsRow
        label={t('desktop.notifications.test')}
        description={t(
          settings?.enabled === false
            ? 'desktop.notifications.testOff'
            : 'desktop.notifications.testDescription'
        )}
        control={
          <Button
            variant="outline"
            size="sm"
            disabled={!settings?.enabled}
            onClick={() => void sendTest()}
          >
            {t('desktop.notifications.sendTest')}
          </Button>
        }
      />
    </>
  )
}
