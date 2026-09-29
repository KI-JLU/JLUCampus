# JLU Campus – Architecture

JLU Campus is a customizable campus dashboard for Justus-Liebig-Universität
Gießen. Admins maintain a catalogue of **components**; every user picks which
components sit in their **sidebar** (each component opens as a full page).
A component's adapter type decides its page and the **widgets** it adds; users
place widgets as resizable tiles on their **dashboard**. Component adapters:
**IFrame** (embeds a site; widget `launcher`), **RSS** (shows a feed; widget
`feed`) and **Link** (a shortcut that opens its URL outside the app; widget
`shortcut`). Widgets are fixed in code per type (`COMPONENT_WIDGETS` in shared),
so a component has nothing to configure per widget. Further adapters (Stud.IP, …)
plug into the same registry and may add several widgets. Besides widgets, users
add their own tiles: folders, shortcuts to any URL, and RSS/Atom/JSON feeds.

There is one backend and two frontends that share one web build:

| Package           | Role                                                                            |
| ----------------- | ------------------------------------------------------------------------------- |
| `apps/server`     | Hono on Node. Better-Auth (Keycloak via OIDC), Drizzle ORM, Postgres, REST API. |
| `apps/web`        | Vite + React 19, TanStack Router + Query, JLU design system, i18n (de/en), PWA. |
| `apps/desktop`    | Electron (electron-vite). Bundles `apps/web/dist`, nothing else.                |
| `packages/shared` | Zod schemas, types, API paths. **The contract. Read it first.**                 |

Tooling: Bun workspaces (`bun install`), Prettier (`.prettierrc.yaml`: single
quotes, no semicolons, width 100), TypeScript strict. Node ≥ 22 at runtime.

## Local infrastructure

`docker compose up -d` starts:

- Postgres 16 on `127.0.0.1:5433` (db/user/password `justcampus`).
- Keycloak 26 on `http://localhost:8080` (admin console: `admin` / `admin`),
  importing `infra/keycloak/justcampus-realm.json`: realm `justcampus`,
  confidential client `justcampus` (secret `justcampus-dev-secret`), realm roles
  `admin` and `user`, groups `/Studierende` and `/Beschaeftigte`, flat `roles`
  and full-path `groups` claims in the ID token, access token and userinfo,
  and two users: `alice` / `alice` (admin) and `bob` / `bob` (user).

Copy `.env.example` to `.env` at the repo root. The server loads the root
`.env` (and an optional `apps/server/.env`) with `dotenv`; Vite reads
`VITE_*` variables from the root `.env` via `envDir`.

## Authentication

- Better-Auth on the server, mounted at `/api/auth/*`, Drizzle adapter, Postgres.
- Keycloak is connected with Better-Auth's **generic OAuth** plugin, provider id
  `keycloak` (`KEYCLOAK_PROVIDER_ID` in shared), discovery URL
  `${KEYCLOAK_ISSUER}/.well-known/openid-configuration`, scopes
  `openid profile email`, PKCE.
- The user table has an extra `role` column (`user` | `admin`) and a nullable
  `language` column (`de` | `en`). `role` is **derived from Keycloak on every
  sign-in**: if the `roles` claim contains `KEYCLOAK_ADMIN_ROLE` (default
  `admin`) the user is `admin`, otherwise `user`. Nothing in the app can change
  it. Use the plugin's option to refresh user info on sign-in so a role change
  in Keycloak applies at the next login.
- Sign-in from the client: Better-Auth 1.7 registers generic OAuth providers as
  core social providers, so the call is
  `authClient.signIn.social({ provider: 'keycloak', callbackURL })` and the
  server-side callback is `/api/auth/callback/keycloak`. The callback URL is
  the frontend's own URL (web origin or `app://-/`).
- Sign-out: `authClient.signOut()` resolves with `{ success, url?, redirect? }`.
  `url` is the Keycloak RP-initiated logout URL (`end_session_endpoint` from
  discovery, `post_logout_redirect_uri` = `WEB_ORIGIN` env, default
  `http://localhost:5173`). The web app navigates there; the desktop app only
  signs out locally.
