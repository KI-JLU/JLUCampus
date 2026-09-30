import { MonitorCogIcon } from 'lucide-react'
import type { DesktopModuleView } from '../types'
import { SystemSettings } from './system-settings'

/** Autostart and `jlucampus://` links: settings only; component pages add "copy desktop link". */
export const systemModule: DesktopModuleView<'system'> = {
  id: 'system',
  icon: MonitorCogIcon,
  Settings: SystemSettings
}
