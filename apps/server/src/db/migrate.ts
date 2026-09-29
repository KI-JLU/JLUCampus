import { migrate } from 'drizzle-orm/postgres-js/migrator'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { client, db } from './index.js'

const serverDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '../..')

try {
  await migrate(db, { migrationsFolder: resolve(serverDirectory, 'drizzle') })
  console.log('Database migrations completed')
} finally {
  await client.end()
}
