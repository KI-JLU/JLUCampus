import { iconNames } from 'lucide-react/dynamic'

export type IconName = (typeof iconNames)[number]

const KNOWN_ICONS = new Set<string>(iconNames)

export function isIconName(name: string): name is IconName {
  return KNOWN_ICONS.has(name)
}

/** Every Lucide icon name, alphabetical, for the icon picker. */
export const ALL_ICON_NAMES: readonly IconName[] = [...iconNames].sort()
