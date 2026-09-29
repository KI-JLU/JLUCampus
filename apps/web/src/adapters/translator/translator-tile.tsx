import { useId, type FormEvent, type KeyboardEvent } from 'react'
import { Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { Button, Label, Textarea } from '@ki4jlu/design-system'
import { TRANSLATE_TEXT_MAX } from '@justcampus/shared'
import { ComponentIcon } from '@/components/component-icon'
import type { ComponentViewProps } from '../types'
import { CopyButton } from './copy-button'
import { LanguageSelect } from './language-select'
import { isTranslateShortcut } from './languages'
import { TranslationOutput } from './translation-output'
import { useTranslator } from './use-translator'

/**
 * A quick translation on the dashboard: text in, target language, result
 * below. The source language is always detected; choosing it, swapping and
 * long texts are for the page, which the title opens.
 */
export function TranslatorTile({ component }: ComponentViewProps<'translator'>): React.JSX.Element {
  const { t } = useTranslation()
  const id = useId()
  const translator = useTranslator(component.config.defaultTargetLanguage)
  const { result, pending, error } = translator

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
    <form noValidate onSubmit={submit} className="flex size-full flex-col">
      <div className="flex h-9 shrink-0 items-center gap-2 border-b border-outline-variant px-3">
        <span className="flex shrink-0 text-on-surface-variant">
          <ComponentIcon icon={component.icon} iconUrl={component.iconUrl} />
        </span>
        <h2 className="m-0 flex min-w-0 flex-1 text-sm font-semibold text-on-surface">
          <Link
            to="/c/$componentId"
            params={{ componentId: component.id }}
            aria-label={t('dashboard.openPage', { name: component.name })}
            className="truncate text-on-surface no-underline hover:underline"
          >
            {component.name}
          </Link>
        </h2>
        <CopyButton
          text={pending || error ? undefined : result?.translation}
          className="-mr-2 group-data-editing/tile:invisible"
        />
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-2 p-3">
        <Label htmlFor={`${id}-text`} className="sr-only">
          {t('component.translator.text')}
        </Label>
        <Textarea
          id={`${id}-text`}
          value={translator.text}
          maxLength={TRANSLATE_TEXT_MAX}
          placeholder={t('component.translator.tilePlaceholder')}
          dir="auto"
          aria-keyshortcuts="Control+Enter Meta+Enter"
          onChange={(event) => translator.setText(event.target.value)}
          onKeyDown={handleKeyDown}
          className="min-h-12 flex-1 resize-none"
        />
        <div className="flex items-center gap-2">
          <Label htmlFor={`${id}-target`} className="sr-only">
            {t('component.translator.target')}
          </Label>
          <LanguageSelect
            id={`${id}-target`}
            compact
            value={translator.target}
            onChange={translator.setTarget}
            className="min-w-0 flex-1"
          />
          <Button
            type="submit"
            size="sm"
            disabled={!translator.canTranslate}
            aria-keyshortcuts="Control+Enter Meta+Enter"
          >
            {t('component.translator.translate')}
          </Button>
        </div>
        <TranslationOutput
          translator={translator}
          language={translator.target}
          htmlFor={`${id}-text`}
          className="min-h-12 flex-1 px-3 py-2 text-sm"
        />
      </div>
    </form>
  )
}
