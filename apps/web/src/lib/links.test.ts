import { describe, expect, it } from 'vitest'
import { TILE_TITLE_MAX } from '@justcampus/shared'
import { faviconUrl, hostnameOf, hostnameTitle, withScheme } from './links'

describe('withScheme', () => {
  it('puts https in front of a bare host and leaves full URLs alone', () => {
    expect(withScheme('  uni-giessen.de/path ')).toBe('https://uni-giessen.de/path')
    expect(withScheme('http://localhost:3000')).toBe('http://localhost:3000')
    expect(withScheme('')).toBe('')
  })
})

describe('hostnameOf', () => {
  it('drops www. and rejects anything that is not http(s)', () => {
    expect(hostnameOf('https://www.uni-giessen.de/studium')).toBe('uni-giessen.de')
    expect(hostnameOf('http://localhost:5173')).toBe('localhost')
    expect(hostnameOf('mailto:someone@example.org')).toBeNull()
    expect(hostnameOf('not a url')).toBeNull()
  })
})

describe('hostnameTitle', () => {
  it('uses the host, falling back to the input, within the title limit', () => {
    expect(hostnameTitle('https://www.uni-giessen.de/')).toBe('uni-giessen.de')
    expect(hostnameTitle(' something ')).toBe('something')
    expect(hostnameTitle(`https://${'a'.repeat(100)}.de`)).toHaveLength(TILE_TITLE_MAX)
  })
})

describe('faviconUrl', () => {
  it('points at /favicon.ico of the origin', () => {
    expect(faviconUrl('https://www.uni-giessen.de/de/studium?x=1')).toBe(
      'https://www.uni-giessen.de/favicon.ico'
    )
    expect(faviconUrl('http://localhost:8080/a')).toBe('http://localhost:8080/favicon.ico')
    expect(faviconUrl('javascript:alert(1)')).toBeNull()
  })
})
