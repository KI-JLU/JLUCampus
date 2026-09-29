import { TILE_TITLE_MAX } from '@justcampus/shared'

/**
 * What a user typed into a URL field, with `https://` put in front when no
 * scheme was given (`uni-giessen.de` → `https://uni-giessen.de`). Anything
 * else is left for the shared schemas to accept or reject.
 */
export function withScheme(input: string): string {
  const trimmed = input.trim()
  if (trimmed === '' || trimmed.includes('://')) return trimmed
  return `https://${trimmed}`
}

function parse(url: string): URL | null {
  try {
    return new URL(url)
  } catch {
    return null
  }
}

/** The host without a leading `www.`, or `null` for anything that is not an http(s) URL. */
export function hostnameOf(url: string): string | null {
  const parsed = parse(url)
  if (!parsed || (parsed.protocol !== 'https:' && parsed.protocol !== 'http:')) return null
  return parsed.hostname.replace(/^www\./, '') || null
}

/** A shortcut title taken from its URL, for when the user left the title empty. */
export function hostnameTitle(url: string): string {
  return (hostnameOf(url) ?? url.trim()).slice(0, TILE_TITLE_MAX)
}

/** Where a site's favicon conventionally lives; `null` for anything not http(s). */
export function faviconUrl(url: string): string | null {
  const parsed = parse(url)
  if (!parsed || (parsed.protocol !== 'https:' && parsed.protocol !== 'http:')) return null
  return `${parsed.origin}/favicon.ico`
}
