import { useId, useMemo, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { DndContext } from '@dnd-kit/core'
import { ArrowUpRightIcon, CheckIcon, PencilIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import {
  NavItem,
  Popover,
  PopoverAnchor,
  PopoverContent,
  PopoverTrigger
} from '@ki4jlu/design-system'
import type { Component } from '@justcampus/shared'
import { externalUrlOf } from '@/adapters/registry'
import { externalLinkProps } from '@/lib/external'
import { componentsQuery, sidebarQuery, useSaveSidebar } from '@/lib/queries'
import { toast } from '@/lib/toast'
import { useMediaQuery } from '@/lib/use-media-query'
import { useSidebarArrangement } from '@/lib/use-sidebar-arrangement'
import { ComponentIcon } from './component-icon'
import { DropList, SidebarDragLayer, SidebarRows } from './sidebar-arrangement'

const icon = { 'aria-hidden': true, width: '1em', height: '1em' } as const

interface SidebarComponentsProps {
  /** The user's sidebar components, in their order. */
  components: Component[]
  pathname: string
}

/**
 * The component links of the sidebar and their editor. "Seitenleiste bearbeiten" turns the links
 * into sortable rows in place and opens a panel beside the column with the components that are
 * not in the sidebar yet; rows drag between the two.
 */
export function SidebarComponents({
  components,
  pathname
}: SidebarComponentsProps): React.JSX.Element {
  const { t } = useTranslation()
  const [editing, setEditing] = useState(false)
  const label = editing ? t('sidebarEditor.done') : t('nav.editSidebar')

  return (
    <Popover open={editing} onOpenChange={setEditing}>
      {editing ? (
        <SidebarEditor />
      ) : (
        components.map((component) => (
          <SidebarComponentLink key={component.id} component={component} pathname={pathname} />
        ))
      )}
      <PopoverTrigger asChild>
        <NavItem type="button" level="sub" label={label}>
          {editing ? <CheckIcon {...icon} /> : <PencilIcon {...icon} />}
          <span>{label}</span>
        </NavItem>
      </PopoverTrigger>
    </Popover>
  )
}

/** A component's page inside the app, or for shortcut components their site outside it. */
function SidebarComponentLink({
  component,
  pathname
}: {
  component: Component
  pathname: string
}): React.JSX.Element {
  const { t } = useTranslation()
  const url = externalUrlOf(component)
  const content = (
    <>
      <ComponentIcon icon={component.icon} iconUrl={component.iconUrl} siteUrl={url} />
      <span className="truncate">{component.name}</span>
    </>
  )
  if (url) {
    return (
      <NavItem asChild label={component.name}>
        <a {...externalLinkProps(url)}>
          {content}
          <span className="sr-only">{t('shortcut.opensOutside')}</span>
          <ArrowUpRightIcon {...icon} className="ml-auto shrink-0 text-on-surface-variant" />
        </a>
      </NavItem>
    )
  }
  return (
    <NavItem asChild label={component.name} active={pathname === `/c/${component.id}`}>
      <Link to="/c/$componentId" params={{ componentId: component.id }}>
        {content}
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
