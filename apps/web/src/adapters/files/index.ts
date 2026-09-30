import type { ComponentAdapter } from '../types'
import { FilesConfigFields } from './files-config-fields'
import { FilesPage } from './files-page'

/**
 * A desktop component (see `DESKTOP_COMPONENT_TYPES`): the page of the desktop app's files
 * module, listed only where the app offers that module. Built in, so it has no address.
 */
export const filesAdapter: ComponentAdapter<'files'> = {
  type: 'files',
  Page: FilesPage,
  ConfigFields: FilesConfigFields,
  defaultConfig: {},
  desktopModule: 'files',
  widgets: {}
}
