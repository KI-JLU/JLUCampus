import { fetchPublicText, plainText } from '../../feed.js'

/** At most this many linked pages are read for one instruction. */
export const WEB_PAGES_MAX = 3
/** The part of a page the model gets. */
export const WEB_PAGE_TEXT_MAX = 8000

const PAGE_HEADERS = {
  Accept: 'text/html, application/xhtml+xml, text/plain;q=0.9, */*;q=0.1',
  'User-Agent': 'JLU-Campus-Translator/1.0'
}

/** A web page the model is given with the instruction. */
export interface WebPage {
  url: string
  text: string
}

/** The web addresses in an instruction, as HAWKI spots them (`https://…` or `www.…`), each once. */
export function linkedUrls(instruction: string): string[] {
  const found = instruction.match(/https?:\/\/[^\s<>"']+|www\.[^\s<>"']+/gi) ?? []
  const urls: string[] = []
  for (const raw of found) {
    const trimmed = raw.replace(/[.,;:!?)\]]+$/, '')
    const url = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
    if (!urls.includes(url)) urls.push(url)
  }
  return urls.slice(0, WEB_PAGES_MAX)
}

/** A page's readable text: scripts, styles and markup removed, cut to `WEB_PAGE_TEXT_MAX`. */
export function pageText(body: string, contentType: string | undefined): string {
  const html = !contentType || /html|xml/i.test(contentType)
  const text = html
    ? plainText(
        body
          .replace(/<!--[^]*?-->/g, ' ')
          .replace(/<(script|style|noscript|svg|template|head)\b[^]*?<\/\1\s*>/gi, ' ')
      )
    : body.replace(/\s+/g, ' ').trim()
  return text.slice(0, WEB_PAGE_TEXT_MAX)
}

/**
 * The pages an instruction links to, read for the model (HAWKI's web search). Without a link
 * there is nothing to read; a page that cannot be read is left out.
 */
export async function readLinkedPages(
  instruction: string,
  fetchText: typeof fetchPublicText = fetchPublicText
): Promise<WebPage[]> {
  const pages = await Promise.all(
    linkedUrls(instruction).map(async (url): Promise<WebPage | null> => {
      try {
        const page = await fetchText(url, false, PAGE_HEADERS)
        const text = pageText(page.body, page.contentType)
        return text ? { url: page.url, text } : null
      } catch {
        return null
      }
    })
  )
  return pages.filter((page): page is WebPage => page !== null)
}
