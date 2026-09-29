import { cn } from '@/lib/utils'

/*
 * `allow-scripts` together with `allow-same-origin` lets the embedded site run
 * as itself (logins, cookies); the sandbox still blocks top navigation, so a
 * site cannot replace the app. Only admins choose the URLs.
 */
const SANDBOX = [
  'allow-scripts',
  'allow-same-origin',
  'allow-forms',
  'allow-popups',
  'allow-popups-to-escape-sandbox',
  'allow-downloads'
].join(' ')

interface IframeEmbedProps {
  url: string
  title: string
  className?: string
}

export function IframeEmbed({ url, title, className }: IframeEmbedProps): React.JSX.Element {
  return (
    <iframe
      src={url}
      title={title}
      sandbox={SANDBOX}
      referrerPolicy="strict-origin-when-cross-origin"
      allow="fullscreen"
      loading="lazy"
      className={cn('block size-full border-0 bg-surface', className)}
    />
  )
}
