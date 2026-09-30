import {
  DESKTOP_LINK_SCHEME,
  desktopLinkFor,
  isAppPath,
  type DesktopSystemSettings
} from '@justcampus/shared'
import { app, clipboard } from 'electron'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import type { DesktopMainModule } from './types'
import { linuxAutostartContent } from './system-utils'

const autostartFile = join(homedir(), '.config/autostart/de.uni-giessen.campus.desktop')

async function autostart(): Promise<boolean> {
  if (process.platform !== 'linux') return app.getLoginItemSettings().openAtLogin
  try {
    await readFile(autostartFile)
    return true
  } catch {
    return false
  }
}

export const systemModule: DesktopMainModule<'system'> = {
  id: 'system',
  setup(context) {
    const settings = async (): Promise<DesktopSystemSettings> => ({
      autostart: await autostart(),
      autostartSupported: app.isPackaged,
      linkHandler: app.isDefaultProtocolClient(DESKTOP_LINK_SCHEME)
    })
    context.handle('getSettings', settings)
    context.handle('setAutostart', async (rawEnabled) => {
      if (typeof rawEnabled !== 'boolean') throw new Error('Expected a boolean')
      if (!app.isPackaged) throw new Error('Autostart is unavailable in development')
      if (process.platform === 'linux') {
        if (rawEnabled) {
          await mkdir(join(homedir(), '.config/autostart'), { recursive: true })
          await writeFile(
            autostartFile,
            linuxAutostartContent(process.env.APPIMAGE ?? process.execPath)
          )
        } else await rm(autostartFile, { force: true })
      } else app.setLoginItemSettings({ openAtLogin: rawEnabled, args: ['--autostart'] })
      return settings()
    })
    context.handle('copyLink', (rawPath) => {
      if (typeof rawPath !== 'string' || !isAppPath(rawPath)) throw new Error('Invalid app path')
      const link = desktopLinkFor(rawPath)
      clipboard.writeText(link)
      return link
    })
  }
}
