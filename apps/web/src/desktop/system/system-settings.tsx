import { useId } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Badge, SettingsRow, Switch } from '@ki4jlu/design-system'
import { DESKTOP_LINK_SCHEME, type DesktopSystemSettings } from '@justcampus/shared'
import { toast } from '@/lib/toast'
import type { DesktopModuleProps } from '../types'

const SETTINGS_KEY = ['desktop', 'system', 'settings'] as const

/** Starting with the computer, and whether `jlucampus://` links open this app. */
export function SystemSettings({ bridge }: DesktopModuleProps<'system'>): React.JSX.Element {
  const { t } = useTranslation()
  const client = useQueryClient()
  const autostartId = useId()
  const linksId = useId()
  const { data: settings, isError } = useQuery({
    queryKey: SETTINGS_KEY,
    queryFn: () => bridge.getSettings(),
    // The desktop app answers locally; a second try would not answer differently.
    retry: false
  })
  // The switch moves at once; a failed change puts it back.
  const { mutate: setAutostart } = useMutation({
    mutationFn: (enabled: boolean) => bridge.setAutostart(enabled),
    onMutate: async (autostart) => {
      await client.cancelQueries({ queryKey: SETTINGS_KEY })
      const previous = client.getQueryData<DesktopSystemSettings>(SETTINGS_KEY)
      if (previous) client.setQueryData(SETTINGS_KEY, { ...previous, autostart })
      return { previous }
    },
    onError: (_error, _enabled, context) => {
      if (context?.previous) client.setQueryData(SETTINGS_KEY, context.previous)
      toast({ variant: 'error', title: t('desktop.settingsSaveFailed') })
    },
    onSuccess: (next) => client.setQueryData(SETTINGS_KEY, next)
  })

  if (isError) {
    return <p className="m-0 py-5 text-sm text-error">{t('desktop.settingsLoadFailed')}</p>
  }

  const supported = settings?.autostartSupported ?? true
  return (
    <>
      <SettingsRow
        label={t('desktop.system.autostart')}
        description={t(
          supported ? 'desktop.system.autostartDescription' : 'desktop.system.autostartUnsupported'
        )}
        labelId={autostartId}
        control={
          <Switch
            aria-labelledby={autostartId}
            checked={settings?.autostart ?? false}
            disabled={!settings || !supported}
            onCheckedChange={(enabled) => setAutostart(enabled)}
          />
        }
      />
      <SettingsRow
        label={t('desktop.system.links', { scheme: DESKTOP_LINK_SCHEME })}
        description={t(
          settings?.linkHandler === false
            ? 'desktop.system.linksOffDescription'
            : 'desktop.system.linksDescription'
        )}
        labelId={linksId}
        control={
          settings ? (
            <Badge tone={settings.linkHandler ? 'success' : 'neutral'} appearance="filled">
              {t(settings.linkHandler ? 'desktop.system.yes' : 'desktop.system.no')}
            </Badge>
          ) : null
        }
      />
    </>
  )
}
