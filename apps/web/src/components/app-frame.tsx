import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { Link, useRouterState } from '@tanstack/react-router'
import { LayoutDashboardIcon, MenuIcon, PanelsTopLeftIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import {
  AppShellLayout,
  Logo,
  NavItem,
  ThemeToggle,
  usePersistedWidth,
  type MobilePaneTab
} from '@ki4jlu/design-system'
import type { Component, Me } from '@justcampus/shared'
import { PageHeaderSlotsContext } from '@/lib/page-header-slots'
import { AccountMenu } from './account-menu'
import { SidebarComponents } from './sidebar-editor'

const LEFT_OPEN_KEY = 'justcampus.shell.left-open'
const LEFT_WIDTH_KEY = 'justcampus.shell.left-width'
const LEFT_WIDTH = { defaultWidth: 256, minWidth: 200, maxWidth: 420 }

type ShellTab = 'nav' | 'page'

interface AppFrameProps {
  me: Me
  /** The user's sidebar components, in their order. */
  sidebarComponents: Component[]
  children: ReactNode
}

/**
 * The chrome around every signed-in page: column with navigation and account, one <main>,
 * and one top bar that carries the page's title and actions (see `PageHeader`).
 */
export function AppFrame({ me, sidebarComponents, children }: AppFrameProps): React.JSX.Element {
  const { t } = useTranslation()
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const [leftOpen, setLeftOpen] = useLeftOpen()
  const [leftWidth, setLeftWidth] = usePersistedWidth(LEFT_WIDTH_KEY, LEFT_WIDTH)
  const [activeTab, setActiveTab] = useTabPerPath(pathname)
  const [titleSlot, setTitleSlot] = useState<HTMLElement | null>(null)
  const [actionsSlot, setActionsSlot] = useState<HTMLElement | null>(null)
  const slots = useMemo(
    () => ({ title: titleSlot, actions: actionsSlot }),
    [titleSlot, actionsSlot]
  )

  const icon = { 'aria-hidden': true, width: '1em', height: '1em' } as const
  const mobileTabs: MobilePaneTab[] = [
    { id: 'nav', icon: <MenuIcon />, label: t('shell.tabNavigation'), pane: 'left' },
    { id: 'page', icon: <PanelsTopLeftIcon />, label: t('shell.tabPage'), pane: 'main' }
  ]

  const nav = (
    <>
      <NavItem asChild label={t('nav.dashboard')} active={pathname === '/'}>
        <Link to="/">
          <LayoutDashboardIcon {...icon} />
          <span>{t('nav.dashboard')}</span>
        </Link>
      </NavItem>
      <SidebarComponents components={sidebarComponents} pathname={pathname} />
    </>
  )

  return (
    <AppShellLayout
      logo={<Logo product="Campus" size="sm" />}
      nav={nav}
      navLabel={t('shell.navLabel')}
      sidebarFooter={<AccountMenu me={me} />}
      pageLabel={<span ref={setTitleSlot} className="flex min-w-0 items-center" />}
      headerActions={
        <>
          <div ref={setActionsSlot} className="flex shrink-0 items-center gap-stack-sm" />
          <ThemeToggle
            themeLabel={t('theme.label')}
            lightLabel={t('theme.light')}
            systemLabel={t('theme.system')}
            darkLabel={t('theme.dark')}
          />
        </>
      }
      leftOpen={leftOpen}
      onLeftOpenChange={setLeftOpen}
      collapseLabel={t('shell.collapse')}
      expandLabel={t('shell.expand')}
      leftWidth={leftWidth}
      leftResize={{
        minWidth: LEFT_WIDTH.minWidth,
        maxWidth: LEFT_WIDTH.maxWidth,
        onWidthChange: setLeftWidth,
        label: t('shell.resize')
      }}
      mobileTabs={mobileTabs}
      activeMobileTab={activeTab}
      onMobileTabChange={(id) => setActiveTab(id === 'nav' ? 'nav' : 'page')}
      mobileTabBarLabel={t('shell.tabsLabel')}
    >
      <div id="main-content" tabIndex={-1} className="flex min-h-0 flex-1 flex-col outline-none">
        <PageHeaderSlotsContext.Provider value={slots}>{children}</PageHeaderSlotsContext.Provider>
      </div>
    </AppShellLayout>
  )
}

/** Whether the column is open, remembered per device. */
function useLeftOpen(): [boolean, (open: boolean) => void] {
  const [open, setOpenState] = useState<boolean>(() => {
    try {
      return window.localStorage.getItem(LEFT_OPEN_KEY) !== 'false'
    } catch {
      return true
    }
  })
  const setOpen = useCallback((next: boolean) => {
    setOpenState(next)
    try {
      window.localStorage.setItem(LEFT_OPEN_KEY, String(next))
    } catch {
      /* A lost preference costs nothing but the preference. */
    }
  }, [])
  return [open, setOpen]
}

/** On a narrow screen, following a link from the navigation tab shows the page it opened. */
function useTabPerPath(pathname: string): [ShellTab, (tab: ShellTab) => void] {
  const [state, setState] = useState<{ tab: ShellTab; path: string }>({
    tab: 'page',
    path: pathname
  })
  const tab = state.path === pathname ? state.tab : 'page'
  const setTab = useCallback(
    (next: ShellTab) => setState({ tab: next, path: pathname }),
    [pathname]
  )
  return [tab, setTab]
}
