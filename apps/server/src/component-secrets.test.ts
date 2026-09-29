import { describe, expect, it, vi } from 'vitest'

import { applySecretsPatch, componentTypeChangeConflicts } from './component-secrets.js'

describe('applySecretsPatch', () => {
  it('sets, removes, and leaves absent secrets unchanged', () => {
    const encrypt = vi.fn((key: string, value: string) => `encrypted:${key}:${value}`)
    expect(
      applySecretsPatch(
        { unchanged: 'old-a', remove: 'old-b' },
        { set: 'new', remove: null },
        encrypt
      )
    ).toEqual({ unchanged: 'old-a', set: 'encrypted:set:new' })
    expect(encrypt).toHaveBeenCalledOnce()
  })

  it('returns stored secrets when the patch is absent', () => {
    const stored = { apiKey: 'encrypted' }
    expect(applySecretsPatch(stored, undefined, vi.fn())).toBe(stored)
  })
})

describe('componentTypeChangeConflicts', () => {
  it('prevents changing a singleton type', () => {
    expect(
      componentTypeChangeConflicts({ type: 'translator', singleton: true }, 'translator')
    ).toBe(false)
    expect(componentTypeChangeConflicts({ type: 'translator', singleton: true }, 'rss')).toBe(true)
  })

  it('prevents changing an ordinary component into a module', () => {
    expect(componentTypeChangeConflicts({ type: 'rss', singleton: false }, 'link')).toBe(false)
    expect(componentTypeChangeConflicts({ type: 'rss', singleton: false }, 'translator')).toBe(true)
  })
})
