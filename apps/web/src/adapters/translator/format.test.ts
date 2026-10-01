import { describe, expect, it } from 'vitest'
import { formatGlossaryDate, formatSize } from './format'

describe('formatSize', () => {
  it('writes sizes as HAWKI does, with a decimal point in every language', () => {
    expect(formatSize(0)).toBe('0 Bytes')
    expect(formatSize(113)).toBe('113 Bytes')
    expect(formatSize(36_690)).toBe('35.83 KB')
    expect(formatSize(5_120)).toBe('5 KB')
    expect(formatSize(20 * 1024 * 1024)).toBe('20 MB')
  })
})

describe('formatGlossaryDate', () => {
  it('writes the day in US English and the time as in German, as HAWKI does', () => {
    expect(formatGlossaryDate(new Date(2026, 9, 1, 6, 54))).toBe('Oct 1, 2026 • 06:54')
    expect(formatGlossaryDate(new Date(2026, 11, 24, 18, 5))).toBe('Dec 24, 2026 • 18:05')
  })
})
