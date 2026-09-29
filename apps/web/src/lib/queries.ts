import {
  QueryCache,
  QueryClient,
  queryOptions,
  useMutation,
  useQueryClient,
  type DataTag,
  type UndefinedInitialDataOptions,
  type UseMutationResult
} from '@tanstack/react-query'
import {
  API,
  type Component,
  type ComponentInput,
  type ComponentList,
  type Dashboard,
  type DashboardTile,
  type FeedReadPut,
  type FolderTemplate,
  type FolderTemplateInput,
  type FolderTemplateList,
  type LayoutPreset,
  type LayoutPresetInput,
  type LayoutPresetList,
  type Me,
  type MePatch,
  type PresetAudienceSuggestions,
  type Sidebar,
  type UserFeed,
  type WidgetList
} from '@justcampus/shared'
import { ApiRequestError, apiFetch, isUnauthorized } from './api'
import { isLater } from './feed'

let onUnauthorized: (() => void) | undefined

/** Called when any query answers 401, i.e. the session ended while the app was open. */
export function setUnauthorizedHandler(handler: () => void): void {
  onUnauthorized = handler
}

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error) => {
      if (isUnauthorized(error)) onUnauthorized?.()
    }
  }),
  defaultOptions: {
    queries: {
      retry: (count, error) => !isUnauthorized(error) && count < 2,
      refetchOnWindowFocus: false,
      staleTime: 30_000
    },
    mutations: { retry: false }
  }
})

export const queryKeys = {
  me: ['me'] as const,
  components: ['components'] as const,
  widgets: ['widgets'] as const,
  sidebar: ['sidebar'] as const,
  dashboard: ['dashboard'] as const,
  adminComponents: ['admin', 'components'] as const,
  folderTemplates: ['folder-templates'] as const,
  adminFolderTemplates: ['admin', 'folder-templates'] as const,
  adminPresets: ['admin', 'presets'] as const,
  adminPreset: (id: string) => ['admin', 'preset', id] as const,
  adminPresetAudiences: ['admin', 'preset-audiences'] as const,
  feed: (url: string) => ['feed', url] as const
}

export const meQuery = queryOptions({
  queryKey: queryKeys.me,
  queryFn: () => apiFetch<Me>(API.me),
  staleTime: 5 * 60_000
})

export const componentsQuery = queryOptions({
  queryKey: queryKeys.components,
  queryFn: () => apiFetch<ComponentList>(API.components),
  select: (data) => data.components
})

/** Every widget of every enabled component; join with `componentsQuery` for names and icons. */
export const widgetsQuery = queryOptions({
  queryKey: queryKeys.widgets,
  queryFn: () => apiFetch<WidgetList>(API.widgets),
  select: (data) => data.widgets
})

export const sidebarQuery = queryOptions({
  queryKey: queryKeys.sidebar,
  queryFn: () => apiFetch<Sidebar>(API.sidebar),
  select: (data) => data.componentIds
})

export const dashboardQuery = queryOptions({
  queryKey: queryKeys.dashboard,
  queryFn: () => apiFetch<Dashboard>(API.dashboard),
  select: (data) => data.tiles
})

type FeedQueryKey = ReturnType<typeof queryKeys.feed>
type FeedQueryOptions = UndefinedInitialDataOptions<UserFeed, Error, UserFeed, FeedQueryKey> & {
  queryKey: DataTag<FeedQueryKey, UserFeed, Error>
}

/**
 * A feed as the server fetched and normalised it, with when the user last read
 * it. Fetching does not mark it read; `useFeed` does. Feeds change slowly and the
 * server caches them, so tiles refresh every ten minutes. A feed the server
 * could not reach (`feed_unavailable`) or a rejected URL is not retried: the
 * server has already tried, and the answer will not change within seconds.
 */
export function feedQuery(url: string): FeedQueryOptions {
  return queryOptions({
    queryKey: queryKeys.feed(url),
    queryFn: ({ signal }) =>
      apiFetch<UserFeed>(`${API.feed}?${new URLSearchParams({ url })}`, { signal }),
    staleTime: 5 * 60_000,
    refetchInterval: 10 * 60_000,
    retry: (count, error) => !(error instanceof ApiRequestError) && count < 2
  })
}

export const adminComponentsQuery = queryOptions({
  queryKey: queryKeys.adminComponents,
  queryFn: () => apiFetch<ComponentList>(API.adminComponents),
  select: (data) => data.components
})

/** Enabled folder templates, offered in the "add widget" dialog. */
export const folderTemplatesQuery = queryOptions({
  queryKey: queryKeys.folderTemplates,
  queryFn: () => apiFetch<FolderTemplateList>(API.folderTemplates),
  select: (data) => data.folders
})

