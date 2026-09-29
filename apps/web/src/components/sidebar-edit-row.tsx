import { Link } from '@tanstack/react-router'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ArrowUpRightIcon, GripVerticalIcon, PlusIcon, XIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button, navItemVariants } from '@ki4jlu/design-system'
import type { Component } from '@justcampus/shared'
import { externalUrlOf } from '@/adapters/registry'
import { externalLinkProps } from '@/lib/external'
import type { SidebarList } from '@/lib/use-sidebar-arrangement'
import { cn } from '@/lib/utils'
import { ComponentIcon } from './component-icon'

interface SidebarEditRowProps {
  component: Component
  list: SidebarList
  /** Adds the component (available list) or removes it (sidebar list): the drag-free alternative. */
  onAction: () => void
  /** Whether the icon and name open the component, as in "All apps". */
  link?: boolean
}

const icon = { 'aria-hidden': true, width: '1em', height: '1em' } as const

/**
 * A sidebar link's box (same padding and type); the dashed outline marks the row as movable
 * without taking up space.
 */
const editRowClass = cn(
  navItemVariants({ level: 'top' }),
  'outline-1 -outline-offset-1 outline-outline-variant outline-dashed'
)

/**
 * One component while the sidebar is being edited. The whole row drags with mouse or touch;
 * the leading grip is the keyboard handle, and the trailing button adds or removes without dragging.
 */
export function SidebarEditRow({
  component,
  list,
  onAction,
  link = false
}: SidebarEditRowProps): React.JSX.Element {
  const { t } = useTranslation()
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: component.id, data: { list } })
  const { onKeyDown, ...pointerListeners } = listeners ?? {}
  const adding = list === 'available'

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(editRowClass, 'cursor-grab', isDragging && 'opacity-40')}
      {...pointerListeners}
    >
      {/* Negative margins keep the 32px buttons inside the link's 24px line box. */}
      <Button
        ref={setActivatorNodeRef}
        variant="ghost"
        size="icon"
        className="-my-1 -ml-2 shrink-0 cursor-grab"
        {...attributes}
        aria-label={t('sidebarEditor.move', { name: component.name })}
        onKeyDown={(event) => onKeyDown?.(event)}
      >
        <GripVerticalIcon {...icon} />
      </Button>
      <RowLabel component={component} link={link} />
      <RowAction component={component} action={adding ? 'add' : 'remove'} onAction={onAction} />
    </li>
  )
}

interface SidebarPinnedRowProps {
  component: Component
  /** Removes the component from the sidebar. */
  onRemove: () => void
}

/**
 * A component that is in the sidebar already, in a list of every component: not movable from
 * here, so no grip and a solid outline; the space of the grip keeps the icons in line.
 */
export function SidebarPinnedRow({
  component,
  onRemove
}: SidebarPinnedRowProps): React.JSX.Element {
  return (
    <li className={cn(editRowClass, 'outline-solid')}>
      <span aria-hidden="true" className="-my-1 -ml-2 size-8 shrink-0" />
      <RowLabel component={component} link />
      <RowAction component={component} action="remove" onAction={onRemove} />
    </li>
  )
}

/**
 * Icon and name, or with `link` the component's page inside the app, or for shortcut components
 * their site outside it. dnd-kit keeps the browser from dragging the link itself.
 */
function RowLabel({ component, link }: { component: Component; link: boolean }): React.JSX.Element {
  const { t } = useTranslation()
  const url = externalUrlOf(component)
  const content = (
    <>
      <ComponentIcon icon={component.icon} iconUrl={component.iconUrl} siteUrl={url} />
      <span className="min-w-0 flex-1 truncate">{component.name}</span>
    </>
  )
  const className =
    'flex min-w-0 flex-1 items-center gap-[inherit] text-inherit no-underline hover:underline aria-[current=page]:font-semibold'
  if (!link) return content
  if (url) {
    return (
      <a {...externalLinkProps(url)} className={className}>
        {content}
        <span className="sr-only">{t('shortcut.opensOutside')}</span>
        <ArrowUpRightIcon {...icon} className="shrink-0 text-on-surface-variant" />
      </a>
    )
  }
  return (
    <Link to="/c/$componentId" params={{ componentId: component.id }} className={className}>
      {content}
    </Link>
  )
}

interface RowActionProps {
  component: Component
  action: 'add' | 'remove'
  onAction: () => void
}

/** The trailing add or remove button; the arrangement finds it by `data-row-action` for focus. */
function RowAction({ component, action, onAction }: RowActionProps): React.JSX.Element {
  const { t } = useTranslation()
  return (
    <Button
      variant="ghost"
      size="icon"
      className="-my-1 -mr-2 shrink-0"
      data-row-action={component.id}
      aria-label={t(action === 'add' ? 'sidebarEditor.add' : 'sidebarEditor.remove', {
        name: component.name
      })}
      onClick={onAction}
    >
      {action === 'add' ? <PlusIcon {...icon} /> : <XIcon {...icon} />}
    </Button>
  )
}

/** What follows the pointer while a row is dragged, between the sidebar and the panel. */
export function SidebarDragPreview({ component }: { component: Component }): React.JSX.Element {
  return (
    <div className={cn(editRowClass, 'cursor-grabbing bg-surface-container-lowest shadow-overlay')}>
      <span className="-my-1 -ml-2 flex size-8 shrink-0 items-center justify-center">
        <GripVerticalIcon {...icon} />
      </span>
      <ComponentIcon
        icon={component.icon}
        iconUrl={component.iconUrl}
        siteUrl={externalUrlOf(component)}
      />
      <span className="min-w-0 flex-1 truncate">{component.name}</span>
    </div>
  )
}

/** Stands in for the rows of an empty list, which stays a drop target. */
export function SidebarEmptyRow({ children }: { children: string }): React.JSX.Element {
  return (
    <li className={cn(editRowClass, 'text-sm text-on-surface-variant hover:bg-transparent')}>
      <span>{children}</span>
    </li>
  )
}
