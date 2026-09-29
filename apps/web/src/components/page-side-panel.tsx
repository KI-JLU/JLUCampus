import { useContext, useLayoutEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { PageSidePanelContext } from '@/lib/page-side-panel'
import { useMediaQuery } from '@/lib/use-media-query'

interface PageSidePanelProps {
  /** Title of the column and name of its landmark. */
  label: string
  /** The column's content. */
  children: ReactNode
  /** What the page shows in its place below `lg`, where the shell has one area at a time. */
  fallback: ReactNode
}

/**
 * A page's own column on the right of the shell, collapsible and resizable like the navigation.
 * It exists while the page is shown; below `lg` the page renders `fallback` instead.
 */
export function PageSidePanel({ label, children, fallback }: PageSidePanelProps): ReactNode {
  const wide = useMediaQuery('(min-width: 64rem)')
  const { element, setLabel } = useContext(PageSidePanelContext)

  // Before paint, so the shell's columns change in the same frame as the page: no frame without the
  // column on arrival, none with an empty one after leaving.
  useLayoutEffect(() => {
    if (!wide) return
    setLabel(label)
    return () => setLabel(null)
  }, [wide, label, setLabel])

  if (!wide) return fallback
  return element ? createPortal(children, element) : null
}
