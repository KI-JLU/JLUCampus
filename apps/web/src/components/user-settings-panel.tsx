import { useId } from 'react'
import { LanguagesIcon, SunMoonIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import {
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SettingsRow,
  ThemeToggle
} from '@ki4jlu/design-system'
import { LANGUAGES, languageSchema } from '@justcampus/shared'
import { useLanguage } from '@/lib/language'
import { SETTINGS_CONTROL_ID, type SettingsSectionId } from '@/lib/user-settings'

// The size of the rail's expand icon above them.
const RAIL_ICON = { 'aria-hidden': true, className: 'h-5 w-5' } as const

/**
 * The user's settings, as the body of the right-hand column: interface language (saved to the
 * profile) and colour scheme. The language picker sits under its label, since the column is narrow.
 */
export function UserSettings(): React.JSX.Element {
  const { t } = useTranslation()
  const { language, setLanguage } = useLanguage({ persist: true })
  const languageLabelId = useId()

  return (
    <div className="flex flex-col px-4">
      <SettingsRow
        label={t('settings.language.label')}
        description={t('settings.language.description')}
        labelId={languageLabelId}
      >
        <Select
          value={language}
          onValueChange={(value) => {
            const parsed = languageSchema.safeParse(value)
            if (parsed.success) setLanguage(parsed.data)
          }}
        >
          <SelectTrigger
            id={SETTINGS_CONTROL_ID.language}
            aria-labelledby={languageLabelId}
            className="w-full"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LANGUAGES.map((option) => (
              <SelectItem key={option} value={option} lang={option}>
                {t(`language.${option}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </SettingsRow>
      <SettingsRow
        label={t('theme.label')}
        description={t('settings.appearance.description')}
        control={
          <ThemeToggle
            id={SETTINGS_CONTROL_ID.appearance}
            themeLabel={t('theme.label')}
            lightLabel={t('theme.light')}
            systemLabel={t('theme.system')}
            darkLabel={t('theme.dark')}
          />
        }
      />
    </div>
  )
}

/** The collapsed column: one button per setting, each opening the column at it. */
export function UserSettingsRail({
  onOpen
}: {
  onOpen: (section: SettingsSectionId) => void
}): React.JSX.Element {
  const { t } = useTranslation()
  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        aria-label={t('settings.language.title')}
        title={t('settings.language.title')}
        onClick={() => onOpen('language')}
      >
        <LanguagesIcon {...RAIL_ICON} />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        aria-label={t('settings.appearance.title')}
        title={t('settings.appearance.title')}
        onClick={() => onOpen('appearance')}
      >
        <SunMoonIcon {...RAIL_ICON} />
      </Button>
    </>
  )
}
