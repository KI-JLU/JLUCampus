import { useId, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Container,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SettingsRow,
  Stack,
  ThemeToggle
} from '@ki4jlu/design-system'
import { LANGUAGES, languageSchema } from '@justcampus/shared'
import { PageHeader } from '@/components/page-header'
import { useLanguage } from '@/lib/language'

export function SettingsPage(): React.JSX.Element {
  const { t } = useTranslation()
  const { language, setLanguage } = useLanguage({ persist: true })
  const languageLabelId = useId()
  const themeLabelId = useId()

  return (
    <Container size="reading" className="flex flex-col gap-stack-lg py-gutter md:py-margin-page">
      <PageHeader title={t('settings.title')} description={t('settings.description')} />
      <Stack gap="lg">
        <SettingsSection id="language" title={t('settings.language.title')}>
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
        </SettingsSection>
        <SettingsSection id="appearance" title={t('settings.appearance.title')}>
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
        </SettingsSection>
      </Stack>
    </Container>
  )
}

interface SettingsSectionProps {
  id: string
  title: string
  children: ReactNode
}

function SettingsSection({ id, title, children }: SettingsSectionProps): React.JSX.Element {
  const headingId = `${id}-heading`
  return (
    <section id={id} aria-labelledby={headingId} className="scroll-mt-gutter">
      <Card>
        <CardHeader>
          <CardTitle asChild>
            <h2 id={headingId}>{title}</h2>
          </CardTitle>
        </CardHeader>
        <CardContent>{children}</CardContent>
      </Card>
    </section>
  )
}
