import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

interface JournalEntry {
  tag: string
  when: number
}

const journal = JSON.parse(
  readFileSync(new URL('../drizzle/meta/_journal.json', import.meta.url), 'utf8')
) as { entries: JournalEntry[] }

// Dated before 0006, so databases that already had 0006 skipped it.
// 0008_feed_read_repair creates its table there.
const knownOutOfOrder = new Set(['0007_feed_read'])

describe('migration journal', () => {
  it('dates every migration after all earlier ones', () => {
    // The migrator only runs migrations newer than the newest applied one, so
    // an out-of-order timestamp is silently skipped on existing databases.
    let newest = 0
    for (const entry of journal.entries) {
      if (knownOutOfOrder.has(entry.tag)) continue
      expect(entry.when, entry.tag).toBeGreaterThan(newest)
      newest = entry.when
    }
  })
})
