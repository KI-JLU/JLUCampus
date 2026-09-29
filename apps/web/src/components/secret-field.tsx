import { useTranslation } from 'react-i18next'
import { Badge, Button, Input } from '@ki4jlu/design-system'
import type { ComponentType, SecretKey } from '@justcampus/shared'
import { secretStatus, type SecretDraft, type SecretStatus } from '@/lib/component-secrets'
import { Field } from './field'

/** The i18n prefix of every secret; a type that adds a secret without its texts fails to compile. */
type SecretTextKey = {
  [T in ComponentType]: `component.${T}.secrets.${SecretKey<T>}`
}[ComponentType]

const STATUS_TONE = {
  saved: 'success',
  unset: 'neutral',
  replace: 'info',
  set: 'info',
  remove: 'warning'
} as const satisfies Record<SecretStatus, string>

interface SecretFieldProps {
  id: string
  type: ComponentType
  secret: string
  /** Whether the server has a value for this secret. */
  isSet: boolean
  draft: SecretDraft | undefined
  onChange: (draft: SecretDraft) => void
  error?: string
}

/**
 * One write-only secret, such as an API key. The saved value never comes
 * back from the server, so the field starts empty: typing replaces the
 * secret, leaving it empty keeps it, and "remove" clears it on save (undoable
 * until then). The status beside the label tells which of these will happen.
 */
export function SecretField({
  id,
  type,
  secret,
  isSet,
  draft,
  onChange,
  error
}: SecretFieldProps): React.JSX.Element {
  const { t } = useTranslation()
  const text = `component.${type}.secrets.${secret}` as SecretTextKey
  const label = t(`${text}.label`)
  const status = secretStatus(isSet, draft)
  const removing = status === 'remove'
  const action = removing ? 'undoRemove' : 'remove'

  return (
    <Field
      id={id}
      label={label}
      error={error}
      hint={
        <span className="flex flex-col items-start gap-1">
          <Badge tone={STATUS_TONE[status]} appearance="filled" aria-live="polite">
            {t(`admin.form.secret.status.${status}`)}
          </Badge>
          <span>{t(`${text}.hint`)}</span>
        </span>
      }
    >
      {(control) => (
        <div className="flex items-center gap-2">
          <Input
            {...control}
            type="password"
            autoComplete="new-password"
            spellCheck={false}
            value={removing ? '' : (draft?.value ?? '')}
            disabled={removing}
            placeholder={isSet ? t('admin.form.secret.keepPlaceholder') : undefined}
            onChange={(event) => onChange({ value: event.target.value, remove: false })}
          />
          {isSet ? (
            <Button
              type="button"
              variant={removing ? 'ghost' : 'ghost-destructive'}
              size="sm"
              aria-label={t(`admin.form.secret.${action}For`, { label })}
              onClick={() => onChange({ value: '', remove: !removing })}
            >
              {t(`admin.form.secret.${action}`)}
            </Button>
          ) : null}
        </div>
      )}
    </Field>
  )
}
