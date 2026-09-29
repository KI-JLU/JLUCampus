import type { ComponentAdapter } from '../types'
import { TranslatorConfigFields } from './translator-config-fields'
import { TranslatorPage } from './translator-page'
import { TranslatorTile } from './translator-tile'

/** A module (see `SINGLETON_COMPONENT_TYPES`): built into the app, so it has no address. */
export const translatorAdapter: ComponentAdapter<'translator'> = {
  type: 'translator',
  Page: TranslatorPage,
  ConfigFields: TranslatorConfigFields,
  defaultConfig: {
    defaultTargetLanguage: 'en',
    deeplApiUrl: null,
    llmBaseUrl: null,
    llmModels: [],
    defaultEngine: null
  },
  widgets: { quick: { Tile: TranslatorTile } }
}
