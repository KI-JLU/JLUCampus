import { serve } from '@hono/node-server'

import { app } from './app.js'
import { env } from './env.js'
import { ensureSingletonComponents, startModules } from './modules/index.js'

await ensureSingletonComponents()
startModules()
serve({ fetch: app.fetch, port: env.PORT }, ({ port }) => {
  console.log(`JLU Campus API listening at http://localhost:${port}`)
})
