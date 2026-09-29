import { useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { GridLayout, useContainerWidth, type EventCallback, type Layout } from 'react-grid-layout'
import {
  DASHBOARD_COLS,
  DASHBOARD_ROW_HEIGHT,
  type DashboardTile as Tile,
  type FolderItem
} from '@justcampus/shared'
import {
  canEnterFolder,
  dropIntoFolder,
  moveOutOfFolder,
  sameTiles,
  settleLayout,
  stackedLayout,
  tilesToLayout,
  type FolderDropTarget
} from '@/lib/dashboard'
import type { ComponentWidget } from '@/lib/widgets'
import { DashboardTile, TILE_HANDLE_CLASS } from './dashboard-tile'
import type { Point } from './folder-tile'

/** Below this width the grid is one column and cannot be arranged. */
const NARROW_WIDTH = 720
const GAP = 16

interface DashboardGridProps {
  /** Only tiles the client can show (see `knownTiles`). */
  tiles: Tile[]
  /** Every widget of every enabled component, by `widgetRefKey`. */
  widgetsByKey: ReadonlyMap<string, ComponentWidget>
  editing: boolean
  onTilesChange: (tiles: Tile[]) => void
  onUpdateTile: (tile: Tile) => void
  onRemoveTile: (tileId: string) => void
}

function contains(rect: DOMRect, point: Point): boolean {
  return (
    point.x >= rect.left && point.x <= rect.right && point.y >= rect.top && point.y <= rect.bottom
  )
}

function pointerOf(event: Event): Point | null {
  if (event instanceof MouseEvent) return { x: event.clientX, y: event.clientY }
  if (typeof TouchEvent !== 'undefined' && event instanceof TouchEvent) {
    const touch = event.changedTouches[0] ?? event.touches[0]
    return touch ? { x: touch.clientX, y: touch.clientY } : null
  }
  return null
}

export function DashboardGrid({
  tiles,
  widgetsByKey,
  editing,
  onTilesChange,
  onUpdateTile,
  onRemoveTile
}: DashboardGridProps): React.JSX.Element {
  const { t } = useTranslation()
  const { width, containerRef, mounted } = useContainerWidth()
  const [dropFolderId, setDropFolderId] = useState<string | null>(null)
  const dragged = useRef<string | null>(null)
  /*
   * Folders as they stood when a drag began. While a tile is dragged over a
   * folder the grid pushes the folder away, so the drop target is judged by
   * where the folder was, which is where the pointer is aimed.
   */
  const folderRects = useRef<Map<string, DOMRect>>(new Map())
  const narrow = width < NARROW_WIDTH
  const arrangeable = editing && !narrow
  const layout = useMemo(
    () => (narrow ? stackedLayout(tiles) : tilesToLayout(tiles, widgetsByKey)),
    [tiles, narrow, widgetsByKey]
  )

  const cellWidth = (width - GAP * (DASHBOARD_COLS - 1)) / DASHBOARD_COLS

  const commit = (next: Tile[]): void => {
    if (!sameTiles(next, tiles)) onTilesChange(next)
  }

  /** The folder under a point, other than `except`, by its current place on screen. */
  const folderAtPoint = (point: Point | null, except: string | null): string | null => {
    const root = containerRef.current
    if (!point || !root) return null
    for (const element of root.querySelectorAll<HTMLElement>('[data-folder-id]')) {
      const id = element.dataset.folderId
      if (id && id !== except && contains(element.getBoundingClientRect(), point)) return id
    }
    return null
  }
  /** The folder a dragged tile is aimed at, by where the folder stood before the drag. */
  const folderAt = (event: Event): string | null => {
    const point = pointerOf(event)
    if (!point || !dragged.current) return null
    for (const [id, rect] of folderRects.current) if (contains(rect, point)) return id
    return null
  }

  /** The grid cell under a point, or `null` outside the grid. */
  const cellAtPoint = (point: Point): { x: number; y: number } | null => {
    const root = containerRef.current
    if (!root) return null
    const rect = root.getBoundingClientRect()
    if (point.x < rect.left || point.x > rect.right || point.y < rect.top) return null
    return {
      x: Math.min(Math.floor((point.x - rect.left) / (cellWidth + GAP)), DASHBOARD_COLS - 1),
      y: Math.max(Math.floor((point.y - rect.top) / (DASHBOARD_ROW_HEIGHT + GAP)), 0)
    }
  }

  const handleItemDrag = (folderId: string) => (point: Point | null) => {
    const target = point ? folderAtPoint(point, folderId) : null
    if (target !== dropFolderId) setDropFolderId(target)
  }
  const handleItemDrop = (folder: Tile, item: FolderItem, point: Point): void => {
    setDropFolderId(null)
    const other = folderAtPoint(point, folder.id)
    const cell = cellAtPoint(point)
    const target: FolderDropTarget | null = other
      ? { kind: 'folder', folderId: other }
      : cell
        ? { kind: 'cell', ...cell }
        : null
    if (target) commit(moveOutOfFolder(tiles, widgetsByKey, folder.id, item, target))
  }

  const handleDragStart: EventCallback = (_layout, oldItem) => {
    const tile = tiles.find((entry) => entry.id === oldItem?.i)
    // Widgets and shortcuts can go into folders; folders and feeds only move.
    dragged.current = tile && canEnterFolder(tile) ? tile.id : null
    folderRects.current = new Map()
    if (!dragged.current) return
    for (const element of containerRef.current?.querySelectorAll<HTMLElement>('[data-folder-id]') ??
      []) {
      const id = element.dataset.folderId
      if (id) folderRects.current.set(id, element.getBoundingClientRect())
    }
  }
  const handleDrag: EventCallback = (_layout, _oldItem, _newItem, _placeholder, event) => {
    const target = folderAt(event)
    if (target !== dropFolderId) setDropFolderId(target)
  }
  const handleDragStop: EventCallback = (layout, _oldItem, newItem, _placeholder, event) => {
    const tileId = newItem?.i
    const target = folderAt(event)
    dragged.current = null
    folderRects.current = new Map()
    setDropFolderId(null)
    if (!tileId) return
    commit(
      target
        ? dropIntoFolder(tiles, widgetsByKey, tileId, target)
        : settleLayout(tiles, layout, widgetsByKey)
    )
  }
  const handleResizeStop = (next: Layout): void => {
    commit(settleLayout(tiles, next, widgetsByKey))
  }

  // The cells behind the tiles, drawn while arranging so sizes and gaps are visible.
  const gridStyle = arrangeable
    ? ({
        '--grid-cell-w': `${cellWidth}px`,
        '--grid-cell-h': `${DASHBOARD_ROW_HEIGHT}px`,
        '--grid-gap': `${GAP}px`
      } as React.CSSProperties)
    : undefined

  return (
    <div
      ref={containerRef}
      data-grid-visible={arrangeable ? '' : undefined}
      aria-label={arrangeable ? t('dashboard.gridLabel', { cols: DASHBOARD_COLS }) : undefined}
      style={gridStyle}
      className="dashboard-grid"
    >
      {mounted ? (
        <GridLayout
          width={width}
          layout={layout}
          gridConfig={{
            cols: DASHBOARD_COLS,
            rowHeight: DASHBOARD_ROW_HEIGHT,
            margin: [GAP, GAP],
            containerPadding: [0, 0]
          }}
          dragConfig={{
            enabled: arrangeable,
            handle: `.${TILE_HANDLE_CLASS}`,
            cancel: 'button, a'
          }}
          resizeConfig={{ enabled: arrangeable, handles: ['se'] }}
          onDragStart={handleDragStart}
          onDrag={handleDrag}
          onDragStop={handleDragStop}
          onResizeStop={handleResizeStop}
        >
          {tiles.map((tile) => (
            <div key={tile.id}>
              <DashboardTile
                tile={tile}
                widgetsByKey={widgetsByKey}
                editing={editing}
                dropTarget={dropFolderId === tile.id}
                onUpdate={onUpdateTile}
                onRemove={() => onRemoveTile(tile.id)}
                onItemDrag={tile.kind === 'folder' ? handleItemDrag(tile.id) : undefined}
                onItemDrop={handleItemDrop}
              />
            </div>
          ))}
        </GridLayout>
      ) : null}
    </div>
  )
}
