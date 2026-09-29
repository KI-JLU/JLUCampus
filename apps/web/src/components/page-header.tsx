import { useContext, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'
import { PageHeaderExtraActionsContext, PageHeaderSlotsContext } from '@/lib/page-header-slots'

interface PageHeaderProps {
  title: ReactNode
  /** Muted line below the header, part of the page body. */
  description?: ReactNode
  /** Buttons for the whole page (edit, add). */
  actions?: ReactNode
  className?: string
}

/**
 * A page's one header. From `lg` up the title and actions go into the shell's
 * top bar, so there is a single bar above the content; the `<h1>` stays in the
 * page for assistive technology. Below `lg` the bar shows the brand, so the
 * page renders the header itself. Actions the route adds (see
 * `PageHeaderExtraActionsContext`) follow the page's own.
 */
export function PageHeader({
  title,
  description,
  actions: pageActions,
  className
}: PageHeaderProps): React.JSX.Element {
  const slots = useContext(PageHeaderSlotsContext)
  const extraActions = useContext(PageHeaderExtraActionsContext)
  const actions = extraActions ? (
    <>
      {pageActions}
      {extraActions}
    </>
  ) : (
    pageActions
  )
  const descriptionLine = description ? (
    <p className="m-0 text-body-base text-on-surface-variant">{description}</p>
  ) : null

  if (slots.title && slots.actions) {
    return (
      <>
        <h1 className="sr-only">{title}</h1>
        {createPortal(
          <span aria-hidden="true" className="flex min-w-0 items-center gap-2">
            {title}
          </span>,
          slots.title
        )}
        {actions ? createPortal(actions, slots.actions) : null}
        {descriptionLine ? <div className={className}>{descriptionLine}</div> : null}
      </>
    )
  }

  return (
    <header className={cn('flex flex-col gap-stack-sm', className)}>
      <div className="flex flex-wrap items-center justify-between gap-stack-sm">
        <h1 className="m-0 flex min-w-0 items-center gap-2 font-headline-md text-headline-md-mobile text-on-surface">
          {title}
        </h1>
        {actions ? <div className="flex flex-wrap items-center gap-stack-sm">{actions}</div> : null}
      </div>
      {descriptionLine}
    </header>
  )
}
