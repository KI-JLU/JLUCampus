import { config } from 'dotenv'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { z } from 'zod'

const sourceDirectory = dirname(fileURLToPath(import.meta.url))
const serverDirectory = resolve(sourceDirectory, '..')
const repositoryDirectory = resolve(serverDirectory, '../..')

config({
  path: [resolve(serverDirectory, '.env'), resolve(repositoryDirectory, '.env')],
  quiet: true
})

const commaSeparatedOrigins = z.string().transform((value, context) => {
  const origins = value
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)

  if (origins.length === 0) {
    context.addIssue({ code: 'custom', message: 'CORS_ORIGINS must contain at least one origin' })
    return z.NEVER
  }

  return origins
})

const envSchema = z
  .object({
    PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
    DATABASE_URL: z.string().min(1),
    BETTER_AUTH_URL: z.url(),
    BETTER_AUTH_SECRET: z.string().min(1),
    CORS_ORIGINS: commaSeparatedOrigins,
    KEYCLOAK_ISSUER: z.url(),
    KEYCLOAK_CLIENT_ID: z.string().min(1),
    KEYCLOAK_CLIENT_SECRET: z.string().min(1),
    KEYCLOAK_ADMIN_ROLE: z.string().min(1).default('admin'),
    FEED_ALLOW_PRIVATE_HOSTS: z
      .enum(['true', 'false'])
      .default('false')
      .transform((value) => value === 'true'),
    WEB_ORIGIN: z.url().optional(),
    SERVE_WEB_DIR: z.string().min(1).optional()
  })
  .transform((value) => ({
    ...value,
    WEB_ORIGIN: value.WEB_ORIGIN ?? value.CORS_ORIGINS[0]!
  }))

export const env = envSchema.parse(process.env)
