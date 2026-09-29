import { contextBridge, ipcRenderer } from 'electron'
import type { DesktopBridge } from '@justcampus/shared'

const apiUrl = process.argv
  .find((argument) => argument.startsWith('--justcampus-api-url='))
  ?.slice('--justcampus-api-url='.length)

if (!apiUrl) throw new Error('Desktop API URL was not provided by the main process')

const bridge: DesktopBridge = {
  platform: 'electron',
  apiUrl,
  openExternal: (url) => ipcRenderer.invoke('justcampus:open-external', url)
}

contextBridge.exposeInMainWorld('justCampus', bridge)
