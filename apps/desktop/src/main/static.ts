import { existsSync } from 'node:fs'
import { extname, relative, resolve, sep } from 'node:path'

const mimeTypes: Record<string, string> = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2'
}

export interface StaticFile {
  path: string
  mimeType: string
}

export function resolveStaticFile(rendererDirectory: string, pathname: string): StaticFile | null {
  let decodedPath: string
  try {
    decodedPath = decodeURIComponent(pathname)
  } catch {
    return null
  }

  const root = resolve(rendererDirectory)
  const requested = resolve(root, `.${decodedPath}`)
  const isInsideRoot =
    relative(root, requested) === '' || !relative(root, requested).startsWith(`..${sep}`)
  if (!isInsideRoot) return null

  const fallback = resolve(root, 'index.html')
  const candidate = extname(decodedPath) === '' || !existsSync(requested) ? fallback : requested
  if (!existsSync(candidate)) return null

  return { path: candidate, mimeType: mimeTypes[extname(candidate)] ?? 'application/octet-stream' }
}
