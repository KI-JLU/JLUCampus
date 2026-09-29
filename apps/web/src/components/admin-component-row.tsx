import { ArrowDownIcon, ArrowUpIcon, PencilIcon, Trash2Icon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button, Switch, TableCell, TableRow } from '@ki4jlu/design-system'
import type { Component } from '@justcampus/shared'
import { adapterOf, externalUrlOf } from '@/adapters/registry'
import { ComponentIcon } from './component-icon'

interface AdminComponentRowProps {
  component: Component
  isFirst: boolean
  isLast: boolean
  onToggle: (enabled: boolean) => void
  onMove: (offset: -1 | 1) => void
  onEdit: () => void
  onDelete: () => void
}

const ICON = { 'aria-hidden': true, width: '1em', height: '1em' } as const

export function AdminComponentRow({
  component,
  isFirst,
  isLast,
  onToggle,
  onMove,
  onEdit,
  onDelete
}: AdminComponentRowProps): React.JSX.Element {
  const { t } = useTranslation()
  const { name } = component
  return (
    <TableRow>
      <TableCell className="w-10">
        <span className="flex text-lg text-on-surface-variant">
          <ComponentIcon
            icon={component.icon}
            iconUrl={component.iconUrl}
            siteUrl={externalUrlOf(component)}
          />
        </span>
      </TableCell>
      <TableCell className="font-medium">{name}</TableCell>
      <TableCell className="whitespace-nowrap">{t(`componentTypes.${component.type}`)}</TableCell>
      <TableCell>
        <span className="block max-w-72 truncate text-on-surface-variant">
          {adapterOf(component).sourceUrl(component)}
        </span>
      </TableCell>
      <TableCell>
        <Switch
          checked={component.enabled}
          onCheckedChange={onToggle}
          aria-label={t('admin.table.enabledFor', { name })}
        />
      </TableCell>
      <TableCell className="whitespace-nowrap">
        <div className="flex items-center justify-end gap-1">
          <Button
            variant="ghost"
            size="icon"
            disabled={isFirst}
            aria-label={t('admin.table.moveUp', { name })}
            onClick={() => onMove(-1)}
          >
            <ArrowUpIcon {...ICON} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            disabled={isLast}
            aria-label={t('admin.table.moveDown', { name })}
            onClick={() => onMove(1)}
          >
            <ArrowDownIcon {...ICON} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label={t('admin.table.edit', { name })}
            onClick={onEdit}
          >
            <PencilIcon {...ICON} />
          </Button>
          <Button
            variant="ghost-destructive"
            size="icon"
            aria-label={t('admin.table.delete', { name })}
            onClick={onDelete}
          >
            <Trash2Icon {...ICON} />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  )
}
