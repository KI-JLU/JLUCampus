import type { ComponentType as ReactComponentType } from 'react'
import type { Component, ComponentType, WidgetKey } from '@justcampus/shared'

export type ComponentOf<T extends ComponentType> = Extract<Component, { type: T }>
export type ComponentConfigOf<T extends ComponentType> = ComponentOf<T>['config']

export interface ComponentViewProps<T extends ComponentType> {
  component: ComponentOf<T>
}

export interface ComponentConfigFieldsProps<T extends ComponentType> {
  config: ComponentConfigOf<T>
  onChange: (config: ComponentConfigOf<T>) => void
  /** Validation messages keyed by the path inside `config`, e.g. `url`. */
  errors: Partial<Record<string, string>>
  /** Prefix for element ids, unique per form. */
  idPrefix: string
}

/** How one widget of a component type is drawn on the dashboard. */
export interface WidgetView<T extends ComponentType> {
  /** Body of a dashboard tile; fills the whole tile. */
  Tile: ReactComponentType<ComponentViewProps<T>>
}

/**
 * Everything the app needs to know about one component type. A new adapter is
 * a folder under `src/adapters/` plus one line in the registry.
 */
export interface ComponentAdapter<T extends ComponentType> {
  type: T
  /** The component's full page at `/c/$componentId`; fills the main area. */
  Page: ReactComponentType<ComponentViewProps<T>>
  /** The type-specific part of the admin form. */
  ConfigFields: ReactComponentType<ComponentConfigFieldsProps<T>>
  defaultConfig: ComponentConfigOf<T>
  /** The address the component shows, fetches or opens; the admin list displays it. */
  sourceUrl: (component: ComponentOf<T>) => string
  /**
   * Set for components that live outside the app (shortcuts): sidebar entries,
   * folder entries and tiles open this URL externally instead of `/c/$componentId`.
   */
  externalUrl?: (component: ComponentOf<T>) => string
  /**
   * Set for components that show a feed: their sidebar entry carries a marker while the feed has
   * entries newer than the user's last read.
   */
  feedUrl?: (component: ComponentOf<T>) => string
  /** A renderer for every widget the type offers (see `COMPONENT_WIDGETS`). */
  widgets: { [K in WidgetKey<T>]: WidgetView<T> }
}
