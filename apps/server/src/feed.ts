import { FEED_MAX_ITEMS, FEED_SUMMARY_MAX, feedSchema, type Feed } from '@justcampus/shared'
import { parseFeed, type AnyFeed } from 'feedsmith'
import { createHash } from 'node:crypto'
import type { LookupAddress } from 'node:dns'
import { lookup as dnsLookup } from 'node:dns/promises'
import { request as httpRequest, type IncomingMessage } from 'node:http'
import { request as httpsRequest } from 'node:https'
import { BlockList, isIP, type LookupFunction } from 'node:net'
import type { Transform } from 'node:stream'
import { createBrotliDecompress, createGunzip, createInflate } from 'node:zlib'

const BODY_LIMIT = 2 * 1024 * 1024
const REQUEST_TIMEOUT_MS = 5_000
const MAX_REDIRECTS = 3
const SUCCESS_TTL_MS = 10 * 60_000
const FAILURE_TTL_MS = 60_000
const MAX_CACHE_ENTRIES = 500

const blockedIpv4 = new BlockList()
for (const [network, prefix] of [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4]
] as const) {
  blockedIpv4.addSubnet(network, prefix, 'ipv4')
}

const namedEntities: Readonly<Record<string, string>> = {
  amp: '&',
  apos: "'",
  bull: '•',
  cent: '¢',
  copy: '©',
  euro: '€',
  gt: '>',
  hellip: '…',
  laquo: '«',
  ldquo: '“',
  lsquo: '‘',
  lt: '<',
  mdash: '—',
  middot: '·',
  ndash: '–',
  nbsp: ' ',
  pound: '£',
  quot: '"',
  raquo: '»',
  rdquo: '”',
  reg: '®',
  rsquo: '’',
  trade: '™',
  yen: '¥'
}

export class FeedUnavailableError extends Error {}

function ipv6Words(address: string): number[] | null {
  const dottedIndex = address.lastIndexOf(':')
  let source = address.toLowerCase()
  if (source.includes('.')) {
    const embedded = source
      .slice(dottedIndex + 1)
      .split('.')
      .map(Number)
    if (
      embedded.length !== 4 ||
      embedded.some((part) => !Number.isInteger(part) || part < 0 || part > 255)
    ) {
      return null
    }
    source = `${source.slice(0, dottedIndex)}:${((embedded[0]! << 8) | embedded[1]!).toString(16)}:${((embedded[2]! << 8) | embedded[3]!).toString(16)}`
  }
  const halves = source.split('::')
  if (halves.length > 2) return null
  const left = halves[0] ? halves[0].split(':').map((part) => Number.parseInt(part, 16)) : []
  const right = halves[1] ? halves[1].split(':').map((part) => Number.parseInt(part, 16)) : []
  const zeros = halves.length === 2 ? 8 - left.length - right.length : 0
  const words = [...left, ...Array.from({ length: zeros }, () => 0), ...right]
  return words.length === 8 && words.every((word) => Number.isInteger(word) && word <= 0xffff)
    ? words
    : null
}

function embeddedIpv4(address: string): string | null {
  const words = ipv6Words(address)
  if (!words) return null
  const mapped = words.slice(0, 5).every((word) => word === 0) && words[5] === 0xffff
  const nat64 =
    words[0] === 0x64 &&
    words[1] === 0xff9b &&
    words[2] === 0 &&
    words[3] === 0 &&
    words[4] === 0 &&
    words[5] === 0
  if (!mapped && !nat64) return null
  return [words[6]! >> 8, words[6]! & 0xff, words[7]! >> 8, words[7]! & 0xff].join('.')
}

/** True only for an IPv4 or IPv6 public-unicast address. */
export function isPublicAddress(address: string): boolean {
  const family = isIP(address)
  if (family === 4) return !blockedIpv4.check(address, 'ipv4')
  if (family !== 6) return false

  const embedded = embeddedIpv4(address)
  if (embedded) return isPublicAddress(embedded)
  const words = ipv6Words(address)
  if (!words) return false
  const globalUnicast = (words[0]! & 0xe000) === 0x2000
  const documentation = words[0] === 0x2001 && words[1] === 0x0db8
  return globalUnicast && !documentation
}

function decodeEntities(value: string): string {
  return value.replace(/&(#(?:x[\da-f]+|\d+)|[a-z]+);/gi, (entity, key: string) => {
    if (key.startsWith('#')) {
      const hex = key[1]?.toLowerCase() === 'x'
      const codePoint = Number.parseInt(key.slice(hex ? 2 : 1), hex ? 16 : 10)
      try {
        return Number.isNaN(codePoint) ? entity : String.fromCodePoint(codePoint)
      } catch {
        return entity
      }
    }
    return namedEntities[key.toLowerCase()] ?? entity
  })
}

