/**
 * The contract between the JLU Campus server and its two frontends (web and
 * desktop). Everything that crosses the HTTP boundary is described here once,
 * as Zod schemas; the server validates request bodies with them and the
 * clients type their responses from them.
 */
import { z } from 'zod'

// ---------------------------------------------------------------------------
// Languages
// ---------------------------------------------------------------------------

export const LANGUAGES = ['de', 'en'] as const
export const languageSchema = z.enum(LANGUAGES)
export type Language = z.infer<typeof languageSchema>
export const DEFAULT_LANGUAGE: Language = 'de'

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

export const USER_ROLES = ['user', 'admin'] as const
export const userRoleSchema = z.enum(USER_ROLES)
export type UserRole = z.infer<typeof userRoleSchema>

/** The signed-in user as the API reports them. */
export const meSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  image: z.string().nullable(),
  role: userRoleSchema,
  /** `null` until the user picked one; clients then fall back to the browser language. */
  language: languageSchema.nullable()
})
export type Me = z.infer<typeof meSchema>

export const mePatchSchema = z.object({
  language: languageSchema.nullable().optional()
})
export type MePatch = z.infer<typeof mePatchSchema>

// ---------------------------------------------------------------------------
// Dashboard grid geometry
// ---------------------------------------------------------------------------

/** Column count of the dashboard grid at desktop width. */
export const DASHBOARD_COLS = 12
/** Height of one grid row in CSS pixels. */
export const DASHBOARD_ROW_HEIGHT = 48
export const TILE_MIN_W = 2
export const TILE_MIN_H = 2
export const TILE_MAX_H = 40
/** Size of a freshly added tile. */
export const TILE_DEFAULT_W = 4
export const TILE_DEFAULT_H = 6

// ---------------------------------------------------------------------------
// Components (the admin-managed catalogue; each one is a page in the sidebar)
// ---------------------------------------------------------------------------

/**
 * Component adapters: `iframe` embeds a site, `rss` shows a feed, `link` is a
 * shortcut that opens its URL outside the app, `translator` is a module (see
 * `SINGLETON_COMPONENT_TYPES`). The type decides the page and the widgets a
 * component adds (see `COMPONENT_WIDGETS`). A future adapter (Stud.IP, …) adds
 * a literal here, a config schema, its widgets, and a renderer in the web
 * app's adapter registry.
 */
export const COMPONENT_TYPES = ['iframe', 'rss', 'link', 'translator'] as const
export const componentTypeSchema = z.enum(COMPONENT_TYPES)
export type ComponentType = z.infer<typeof componentTypeSchema>

/**
 * Modules: small apps built into JLU Campus rather than links to somewhere
 * else. Each module type exists as exactly one component, which the server
 * creates (disabled) at startup; admins configure and enable it but cannot
 * create a second one or delete it. A module has its own endpoints under
 * `API.module(type)`, may keep secrets (API keys, see `COMPONENT_SECRETS`)
 * and may own database tables that reference its component.
 */
export const SINGLETON_COMPONENT_TYPES = ['translator'] as const satisfies readonly ComponentType[]
export type SingletonComponentType = (typeof SINGLETON_COMPONENT_TYPES)[number]

export function isSingletonType(type: ComponentType): type is SingletonComponentType {
  return (SINGLETON_COMPONENT_TYPES as readonly ComponentType[]).includes(type)
}

/** `https:` anywhere, `http:` only for loopback hosts in development. */
export const httpsUrlSchema = z
  .string()
  .trim()
  .max(2048)
  .url()
  .refine(
    (value) => {
      // Zod 4 still runs refinements after `.url()` failed, so parsing must not throw.
      let url: URL
      try {
        url = new URL(value)
      } catch {
        return false
      }
      if (url.protocol === 'https:') return true
      return url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
    },
    { message: 'URL must use https (http is only allowed for localhost)' }
  )

/**
 * Any `http:` or `https:` URL. Used where nothing is embedded into the app
 * (shortcuts open in a new tab, feeds are fetched by the server), so plain
 * http is harmless here.
 */
export const externalUrlSchema = z
  .string()
  .trim()
  .max(2048)
  .url()
  .refine(
    (value) => {
      let url: URL
      try {
        url = new URL(value)
      } catch {
        return false
      }
      return url.protocol === 'https:' || url.protocol === 'http:'
    },
    { message: 'URL must use http or https' }
  )

export const iframeComponentConfigSchema = z.object({
  url: httpsUrlSchema
})
export type IframeComponentConfig = z.infer<typeof iframeComponentConfigSchema>

export const rssComponentConfigSchema = z.object({
  /** RSS 2.0, RSS 1.0 (RDF), Atom or JSON Feed; fetched through `API.feed`. */
  feedUrl: externalUrlSchema
})
export type RssComponentConfig = z.infer<typeof rssComponentConfigSchema>

export const linkComponentConfigSchema = z.object({
  url: externalUrlSchema
})
export type LinkComponentConfig = z.infer<typeof linkComponentConfigSchema>

/** Languages the translator offers, as ISO 639-1 codes. */
export const TRANSLATOR_LANGUAGES = [
  'de',
  'en',
  'fr',
  'es',
  'it',
  'nl',
  'pl',
  'pt',
  'tr',
  'uk',
  'ru',
  'ar',
  'zh',
  'ja'
] as const
export const translatorLanguageSchema = z.enum(TRANSLATOR_LANGUAGES)
export type TranslatorLanguage = z.infer<typeof translatorLanguageSchema>

