import { ComponentIcon } from '@/components/component-icon'
import { ShortcutLink } from '@/components/shortcut-link'
import type { ComponentViewProps } from '../types'

/** A catalogue shortcut: the whole tile opens its URL outside the app. */
export function LinkTile({ component }: ComponentViewProps<'link'>): React.JSX.Element {
  const { url } = component.config
  return (
    <ShortcutLink
      url={url}
      title={component.name}
      icon={<ComponentIcon icon={component.icon} iconUrl={component.iconUrl} siteUrl={url} />}
    />
  )
}