export function plainText(value: string | undefined): string {
  if (!value) return ''
  return decodeEntities(value.replace(/<[^>]*>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim()
}

function summary(value: string | undefined): string | null {
  const text = plainText(value)
  if (!text) return null
  return text.length <= FEED_SUMMARY_MAX ? text : `${text.slice(0, FEED_SUMMARY_MAX - 1)}…`
}

function absoluteWebUrl(value: string | undefined, baseUrl: string): string | null {
  if (!value) return null
  try {
    const url = new URL(value, baseUrl)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null
  } catch {
    return null
  }
}

function isoDate(value: unknown): string | null {
  if (typeof value !== 'string' && !(value instanceof Date)) return null
  const date = new Date(value)
  return Number.isNaN(date.valueOf()) ? null : date.toISOString()
}

interface CandidateItem {
  id?: string
  title?: string
  link?: string
  date?: unknown
  body?: string
}

interface CandidateFeed {
  title?: string
  link?: string
  items: CandidateItem[]
}

function candidates(parsed: AnyFeed): CandidateFeed {
  switch (parsed.format) {
    case 'rss':
      return {
        title: parsed.feed.title,
        link: parsed.feed.link,
        items: (parsed.feed.items ?? []).map((item) => ({
          id: item.guid?.value,
          title: item.title,
          link: item.link,
          date:
            item.pubDate ??
            item.dc?.dates?.[0] ??
            item.dcterms?.created?.[0] ??
            item.dcterms?.issued?.[0],
          body: item.content?.encoded ?? item.description
        }))
      }
    case 'atom':
      return {
        title: parsed.feed.title?.value,
        link: parsed.feed.links?.find((link) => !link.rel || link.rel === 'alternate')?.href,
        items: (parsed.feed.entries ?? []).map((item) => ({
          id: item.id,
          title: item.title?.value,
          link: item.links?.find((link) => !link.rel || link.rel === 'alternate')?.href,
          date: item.published ?? item.updated,
          body: item.summary?.value ?? item.content?.value
        }))
      }
    case 'rdf':
      return {
        title: parsed.feed.title,
        link: parsed.feed.link,
        items: (parsed.feed.items ?? []).map((item) => ({
          id: item.rdf?.about,
          title: item.title,
          link: item.link,
          date: item.dc?.dates?.[0] ?? item.dcterms?.created?.[0] ?? item.dcterms?.issued?.[0],
          body: item.content?.encoded ?? item.description
        }))
      }
    case 'json':
      return {
        title: parsed.feed.title,
        link: parsed.feed.home_page_url,
        items: (parsed.feed.items ?? []).map((item) => ({
          id: item.id,
          title: item.title,
          link: item.url ?? item.external_url,
          date: item.date_published ?? item.date_modified,
          body: item.summary ?? item.content_text ?? item.content_html
        }))
      }
  }
}

/** Parse any supported feed and convert it to the shared API shape. */
export function normalizeFeed(content: string, feedUrl: string, fetchedAt = new Date()): Feed {
  const parsed = candidates(parseFeed(content))
  const seen = new Set<string>()
  const items = parsed.items.flatMap((item, index) => {
    const itemSummary = summary(item.body)
    const title = plainText(item.title) || itemSummary?.slice(0, 120) || ''
    const link = absoluteWebUrl(item.link, feedUrl)
    const publishedAt = isoDate(item.date)
    const id =
      item.id?.trim() ||
      link ||
      createHash('sha256')
        .update(`${title}\0${publishedAt ?? ''}`)
        .digest('hex')
    if (seen.has(id)) return []
    seen.add(id)
    return [{ id, title, link, publishedAt, summary: itemSummary, index }]
  })
  items.sort((left, right) => {
    if (left.publishedAt && right.publishedAt) {
      return right.publishedAt.localeCompare(left.publishedAt) || left.index - right.index
    }
    if (left.publishedAt) return -1
    if (right.publishedAt) return 1
    return left.index - right.index
  })

  return feedSchema.parse({
    title: plainText(parsed.title) || null,
    link: absoluteWebUrl(parsed.link, feedUrl),
    items: items.slice(0, FEED_MAX_ITEMS).map((item) => ({
      id: item.id,
      title: item.title,
      link: item.link,
      publishedAt: item.publishedAt,
      summary: item.summary
    })),
    fetchedAt: fetchedAt.toISOString()
  })
}

async function pinnedAddress(url: URL, allowPrivateHosts: boolean): Promise<LookupAddress> {
  const hostname = url.hostname.replace(/^\[|\]$/g, '')
  const family = isIP(hostname)
  let addresses: LookupAddress[]
  try {
    addresses = family
      ? [{ address: hostname, family }]
      : await dnsLookup(hostname, { all: true, verbatim: true })
  } catch {
    throw new FeedUnavailableError('Feed host could not be resolved')
  }
  if (addresses.length === 0) throw new FeedUnavailableError('Feed host could not be resolved')
  if (!allowPrivateHosts && addresses.some(({ address }) => !isPublicAddress(address))) {
    throw new FeedUnavailableError('Feed host is not allowed')
  }
  return addresses[0]!
}

function decompressor(encoding: string | undefined): Transform | null {
  switch (encoding?.split(',')[0]?.trim().toLowerCase()) {
    case undefined:
    case '':
    case 'identity':
      return null
    case 'gzip':
    case 'x-gzip':
      return createGunzip()
    case 'deflate':
      return createInflate()
    case 'br':
      return createBrotliDecompress()
    default:
      throw new FeedUnavailableError('Feed uses an unsupported content encoding')
  }
}

/**
 * The body as text in its declared charset: the Content-Type header first,
 * then the XML declaration, else UTF-8. Many German feeds are ISO-8859-1.
 */
export function decodeBody(body: Buffer, contentType: string | undefined): string {
  const prolog = body.subarray(0, 200).toString('latin1')
  const charset =
    /charset\s*=\s*"?([\w.:-]+)/i.exec(contentType ?? '')?.[1] ??
    /^\s*<\?xml[^>]*encoding\s*=\s*["']([\w.:-]+)["']/i.exec(prolog)?.[1] ??
    'utf-8'
  try {
    return new TextDecoder(charset).decode(body)
  } catch {
    return new TextDecoder('utf-8').decode(body)
  }
}

function readBody(response: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let rawSize = 0
    let decodedSize = 0
    const chunks: Buffer[] = []
    let stream: IncomingMessage | Transform = response
    let decoder: Transform | null
    try {
      decoder = decompressor(response.headers['content-encoding'])
    } catch (error) {
      response.destroy()
      reject(error)
      return
    }
    response.on('data', (chunk: Buffer) => {
      rawSize += chunk.length
      if (rawSize > BODY_LIMIT) response.destroy(new FeedUnavailableError('Feed is too large'))
    })
    if (decoder) {
      response.pipe(decoder)
      stream = decoder
    }
    stream.on('data', (chunk: Buffer) => {
      decodedSize += chunk.length
      if (decodedSize > BODY_LIMIT) {
        response.destroy()
        decoder?.destroy()
        reject(new FeedUnavailableError('Feed is too large'))
        return
      }
      chunks.push(chunk)
    })
    stream.once('end', () =>
      resolve(decodeBody(Buffer.concat(chunks), response.headers['content-type']))
    )
    stream.once('error', () => reject(new FeedUnavailableError('Feed response could not be read')))
    response.once('error', (error) => reject(error))
  })
}

async function requestOnce(
  url: URL,
  address: LookupAddress,
  deadline: number
): Promise<{ response: IncomingMessage; body?: string }> {
  const remaining = deadline - Date.now()
  if (remaining <= 0) throw new FeedUnavailableError('Feed request timed out')
  const lookup: LookupFunction = (_hostname, options, callback) => {
    if (options.all) callback(null, [address])
    else callback(null, address.address, address.family)
  }

  return await new Promise((resolve, reject) => {
    const request = (url.protocol === 'https:' ? httpsRequest : httpRequest)(
      {
        protocol: url.protocol,
        hostname: url.hostname.replace(/^\[|\]$/g, ''),
        port: url.port || undefined,
        path: `${url.pathname}${url.search}`,
        method: 'GET',
        lookup,
        servername: url.hostname.replace(/^\[|\]$/g, ''),
        headers: {
          Accept:
            'application/atom+xml, application/feed+json, application/json, application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.1',
          'Accept-Encoding': 'gzip, deflate, br',
          'User-Agent': 'JLU-Campus-Feed/1.0'
        }
      },
      async (response) => {
        try {
          if (response.statusCode && response.statusCode >= 300 && response.statusCode < 400) {
            resolve({ response })
            return
          }
          if (!response.statusCode || response.statusCode < 200 || response.statusCode >= 300) {
            response.resume()
            reject(new FeedUnavailableError('Feed server returned an error'))
            return
          }
          resolve({ response, body: await readBody(response) })
        } catch (error) {
          reject(error)
        }
      }
    )
    const timeout = setTimeout(
      () => request.destroy(new FeedUnavailableError('Feed request timed out')),
      remaining
    )
    request.once('close', () => clearTimeout(timeout))
    request.once('error', (error) => reject(error))
    request.end()
  })
}

function checkedUrl(value: string, base?: URL): URL {
  let url: URL
  try {
    url = base ? new URL(value, base) : new URL(value)
  } catch {
    throw new FeedUnavailableError('Feed URL is invalid')
  }
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new FeedUnavailableError('Feed URL must use HTTP or HTTPS')
  }
  if (url.username || url.password) {
    throw new FeedUnavailableError('Feed URL must not contain credentials')
  }
  url.hash = ''
  return url
}

