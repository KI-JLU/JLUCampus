import { useMemo, useState } from 'react'
import { CheckIcon, ChevronsUpDownIcon, XIcon } from 'lucide-react'
import { DynamicIcon } from 'lucide-react/dynamic'
import { useTranslation } from 'react-i18next'
import {
  Button,
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  Popover,
  PopoverContent,
  PopoverTrigger
} from '@ki4jlu/design-system'
import { ALL_ICON_NAMES } from '@/lib/icons'
import { ComponentIcon } from './component-icon'
import type { FieldControlProps } from './field'

/** Rendering all ~1700 icons at once is slow; the search narrows it down. */
const MAX_MATCHES = 60

interface IconPickerProps extends FieldControlProps {
  value: string | null
  onChange: (value: string | null) => void
}

export function IconPicker({ value, onChange, ...control }: IconPickerProps): React.JSX.Element {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')

  const { matches, total } = useMemo(() => {
    const query = search.trim().toLowerCase().replace(/\s+/g, '-')
    const all = query ? ALL_ICON_NAMES.filter((name) => name.includes(query)) : ALL_ICON_NAMES
    return { matches: all.slice(0, MAX_MATCHES), total: all.length }
  }, [search])

  const choose = (name: string | null): void => {
    onChange(name)
    setOpen(false)
    setSearch('')
  }

  return (
    <div className="flex items-center gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            {...control}
            type="button"
            variant="outline"
            className="min-w-0 flex-1 justify-start"
          >
            {value ? (
              <>
                <ComponentIcon icon={value} iconUrl={null} />
                <span className="min-w-0 flex-1 truncate text-left">{value}</span>
              </>
            ) : (
              <span className="min-w-0 flex-1 text-left text-on-surface-variant">
                {t('iconPicker.placeholder')}
              </span>
            )}
            <ChevronsUpDownIcon aria-hidden="true" width="1em" height="1em" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-80 p-0">
          <Command shouldFilter={false} label={t('iconPicker.label')}>
            <CommandInput
              value={search}
              onValueChange={setSearch}
              placeholder={t('iconPicker.search')}
              aria-label={t('iconPicker.search')}
            />
            <CommandList>
              <CommandEmpty>{t('iconPicker.empty')}</CommandEmpty>
              <CommandGroup
                heading={
                  total > MAX_MATCHES
                    ? t('iconPicker.truncated', { shown: MAX_MATCHES, total })
                    : undefined
                }
              >
                {matches.map((name) => (
                  <CommandItem key={name} value={name} onSelect={() => choose(name)}>
                    <DynamicIcon name={name} aria-hidden="true" />
                    <span className="min-w-0 flex-1 truncate">{name}</span>
                    {value === name ? <CheckIcon aria-hidden="true" /> : null}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {value ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={t('iconPicker.clear')}
          onClick={() => choose(null)}
        >
          <XIcon aria-hidden="true" width="1em" height="1em" />
        </Button>
      ) : null}
    </div>
  )
}
