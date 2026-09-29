import { afterEach, describe, expect, it, vi } from 'vitest'
import type { DesktopBridge, DesktopModuleBridges } from '@justcampus/shared'
import { isAvailableHere } from './registry'

function stubDesktopApp(modules: Partial<DesktopModuleBridges>): void {
  const bridge: DesktopBridge = {
    platform: 'electron',
    os: 'windows',
    apiUrl: 'https://campus.example.org',
    openExternal: async () => {},
    modules,
    onNavigate: () => () => {},
    setLanguage: () => {}
  }
  vi.stubGlobal('window', { justCampus: bridge })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('isAvailableHere', () => {
  it('offers every ordinary component everywhere', () => {
    expect(isAvailableHere('rss')).toBe(true)
    expect(isAvailableHere('translator')).toBe(true)
  })

  it('hides desktop components outside the desktop app', () => {
    expect(isAvailableHere('files')).toBe(false)
  })

  it('shows a desktop component where the desktop app offers its module', () => {
    stubDesktopApp({ files: {} as DesktopModuleBridges['files'] })
    expect(isAvailableHere('files')).toBe(true)
  })

  it('hides it in a desktop app without that module', () => {
    stubDesktopApp({})
    expect(isAvailableHere('files')).toBe(false)
  })
})
