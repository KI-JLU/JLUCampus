import { describe, expect, it } from 'vitest'
import { changePieces, diffWords, insertedCharacters, type DiffPart } from './diff'

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

  it('marks a replaced word with its space as deleted, then inserted', () => {
    expect(diffWords('Ich habe gestern gearbeitet.', 'Ich habe heute gearbeitet.')).toEqual([
      { type: 'equal', text: 'Ich habe ' },
      { type: 'delete', text: 'gestern ' },
      { type: 'insert', text: 'heute ' },
      { type: 'equal', text: 'gearbeitet.' }
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
      { type: 'insert', text: ', ' },
      { type: 'equal', text: 'Welt' }
    ])
  })

  it('rebuilds the new text, line breaks included', () => {
    const after = 'Erste Zeile\nZweite Zeile ohne Fehler\nEnde.'
    expect(side(diffWords('Erste Zeile\nzweite Zeile mit Fehlern\n\nEnde', after), 'insert')).toBe(
      after
    )
  })

  it('marks the whole middle as replaced when a word diff would be too costly', () => {
    const before = Array.from({ length: 1100 }, (_, index) => `a${index}`).join(' ')
    const after = Array.from({ length: 1100 }, (_, index) => `b${index}`).join(' ')
    const parts = diffWords(`Start ${before} Ende`, `Start ${after} Ende`)
    expect(parts.map((part) => part.type)).toEqual(['equal', 'delete', 'insert', 'equal'])
  })
})

describe('changePieces', () => {
  it('pairs each deletion with its replacement', () => {
    expect(changePieces(diffWords('das ergebniss ist gut', 'das Ergebnis ist gut'))).toEqual([
      { type: 'equal', text: 'das ' },
      { type: 'delete', text: 'ergebniss', trailing: ' ' },
      { type: 'arrow' },
      { type: 'insert', text: 'Ergebnis', trailing: ' ' },
      { type: 'equal', text: 'ist gut' }
    ])
  })
})

describe('insertedCharacters', () => {
  it('marks the characters of new words', () => {
    const mask = insertedCharacters('ein Satz', 'ein neuer Satz')
    expect(mask.map((inserted) => (inserted ? 'x' : '.')).join('')).toBe('....xxxxxx....')
  })
})
