import { describe, expect, it } from 'vitest'
import { keepHiddenIds } from './sidebar-hidden'

const hidden = new Set(['files'])

describe('keepHiddenIds', () => {
  it('changes nothing when nothing is hidden', () => {
    expect(keepHiddenIds(['b', 'a'], ['a', 'b'], new Set())).toEqual(['b', 'a'])
  })

  it('keeps a hidden entry behind the entry it followed', () => {
    expect(keepHiddenIds(['a', 'b', 'c'], ['a', 'files', 'b'], hidden)).toEqual([
      'a',
      'files',
      'b',
      'c'
    ])
  })

  it('moves a hidden entry along with the entry it followed', () => {
    expect(keepHiddenIds(['b', 'a'], ['a', 'files', 'b'], hidden)).toEqual(['b', 'a', 'files'])
  })

  it('puts a hidden entry first when it led the sidebar or its neighbour left', () => {
    expect(keepHiddenIds(['a', 'b'], ['files', 'a', 'b'], hidden)).toEqual(['files', 'a', 'b'])
    expect(keepHiddenIds(['b'], ['a', 'files', 'b'], hidden)).toEqual(['files', 'b'])
  })

  it('keeps several hidden entries in their order', () => {
    const two = new Set(['x', 'y'])
    expect(keepHiddenIds(['a'], ['a', 'x', 'y'], two)).toEqual(['a', 'x', 'y'])
    expect(keepHiddenIds([], ['x', 'a', 'y'], two)).toEqual(['x', 'y'])
  })

  it('does not add a hidden entry twice', () => {
    expect(keepHiddenIds(['files', 'a'], ['a', 'files'], hidden)).toEqual(['files', 'a'])
  })
})
