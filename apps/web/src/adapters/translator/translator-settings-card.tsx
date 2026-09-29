import { useTranslation } from 'react-i18next'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch
} from '@ki4jlu/design-system'
import {
  REPHRASE_STYLES,
  REPHRASE_TONES,
  rephraseStyleSchema,
  rephraseToneSchema,
  TRANSLATOR_FORMALITIES,
  translatorFormalitySchema,
  type RephraseStyle,
  type RephraseTone,
  type TranslatorEngine
} from '@justcampus/shared'
import { Field } from '@/components/field'
import type { TranslatorSettings } from './translator-settings'

/** Radix Select needs a non-empty value; this one stands for "no style" and "no tone". */
const NONE = 'default'

interface TranslatorSettingsFieldsProps {
  id: string
  settings: TranslatorSettings
  /** The engines offered; `undefined` until they are known. */
  engines: TranslatorEngine[] | undefined
  /** The engine requests go to (the chosen one, or the default). */
  engine: TranslatorEngine | null
  /** Style and tone as they are sent (see `rephraseOptions`). */
  style: RephraseStyle | null
  tone: RephraseTone | null
  onChange: (patch: Partial<TranslatorSettings>) => void
}

/**
 * Engine and options for the current mode, live editing, and "show changes". From `lg` up they
 * fill the page's column on the right, below it a card under the translator.
 */
export function TranslatorSettingsFields({
  id,
  settings,
  engines,
  engine,
  style,
  tone,
  onChange
}: TranslatorSettingsFieldsProps): React.JSX.Element {
  const { t } = useTranslation()
  const deepl = engine?.kind === 'deepl'
  const noteId = `${id}-deepl-note`

  return (
    <div className="grid gap-stack-md">
      <Field id={`${id}-engine`} label={t('component.translator.engine')}>
        {(control) => (
          <Select
            value={engine?.id ?? ''}
            onValueChange={(next) => onChange({ engine: next })}
            disabled={!engines?.length}
          >
            <SelectTrigger {...control}>
              <SelectValue placeholder={t('component.translator.engineDefault')} />
            </SelectTrigger>
            <SelectContent>
              {engines?.map((option) => (
                <SelectItem key={option.id} value={option.id}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </Field>
      {settings.mode === 'translate' ? (
        <Field id={`${id}-formality`} label={t('component.translator.formality')}>
          {(control) => (
            <Select
              value={settings.formality}
              onValueChange={(next) => {
                const parsed = translatorFormalitySchema.safeParse(next)
                if (parsed.success) onChange({ formality: parsed.data })
              }}
            >
              <SelectTrigger {...control}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TRANSLATOR_FORMALITIES.map((formality) => (
                  <SelectItem key={formality} value={formality}>
                    {t(`component.translator.formalities.${formality}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </Field>
      ) : (
        <>
          <Field id={`${id}-style`} label={t('component.translator.style')}>
            {(control) => (
              <Select
                value={style ?? NONE}
                onValueChange={(next) => {
                  const parsed = rephraseStyleSchema.nullable().catch(null).parse(next)
                  onChange(deepl && parsed ? { style: parsed, tone: null } : { style: parsed })
                }}
              >
                <SelectTrigger {...control} aria-describedby={deepl ? noteId : undefined}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>{t('component.translator.styles.default')}</SelectItem>
                  {REPHRASE_STYLES.map((option) => (
                    <SelectItem key={option} value={option}>
                      {t(`component.translator.styles.${option}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </Field>
          <Field id={`${id}-tone`} label={t('component.translator.tone')}>
            {(control) => (
              <Select
                value={tone ?? NONE}
                onValueChange={(next) => {
                  const parsed = rephraseToneSchema.nullable().catch(null).parse(next)
                  onChange(deepl && parsed ? { tone: parsed, style: null } : { tone: parsed })
                }}
              >
                <SelectTrigger {...control} aria-describedby={deepl ? noteId : undefined}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>{t('component.translator.tones.default')}</SelectItem>
                  {REPHRASE_TONES.map((option) => (
                    <SelectItem key={option} value={option}>
                      {t(`component.translator.tones.${option}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </Field>
          {deepl ? (
            <p id={noteId} className="m-0 text-sm text-on-surface-variant">
              {t('component.translator.deeplStyleOrTone')}
            </p>
          ) : null}
        </>
      )}
      <SwitchRow
        id={`${id}-live`}
        label={t('component.translator.live')}
        hint={t(deepl ? 'component.translator.liveDeepl' : 'component.translator.liveHint')}
        checked={settings.live && !deepl}
        disabled={deepl}
        onCheckedChange={(live) => onChange({ live })}
      />
      <SwitchRow
        id={`${id}-changes`}
        label={t('component.translator.showChanges')}
        hint={t(
          settings.mode === 'translate'
            ? 'component.translator.showChangesTranslateHint'
            : 'component.translator.showChangesRephraseHint'
        )}
        checked={settings.showChanges}
        onCheckedChange={(showChanges) => onChange({ showChanges })}
      />
    </div>
  )
}

/** The settings as a card of their own, for narrow screens. */
export function TranslatorSettingsCard(props: TranslatorSettingsFieldsProps): React.JSX.Element {
  const { t } = useTranslation()
  return (
    <Card>
      <CardHeader>
        <CardTitle asChild>
          <h2>{t('component.translator.settings')}</h2>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <TranslatorSettingsFields {...props} />
      </CardContent>
    </Card>
  )
}

interface SwitchRowProps {
  id: string
  label: string
  hint: string
  checked: boolean
  disabled?: boolean
  onCheckedChange: (checked: boolean) => void
}

/** A switch with its label beside it and its hint below. */
function SwitchRow({
  id,
  label,
  hint,
  checked,
  disabled,
  onCheckedChange
}: SwitchRowProps): React.JSX.Element {
  return (
    <div className="grid gap-1">
      <div className="flex items-center justify-between gap-stack-md">
        <Label htmlFor={id}>{label}</Label>
        <Switch
          id={id}
          checked={checked}
          disabled={disabled}
          aria-describedby={`${id}-hint`}
          onCheckedChange={onCheckedChange}
        />
      </div>
      <p id={`${id}-hint`} className="m-0 text-sm text-on-surface-variant">
        {hint}
      </p>
    </div>
  )
}
