import { useTranslation } from 'react-i18next'
import { DEFAULT_LANGUAGE, languageSchema, type Language } from '@justcampus/shared'
import { useUpdateMe } from './queries'
import { toast } from './toast'

interface UseLanguage {
  language: Language
  setLanguage: (language: Language) => void
}

/** The UI language, and a setter that also saves it to the profile when signed in. */
export function useLanguage({ persist }: { persist: boolean }): UseLanguage {
  const { i18n, t } = useTranslation()
  const updateMe = useUpdateMe()
  const parsed = languageSchema.safeParse(i18n.resolvedLanguage)
  const language = parsed.success ? parsed.data : DEFAULT_LANGUAGE

  const setLanguage = (next: Language): void => {
    void i18n.changeLanguage(next)
    if (!persist) return
    updateMe.mutate(
      { language: next },
      { onError: () => toast({ variant: 'error', title: t('language.saveFailed') }) }
    )
  }
  return { language, setLanguage }
}
