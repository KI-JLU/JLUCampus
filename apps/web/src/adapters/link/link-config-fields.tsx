import { useTranslation } from 'react-i18next'
import { Input } from '@ki4jlu/design-system'
import { Field } from '@/components/field'
import type { ComponentConfigFieldsProps } from '../types'

export function LinkConfigFields({
  config,
  onChange,
  errors,
  idPrefix
}: ComponentConfigFieldsProps<'link'>): React.JSX.Element {
  const { t } = useTranslation()
  return (
    <Field
      id={`${idPrefix}-url`}
      label={t('component.link.urlLabel')}
      hint={t('component.link.urlHint')}
      error={errors.url}
    >
      {(control) => (
        <Input
          {...control}
          type="url"
          inputMode="url"
          autoComplete="url"
          placeholder="https://"
          value={config.url}
          onChange={(event) => onChange({ ...config, url: event.target.value })}
          required
        />
      )}
    </Field>
  )
}
