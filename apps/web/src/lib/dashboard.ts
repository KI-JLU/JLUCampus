import { moveElement, verticalCompactor, type Layout, type LayoutItem } from 'react-grid-layout'
import {
  DASHBOARD_COLS,
  TILE_DEFAULT_H,
  TILE_DEFAULT_W,
  TILE_MAX_H,
  TILE_MIN_H,
  TILE_MIN_W,
  widgetRefKey,
  type Component,
  type DashboardTile,
  type FeedTile,
  type FolderItem,
  type FolderLinkItem,
  type FolderTemplate,
  type FolderTile,
  type LinkTile,
  type Widget,
  type WidgetRef
} from '@justcampus/shared'
/** What the grid needs to know about a widget to size its tiles. */
type WidgetSize = Pick<Widget, 'minW' | 'minH'> & { component: Pick<Component, 'type'> }
/** Widgets by `widgetRefKey`; the dashboard page passes its `widgetsByKey`. */
type WidgetSizes = ReadonlyMap<string, WidgetSize>
type Minimum = Pick<Widget, 'minW' | 'minH'>
type Size = { w: number; h: number }

const DEFAULT_MINIMUM: Minimum = { minW: TILE_MIN_W, minH: TILE_MIN_H }
/** A feed narrower or shorter than this shows hardly one entry. */
const FEED_MINIMUM: Minimum = { minW: 3, minH: 3 }

/** A shortcut is one icon and a title; the smallest tile fits it. */
export const SHORTCUT_SIZE: Size = { w: TILE_MIN_W, h: TILE_MIN_H }
const DEFAULT_SIZE: Size = { w: TILE_DEFAULT_W, h: TILE_DEFAULT_H }

function minimumOf(widgets: WidgetSizes, tile: DashboardTile): Minimum {
  switch (tile.kind) {
    case 'widget':
      return widgets.get(widgetRefKey(tile)) ?? DEFAULT_MINIMUM
    case 'feed':
      return FEED_MINIMUM
    default:
      return DEFAULT_MINIMUM
  }
}

/** A new tile's size: shortcut widgets start small, others at the default, never below minimum. */
function widgetTileSize(widget: WidgetSize): Size {
  const base = widget.component.type === 'link' ? SHORTCUT_SIZE : DEFAULT_SIZE
  return { w: Math.max(base.w, widget.minW), h: Math.max(base.h, widget.minH) }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(Math.round(value), min), max)
}

/** A tile no smaller than its widget allows and inside the grid. */
function fit(tile: DashboardTile, minimum: Minimum): DashboardTile {
  const w = clamp(tile.w, minimum.minW, DASHBOARD_COLS)
  const h = clamp(tile.h, minimum.minH, TILE_MAX_H)
  const x = clamp(tile.x, 0, DASHBOARD_COLS - w)
  return tile.w === w && tile.h === h && tile.x === x ? tile : { ...tile, w, h, x }
}

/** Tiles as saved, grown where a widget's minimum has since been raised. */
export function fitTiles(tiles: DashboardTile[], widgets: WidgetSizes): DashboardTile[] {
  return tiles.map((tile) => fit(tile, minimumOf(widgets, tile)))
}

export function tilesToLayout(tiles: DashboardTile[], widgets: WidgetSizes): LayoutItem[] {
  return tiles.map((tile) => ({
    i: tile.id,
    x: tile.x,
    y: tile.y,
    w: tile.w,
    h: tile.h,
    maxW: DASHBOARD_COLS,
    maxH: TILE_MAX_H,
    ...minimumOf(widgets, tile)
  }))
}

/** Narrow screens: one column, tiles in reading order, heights kept. */
export function stackedLayout(tiles: DashboardTile[]): LayoutItem[] {
  let y = 0
  return [...tiles]
    .sort((a, b) => a.y - b.y || a.x - b.x)
    .map((tile) => {
      const item = { i: tile.id, x: 0, y, w: DASHBOARD_COLS, h: tile.h }
      y += tile.h
      return item
    })
}

/** Takes the grid's positions for the given tiles, clamped to what the API accepts. */
export function applyLayout(
  tiles: DashboardTile[],
  layout: Layout,
  widgets: WidgetSizes
): DashboardTile[] {
  const byId = new Map(layout.map((item) => [item.i, item]))
  return tiles.map((tile) => {
    const item = byId.get(tile.id)
    if (!item) return tile
    return fit(
      { ...tile, x: item.x, y: clamp(item.y, 0, Number.MAX_SAFE_INTEGER), w: item.w, h: item.h },
      minimumOf(widgets, tile)
    )
  })
}

export function sameTiles(a: DashboardTile[], b: DashboardTile[]): boolean {
  return a.length === b.length && a.every((tile, index) => tileKey(tile) === tileKey(b[index]))
}

