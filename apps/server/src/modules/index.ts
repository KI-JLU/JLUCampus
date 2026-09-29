import { API, COMPONENT_SECRETS, componentTypeSchema, isSingletonType } from '@justcampus/shared'
import { and, desc, eq } from 'drizzle-orm'
import type { Hono, MiddlewareHandler } from 'hono'

import { ApiError } from '../api.js'
import { db } from '../db/index.js'
import { component } from '../db/schema.js'
import { env } from '../env.js'
import { decryptSecret } from '../secrets.js'
import { desktopComponentDefaults, moduleRegistry } from './registry.js'
import type { AppEnvironment, ModuleConfigMap, ModuleRuntime, ModuleSecretsMap } from './types.js'

export const moduleMiddleware: MiddlewareHandler<AppEnvironment> = async (context, next) => {
  const parsedType = componentTypeSchema.safeParse(context.req.param('type'))
  if (!parsedType.success || !isSingletonType(parsedType.data)) {
    throw new ApiError(404, 'not_found', 'Module not found')
  }
  const type = parsedType.data

  const [record] = await db
    .select()
    .from(component)
    .where(
      and(eq(component.type, type), eq(component.singleton, true), eq(component.enabled, true))
    )
    .limit(1)
  if (!record) throw new ApiError(404, 'not_found', 'Module not found')

  const serverModule = moduleRegistry[type]
  const config = serverModule.configSchema.parse(record.config) as ModuleConfigMap[typeof type]
  const secrets = Object.fromEntries(
    COMPONENT_SECRETS[type].map((secretKey) => {
      const encrypted = record.secrets[secretKey]
      return [
        secretKey,
        encrypted ? decryptSecret(encrypted, env.COMPONENT_SECRETS_KEY, record.id, secretKey) : null
      ]
    })
  ) as ModuleSecretsMap[typeof type]

  context.set('module', {
    type,
    componentId: record.id,
    config,
    secrets
  } as ModuleRuntime<typeof type>)
  await next()
}

export function registerModuleRoutes(app: Hono<AppEnvironment>): void {
  app.use('/api/modules/:type/*', moduleMiddleware)
  for (const serverModule of Object.values(moduleRegistry)) {
    app.route(API.module(serverModule.type), serverModule.app)
  }
}

/**
 * Inserts every missing built-in component at the end of the catalogue: modules disabled, since
 * they need configuring first, desktop components enabled, since they have nothing to configure.
 */
export async function ensureSingletonComponents(): Promise<void> {
  const builtIns = [
    ...Object.values(moduleRegistry).map((serverModule) => ({
      type: serverModule.type,
      name: serverModule.defaultName,
      icon: serverModule.defaultIcon,
      config: serverModule.defaultConfig,
      enabled: false
    })),
    ...Object.entries(desktopComponentDefaults).map(([type, defaults]) => ({
      type,
      ...defaults,
      config: {},
      enabled: true
    }))
  ]
  for (const builtIn of builtIns) {
    const [last] = await db
      .select({ sortOrder: component.sortOrder })
      .from(component)
      .orderBy(desc(component.sortOrder))
      .limit(1)
    await db
      .insert(component)
      .values({
        ...builtIn,
        iconUrl: null,
        singleton: true,
        secrets: {},
        sortOrder: (last?.sortOrder ?? -1) + 1
      })
      .onConflictDoNothing()
  }
}

export type { AppEnvironment, ServerModule } from './types.js'
