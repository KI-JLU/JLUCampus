import type { ComponentType as ReactComponentType } from 'react'
import type { LucideIcon } from 'lucide-react'
import type { Component, DesktopModuleBridges, DesktopModuleId } from '@justcampus/shared'

export interface DesktopModuleProps<Id extends DesktopModuleId> {
  /** The module's API from the desktop app's preload. */
  bridge: DesktopModuleBridges[Id]
}

export interface DesktopServiceProps<Id extends DesktopModuleId> extends DesktopModuleProps<Id> {
  /** The user's sidebar components, in their order. */
  components: Component[]
}

/**
 * How the web app draws one desktop module (see `DESKTOP_MODULE_IDS`). Its name is the i18n key
 * `desktop.<id>.name`. A new module is a folder under `src/desktop/` plus one line in the registry;
 * the app shows it only where the desktop app's bridge offers it. A module's page is a desktop
 * component instead (see `DESKTOP_COMPONENT_TYPES` and the adapter's `desktopModule`).
 */
export interface DesktopModuleView<Id extends DesktopModuleId> {
  id: Id
  /** Beside the module's name in the sidebar and in the settings. */
  icon: LucideIcon
  /** A block in the settings dialog's "Desktop app" section. */
  Settings?: ReactComponentType<DesktopModuleProps<Id>>
  /** Runs in the background while the user is signed in; renders nothing visible. */
  Service?: ReactComponentType<DesktopServiceProps<Id>>
}
