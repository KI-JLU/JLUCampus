import type { ReactNode } from 'react'
import { ArrowUpRightIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { externalLinkProps } from '@/lib/external'

interface ShortcutLinkProps {
  url: string
  title: string
  /** Decorative, shown large above the title. */
  icon: ReactNode
}

/**
 * A shortcut tile's body: one link over the whole tile that opens the URL
 * outside the app. The arrow in the corner tells it apart from widgets, which
 * open as a page inside JLU Campus.
 */
export function ShortcutLink({ url, title, icon }: ShortcutLinkProps): React.JSX.Element {
  const { t } = useTranslation()
  return (
    <a
      {...externalLinkProps(url)}
      aria-label={t('shortcut.open', { name: title })}
      className="relative flex size-full flex-col items-center justify-center gap-2 p-3 text-center text-on-surface no-underline transition-colors hover:bg-surface-container focus-visible:bg-surface-container"
    >
      <ArrowUpRightIcon
        aria-hidden="true"
        width="1em"
        height="1em"
        className="absolute top-2 right-2 text-on-surface-variant group-data-editing/tile:invisible"
      />
      <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary-container text-xl text-on-primary-container">
        {icon}
      </span>
      <span className="line-clamp-2 max-w-full font-semibold">{title}</span>
    </a>
  )
}
