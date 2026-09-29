import { useId, useMemo, useState } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { SortableContext, type SortingStrategy } from '@dnd-kit/sortable'
import { GripIcon, SearchIcon, XIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import {
  Button,
  Input,
  NavItem,
  PopoverClose,
  PopoverContent,
  PopoverTrigger
} from '@ki4jlu/design-system'
import type { Component } from '@justcampus/shared'
import type { SidebarArrangement } from '@/lib/use-sidebar-arrangement'
import { cn } from '@/lib/utils'
import { SidebarEditRow, SidebarPinnedRow } from './sidebar-edit-row'

const icon = { 'aria-hidden': true, width: '1em', height: '1em' } as const

/**
 * Rows keep their places while one is dragged over the list: its order is the catalogue's, and
 * a row only leaves or joins the sidebar.
 */
const keepInPlace: SortingStrategy = () => null

/**
 * "All apps" at the foot of the column. It opens the panel of every component and, while it is
 * open, turns the sidebar's links into sortable rows (see `SidebarComponents`). A `Popover` around
 * the shell holds the state; this is its trigger.
 */
export function AllAppsButton(): React.JSX.Element {
  const { t } = useTranslation()
  const label = t('nav.allApps')
  return (
    <PopoverTrigger asChild>
      <NavItem type="button" label={label}>
        <GripIcon {...icon} />
        <span>{label}</span>
      </NavItem>
    </PopoverTrigger>
  )
}

interface AllAppsPanelProps {
  arrangement: SidebarArrangement
  /** Every component, in the admins' order. */
  catalogue: Component[] | undefined
  loading: boolean
  failed: boolean
  /** A second column of full height beside the sidebar; else a panel below its rows. */
  wide: boolean
  onClose: () => void
}

/**
 * Every component, with a search, as rows like the sidebar's while it is edited: the icon and name
 * open the component, the rows not in the sidebar drag into it or join it with their button, the
 * others leave it with theirs. Rows dragged here from the sidebar leave it.
 */
export function AllAppsPanel({
  arrangement,
  catalogue,
  loading,
  failed,
  wide,
  onClose
}: AllAppsPanelProps): React.JSX.Element {
  const { t } = useTranslation()
  const titleId = useId()
  const hintId = useId()
  const [search, setSearch] = useState('')
  const { lists, listRef, availableRef, activeId, add, remove } = arrangement
  const label = t('nav.allApps')

  const matches = useMemo(() => {
    const query = search.trim().toLocaleLowerCase()
    const all = [...(catalogue ?? [])].sort((a, b) => a.sortOrder - b.sortOrder)
    return query ? all.filter((c) => c.name.toLocaleLowerCase().includes(query)) : all
  }, [catalogue, search])
  const inSidebar = new Set(lists.sidebar)
  const movable = matches.filter((c) => !inSidebar.has(c.id)).map((c) => c.id)
  const { setNodeRef, isOver } = useDroppable({ id: 'available' })

  return (
    <PopoverContent
      side={wide ? 'right' : 'bottom'}
      align="start"
      sideOffset={wide ? 0 : 8}
      avoidCollisions={!wide}
      collisionPadding={12}
      aria-labelledby={titleId}
      aria-describedby={hintId}
      className={
        wide
          ? 'flex h-(--radix-popover-trigger-height) w-96 flex-col rounded-none border-y-0 border-l-0 p-0'
          : 'flex max-h-(--radix-popover-content-available-height) w-[min(24rem,calc(100vw-1.5rem))] flex-col p-0'
      }
      // Working in the sidebar rows is part of this, not a click away from it.
      onInteractOutside={(event) => {
        if (event.target instanceof Node && listRef.current?.contains(event.target)) {
          event.preventDefault()
        }
      }}
      // While a row is lifted by keyboard, Escape cancels that move and keeps the panel.
      onEscapeKeyDown={(event) => {
        if (activeId) event.preventDefault()
      }}
    >
      <div className="flex flex-col gap-3 p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 id={titleId} className="m-0 text-base font-semibold text-on-surface">
            {label}
          </h2>
          <PopoverClose asChild>
            <Button variant="ghost" size="icon" aria-label={t('common.close')}>
              <XIcon {...icon} />
            </Button>
          </PopoverClose>
        </div>
        <p id={hintId} className="m-0 text-xs text-on-surface-variant">
          {t('allApps.hint')}
        </p>
        <Input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t('allApps.search')}
          aria-label={t('allApps.search')}
          leadingIcon={<SearchIcon aria-hidden="true" />}
          // The search, not the close button, is where the panel starts.
          autoFocus
        />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
        {loading ? (
          <p className="m-0 text-sm text-on-surface-variant">{t('common.loading')}</p>
        ) : failed ? (
          <p role="alert" className="m-0 text-sm text-error">
            {t('allApps.loadFailed')}
          </p>
        ) : (
          <SortableContext id="available" items={movable} strategy={keepInPlace}>
            {/* Following a link closes the panel; the page it opened is what the user wanted. */}
            <ul
              ref={(node) => {
                setNodeRef(node)
                availableRef.current = node
              }}
              aria-label={label}
              className={cn(
                'm-0 flex min-h-12 list-none flex-col gap-2 rounded-[var(--ui-radius-control,var(--radius-action))] p-0 transition-colors',
                isOver && 'bg-secondary-container/40'
              )}
              onClick={(event) => {
                if (event.target instanceof Element && event.target.closest('a')) onClose()
              }}
            >
              {matches.map((component) =>
                inSidebar.has(component.id) ? (
                  <SidebarPinnedRow
                    key={component.id}
                    component={component}
                    onRemove={() => remove(component.id, 'available')}
                  />
                ) : (
                  <SidebarEditRow
                    key={component.id}
                    component={component}
                    list="available"
                    link
                    onAction={() => add(component.id, 'available')}
                  />
                )
              )}
            </ul>
          </SortableContext>
        )}
        {!loading && !failed && matches.length === 0 ? (
          <p className="m-0 text-sm text-on-surface-variant">
            {search.trim() ? t('allApps.noMatches', { query: search.trim() }) : t('allApps.empty')}
          </p>
        ) : null}
        <p role="status" className="sr-only">
          {!loading && search.trim() ? t('allApps.matches', { count: matches.length }) : ''}
        </p>
        <p role="status" className="sr-only">
          {arrangement.status}
        </p>
      </div>
    </PopoverContent>
  )
}
