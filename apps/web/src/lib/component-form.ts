import type { TFunction } from 'i18next'
import {
  componentInputSchema,
  type Component,
  type ComponentInput,
  type ComponentType
} from '@justcampus/shared'
import { componentAdapters } from '@/adapters/registry'
import { ApiRequestError } from './api'

export interface ComponentFormState {
  type: ComponentType
  name: string
  icon: string | null
  iconUrl: string
  enabled: boolean
  config: ComponentInput['config']
}

/** Field errors keyed by the dotted issue path, e.g. `name`, `config.url`. */
export type FieldErrors = Partial<Record<string, string>>

export function initialFormState(component: Component | null): ComponentFormState {
  if (!component) {
    return {
      type: 'iframe',
      name: '',
      icon: null,
      iconUrl: '',
      enabled: true,
      config: componentAdapters.iframe.defaultConfig
    }
  }
  return {
    type: component.type,
    name: component.name,
    icon: component.icon,
    iconUrl: component.iconUrl ?? '',
    enabled: component.enabled,
    config: component.config
  }
}

type Issue = { path: readonly PropertyKey[]; message: string }

/**
 * Known fields get a translated message; anything else keeps the server's
 * wording. Embedded sites need https; feeds and shortcuts accept http too.
 */
function toFieldErrors(issues: readonly Issue[], type: ComponentType, t: TFunction): FieldErrors {
  const messages: Partial<Record<string, string>> = {
    type: t('admin.form.errors.type'),
    name: t('admin.form.errors.name'),
    icon: t('admin.form.errors.icon'),
    iconUrl: t('admin.form.errors.url'),
    'config.url': t(type === 'iframe' ? 'admin.form.errors.url' : 'admin.form.errors.externalUrl'),
    'config.feedUrl': t('admin.form.errors.externalUrl')
  }
  const errors: FieldErrors = {}
  for (const issue of issues) {
    const key = issue.path.map(String).join('.') || 'form'
    errors[key] ??= messages[key] ?? issue.message
  }
  return errors
}

export type ValidationResult =
  { ok: true; input: ComponentInput } | { ok: false; errors: FieldErrors }

export function validateComponentForm(state: ComponentFormState, t: TFunction): ValidationResult {
  const iconUrl = state.iconUrl.trim()
  const result = componentInputSchema.safeParse({
    type: state.type,
    name: state.name,
    icon: state.icon,
    iconUrl: iconUrl ? iconUrl : null,
    enabled: state.enabled,
    config: state.config
  })
  if (result.success) return { ok: true, input: result.data }
  return { ok: false, errors: toFieldErrors(result.error.issues, state.type, t) }
}

/** Server-side validation errors, mapped onto the form's fields. */
export function serverFieldErrors(
  error: unknown,
  type: ComponentType,
  t: TFunction
): FieldErrors | null {
  if (!(error instanceof ApiRequestError) || error.code !== 'validation') return null
  const issues = error.body?.error.issues ?? []
  return issues.length > 0 ? toFieldErrors(issues, type, t) : null
}

/** The errors inside `config`, keyed relative to it, for the adapter's fields. */
export function configErrors(errors: FieldErrors): FieldErrors {
  const result: FieldErrors = {}
  for (const [key, message] of Object.entries(errors)) {
    if (key.startsWith('config.')) result[key.slice('config.'.length)] = message
  }
  return result
}
