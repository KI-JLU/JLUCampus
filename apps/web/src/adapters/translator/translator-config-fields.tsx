import { useEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { DownloadIcon, PlusIcon, Trash2Icon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import {
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch
} from '@ki4jlu/design-system'
import {
  TRANSLATOR_DOCUMENT_TTL_HOURS,
  TRANSLATOR_LLM_MODELS_MAX,
  type TranslatorLlmModel
} from '@justcampus/shared'
import { Field } from '@/components/field'
import { ApiRequestError } from '@/lib/api'
import { useFetchTranslatorModels } from '@/lib/queries'
import { cn } from '@/lib/utils'
import type { ComponentConfigFieldsProps } from '../types'
import { LanguageSelect } from './language-select'
import { applyFetchedModels } from './llm-models'

/** Radix Select needs a non-empty value; this one stands for "no default engine". */
const AUTO = 'auto'

const ICON = { 'aria-hidden': true, width: '1em', height: '1em' } as const

/** The engine id of a model, as the default engine refers to it. */
function engineOf(model: TranslatorLlmModel): string {
  return `llm:${model.id.trim()}`
}

/** An empty URL field means "not set". */
function urlOrNull(value: string): string | null {
  return value.trim() ? value : null
}

/** What the last model fetch did, told below the model list. */
type FetchStatus =
  { kind: 'fetched'; count: number; omitted: number } | { kind: 'empty' | 'invalidUrl' | 'failed' }

/**
 * The translator's engines: DeepL with its optional API URL, and an
 * OpenAI-compatible endpoint with the models offered from it, which the
 * endpoint can list itself. The API keys follow as secret fields.
 */
export function TranslatorConfigFields({
  config,
  onChange,
  errors,
  secrets,
  idPrefix
}: ComponentConfigFieldsProps<'translator'>): React.JSX.Element {
  const { t } = useTranslation()
  const modelsId = `${idPrefix}-llm-models`
  const models = config.llmModels
  const fetchModels = useFetchTranslatorModels()
  const [fetchStatus, setFetchStatus] = useState<FetchStatus | null>(null)
  // The fetched models land in the config as it is by then, not as it was when the fetch began.
  const latestConfig = useRef(config)
  useEffect(() => {
    latestConfig.current = config
  })

  const loadModels = (): void => {
    const baseUrl = config.llmBaseUrl
    if (!baseUrl) return
    // The key as the form will save it: typed, removed, or else the saved one.
    const key = secrets.llmApiKey
    const apiKey = key?.remove ? null : key?.value.trim() || undefined
    setFetchStatus(null)
    fetchModels.mutate(
      { baseUrl, apiKey },
      {
        onSuccess: (fetched) => {
          // The address changed meanwhile; these models belong to the old one.
          if (latestConfig.current.llmBaseUrl !== baseUrl) return
          if (fetched.length === 0) {
            setFetchStatus({ kind: 'empty' })
            return
          }
          const result = applyFetchedModels(latestConfig.current, fetched)
          onChange(result.config)
          setFetchStatus({
            kind: 'fetched',
            count: result.config.llmModels.length,
            omitted: result.omitted
          })
        },
        onError: (error) =>
          setFetchStatus({
            kind:
              error instanceof ApiRequestError && error.code === 'validation'
                ? 'invalidUrl'
                : 'failed'
          })
      }
    )
  }

  const setModel = (index: number, model: TranslatorLlmModel): void => {
    // The default engine follows its model through a changed id.
    const previous = models[index]
    const isDefault = previous !== undefined && config.defaultEngine === engineOf(previous)
    onChange({
      ...config,
      llmModels: models.map((current, i) => (i === index ? model : current)),
      defaultEngine: isDefault ? (model.id.trim() ? engineOf(model) : null) : config.defaultEngine
    })
  }
  const addModel = (): void => {
    flushSync(() => onChange({ ...config, llmModels: [...models, { id: '', label: '' }] }))
    document.getElementById(`${modelsId}-${models.length}-id`)?.focus()
  }
  const removeModel = (index: number): void => {
    const removed = models[index]
    const isDefault = removed !== undefined && config.defaultEngine === engineOf(removed)
    flushSync(() =>
      onChange({
        ...config,
        llmModels: models.filter((_, i) => i !== index),
        defaultEngine: isDefault ? null : config.defaultEngine
      })
    )
    // The removed row took the focused button with it.
    document.getElementById(`${modelsId}-add`)?.focus()
  }

  return (
    <>
      <Field
        id={`${idPrefix}-default-target-language`}
        label={t('component.translator.defaultTargetLabel')}
        hint={t('component.translator.defaultTargetHint')}
        error={errors.defaultTargetLanguage}
      >
        {(control) => (
          <LanguageSelect
            {...control}
            value={config.defaultTargetLanguage}
            onChange={(language) => onChange({ ...config, defaultTargetLanguage: language })}
          />
        )}
      </Field>
      <Field
        id={`${idPrefix}-deepl-api-url`}
        label={t('component.translator.deeplApiUrlLabel')}
        hint={t('component.translator.deeplApiUrlHint')}
        error={errors.deeplApiUrl}
      >
        {(control) => (
          <Input
            {...control}
            type="url"
            inputMode="url"
            placeholder="https://api.deepl.com"
            value={config.deeplApiUrl ?? ''}
            onChange={(event) =>
              onChange({ ...config, deeplApiUrl: urlOrNull(event.target.value) })
            }
          />
        )}
      </Field>
      <Field
        id={`${idPrefix}-llm-base-url`}
        label={t('component.translator.llmBaseUrlLabel')}
        hint={t('component.translator.llmBaseUrlHint')}
        error={errors.llmBaseUrl}
      >
        {(control) => (
          <Input
            {...control}
            type="url"
            inputMode="url"
            placeholder="https://"
            value={config.llmBaseUrl ?? ''}
            onChange={(event) => onChange({ ...config, llmBaseUrl: urlOrNull(event.target.value) })}
          />
        )}
      </Field>
      <fieldset
        aria-describedby={[errors.llmModels && `${modelsId}-error`, `${modelsId}-hint`]
          .filter(Boolean)
          .join(' ')}
        className="m-0 flex min-w-0 flex-col gap-2 border-0 p-0"
      >
        <legend
          className={cn(
            'mb-2 text-sm font-medium text-on-surface',
            errors.llmModels && 'text-error'
          )}
        >
          {t('component.translator.llmModelsLabel')}
        </legend>
        {errors.llmModels ? (
          <p id={`${modelsId}-error`} className="m-0 text-sm text-error">
            {errors.llmModels}
          </p>
        ) : null}
        {models.length > 0 ? (
          <div
            aria-hidden="true"
            className="grid grid-cols-[1fr_1fr_2.5rem] gap-2 text-sm text-on-surface-variant"
          >
            <span>{t('component.translator.modelId')}</span>
            <span>{t('component.translator.modelLabel')}</span>
          </div>
        ) : null}
        {models.map((model, index) => {
          const rowId = `${modelsId}-${index}`
          const idError = errors[`llmModels.${index}.id`]
          const labelError = errors[`llmModels.${index}.label`]
          const rowName = model.label.trim() || model.id.trim() || String(index + 1)
          return (
            <div
              key={index}
              role="group"
              aria-label={t('component.translator.modelRow', { number: index + 1 })}
              className="grid gap-1"
            >
              <div className="grid grid-cols-[1fr_1fr_2.5rem] items-center gap-2">
                <Label htmlFor={`${rowId}-id`} className="sr-only">
                  {t('component.translator.modelId')}
                </Label>
                <Input
                  id={`${rowId}-id`}
                  value={model.id}
                  spellCheck={false}
                  autoComplete="off"
                  aria-invalid={idError ? true : undefined}
                  aria-describedby={idError ? `${rowId}-id-error` : undefined}
                  onChange={(event) => setModel(index, { ...model, id: event.target.value })}
                />
                <Label htmlFor={`${rowId}-label`} className="sr-only">
                  {t('component.translator.modelLabel')}
                </Label>
                <Input
                  id={`${rowId}-label`}
                  value={model.label}
                  autoComplete="off"
                  aria-invalid={labelError ? true : undefined}
                  aria-describedby={labelError ? `${rowId}-label-error` : undefined}
                  onChange={(event) => setModel(index, { ...model, label: event.target.value })}
                />
                <Button
                  type="button"
                  variant="ghost-destructive"
                  size="icon"
                  aria-label={t('component.translator.removeModel', { name: rowName })}
                  title={t('component.translator.removeModel', { name: rowName })}
                  onClick={() => removeModel(index)}
                >
                  <Trash2Icon {...ICON} />
                </Button>
              </div>
              {idError ? (
                <p id={`${rowId}-id-error`} className="m-0 text-sm text-error">
                  {idError}
                </p>
              ) : null}
              {labelError ? (
                <p id={`${rowId}-label-error`} className="m-0 text-sm text-error">
                  {labelError}
                </p>
              ) : null}
            </div>
          )
        })}
        <div className="flex flex-wrap gap-2">
          <Button
            id={`${modelsId}-add`}
            type="button"
            variant="secondary"
            size="sm"
            disabled={models.length >= TRANSLATOR_LLM_MODELS_MAX}
            onClick={addModel}
          >
            <PlusIcon {...ICON} />
            {t('component.translator.addModel')}
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={!config.llmBaseUrl || fetchModels.isPending}
            aria-describedby={`${modelsId}-fetch-status`}
            onClick={loadModels}
          >
            <DownloadIcon {...ICON} />
            {fetchModels.isPending
              ? t('component.translator.fetchingModels')
              : t('component.translator.fetchModels')}
          </Button>
        </div>
        <p
          id={`${modelsId}-fetch-status`}
          aria-live="polite"
          className={cn(
            'm-0 text-sm empty:hidden',
            fetchStatus?.kind === 'fetched' ? 'text-on-surface-variant' : 'text-error'
          )}
        >
          {fetchStatus?.kind === 'fetched'
            ? [
                t('component.translator.fetchedModels', { count: fetchStatus.count }),
                fetchStatus.omitted > 0
                  ? t('component.translator.fetchedModelsOmitted', {
                      count: fetchStatus.omitted,
                      max: TRANSLATOR_LLM_MODELS_MAX
                    })
                  : null
              ]
                .filter(Boolean)
                .join(' ')
            : fetchStatus
              ? t(`component.translator.fetchModelsErrors.${fetchStatus.kind}`)
              : null}
        </p>
        <p id={`${modelsId}-hint`} className="m-0 text-sm text-on-surface-variant">
          {t('component.translator.llmModelsHint', { max: TRANSLATOR_LLM_MODELS_MAX })}
        </p>
      </fieldset>
      <Field
        id={`${idPrefix}-default-engine`}
        label={t('component.translator.defaultEngineLabel')}
        hint={t('component.translator.defaultEngineHint')}
        error={errors.defaultEngine}
      >
        {(control) => (
          <Select
            value={config.defaultEngine ?? AUTO}
            onValueChange={(next) =>
              onChange({ ...config, defaultEngine: next === AUTO ? null : next })
            }
          >
            <SelectTrigger {...control}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={AUTO}>{t('component.translator.defaultEngineAuto')}</SelectItem>
              <SelectItem value="deepl">DeepL</SelectItem>
              {models.map((model, index) =>
                model.id.trim() ? (
                  <SelectItem key={index} value={engineOf(model)}>
                    {model.label.trim() || model.id}
                  </SelectItem>
                ) : null
              )}
            </SelectContent>
          </Select>
        )}
      </Field>
      <div className="grid gap-2">
        <div className="flex items-center justify-between gap-stack-md">
          <Label htmlFor={`${idPrefix}-documents`}>
            {t('component.translator.documentsEnabledLabel')}
          </Label>
          <Switch
            id={`${idPrefix}-documents`}
            checked={config.documentsEnabled}
            aria-describedby={`${idPrefix}-documents-hint`}
            onCheckedChange={(documentsEnabled) => onChange({ ...config, documentsEnabled })}
          />
        </div>
        <p id={`${idPrefix}-documents-hint`} className="m-0 text-sm text-on-surface-variant">
          {t('component.translator.documentsEnabledHint', { hours: TRANSLATOR_DOCUMENT_TTL_HOURS })}
        </p>
      </div>
    </>
  )
}
