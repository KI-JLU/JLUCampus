import { serve } from '@hono/node-server'

import { app } from './app.js'
import { env } from './env.js'

serve({ fetch: app.fetch, port: env.PORT }, ({ port }) => {
  console.log(`JLU Campus API listening at http://localhost:${port}`)
})