export const adminFolderTemplatesQuery = queryOptions({
  queryKey: queryKeys.adminFolderTemplates,
  queryFn: () => apiFetch<FolderTemplateList>(API.adminFolderTemplates),
  select: (data) => data.folders
})

/** Every preset in match order, the `everyone` preset last. */
export const adminPresetsQuery = queryOptions({
  queryKey: queryKeys.adminPresets,
  queryFn: () => apiFetch<LayoutPresetList>(API.adminPresets),
  select: (data) => data.presets
})

type PresetQueryKey = ReturnType<typeof queryKeys.adminPreset>
type PresetQueryOptions = UndefinedInitialDataOptions<
  LayoutPreset,
  Error,
  LayoutPreset,
  PresetQueryKey
> & {
  queryKey: DataTag<PresetQueryKey, LayoutPreset, Error>
}

/**
 * One preset for its editor. The editor writes its changes into this entry at once, so it is
 * not refetched in the background while saves may still be on their way. An answer from the
 * server (a deleted preset's `not_found`) is not retried.
 */
export function adminPresetQuery(id: string): PresetQueryOptions {
  return queryOptions({
    queryKey: queryKeys.adminPreset(id),
    queryFn: () => apiFetch<LayoutPreset>(API.adminPreset(id)),
    staleTime: Infinity,
    retry: (count, error) => !(error instanceof ApiRequestError) && count < 2
  })
}

/** Role and group names seen at sign-ins, suggested in the audience field. */
export const adminPresetAudiencesQuery = queryOptions({
  queryKey: queryKeys.adminPresetAudiences,
  queryFn: () => apiFetch<PresetAudienceSuggestions>(API.adminPresetAudiences),
  staleTime: 5 * 60_000
})

export function useUpdateMe(): UseMutationResult<Me, Error, MePatch> {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (patch: MePatch) => apiFetch<Me>(API.me, { method: 'PATCH', json: patch }),
    onSuccess: (me) => client.setQueryData(queryKeys.me, me)
  })
}

/**
 * Marks a feed read as of the copy the user saw. The cached copy then carries the new `readAt`,
 * so a view opened later shows its entries as read; the server never moves `readAt` back, and
 * neither does the cache.
 */
export function useMarkFeedRead(): UseMutationResult<void, Error, FeedReadPut> {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (read: FeedReadPut) => apiFetch<void>(API.feedRead, { method: 'PUT', json: read }),
    onSuccess: (_data, { url, readAt }) =>
      client.setQueryData<UserFeed>(queryKeys.feed(url), (feed) =>
        feed && (feed.readAt === null || isLater(readAt, feed.readAt)) ? { ...feed, readAt } : feed
      )
  })
}

interface OptimisticContext<T> {
  previous: T | undefined
}

/** Replaces the sidebar optimistically; the caller shows the error, the cache rolls back. */
export function useSaveSidebar(): UseMutationResult<
  Sidebar,
  Error,
  string[],
  OptimisticContext<Sidebar>
> {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (componentIds: string[]) =>
      apiFetch<Sidebar>(API.sidebar, { method: 'PUT', json: { componentIds } }),
    onMutate: async (componentIds) => {
      await client.cancelQueries({ queryKey: queryKeys.sidebar })
      const previous = client.getQueryData<Sidebar>(queryKeys.sidebar)
      client.setQueryData<Sidebar>(queryKeys.sidebar, { componentIds })
      return { previous }
    },
    onError: (_error, _ids, context) => {
      if (context?.previous) client.setQueryData(queryKeys.sidebar, context.previous)
    },
    onSettled: () => client.invalidateQueries({ queryKey: queryKeys.sidebar })
  })
}

/** Replaces the dashboard; the cache shows the new tiles at once and refetches on failure. */
export function useSaveDashboard(
  onError?: () => void
): UseMutationResult<Dashboard, Error, DashboardTile[]> {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (tiles: DashboardTile[]) =>
      apiFetch<Dashboard>(API.dashboard, { method: 'PUT', json: { tiles } }),
    onMutate: (tiles) => client.setQueryData<Dashboard>(queryKeys.dashboard, { tiles }),
    onError: () => {
      onError?.()
      return client.invalidateQueries({ queryKey: queryKeys.dashboard })
    }
  })
}

/**
 * Catalogue changes reach every user-facing list, so they all refetch. Folder
 * templates too: the widgets of a deleted or disabled component vanish from them.
 */
function invalidateCatalogue(client: QueryClient): Promise<void> {
  return Promise.all([
    client.invalidateQueries({ queryKey: queryKeys.adminComponents }),
    client.invalidateQueries({ queryKey: queryKeys.components }),
    client.invalidateQueries({ queryKey: queryKeys.widgets }),
    client.invalidateQueries({ queryKey: queryKeys.sidebar }),
    client.invalidateQueries({ queryKey: queryKeys.dashboard }),
    invalidateFolderTemplates(client)
  ]).then(() => undefined)
}

