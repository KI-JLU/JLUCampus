import type { DesktopPlace, DesktopRecentFile } from '@justcampus/shared'
import { app, dialog, shell } from 'electron'
import { randomUUID } from 'node:crypto'
import { readdir, stat } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { connect } from 'node:net'
import type { StoredPlace } from '../store'
import type { DesktopMainModule } from './types'
import { isBlockedDownload, networkLocation, parseNetworkAddress } from './files-utils'

function string(value: unknown): string {
  if (typeof value !== 'string') throw new Error('Expected a string')
  return value
}

async function directoryExists(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isDirectory()
  } catch {
    return false
  }
}

function networkAvailable(host: string): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = connect({ host, port: 445 })
    let settled = false
    const finish = (available: boolean): void => {
      if (settled) return
      settled = true
      socket.destroy()
      resolve(available)
    }
    socket.setTimeout(1500)
    socket.once('connect', () => finish(true))
    socket.once('error', () => finish(false))
    socket.once('timeout', () => finish(false))
  })
}

async function openPath(path: string): Promise<void> {
  const error = await shell.openPath(path)
  if (error) throw new Error(error)
}

export const filesModule: DesktopMainModule<'files'> = {
  id: 'files',
  setup(context) {
    const recent = new Map<string, string>()
    const standard = (): { id: string; kind: DesktopPlace['kind']; location: string }[] =>
      (['downloads', 'documents', 'desktop'] as const).map((kind) => ({
        id: kind,
        kind,
        location: app.getPath(kind)
      }))
    const all = (): StoredPlace[] => context.store.get().files.places
    const placeFor = async (place: StoredPlace): Promise<DesktopPlace> => {
      if (place.kind === 'network') {
        const address = parseNetworkAddress(place.address ?? '')
        if (!address) throw new Error('Invalid network address')
        return {
          id: place.id,
          kind: 'network',
          name: place.name,
          location: networkLocation(address),
          available: await networkAvailable(address.host)
        }
      }
      const location = place.path ?? ''
      return {
        id: place.id,
        kind: 'folder',
        name: place.name,
        location,
        available: await directoryExists(location)
      }
    }
    const addFolder = async (path: string): Promise<DesktopPlace> => {
      if (!(await directoryExists(path))) throw new Error('Folder does not exist')
      const place: StoredPlace = { id: randomUUID(), kind: 'folder', name: basename(path), path }
      await context.store.update((settings) => {
        settings.files.places.push(place)
      })
      return placeFor(place)
    }

    context.handle('places', async () => {
      const builtIn = standard().map(async (place): Promise<DesktopPlace> => ({
        ...place,
        name: null,
        available: await directoryExists(place.location)
      }))
      return Promise.all([...builtIn, ...all().map(placeFor)])
    })
    context.handle('pickFolder', async () => {
      const window = context.window()
      if (!window) throw new Error('Window is unavailable')
      const result = await dialog.showOpenDialog(window, {
        properties: ['openDirectory', 'createDirectory']
      })
      return result.canceled ? null : addFolder(result.filePaths[0])
    })
    context.handle('add-path', (path) => addFolder(string(path)))
    context.handle('addNetwork', async (rawAddress, rawName) => {
      const address = parseNetworkAddress(string(rawAddress))
      if (!address) throw new Error('Invalid network address')
      const name = string(rawName).trim() || address.segments[0]
      if (name.length > 80) throw new Error('Name is too long')
      const place: StoredPlace = {
        id: randomUUID(),
        kind: 'network',
        name,
        address: networkLocation(address, 'win32')
      }
      await context.store.update((settings) => {
        settings.files.places.push(place)
      })
      return placeFor(place)
    })
    context.handle('remove', async (rawId) => {
      const id = string(rawId)
      await context.store.update((settings) => {
        const index = settings.files.places.findIndex((place) => place.id === id)
        if (index < 0) throw new Error('Unknown user place')
        settings.files.places.splice(index, 1)
      })
    })
    context.handle('open', async (rawId) => {
      const id = string(rawId)
      const builtIn = standard().find((place) => place.id === id)
      if (builtIn) return openPath(builtIn.location)
      const place = all().find((item) => item.id === id)
      if (!place) throw new Error('Unknown place')
      if (place.kind === 'folder') return openPath(place.path ?? '')
      const address = parseNetworkAddress(place.address ?? '')
      if (!address) throw new Error('Invalid network address')
      const location = networkLocation(address)
      return process.platform === 'win32' ? openPath(location) : shell.openExternal(location)
    })
    context.handle('recentDownloads', async (): Promise<DesktopRecentFile[]> => {
      recent.clear()
      const downloads = app.getPath('downloads')
      const entries = await readdir(downloads, { withFileTypes: true })
      const files = await Promise.all(
        entries
          .filter((entry) => !entry.name.startsWith('.'))
          .map(async (entry) => {
            if (!entry.isFile()) return null
            const path = join(downloads, entry.name)
            const info = await stat(path).catch(() => null)
            return info?.isFile() ? { path, name: entry.name, info } : null
          })
      )
      return files
        .filter((file): file is NonNullable<typeof file> => file !== null)
        .sort((a, b) => b.info.mtimeMs - a.info.mtimeMs)
        .slice(0, 8)
        .map((file) => {
          const id = randomUUID()
          recent.set(id, file.path)
          return {
            id,
            name: file.name,
            size: file.info.size,
            modifiedAt: file.info.mtime.toISOString(),
            openable: !isBlockedDownload(file.path)
          }
        })
    })
    context.handle('openFile', async (rawId) => {
      const path = recent.get(string(rawId))
      if (!path) throw new Error('Unknown recent file')
      if (isBlockedDownload(path)) throw new Error('This file type cannot be opened here')
      await openPath(path)
    })
    context.handle('showFile', (rawId) => {
      const path = recent.get(string(rawId))
      if (!path) throw new Error('Unknown recent file')
      shell.showItemInFolder(path)
    })
  }
}
