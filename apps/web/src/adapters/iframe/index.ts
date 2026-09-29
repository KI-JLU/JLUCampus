import type { ComponentAdapter } from '../types'
import { IframeConfigFields } from './iframe-config-fields'
import { IframePage } from './iframe-page'
import { IframeTile } from './iframe-tile'

export const iframeAdapter: ComponentAdapter<'iframe'> = {
  type: 'iframe',
  Page: IframePage,
  ConfigFields: IframeConfigFields,
  defaultConfig: { url: '' },
  sourceUrl: (component) => component.config.url,
  widgets: { launcher: { Tile: IframeTile } }
}
