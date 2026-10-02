import { useEffect, useRef, useState, type ReactNode } from 'react'
import {
  ArrowLeftIcon,
  BookMarkedIcon,
  BookmarkIcon,
  ChevronRightIcon,
  EyeIcon,
  FileCode2Icon,
  FileTextIcon,
  LanguagesIcon,
  PenLineIcon,
  RefreshCwIcon,
  SettingsIcon,
  SparklesIcon,
  UserRoundIcon,
  WandSparklesIcon
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button, Checkbox, NavItem, Switch } from '@ki4jlu/design-system'
import {
  REPHRASE_STYLES,
  REPHRASE_TONES,
  type TranslatorEngine,
  type TranslatorGlossary
} from '@justcampus/shared'
import { cn } from '@/lib/utils'
import type { TranslatorState, TranslatorMode } from './translator-store'

const ICON = { 'aria-hidden': true, className: 'size-4' } as const

const MODE_ICONS: Record<TranslatorMode, ReactNode> = {
  translate: <LanguagesIcon {...ICON} />,
  documents: <FileTextIcon {...ICON} />,
  rephrase: <WandSparklesIcon {...ICON} />,
  create: <PenLineIcon {...ICON} />
}

type Subview = 'model' | 'glossaries' | 'style' | null

export interface TranslatorSidebarProps {
  id: string
  state: TranslatorState
  /** The modes offered, in order. */
  modes: readonly TranslatorMode[]
  engines: readonly TranslatorEngine[]
  /** The engine the current mode works with. */
  engine: TranslatorEngine | null
  /** What the model picker calls the models' group. */
  llmProvider: string | null
  glossaries: readonly TranslatorGlossary[] | undefined
  onMode: (mode: TranslatorMode) => void
  onEngine: (engine: TranslatorEngine) => void
  onLive: (live: boolean) => void
  onShowChanges: (show: boolean) => void
  onAiContextMenu: (on: boolean) => void
  onFormatting: (on: boolean) => void
  onGlossaries: (ids: string[]) => void
  onManageGlossaries: () => void
  onStyle: (style: (typeof REPHRASE_STYLES)[number]) => void
  onTone: (tone: (typeof REPHRASE_TONES)[number]) => void
  onFormality: (formality: 'formal' | 'informal') => void
  onResetStyle: () => void
}

/**
 * The translator's own column, left of its work area as in HAWKI: the modes, the language model,
 * the editing tools of the mode, and the adjustments. Model, glossaries and writing style open
 * views of their own within the column, with a heading and a way back.
 */