/** Template changes reach the admin list and the templates users are offered. */
function invalidateFolderTemplates(client: QueryClient): Promise<void> {
  return Promise.all([
    client.invalidateQueries({ queryKey: queryKeys.adminFolderTemplates }),
    client.invalidateQueries({ queryKey: queryKeys.folderTemplates })
  ]).then(() => undefined)
}

export function useCreateComponent(): UseMutationResult<Component, Error, ComponentInput> {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (input: ComponentInput) =>
      apiFetch<Component>(API.adminComponents, { method: 'POST', json: input }),
    onSuccess: () => invalidateCatalogue(client)
  })
}

/** Full replace of one component; the admin list shows the change at once (the enabled switch). */
export function useUpdateComponent(): UseMutationResult<
  Component,
  Error,
  { id: string; input: ComponentInput },
  OptimisticContext<ComponentList>
> {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: ComponentInput }) =>
      apiFetch<Component>(API.adminComponent(id), { method: 'PUT', json: input }),
    onMutate: async ({ id, input }) => {
      await client.cancelQueries({ queryKey: queryKeys.adminComponents })
      const previous = client.getQueryData<ComponentList>(queryKeys.adminComponents)
      if (previous) {
        const components = previous.components.map((component) =>
          component.id === id ? { ...component, ...input } : component
        )
        client.setQueryData<ComponentList>(queryKeys.adminComponents, { components })
      }
      return { previous }
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) client.setQueryData(queryKeys.adminComponents, context.previous)
    },
    onSettled: () => invalidateCatalogue(client)
  })
}

export function useDeleteComponent(): UseMutationResult<void, Error, string> {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(API.adminComponent(id), { method: 'DELETE' }),
    onSuccess: () => invalidateCatalogue(client)
  })
}

export function useReorderComponents(): UseMutationResult<
  void,
  Error,
  string[],
  OptimisticContext<ComponentList>
> {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (ids: string[]) =>
      apiFetch<void>(API.adminComponentOrder, { method: 'PUT', json: { ids } }),
    onMutate: async (ids) => {
      await client.cancelQueries({ queryKey: queryKeys.adminComponents })
      const previous = client.getQueryData<ComponentList>(queryKeys.adminComponents)
      if (previous) {
        const byId = new Map(previous.components.map((component) => [component.id, component]))
        const components = ids.flatMap((id) => byId.get(id) ?? [])
        client.setQueryData<ComponentList>(queryKeys.adminComponents, { components })
      }
      return { previous }
    },
    onError: (_error, _ids, context) => {
      if (context?.previous) client.setQueryData(queryKeys.adminComponents, context.previous)
    },
    onSettled: () => invalidateCatalogue(client)
  })
}

export function useCreateFolderTemplate(): UseMutationResult<
  FolderTemplate,
  Error,
  FolderTemplateInput
> {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (input: FolderTemplateInput) =>
      apiFetch<FolderTemplate>(API.adminFolderTemplates, { method: 'POST', json: input }),
    onSuccess: () => invalidateFolderTemplates(client)
  })
}

/** Full replace of one template; the admin list shows the change at once (the enabled switch). */
export function useUpdateFolderTemplate(): UseMutationResult<
  FolderTemplate,
  Error,
  { id: string; input: FolderTemplateInput },
  OptimisticContext<FolderTemplateList>
> {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: FolderTemplateInput }) =>
      apiFetch<FolderTemplate>(API.adminFolderTemplate(id), { method: 'PUT', json: input }),
    onMutate: async ({ id, input }) => {
      await client.cancelQueries({ queryKey: queryKeys.adminFolderTemplates })
      const previous = client.getQueryData<FolderTemplateList>(queryKeys.adminFolderTemplates)
      if (previous) {
        const folders = previous.folders.map((folder) =>
          folder.id === id ? { ...folder, ...input } : folder
        )
        client.setQueryData<FolderTemplateList>(queryKeys.adminFolderTemplates, { folders })
      }
      return { previous }
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) client.setQueryData(queryKeys.adminFolderTemplates, context.previous)
    },
    onSettled: () => invalidateFolderTemplates(client)
  })
}

export function useDeleteFolderTemplate(): UseMutationResult<void, Error, string> {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(API.adminFolderTemplate(id), { method: 'DELETE' }),
    onSuccess: () => invalidateFolderTemplates(client)
  })
}

export function useReorderFolderTemplates(): UseMutationResult<
  void,
  Error,
  string[],
  OptimisticContext<FolderTemplateList>
