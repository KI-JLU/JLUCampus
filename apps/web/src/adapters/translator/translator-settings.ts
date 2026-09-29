import { useState } from 'react'
import { z } from 'zod'
import {
  rephraseStyleSchema,
  rephraseToneSchema,
  translatorEngineIdSchema,
  translatorFormalitySchema,
  type RephraseStyle,
  type RephraseTone,
  type TranslatorEngine,
  type TranslatorEngineId,
  type TranslatorEngineKind,
  type TranslatorEngineList
} from '@justcampus/shared'

/** In HAWKI's order; `documents` only while the module offers it (see `offeredMode`). */
export const TRANSLATOR_MODES = ['translate', 'documents', 'rephrase'] as const
export const translatorModeSchema = z.enum(TRANSLATOR_MODES)
export type TranslatorMode = z.infer<typeof translatorModeSchema>

/**
 * The mode shown for the stored one: documents only once the module says it offers them
 * (`documents` is `undefined` until the engine list arrives, or if it failed), else translating.
 */
export function offeredMode(mode: TranslatorMode, documents: boolean | undefined): TranslatorMode {
  return mode === 'documents' && documents !== true ? 'translate' : mode
}

/**
 * The translator page's settings, remembered per device. Each field falls
 * back to its default on its own, so one bad value does not cost the rest.
 */
const translatorSettingsSchema = z.object({
  mode: translatorModeSchema.catch('translate'),
  /** `null`: the default engine. */
  engine: translatorEngineIdSchema.nullable().catch(null),
  live: z.boolean().catch(false),
  showChanges: z.boolean().catch(false),
  formality: translatorFormalitySchema.catch('default'),
  style: rephraseStyleSchema.nullable().catch(null),
  tone: rephraseToneSchema.nullable().catch(null)
})
export type TranslatorSettings = z.infer<typeof translatorSettingsSchema>

const SETTINGS_KEY = 'justcampus.translator.settings'

export const DEFAULT_SETTINGS: TranslatorSettings = translatorSettingsSchema.parse({})

/** The stored settings; anything unreadable gives the defaults. */
export function parseSettings(stored: string | null): TranslatorSettings {
  if (!stored) return DEFAULT_SETTINGS
  try {
    const parsed = translatorSettingsSchema.safeParse(JSON.parse(stored))
    return parsed.success ? parsed.data : DEFAULT_SETTINGS
  } catch {
    return DEFAULT_SETTINGS
  }
}

/** The chosen engine while it is offered, else the default one; `null` when there is none. */
export function resolveEngine(
  chosen: TranslatorEngineId | null,
  list: TranslatorEngineList
): TranslatorEngine | null {
  return (
    list.engines.find((engine) => engine.id === chosen) ??
    list.engines.find((engine) => engine.id === list.defaultEngine) ??
    list.engines[0] ??
    null
  )
}

/**
 * The style and tone a rephrase request sends. DeepL Write takes a style or
 * a tone, not both; choosing one clears the other, and settings stored with
 * both (from a model that takes both) keep the style.
 */
export function rephraseOptions(
  settings: Pick<TranslatorSettings, 'style' | 'tone'>,
  kind: TranslatorEngineKind | undefined
): { style: RephraseStyle | null; tone: RephraseTone | null } {
  return {
    style: settings.style,
    tone: kind === 'deepl' && settings.style ? null : settings.tone
  }
}

/**
 * The settings, kept in `localStorage`. `update` returns the merged settings,
 * so a change can act on them before the next render.
 */
export function useTranslatorSettings(): [
  TranslatorSettings,
  (patch: Partial<TranslatorSettings>) => TranslatorSettings
] {
  const [settings, setSettings] = useState<TranslatorSettings>(() => {
    try {
      return parseSettings(window.localStorage.getItem(SETTINGS_KEY))
    } catch {
      return DEFAULT_SETTINGS
    }
  })
  const update = (patch: Partial<TranslatorSettings>): TranslatorSettings => {
    const next = { ...settings, ...patch }
    setSettings(next)
    try {
      window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(next))
    } catch {
      /* A lost preference costs nothing but the preference. */
    }
    return next
  }
  return [settings, update]
}
