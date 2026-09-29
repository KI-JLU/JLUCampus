import { useMemo } from 'react'
import { Outlet } from '@tanstack/react-router'
import { useQuery, useSuspenseQuery } from '@tanstack/react-query'
import type { Component } from '@justcampus/shared'
import { AppFrame } from '@/components/app-frame'
import { componentsQuery, meQuery, sidebarQuery } from '@/lib/queries'

/** Every signed-in route: the session is loaded by the route's `beforeLoad`. */
export function AppLayout(): React.JSX.Element {
  const { data: me } = useSuspenseQuery(meQuery)
  const { data: components } = useQuery(componentsQuery)
  const { data: sidebarIds } = useQuery(sidebarQuery)

  const sidebarComponents = useMemo(() => {
    if (!components || !sidebarIds) return []
    const byId = new Map(components.map((component) => [component.id, component]))
    return sidebarIds.flatMap((id): Component[] => {
      const component = byId.get(id)
      return component ? [component] : []
    })
  }, [components, sidebarIds])

  return (
    <AppFrame me={me} sidebarComponents={sidebarComponents}>
      <Outlet />
    </AppFrame>
  )
}
