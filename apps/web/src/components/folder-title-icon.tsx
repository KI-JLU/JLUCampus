import { FolderIcon } from 'lucide-react'
import { DynamicIcon } from 'lucide-react/dynamic'
import { isIconName } from '@/lib/icons'

function DefaultFolderIcon(): React.JSX.Element {
  return <FolderIcon aria-hidden="true" width="1em" height="1em" className="shrink-0" />
}

/** The Lucide icon next to a folder's title, else a folder. Decorative. */
export function FolderTitleIcon({ icon }: { icon?: string | null }): React.JSX.Element {
  if (icon && isIconName(icon)) {
    return (
      <DynamicIcon
        name={icon}
        aria-hidden="true"
        width="1em"
        height="1em"
        className="shrink-0"
        fallback={DefaultFolderIcon}
      />
    )
  }
  return <DefaultFolderIcon />
}