/**
 * An engine the translator offers: `deepl`, or `llm:` followed by the id of
 * one of the admin's `llmModels`.
 */
export const translatorEngineIdSchema = z
  .string()
  .regex(/^(deepl|llm:.{1,200})$/, 'Expected "deepl" or "llm:<model id>"')
export type TranslatorEngineId = z.infer<typeof translatorEngineIdSchema>

/**
 * One model of the translator's OpenAI-compatible endpoint (`llmBaseUrl`).
 * `id` is what the endpoint expects in `model`; `label` is what users see.
 */
export const translatorLlmModelSchema = z.object({
  id: z.string().trim().min(1).max(200),
  label: z.string().trim().min(1).max(80)
})
export type TranslatorLlmModel = z.infer<typeof translatorLlmModelSchema>

export const TRANSLATOR_LLM_MODELS_MAX = 20

/**
 * The translator works with two kinds of engines: DeepL (translate, and
 * DeepL Write to rephrase) and the models of an OpenAI-compatible chat
 * completions endpoint. DeepL is offered once its API key is set, each listed
 * model once `llmBaseUrl` is set. Fields added after the first release have
 * defaults, so older stored configs still parse.
 */
export const translatorComponentConfigSchema = z.object({
  /** Target language a user starts with. */
  defaultTargetLanguage: translatorLanguageSchema,
  /**
   * DeepL API origin, e.g. `https://api.deepl.com`. `null` picks it from the
   * key: free keys (ending in `:fx`) use `https://api-free.deepl.com`.
   */
  deeplApiUrl: httpsUrlSchema.nullable().default(null),
  /** Base URL of the OpenAI-compatible API, up to and including `/v1`. */
  llmBaseUrl: httpsUrlSchema.nullable().default(null),
  llmModels: z
    .array(translatorLlmModelSchema)
    .max(TRANSLATOR_LLM_MODELS_MAX)
    .refine((models) => new Set(models.map((model) => model.id)).size === models.length, {
      message: 'Model ids must be unique'
    })
    .default([]),
  /** Engine id (see `translatorEngineIdSchema`) users start with; `null` or unavailable: the first one. */
  defaultEngine: translatorEngineIdSchema.nullable().default(null),
  /** Offers document translation (DeepL only, so it also needs the DeepL key). */
  documentsEnabled: z.boolean().default(false)
})
export type TranslatorComponentConfig = z.infer<typeof translatorComponentConfigSchema>

export type ComponentConfig =
  IframeComponentConfig | RssComponentConfig | LinkComponentConfig | TranslatorComponentConfig

// ---------------------------------------------------------------------------
// Component secrets (admin-only settings such as API keys)
// ---------------------------------------------------------------------------

/**
 * The secrets each component type keeps. The server stores them encrypted and
 * never returns them: admins only learn whether each one is set
 * (`adminComponentSchema.secrets`) and can replace or remove it. Only the
 * type's own endpoints (`API.module`) read them.
 */
export const COMPONENT_SECRETS = {
  iframe: [],
  rss: [],
  link: [],
  translator: ['deeplApiKey', 'llmApiKey']
} as const satisfies { [T in ComponentType]: readonly string[] }

export type SecretKey<T extends ComponentType = ComponentType> = T extends ComponentType
  ? (typeof COMPONENT_SECRETS)[T][number]
  : never

export const SECRET_VALUE_MAX = 4096

/**
 * A change to one secret: a string sets it, `null` removes it, an absent key
 * leaves it unchanged. Omitting `secrets` altogether changes nothing.
 */
const secretChangeSchema = z.string().trim().min(1).max(SECRET_VALUE_MAX).nullable().optional()

const translatorSecretsInputSchema = z
  .strictObject({ deeplApiKey: secretChangeSchema, llmApiKey: secretChangeSchema })
  .optional()

/** Which of a component's secrets are set, keyed by secret. */
const translatorSecretsStatusSchema = z.object({ deeplApiKey: z.boolean(), llmApiKey: z.boolean() })
const noSecretsStatusSchema = z.object({})

/**
 * A Lucide icon name in kebab-case, e.g. `calendar-days`. Rendered with
 * `DynamicIcon` from `lucide-react/dynamic`.
 */
export const lucideIconNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Expected a kebab-case Lucide icon name')

const componentBaseSchema = z.object({
  name: z.string().trim().min(1).max(80),
  /** Lucide icon name. Used when `iconUrl` is null. */
  icon: lucideIconNameSchema.nullable(),
  /** Optional image override (favicon, logo). Takes precedence over `icon`. */
  iconUrl: httpsUrlSchema.nullable(),
  /**
   * Disabled components stay in the admin list but vanish, with their widgets,
   * from every sidebar, dashboard and folder.
   */
  enabled: z.boolean()
})

/**
 * What an admin sends to create or fully replace a component. Module types
 * (`SINGLETON_COMPONENT_TYPES`) cannot be created, only replaced, and a
 * component's type cannot change into or out of a module type.
 */
