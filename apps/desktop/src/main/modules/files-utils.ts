import { extname } from 'node:path'

export interface NetworkAddress {
  host: string
  segments: string[]
}

/** Parses a UNC or SMB share without accepting traversal or URL credentials. */
export function parseNetworkAddress(input: string): NetworkAddress | null {
  if (typeof input !== 'string') return null
  let parts: string[]
  if (input.startsWith('\\\\')) parts = input.slice(2).split('\\')
  else if (input.startsWith('//')) parts = input.slice(2).split('/')
  else if (input.startsWith('smb://')) parts = input.slice(6).split('/')
  else return null
  if (parts.length < 2 || !/^[A-Za-z0-9.-]+$/.test(parts[0])) return null
  if (parts.some((part) => !part || part === '.' || part === '..' || /[\\/?#]/.test(part)))
    return null
  return { host: parts[0], segments: parts.slice(1) }
}

/** Formats a network share for the host operating system. */
export function networkLocation(address: NetworkAddress, platform = process.platform): string {
  return platform === 'win32'
    ? `\\\\${address.host}\\${address.segments.join('\\')}`
    : `smb://${address.host}/${address.segments.map(encodeURIComponent).join('/')}`
}

const blockedExtensions = new Set([
  '.exe',
  '.msi',
  '.bat',
  '.cmd',
  '.com',
  '.scr',
  '.ps1',
  '.vbs',
  '.js',
  '.jar',
  '.sh',
  '.appimage',
  '.app',
  '.command',
  '.deb',
  '.rpm',
  '.dmg',
  '.pkg'
])

/** Refuses executable downloads before handing them to the OS. */
export function isBlockedDownload(path: string): boolean {
  return blockedExtensions.has(extname(path).toLowerCase())
}
