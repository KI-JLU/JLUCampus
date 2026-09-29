import { useState } from 'react'
import { getRouteApi } from '@tanstack/react-router'
import { LogInIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { AuthLayout, Button, Logo, SegmentedControl, ThemeToggle } from '@ki4jlu/design-system'
import { KEYCLOAK_PROVIDER_ID, LANGUAGES, languageSchema } from '@justcampus/shared'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { authClient } from '@/lib/auth-client'
import { useLanguage } from '@/lib/language'
import { safeRedirect } from '@/lib/redirect'

const route = getRouteApi('/login')

export function LoginPage(): React.JSX.Element {
  const { t } = useTranslation()
  const { redirect, error: callbackError } = route.useSearch()
  const { language, setLanguage } = useLanguage({ persist: false })
  const [pending, setPending] = useState(false)
  const [failed, setFailed] = useState(false)

  const signIn = async (): Promise<void> => {
    setPending(true)
    setFailed(false)
    // On success the client leaves the page for Keycloak, so `pending` stays set.
    const { error } = await authClient.signIn.social({
      provider: KEYCLOAK_PROVIDER_ID,
      callbackURL: `${window.location.origin}${safeRedirect(redirect)}`,
      errorCallbackURL: `${window.location.origin}/login`
    })
    if (error) {
      setPending(false)
      setFailed(true)
    }
  }

  return (
    <AuthLayout
      logo={<Logo product="Campus" />}
      title={t('login.title')}
      headingLevel={1}
      description={t('login.description')}
      footer={
        <div className="flex flex-wrap items-center justify-center gap-stack-md">
          <SegmentedControl
            aria-label={t('language.label')}
            options={LANGUAGES.map((option) => ({ value: option, label: t(`language.${option}`) }))}
            value={language}
            onValueChange={(value) => {
              const parsed = languageSchema.safeParse(value)
              if (parsed.success) setLanguage(parsed.data)
            }}
          />
          <ThemeToggle
            themeLabel={t('theme.label')}
            lightLabel={t('theme.light')}
            systemLabel={t('theme.system')}
            darkLabel={t('theme.dark')}
          />
        </div>
      }
    >
      <div className="flex flex-col gap-stack-md">
        {failed || callbackError ? (
          <Alert variant="destructive">
            <AlertDescription>{t('login.failed')}</AlertDescription>
          </Alert>
        ) : null}
        <Button size="lg" className="w-full" disabled={pending} onClick={() => void signIn()}>
          <LogInIcon aria-hidden="true" width="1em" height="1em" />
          {pending ? t('login.redirecting') : t('login.signIn')}
        </Button>
      </div>
    </AuthLayout>
  )
}
