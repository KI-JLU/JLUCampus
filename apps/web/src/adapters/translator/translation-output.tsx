import { AlertCircleIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Spinner } from '@ki4jlu/design-system'
import type { TranslatorLanguage } from '@justcampus/shared'
import { cn } from '@/lib/utils'
import { translateErrorKey } from './languages'
import type { Translator } from './use-translator'

interface TranslationOutputProps {
  translator: Pick<Translator, 'result' | 'pending' | 'error'>
  /** Language of the translation, for screenreader pronunciation. */
  language: TranslatorLanguage
  /** The source text field, which the result belongs to. */
  htmlFor: string
  className?: string
}

/**
 * The translation, or why there is none. A polite live region: screenreaders
 * read the result or the error once it arrives, not the spinner in between.
 */
export function TranslationOutput({
  translator: { result, pending, error },
  language,
  htmlFor,
  className
}: TranslationOutputProps): React.JSX.Element {
  const { t } = useTranslation()
  return (
    <output
      htmlFor={htmlFor}
      aria-live="polite"
      aria-busy={pending}
      aria-label={t('component.translator.result')}
      className={cn(
        'block overflow-y-auto rounded-field border border-outline-variant bg-surface-container px-4 py-3',
        className
      )}
    >
      {pending ? (
        <span className="flex size-full items-center justify-center">
          <Spinner label={t('component.translator.translating')} />
        </span>
      ) : error ? (
        <span className="flex items-start gap-1.5 text-error">
          <AlertCircleIcon aria-hidden="true" className="mt-1 size-4 shrink-0" />
          <span>{t(translateErrorKey(error))}</span>
        </span>
      ) : result ? (
        <span lang={language} dir="auto" className="block whitespace-pre-wrap break-words">
          {result.translation}
        </span>
      ) : (
        <span className="text-on-surface-variant">{t('component.translator.empty')}</span>
      )}
    </output>
  )
}
