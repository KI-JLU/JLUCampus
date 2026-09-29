import { describe, expect, it } from 'vitest'
import { isBlockedDownload, networkLocation, parseNetworkAddress } from './files-utils'

describe('network shares', () => {
  it('accepts UNC, slash and SMB addresses and formats them by platform', () => {
    const address = { host: 'files.example.org', segments: ['share', 'sub'] }
    expect(parseNetworkAddress('\\\\files.example.org\\share\\sub')).toEqual(address)
    expect(parseNetworkAddress('//files.example.org/share/sub')).toEqual(address)
    expect(parseNetworkAddress('smb://files.example.org/share/sub')).toEqual(address)
    expect(networkLocation(address, 'win32')).toBe('\\\\files.example.org\\share\\sub')
    expect(networkLocation(address, 'linux')).toBe('smb://files.example.org/share/sub')
  })

  it('rejects missing shares, credentials and traversal', () => {
    expect(parseNetworkAddress('smb://host')).toBeNull()
    expect(parseNetworkAddress('smb://user@host/share')).toBeNull()
    expect(parseNetworkAddress('\\\\host\\share\\..')).toBeNull()
    expect(parseNetworkAddress('//host/share/')).toBeNull()
  })
})

describe('recent downloads', () => {
  it('blocks installers and scripts regardless of extension case', () => {
    expect(isBlockedDownload('/Downloads/setup.MsI')).toBe(true)
    expect(isBlockedDownload('/Downloads/install.AppImage')).toBe(true)
    expect(isBlockedDownload('/Downloads/readme.pdf')).toBe(false)
  })
})