export const componentInputSchema = z.discriminatedUnion('type', [
  componentBaseSchema.extend({ type: z.literal('iframe'), config: iframeComponentConfigSchema }),
  componentBaseSchema.extend({ type: z.literal('rss'), config: rssComponentConfigSchema }),
  componentBaseSchema.extend({ type: z.literal('link'), config: linkComponentConfigSchema }),
  componentBaseSchema.extend({
    type: z.literal('translator'),
    config: translatorComponentConfigSchema,
    secrets: translatorSecretsInputSchema
  })
])
export type ComponentInput = z.infer<typeof componentInputSchema>

const storedComponentSchema = componentBaseSchema.extend({
  id: z.string().uuid(),
  /** Position in the admin catalogue and in pickers. */
  sortOrder: z.number().int(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
})

/** A component as the API returns it. Secrets are never part of it. */
export const componentSchema = z.discriminatedUnion('type', [
  storedComponentSchema.extend({ type: z.literal('iframe'), config: iframeComponentConfigSchema }),
  storedComponentSchema.extend({ type: z.literal('rss'), config: rssComponentConfigSchema }),
  storedComponentSchema.extend({ type: z.literal('link'), config: linkComponentConfigSchema }),
  storedComponentSchema.extend({
    type: z.literal('translator'),
    config: translatorComponentConfigSchema
  })
])
export type Component = z.infer<typeof componentSchema>

export const componentListSchema = z.object({ components: z.array(componentSchema) })
export type ComponentList = z.infer<typeof componentListSchema>

/** A component as the admin endpoints return it: plus which of its secrets are set. */
export const adminComponentSchema = z.discriminatedUnion('type', [
  storedComponentSchema.extend({
    type: z.literal('iframe'),
    config: iframeComponentConfigSchema,
    secrets: noSecretsStatusSchema
  }),
  storedComponentSchema.extend({
    type: z.literal('rss'),
    config: rssComponentConfigSchema,
    secrets: noSecretsStatusSchema
  }),
  storedComponentSchema.extend({
    type: z.literal('link'),
    config: linkComponentConfigSchema,
    secrets: noSecretsStatusSchema
  }),
  storedComponentSchema.extend({
    type: z.literal('translator'),
    config: translatorComponentConfigSchema,
    secrets: translatorSecretsStatusSchema
  })
])
export type AdminComponent = z.infer<typeof adminComponentSchema>

export const adminComponentListSchema = z.object({ components: z.array(adminComponentSchema) })
export type AdminComponentList = z.infer<typeof adminComponentListSchema>

/** New catalogue order: every existing id exactly once. */
export const componentOrderSchema = z.object({
  ids: z.array(z.string().uuid()).min(1)
})
export type ComponentOrder = z.infer<typeof componentOrderSchema>

// ---------------------------------------------------------------------------
// Widgets (what a component adds to the dashboard, fixed in code per type)
// ---------------------------------------------------------------------------

/** Size limits of one widget, in grid cells. Tiles cannot shrink below the minimum. */
export interface WidgetDefinition {
  minW: number
  minH: number
}

/**
 * The widgets each component type adds, keyed by widget key. Every enabled
 * component offers all widgets of its type; there is nothing to configure per
 * widget. `iframe.launcher` opens the page, `rss.feed` lists the newest
 * entries, `link.shortcut` opens the URL outside the app, `translator.quick`
 * translates a short text in place.
 */
export const COMPONENT_WIDGETS = {
  iframe: { launcher: { minW: TILE_MIN_W, minH: TILE_MIN_H } },
  rss: { feed: { minW: TILE_MIN_W, minH: TILE_MIN_H } },
  link: { shortcut: { minW: TILE_MIN_W, minH: TILE_MIN_H } },
  translator: { quick: { minW: 3, minH: 5 } }
} as const satisfies { [T in ComponentType]: Record<string, WidgetDefinition> }

export type WidgetKey<T extends ComponentType = ComponentType> = T extends ComponentType
  ? keyof (typeof COMPONENT_WIDGETS)[T] & string
  : never

/** The definition of `key` for a component of `type`, or `undefined` if the type has no such widget. */
export function widgetDefinition(type: ComponentType, key: string): WidgetDefinition | undefined {
  const widgets: Readonly<Record<string, WidgetDefinition>> = COMPONENT_WIDGETS[type]
  return Object.hasOwn(widgets, key) ? widgets[key] : undefined
}

export const widgetKeySchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z][a-zA-Z0-9]*$/, 'Expected a widget key')

/**
 * Points at one widget: a component plus one of its type's widget keys.
 * Schemas only check the shape; the server checks that the key belongs to the
 * component's type.
 */
export const widgetRefSchema = z.object({
  componentId: z.string().uuid(),
  widgetKey: widgetKeySchema
})
export type WidgetRef = z.infer<typeof widgetRefSchema>

/** A stable string for a widget reference, for sets and React keys. */
export function widgetRefKey(ref: WidgetRef): string {
  return `${ref.componentId}:${ref.widgetKey}`
}

/** A widget as the API lists it: derived from the enabled components and `COMPONENT_WIDGETS`. */
export const widgetSchema = widgetRefSchema.extend({
  minW: z.number().int().min(TILE_MIN_W).max(DASHBOARD_COLS),
  minH: z.number().int().min(TILE_MIN_H).max(TILE_MAX_H)
})
export type Widget = z.infer<typeof widgetSchema>

export const widgetListSchema = z.object({ widgets: z.array(widgetSchema) })
export type WidgetList = z.infer<typeof widgetListSchema>

// ---------------------------------------------------------------------------
// Sidebar (per user: which components, in which order)
// ---------------------------------------------------------------------------

