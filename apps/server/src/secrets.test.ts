import { describe, expect, it } from 'vitest'

import { decryptSecret, encryptSecret } from './secrets.js'

const key = Buffer.alloc(32, 7)

describe('component secret encryption', () => {
  it('round-trips a secret', () => {
    const encrypted = encryptSecret('very secret', key, 'component-a', 'apiKey')
    expect(encrypted).toMatch(/^v1\.[^.]+\.[^.]+\.[^.]+$/)
    expect(decryptSecret(encrypted, key, 'component-a', 'apiKey')).toBe('very secret')
  })

  it('rejects tampered ciphertext', () => {
    const encrypted = encryptSecret('very secret', key, 'component-a', 'apiKey')
    const parts = encrypted.split('.')
    parts[3] = `${parts[3]}A`
    expect(() => decryptSecret(parts.join('.'), key, 'component-a', 'apiKey')).toThrow()
  })

  it('rejects a secret moved to another component or key', () => {
    const encrypted = encryptSecret('very secret', key, 'component-a', 'apiKey')
    expect(() => decryptSecret(encrypted, key, 'component-b', 'apiKey')).toThrow()
    expect(() => decryptSecret(encrypted, key, 'component-a', 'otherKey')).toThrow()
  })
})