export function TranslatorSidebar(props: TranslatorSidebarProps): React.JSX.Element {
  const { t } = useTranslation()
  const { id, state, engine } = props
  const [subview, setSubview] = useState<Subview>(null)
  const opener = useRef<HTMLButtonElement | null>(null)
  const mode = state.mode
  const documents = mode === 'documents'

  const open = (view: Exclude<Subview, null>, trigger: HTMLButtonElement): void => {
    opener.current = trigger
    setSubview(view)
  }
  const close = (): void => {
    setSubview(null)
    // Back where the view was opened from, once the main view is there again.
    requestAnimationFrame(() => opener.current?.focus())
  }

  const styleValue = state.style
    ? t(`component.translator.styles.${state.style}`)
    : state.tone
      ? t(`component.translator.tones.${state.tone}`)
      : state.formality !== 'default'
        ? t(`component.translator.formalities.${state.formality}`)
        : t('component.translator.styleDefault')
  const glossaryCount = `${state.glossaryIds.length}/${props.glossaries?.length ?? 0}`
  const deepl = engine?.kind === 'deepl'

  return (
    <div className="relative flex h-full min-h-0 flex-col">
      <div
        className={cn(
          'flex min-h-0 flex-1 flex-col gap-stack-lg overflow-y-auto p-4',
          subview && 'invisible'
        )}
        aria-hidden={subview ? true : undefined}
      >
        <ul aria-label={t('component.translator.mode')} className="m-0 grid list-none gap-1.5 p-0">
          {props.modes.map((option) => {
            const active = mode === option
            return (
              <li key={option}>
                <NavItem
                  type="button"
                  level="sub"
                  active={active}
                  // A choice within the page, not a page of its own.
                  aria-current={active ? 'true' : undefined}
                  onClick={() => props.onMode(option)}
                >
                  {MODE_ICONS[option]}
                  <span className="font-semibold">{t(`component.translator.modes.${option}`)}</span>
                </NavItem>
              </li>
            )
          })}
        </ul>

        <Section id={`${id}-model-title`} title={t('component.translator.engine')}>
          <SidebarRow
            icon={<UserRoundIcon {...ICON} />}
            label={engine?.label ?? t('component.translator.selectModel')}
            disabled={documents || props.engines.length === 0}
            onOpen={(trigger) => open('model', trigger)}
            describedBy={`${id}-model-title`}
          />
        </Section>

        {documents ? null : (
          <Section id={`${id}-tools-title`} title={t('component.translator.tools')}>
            {mode === 'create' ? (
              <>
                <ToggleRow
                  id={`${id}-ai-menu`}
                  icon={<SparklesIcon {...ICON} />}
                  label={t('component.translator.aiContextMenu')}
                  checked={state.aiContextMenu}
                  onChange={props.onAiContextMenu}
                />
                <ToggleRow
                  id={`${id}-formatting`}
                  icon={<FileCode2Icon {...ICON} />}
                  label={t('component.translator.formatting')}
                  checked={state.formatting}
                  onChange={props.onFormatting}
                />
              </>
            ) : (
              <>
                <ToggleRow
                  id={`${id}-live`}
                  icon={<RefreshCwIcon {...ICON} />}
                  label={t('component.translator.live')}
                  // DeepL has no live mode: the switch stays, greyed out.
                  checked={state.live}
                  disabled={deepl}
                  onChange={props.onLive}
                />
                {mode === 'rephrase' ? (
                  <ToggleRow
                    id={`${id}-changes`}
                    icon={<EyeIcon {...ICON} />}
                    label={t('component.translator.showChanges')}
                    checked={state.showChanges}
                    onChange={props.onShowChanges}
                  />
                ) : null}
              </>
            )}
          </Section>
        )}

        <Section id={`${id}-options-title`} title={t('component.translator.options')}>
          {mode === 'translate' || documents ? (
            <SidebarRow
              icon={<BookMarkedIcon {...ICON} />}
              label={t('component.translator.glossaries.title')}
              value={glossaryCount}
              onOpen={(trigger) => open('glossaries', trigger)}
            />
          ) : null}
          <SidebarRow
            icon={<BookmarkIcon {...ICON} />}
            label={t('component.translator.styleTitle')}
            value={styleValue}
            onOpen={(trigger) => open('style', trigger)}
          />
        </Section>
      </div>

      {subview === 'model' ? (
        <Subview title={t('component.translator.engine')} onBack={close}>
          <ModelList
            engines={
              mode === 'create'
                ? props.engines.filter((option) => option.kind === 'llm')
                : props.engines
            }
            selected={engine?.id ?? null}
            llmProvider={props.llmProvider}
            onSelect={(choice) => {
              props.onEngine(choice)
              close()
            }}
          />
        </Subview>
      ) : null}

      {subview === 'glossaries' ? (
        <Subview
          title={t('component.translator.glossaries.title')}
          aside={glossaryCount}
          onBack={close}
          footer={
            <Button
              type="button"
              variant="outline"
              onClick={props.onManageGlossaries}
              className="w-full"
            >
              <SettingsIcon {...ICON} />
              {t('component.translator.glossaries.manage')}
            </Button>
          }
        >
          <GlossaryChoice
            id={id}
            glossaries={props.glossaries}
            selected={state.glossaryIds}
            onChange={props.onGlossaries}
          />
        </Subview>
      ) : null}

      {subview === 'style' ? (
        <Subview title={t('component.translator.styleTitle')} onBack={close}>
          <StylePanel
            state={state}
            full={mode === 'rephrase' || mode === 'create'}
            onStyle={(style) => {
              props.onStyle(style)
              close()
            }}
            onTone={(tone) => {
              props.onTone(tone)
              close()
            }}
            onFormality={(formality) => {
              props.onFormality(formality)
              close()
            }}
            onReset={props.onResetStyle}
          />
        </Subview>
      ) : null}
    </div>
  )
}

/** A group of the column under its small title. */
function Section({
  id,
  title,
  children
}: {
  id: string
  title: string
  children: ReactNode
}): React.JSX.Element {
  return (
    <section aria-labelledby={id} className="grid gap-1">
      <h3 id={id} className="m-0 px-3 pb-1 text-xs font-medium text-on-surface-variant">
        {title}
      </h3>
      {children}
    </section>
  )
}

