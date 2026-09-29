import type { ComponentAdapter } from '../types'
import { LinkConfigFields } from './link-config-fields'
import { LinkPage } from './link-page'
import { LinkTile } from './link-tile'

export const linkAdapter: ComponentAdapter<'link'> = {
  type: 'link',
  Page: LinkPage,
  ConfigFields: LinkConfigFields,
  defaultConfig: { url: '' },
  sourceUrl: (component) => component.config.url,
  externalUrl: (component) => component.config.url,
  widgets: { shortcut: { Tile: LinkTile } }
}
