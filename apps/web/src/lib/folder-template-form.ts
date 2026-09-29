import type { TFunction } from 'i18next'
import {
  FOLDER_TITLE_MAX,
  folderTemplateInputSchema,
  type FolderTemplate,
  type FolderTemplateInput,
  type WidgetRef
} from '@justcampus/shared'
import { ApiRequestError } from './api'
import type { FieldErrors } from './component-form'

export interface FolderTemplateFormState {
  name: string
  icon: string | null
  enabled: boolean
  /** Widgets in folder order: ticking one appends it. */
  widgets: WidgetRef[]
}

export function initialFolderTemplateState(
  template: FolderTemplate | null
): FolderTemplateFormState {
  if (!template) return { name: '', icon: null, enabled: true, widgets: [] }
  const { name, icon, enabled, widgets } = template
  return { name, icon, enabled, widgets }
}

type Issue = { path: readonly PropertyKey[]; message: string }

/** Known fields get a translated message; anything else keeps the server's wording. */
function toFieldErrors(issues: readonly Issue[], t: TFunction): FieldErrors {
  const messages: Partial<Record<string, string>> = {
    name: t('admin.folders.form.errors.name', { max: FOLDER_TITLE_MAX }),
    icon: t('admin.form.errors.icon'),
    widgets: t('admin.folders.form.errors.widgets')
  }
  const errors: FieldErrors = {}
  for (const issue of issues) {
    // `widgets.2.componentId` (one bad reference) belongs to the widget list as a whole.
    const key = issue.path.length > 0 ? String(issue.path[0]) : 'form'
    errors[key] ??= messages[key] ?? issue.message
  }
  return errors
}

export type FolderTemplateValidation =
  { ok: true; input: FolderTemplateInput } | { ok: false; errors: FieldErrors }

export function validateFolderTemplateForm(
  state: FolderTemplateFormState,
  t: TFunction
): FolderTemplateValidation {
  const result = folderTemplateInputSchema.safeParse(state)
  if (result.success) return { ok: true, input: result.data }
  return { ok: false, errors: toFieldErrors(result.error.issues, t) }
}

/** Server-side validation errors, mapped onto the form's fields. */
export function folderTemplateServerErrors(error: unknown, t: TFunction): FieldErrors | null {
  if (!(error instanceof ApiRequestError) || error.code !== 'validation') return null
  const issues = error.body?.error.issues ?? []
  return issues.length > 0 ? toFieldErrors(issues, t) : null
}
