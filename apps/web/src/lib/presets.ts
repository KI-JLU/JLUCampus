import type { TFunction } from 'i18next'
import {
  layoutPresetInputSchema,
  type LayoutPreset,
  type LayoutPresetInput,
  type PresetAudience,
  type PresetAudienceSuggestions
} from '@justcampus/shared'
import { ApiRequestError } from './api'
import type { FieldErrors } from './component-form'

/** Limits of `layoutPresetInputSchema`, for the form's messages and `maxLength`. */
export const PRESET_NAME_MAX = 80
export const AUDIENCE_NAME_MAX = 255

export type AudienceKind = PresetAudience['kind']
export const AUDIENCE_KINDS: readonly AudienceKind[] = ['role', 'group', 'everyone']

type Audienced = { id: string; audience: PresetAudience }

/**
 * The presets matched by role or group, in priority order, and the `everyone` fallback, which
 * is always tried last whatever its position in the list.
 */
export function splitPresets<T extends Audienced>(
  presets: readonly T[]
): {
  ranked: T[]
  fallback: T | null
} {
  return {
    ranked: presets.filter((preset) => preset.audience.kind !== 'everyone'),
    fallback: presets.find((preset) => preset.audience.kind === 'everyone') ?? null
  }
}

/**
 * Every preset id in the new match order after moving the ranked preset at `index` one step,
 * the fallback last; `null` when it cannot move that way.
 */
export function movedPresetOrder(
  presets: readonly Audienced[],
  index: number,
  offset: -1 | 1
): string[] | null {
  const { ranked, fallback } = splitPresets(presets)
  const ids = ranked.map((preset) => preset.id)
  const moved = ids[index]
  const other = ids[index + offset]
  if (moved === undefined || other === undefined) return null
  ids[index] = other
  ids[index + offset] = moved
  return fallback ? [...ids, fallback.id] : ids
}

/** A new preset: an empty sidebar and dashboard, filled in its editor. */
export function emptyPresetInput(
  details: Pick<LayoutPresetInput, 'name' | 'audience'>
): LayoutPresetInput {
  return { ...details, sidebar: { componentIds: [] }, dashboard: { tiles: [] } }
}

/** Role and group names seen at sign-ins for the chosen kind; the fallback has none. */
export function audienceSuggestions(
  suggestions: PresetAudienceSuggestions | undefined,
  kind: AudienceKind
): string[] {
  if (!suggestions) return []
  if (kind === 'role') return suggestions.roles
  if (kind === 'group') return suggestions.groups
  return []
}

/** “Role admin”, “Group /Studierende”, “Everyone”. */
export function audienceLabel(audience: PresetAudience, t: TFunction): string {
  switch (audience.kind) {
    case 'role':
      return t('admin.presets.audience.roleNamed', { name: audience.name })
    case 'group':
      return t('admin.presets.audience.groupNamed', { name: audience.name })
    case 'everyone':
      return t('admin.presets.audience.everyone')
  }
}

export interface PresetFormState {
  name: string
  kind: AudienceKind
  /** Role or group name; kept while switching kinds, ignored for `everyone`. */
  audienceName: string
}

export function initialPresetFormState(preset: LayoutPreset | null): PresetFormState {
  if (!preset) return { name: '', kind: 'role', audienceName: '' }
  const { name, audience } = preset
  const audienceName = audience.kind === 'everyone' ? '' : audience.name
  return { name, kind: audience.kind, audienceName }
}

function toAudience({ kind, audienceName }: PresetFormState): PresetAudience {
  return kind === 'everyone' ? { kind } : { kind, name: audienceName }
}

type Issue = { path: readonly PropertyKey[]; message: string }

/** Known fields get a translated message; anything else keeps the server's wording. */
function toFieldErrors(issues: readonly Issue[], t: TFunction): FieldErrors {
  const messages: Partial<Record<string, string>> = {
    name: t('admin.presets.form.errors.name', { max: PRESET_NAME_MAX }),
    audienceName: t('admin.presets.form.errors.audienceName', { max: AUDIENCE_NAME_MAX })
  }
  const errors: FieldErrors = {}
  for (const issue of issues) {
    const [first, second] = issue.path
    // `audience.name` has a field of its own; anything else about the audience goes to its kind.
    const key =
      first === undefined
        ? 'form'
        : first === 'audience' && second === 'name'
          ? 'audienceName'
          : String(first)
    errors[key] ??= messages[key] ?? issue.message
  }
  return errors
}

const presetDetailsSchema = layoutPresetInputSchema.pick({ name: true, audience: true })

export type PresetFormValidation =
  | { ok: true; details: Pick<LayoutPresetInput, 'name' | 'audience'> }
  | { ok: false; errors: FieldErrors }

export function validatePresetForm(state: PresetFormState, t: TFunction): PresetFormValidation {
  const result = presetDetailsSchema.safeParse({ name: state.name, audience: toAudience(state) })
  if (result.success) return { ok: true, details: result.data }
  return { ok: false, errors: toFieldErrors(result.error.issues, t) }
}

/**
 * Server errors mapped onto the form's fields: `409 conflict` means an `everyone` preset exists
 * already, validation issues go to their fields.
 */
export function presetServerErrors(error: unknown, t: TFunction): FieldErrors | null {
  if (!(error instanceof ApiRequestError)) return null
  if (error.code === 'conflict') return { audience: t('admin.presets.form.errors.everyoneTaken') }
  if (error.code !== 'validation') return null
  const issues = error.body?.error.issues ?? []
  return issues.length > 0 ? toFieldErrors(issues, t) : null
}
