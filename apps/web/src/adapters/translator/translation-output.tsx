import { useMemo } from 'react'
import { AlertCircleIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Spinner } from '@ki4jlu/design-system'
import type { TranslatorLanguage } from '@justcampus/shared'
import { cn } from '@/lib/utils'
import { diffWords } from './diff'
import { translateErrorKey } from './languages'
import type { TranslatorMode } from './translator-settings'

interface TranslationOutputProps {
  /** Picks the texts for waiting and for no result yet. */
  mode?: TranslatorMode
  id?: string
  /** Accessible name; leave it out when a visible label points at `id`. */
  label?: string
  pending: boolean
  error: Error | null
  text: string | undefined
  /** Set to show what changed from this text to `text` instead of `text` alone. */
  compareTo?: string | null
  /** Language of the text, for screenreader pronunciation. */
  language?: TranslatorLanguage | null
  /** The source text field, which the result belongs to. */
  htmlFor: string
  className?: string
}

/**
 * The result, or why there is none. A polite live region: screenreaders
 * read the result or the error once it arrives, not the spinner in between.
 */
export function TranslationOutput({
  mode = 'translate',
  id,
  label,
  pending,
  error,
  text,
  compareTo,
  language,
  htmlFor,
  className
}: TranslationOutputProps): React.JSX.Element {
  const { t } = useTranslation()
  return (
    <output
      id={id}
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
          <Spinner
            label={t(
              mode === 'translate'
                ? 'component.translator.translating'
                : 'component.translator.rephrasing'
            )}
          />
        </span>
      ) : error ? (
        <span className="flex items-start gap-1.5 text-error">
          <AlertCircleIcon aria-hidden="true" className="mt-1 size-4 shrink-0" />
          <span>{t(translateErrorKey(error))}</span>
        </span>
      ) : text !== undefined ? (
        <span
          lang={language ?? undefined}
          dir="auto"
          className="block whitespace-pre-wrap break-words"
        >
          {compareTo != null ? <Changes before={compareTo} after={text} /> : text}
        </span>
      ) : (
        <span className="text-on-surface-variant">
          {t(
            mode === 'translate'
              ? 'component.translator.empty'
              : 'component.translator.rephraseEmpty'
          )}
        </span>
      )}
    </output>
  )
}

/**
 * `after` with the words taken out of `before` struck through and the new
 * ones highlighted. `del` and `ins` carry the meaning, but screenreaders
 * rarely announce them, so each change also says what it is.
 */
function Changes({ before, after }: { before: string; after: string }): React.JSX.Element {
  const { t } = useTranslation()
  const parts = useMemo(() => diffWords(before, after), [before, after])
  return (
    <>
      {parts.map((part, index) => {
        // A change of spacing alone is not worth marking: show the new spacing, drop the old.
        if (part.type === 'equal' || (part.type === 'insert' && !part.text.trim())) return part.text
        if (!part.text.trim()) return null
        const deleted = part.type === 'delete'
        const Tag = deleted ? 'del' : 'ins'
        const kind = t(
          deleted ? 'component.translator.diff.deleted' : 'component.translator.diff.inserted'
        )
        return (
          <Tag
            key={index}
            className={
              deleted
                ? 'me-0.5 text-error line-through'
                : 'rounded-sm bg-success-container text-on-success-container no-underline'
            }
          >
            <span className="sr-only">{`[${kind} `}</span>
            {part.text}
            <span className="sr-only">]</span>
          </Tag>
        )
      })}
    </>
  )
}
