import { app, Menu, nativeImage, Notification, Tray } from 'electron'
import { isAppPath, type DesktopNotificationSettings } from '@justcampus/shared'
import icon from '../../../build/icon.png?asset'
import type { DesktopMainModule } from './types'

function booleanPatch(input: unknown): { enabled?: boolean; closeToTray?: boolean } {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    throw new Error('Invalid settings')
  const value = input as Record<string, unknown>
  if (Object.keys(value).some((key) => key !== 'enabled' && key !== 'closeToTray'))
    throw new Error('Invalid settings')
  if (value.enabled !== undefined && typeof value.enabled !== 'boolean')
    throw new Error('Invalid settings')
  if (value.closeToTray !== undefined && typeof value.closeToTray !== 'boolean')
    throw new Error('Invalid settings')
  return value as { enabled?: boolean; closeToTray?: boolean }
}

export const notificationsModule: DesktopMainModule<'notifications'> = {
  id: 'notifications',
  setup(context) {
    const image = nativeImage.createFromPath(icon)
    const tray = new Tray(image.resize({ width: process.platform === 'win32' ? 16 : 22 }))
    let unread = 0
    const settings = (): DesktopNotificationSettings => context.store.get().notifications
    const tooltip = (): void => tray.setToolTip(`JLU Campus${unread ? ` (${unread})` : ''}`)
    const menu = (): void => {
      tray.setContextMenu(
        Menu.buildFromTemplate([
          { label: context.t('open'), click: () => context.showWindow() },
          { label: context.t('dashboard'), click: () => context.navigate('/') },
          {
            label: context.t('notifications'),
            type: 'checkbox',
            checked: settings().enabled,
            click: (item) => {
              void context.store.update((value) => {
                value.notifications.enabled = item.checked
              })
            }
          },
          { type: 'separator' },
          { label: context.t('quit'), click: () => app.quit() }
        ])
      )
    }
    tooltip()
    menu()
    tray.on('click', () => context.showWindow())
    context.onLanguageChange(menu)
    context.handle('getSettings', () => settings())
    context.handle('setSettings', async (rawPatch) => {
      const patch = booleanPatch(rawPatch)
      await context.store.update((value) => {
        Object.assign(value.notifications, patch)
      })
      menu()
      return settings()
    })
    context.handle('show', (rawNotification) => {
      if (!rawNotification || typeof rawNotification !== 'object')
        throw new Error('Invalid notification')
      const value = rawNotification as Record<string, unknown>
      if (
        typeof value.title !== 'string' ||
        typeof value.body !== 'string' ||
        typeof value.path !== 'string' ||
        !isAppPath(value.path)
      )
        throw new Error('Invalid notification')
      if (!settings().enabled || !Notification.isSupported()) return
      const notification = new Notification({
        title: value.title.slice(0, 120),
        body: value.body.slice(0, 500),
        icon: image
      })
      notification.on('click', () => context.navigate(value.path as string))
      notification.show()
    })
    context.handle('setUnreadCount', (rawCount) => {
      if (!Number.isSafeInteger(rawCount) || (rawCount as number) < 0)
        throw new Error('Invalid count')
      unread = rawCount as number
      app.setBadgeCount(unread)
      tooltip()
    })
  }
}