async function beforeDeadline<T>(promise: Promise<T>, deadline: number): Promise<T> {
  const remaining = deadline - Date.now()
  if (remaining <= 0) throw new FeedUnavailableError('Feed request timed out')
  let timer: NodeJS.Timeout | undefined
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(
          () => reject(new FeedUnavailableError('Feed request timed out')),
          remaining
        )
      })
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

export async function fetchFeed(urlValue: string, allowPrivateHosts: boolean): Promise<Feed> {
  let url = checkedUrl(urlValue)
  const deadline = Date.now() + REQUEST_TIMEOUT_MS
  try {
    for (let redirects = 0; ; redirects += 1) {
      const address = await beforeDeadline(pinnedAddress(url, allowPrivateHosts), deadline)
      const { response, body } = await requestOnce(url, address, deadline)
      if (body !== undefined) {
        if (Date.now() >= deadline) throw new FeedUnavailableError('Feed request timed out')
        return normalizeFeed(body, url.toString())
      }
      response.resume()
      const location = response.headers.location
      if (!location || redirects >= MAX_REDIRECTS) {
        throw new FeedUnavailableError('Feed redirected too many times')
      }
      url = checkedUrl(location, url)
    }
  } catch (error) {
    if (error instanceof FeedUnavailableError) throw error
    throw new FeedUnavailableError('Feed could not be fetched')
  }
}

