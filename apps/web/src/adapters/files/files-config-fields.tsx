import { useTranslation } from 'react-i18next'

/** A desktop component has nothing to configure here: each device sets it up in the app. */
export function FilesConfigFields(): React.JSX.Element {
  const { t } = useTranslation()
  return <p className="m-0 text-sm text-on-surface-variant">{t('component.files.configNote')}</p>
}
