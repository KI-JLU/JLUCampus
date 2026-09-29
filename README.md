# JLU Campus

A customizable campus dashboard for Justus-Liebig-Universität Gießen. Admins
maintain a catalogue of components (IFrame, RSS and Link adapters: name, icon,
URL). Each component is a page in the sidebar and adds widgets, which users
place as resizable tiles on a free-grid dashboard. Available as a web app (installable PWA) and as
a desktop app for Windows, macOS and Linux that bundles the same web build.

| Package           | Stack                                                                         |
| ----------------- | ----------------------------------------------------------------------------- |
| `apps/server`     | Hono on Node, Better-Auth (Keycloak via OIDC), Drizzle ORM, PostgreSQL        |
| `apps/web`        | React 19, Vite, TanStack Router + Query, JLU Design System, i18next, PWA      |
| `apps/desktop`    | Electron (electron-vite, electron-builder); bundles `apps/web/dist`           |
| `packages/shared` | Zod schemas, types and API paths shared by all three                          |

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the design.

## Getting started

Requirements: [Bun](https://bun.sh) ≥ 1.3, Node ≥ 22, Docker (or Podman with
the compose plugin), `git`.

```bash
bun install                 # also builds the JLU design system from its git tag
cp .env.example .env        # defaults match docker-compose
bun run infra:up            # Postgres on :5433, Keycloak on :8080
bun run db:migrate
bun run db:seed             # two example components
bun run dev                 # API on http://localhost:3000, web on http://localhost:5173
```

Sign in with one of the seeded Keycloak users:

| User    | Password | Role  |
| ------- | -------- | ----- |
| `alice` | `alice`  | admin |
| `bob`   | `bob`    | user  |

The Keycloak admin console is at http://localhost:8080 (`admin` / `admin`).
Users with the realm role `admin` (configurable via `KEYCLOAK_ADMIN_ROLE`) see
the admin panel at `/admin/components`.

## Desktop app

```bash
bun run build:desktop                  # builds apps/web, copies it into apps/desktop/out/renderer
bun run --filter @justcampus/desktop build:linux   # or build:win / build:mac
bun run dev:desktop                    # development: loads the web dev server
```

The desktop app talks to the API at `DESKTOP_API_URL` (build time) or
`JUSTCAMPUS_API_URL` (runtime environment variable).

## Production

`bun run build` builds the shared package, the server (`apps/server/dist`) and
the web app (`apps/web/dist`). Set `SERVE_WEB_DIR=../web/dist` (or an absolute
path) and the server serves the web app itself, so one origin hosts both. Run
migrations with `node apps/server/dist/migrate.js` before starting
`node apps/server/dist/index.js`.

## CI

GitHub Actions run lint, typecheck, tests and `bun run build` on every pull
request and every push to `master` (`.github/workflows/ci.yml`). Publishing a
GitHub release runs the same checks and build again (`release.yml`) and keeps
`web-<tag>` and `server-<tag>` as workflow artifacts for 90 days.

## Scripts

| Command                 | Purpose                                     |
| ----------------------- | ------------------------------------------- |
| `bun run dev`           | Server and web app in watch mode            |
| `bun run typecheck`     | TypeScript in every package                 |
| `bun run lint`          | ESLint, including the design-system rules   |
| `bun run test`          | Vitest in every package                     |
| `bun run db:generate`   | Generate a Drizzle migration from the schema |
| `bun run format`        | Prettier                                     |