export const sidebarSchema = z.object({
  /** Component ids in display order. Only enabled components are returned. */
  componentIds: z.array(z.string().uuid())
})
export type Sidebar = z.infer<typeof sidebarSchema>

/** Replaces the whole sidebar. Duplicates are rejected. */
export const sidebarPutSchema = sidebarSchema.refine(
  ({ componentIds }) => new Set(componentIds).size === componentIds.length,
  { message: 'A component can appear in the sidebar only once' }
)

// ---------------------------------------------------------------------------
// Dashboard (per user: a free grid of tiles)
// ---------------------------------------------------------------------------

const tileGeometrySchema = z.object({
  /** Client-generated UUID, stable across saves. */
  id: z.string().uuid(),
  x: z
    .number()
    .int()
    .min(0)
    .max(DASHBOARD_COLS - TILE_MIN_W),
  y: z.number().int().min(0),
  w: z.number().int().min(TILE_MIN_W).max(DASHBOARD_COLS),
  h: z.number().int().min(TILE_MIN_H).max(TILE_MAX_H)
})

const fitsGrid = { message: 'Tile exceeds the grid width' }
const insideGrid = (tile: { x: number; w: number }): boolean => tile.x + tile.w <= DASHBOARD_COLS

/** A tile showing one widget. One widget may appear in several tiles. */
export const widgetTileSchema = tileGeometrySchema
  .extend({ kind: z.literal('widget'), ...widgetRefSchema.shape })
  .refine(insideGrid, fitsGrid)
export type WidgetTile = z.infer<typeof widgetTileSchema>

export const FOLDER_TITLE_MAX = 40
/** Longest title of a personal shortcut or feed tile. */
export const TILE_TITLE_MAX = 80

/**
 * A user's own shortcut to any URL. It opens outside the app. With `icon`
 * null the site's favicon is shown, falling back to a generic link icon.
 */
const shortcutFields = {
  /** Client-generated UUID. */
  id: z.string().uuid(),
  title: z.string().trim().min(1).max(TILE_TITLE_MAX),
  url: externalUrlSchema,
  icon: lucideIconNameSchema.nullable()
}

/** A shortcut as a tile of its own. */
export const linkTileSchema = tileGeometrySchema
  .extend({ kind: z.literal('link'), ...shortcutFields })
  .refine(insideGrid, fitsGrid)
export type LinkTile = z.infer<typeof linkTileSchema>

/** A tile listing the newest entries of any RSS, Atom or JSON feed the user chose. */
export const feedTileSchema = tileGeometrySchema
  .extend({
    kind: z.literal('feed'),
    /** `null` shows the feed's own title. */
    title: z.string().trim().min(1).max(TILE_TITLE_MAX).nullable(),
    feedUrl: externalUrlSchema
  })
  .refine(insideGrid, fitsGrid)
export type FeedTile = z.infer<typeof feedTileSchema>

/** One entry of a folder: a widget or a personal shortcut. */
export const folderItemSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('widget'), ...widgetRefSchema.shape }),
  z.object({ kind: z.literal('link'), ...shortcutFields })
])
export type FolderItem = z.infer<typeof folderItemSchema>
export type FolderLinkItem = Extract<FolderItem, { kind: 'link' }>

function uniqueFolderItems(items: readonly FolderItem[]): boolean {
  const keys = items.map((item) =>
    item.kind === 'widget' ? `widget:${widgetRefKey(item)}` : `link:${item.id}`
  )
  return new Set(keys).size === keys.length
}

/** A tile holding widgets and shortcuts, shown as a folder of small icons. */
export const folderTileSchema = tileGeometrySchema
  .extend({
    kind: z.literal('folder'),
    title: z.string().trim().min(1).max(FOLDER_TITLE_MAX),
    /** Lucide icon shown next to the title; absent or null shows a folder icon. */
    icon: lucideIconNameSchema.nullable().optional(),
    /** Contents in display order; each widget and each shortcut id at most once. */
    items: z.array(folderItemSchema).refine(uniqueFolderItems, {
      message: 'A widget or shortcut can be in a folder only once'
    })
  })
  .refine(insideGrid, fitsGrid)
export type FolderTile = z.infer<typeof folderTileSchema>

export const DASHBOARD_TILE_KINDS = ['widget', 'folder', 'link', 'feed'] as const

export const dashboardTileSchema = z.discriminatedUnion('kind', [
  widgetTileSchema,
  folderTileSchema,
  linkTileSchema,
  feedTileSchema
])
export type DashboardTile = z.infer<typeof dashboardTileSchema>

export const dashboardSchema = z.object({
  /** Widget tiles of disabled components are left out; folders list only enabled widgets and shortcuts. */
  tiles: z.array(dashboardTileSchema)
})
export type Dashboard = z.infer<typeof dashboardSchema>

/** Replaces the whole dashboard. Tile ids and folder shortcut ids must be unique. */
export const dashboardPutSchema = dashboardSchema
  .refine(({ tiles }) => new Set(tiles.map((tile) => tile.id)).size === tiles.length, {
    message: 'Tile ids must be unique'
  })
  .refine(
    ({ tiles }) => {
      const ids = tiles.flatMap((tile) =>
        tile.kind === 'folder'
          ? tile.items.flatMap((item) => (item.kind === 'link' ? [item.id] : []))
          : []
      )
      return new Set(ids).size === ids.length
    },
    { message: 'A shortcut can be in only one folder' }
  )

