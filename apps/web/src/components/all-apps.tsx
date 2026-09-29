import { useMemo, useRef, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { ArrowUpRightIcon, GripIcon, SearchIcon, XIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import {
  Button,
  Input,
  NavItem,
  Popover,
  PopoverAnchor,
  PopoverClose,
  PopoverContent,
  PopoverTrigger
} from '@ki4jlu/design-system'
import type { Component } from '@justcampus/shared'
import { externalUrlOf } from '@/adapters/registry'
import { externalLinkProps } from '@/lib/external'
import { componentsQuery } from '@/lib/queries'
import { useMediaQuery } from '@/lib/use-media-query'
import { ComponentIcon } from './component-icon'

const icon = { 'aria-hidden': true, width: '1em', height: '1em' } as const

const TILE =
  'relative flex h-full flex-col items-center justify-center gap-2 rounded-xl border border-outline-variant p-3 text-center text-on-surface no-underline transition-colors hover:bg-surface-container focus-visible:bg-surface-container aria-[current=page]:border-primary aria-[current=page]:bg-surface-container'

/**
 * "All apps" at the foot of the column: every component, with a search, to open one that is not in
 * the sidebar. The panel is a second column of full height beside the sidebar on wide screens;
 * on narrow ones, where the column fills the screen, it covers the column.
 */
export function AllApps(): React.JSX.Element {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const catalogue = useQuery(componentsQuery)
  const wide = useMediaQuery('(min-width: 64rem)')
  const triggerRef = useRef<HTMLButtonElement>(null)
  const label = t('nav.allApps')

  const matches = useMemo(() => {
    const query = search.trim().toLocaleLowerCase()
    const all = catalogue.data ?? []
    return query ? all.filter((c) => c.name.toLocaleLowerCase().includes(query)) : all
  }, [catalogue.data, search])

  // The whole column is the anchor, so the panel starts at its top and takes its height; on narrow
  // screens a line along its top edge, so the panel falls over the column.
  const anchor = useMemo(
    () => ({
      current: {
        getBoundingClientRect: (): DOMRect => {
          const column = triggerRef.current?.closest('aside')?.getBoundingClientRect()
          if (!column) return new DOMRect(0, 0, 0, window.innerHeight)
          return wide ? column : new DOMRect(column.left, column.top, column.width, 0)
        }
      }
    }),
    [wide]
  )

  const setOpenAndReset = (next: boolean): void => {
    setOpen(next)
    if (!next) setSearch('')
  }

  return (
    <Popover open={open} onOpenChange={setOpenAndReset}>
      {/* Mounted with the panel, as in the sidebar editor: one there from the start is not taken
          up as the anchor, and the panel opens at the window's corner. */}
      {open ? <PopoverAnchor virtualRef={anchor} /> : null}
      <PopoverTrigger asChild>
        <NavItem ref={triggerRef} type="button" label={label}>
          <GripIcon {...icon} />
          <span>{label}</span>
        </NavItem>
      </PopoverTrigger>
      <PopoverContent
        side={wide ? 'right' : 'bottom'}
        align="start"
        sideOffset={0}
        avoidCollisions={false}
        aria-label={label}
        className={
          wide
            ? 'flex h-(--radix-popover-trigger-height) w-96 flex-col rounded-none border-y-0 border-l-0 p-0'
            : 'flex h-dvh w-(--radix-popover-trigger-width) flex-col rounded-none border-0 p-0'
        }
      >
        <div className="flex flex-col gap-3 p-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="m-0 text-base font-semibold text-on-surface">{label}</h2>
            <PopoverClose asChild>
              <Button variant="ghost" size="icon" aria-label={t('common.close')}>
                <XIcon {...icon} />
              </Button>
            </PopoverClose>
          </div>
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
          {catalogue.isPending ? (
            <p className="m-0 text-sm text-on-surface-variant">{t('common.loading')}</p>
          ) : catalogue.isError ? (
            <p role="alert" className="m-0 text-sm text-error">
              {t('allApps.loadFailed')}
            </p>
          ) : catalogue.data.length === 0 ? (
            <p className="m-0 text-sm text-on-surface-variant">{t('allApps.empty')}</p>
          ) : matches.length === 0 ? (
            <p className="m-0 text-sm text-on-surface-variant">
              {t('allApps.noMatches', { query: search.trim() })}
            </p>
          ) : (
            // Following a link closes the panel; the page it opened is what the user wanted.
            <ul
              aria-label={label}
              className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(7rem,1fr))] gap-3 p-0"
              onClick={(event) => {
                if (event.target instanceof Element && event.target.closest('a')) {
                  setOpenAndReset(false)
                }
              }}
            >
              {matches.map((component) => (
                <li key={component.id}>
                  <AppTile component={component} />
                </li>
              ))}
            </ul>
          )}
          <p role="status" className="sr-only">
            {catalogue.isSuccess && search.trim()
              ? t('allApps.matches', { count: matches.length })
              : ''}
          </p>
        </div>
      </PopoverContent>
    </Popover>
  )
}

/**
 * One app in the grid: its page inside the app, or for shortcut components their site outside it.
 * The router marks the open page with `aria-current`.
 */
function AppTile({ component }: { component: Component }): React.JSX.Element {
  const { t } = useTranslation()
  const url = externalUrlOf(component)
  const content = (
    <>
      <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary-container text-xl text-on-primary-container">
        <ComponentIcon icon={component.icon} iconUrl={component.iconUrl} siteUrl={url} />
      </span>
      <span className="line-clamp-2 max-w-full text-sm font-semibold">{component.name}</span>
    </>
  )
  if (url) {
    return (
      <a {...externalLinkProps(url)} className={TILE}>
        {content}
        <span className="sr-only">{t('shortcut.opensOutside')}</span>
        <ArrowUpRightIcon {...icon} className="absolute top-2 right-2 text-on-surface-variant" />
      </a>
    )
  }
  return (
    <Link to="/c/$componentId" params={{ componentId: component.id }} className={TILE}>
      {content}
    </Link>
  )
}
