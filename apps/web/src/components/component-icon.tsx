import { LayoutGridIcon } from 'lucide-react'
import { DynamicIcon } from 'lucide-react/dynamic'
import { isIconName } from '@/lib/icons'
import { cn } from '@/lib/utils'
import { SiteIcon } from './site-icon'

interface ComponentIconProps {
  icon: string | null
  iconUrl: string | null
  /** A shortcut component's target: its favicon stands in when neither icon is set. */
  siteUrl?: string | null
  className?: string
}

function GridFallback(): React.JSX.Element {
  return <LayoutGridIcon aria-hidden="true" width="1em" height="1em" />
}

/**
 * A component's image when it has one, else its Lucide icon, else the favicon of
 * `siteUrl`, else a neutral grid. Decorative.
 */
export function ComponentIcon({
  icon,
  iconUrl,
  siteUrl,
  className
}: ComponentIconProps): React.JSX.Element {
  if (iconUrl) {
    return (
      <img
        src={iconUrl}
        alt=""
        width={16}
        height={16}
        loading="lazy"
        referrerPolicy="no-referrer"
        className={cn('size-[1em] shrink-0 rounded-sm object-contain', className)}
      />
    )
  }
  if (icon && isIconName(icon)) {
    return (
      <DynamicIcon
        name={icon}
        aria-hidden="true"
        width="1em"
        height="1em"
        className={cn('shrink-0', className)}
        fallback={GridFallback}
      />
    )
  }
  if (siteUrl) return <SiteIcon url={siteUrl} icon={null} className={className} />
  return (
    <LayoutGridIcon
      aria-hidden="true"
      width="1em"
      height="1em"
      className={cn('shrink-0', className)}
    />
  )
}
