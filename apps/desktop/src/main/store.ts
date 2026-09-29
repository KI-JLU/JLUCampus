import type { DesktopNotificationSettings } from '@justcampus/shared'
import { app } from 'electron'
import { randomUUID } from 'node:crypto'
import { readFile, rename, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

export interface StoredPlace {
  id: string
  kind: 'folder' | 'network'
  name: string
  path?: string
  address?: string
}

export interface DesktopSettings {
  notifications: DesktopNotificationSettings
  files: { places: StoredPlace[] }
}

/** Reads known settings and fills missing or invalid values with defaults. */
export function parseSettings(input: unknown): DesktopSettings {
  const value = input && typeof input === 'object' ? (input as Record<string, unknown>) : {}
  const notifications =
    value.notifications && typeof value.notifications === 'object'
      ? (value.notifications as Record<string, unknown>)
      : {}
  const files =
    value.files && typeof value.files === 'object' ? (value.files as Record<string, unknown>) : {}
  const places = Array.isArray(files.places) ? files.places : []
  return {
    notifications: {
      enabled: typeof notifications.enabled === 'boolean' ? notifications.enabled : true,
      closeToTray: typeof notifications.closeToTray === 'boolean' ? notifications.closeToTray : true
    },
    files: {
      places: places.filter((place): place is StoredPlace => {
        if (!place || typeof place !== 'object') return false
        const item = place as Record<string, unknown>
        return (
          typeof item.id === 'string' &&
          typeof item.name === 'string' &&
          ((item.kind === 'folder' && typeof item.path === 'string') ||
            (item.kind === 'network' && typeof item.address === 'string'))
        )
      })
    }
  }
}

export class DesktopStore {
  private settings: DesktopSettings = parseSettings(null)
  private get path(): string {
    return join(app.getPath('userData'), 'desktop-settings.json')
  }
  private pending: Promise<void> = Promise.resolve()

  async load(): Promise<void> {
    try {
      this.settings = parseSettings(JSON.parse(await readFile(this.path, 'utf8')))
    } catch {
      this.settings = parseSettings(null)
    }
  }

  get(): DesktopSettings {
    return structuredClone(this.settings)
  }

  async update(change: (settings: DesktopSettings) => void): Promise<void> {
    this.pending = this.pending
      .catch(() => {})
      .then(async () => {
        const next = this.get()
        change(next)
        const temporary = `${this.path}.${randomUUID()}.tmp`
        try {
          await writeFile(temporary, JSON.stringify(next, null, 2), { mode: 0o600 })
          await rename(temporary, this.path)
          this.settings = next
        } catch (error) {
          const { rm } = await import('node:fs/promises')
          await rm(temporary, { force: true })
          throw error
        }
      })
    return this.pending
  }
}