// ---------------------------------------------------------------------------
// Folder templates (admin-defined folders users can add to their dashboard)
// ---------------------------------------------------------------------------

/**
 * A folder an admin predefines. Adding it to a dashboard copies it into an
 * ordinary folder tile (title, icon, widgets); later changes to the template
 * do not reach existing copies.
 */
export const folderTemplateInputSchema = z.object({
  name: z.string().trim().min(1).max(FOLDER_TITLE_MAX),
  icon: lucideIconNameSchema.nullable(),
  /** Disabled templates stay in the admin list but are not offered to users. */
  enabled: z.boolean(),
  /** Widgets in display order, each at most once. */
  widgets: z
    .array(widgetRefSchema)
    .refine((refs) => new Set(refs.map(widgetRefKey)).size === refs.length, {
      message: 'A widget can be in a folder only once'
    })
})
export type FolderTemplateInput = z.infer<typeof folderTemplateInputSchema>

/** A template as the API returns it. The user endpoint lists only widgets of enabled components. */
export const folderTemplateSchema = folderTemplateInputSchema.extend({
  id: z.string().uuid(),
  sortOrder: z.number().int(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
})
export type FolderTemplate = z.infer<typeof folderTemplateSchema>

export const folderTemplateListSchema = z.object({ folders: z.array(folderTemplateSchema) })
export type FolderTemplateList = z.infer<typeof folderTemplateListSchema>

/** New template order: every existing template id exactly once. */
export const folderTemplateOrderSchema = componentOrderSchema
export type FolderTemplateOrder = z.infer<typeof folderTemplateOrderSchema>

// ---------------------------------------------------------------------------
// Layout presets (admin-defined starting sidebar and dashboard)
// ---------------------------------------------------------------------------

/**
 * Who a preset is for: everyone holding a Keycloak realm role, every member of
 * a Keycloak group (full path, e.g. `/Studierende`), or everyone as the
 * fallback. At most one `everyone` preset exists.
 */
export const presetAudienceSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('role'), name: z.string().trim().min(1).max(255) }),
  z.object({ kind: z.literal('group'), name: z.string().trim().min(1).max(255) }),
  z.object({ kind: z.literal('everyone') })
])
export type PresetAudience = z.infer<typeof presetAudienceSchema>

/**
 * A starting sidebar and dashboard. On a user's first sign-in the server walks
 * the presets in `sortOrder`, takes the first whose role or group the user
 * has, else the `everyone` preset, and copies it once into the user's own
 * sidebar and dashboard (fresh tile ids, widgets of disabled or deleted
 * components dropped). Later changes to presets never reach existing users.
 */
export const layoutPresetInputSchema = z.object({
  name: z.string().trim().min(1).max(80),
  audience: presetAudienceSchema,
  sidebar: sidebarPutSchema,
  dashboard: dashboardPutSchema
})
export type LayoutPresetInput = z.infer<typeof layoutPresetInputSchema>

