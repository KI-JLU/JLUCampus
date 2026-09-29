import { describe, expect, it } from 'vitest'
import type { DesktopBridge, DesktopModuleBridges } from '@justcampus/shared'
import { availableDesktopModules, desktopModuleSettings } from './registry'

function bridgeWith(modules: Partial<DesktopModuleBridges>): DesktopBridge {
  return {
    platform: 'electron',
    os: 'linux',
    apiUrl: 'https://campus.example.org',
    openExternal: async () => {},
    modules,
    onNavigate: () => () => {},
    setLanguage: () => {}
  }
}

// The registry only passes the bridges on; their methods are never called here.
const files = {} as DesktopModuleBridges['files']
const notifications = {} as DesktopModuleBridges['notifications']
const system = {} as DesktopModuleBridges['system']

describe('availableDesktopModules', () => {
  it('offers nothing without the desktop app', () => {
    expect(availableDesktopModules(undefined)).toEqual([])
    expect(desktopModuleSettings(undefined)).toEqual([])
  })

  it('offers nothing when the desktop app has no modules', () => {
    expect(availableDesktopModules(bridgeWith({}))).toEqual([])
  })

  it('offers only the modules the bridge has, each with its own bridge', () => {
    const available = availableDesktopModules(bridgeWith({ notifications }))
    expect(available.map(({ view }) => view.id)).toEqual(['notifications'])
    expect(available[0]?.bridge).toBe(notifications)
  })

  it('leaves out modules drawn elsewhere: the files page is a desktop component', () => {
    const available = availableDesktopModules(bridgeWith({ files, system }))
    expect(available.map(({ view }) => view.id)).toEqual(['system'])
    expect(available[0]?.bridge).toBe(system)
  })

  it('lists the settings of the available modules only', () => {
    const bridge = bridgeWith({ files, system })
    expect(desktopModuleSettings(bridge).map(({ view }) => view.id)).toEqual(['system'])
  })
})
