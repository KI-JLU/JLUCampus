import type { TFunction } from 'i18next'
import type { DesktopBridge, DesktopPlace } from '@justcampus/shared'

/** A file size in the given language: bytes, kilobytes or megabytes (powers of 1000). */
export function formatFileSize(bytes: number, language: string): string {
  const [value, unit] =
    bytes < 1000
      ? [bytes, 'byte']
      : bytes < 1_000_000
        ? [bytes / 1000, 'kilobyte']
        : [bytes / 1_000_000, 'megabyte']
  return new Intl.NumberFormat(language, {
    style: 'unit',
    unit,
    unitDisplay: 'short',
    maximumFractionDigits: value < 10 && unit !== 'byte' ? 1 : 0
  }).format(value)
}

/**
 * Standard folders are named by the app, in the interface language. The user named the rest, or
 * they go by the last part of where they point (the folder, the share).
 */
export function placeName(place: DesktopPlace, t: TFunction): string {
  switch (place.kind) {
    case 'downloads':
    case 'documents':
    case 'desktop':
      return t(`desktop.files.standard.${place.kind}`)
    default:
      return place.name || place.location.split(/[\\/]/).filter(Boolean).at(-1) || place.location
  }
}

/** Whether the user added the place, and so may remove it. */
export function isUserPlace(place: DesktopPlace): boolean {
  return place.kind === 'folder' || place.kind === 'network'
}

/** "Show in Explorer", "Show in Finder" or "Show in folder". */
export function showInFolderKey(
  os: DesktopBridge['os'] | undefined
): 'desktop.files.showInExplorer' | 'desktop.files.showInFinder' | 'desktop.files.showInFolder' {
  if (os === 'windows') return 'desktop.files.showInExplorer'
  if (os === 'macos') return 'desktop.files.showInFinder'
  return 'desktop.files.showInFolder'
}
