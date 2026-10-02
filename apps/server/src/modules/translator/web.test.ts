import { describe, expect, it } from 'vitest'

import { linkedUrls, pageText, readLinkedPages, WEB_PAGE_TEXT_MAX } from './web.js'

describe('translator web search', () => {
  it('finds the links of an instruction as HAWKI does', () => {
    expect(
      linkedUrls('Fasse https://www.uni-giessen.de/de/studium und www.hrz.uni-giessen.de zusammen.')
    ).toEqual(['https://www.uni-giessen.de/de/studium', 'https://www.hrz.uni-giessen.de'])
    expect(linkedUrls('Schreibe etwas über die JLU')).toEqual([])
    expect(linkedUrls('a https://a.example b https://a.example')).toEqual(['https://a.example'])
  })

  it('reads a page without its scripts, styles and markup', () => {
    expect(
      pageText(
        '<html><head><title>T</title><style>p{}</style></head><body><script>x()</script><h1>Studium</h1><p>Mensa &amp; Bibliothek</p></body></html>',
        'text/html; charset=utf-8'
      )
    ).toBe('Studium Mensa & Bibliothek')
    expect(pageText('x'.repeat(WEB_PAGE_TEXT_MAX + 10), 'text/plain')).toHaveLength(
      WEB_PAGE_TEXT_MAX
    )
  })

  it('leaves out pages that cannot be read', async () => {
    const pages = await readLinkedPages(
      'https://ok.example und https://down.example',
      async (url) => {
        if (url.includes('down')) throw new Error('unreachable')
        return { url, body: '<p>Inhalt</p>', contentType: 'text/html' }
      }
    )
    expect(pages).toEqual([{ url: 'https://ok.example', text: 'Inhalt' }])
  })
})
