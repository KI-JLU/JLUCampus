import { describe, expect, it } from 'vitest'
import { diffWords, type DiffPart } from './diff'

/** Joins the parts one side of the diff consists of. */
function side(parts: DiffPart[], type: 'insert' | 'delete'): string {
  return parts
    .filter((part) => part.type === 'equal' || part.type === type)
    .map((part) => part.text)
    .join('')
}

describe('diffWords', () => {
  it('keeps identical texts as one equal part', () => {
    expect(diffWords('Guten Tag', 'Guten Tag')).toEqual([{ type: 'equal', text: 'Guten Tag' }])
  })

  it('marks a replaced word as deleted, then inserted', () => {
    expect(diffWords('Ich habe gestern gearbeitet.', 'Ich habe heute gearbeitet.')).toEqual([
      { type: 'equal', text: 'Ich habe ' },
      { type: 'delete', text: 'gestern' },
      { type: 'insert', text: 'heute' },
      { type: 'equal', text: ' gearbeitet.' }
    ])
  })

  it('merges removed words with their spaces', () => {
    expect(diffWords('ein sehr sehr langer Satz', 'ein langer Satz')).toEqual([
      { type: 'equal', text: 'ein ' },
      { type: 'delete', text: 'sehr sehr ' },
      { type: 'equal', text: 'langer Satz' }
    ])
  })

  it('handles empty texts', () => {
    expect(diffWords('', '')).toEqual([])
    expect(diffWords('', 'neu')).toEqual([{ type: 'insert', text: 'neu' }])
    expect(diffWords('alt', '')).toEqual([{ type: 'delete', text: 'alt' }])
  })

  it('marks an added punctuation mark alone, not its word', () => {
    expect(diffWords('Hallo Welt', 'Hallo, Welt')).toEqual([
      { type: 'equal', text: 'Hallo' },
      { type: 'insert', text: ',' },
      { type: 'equal', text: ' Welt' }
    ])
    expect(diffWords('geben das', 'geben, dass')).toEqual([
      { type: 'equal', text: 'geben' },
      { type: 'insert', text: ',' },
      { type: 'equal', text: ' ' },
      { type: 'delete', text: 'das' },
      { type: 'insert', text: 'dass' }
    ])
  })

  it('rebuilds both texts, line breaks included', () => {
    const before = 'Erste Zeile\nzweite  Zeile mit Fehlern\n\nEnde'
    const after = 'Erste Zeile\nZweite Zeile ohne Fehler\nEnde.'
    const parts = diffWords(before, after)
    expect(side(parts, 'delete')).toBe(before)
    expect(side(parts, 'insert')).toBe(after)
  })

  it('marks the whole middle as replaced when a word diff would be too costly', () => {
    const before = Array.from({ length: 1100 }, (_, index) => `a${index}`).join(' ')
    const after = Array.from({ length: 1100 }, (_, index) => `b${index}`).join(' ')
    expect(diffWords(`Start ${before} Ende`, `Start ${after} Ende`)).toEqual([
      { type: 'equal', text: 'Start ' },
      { type: 'delete', text: before },
      { type: 'insert', text: after },
      { type: 'equal', text: ' Ende' }
    ])
  })
})
