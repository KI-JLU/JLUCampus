import { createContext } from 'react'

/** From here up the shell shows a page's column on the right (`lg`). */
export const SIDE_PANEL_MEDIA = '(min-width: 64rem)'

/**
 * A column on the right of the shell that a page can fill, from `lg` up (see `PageSidePanel`).
 * The shell shows it only while a page has given it a label.
 */
export interface PageSidePanelSlot {
  /** The column's body; `null` while there is none. */
  element: HTMLElement | null
  /** Shows the column under this title, or hides it again with `null`. */
  setLabel: (label: string | null) => void
}

export const PageSidePanelContext = createContext<PageSidePanelSlot>({
  element: null,
  setLabel: () => {}
})
