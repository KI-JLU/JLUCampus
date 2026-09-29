import { serve } from '@hono/node-server'

import { app } from './app.js'
import { env } from './env.js'
import { ensureSingletonComponents } from './modules/index.js'

await ensureSingletonComponents()
serve({ fetch: app.fetch, port: env.PORT }, ({ port }) => {
  console.log(`JLU Campus API listening at http://localhost:${port}`)
})