/** Identifies a folder entry: a widget by its reference, a shortcut by its id. */
export function folderItemKey(item: FolderItem): string {
  return item.kind === 'widget' ? `widget:${widgetRefKey(item)}` : `link:${item.id}`
}

function linkKey(link: Pick<LinkTile, 'title' | 'url' | 'icon'>): string {
  return JSON.stringify([link.title, link.url, link.icon])
}

function tileKey(tile: DashboardTile | undefined): string {
  if (!tile) return ''
  const geometry = `${tile.id}:${tile.x},${tile.y},${tile.w},${tile.h}`
  switch (tile.kind) {
    case 'widget':
      return `${geometry}:widget:${widgetRefKey(tile)}`
    case 'link':
      return `${geometry}:link:${linkKey(tile)}`
    case 'feed':
      return `${geometry}:feed:${JSON.stringify([tile.title, tile.feedUrl])}`
    case 'folder': {
      const items = tile.items.map((item) =>
        item.kind === 'widget' ? folderItemKey(item) : `${folderItemKey(item)}:${linkKey(item)}`
      )
      return `${geometry}:folder:${JSON.stringify([tile.title, tile.icon ?? null, ...items])}`
    }
  }
}

function bottomOf(tiles: DashboardTile[]): number {
  return tiles.reduce((max, tile) => Math.max(max, tile.y + tile.h), 0)
}

type Geometry = Pick<DashboardTile, 'id' | 'x' | 'y' | 'w' | 'h'>

/** A new tile with a fresh id in the first column below everything else. */
function append(
  tiles: DashboardTile[],
  size: Size,
  make: (geometry: Geometry) => DashboardTile
): DashboardTile[] {
  return [...tiles, make({ id: crypto.randomUUID(), x: 0, y: bottomOf(tiles), ...size })]
}

/** A tile of a catalogue widget, default-sized or the widget's minimum. */
export function appendTile(
  tiles: DashboardTile[],
  widget: WidgetRef & WidgetSize
): DashboardTile[] {
  return append(tiles, widgetTileSize(widget), (geometry) => ({
    kind: 'widget',
    componentId: widget.componentId,
    widgetKey: widget.widgetKey,
    ...geometry
  }))
}

export type FolderFields = Pick<FolderTile, 'title' | 'icon' | 'items'>

/** A new folder, empty or filled from a template, default-sized. */
export function appendFolder(tiles: DashboardTile[], folder: FolderFields): DashboardTile[] {
  return append(tiles, DEFAULT_SIZE, (geometry) => ({ kind: 'folder', ...folder, ...geometry }))
}

/**
 * The user's own copy of an admin's folder template: its name, icon and the
 * widgets the client knows, in the template's order. Later template changes
 * do not reach the copy.
 */
export function folderFromTemplate(
  template: Pick<FolderTemplate, 'name' | 'icon' | 'widgets'>,
  widgetsByKey: ReadonlyMap<string, unknown>
): FolderFields {
  return {
    title: template.name,
    icon: template.icon,
    items: template.widgets
      .filter((ref) => widgetsByKey.has(widgetRefKey(ref)))
      .map(({ componentId, widgetKey }) => ({ kind: 'widget', componentId, widgetKey }))
  }
}

export type ShortcutFields = Pick<LinkTile, 'title' | 'url' | 'icon'>

/** The user's own shortcut, in the smallest tile. */
export function appendLinkTile(tiles: DashboardTile[], link: ShortcutFields): DashboardTile[] {
  return append(tiles, SHORTCUT_SIZE, (geometry) => ({ kind: 'link', ...link, ...geometry }))
}

export type FeedFields = Pick<FeedTile, 'title' | 'feedUrl'>

/** The user's own feed, default-sized. */
export function appendFeedTile(tiles: DashboardTile[], feed: FeedFields): DashboardTile[] {
  return append(tiles, DEFAULT_SIZE, (geometry) => ({ kind: 'feed', ...feed, ...geometry }))
}

/**
 * Tiles the client can show: widget tiles need their widget, folders keep
 * only known widgets (and all their shortcuts); shortcut and feed tiles
 * depend on nothing in the catalogue.
 */
export function knownTiles(
  tiles: DashboardTile[],
  widgetsByKey: ReadonlyMap<string, unknown>
): DashboardTile[] {
  return tiles.flatMap((tile): DashboardTile[] => {
    if (tile.kind === 'widget') return widgetsByKey.has(widgetRefKey(tile)) ? [tile] : []
    if (tile.kind !== 'folder') return [tile]
    const items = tile.items.filter(
      (item) => item.kind === 'link' || widgetsByKey.has(widgetRefKey(item))
    )
    return [items.length === tile.items.length ? tile : { ...tile, items }]
  })
}

