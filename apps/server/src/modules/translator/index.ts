import {
  translateRequestSchema,
  translateResponseSchema,
  translatorComponentConfigSchema
} from '@justcampus/shared'
import { Hono } from 'hono'

import { ApiError, parseBody } from '../../api.js'
import { getModuleRuntime } from '../context.js'
import type { AppEnvironment, ServerModule } from '../types.js'
import { translationProvider } from './provider.js'

const app = new Hono<AppEnvironment>()

app.post('/translate', async (context) => {
  const input = await parseBody(context, translateRequestSchema)
  const { secrets } = getModuleRuntime(context, 'translator')
  try {
    const result = await translationProvider.translate(input, secrets.apiKey)
    return context.json(translateResponseSchema.parse(result))
  } catch (error) {
    if (error instanceof ApiError) throw error
    throw new ApiError(502, 'module_unavailable', 'Translation service is unavailable')
  }
})

export const translatorModule: ServerModule<'translator'> = {
  type: 'translator',
  defaultName: 'Übersetzer',
  defaultIcon: 'languages',
  defaultConfig: { defaultTargetLanguage: 'en' },
  configSchema: translatorComponentConfigSchema,
  app
}
