import { describe, expect, it } from 'vitest'
import { parseSettings } from './store'

describe('parseSettings', () => {
  it('uses defaults for missing and invalid values', () => {
    expect(parseSettings(null)).toEqual({
      notifications: { enabled: true, closeToTray: true },
      files: { places: [] }
    })
    expect(
      parseSettings({ notifications: { enabled: false, closeToTray: 'no' }, files: { places: 3 } })
    ).toEqual({ notifications: { enabled: false, closeToTray: true }, files: { places: [] } })
  })

  it('keeps valid user places and drops malformed entries', () => {
    expect(
      parseSettings({
        files: {
          places: [
            { id: 'one', kind: 'folder', name: 'Work', path: '/work' },
            { id: 'two', kind: 'network', name: 'Files', address: '\\\\host\\share' },
            { id: 'three', kind: 'folder', name: 'Broken' }
          ]
        }
      }).files.places
    ).toHaveLength(2)
  })
})
