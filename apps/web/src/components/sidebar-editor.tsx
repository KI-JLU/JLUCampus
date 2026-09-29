import { useId, useMemo } from 'react'
import { Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { DndContext } from '@dnd-kit/core'
import { ArrowUpRightIcon, CheckIcon, PencilIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import {
  Button,
  NavItem,
  PopoverAnchor,
  PopoverContent,
  PopoverTrigger,
  useSidebarCollapsed
} from '@ki4jlu/design-system'
import type { Component } from '@justcampus/shared'
import { externalUrlOf, feedUrlOf } from '@/adapters/registry'
import { externalLinkProps } from '@/lib/external'
import { componentsQuery, sidebarQuery, useSaveSidebar } from '@/lib/queries'
import { toast } from '@/lib/toast'
import { useFeedHasUnread } from '@/lib/use-feed'
import { useMediaQuery } from '@/lib/use-media-query'
import { useSidebarArrangement } from '@/lib/use-sidebar-arrangement'
import { cn } from '@/lib/utils'
import { ComponentIcon } from './component-icon'
import { DropList, SidebarDragLayer, SidebarRows } from './sidebar-arrangement'

const icon = { 'aria-hidden': true, width: '1em', height: '1em' } as const

interface SidebarComponentsProps {
  /** The user's sidebar components, in their order. */
  components: Component[]
  pathname: string
  /** Whether the sidebar is being edited; the `Popover` around the shell holds that state. */
  editing: boolean
}

/**
 * The component links of the sidebar, or while editing their editor: the links turn into sortable
 * rows in place and a panel beside the column lists the components that are not in the sidebar
 * yet; rows drag between the two. `EditSidebarButton` switches between the two.
 */
export function SidebarComponents({
  components,
  pathname,
  editing
}: SidebarComponentsProps): React.JSX.Element {
  if (editing) return <SidebarEditor />
  return (
    <>
      {components.map((component) => (
        <SidebarComponentLink key={component.id} component={component} pathname={pathname} />
      ))}
    </>
  )
}

/** The pencil beside the user's name that starts and ends editing the sidebar. */
export function EditSidebarButton({ editing }: { editing: boolean }): React.JSX.Element {
  const { t } = useTranslation()
  const label = editing ? t('sidebarEditor.done') : t('nav.editSidebar')
  return (
    <PopoverTrigger asChild>
      <Button
        variant={editing ? 'default' : 'ghost'}
        size="icon"
        className="shrink-0"
        aria-label={label}
        title={label}
      >
        {editing ? <CheckIcon {...icon} /> : <PencilIcon {...icon} />}
      </Button>
    </PopoverTrigger>
  )
}

interface SidebarComponentLinkProps {
  component: Component
  pathname: string
}

/**
 * A component's page inside the app, or for shortcut components their site outside it. The row
 * shrinks to its icon with the collapsed column; rows of components that show a feed flag its
 * unread entries.
 */
function SidebarComponentLink({
  component,
  pathname
}: SidebarComponentLinkProps): React.JSX.Element {
  const { t } = useTranslation()
  const url = externalUrlOf(component)
  const feedUrl = feedUrlOf(component)
  if (url) {
    return (
      <NavItem asChild label={component.name}>
        <a {...externalLinkProps(url)}>
          <ComponentIcon icon={component.icon} iconUrl={component.iconUrl} siteUrl={url} />
          <span className="truncate">{component.name}</span>
          <span className="sr-only">{t('shortcut.opensOutside')}</span>
          <ArrowUpRightIcon {...icon} className="ml-auto shrink-0 text-on-surface-variant" />
        </a>
      </NavItem>
    )
  }
  if (feedUrl) {
    return <FeedComponentLink component={component} pathname={pathname} feedUrl={feedUrl} />
  }
  return <ComponentPageLink component={component} pathname={pathname} unread={false} />
}

/** A feed component's row, flagged while its feed has unread entries. */
function FeedComponentLink({
  feedUrl,
  ...props
}: SidebarComponentLinkProps & { feedUrl: string }): React.JSX.Element {
  const unread = useFeedHasUnread(feedUrl)
  return <ComponentPageLink {...props} unread={unread} />
}

/**
 * The link to a component's page. `unread` adds a dot, beside the name or on the icon in the
 * collapsed column, and adds "new entries" to the link's name.
 */
function ComponentPageLink({
  component,
  pathname,
  unread
}: SidebarComponentLinkProps & { unread: boolean }): React.JSX.Element {
  const { t } = useTranslation()
  const collapsed = useSidebarCollapsed()
  const active = pathname === `/c/${component.id}`
  const unreadText = t('nav.newEntries')
  // Collapsed, the row's text is hidden and `label` is its name.
  const label = unread ? `${component.name} ${unreadText}` : component.name
  return (
    <NavItem asChild label={label} active={active} className={unread ? 'relative' : undefined}>
      <Link to="/c/$componentId" params={{ componentId: component.id }}>
        <ComponentIcon icon={component.icon} iconUrl={component.iconUrl} />
        <span className="truncate">{component.name}</span>
        {unread ? (
          <>
            <span className="sr-only"> {unreadText}</span>
            {/* An <svg>, so the collapsed row, which hides every other child, keeps it. */}
            <svg
              aria-hidden="true"
              viewBox="0 0 8 8"
              className={cn(
                'size-2 forced-colors:text-[CanvasText]',
                active ? 'text-on-primary' : 'text-primary',
                collapsed ? 'absolute top-2.5 left-1/2 ml-1.5' : 'ml-auto'
              )}
            >
              <circle cx="4" cy="4" r="4" fill="currentColor" />
            </svg>
          </>
        ) : null}
      </Link>
    </NavItem>
  )
}

/**
 * The user's own sidebar rows in place, plus the panel of available components, one drag
 * context for both. Changes are saved at once.
 */
function SidebarEditor(): React.JSX.Element {
  const { t } = useTranslation()
  const catalogue = useQuery(componentsQuery)
  const sidebar = useQuery(sidebarQuery)
  const { mutate } = useSaveSidebar()
  const wide = useMediaQuery('(min-width: 64rem)')
  const titleId = useId()
  const hintId = useId()
  const arrangement = useSidebarArrangement({
    catalogue: catalogue.data,
    componentIds: sidebar.data,
    onSave: (componentIds, onSettled) =>
      mutate(componentIds, {
        onError: () => toast({ variant: 'error', title: t('sidebarEditor.saveFailed') }),
        onSettled
      })
  })
  const { lists, listRef, availableRef, activeId } = arrangement

  // The panel sits beside the whole column on wide screens and below the rows on narrow ones,
  // where the column fills the screen.
  const anchor = useMemo(
    () => ({
      current: {
        getBoundingClientRect: (): DOMRect => {
          const list = listRef.current
          if (!list) return new DOMRect()
          const rows = list.getBoundingClientRect()
          const column = list.closest('aside')?.getBoundingClientRect()
          if (!column) return rows
          return new DOMRect(column.left, rows.top, column.width, rows.height)
        }
      }
    }),
    [listRef]
  )

  const loading = catalogue.isPending || sidebar.isPending
  const failed = catalogue.isError || sidebar.isError

  return (
    <DndContext {...arrangement.dndProps}>
      <PopoverAnchor virtualRef={anchor} />
      <DropList
        id="sidebar"
        listRef={listRef}
        label={t('sidebarEditor.sidebarLabel')}
        items={lists.sidebar}
        empty={loading ? t('common.loading') : t('sidebarEditor.sidebarEmpty')}
      >
        <SidebarRows arrangement={arrangement} list="sidebar" />
      </DropList>
      <PopoverContent
        side={wide ? 'right' : 'bottom'}
        align="start"
        sideOffset={8}
        collisionPadding={12}
        aria-labelledby={titleId}
        aria-describedby={hintId}
        className="flex w-72 flex-col gap-stack-sm p-3"
        // Working in the sidebar rows is part of editing, not a click away from it.
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
        <h2 id={titleId} className="m-0 text-sm font-semibold text-on-surface">
          {t('sidebarEditor.title')}
        </h2>
        <p id={hintId} className="m-0 text-xs text-on-surface-variant">
          {t('sidebarEditor.hint')}
        </p>
        {failed ? (
          <p role="alert" className="m-0 text-sm text-error">
            {t('sidebarEditor.loadFailed')}
          </p>
        ) : (
          <DropList
            id="available"
            listRef={availableRef}
            label={t('sidebarEditor.title')}
            items={lists.available}
            empty={loading ? t('common.loading') : t('sidebarEditor.availableEmpty')}
            className="max-h-96 overflow-y-auto"
          >
            <SidebarRows arrangement={arrangement} list="available" />
          </DropList>
        )}
        <p role="status" className="sr-only">
          {arrangement.status}
        </p>
      </PopoverContent>
      <SidebarDragLayer component={arrangement.activeComponent} />
    </DndContext>
  )
}
