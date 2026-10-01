import { describe, expect, it } from 'vitest'
import {
  completeSentenceCount,
  sentenceMapping,
  sentenceTokens,
  splitIntoSentences,
  withTrailingWhitespace
} from './sentences'

describe('splitIntoSentences', () => {
  it('keeps punctuation and the whitespace after each sentence', () => {
    const text = 'Guten Morgen. Bitte melden Sie sich an!\nZweite Zeile?'
    const sentences = splitIntoSentences(text)
    expect(sentences).toEqual(['Guten Morgen. ', 'Bitte melden Sie sich an!\n', 'Zweite Zeile?'])
    expect(sentences.join('')).toBe(text)
  })

  it('does not end a sentence at abbreviations, titles or ordinals', () => {
    expect(splitIntoSentences('Das gilt z.B. für Prof. Müller am 3. Oktober. Ende.')).toEqual([
      'Das gilt z.B. für Prof. Müller am 3. Oktober. ',
      'Ende.'
    ])
  })

  it('splits markup after closing block tags', () => {
    expect(splitIntoSentences('<p>Eins. Zwei.</p>\n<p>Drei.</p>')).toEqual([
      '<p>Eins. Zwei.</p>\n',
      '<p>Drei.</p>'
    ])
  })
})

describe('sentenceTokens', () => {
  it('separates words, punctuation and spaces', () => {
    expect(sentenceTokens('Hallo, Welt!')).toEqual(['Hallo', ',', ' ', 'Welt', '!'])
  })
})

describe('sentenceMapping', () => {
  it('links sentences to their originals and marks added ones', () => {
    expect(
      sentenceMapping(
        ['Guten Morgen. ', 'Ganz neu hier. ', 'Bitte anmelden.'],
        ['Guten Morgen. ', 'Bitte anmelden.']
      )
    ).toEqual([0, -1, 1])
  })
})

describe('completeSentenceCount', () => {
  it('counts sentences that end with their punctuation', () => {
    expect(completeSentenceCount('Eins. Zwei! Drei')).toBe(2)
    expect(completeSentenceCount('Er sagte: "Ja."')).toBe(1)
  })
})

describe('withTrailingWhitespace', () => {
  it('gives a result the whitespace its source ended with', () => {
    expect(withTrailingWhitespace('Hello.', 'Hallo.\n')).toBe('Hello.\n')
    expect(withTrailingWhitespace('Hello. ', 'Hallo. ')).toBe('Hello. ')
  })
})
