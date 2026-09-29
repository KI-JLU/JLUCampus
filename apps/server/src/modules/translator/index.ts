import {
  rephraseRequestSchema,
  rephraseResponseSchema,
  translateRequestSchema,
  translateResponseSchema,
  translatorComponentConfigSchema,
  translatorEngineListSchema
} from '@justcampus/shared'
import { Hono } from 'hono'

import { ApiError, parseBody } from '../../api.js'
import { getModuleRuntime } from '../context.js'
import type { AppEnvironment, ServerModule } from '../types.js'
import { rephraseWithDeepL, translateWithDeepL } from './deepl.js'
import { listEngines, resolveDefaultEngine, resolveEngine } from './engines.js'
import { rephraseWithLlm, translateWithLlm } from './llm.js'

export const translatorApp = new Hono<AppEnvironment>()

function upstreamSignal(signal: AbortSignal): AbortSignal {
  return AbortSignal.any([signal, AbortSignal.timeout(60_000)])
}

translatorApp.get('/engines', (context) => {
  const { config, secrets } = getModuleRuntime(context, 'translator')
  const engines = listEngines(config, secrets)
  return context.json(
    translatorEngineListSchema.parse({
      engines,
      defaultEngine: resolveDefaultEngine(config, engines)
    })
  )
})

translatorApp.post('/translate', async (context) => {
  const input = await parseBody(context, translateRequestSchema)
  const { config, secrets } = getModuleRuntime(context, 'translator')
  try {
    const engine = resolveEngine(input.engine, config, secrets)
    const signal = upstreamSignal(context.req.raw.signal)
    const result =
      engine.kind === 'deepl'
        ? await translateWithDeepL(input, config.deeplApiUrl, secrets.deeplApiKey!, signal)
        : await translateWithLlm(input, config.llmBaseUrl!, secrets.llmApiKey, engine.model, signal)
    return context.json(translateResponseSchema.parse(result))
  } catch (error) {
    if (error instanceof ApiError) throw error
    throw new ApiError(502, 'module_unavailable', 'Translation service is unavailable')
  }
})

translatorApp.post('/rephrase', async (context) => {
  const input = await parseBody(context, rephraseRequestSchema)
  const { config, secrets } = getModuleRuntime(context, 'translator')
  try {
    const engine = resolveEngine(input.engine, config, secrets)
    if (engine.kind === 'deepl' && input.style && input.tone) {
      throw new ApiError(400, 'validation', 'DeepL accepts either a style or a tone', [
        { path: ['tone'], message: 'DeepL cannot combine style and tone' }
      ])
    }
    const signal = upstreamSignal(context.req.raw.signal)
    const result =
      engine.kind === 'deepl'
        ? await rephraseWithDeepL(input, config.deeplApiUrl, secrets.deeplApiKey!, signal)
        : await rephraseWithLlm(input, config.llmBaseUrl!, secrets.llmApiKey, engine.model, signal)
    return context.json(rephraseResponseSchema.parse(result))
  } catch (error) {
    if (error instanceof ApiError) throw error
    throw new ApiError(502, 'module_unavailable', 'Translation service is unavailable')
  }
})

export const translatorModule: ServerModule<'translator'> = {
  type: 'translator',
  defaultName: 'Übersetzer',
  defaultIcon: 'languages',
  defaultConfig: {
    defaultTargetLanguage: 'en',
    deeplApiUrl: null,
    llmBaseUrl: null,
    llmModels: [],
    defaultEngine: null
  },
  configSchema: translatorComponentConfigSchema,
  app: translatorApp
}
