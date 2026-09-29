import { contextBridge, ipcRenderer, webUtils } from 'electron'
import type { DesktopBridge } from '@justcampus/shared'

const apiUrl = process.argv
  .find((argument) => argument.startsWith('--justcampus-api-url='))
  ?.slice('--justcampus-api-url='.length)
if (!apiUrl) throw new Error('Desktop API URL was not provided by the main process')

const listeners = new Set<(path: string) => void>()
const pendingPaths: string[] = []
ipcRenderer.on('justcampus:navigate', (_event, path: unknown) => {
  if (typeof path !== 'string') return
  if (listeners.size === 0) pendingPaths.push(path)
  else for (const listener of listeners) listener(path)
})

const invoke = <T>(id: string, method: string, ...args: unknown[]): Promise<T> =>
  ipcRenderer.invoke(`justcampus:${id}:${method}`, ...args)

const bridge: DesktopBridge = {
  platform: 'electron',
  os: process.platform === 'win32' ? 'windows' : process.platform === 'darwin' ? 'macos' : 'linux',
  apiUrl,
  openExternal: (url) => ipcRenderer.invoke('justcampus:open-external', url),
  modules: {
    notifications: {
      getSettings: () => invoke('notifications', 'getSettings'),
      setSettings: (patch) => invoke('notifications', 'setSettings', patch),
      show: (notification) => invoke('notifications', 'show', notification),
      setUnreadCount: (count) => invoke('notifications', 'setUnreadCount', count)
    },
    files: {
      places: () => invoke('files', 'places'),
      recentDownloads: () => invoke('files', 'recentDownloads'),
      pickFolder: () => invoke('files', 'pickFolder'),
      addDropped: (file) => invoke('files', 'add-path', webUtils.getPathForFile(file)),
      addNetwork: (address, name) => invoke('files', 'addNetwork', address, name),
      remove: (id) => invoke('files', 'remove', id),
      open: (id) => invoke('files', 'open', id),
      openFile: (id) => invoke('files', 'openFile', id),
      showFile: (id) => invoke('files', 'showFile', id)
    },
    system: {
      getSettings: () => invoke('system', 'getSettings'),
      setAutostart: (enabled) => invoke('system', 'setAutostart', enabled),
      copyLink: (path) => invoke('system', 'copyLink', path)
    }
  },
  onNavigate: (listener) => {
    listeners.add(listener)
    for (const path of pendingPaths.splice(0)) listener(path)
    return () => {
      listeners.delete(listener)
    }
  },
  setLanguage: (language) => ipcRenderer.send('justcampus:set-language', language)
}
contextBridge.exposeInMainWorld('justCampus', bridge)
