import { useEffect } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { DEFAULT_LANGUAGE, isAppPath, languageSchema, type Component } from '@justcampus/shared'
import { desktopBridge } from './bridge'
import { availableDesktopModules } from './registry'

/**
 * The desktop app's side of the signed-in frame: runs each module's service, follows the paths
 * the app asks to show (links, notifications, the tray menu), and tells it the interface
 * language. Renders nothing, and does nothing without the desktop app.
 */
export function DesktopServices({
  sidebarComponents
}: {
  sidebarComponents: Component[]
}): React.JSX.Element | null {
  const bridge = desktopBridge()
  const navigate = useNavigate()
  const { i18n } = useTranslation()
  const parsed = languageSchema.safeParse(i18n.resolvedLanguage)
  const language = parsed.success ? parsed.data : DEFAULT_LANGUAGE

  useEffect(() => {
    if (!bridge) return
    return bridge.onNavigate((path) => {
      if (isAppPath(path)) void navigate({ href: path })
    })
  }, [bridge, navigate])

  useEffect(() => {
    bridge?.setLanguage(language)
  }, [bridge, language])

  if (!bridge) return null
  return (
    <>
      {availableDesktopModules(bridge).map(({ view, bridge: moduleBridge }) =>
        view.Service ? (
          <view.Service key={view.id} bridge={moduleBridge} components={sidebarComponents} />
        ) : null
      )}
    </>
  )
}
