import { BellIcon } from 'lucide-react'
import type { DesktopModuleView } from '../types'
import { FeedNotifier } from './feed-notifier'
import { NotificationSettings } from './notification-settings'

/** Tray and native notifications: settings, plus a service that watches the sidebar's feeds. */
export const notificationsModule: DesktopModuleView<'notifications'> = {
  id: 'notifications',
  icon: BellIcon,
  Settings: NotificationSettings,
  Service: FeedNotifier
}
