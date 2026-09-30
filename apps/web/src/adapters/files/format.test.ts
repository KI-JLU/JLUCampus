import { describe, expect, it } from 'vitest'
import type { TFunction } from 'i18next'
import type { DesktopPlace } from '@justcampus/shared'
import { formatFileSize, placeName, showInFolderKey } from './format'

describe('formatFileSize', () => {
  it('picks bytes, kilobytes or megabytes', () => {
    expect(formatFileSize(512, 'en')).toBe('512 byte')
    expect(formatFileSize(1_500, 'en')).toBe('1.5 kB')
    expect(formatFileSize(250_000, 'en')).toBe('250 kB')
    expect(formatFileSize(12_345_678, 'de')).toBe('12 MB')
  })
})

describe('showInFolderKey', () => {
  it('names the file manager of the operating system', () => {
    expect(showInFolderKey('windows')).toBe('desktop.files.showInExplorer')
    expect(showInFolderKey('macos')).toBe('desktop.files.showInFinder')
    expect(showInFolderKey('linux')).toBe('desktop.files.showInFolder')
  })
})

describe('placeName', () => {
  const t = ((key: string) => key) as unknown as TFunction
  const place = (fields: Partial<DesktopPlace>): DesktopPlace => ({
    id: 'p',
    kind: 'folder',
    name: null,
    location: '/home/alice/Uni',
    available: true,
    ...fields
  })

  it('names standard folders in the interface language', () => {
    expect(placeName(place({ kind: 'downloads', location: '/home/alice/Downloads' }), t)).toBe(
      'desktop.files.standard.downloads'
    )
  })

  it('keeps the name the user gave', () => {
    expect(placeName(place({ name: 'Masterarbeit' }), t)).toBe('Masterarbeit')
  })

  it('falls back to the folder or share at the end of the location', () => {
    expect(placeName(place({}), t)).toBe('Uni')
    expect(placeName(place({ kind: 'network', location: '\\\\server\\institut\\' }), t)).toBe(
      'institut'
    )
    expect(placeName(place({ kind: 'network', location: 'smb://server/alice' }), t)).toBe('alice')
  })
})
