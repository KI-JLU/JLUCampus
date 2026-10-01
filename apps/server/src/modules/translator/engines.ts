import type {
  TranslatorComponentConfig,
  TranslatorEngine,
  TranslatorEngineId
} from '@justcampus/shared'

import { ApiError } from '../../api.js'
import type { ModuleSecretsMap } from '../types.js'

type TranslatorSecrets = ModuleSecretsMap['translator']

export type ResolvedEngine =
  { id: 'deepl'; kind: 'deepl' } | { id: `llm:${string}`; kind: 'llm'; model: string }

/** Lists usable engines in the order presented to users. */
export function listEngines(
  config: TranslatorComponentConfig,
  secrets: TranslatorSecrets
): TranslatorEngine[] {
  const engines: TranslatorEngine[] = []
  if (secrets.deeplApiKey) engines.push({ id: 'deepl', kind: 'deepl', label: 'DeepL' })
  if (config.llmBaseUrl) {
    engines.push(
      ...config.llmModels.map((model) => ({
        id: `llm:${model.id}`,
        kind: 'llm' as const,
        label: model.label
      }))
    )
  }
  return engines
}

/** Returns the configured default when offered, otherwise the first engine. */
export function resolveDefaultEngine(
  config: TranslatorComponentConfig,
  engines: readonly TranslatorEngine[]
): TranslatorEngineId | null {
  return engines.some((engine) => engine.id === config.defaultEngine)
    ? config.defaultEngine
    : (engines[0]?.id ?? null)
}

/** Resolves a requested engine and rejects engines that are not offered. */
export function resolveEngine(
  requested: TranslatorEngineId | undefined,
  config: TranslatorComponentConfig,
  secrets: TranslatorSecrets
): ResolvedEngine {
  const engines = listEngines(config, secrets)
  const id = requested ?? resolveDefaultEngine(config, engines)
  if (!id) throw new ApiError(502, 'module_unavailable', 'No translation engine is configured')
  if (!engines.some((engine) => engine.id === id)) {
    throw new ApiError(400, 'validation', 'Translation engine is not available', [
      { path: ['engine'], message: 'Select an offered translation engine' }
    ])
  }
  if (id === 'deepl') return { id, kind: 'deepl' }
  return { id: id as `llm:${string}`, kind: 'llm', model: id.slice(4) }
}

/**
 * The model that detects languages and suggests wordings: the chosen engine if it is a model,
 * else the default engine if it is one, else the first model; `null` when there is no model.
 */
export function assistantModel(
  requested: TranslatorEngineId | undefined,
  config: TranslatorComponentConfig,
  secrets: TranslatorSecrets
): string | null {
  const models = listEngines(config, secrets).filter((engine) => engine.kind === 'llm')
  const pick =
    models.find((engine) => engine.id === requested) ??
    models.find((engine) => engine.id === config.defaultEngine) ??
    models[0]
  return pick ? pick.id.slice(4) : null
}
