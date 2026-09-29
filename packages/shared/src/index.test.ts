import { describe, expect, it } from 'vitest'
import {
  dashboardPutSchema,
  externalUrlSchema,
  feedSchema,
  folderTemplateInputSchema,
  folderTileSchema,
  componentInputSchema,
  httpsUrlSchema,
  widgetDefinition
} from './index'

describe('httpsUrlSchema', () => {
  it('accepts https and loopback http', () => {
    expect(httpsUrlSchema.safeParse('https://studip.uni-giessen.de').success).toBe(true)
    expect(httpsUrlSchema.safeParse('http://localhost:8000/x').success).toBe(true)
  })

  it('rejects plain http and garbage without throwing', () => {
    expect(httpsUrlSchema.safeParse('http://example.org').success).toBe(false)
    expect(httpsUrlSchema.safeParse('foo').success).toBe(false)
    expect(httpsUrlSchema.safeParse('').success).toBe(false)
  })
})

describe('componentInputSchema', () => {
  it('reports the url path for a bad iframe url', () => {
    const result = componentInputSchema.safeParse({
      type: 'iframe',
      name: 'X',
      icon: null,
      iconUrl: null,
      enabled: true,
      config: { url: 'nope' }
    })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error.issues[0]?.path).toEqual(['config', 'url'])
  })
})

describe('dashboardPutSchema', () => {
  it('rejects tiles past the right edge and duplicate ids', () => {
    const tile = {
      id: '11111111-1111-4111-8111-111111111111',
      kind: 'widget',
      componentId: '22222222-2222-4222-8222-222222222222',
      widgetKey: 'launcher'
    }
    expect(
      dashboardPutSchema.safeParse({ tiles: [{ ...tile, x: 8, y: 0, w: 6, h: 2 }] }).success
    ).toBe(false)
    expect(
      dashboardPutSchema.safeParse({
        tiles: [
          { ...tile, x: 0, y: 0, w: 2, h: 2 },
          { ...tile, x: 2, y: 0, w: 2, h: 2 }
        ]
      }).success
    ).toBe(false)
  })
})

describe('widgetDefinition', () => {
  it('knows the widgets of each component type', () => {
    expect(widgetDefinition('iframe', 'launcher')).toEqual({ minW: 2, minH: 2 })
    expect(widgetDefinition('rss', 'feed')).toBeDefined()
  })

  it('rejects keys of other types and inherited properties', () => {
    expect(widgetDefinition('iframe', 'feed')).toBeUndefined()
    expect(widgetDefinition('link', 'toString')).toBeUndefined()
  })
})

describe('folder tiles', () => {
  const folder = {
    kind: 'folder' as const,
    id: '11111111-1111-4111-8111-111111111111',
    title: 'Studium',
    x: 0,
    y: 0,
    w: 2,
    h: 2
  }
  const componentId = '22222222-2222-4222-8222-222222222222'

  const widgetItem = { kind: 'widget' as const, componentId, widgetKey: 'launcher' }
  const linkItem = {
    kind: 'link' as const,
    id: '33333333-3333-4333-8333-333333333333',
    title: 'Mensa',
    url: 'http://mensa.example.org',
    icon: null
  }

  it('accepts a folder with unique widgets and rejects duplicates', () => {
    expect(
      dashboardPutSchema.safeParse({ tiles: [{ ...folder, items: [widgetItem] }] }).success
    ).toBe(true)
    expect(
      dashboardPutSchema.safeParse({ tiles: [{ ...folder, items: [widgetItem, widgetItem] }] })
        .success
    ).toBe(false)
    expect(
      dashboardPutSchema.safeParse({ tiles: [{ ...folder, title: '', items: [] }] }).success
    ).toBe(false)
  })

  it('accepts folders with no icon and valid Lucide icons', () => {
    expect(folderTileSchema.safeParse({ ...folder, items: [] }).success).toBe(true)
    expect(
      folderTileSchema.safeParse({ ...folder, icon: 'graduation-cap', items: [] }).success
    ).toBe(true)
  })

  it('holds shortcuts next to widgets, each shortcut once', () => {
    expect(
      dashboardPutSchema.safeParse({ tiles: [{ ...folder, items: [widgetItem, linkItem] }] })
        .success
    ).toBe(true)
    expect(
      dashboardPutSchema.safeParse({ tiles: [{ ...folder, items: [linkItem, linkItem] }] }).success
    ).toBe(false)
  })
})

describe('folderTemplateInputSchema', () => {
  it('rejects duplicate widgets and an empty name', () => {
    const ref = { componentId: '22222222-2222-4222-8222-222222222222', widgetKey: 'launcher' }
    const base = { name: 'Studium', icon: null, enabled: true, widgets: [ref] }
    expect(folderTemplateInputSchema.safeParse(base).success).toBe(true)
    expect(folderTemplateInputSchema.safeParse({ ...base, widgets: [ref, ref] }).success).toBe(
      false
    )
    expect(folderTemplateInputSchema.safeParse({ ...base, name: '   ' }).success).toBe(false)
  })
})

describe('personal tiles', () => {
  const geometry = { id: '11111111-1111-4111-8111-111111111111', x: 0, y: 0, w: 2, h: 2 }

  it('accepts a shortcut to any http(s) URL and nothing else', () => {
    const link = { ...geometry, kind: 'link', title: 'Mensa', icon: null }
    expect(
      dashboardPutSchema.safeParse({ tiles: [{ ...link, url: 'http://mensa.example.org' }] })
        .success
    ).toBe(true)
    expect(
      dashboardPutSchema.safeParse({ tiles: [{ ...link, url: 'javascript:alert(1)' }] }).success
    ).toBe(false)
  })

  it('accepts a feed tile with or without its own title', () => {
    const feed = { ...geometry, kind: 'feed', feedUrl: 'https://www.uni-giessen.de/rss' }
    expect(dashboardPutSchema.safeParse({ tiles: [{ ...feed, title: null }] }).success).toBe(true)
    expect(dashboardPutSchema.safeParse({ tiles: [{ ...feed, title: 'News' }] }).success).toBe(true)
    expect(dashboardPutSchema.safeParse({ tiles: [{ ...feed, title: '' }] }).success).toBe(false)
  })
})

describe('externalUrlSchema', () => {
  it('allows http and https only', () => {
    expect(externalUrlSchema.safeParse('http://example.org').success).toBe(true)
    expect(externalUrlSchema.safeParse('https://example.org/feed.xml').success).toBe(true)
    expect(externalUrlSchema.safeParse('ftp://example.org').success).toBe(false)
    expect(externalUrlSchema.safeParse('data:text/html,x').success).toBe(false)
  })
})

describe('rss and link components', () => {
  const base = { name: 'X', icon: null, iconUrl: null, enabled: true }

  it('validates the feed and link URLs', () => {
    expect(
      componentInputSchema.safeParse({
        ...base,
        type: 'rss',
        config: { feedUrl: 'http://a.de/rss' }
      }).success
    ).toBe(true)
    const bad = componentInputSchema.safeParse({ ...base, type: 'link', config: { url: 'nope' } })
    expect(bad.success).toBe(false)
    if (!bad.success) expect(bad.error.issues[0]?.path).toEqual(['config', 'url'])
  })
})

describe('feedSchema', () => {
  it('rejects unsafe entry links', () => {
    const feed = {
      title: 'News',
      link: null,
      fetchedAt: '2026-09-28T12:00:00.000Z',
      items: [{ id: '1', title: 'A', link: 'javascript:x', publishedAt: null, summary: null }]
    }
    expect(feedSchema.safeParse(feed).success).toBe(false)
  })
})
