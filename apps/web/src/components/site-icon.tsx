import { useState } from 'react'
import { GlobeIcon } from 'lucide-react'
import { DynamicIcon } from 'lucide-react/dynamic'
import { isIconName } from '@/lib/icons'
import { faviconUrl } from '@/lib/links'
import { cn } from '@/lib/utils'

interface SiteIconProps {
  url: string
  /** A Lucide icon the user chose; `null` shows the site's favicon. */
  icon: string | null
  className?: string
}

function GlobeFallback(): React.JSX.Element {
  return <GlobeIcon aria-hidden="true" width="1em" height="1em" />
}

/**
 * A shortcut's icon: the chosen Lucide icon, else the site's favicon, else a
 * globe when the site has none (or it cannot be loaded). Decorative.
 */
export function SiteIcon({ url, icon, className }: SiteIconProps): React.JSX.Element {
  const src = faviconUrl(url)
  // Remembered per address, so editing a shortcut's URL tries the new site's favicon.
  const [failedSrc, setFailedSrc] = useState<string | null>(null)

  if (icon && isIconName(icon)) {
    return (
      <DynamicIcon
        name={icon}
        aria-hidden="true"
        width="1em"
        height="1em"
        className={cn('shrink-0', className)}
        fallback={GlobeFallback}
      />
    )
  }
  if (!src || failedSrc === src) {
    return (
      <GlobeIcon
        aria-hidden="true"
        width="1em"
        height="1em"
        className={cn('shrink-0', className)}
      />
    )
  }
  return (
    <img
      src={src}
      alt=""
      width={16}
      height={16}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailedSrc(src)}
      className={cn('size-[1em] shrink-0 rounded-sm object-contain', className)}
    />
  )
}
