import { useId, useState, type FormEvent } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import {
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@ki4jlu/design-system'
import type { LayoutPreset } from '@justcampus/shared'
import type { FieldErrors } from '@/lib/component-form'
import {
  AUDIENCE_KINDS,
  AUDIENCE_NAME_MAX,
  audienceSuggestions,
  emptyPresetInput,
  initialPresetFormState,
  PRESET_NAME_MAX,
  presetServerErrors,
  validatePresetForm,
  type AudienceKind,
  type PresetFormState
} from '@/lib/presets'
import {
  adminPresetAudiencesQuery,
  toLayoutPresetInput,
  useCreateLayoutPreset,
  useUpdateLayoutPreset
} from '@/lib/queries'
import { toast } from '@/lib/toast'
import { Field } from './field'
import { Alert, AlertDescription } from './ui/alert'

interface PresetFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The preset to rename or retarget; `null` creates a new, empty one and opens its editor. */
  preset: LayoutPreset | null
  /** Whether another preset is already the `everyone` fallback, of which there is only one. */
  fallbackTaken: boolean
}

function isAudienceKind(value: string): value is AudienceKind {
  return (AUDIENCE_KINDS as readonly string[]).includes(value)
}

/**
 * Name and audience of a layout preset. Role and group names are typed freely; the names seen
 * at users' sign-ins are suggested. Remounted per preset by the caller (`key`), so the form
 * starts from its values.
 */
export function PresetFormDialog({
  open,
  onOpenChange,
  preset,
  fallbackTaken
}: PresetFormDialogProps): React.JSX.Element {
  const { t } = useTranslation()
  const formId = useId()
  const navigate = useNavigate()
  // Optional extra: without suggestions the names are simply typed.
  const suggestions = useQuery(adminPresetAudiencesQuery)
  const [state, setState] = useState<PresetFormState>(() => initialPresetFormState(preset))
  const [errors, setErrors] = useState<FieldErrors>({})
  const [failed, setFailed] = useState(false)
  const create = useCreateLayoutPreset()
  const update = useUpdateLayoutPreset()
  const pending = create.isPending || update.isPending
  const names = audienceSuggestions(suggestions.data, state.kind)
  const listId = `${formId}-suggestions`

  const set = <K extends keyof PresetFormState>(key: K, value: PresetFormState[K]): void =>
    setState((current) => ({ ...current, [key]: value }))

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault()
    setFailed(false)
    const result = validatePresetForm(state, t)
    if (!result.ok) {
      setErrors(result.errors)
      return
    }
    setErrors({})
    const onError = (error: Error): void => {
      const fieldErrors = presetServerErrors(error, t)
      if (fieldErrors) setErrors(fieldErrors)
      else setFailed(true)
    }
    if (preset) {
      update.mutate(
        { id: preset.id, input: { ...toLayoutPresetInput(preset), ...result.details } },
        {
          onSuccess: () => {
            toast({ variant: 'success', title: t('admin.presets.form.updated') })
            onOpenChange(false)
          },
          onError
        }
      )
      return
    }
    create.mutate(emptyPresetInput(result.details), {
      onSuccess: (created) => {
        toast({ variant: 'success', title: t('admin.presets.form.created') })
        onOpenChange(false)
        void navigate({ to: '/admin/presets/$presetId', params: { presetId: created.id } })
      },
      onError
    })
  }

  // The fallback stays selectable for the preset that already is it.
  const fallbackBlocked = fallbackTaken && preset?.audience.kind !== 'everyone'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent closeLabel={t('common.close')} className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {preset ? t('admin.presets.form.editTitle') : t('admin.presets.form.createTitle')}
          </DialogTitle>
          <DialogDescription>
            {preset ? t('admin.presets.form.editDescription') : t('admin.presets.form.description')}
          </DialogDescription>
        </DialogHeader>
        <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-stack-md">
          {failed || errors.form ? (
            <Alert variant="destructive">
              <AlertDescription>
                {errors.form ?? t('admin.presets.form.saveFailed')}
              </AlertDescription>
            </Alert>
          ) : null}
          <Field id={`${formId}-name`} label={t('admin.presets.form.name')} error={errors.name}>
            {(control) => (
              <Input
                {...control}
                value={state.name}
                maxLength={PRESET_NAME_MAX}
                required
                onChange={(event) => set('name', event.target.value)}
              />
            )}
          </Field>
          <Field
            id={`${formId}-audience`}
            label={t('admin.presets.form.audience')}
            hint={fallbackBlocked ? t('admin.presets.form.everyoneTakenHint') : undefined}
            error={errors.audience}
          >
            {(control) => (
              <Select
                value={state.kind}
                onValueChange={(value) => {
                  if (isAudienceKind(value)) set('kind', value)
                }}
              >
                <SelectTrigger {...control}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AUDIENCE_KINDS.map((kind) => (
                    <SelectItem
                      key={kind}
                      value={kind}
                      disabled={kind === 'everyone' && fallbackBlocked}
                    >
                      {t(`admin.presets.audience.${kind}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </Field>
          {state.kind === 'everyone' ? null : (
            <Field
              id={`${formId}-audience-name`}
              label={
                state.kind === 'role'
                  ? t('admin.presets.form.roleName')
                  : t('admin.presets.form.groupName')
              }
              hint={
                state.kind === 'role'
                  ? t('admin.presets.form.roleHint')
                  : t('admin.presets.form.groupHint')
              }
              error={errors.audienceName}
            >
              {(control) => (
                <Input
                  {...control}
                  value={state.audienceName}
                  maxLength={AUDIENCE_NAME_MAX}
                  required
                  autoComplete="off"
                  spellCheck={false}
                  list={names.length > 0 ? listId : undefined}
                  onChange={(event) => set('audienceName', event.target.value)}
                />
              )}
            </Field>
          )}
          {names.length > 0 ? (
            <datalist id={listId}>
              {names.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
          ) : null}
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary">
                {t('common.cancel')}
              </Button>
            </DialogClose>
            <Button type="submit" disabled={pending}>
              {pending
                ? t('common.saving')
                : preset
                  ? t('common.save')
                  : t('admin.presets.form.createAndEdit')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
