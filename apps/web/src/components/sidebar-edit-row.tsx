import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVerticalIcon, PlusIcon, XIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button, navItemVariants } from '@ki4jlu/design-system'
import type { Component } from '@justcampus/shared'
import type { SidebarList } from '@/lib/use-sidebar-arrangement'
import { cn } from '@/lib/utils'
import { ComponentIcon } from './component-icon'

interface SidebarEditRowProps {
  component: Component
  list: SidebarList
  /** Adds the component (available list) or removes it (sidebar list): the drag-free alternative. */
  onAction: () => void
}

const icon = { 'aria-hidden': true, width: '1em', height: '1em' } as const

/**
 * Exactly a sidebar link's box (same padding, type and icon position), so switching into editing
 * moves nothing; the dashed outline marks the row as movable without taking up space.
 */
const editRowClass = cn(
  navItemVariants({ level: 'top' }),
  'outline-1 -outline-offset-1 outline-outline-variant outline-dashed'
)

/**
 * One component while the sidebar is being edited. The whole row drags with mouse or touch;
 * the trailing grip is the keyboard handle, and the button after it adds or removes without dragging.
 */
export function SidebarEditRow({
  component,
  list,
  onAction
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
      <ComponentIcon icon={component.icon} iconUrl={component.iconUrl} />
      <span className="min-w-0 flex-1 truncate">{component.name}</span>
      {/* Negative margins keep the 32px buttons inside the link's 24px line box. */}
      <span className="-my-1 -mr-2 flex items-center">
        <Button
          ref={setActivatorNodeRef}
          variant="ghost"
          size="icon"
          className="cursor-grab"
          {...attributes}
          aria-label={t('sidebarEditor.move', { name: component.name })}
          onKeyDown={(event) => onKeyDown?.(event)}
        >
          <GripVerticalIcon {...icon} />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          data-row-action=""
          aria-label={t(adding ? 'sidebarEditor.add' : 'sidebarEditor.remove', {
            name: component.name
          })}
          onClick={onAction}
        >
          {adding ? <PlusIcon {...icon} /> : <XIcon {...icon} />}
        </Button>
      </span>
    </li>
  )
}

/** What follows the pointer while a row is dragged, between the sidebar and the panel. */
export function SidebarDragPreview({ component }: { component: Component }): React.JSX.Element {
  return (
    <div className={cn(editRowClass, 'cursor-grabbing bg-surface-container-lowest shadow-overlay')}>
      <ComponentIcon icon={component.icon} iconUrl={component.iconUrl} />
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