- Cookies: the Electron renderer runs on `app://-`, which is cross-site to the
  API, so session cookies are `SameSite=None; Secure` by default (Chromium and
  Firefox accept Secure cookies from `http://localhost`). `CORS_ORIGINS` and
  Better-Auth `trustedOrigins` list every frontend origin including `app://-`.
  CORS allows credentials.
- API authorization: every `/api/*` route except `/api/health` and `/api/auth/*`
  requires a session → `401 { error: { code: 'unauthorized' } }`. `/api/admin/*`
  requires `role === 'admin'` → `403 forbidden`.

## Data model (Drizzle, Postgres)

Better-Auth tables (`user`, `session`, `account`, `verification`) as generated
by the Better-Auth CLI, plus:

```
component         id uuid pk, name text, type text ('iframe' | 'rss' | 'link'), icon text null,
                  icon_url text null, config jsonb, enabled bool, sort_order int,
                  created_at, updated_at
sidebar_entry     user_id → user (cascade), component_id → component (cascade),
                  position int; pk (user_id, component_id)
dashboard_tile    id uuid pk (client generated), user_id → user (cascade),
                  kind text ('widget' | 'folder' | 'link' | 'feed'),
                  component_id → component (cascade) null, widget_key text null,
                  title text null, url text null (shortcut URL or feed URL), icon text null,
                  x, y, w, h int
dashboard_folder_item id uuid pk, tile_id → dashboard_tile (cascade),
                  kind text ('widget' | 'link'), component_id → component (cascade) null,
                  widget_key text null, title, url, icon text null (shortcuts), position int;
                  unique (tile_id, component_id, widget_key)
folder_template   id uuid pk, name text, icon text null, enabled bool, sort_order int,
                  created_at, updated_at
folder_template_item template_id → folder_template (cascade), component_id → component (cascade),
                  widget_key text, position int; pk (template_id, component_id, widget_key)
```

There is no widget table: a widget is `(component_id, widget_key)`, and the
server checks that the key belongs to the component's type
(`widgetDefinition` in shared), which also supplies the minimum tile size.
`PUT /api/sidebar` and `PUT /api/dashboard` replace the user's rows in one
transaction. Reads filter out disabled components and their widgets. Deleting a
component cascades.
Folder templates list widgets and are copied into ordinary dashboard folders when added; there is no later sync.

```
layout_preset     id uuid pk, name text, audience_kind text ('role' | 'group' | 'everyone'),
                  audience_name text null, sort_order int, sidebar jsonb (component ids),
                  dashboard jsonb (tiles as in dashboardPutSchema), created_at, updated_at;
                  at most one 'everyone' row
user              + keycloak_roles text[], keycloak_groups text[], layout_initialized_at timestamp null
```

Layout presets are the starting sidebar and dashboard admins define per
Keycloak realm role or group (full path, e.g. `/Studierende`), plus one
`everyone` fallback. Every sign-in stores the user's roles and groups. On the
first sign-in (`layout_initialized_at` null) the server takes the first
preset in `sort_order` whose role or group the user has, else the `everyone`
preset, and copies it once into the user's rows with fresh ids, dropping
widgets of disabled or deleted components. Presets are snapshots stored as
jsonb; later edits never reach existing users. Users who existed before
presets were introduced count as initialised.

## Feed proxy

Browsers cannot read most feeds (CORS), so `GET /api/feed?url=` (any signed-in
user) fetches and normalises them in `apps/server/src/feed.ts` with
`feedsmith`. Only `http(s)` URLs without credentials; every resolved address
must be public unicast (private, loopback, link-local, CGNAT, multicast,
documentation, IPv4-mapped/NAT64 ranges are refused) and the connection is
pinned to the checked address, so DNS rebinding cannot redirect it. At most 3
redirects (each re-checked), 5 s, 2 MB decompressed. Text is plain (tags
stripped, entities decoded), links must be `http(s)`, the body is decoded in
its declared charset. Results are cached in memory (10 min, failures 1 min,
500 entries). `FEED_ALLOW_PRIVATE_HOSTS=true` lifts the address check for
development and intranet feeds. Failures answer `502 feed_unavailable`.

## API

