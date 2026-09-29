import type { ComponentAdapter } from '../types'
import { RssConfigFields } from './rss-config-fields'
import { RssPage } from './rss-page'
import { RssTile } from './rss-tile'

export const rssAdapter: ComponentAdapter<'rss'> = {
  type: 'rss',
  Page: RssPage,
  ConfigFields: RssConfigFields,
  defaultConfig: { feedUrl: '' },
  sourceUrl: (component) => component.config.feedUrl,
  feedUrl: (component) => component.config.feedUrl,
  widgets: { feed: { Tile: RssTile } }
}
