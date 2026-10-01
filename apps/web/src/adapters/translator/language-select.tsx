import { useTranslation } from 'react-i18next'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue
} from '@ki4jlu/design-system'
import { translatorLanguageSchema, type TranslatorLanguage } from '@justcampus/shared'
import type { FieldControlProps } from '@/components/field'
import { cn } from '@/lib/utils'
import { languageOptions } from './languages'

/** Radix Select needs a non-empty value; this one stands for "detect the language". */
const DETECT = 'detect'

type LanguageSelectProps = Partial<FieldControlProps> & {
  id: string
  disabled?: boolean
  /** Compact trigger for dashboard tiles. */
  compact?: boolean
  /** For the translator's language bar: shares a narrow card, only as wide as needed in a wide one. */
  inBar?: boolean
  className?: string
} & (
    | {
        /** Offers "detect language" first, as `null`. */
        allowDetect: true
        value: TranslatorLanguage | null
        onChange: (language: TranslatorLanguage | null) => void
        /** Named in the detect entry once a translation found it. */
        detected?: TranslatorLanguage | null
      }
    | {
        allowDetect?: false
        value: TranslatorLanguage
        onChange: (language: TranslatorLanguage) => void
        detected?: undefined
      }
  )

/** The translator's languages, named in the UI language. */
export function LanguageSelect(props: LanguageSelectProps): React.JSX.Element {
  const { id, disabled, compact, inBar, className, value, detected } = props
  const { t } = useTranslation()
  const options = languageOptions(t)
  const detectedName = detected ? options.find((option) => option.code === detected)?.name : null

  const handleChange = (next: string): void => {
    if (props.allowDetect && next === DETECT) {
      props.onChange(null)
      return
    }
    const parsed = translatorLanguageSchema.safeParse(next)
    if (parsed.success) props.onChange(parsed.data)
  }

  return (
    <Select value={value ?? DETECT} onValueChange={handleChange} disabled={disabled}>
      <SelectTrigger
        id={id}
        aria-describedby={props['aria-describedby']}
        aria-invalid={props['aria-invalid']}
        className={cn(
          compact && 'h-8 px-3 py-0 text-sm',
          inBar && 'min-w-0 px-3 text-sm @xl:w-auto @xl:min-w-44 @xl:px-4 @xl:text-base',
          className
        )}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {props.allowDetect ? (
          <>
            <SelectItem value={DETECT}>
              {detectedName
                ? t('component.translator.detected', { language: detectedName })
                : t('component.translator.detect')}
            </SelectItem>
            <SelectSeparator />
          </>
        ) : null}
        {options.map((option) => (
          <SelectItem key={option.code} value={option.code}>
            {option.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
