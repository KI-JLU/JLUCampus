import {
  TRANSLATOR_LLM_MODELS_MAX,
  type TranslatorComponentConfig,
  type TranslatorLlmModel
} from '@justcampus/shared'

/**
 * The config with the endpoint's models in place of the listed ones. Display names the admin
 * gave a model it still offers stay; a default engine whose model is gone falls back to
 * automatic. `omitted` counts the models beyond `TRANSLATOR_LLM_MODELS_MAX`.
 */
export function applyFetchedModels(
  config: TranslatorComponentConfig,
  fetched: readonly TranslatorLlmModel[]
): { config: TranslatorComponentConfig; omitted: number } {
  const labels = new Map(
    config.llmModels
      .filter((model) => model.label.trim())
      .map((model) => [model.id.trim(), model.label])
  )
  const llmModels = fetched
    .slice(0, TRANSLATOR_LLM_MODELS_MAX)
    .map((model) => ({ id: model.id, label: labels.get(model.id) ?? model.label }))
  const defaultModel = config.defaultEngine?.startsWith('llm:')
    ? config.defaultEngine.slice(4)
    : null
  const keepsDefault = defaultModel === null || llmModels.some((model) => model.id === defaultModel)
  return {
    config: { ...config, llmModels, defaultEngine: keepsDefault ? config.defaultEngine : null },
    omitted: Math.max(0, fetched.length - TRANSLATOR_LLM_MODELS_MAX)
  }
}