/** A row that opens a view of the column: icon, label, the current value, a chevron. */
function SidebarRow({
  icon,
  label,
  value,
  disabled,
  describedBy,
  onOpen
}: {
  icon: ReactNode
  label: string
  value?: string
  disabled?: boolean
  describedBy?: string
  onOpen: (trigger: HTMLButtonElement) => void
}): React.JSX.Element {
  return (
    <NavItem
      type="button"
      level="sub"
      disabled={disabled}
      aria-describedby={describedBy}
      onClick={(event) => onOpen(event.currentTarget)}
      className={cn('disabled:cursor-not-allowed disabled:opacity-60')}
    >
      {icon}
      <span className="min-w-0 flex-1 truncate text-left">{label}</span>
      {value ? <span className="shrink-0 text-xs text-on-surface-variant">{value}</span> : null}
      <ChevronRightIcon {...ICON} />
    </NavItem>
  )
}

/** A switch with its icon and label. */
function ToggleRow({
  id,
  icon,
  label,
  checked,
  disabled,
  onChange
}: {
  id: string
  icon: ReactNode
  label: string
  checked: boolean
  disabled?: boolean
  onChange: (checked: boolean) => void
}): React.JSX.Element {
  return (
    <div
      className={cn(
        'flex min-h-10 items-center justify-between gap-3 px-3',
        disabled && 'opacity-60'
      )}
    >
      <label
        htmlFor={id}
        className="flex min-w-0 items-center gap-3 text-sm text-on-surface [&_svg]:text-on-surface-variant"
      >
        {icon}
        <span className="truncate">{label}</span>
      </label>
      <Switch id={id} checked={checked} disabled={disabled} onCheckedChange={onChange} />
    </div>
  )
}

/** A view within the column: back arrow and heading on top, its content below. */
function Subview({
  title,
  aside,
  onBack,
  footer,
  children
}: {
  title: string
  aside?: string
  onBack: () => void
  footer?: ReactNode
  children: ReactNode
}): React.JSX.Element {
  const { t } = useTranslation()
  const back = useRef<HTMLButtonElement>(null)
  useEffect(() => back.current?.focus(), [])
  return (
    <div
      role="region"
      aria-label={title}
      className="absolute inset-0 flex flex-col bg-surface"
      onKeyDown={(event) => {
        if (event.key === 'Escape') onBack()
      }}
    >
      <div className="flex items-center gap-3 border-b border-outline-variant px-3 py-4">
        <Button
          ref={back}
          type="button"
          variant="ghost"
          size="icon"
          aria-label={t('component.translator.back')}
          onClick={onBack}
        >
          <ArrowLeftIcon {...ICON} />
        </Button>
        <h3 className="m-0 flex-1 text-base font-semibold text-on-surface">{title}</h3>
        {aside ? <span className="pe-2 text-sm text-on-surface-variant">{aside}</span> : null}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">{children}</div>
      {footer ? <div className="border-t border-outline-variant p-4">{footer}</div> : null}
    </div>
  )
}

