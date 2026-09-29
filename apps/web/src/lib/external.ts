import type { MouseEvent } from 'react'

/** Opens a URL outside the app: the system browser on desktop, a new tab on the web. */
export function openExternal(url: string): void {
  if (window.justCampus) void window.justCampus.openExternal(url)
  else window.open(url, '_blank', 'noopener,noreferrer')
}

interface ExternalLinkProps {
  href: string
  target: '_blank'
  rel: 'noopener noreferrer'
  onClick: (event: MouseEvent<HTMLAnchorElement>) => void
}

/**
 * Props for a real `<a>` to an outside URL: a new tab on the web (so middle
 * click and "copy link" keep working), the system browser on desktop, where
 * a plain click would otherwise open a bare Electron window.
 */
export function externalLinkProps(url: string): ExternalLinkProps {
  return {
    href: url,
    target: '_blank',
    rel: 'noopener noreferrer',
    onClick: (event) => {
      if (!window.justCampus || event.defaultPrevented) return
      event.preventDefault()
      void window.justCampus.openExternal(url)
    }
  }
}
