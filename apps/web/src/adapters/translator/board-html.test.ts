import { describe, expect, it } from 'vitest'

import { sourceBoardHtml } from './board-html'

describe('source board', () => {
  it('leaves out a lone "<" as HAWKI does, and keeps a tag-like span', () => {
    expect(
      sourceBoardHtml('Die Zahl 3 < 5 ist kleiner.', ['Die Zahl 3 < 5 ist kleiner.'], null, null)
    ).toContain('>Die Zahl 3  5 ist kleiner.</span>')
    expect(sourceBoardHtml('3 < 5 und 7 > 4.', ['3 < 5 und 7 > 4.'], null, null)).toContain(
      '3 &lt; 5 und 7 &gt; 4.'
    )
  })
})