/** The layout with every overlap resolved and gaps closed, applied to the tiles. */
export function settleLayout(
  tiles: DashboardTile[],
  layout: Layout,
  widgets: WidgetSizes
): DashboardTile[] {
  return applyLayout(tiles, verticalCompactor.compact(layout, DASHBOARD_COLS), widgets)
}

/**
 * A tile dropped at a grid position: colliding tiles are pushed away exactly as
 * react-grid-layout would have done during the drag, then the layout settles.
 */
export function moveTile(
  tiles: DashboardTile[],
  widgets: WidgetSizes,
  tileId: string,
  x: number,
  y: number
): DashboardTile[] {
  const layout = tilesToLayout(tiles, widgets)
  const item = layout.find((entry) => entry.i === tileId)
  if (!item) return tiles
  const moved = moveElement(layout, item, x, y, true, false, 'vertical', DASHBOARD_COLS, false)
  return settleLayout(tiles, moved, widgets)
}

/** A folder with `item` appended, unless it already holds that widget or shortcut. */
function withItem(folder: FolderTile, item: FolderItem): FolderTile {
  const key = folderItemKey(item)
  if (folder.items.some((entry) => folderItemKey(entry) === key)) return folder
  return { ...folder, items: [...folder.items, item] }
}

/** The folder entry a tile becomes when dropped into a folder; other tiles cannot go in. */
function toFolderItem(tile: DashboardTile): FolderItem | null {
  if (tile.kind === 'widget') {
    const { componentId, widgetKey } = tile
    return { kind: 'widget', componentId, widgetKey }
  }
  if (tile.kind === 'link') {
    const { id, title, url, icon } = tile
    return { kind: 'link', id, title, url, icon }
  }
  return null
}

/** Whether a tile can be dropped into a folder: widget and shortcut tiles can. */
export function canEnterFolder(tile: DashboardTile): boolean {
  return toFolderItem(tile) !== null
}

/** A widget or shortcut tile dropped onto a folder: the tile goes, its content joins the folder. */
export function dropIntoFolder(
  tiles: DashboardTile[],
  widgets: WidgetSizes,
  tileId: string,
  folderId: string
): DashboardTile[] {
  const tile = tiles.find((entry) => entry.id === tileId)
  const item = tile ? toFolderItem(tile) : null
  const folder = tiles.find((entry) => entry.id === folderId)
  if (!item || folder?.kind !== 'folder') return tiles
  const rest = tiles.flatMap((entry): DashboardTile[] => {
    if (entry.id === tileId) return []
    return [entry.kind === 'folder' && entry.id === folderId ? withItem(entry, item) : entry]
  })
  return settleLayout(rest, tilesToLayout(rest, widgets), widgets)
}

/** Where an entry dragged out of a folder is dropped. */
export type FolderDropTarget =
  { kind: 'folder'; folderId: string } | { kind: 'cell'; x: number; y: number }

/** The tile a folder entry becomes on the grid, with a fresh id, not yet placed. */
function toTile(item: FolderItem, widgets: WidgetSizes): DashboardTile {
  const place = { id: crypto.randomUUID(), x: 0, y: 0 }
  if (item.kind === 'link') {
    const { title, url, icon } = item satisfies FolderLinkItem
    return { kind: 'link', ...place, title, url, icon, ...SHORTCUT_SIZE }
  }
  const { componentId, widgetKey } = item
  const widget = widgets.get(widgetRefKey(item))
  const size = widget ? widgetTileSize(widget) : DEFAULT_SIZE
  return { kind: 'widget', ...place, componentId, widgetKey, ...size }
}

/**
 * An entry dragged out of a folder: onto another folder it changes folders,
 * onto the grid it becomes a tile at that cell, pushing others away.
 */
export function moveOutOfFolder(
  tiles: DashboardTile[],
  widgets: WidgetSizes,
  folderId: string,
  item: FolderItem,
  target: FolderDropTarget
): DashboardTile[] {
  if (target.kind === 'folder' && target.folderId === folderId) return tiles
  const key = folderItemKey(item)
  const without = tiles.map((tile) =>
    tile.kind === 'folder' && tile.id === folderId
      ? { ...tile, items: tile.items.filter((entry) => folderItemKey(entry) !== key) }
      : tile
  )
  if (target.kind === 'folder') {
    const next = without.map((tile) =>
      tile.kind === 'folder' && tile.id === target.folderId ? withItem(tile, item) : tile
    )
    return settleLayout(next, tilesToLayout(next, widgets), widgets)
  }
  const tile = toTile(item, widgets)
  const x = clamp(target.x, 0, DASHBOARD_COLS - tile.w)
  const y = clamp(target.y, 0, Number.MAX_SAFE_INTEGER)
  // Placed at the very bottom first so that moving it to the cell pushes the others, not itself.
  const staged = [...without, { ...tile, y: bottomOf(without) }]
  return moveTile(staged, widgets, tile.id, x, y)
}
