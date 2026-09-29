import { Link } from '@tanstack/react-router'
import { ArrowDownIcon, ArrowUpIcon, PencilIcon, Trash2Icon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Badge, Button, TableCell, TableRow } from '@ki4jlu/design-system'
import type { LayoutPreset } from '@justcampus/shared'

interface AdminPresetRowProps {
  preset: LayoutPreset
  /** Match priority from 1; `null` for the `everyone` fallback, which is always tried last. */
  rank: number | null
  isFirst: boolean
  isLast: boolean
  onMove: (offset: -1 | 1) => void
  onDelete: () => void
}

const ICON = { 'aria-hidden': true, width: '1em', height: '1em' } as const

export function AdminPresetRow({
  preset,
  rank,
  isFirst,
  isLast,
  onMove,
  onDelete
}: AdminPresetRowProps): React.JSX.Element {
  const { t } = useTranslation()
  const { name, audience } = preset
  return (
    <TableRow>
      <TableCell className="w-16 whitespace-nowrap text-on-surface-variant tabular-nums">
        {rank === null ? t('admin.presets.table.last') : `${rank}.`}
      </TableCell>
      <TableCell className="font-medium">{name}</TableCell>
      <TableCell>
        <span className="flex flex-wrap items-center gap-2">
          <Badge tone={audience.kind === 'everyone' ? 'secondary' : 'neutral'} appearance="filled">
            {t(`admin.presets.audience.${audience.kind}`)}
          </Badge>
          {audience.kind === 'everyone' ? null : (
            <code className="text-sm text-on-surface">{audience.name}</code>
          )}
        </span>
      </TableCell>
      <TableCell className="whitespace-nowrap text-on-surface-variant">
        {t('admin.presets.table.contentSummary', {
          components: t('admin.presets.table.componentCount', {
            count: preset.sidebar.componentIds.length
          }),
          tiles: t('admin.presets.table.tileCount', { count: preset.dashboard.tiles.length })
        })}
      </TableCell>
      <TableCell className="whitespace-nowrap">
        <div className="flex items-center justify-end gap-1">
          {rank === null ? null : (
            <>
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
            </>
          )}
          <Button variant="ghost" size="icon" asChild>
            <Link
              to="/admin/presets/$presetId"
              params={{ presetId: preset.id }}
              aria-label={t('admin.table.edit', { name })}
            >
              <PencilIcon {...ICON} />
            </Link>
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