export const layoutPresetSchema = layoutPresetInputSchema.extend({
  id: z.string().uuid(),
  /** Match priority, lowest first. The `everyone` preset is always tried last. */
  sortOrder: z.number().int(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
})
export type LayoutPreset = z.infer<typeof layoutPresetSchema>

export const layoutPresetListSchema = z.object({ presets: z.array(layoutPresetSchema) })
export type LayoutPresetList = z.infer<typeof layoutPresetListSchema>

/** New match priority: every existing preset id exactly once. */
export const layoutPresetOrderSchema = componentOrderSchema
export type LayoutPresetOrder = z.infer<typeof layoutPresetOrderSchema>

/** Role and group names seen at users' sign-ins, sorted, for the audience picker. */
export const presetAudienceSuggestionsSchema = z.object({
  roles: z.array(z.string()),
  groups: z.array(z.string())
})
export type PresetAudienceSuggestions = z.infer<typeof presetAudienceSuggestionsSchema>

// ---------------------------------------------------------------------------
// Feeds (fetched and normalised by the server, see `API.feed`)
// ---------------------------------------------------------------------------

/** Most entries `API.feed` returns, newest first when the feed has dates. */
export const FEED_MAX_ITEMS = 50
export const FEED_SUMMARY_MAX = 500

/** `GET API.feed?url=…` */
export const feedQuerySchema = z.object({ url: externalUrlSchema })
export type FeedQuery = z.infer<typeof feedQuerySchema>

export const feedItemSchema = z.object({
  /** The entry's guid/id, else its link, else a hash of its title; unique within the feed. */
  id: z.string(),
  /** Plain text; entries without a title get a shortened summary instead. */
  title: z.string(),
  /** Absolute `http(s)` URL, resolved against the feed URL; `null` when missing or unsafe. */
  link: externalUrlSchema.nullable(),
  publishedAt: z.string().datetime().nullable(),
  /** Plain text without markup, at most `FEED_SUMMARY_MAX` characters. */
  summary: z.string().max(FEED_SUMMARY_MAX).nullable()
})
export type FeedItem = z.infer<typeof feedItemSchema>

export const feedSchema = z.object({
  /** The feed's own title, plain text. */
  title: z.string().nullable(),
  /** The site the feed belongs to, absolute `http(s)`. */
  link: externalUrlSchema.nullable(),
  items: z.array(feedItemSchema).max(FEED_MAX_ITEMS),
  fetchedAt: z.string().datetime()
})
export type Feed = z.infer<typeof feedSchema>

/**
 * `GET API.feed`: the feed plus when the current user last read it. Entries
 * published after `readAt` are unread; `null` means the user never read this
 * feed, so nothing counts as unread yet.
 */
export const userFeedSchema = feedSchema.extend({
  readAt: z.string().datetime().nullable()
})
export type UserFeed = z.infer<typeof userFeedSchema>

/**
 * `PUT API.feedRead`: the user read the feed as of `readAt` (the `fetchedAt`
 * of the copy they saw). The server keeps the later of the stored and the
 * sent time, so it never moves back.
 */
export const feedReadPutSchema = z.object({
  url: externalUrlSchema,
  readAt: z.string().datetime()
})
export type FeedReadPut = z.infer<typeof feedReadPutSchema>

// ---------------------------------------------------------------------------
// Translator module (`API.translator*`)
// ---------------------------------------------------------------------------

export const TRANSLATE_TEXT_MAX = 5000

export const TRANSLATOR_ENGINE_KINDS = ['deepl', 'llm'] as const
export type TranslatorEngineKind = (typeof TRANSLATOR_ENGINE_KINDS)[number]

export const translatorEngineSchema = z.object({
  id: translatorEngineIdSchema,
  kind: z.enum(TRANSLATOR_ENGINE_KINDS),
  label: z.string()
})
export type TranslatorEngine = z.infer<typeof translatorEngineSchema>

/**
 * The engines users may pick, DeepL first, then the models in admin order.
 * `defaultEngine` is the admin's choice if it is offered, else the first
 * engine; `null` only when there is none (the module lacks its settings).
 */
export const translatorEngineListSchema = z.object({
  engines: z.array(translatorEngineSchema),
  defaultEngine: translatorEngineIdSchema.nullable(),
  /** Whether documents can be translated: `documentsEnabled` and a DeepL key. */
  documents: z.boolean()
})
export type TranslatorEngineList = z.infer<typeof translatorEngineListSchema>

/**
 * Formal or informal address in the translation ("Sie" or "du"). DeepL
 * applies it where the target language has the distinction and ignores it
 * elsewhere.
 */
export const TRANSLATOR_FORMALITIES = ['default', 'formal', 'informal'] as const
export const translatorFormalitySchema = z.enum(TRANSLATOR_FORMALITIES)
export type TranslatorFormality = z.infer<typeof translatorFormalitySchema>

/** Writing styles for rephrasing; DeepL Write's `writing_style` values. */
export const REPHRASE_STYLES = ['business', 'academic', 'casual', 'simple'] as const
export const rephraseStyleSchema = z.enum(REPHRASE_STYLES)
export type RephraseStyle = z.infer<typeof rephraseStyleSchema>

/** Tones for rephrasing; DeepL Write's `tone` values. */
export const REPHRASE_TONES = ['confident', 'diplomatic', 'enthusiastic', 'friendly'] as const
export const rephraseToneSchema = z.enum(REPHRASE_TONES)
export type RephraseTone = z.infer<typeof rephraseToneSchema>

const translatorTextSchema = z.string().trim().min(1).max(TRANSLATE_TEXT_MAX)

export const translateRequestSchema = z.object({
  text: translatorTextSchema,
  /** `null` lets the service detect the language. */
  source: translatorLanguageSchema.nullable(),
  target: translatorLanguageSchema,
  /** Left out: the default engine. */
  engine: translatorEngineIdSchema.optional(),
  formality: translatorFormalitySchema.default('default')
})
export type TranslateRequest = z.input<typeof translateRequestSchema>

export const translateResponseSchema = z.object({
  translation: z.string(),
  /** The language the service detected when `source` was `null`, if it could tell. */
  detectedSource: translatorLanguageSchema.nullable()
})
export type TranslateResponse = z.infer<typeof translateResponseSchema>

/**
 * Rewrites a text in its own language: corrects it and, if asked, adapts it
 * to a style or a tone. DeepL Write takes a style or a tone, not both, so a
 * request with both for DeepL answers `400 validation`.
 */
export const rephraseRequestSchema = z.object({
  text: translatorTextSchema,
  engine: translatorEngineIdSchema.optional(),
  style: rephraseStyleSchema.nullable().default(null),
  tone: rephraseToneSchema.nullable().default(null)
})
export type RephraseRequest = z.input<typeof rephraseRequestSchema>

export const rephraseResponseSchema = z.object({
  text: z.string(),
  /** The language of the text, if the service tells. */
  detectedLanguage: translatorLanguageSchema.nullable()
})
export type RephraseResponse = z.infer<typeof rephraseResponseSchema>

/**
 * Document translation goes through DeepL's document API. The server uploads
 * the file straight to DeepL (it keeps no copy of the original), follows the
 * job until it is done, and keeps the translated file for
 * `TRANSLATOR_DOCUMENT_TTL_HOURS`, so a user can download it again, also
 * after closing the tab.
 */
export const TRANSLATOR_DOCUMENT_EXTENSIONS = [
  'pdf',
  'docx',
  'pptx',
  'xlsx',
  'txt',
  'html',
  'htm'
] as const
export type TranslatorDocumentExtension = (typeof TRANSLATOR_DOCUMENT_EXTENSIONS)[number]
export const TRANSLATOR_DOCUMENT_MAX_BYTES = 20 * 1024 * 1024
export const TRANSLATOR_DOCUMENT_TTL_HOURS = 24
export const TRANSLATOR_DOCUMENT_FILENAME_MAX = 255
/** Jobs one user may have queued or translating at once. */
export const TRANSLATOR_DOCUMENT_ACTIVE_MAX = 3
/** Uploads one user may start within 24 hours; deleted jobs count too. */
export const TRANSLATOR_DOCUMENT_DAILY_MAX = 50

/** The file's extension if it is one the translator takes, else `null`. */
export function translatorDocumentExtension(filename: string): TranslatorDocumentExtension | null {
  const extension = filename.split('.').pop()?.toLowerCase() ?? ''
  return filename.includes('.') &&
    (TRANSLATOR_DOCUMENT_EXTENSIONS as readonly string[]).includes(extension)
    ? (extension as TranslatorDocumentExtension)
    : null
}

/** DeepL's job states; `error` carries `translatorDocumentSchema.error`. */
export const TRANSLATOR_DOCUMENT_STATUSES = ['queued', 'translating', 'done', 'error'] as const
export const translatorDocumentStatusSchema = z.enum(TRANSLATOR_DOCUMENT_STATUSES)
export type TranslatorDocumentStatus = z.infer<typeof translatorDocumentStatusSchema>

/** Why a job failed: source and target language are the same, or anything else. */
export const TRANSLATOR_DOCUMENT_ERRORS = ['same_language', 'failed'] as const
export const translatorDocumentErrorSchema = z.enum(TRANSLATOR_DOCUMENT_ERRORS)
export type TranslatorDocumentError = z.infer<typeof translatorDocumentErrorSchema>

/**
 * The fields of `POST API.translatorDocuments` besides `file` (multipart form
 * data, so every value is a string; `source` empty or absent: detect).
 */
export const translatorDocumentUploadSchema = z.object({
  source: z
    .union([z.literal(''), translatorLanguageSchema])
    .optional()
    .transform((value) => value || null),
  target: translatorLanguageSchema,
  formality: translatorFormalitySchema.default('default')
})
export type TranslatorDocumentUpload = z.input<typeof translatorDocumentUploadSchema>

/** One of the current user's document jobs. */
export const translatorDocumentSchema = z.object({
  id: z.string().uuid(),
  /** The uploaded file's name. */
  filename: z.string(),
  /** Size of the uploaded file in bytes. */
  size: z.number().int().nonnegative(),
  /** `null`: DeepL detected it. */
  source: translatorLanguageSchema.nullable(),
  target: translatorLanguageSchema,
  status: translatorDocumentStatusSchema,
  /** DeepL's estimate while translating, if it gave one. */
  secondsRemaining: z.number().int().nonnegative().nullable(),
  /** Set when `status` is `error`. */
  error: translatorDocumentErrorSchema.nullable(),
  /** The name the download gets, e.g. `Bericht_en.docx`. */
  resultFilename: z.string(),
  createdAt: z.string().datetime(),
  /**
   * After this the server deletes the job and its file: `TRANSLATOR_DOCUMENT_TTL_HOURS` after
   * the upload while it runs, after the translation once it is done.
   */
  expiresAt: z.string().datetime()
})
export type TranslatorDocument = z.infer<typeof translatorDocumentSchema>

/** The user's unexpired jobs, newest first. */
export const translatorDocumentListSchema = z.object({
  documents: z.array(translatorDocumentSchema)
})
export type TranslatorDocumentList = z.infer<typeof translatorDocumentListSchema>

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export const API_ERROR_CODES = [
  'unauthorized',
  'forbidden',
  'not_found',
  'validation',
  'conflict',
  /** `API.feed`: the feed host is not allowed, unreachable, too slow, too large, or not a feed. */
  'feed_unavailable',
  /** `API.module`: the module's upstream service failed or the module lacks a required secret. */
  'module_unavailable',
  /** `API.translatorDocuments`: the user has too many running jobs or uploads (429). */
  'rate_limited',
  'internal'
] as const
export const apiErrorCodeSchema = z.enum(API_ERROR_CODES)
export type ApiErrorCode = z.infer<typeof apiErrorCodeSchema>

/** Every non-2xx JSON response has this shape. */
export const apiErrorSchema = z.object({
  error: z.object({
    code: apiErrorCodeSchema,
    message: z.string(),
    /** Zod issues for `validation` errors. */
    issues: z
      .array(z.object({ path: z.array(z.union([z.string(), z.number()])), message: z.string() }))
      .optional()
  })
})
export type ApiError = z.infer<typeof apiErrorSchema>

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

/**
 * API paths, relative to the API origin. Better-Auth owns everything under
 * `/api/auth`; the OAuth provider id for Keycloak is `keycloak`.
 */
export const API = {
  health: '/api/health',
  auth: '/api/auth',
  /** GET: current session's user. PATCH: `mePatchSchema`. */
  me: '/api/me',
  /** GET: `componentListSchema`, enabled components only, in catalogue order. Any signed-in user. */
  components: '/api/components',
  /**
   * GET: `widgetListSchema`, every widget of every enabled component (catalogue
   * order, then `COMPONENT_WIDGETS` order). Any signed-in user.
   */
  widgets: '/api/widgets',
  /**
   * Admin only. GET: `adminComponentListSchema`, all components. POST:
   * `componentInputSchema` → 201 with `adminComponentSchema`; a module type
   * answers `409 conflict` (the server creates modules itself).
   */
  adminComponents: '/api/admin/components',
  /** Admin only. PUT: `componentOrderSchema` → 204. */
  adminComponentOrder: '/api/admin/components/order',
  /**
   * Admin only. GET (`adminComponentSchema`) / PUT (`componentInputSchema`) /
   * DELETE one component by id. Deleting a module, or changing a type into or
   * out of a module type, answers `409 conflict`.
   */
  adminComponent: (id: string) => `/api/admin/components/${id}`,
  /**
   * Base path of a module's own endpoints. Any signed-in user; while the
   * module's component is disabled every endpoint answers `404 not_found`.
   */
  module: (type: SingletonComponentType) => `/api/modules/${type}`,
  /** GET: `translatorEngineListSchema`. */
  translatorEngines: '/api/modules/translator/engines',
  /**
   * POST `translateRequestSchema` → `translateResponseSchema`. An engine that
   * is not offered answers `400 validation`; upstream failures and missing
   * settings answer `502 module_unavailable`.
   */
  translate: '/api/modules/translator/translate',
  /** POST `rephraseRequestSchema` → `rephraseResponseSchema`. Errors as for `translate`. */
  rephrase: '/api/modules/translator/rephrase',
  /**
   * The current user's document jobs; only while `translatorEngineListSchema.documents`,
   * else `404 not_found`. GET: `translatorDocumentListSchema`. POST: multipart form data with
   * `file` and the fields of `translatorDocumentUploadSchema` → 201 with `translatorDocumentSchema`;
   * a missing file, a type outside `TRANSLATOR_DOCUMENT_EXTENSIONS` or more than
   * `TRANSLATOR_DOCUMENT_MAX_BYTES` answers `400 validation`, DeepL refusing it
   * `502 module_unavailable`. `TRANSLATOR_DOCUMENT_ACTIVE_MAX` running jobs, or
   * `TRANSLATOR_DOCUMENT_DAILY_MAX` uploads within 24 hours, answer `429 rate_limited`
   * before anything goes to DeepL.
   */
  translatorDocuments: '/api/modules/translator/documents',
  /**
   * One of the current user's jobs (others' answer `404 not_found`). GET: `translatorDocumentSchema`,
   * with the status checked at DeepL if the job is still running. DELETE → 204.
   */
  translatorDocument: (id: string) => `/api/modules/translator/documents/${id}`,
  /** GET: the translated file as an attachment named `resultFilename`; before `done`, `409 conflict`. */
  translatorDocumentDownload: (id: string) => `/api/modules/translator/documents/${id}/download`,
  /** GET: `folderTemplateListSchema`, enabled templates with widgets of enabled components. Any signed-in user. */
  folderTemplates: '/api/folder-templates',
  /** Admin only. GET: all templates. POST: `folderTemplateInputSchema` → 201 with `folderTemplateSchema`. */
  adminFolderTemplates: '/api/admin/folder-templates',
  /** Admin only. PUT: `folderTemplateOrderSchema` → 204. */
  adminFolderTemplateOrder: '/api/admin/folder-templates/order',
  /** Admin only. GET / PUT (`folderTemplateInputSchema`) / DELETE one template by id. */
  adminFolderTemplate: (id: string) => `/api/admin/folder-templates/${id}`,
  /**
   * Admin only. GET: `layoutPresetListSchema` in match order (`everyone` last).
   * POST: `layoutPresetInputSchema` → 201 with `layoutPresetSchema`; a second
   * `everyone` preset answers `409 conflict`.
   */
  adminPresets: '/api/admin/presets',
  /** Admin only. PUT: `layoutPresetOrderSchema` → 204. */
  adminPresetOrder: '/api/admin/presets/order',
  /** Admin only. GET: `presetAudienceSuggestionsSchema`. */
  adminPresetAudiences: '/api/admin/presets/audiences',
  /** Admin only. GET / PUT (`layoutPresetInputSchema`) / DELETE one preset by id. */
  adminPreset: (id: string) => `/api/admin/presets/${id}`,
  /** GET / PUT `sidebarSchema` for the current user. */
  sidebar: '/api/sidebar',
  /** GET / PUT `dashboardSchema` for the current user. */
  dashboard: '/api/dashboard',
  /**
   * GET `?url=` (`feedQuerySchema`) → `userFeedSchema`. Any signed-in user. The
   * server fetches the feed itself (browsers are blocked by CORS), refuses
   * private and loopback addresses, and caches results briefly. Failures
   * answer `502 feed_unavailable`.
   */
  feed: '/api/feed',
  /** PUT `feedReadPutSchema` → 204: marks the feed read for the current user. */
  feedRead: '/api/feed/read'
} as const

export const KEYCLOAK_PROVIDER_ID = 'keycloak'

// ---------------------------------------------------------------------------
// Desktop bridge
// ---------------------------------------------------------------------------

/**
 * What the Electron preload exposes as `window.justCampus`. The web app reads
 * it to find the API and to open external links through the OS browser; in
 * a plain browser the property is absent.
 */
export interface DesktopBridge {
  platform: 'electron'
  /** API origin, e.g. `https://campus.example.org`. */
  apiUrl: string
  /** Opens a URL in the system browser. */
  openExternal: (url: string) => Promise<void>
}

declare global {
  interface Window {
    justCampus?: DesktopBridge
  }
}