> {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (ids: string[]) =>
      apiFetch<void>(API.adminFolderTemplateOrder, { method: 'PUT', json: { ids } }),
    onMutate: async (ids) => {
      await client.cancelQueries({ queryKey: queryKeys.adminFolderTemplates })
      const previous = client.getQueryData<FolderTemplateList>(queryKeys.adminFolderTemplates)
      if (previous) {
        const byId = new Map(previous.folders.map((folder) => [folder.id, folder]))
        const folders = ids.flatMap((id) => byId.get(id) ?? [])
        client.setQueryData<FolderTemplateList>(queryKeys.adminFolderTemplates, { folders })
      }
      return { previous }
    },
    onError: (_error, _ids, context) => {
      if (context?.previous) client.setQueryData(queryKeys.adminFolderTemplates, context.previous)
    },
    onSettled: () => invalidateFolderTemplates(client)
  })
}

/** Creates a preset; its editor then opens from the cache without a request. */
export function useCreateLayoutPreset(): UseMutationResult<LayoutPreset, Error, LayoutPresetInput> {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (input: LayoutPresetInput) =>
      apiFetch<LayoutPreset>(API.adminPresets, { method: 'POST', json: input }),
    onSuccess: (preset) => {
      client.setQueryData(queryKeys.adminPreset(preset.id), preset)
      return client.invalidateQueries({ queryKey: queryKeys.adminPresets })
    }
  })
}

/**
 * Full replace of one preset; its editor shows the change at once. Saves share one mutation
 * scope, so they run one after another and reach the server in the order they were made. A
 * failed save refetches the preset, so the editor shows what the server kept.
 */
export function useUpdateLayoutPreset(): UseMutationResult<
  LayoutPreset,
  Error,
  { id: string; input: LayoutPresetInput }
> {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: LayoutPresetInput }) =>
      apiFetch<LayoutPreset>(API.adminPreset(id), { method: 'PUT', json: input }),
    scope: { id: 'admin-presets' },
    onMutate: ({ id, input }) => {
      const previous = client.getQueryData<LayoutPreset>(queryKeys.adminPreset(id))
      if (previous) {
        client.setQueryData<LayoutPreset>(queryKeys.adminPreset(id), { ...previous, ...input })
      }
    },
    onError: (_error, { id }) => client.invalidateQueries({ queryKey: queryKeys.adminPreset(id) }),
    onSettled: () => client.invalidateQueries({ queryKey: queryKeys.adminPresets })
  })
}

/**
 * Deletes a preset. Its cached copy goes too unless its editor is still open; the editor leaves
 * the page and drops the copy itself, rather than refetching a preset that is gone.
 */
export function useDeleteLayoutPreset(): UseMutationResult<void, Error, string> {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(API.adminPreset(id), { method: 'DELETE' }),
    onSuccess: (_data, id) => {
      client.removeQueries({ queryKey: queryKeys.adminPreset(id), type: 'inactive' })
      return client.invalidateQueries({ queryKey: queryKeys.adminPresets })
    }
  })
}

export function useReorderLayoutPresets(): UseMutationResult<
  void,
  Error,
  string[],
  OptimisticContext<LayoutPresetList>
> {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (ids: string[]) =>
      apiFetch<void>(API.adminPresetOrder, { method: 'PUT', json: { ids } }),
    onMutate: async (ids) => {
      await client.cancelQueries({ queryKey: queryKeys.adminPresets })
      const previous = client.getQueryData<LayoutPresetList>(queryKeys.adminPresets)
      if (previous) {
        const byId = new Map(previous.presets.map((preset) => [preset.id, preset]))
        const presets = ids.flatMap((id) => byId.get(id) ?? [])
        client.setQueryData<LayoutPresetList>(queryKeys.adminPresets, { presets })
      }
      return { previous }
    },
    onError: (_error, _ids, context) => {
      if (context?.previous) client.setQueryData(queryKeys.adminPresets, context.previous)
    },
    onSettled: () => client.invalidateQueries({ queryKey: queryKeys.adminPresets })
  })
}

/** The input shape of an existing preset, for full-replace PUTs. */
export function toLayoutPresetInput(preset: LayoutPreset): LayoutPresetInput {
  const { name, audience, sidebar, dashboard } = preset
  return { name, audience, sidebar, dashboard }
}

/** The input shape of an existing template, for full-replace PUTs. */
export function toFolderTemplateInput(template: FolderTemplate): FolderTemplateInput {
  const { name, icon, enabled, widgets } = template
  return { name, icon, enabled, widgets }
}

/** The shared input shape of an existing component, for full-replace PUTs. */
export function toComponentInput(component: Component): ComponentInput {
  const { name, icon, iconUrl, enabled } = component
  const base = { name, icon, iconUrl, enabled }
  switch (component.type) {
    case 'iframe':
      return { ...base, type: component.type, config: component.config }
    case 'rss':
      return { ...base, type: component.type, config: component.config }
    case 'link':
      return { ...base, type: component.type, config: component.config }
  }
}
