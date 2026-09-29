import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

const VERSION = 'v1'
const IV_BYTES = 12
const TAG_BYTES = 16

function aad(componentId: string, secretKey: string): Buffer {
  return Buffer.from(`${componentId}:${secretKey}`, 'utf8')
}

export function encryptSecret(
  plaintext: string,
  key: Buffer,
  componentId: string,
  secretKey: string
): string {
  const iv = randomBytes(IV_BYTES)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  cipher.setAAD(aad(componentId, secretKey))
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return [
    VERSION,
    iv.toString('base64url'),
    tag.toString('base64url'),
    ciphertext.toString('base64url')
  ].join('.')
}

export function decryptSecret(
  value: string,
  key: Buffer,
  componentId: string,
  secretKey: string
): string {
  const [version, encodedIv, encodedTag, encodedCiphertext, extra] = value.split('.')
  if (
    version !== VERSION ||
    !encodedIv ||
    !encodedTag ||
    encodedCiphertext === undefined ||
    extra !== undefined
  ) {
    throw new Error('Unsupported encrypted secret format')
  }

  const iv = Buffer.from(encodedIv, 'base64url')
  const tag = Buffer.from(encodedTag, 'base64url')
  if (iv.length !== IV_BYTES || tag.length !== TAG_BYTES) {
    throw new Error('Invalid encrypted secret format')
  }

  const decipher = createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAAD(aad(componentId, secretKey))
  decipher.setAuthTag(tag)
  return Buffer.concat([
    decipher.update(Buffer.from(encodedCiphertext, 'base64url')),
    decipher.final()
  ]).toString('utf8')
}
