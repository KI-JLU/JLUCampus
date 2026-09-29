import { ComponentIcon } from '@/components/component-icon'
import { FeedPanel } from '@/components/feed-panel'
import type { ComponentViewProps } from '../types'

/** The feed's newest entries; the title opens the component's page with the summaries. */
export function RssTile({ component }: ComponentViewProps<'rss'>): React.JSX.Element {
  return (
    <FeedPanel
      feedUrl={component.config.feedUrl}
      title={component.name}
      icon={<ComponentIcon icon={component.icon} iconUrl={component.iconUrl} />}
      pageComponentId={component.id}
    />
  )
}
