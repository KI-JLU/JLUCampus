import type { DesktopModuleId } from '@justcampus/shared'
import type { DesktopMainModule } from './types'
import { notificationsModule } from './notifications'
import { filesModule } from './files'
import { systemModule } from './system'

/** Every shared desktop id needs a main-process implementation. */
export const modules = {
  notifications: notificationsModule,
  files: filesModule,
  system: systemModule
} satisfies { [Id in DesktopModuleId]: DesktopMainModule<Id> }
