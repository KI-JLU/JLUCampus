import { describe, expect, it, vi } from 'vitest'

import {
  createFeedLoader,
  decodeBody,
  FeedUnavailableError,
  isPublicAddress,
  normalizeFeed,
  plainText
} from './feed.js'

const baseUrl = 'https://feeds.example.test/news/feed.xml'
const fetchedAt = new Date('2026-09-28T10:00:00.000Z')

describe('isPublicAddress', () => {
  it.each([
    '0.1.2.3',
    '10.0.0.1',
    '100.64.0.1',
    '127.0.0.1',
    '169.254.1.1',
    '172.16.0.1',
    '192.0.0.1',
    '192.0.2.1',
    '192.168.1.1',
    '198.18.0.1',
    '198.51.100.1',
    '203.0.113.1',
    '224.0.0.1',
    '240.0.0.1',
    '::',
    '::1',
    'fc00::1',
    'fe80::1',
    'ff00::1',
    '2001:db8::1',
    '::ffff:127.0.0.1',
    '64:ff9b::c0a8:101'
  ])('blocks %s', (address) => {
    expect(isPublicAddress(address)).toBe(false)
  })

  it.each([
    '8.8.8.8',
    '93.184.216.34',
    '2606:4700:4700::1111',
    '::ffff:8.8.8.8',
    '64:ff9b::808:808'
  ])('allows %s', (address) => {
    expect(isPublicAddress(address)).toBe(true)
  })
})

describe('normalizeFeed', () => {
  it('normalizes RSS, resolves links, sanitizes text, sorts, and deduplicates', () => {
    const feed = normalizeFeed(
      `<?xml version="1.0"?>
      <rss version="2.0"><channel>
        <title> Campus &amp; News </title><link>/home</link><description>News</description>
        <item><title><![CDATA[Older <b>post</b>]]></title><link>older</link>
          <guid>same</guid><pubDate>Sun, 27 Sep 2026 10:00:00 GMT</pubDate>
          <description><![CDATA[Hello&nbsp; <em>world</em> &amp; all]]></description></item>
        <item><title>Newest</title><link>javascript:alert(1)</link>
          <guid>new</guid><pubDate>Mon, 28 Sep 2026 10:00:00 GMT</pubDate></item>
        <item><title>Duplicate</title><guid>same</guid></item>
      </channel></rss>`,
      baseUrl,
      fetchedAt
    )

    expect(feed).toEqual({
      title: 'Campus & News',
      link: 'https://feeds.example.test/home',
      fetchedAt: fetchedAt.toISOString(),
      items: [
        {
          id: 'new',
          title: 'Newest',
          link: null,
          publishedAt: '2026-09-28T10:00:00.000Z',
          summary: null
        },
        {
          id: 'same',
          title: 'Older post',
          link: 'https://feeds.example.test/news/older',
          publishedAt: '2026-09-27T10:00:00.000Z',
          summary: 'Hello world & all'
        }
      ]
    })
  })

  it('normalizes Atom', () => {
    const feed = normalizeFeed(
      `<feed xmlns="http://www.w3.org/2005/Atom">
        <id>urn:feed</id><title>Atom feed</title><updated>2026-09-28T09:00:00Z</updated>
        <link rel="alternate" href="/atom-home" />
        <entry><id>atom-1</id><title>Atom item</title><updated>2026-09-28T08:00:00Z</updated>
          <link href="entry/1" /><summary type="html">A &amp; B</summary></entry>
      </feed>`,
      baseUrl,
      fetchedAt
    )
    expect(feed.title).toBe('Atom feed')
    expect(feed.link).toBe('https://feeds.example.test/atom-home')
    expect(feed.items[0]).toMatchObject({
      id: 'atom-1',
      link: 'https://feeds.example.test/news/entry/1',
      publishedAt: '2026-09-28T08:00:00.000Z',
      summary: 'A & B'
    })
  })

  it('normalizes RSS 1.0/RDF', () => {
    const feed = normalizeFeed(
      `<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"
          xmlns="http://purl.org/rss/1.0/" xmlns:dc="http://purl.org/dc/elements/1.1/">
        <channel rdf:about="https://example.test/feed"><title>RDF feed</title>
          <link>/rdf-home</link><description>News</description></channel>
        <item rdf:about="tag:example.test,2026:item"><title>RDF item</title>
          <link>rdf-item</link><description>RDF summary</description>
          <dc:date>2026-09-28T07:00:00Z</dc:date></item>
      </rdf:RDF>`,
      baseUrl,
      fetchedAt
    )
    expect(feed.title).toBe('RDF feed')
    expect(feed.items[0]).toMatchObject({
      id: 'tag:example.test,2026:item',
      link: 'https://feeds.example.test/news/rdf-item',
      publishedAt: '2026-09-28T07:00:00.000Z'
    })
  })

  it('normalizes JSON Feed', () => {
    const feed = normalizeFeed(
      JSON.stringify({
        version: 'https://jsonfeed.org/version/1.1',
        title: 'JSON feed',
        home_page_url: '/json-home',
        items: [
          {
            id: 'json-1',
            url: 'json-item',
            content_html: '<p>JSON &amp; summary</p>',
            date_published: '2026-09-28T06:00:00Z'
          }
        ]
      }),
      baseUrl,
      fetchedAt
    )
    expect(feed.link).toBe('https://feeds.example.test/json-home')
    expect(feed.items[0]).toMatchObject({
      id: 'json-1',
      title: 'JSON & summary',
      link: 'https://feeds.example.test/news/json-item',
      summary: 'JSON & summary'
    })
  })

  it('decodes entities, strips markup, and truncates summaries to the contract limit', () => {
    expect(plainText('<p>A&nbsp;&amp; &#x42;</p>')).toBe('A & B')
    const feed = normalizeFeed(
      `<rss version="2.0"><channel><title>T</title><link>https://example.test</link>
        <description>D</description><item><title>I</title><description>${'x'.repeat(501)}</description>
        </item></channel></rss>`,
      baseUrl,
      fetchedAt
    )
    expect(feed.items[0]?.summary).toHaveLength(500)
    expect(feed.items[0]?.summary?.endsWith('…')).toBe(true)
  })
})

