import type { ComponentType as ReactComponentType } from 'react'
import type { LucideIcon } from 'lucide-react'
import type {
  Component,
  DesktopBridge,
  DesktopModuleBridges,
  DesktopModuleId
} from '@justcampus/shared'
import { desktopBridge } from './bridge'
import { notificationsModule } from './notifications'
import { systemModule } from './system'
import type { DesktopModuleView } from './types'

/**
 * The modules with settings or a service of their own. `files` has neither: its page is a desktop
 * component (see `src/adapters/files/`).
 */
export type DrawnDesktopModuleId = Exclude<DesktopModuleId, 'files'>

export const desktopModules = {
  system: systemModule,
  notifications: notificationsModule
} satisfies { [Id in DrawnDesktopModuleId]: DesktopModuleView<Id> }

/** The order the settings list the modules in. */
const ORDER: DrawnDesktopModuleId[] = ['system', 'notifications']

type AnyDesktopModuleBridge = DesktopModuleBridges[DesktopModuleId]

/** A module seen through any id: its parts accept the bridge it was paired with. */
export interface AnyDesktopModuleView {
  id: DrawnDesktopModuleId
  icon: LucideIcon
  Settings?: ReactComponentType<{ bridge: AnyDesktopModuleBridge }>
  Service?: ReactComponentType<{ bridge: AnyDesktopModuleBridge; components: Component[] }>
}

/** A module the desktop app offers, with its API. */
export interface AvailableDesktopModule {
  view: AnyDesktopModuleView
  bridge: AnyDesktopModuleBridge
}

/**
 * The modules the desktop app offers, each with its API; none in a browser or the PWA.
 * TypeScript cannot tie `modules[id]` to `desktopModules[id]`, but both are keyed by id, so each
 * view always gets its own module's bridge. Modules without a view here (`files`) are left out.
 */
export function availableDesktopModules(
  bridge: DesktopBridge | undefined = desktopBridge()
): AvailableDesktopModule[] {
  if (!bridge) return []
  return ORDER.flatMap((id): AvailableDesktopModule[] => {
    const moduleBridge = bridge.modules[id]
    if (!moduleBridge) return []
    const view = desktopModules[id] as unknown as AnyDesktopModuleView
    return [{ view, bridge: moduleBridge }]
  })
}

/** The modules with settings, for the settings dialog's "Desktop app" section. */
export function desktopModuleSettings(
  bridge: DesktopBridge | undefined = desktopBridge()
): AvailableDesktopModule[] {
  return availableDesktopModules(bridge).filter((module) => module.view.Settings)
}
