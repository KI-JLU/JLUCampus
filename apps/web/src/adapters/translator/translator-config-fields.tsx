import { useTranslation } from 'react-i18next'
import { Field } from '@/components/field'
import type { ComponentConfigFieldsProps } from '../types'
import { LanguageSelect } from './language-select'

export function TranslatorConfigFields({
  config,
  onChange,
  errors,
  idPrefix
}: ComponentConfigFieldsProps<'translator'>): React.JSX.Element {
  const { t } = useTranslation()
  return (
    <Field
      id={`${idPrefix}-default-target-language`}
      label={t('component.translator.defaultTargetLabel')}
      hint={t('component.translator.defaultTargetHint')}
      error={errors.defaultTargetLanguage}
    >
      {(control) => (
        <LanguageSelect
          {...control}
          value={config.defaultTargetLanguage}
          onChange={(language) => onChange({ ...config, defaultTargetLanguage: language })}
        />
      )}
    </Field>
  )
}
