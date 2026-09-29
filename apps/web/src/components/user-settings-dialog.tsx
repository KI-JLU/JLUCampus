import { useId } from 'react'
import { LanguagesIcon, SunMoonIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SettingsDialog,
  SettingsRow,
  ThemeToggle
} from '@ki4jlu/design-system'
import { LANGUAGES, languageSchema } from '@justcampus/shared'
import { useLanguage } from '@/lib/language'

const ICON = { 'aria-hidden': true, width: '1em', height: '1em' } as const

interface UserSettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** The user's settings window: interface language (saved to the profile) and colour scheme. */
export function UserSettingsDialog({
  open,
  onOpenChange
}: UserSettingsDialogProps): React.JSX.Element {
  const { t } = useTranslation()
  const { language, setLanguage } = useLanguage({ persist: true })
  const languageLabelId = useId()
  const themeLabelId = useId()

  return (
    <SettingsDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('settings.title')}
      closeLabel={t('common.close')}
      searchPlaceholder={t('settings.search')}
      emptyLabel={t('settings.noMatches')}
      sections={[
        {
          value: 'language',
          label: t('settings.language.title'),
          icon: <LanguagesIcon {...ICON} />,
          keywords: [t('settings.language.label')],
          content: (
            <SettingsRow
              label={t('settings.language.label')}
              description={t('settings.language.description')}
              labelId={languageLabelId}
              control={
                <Select
                  value={language}
                  onValueChange={(value) => {
                    const parsed = languageSchema.safeParse(value)
                    if (parsed.success) setLanguage(parsed.data)
                  }}
                >
                  <SelectTrigger aria-labelledby={languageLabelId} className="w-44">
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
              }
            />
          )
        },
        {
          value: 'appearance',
          label: t('settings.appearance.title'),
          icon: <SunMoonIcon {...ICON} />,
          keywords: [t('theme.label'), t('theme.light'), t('theme.dark')],
          content: (
            <SettingsRow
              label={t('theme.label')}
              description={t('settings.appearance.description')}
              labelId={themeLabelId}
              control={
                <ThemeToggle
                  themeLabel={t('theme.label')}
                  lightLabel={t('theme.light')}
                  systemLabel={t('theme.system')}
                  darkLabel={t('theme.dark')}
                />
              }
            />
          )
        }
      ]}
    />
  )
}