describe('createFeedLoader', () => {
  const feed = {
    title: 'Cached',
    link: null,
    items: [],
    fetchedAt: fetchedAt.toISOString()
  }

  it('deduplicates concurrent loads and refreshes after the success TTL', async () => {
    let now = 0
    const fetcher = vi.fn(async () => feed)
    const load = createFeedLoader({
      allowPrivateHosts: false,
      now: () => now,
      fetcher,
      successTtlMs: 100
    })
    const [first, second] = await Promise.all([
      load('https://example.test/feed'),
      load('https://example.test/feed')
    ])
    expect(first).toBe(second)
    expect(fetcher).toHaveBeenCalledTimes(1)
    now = 99
    await load('https://example.test/feed')
    expect(fetcher).toHaveBeenCalledTimes(1)
    now = 100
    await load('https://example.test/feed')
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it('caches sanitized failures for the shorter failure TTL', async () => {
    let now = 0
    const fetcher = vi.fn(async () => {
      throw new FeedUnavailableError('Feed host is not allowed')
    })
    const load = createFeedLoader({
      allowPrivateHosts: false,
      now: () => now,
      fetcher,
      failureTtlMs: 10
    })
    await expect(load('https://example.test/feed')).rejects.toThrow('Feed host is not allowed')
    await expect(load('https://example.test/feed')).rejects.toThrow('Feed host is not allowed')
    expect(fetcher).toHaveBeenCalledTimes(1)
    now = 10
    await expect(load('https://example.test/feed')).rejects.toThrow('Feed host is not allowed')
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it('rejects URL credentials before calling the fetcher', async () => {
    const fetcher = vi.fn(async () => feed)
    const load = createFeedLoader({ allowPrivateHosts: false, fetcher })
    await expect(load('https://user:secret@example.test/feed')).rejects.toThrow(
      'must not contain credentials'
    )
    expect(fetcher).not.toHaveBeenCalled()
  })
})

describe('decodeBody', () => {
  const latin1 = Buffer.from(
    '<?xml version="1.0" encoding="ISO-8859-1"?><rss>Gießen</rss>',
    'latin1'
  )

  it('uses the XML declaration when the header has no charset', () => {
    expect(decodeBody(latin1, 'application/rss+xml')).toContain('Gießen')
  })

  it('prefers the Content-Type charset and falls back to UTF-8', () => {
    expect(decodeBody(Buffer.from('Gießen'), 'text/xml; charset=utf-8')).toBe('Gießen')
    expect(decodeBody(Buffer.from('Gießen'), 'text/xml; charset=bogus')).toBe('Gießen')
  })
})
