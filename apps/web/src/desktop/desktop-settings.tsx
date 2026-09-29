import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import type { AvailableDesktopModule } from './registry'

const ICON = { 'aria-hidden': true, width: '1em', height: '1em' } as const

/** The settings dialog's "Desktop app" section: each module's settings under its name. */
export function DesktopSettings({
  modules
}: {
  /** The available modules with settings. */
  modules: AvailableDesktopModule[]
}): React.JSX.Element {
  return (
    <div className="flex flex-col gap-stack-md">
      {modules.map((module) => (
        <DesktopModuleSettings key={module.view.id} module={module} />
      ))}
    </div>
  )
}

function DesktopModuleSettings({
  module: { view, bridge }
}: {
  module: AvailableDesktopModule
}): React.JSX.Element | null {
  const { t } = useTranslation()
  const headingId = useId()
  const { Settings, icon: Icon } = view
  if (!Settings) return null
  return (
    <section aria-labelledby={headingId} className="flex flex-col pt-5">
      <h3
        id={headingId}
        className="m-0 flex items-center gap-2 text-sm font-semibold text-on-surface-variant"
      >
        <Icon {...ICON} />
        {t(`desktop.${view.id}.name`)}
      </h3>
      <Settings bridge={bridge} />
    </section>
  )
}
