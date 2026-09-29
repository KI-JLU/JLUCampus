import { createContext, type ReactNode } from 'react'

/**
 * Where `PageHeader` puts a page's title and actions: two elements in the
 * shell's top bar. Both are `null` below `lg`, where the bar shows the brand
 * instead and the page renders its own header.
 */
export interface PageHeaderSlots {
  title: HTMLElement | null
  actions: HTMLElement | null
}

export const PageHeaderSlotsContext = createContext<PageHeaderSlots>({
  title: null,
  actions: null
})

/**
 * Actions the route adds after a page's own in its `PageHeader`, e.g. "copy desktop link" on
 * component pages in the desktop app.
 */
export const PageHeaderExtraActionsContext = createContext<ReactNode>(null)