/** The engines by provider: DeepL, then the AI models under their provider's name. */
function ModelList({
  engines,
  selected,
  llmProvider,
  onSelect
}: {
  engines: readonly TranslatorEngine[]
  selected: string | null
  llmProvider: string | null
  onSelect: (engine: TranslatorEngine) => void
}): React.JSX.Element {
  const { t } = useTranslation()
  if (engines.length === 0) {
    return (
      <p className="m-0 p-3 text-sm text-on-surface-variant">
        {t('component.translator.noModels')}
      </p>
    )
  }
  const groups = [
    { name: 'DeepL', engines: engines.filter((engine) => engine.kind === 'deepl') },
    {
      name: llmProvider || t('component.translator.llmProvider'),
      engines: engines.filter((engine) => engine.kind === 'llm')
    }
  ].filter((group) => group.engines.length > 0)
  return (
    <div className="grid gap-3">
      {groups.map((group) => (
        <section key={group.name} aria-label={group.name} className="grid gap-0.5">
          <h4 className="m-0 px-3 py-1 text-xs font-bold tracking-wide text-on-surface uppercase">
            {group.name}
          </h4>
          <ul className="m-0 grid list-none gap-0.5 p-0">
            {group.engines.map((engine) => {
              const active = engine.id === selected
              return (
                <li key={engine.id}>
                  <NavItem
                    type="button"
                    level="sub"
                    active={active}
                    aria-current={active ? 'true' : undefined}
                    onClick={() => onSelect(engine)}
                  >
                    <span
                      aria-hidden="true"
                      className="size-1.5 shrink-0 rounded-full bg-success"
                    />
                    <span className={cn('truncate', active && 'font-semibold')}>
                      {engine.label}
                    </span>
                  </NavItem>
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </div>
  )
}

/** The glossaries with a checkbox each; several can be on at once. */
function GlossaryChoice({
  id,
  glossaries,
  selected,
  onChange
}: {
  id: string
  glossaries: readonly TranslatorGlossary[] | undefined
  selected: readonly string[]
  onChange: (ids: string[]) => void
}): React.JSX.Element {
  const { t } = useTranslation()
  if (!glossaries)
    return (
      <p className="m-0 p-3 text-sm text-on-surface-variant">
        {t('component.translator.glossaries.loading')}
      </p>
    )
  if (glossaries.length === 0) {
    return (
      <p className="m-0 p-6 text-center text-sm text-on-surface-variant">
        {t('component.translator.glossaries.none')}
      </p>
    )
  }
  return (
    <ul className="m-0 grid list-none gap-1 p-0">
      {glossaries.map((glossary) => {
        const checked = selected.includes(glossary.id)
        const checkboxId = `${id}-glossary-${glossary.id}`
        return (
          <li
            key={glossary.id}
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2.5',
              checked && 'bg-secondary-container text-on-secondary-container'
            )}
          >
            <Checkbox
              id={checkboxId}
              checked={checked}
              onCheckedChange={(value) =>
                onChange(
                  value === true
                    ? [...selected, glossary.id]
                    : selected.filter((other) => other !== glossary.id)
                )
              }
            />
            <label
              htmlFor={checkboxId}
              className="flex min-w-0 flex-1 items-baseline gap-2 text-sm"
            >
              <span className="truncate font-medium">{glossary.name}</span>
              <span className="shrink-0 text-xs text-on-surface-variant">
                {`• ${t('component.translator.glossaries.terms', { count: glossary.entryCount })}`}
              </span>
            </label>
          </li>
        )
      })}
    </ul>
  )
}

/**
 * Writing style, tone and formality, one at a time: "Standard" clears them. Translating offers
 * the formality alone; rewriting and the editor offer all three.
 */
function StylePanel({
  state,
  full,
  onStyle,
  onTone,
  onFormality,
  onReset
}: {
  state: TranslatorState
  full: boolean
  onStyle: (style: (typeof REPHRASE_STYLES)[number]) => void
  onTone: (tone: (typeof REPHRASE_TONES)[number]) => void
  onFormality: (formality: 'formal' | 'informal') => void
  onReset: () => void
}): React.JSX.Element {
  const { t } = useTranslation()
  const standard = !state.style && !state.tone && state.formality === 'default'
  return (
    <div className="grid gap-stack-lg p-1">
      <NavItem
        type="button"
        level="sub"
        active={standard}
        aria-pressed={standard}
        onClick={onReset}
      >
        <span className="font-semibold">{t('component.translator.styleDefault')}</span>
      </NavItem>
      {full ? (
        <>
          <ChoiceGroup
            title={t('component.translator.style')}
            options={REPHRASE_STYLES.map((style) => ({
              key: style,
              label: t(`component.translator.styles.${style}`),
              active: state.style === style,
              onSelect: () => onStyle(style)
            }))}
          />
          <ChoiceGroup
            title={t('component.translator.tone')}
            options={REPHRASE_TONES.map((tone) => ({
              key: tone,
              label: t(`component.translator.tones.${tone}`),
              active: state.tone === tone,
              onSelect: () => onTone(tone)
            }))}
          />
        </>
      ) : null}
      <ChoiceGroup
        title={t('component.translator.formality')}
        options={(['formal', 'informal'] as const).map((formality) => ({
          key: formality,
          label: t(`component.translator.formalities.${formality}`),
          active: state.formality === formality,
          onSelect: () => onFormality(formality)
        }))}
      />
    </div>
  )
}

function ChoiceGroup({
  title,
  options
}: {
  title: string
  options: Array<{ key: string; label: string; active: boolean; onSelect: () => void }>
}): React.JSX.Element {
  return (
    <section aria-label={title} className="grid gap-1">
      <h4 className="m-0 px-3 pb-1 text-xs font-medium text-on-surface-variant">{title}</h4>
      {options.map((option) => (
        <NavItem
          key={option.key}
          type="button"
          level="sub"
          active={option.active}
          aria-pressed={option.active}
          onClick={option.onSelect}
          className="ps-6"
        >
          <span className={cn(option.active && 'font-semibold')}>{option.label}</span>
        </NavItem>
      ))}
    </section>
  )
}