See `packages/shared/src/index.ts` (`API` object and schemas). JSON only.
Validation errors return `400` with `code: 'validation'` and Zod issues.
Responses are shaped exactly as the shared schemas describe (dates as ISO
strings).

## Web app

- Routes (TanStack Router, code-based like JLU Mail, **browser history**):
  `/login`, `/` (dashboard), `/c/$componentId` (component full page),
  `/settings` (language, sidebar arrangement), `/admin/components`,
  `/admin/folders`, `/admin/presets` and `/admin/presets/$presetId` (admin only).
  The preset editor reuses the user's dashboard grid and sidebar editor.
  The root route loads the session; unauthenticated users go to `/login`.
- Design system: `@ki4jlu/design-system` exactly like JLU Mail — tokens.css,
  Inter/Manrope from fontsource, `ThemeProvider`, `theme-init.js` in `<head>`
  (CSP-safe), ESLint plugin rules `no-hardcoded-colors` (error),
  `no-raw-ui-elements` (warn), `layout-only-classname` (warn). Frame:
  `AppShellLayout` with `Logo product="Campus"`, `NavItem`s for dashboard +
  the user's sidebar components, `SidebarUserMenu` footer (settings, admin,
  sign out, language).
- Dashboard: `react-grid-layout` (v2), 12 columns (`DASHBOARD_COLS`), row
  height `DASHBOARD_ROW_HEIGHT`, edit mode toggles drag/resize, "add widget"
  dialog lists the widgets of enabled components, tile header opens the
  component's page and removes the tile.
  Layout is saved with `PUT /api/dashboard` (debounced while editing).
- Adapter registry: `src/adapters/registry.ts` maps `ComponentType` →
  `{ Page, ConfigFields, defaultConfig, sourceUrl, externalUrl?, widgets }`,
  where `widgets` holds a `Tile` for every key the type has in
  `COMPONENT_WIDGETS`. Adapters with `externalUrl` (`link`) open outside the
  app from tiles, folders and the sidebar instead of navigating to
  `/c/$componentId`.
- Shortcuts show the site's `/favicon.ico` unless the user picked a Lucide
  icon, falling back to a globe. Feeds are read through `GET /api/feed`.
- i18n: `i18next` + `react-i18next`, resources `src/i18n/de.json` and
  `en.json`. Language = user's saved language, else browser detector, else
  `de`. Changing it PATCHes `/api/me` and updates `<html lang>`.
- API access: `src/lib/api.ts` uses `window.justCampus?.apiUrl ??
import.meta.env.VITE_API_URL ?? ''` as base and `credentials: 'include'`.
- PWA: `vite-plugin-pwa` generates `manifest.webmanifest` (name "JLU Campus",
  short name "Campus", standalone, theme colour from tokens) and icons in
  `public/icons/` (192, 512, maskable, apple-touch) generated with `sharp`
  from `public/icon.svg`. Also emit a static `public/manifest.json` copy of
  the manifest as requested.

## Desktop app

- electron-vite builds `main` and `preload` only. `scripts/copy-web-build.mjs`
  copies `apps/web/dist` to `apps/desktop/out/renderer` before the build.
- Main registers the privileged scheme `app` and serves `out/renderer` from
  `app://-/` with an SPA fallback to `index.html`. In development it loads
  `http://localhost:5173` instead.
- Preload exposes `window.justCampus` (`DesktopBridge` from shared):
  `platform`, `apiUrl` (`JUSTCAMPUS_API_URL` env, else the build-time
  `DESKTOP_API_URL`, else `http://localhost:3000`), `openExternal`.
- Sign-in navigates the main window to Keycloak and back; the server's final
  redirect targets `app://-/`. Main handles `will-redirect` / `will-navigate`
  to `app://` by loading the URL itself if Chromium does not follow it.
- CSP via `session.webRequest.onHeadersReceived`: `default-src 'self'`,
  `connect-src` the API origin, `frame-src https: http://localhost:*`,
  `img-src 'self' https: data:`, fonts and styles self/inline.
- Everything else (window state, external links → `shell.openExternal`,
  no Node in the renderer, context isolation) follows electron-vite defaults.
