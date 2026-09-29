import { useId } from 'react'
import { createPortal } from 'react-dom'
import { DndContext, DragOverlay, useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { useTranslation } from 'react-i18next'
import type { Component } from '@justcampus/shared'
import {
  useSidebarArrangement,
  type SidebarArrangement,
  type SidebarList
} from '@/lib/use-sidebar-arrangement'
import { cn } from '@/lib/utils'
import { SidebarDragPreview, SidebarEditRow, SidebarEmptyRow } from './sidebar-edit-row'

interface DropListProps {
  id: SidebarList
  label: string
  items: string[]
  /** Shown in place of rows; the empty list stays a drop target. */
  empty: string
  className?: string
  listRef?: React.RefObject<HTMLUListElement | null>
  children: React.ReactNode
}

export function DropList({
  id,
  label,
  items,
  empty,
  className,
  listRef,
  children
}: DropListProps): React.JSX.Element {
  const { setNodeRef, isOver } = useDroppable({ id })
  return (
    <SortableContext id={id} items={items} strategy={verticalListSortingStrategy}>
      <ul
        ref={(node) => {
          setNodeRef(node)
          if (listRef) listRef.current = node
        }}
        aria-label={label}
        className={cn(
          'm-0 flex w-full list-none flex-col gap-2 rounded-[var(--ui-radius-control,var(--radius-action))] p-0 transition-colors',
          isOver && 'bg-secondary-container/40',
          className
        )}
      >
        {items.length === 0 ? <SidebarEmptyRow>{empty}</SidebarEmptyRow> : children}
      </ul>
    </SortableContext>
  )
}

/** The rows of one list: sidebar rows remove, available rows add. */
export function SidebarRows({
  arrangement,
  list
}: {
  arrangement: SidebarArrangement
  list: SidebarList
}): React.JSX.Element {
  const { lists, byId, add, remove } = arrangement
  return (
    <>
      {lists[list].flatMap((id) => {
        const component = byId.get(id)
        if (!component) return []
        return [
          <SidebarEditRow
            key={id}
            component={component}
            list={list}
            onAction={() => (list === 'sidebar' ? remove(id) : add(id))}
          />
        ]
      })}
    </>
  )
}

/** What follows the pointer while a row is dragged, above everything else on the page. */
export function SidebarDragLayer({
  component
}: {
  component: Component | undefined
}): React.ReactPortal {
  return createPortal(
    <DragOverlay>{component ? <SidebarDragPreview component={component} /> : null}</DragOverlay>,
    document.body
  )
}

interface SidebarArrangementEditorProps {
  /** Every component that can go into the sidebar. */
  catalogue: Component[] | undefined
  /** The saved sidebar, in its order. */
  componentIds: string[] | undefined
  loading: boolean
  failed: boolean
  onSave: (componentIds: string[], onSettled?: () => void) => void
}

/**
 * The sidebar editor laid out in the page instead of the app's sidebar: the sidebar's rows and
 * the available components side by side, one drag context for both. Used for layout presets.
 */
export function SidebarArrangementEditor({
  catalogue,
  componentIds,
  loading,
  failed,
  onSave
}: SidebarArrangementEditorProps): React.JSX.Element {
  const { t } = useTranslation()
  const sidebarTitleId = useId()
  const availableTitleId = useId()
  const hintId = useId()
  const arrangement = useSidebarArrangement({ catalogue, componentIds, onSave })
  const { lists } = arrangement

  if (failed) {
    return (
      <p role="alert" className="m-0 text-sm text-error">
        {t('sidebarEditor.loadFailed')}
      </p>
    )
  }

  return (
    <DndContext {...arrangement.dndProps}>
      <div className="grid gap-gutter md:grid-cols-2">
        <section aria-labelledby={sidebarTitleId} className="flex min-w-0 flex-col gap-stack-sm">
          <h3 id={sidebarTitleId} className="m-0 text-sm font-semibold text-on-surface">
            {t('sidebarEditor.sidebarLabel')}
          </h3>
          <DropList
            id="sidebar"
            listRef={arrangement.listRef}
            label={t('sidebarEditor.sidebarLabel')}
            items={lists.sidebar}
            empty={loading ? t('common.loading') : t('sidebarEditor.sidebarEmpty')}
          >
            <SidebarRows arrangement={arrangement} list="sidebar" />
          </DropList>
        </section>
        <section
          aria-labelledby={availableTitleId}
          aria-describedby={hintId}
          className="flex min-w-0 flex-col gap-stack-sm"
        >
          <h3 id={availableTitleId} className="m-0 text-sm font-semibold text-on-surface">
            {t('sidebarEditor.title')}
          </h3>
          <p id={hintId} className="m-0 text-xs text-on-surface-variant">
            {t('sidebarEditor.hint')}
          </p>
          <DropList
            id="available"
            listRef={arrangement.availableRef}
            label={t('sidebarEditor.title')}
            items={lists.available}
            empty={loading ? t('common.loading') : t('sidebarEditor.availableEmpty')}
            className="max-h-96 overflow-y-auto"
          >
            <SidebarRows arrangement={arrangement} list="available" />
          </DropList>
        </section>
      </div>
      <p role="status" className="sr-only">
        {arrangement.status}
      </p>
      <SidebarDragLayer component={arrangement.activeComponent} />
    </DndContext>
  )
}
