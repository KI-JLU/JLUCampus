import type { DesktopBridge, DesktopModuleBridges, DesktopModuleId } from '@justcampus/shared'

/** The desktop app's preload API, or `undefined` in a browser or the PWA. */
export function desktopBridge(): DesktopBridge | undefined {
  return typeof window === 'undefined' ? undefined : window.justCampus
}

/** One desktop module's API, or `undefined` when this app (or build) does not offer it. */
export function desktopModule<Id extends DesktopModuleId>(
  id: Id,
  bridge: DesktopBridge | undefined = desktopBridge()
): DesktopModuleBridges[Id] | undefined {
  return bridge?.modules[id]
}
