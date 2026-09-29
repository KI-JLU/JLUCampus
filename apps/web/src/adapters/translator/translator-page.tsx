import { useId, type FormEvent, type KeyboardEvent } from 'react'
import { ArrowLeftRightIcon, LanguagesIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button, Card, Container, Label, Textarea } from '@ki4jlu/design-system'
import { TRANSLATE_TEXT_MAX } from '@justcampus/shared'
import { ComponentIcon } from '@/components/component-icon'
import { Field } from '@/components/field'
import { PageHeader } from '@/components/page-header'
import type { ComponentViewProps } from '../types'
import { CopyButton } from './copy-button'
import { LanguageSelect } from './language-select'
import { isApplePlatform, isTranslateShortcut } from './languages'
import { TranslationOutput } from './translation-output'
import { useTranslator } from './use-translator'

const ICON = { 'aria-hidden': true, width: '1em', height: '1em' } as const

/**
 * The translator: source text and its language on one side, the translation
 * and its language on the other; side by side from `md` up, stacked below.
 */
export function TranslatorPage({ component }: ComponentViewProps<'translator'>): React.JSX.Element {
  const { t, i18n } = useTranslation()
  const id = useId()
  const translator = useTranslator(component.config.defaultTargetLanguage)
  const { text, result, pending, error } = translator
  const locale = i18n.resolvedLanguage ?? i18n.language
  const shortcut = t(
    isApplePlatform() ? 'component.translator.shortcutMac' : 'component.translator.shortcut'
  )

  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault()
    translator.translate()
  }
  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>): void => {
    if (!isTranslateShortcut(event)) return
    event.preventDefault()
    translator.translate()
  }

  return (
    <Container size="content" className="flex flex-col gap-stack-lg py-gutter md:py-margin-page">
      <PageHeader
        title={
          <>
            <ComponentIcon icon={component.icon} iconUrl={component.iconUrl} />
            <span className="truncate">{component.name}</span>
          </>
        }
        description={t('component.translator.pageDescription', {
          max: TRANSLATE_TEXT_MAX.toLocaleString(locale)
        })}
      />
      <Card>
        <form noValidate onSubmit={submit} className="grid gap-gutter p-4 md:grid-cols-2 md:p-6">
          <div className="flex min-w-0 flex-col gap-stack-sm">
            <div className="flex items-end gap-2">
              <Field
                id={`${id}-source`}
                label={t('component.translator.source')}
                className="min-w-0 flex-1"
              >
                {(control) => (
                  <LanguageSelect
                    {...control}
                    allowDetect
                    value={translator.source}
                    detected={result?.detectedSource}
                    onChange={translator.setSource}
                  />
                )}
              </Field>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={t('component.translator.swap')}
                title={t('component.translator.swap')}
                disabled={!translator.canSwap}
                onClick={translator.swap}
                className="mb-2"
              >
                <ArrowLeftRightIcon {...ICON} />
              </Button>
            </div>
            <Label htmlFor={`${id}-text`} className="sr-only">
              {t('component.translator.text')}
            </Label>
            <Textarea
              id={`${id}-text`}
              value={text}
              maxLength={TRANSLATE_TEXT_MAX}
              placeholder={t('component.translator.placeholder')}
              dir="auto"
              lang={translator.source ?? undefined}
              aria-describedby={`${id}-count`}
              aria-keyshortcuts="Control+Enter Meta+Enter"
              onChange={(event) => translator.setText(event.target.value)}
              onKeyDown={handleKeyDown}
              className="min-h-56 flex-1"
            />
            <div className="flex min-h-11 flex-wrap items-center justify-between gap-2">
              <p id={`${id}-count`} className="m-0 text-sm text-on-surface-variant">
                {t('component.translator.count', {
                  length: text.length.toLocaleString(locale),
                  max: TRANSLATE_TEXT_MAX.toLocaleString(locale)
                })}
              </p>
              <div className="flex items-center gap-stack-sm">
                <span
                  aria-hidden="true"
                  className="hidden text-sm text-on-surface-variant sm:inline"
                >
                  {shortcut}
                </span>
                <Button
                  type="submit"
                  disabled={!translator.canTranslate}
                  aria-keyshortcuts="Control+Enter Meta+Enter"
                >
                  <LanguagesIcon {...ICON} />
                  {pending
                    ? t('component.translator.translating')
                    : t('component.translator.translate')}
                </Button>
              </div>
            </div>
          </div>
          <div className="flex min-w-0 flex-col gap-stack-sm">
            <Field id={`${id}-target`} label={t('component.translator.target')}>
              {(control) => (
                <LanguageSelect
                  {...control}
                  value={translator.target}
                  onChange={translator.setTarget}
                />
              )}
            </Field>
            <TranslationOutput
              translator={translator}
              language={translator.target}
              htmlFor={`${id}-text`}
              className="min-h-56 flex-1"
            />
            <div className="flex min-h-11 items-center justify-end gap-2">
              <CopyButton text={pending || error ? undefined : result?.translation} />
            </div>
          </div>
        </form>
      </Card>
    </Container>
  )
}
