import type { DesktopModuleId } from '@justcampus/shared'
import type { BrowserWindow } from 'electron'
import type { TextKey } from '../i18n'
import type { DesktopStore } from '../store'

export interface ModuleContext<Id extends DesktopModuleId = DesktopModuleId> {
  handle(method: string, fn: (...args: unknown[]) => unknown): void
  store: DesktopStore
  window(): BrowserWindow | null
  showWindow(): void
  navigate(path: string): void
  t(key: TextKey): string
  onLanguageChange(listener: () => void): () => void
  id: Id
}

/** A desktop module owns its main-process handlers and renderer namespace. */
export interface DesktopMainModule<Id extends DesktopModuleId> {
  id: Id
  setup(context: ModuleContext<Id>): void
}
