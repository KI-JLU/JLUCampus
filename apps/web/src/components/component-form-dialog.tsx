import { useId, useState, type FormEvent } from 'react'
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
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch
} from '@ki4jlu/design-system'
import { COMPONENT_TYPES, componentTypeSchema, type Component } from '@justcampus/shared'
import { adapterOf, componentAdapters } from '@/adapters/registry'
import {
  configErrors,
  initialFormState,
  serverFieldErrors,
  validateComponentForm,
  type ComponentFormState,
  type FieldErrors
} from '@/lib/component-form'
import { useCreateComponent, useUpdateComponent } from '@/lib/queries'
import { toast } from '@/lib/toast'
import { Field } from './field'
import { IconPicker } from './icon-picker'
import { Alert, AlertDescription } from './ui/alert'

interface ComponentFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The component to edit; `null` creates a new one. */
  component: Component | null
}

/** Remounted per component by the caller (`key`), so the form starts from its values. */
export function ComponentFormDialog({
  open,
  onOpenChange,
  component
}: ComponentFormDialogProps): React.JSX.Element {
  const { t } = useTranslation()
  const formId = useId()
  const [state, setState] = useState<ComponentFormState>(() => initialFormState(component))
  const [errors, setErrors] = useState<FieldErrors>({})
  const [failed, setFailed] = useState(false)
  const create = useCreateComponent()
  const update = useUpdateComponent()
  const pending = create.isPending || update.isPending
  const adapter = adapterOf(state.type)

  const set = <K extends keyof ComponentFormState>(key: K, value: ComponentFormState[K]): void =>
    setState((current) => ({ ...current, [key]: value }))

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault()
    setFailed(false)
    const result = validateComponentForm(state, t)
    if (!result.ok) {
      setErrors(result.errors)
      return
    }
    setErrors({})
    const options = {
      onSuccess: () => {
        toast({
          variant: 'success',
          title: t(component ? 'admin.form.updated' : 'admin.form.created')
        })
        onOpenChange(false)
      },
      onError: (error: Error) => {
        const fieldErrors = serverFieldErrors(error, state.type, t)
        if (fieldErrors) setErrors(fieldErrors)
        else setFailed(true)
      }
    }
    if (component) update.mutate({ id: component.id, input: result.input }, options)
    else create.mutate(result.input, options)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent closeLabel={t('common.close')} className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {component ? t('admin.form.editTitle') : t('admin.form.createTitle')}
          </DialogTitle>
          <DialogDescription>{t('admin.form.description')}</DialogDescription>
        </DialogHeader>
        <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-stack-md">
          {failed || errors.form ? (
            <Alert variant="destructive">
              <AlertDescription>{errors.form ?? t('admin.form.saveFailed')}</AlertDescription>
            </Alert>
          ) : null}
          <Field id={`${formId}-type`} label={t('admin.form.type')} error={errors.type}>
            {(control) => (
              <Select
                value={state.type}
                onValueChange={(value) => {
                  const type = componentTypeSchema.parse(value)
                  setState((current) => ({
                    ...current,
                    type,
                    config: componentAdapters[type].defaultConfig
                  }))
                }}
              >
                <SelectTrigger {...control}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COMPONENT_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {t(`componentTypes.${type}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </Field>
          <Field id={`${formId}-name`} label={t('admin.form.name')} error={errors.name}>
            {(control) => (
              <Input
                {...control}
                value={state.name}
                maxLength={80}
                required
                onChange={(event) => set('name', event.target.value)}
              />
            )}
          </Field>
          <Field
            id={`${formId}-icon`}
            label={t('admin.form.icon')}
            hint={t('admin.form.iconHint')}
            error={errors.icon}
          >
            {(control) => (
              <IconPicker {...control} value={state.icon} onChange={(icon) => set('icon', icon)} />
            )}
          </Field>
          <Field
            id={`${formId}-icon-url`}
            label={t('admin.form.iconUrl')}
            hint={t('admin.form.iconUrlHint')}
            error={errors.iconUrl}
          >
            {(control) => (
              <Input
                {...control}
                type="url"
                inputMode="url"
                placeholder="https://"
                value={state.iconUrl}
                onChange={(event) => set('iconUrl', event.target.value)}
              />
            )}
          </Field>
          <adapter.ConfigFields
            config={state.config}
            onChange={(config) => set('config', config)}
            errors={configErrors(errors)}
            idPrefix={formId}
          />
          <div className="flex items-center justify-between gap-stack-md">
            <Label htmlFor={`${formId}-enabled`}>{t('admin.form.enabled')}</Label>
            <Switch
              id={`${formId}-enabled`}
              checked={state.enabled}
              onCheckedChange={(checked) => set('enabled', checked)}
            />
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary">
                {t('common.cancel')}
              </Button>
            </DialogClose>
            <Button type="submit" disabled={pending}>
              {pending ? t('common.saving') : t('common.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
