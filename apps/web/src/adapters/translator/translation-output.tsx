import { AlertCircleIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Spinner } from '@ki4jlu/design-system'
import type { TranslatorLanguage } from '@justcampus/shared'
import { cn } from '@/lib/utils'
import { textErrorMessage } from './languages'

interface TranslationOutputProps {
  /** Accessible name; leave it out when a visible label points at the output. */
  label?: string
  pending: boolean
  error: Error | null
  text: string | undefined
  /** Language of the text, for screenreader pronunciation. */
  language?: TranslatorLanguage | null
  /** The source text field, which the result belongs to. */
  htmlFor: string
  className?: string
}

/**
 * The tile's result, or why there is none, said as the page says it. A polite live region: screenreaders
 * read the result or the error once it arrives, not the spinner in between.
 */
export function TranslationOutput({
  label,
  pending,
  error,
  text,
  language,
  htmlFor,
  className
}: TranslationOutputProps): React.JSX.Element {
  const { t } = useTranslation()
  // The page's words for the same failure.
  const message = error ? textErrorMessage(error, 'translate') : null
  return (
    <output
      htmlFor={htmlFor}
      aria-live="polite"
      aria-busy={pending}
      aria-label={label}
      className={cn(
        'block overflow-y-auto rounded-field border border-outline-variant bg-surface-container px-4 py-3',
        className
      )}
    >
      {pending ? (
        <span className="flex size-full items-center justify-center">
          <Spinner label={t('component.translator.translating')} />
        </span>
      ) : message ? (
        <span className="flex items-start gap-1.5 text-error">
          <AlertCircleIcon aria-hidden="true" className="mt-1 size-4 shrink-0" />
          <span>{'text' in message ? message.text : t(message.key)}</span>
        </span>
      ) : text !== undefined ? (
        <span
          lang={language ?? undefined}
          dir="auto"
          className="block whitespace-pre-wrap break-words"
        >
          {text}
        </span>
      ) : (
        <span className="text-on-surface-variant">{t('component.translator.empty')}</span>
      )}
    </output>
  )
}
