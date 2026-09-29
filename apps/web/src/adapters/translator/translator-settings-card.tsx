import type { ReactNode } from 'react'
import {
  BookmarkIcon,
  EyeIcon,
  LanguagesIcon,
  MessageCircleIcon,
  PenLineIcon,
  RefreshCwIcon,
  UserRoundIcon
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  NavItem,
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
import {
  TRANSLATOR_MODES,
  type TranslatorMode,
  type TranslatorSettings
} from './translator-settings'

/** Radix Select needs a non-empty value; this one stands for "no style" and "no tone". */
const NONE = 'default'

const ICON = { 'aria-hidden': true, width: '1em', height: '1em' } as const

/** A select beside its label in a settings row: as wide as its longest entry needs. */
const ROW_SELECT = 'w-auto min-w-36 py-2'

const MODE_ICONS: Record<TranslatorMode, ReactNode> = {
  translate: <LanguagesIcon {...ICON} />,
  rephrase: <PenLineIcon {...ICON} />
}

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
 * The page's column on the right, after HAWKI's translator: the modes on top, then the engine,
 * the editing tools and the options of the chosen mode.
 */
export function TranslatorSidebar(props: TranslatorSettingsFieldsProps): React.JSX.Element {
  const { t } = useTranslation()
  const { settings, onChange } = props
  return (
    <div className="grid gap-stack-lg">
      <ul aria-label={t('component.translator.mode')} className="m-0 grid list-none gap-1 p-0">
        {TRANSLATOR_MODES.map((mode) => {
          const active = settings.mode === mode
          const label = t(`component.translator.modes.${mode}`)
          return (
            <li key={mode}>
              <NavItem
                type="button"
                level="sub"
                active={active}
                // A choice within the page, not a page of its own.
                aria-current={active ? 'true' : undefined}
                onClick={() => onChange({ mode })}
              >
                {MODE_ICONS[mode]}
                <span>{label}</span>
              </NavItem>
            </li>
          )
        })}
      </ul>
      <TranslatorSettingsFields {...props} />
    </div>
  )
}

/**
 * Engine, editing tools and the options of the current mode, in titled sections. The column
 * shows them under the modes, narrow screens as a card below the translator.
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
  const translating = settings.mode === 'translate'

  return (
    <div className="grid gap-stack-lg">
      <Section id={`${id}-engine-title`} title={t('component.translator.engine')}>
        <Select
          value={engine?.id ?? ''}
          onValueChange={(next) => onChange({ engine: next })}
          disabled={!engines?.length}
        >
          <SelectTrigger id={`${id}-engine`} aria-labelledby={`${id}-engine-title`}>
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
      </Section>
      <Section id={`${id}-tools-title`} title={t('component.translator.tools')}>
        <SettingRow
          id={`${id}-live`}
          icon={<RefreshCwIcon {...ICON} />}
          label={t('component.translator.live')}
          hint={deepl ? t('component.translator.liveDeepl') : undefined}
        >
          <Switch
            id={`${id}-live`}
            checked={settings.live && !deepl}
            disabled={deepl}
            aria-describedby={deepl ? `${id}-live-hint` : undefined}
            onCheckedChange={(live) => onChange({ live })}
          />
        </SettingRow>
        <SettingRow
          id={`${id}-changes`}
          icon={<EyeIcon {...ICON} />}
          label={t('component.translator.showChanges')}
        >
          <Switch
            id={`${id}-changes`}
            checked={settings.showChanges}
            onCheckedChange={(showChanges) => onChange({ showChanges })}
          />
        </SettingRow>
      </Section>
      <Section id={`${id}-options-title`} title={t('component.translator.options')}>
        {translating ? (
          <SettingRow
            id={`${id}-formality`}
            icon={<UserRoundIcon {...ICON} />}
            label={t('component.translator.formality')}
          >
            <Select
              value={settings.formality}
              onValueChange={(next) => {
                const parsed = translatorFormalitySchema.safeParse(next)
                if (parsed.success) onChange({ formality: parsed.data })
              }}
            >
              <SelectTrigger id={`${id}-formality`} className={ROW_SELECT}>
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
          </SettingRow>
        ) : (
          <>
            <SettingRow
              id={`${id}-style`}
              icon={<BookmarkIcon {...ICON} />}
              label={t('component.translator.style')}
            >
              <Select
                value={style ?? NONE}
                onValueChange={(next) => {
                  const parsed = rephraseStyleSchema.nullable().catch(null).parse(next)
                  onChange(deepl && parsed ? { style: parsed, tone: null } : { style: parsed })
                }}
              >
                <SelectTrigger
                  id={`${id}-style`}
                  aria-describedby={deepl ? noteId : undefined}
                  className={ROW_SELECT}
                >
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
            </SettingRow>
            <SettingRow
              id={`${id}-tone`}
              icon={<MessageCircleIcon {...ICON} />}
              label={t('component.translator.tone')}
            >
              <Select
                value={tone ?? NONE}
                onValueChange={(next) => {
                  const parsed = rephraseToneSchema.nullable().catch(null).parse(next)
                  onChange(deepl && parsed ? { tone: parsed, style: null } : { tone: parsed })
                }}
              >
                <SelectTrigger
                  id={`${id}-tone`}
                  aria-describedby={deepl ? noteId : undefined}
                  className={ROW_SELECT}
                >
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
            </SettingRow>
            {deepl ? (
              <p id={noteId} className="m-0 text-xs text-on-surface-variant">
                {t('component.translator.deeplStyleOrTone')}
              </p>
            ) : null}
          </>
        )}
      </Section>
    </div>
  )
}

/** The settings as a card of their own, for narrow screens; the modes sit above the translator. */
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

/** A group of settings under a small title. */
function Section({
  id,
  title,
  children
}: {
  id: string
  title: string
  children: ReactNode
}): React.JSX.Element {
  return (
    <section aria-labelledby={id} className="grid gap-stack-sm">
      <h3 id={id} className="m-0 text-xs font-medium text-on-surface-variant">
        {title}
      </h3>
      {children}
    </section>
  )
}

interface SettingRowProps {
  /** The control's id, which the label points at. */
  id: string
  icon: ReactNode
  label: string
  /** Why the control is off, when it cannot be used; the control points at `${id}-hint`. */
  hint?: string
  /** The control (a switch or a select). */
  children: ReactNode
}

/** One setting: icon and label on the left, its control on the right, a hint below if any. */
function SettingRow({ id, icon, label, hint, children }: SettingRowProps): React.JSX.Element {
  return (
    <div className="grid gap-1">
      <div className="flex min-h-10 items-center justify-between gap-stack-md">
        <label
          htmlFor={id}
          className="flex min-w-0 items-center gap-3 text-sm text-on-surface [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-on-surface-variant"
        >
          {icon}
          <span className="truncate">{label}</span>
        </label>
        {children}
      </div>
      {hint ? (
        <p id={`${id}-hint`} className="m-0 ps-7 text-xs text-on-surface-variant">
          {hint}
        </p>
      ) : null}
    </div>
  )
}