interface CacheEntry {
  expiresAt: number
  feed?: Feed
  error?: string
}

export interface FeedLoaderOptions {
  allowPrivateHosts: boolean
  now?: () => number
  fetcher?: (url: string, allowPrivateHosts: boolean) => Promise<Feed>
  successTtlMs?: number
  failureTtlMs?: number
  maxEntries?: number
}

/** A bounded TTL cache that also shares concurrent requests for one URL. */
export function createFeedLoader(options: FeedLoaderOptions): (url: string) => Promise<Feed> {
  const cache = new Map<string, CacheEntry>()
  const pending = new Map<string, Promise<Feed>>()
  const now = options.now ?? Date.now
  const fetcher = options.fetcher ?? fetchFeed
  const successTtl = options.successTtlMs ?? SUCCESS_TTL_MS
  const failureTtl = options.failureTtlMs ?? FAILURE_TTL_MS
  const maxEntries = options.maxEntries ?? MAX_CACHE_ENTRIES

  const store = (key: string, entry: CacheEntry): void => {
    cache.delete(key)
    cache.set(key, entry)
    while (cache.size > maxEntries) cache.delete(cache.keys().next().value!)
  }

  return async (urlValue) => {
    const key = checkedUrl(urlValue).toString()
    const cached = cache.get(key)
    if (cached && cached.expiresAt > now()) {
      if (cached.feed) return cached.feed
      throw new FeedUnavailableError(cached.error ?? 'Feed is unavailable')
    }
    if (cached) cache.delete(key)
    const existing = pending.get(key)
    if (existing) return existing

    const promise = fetcher(key, options.allowPrivateHosts)
      .then((feed) => {
        store(key, { feed, expiresAt: now() + successTtl })
        return feed
      })
      .catch((error: unknown) => {
        const message =
          error instanceof FeedUnavailableError ? error.message : 'Feed is unavailable'
        store(key, { error: message, expiresAt: now() + failureTtl })
        throw new FeedUnavailableError(message)
      })
      .finally(() => pending.delete(key))
    pending.set(key, promise)
    return promise
  }
}
