import { inflateRawSync } from 'node:zlib'

import type { JSONContent } from '@tiptap/react'
import { describe, expect, it } from 'vitest'

import { documentDocx, hasBlockText } from './export'

/** One file of a ZIP archive (a .docx), found through the central directory. */
function zipEntry(archive: Buffer, name: string): string {
  const end = archive.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]))
  let offset = archive.readUInt32LE(end + 16)
  for (let entry = 0; entry < archive.readUInt16LE(end + 10); entry++) {
    const method = archive.readUInt16LE(offset + 10)
    const size = archive.readUInt32LE(offset + 20)
    const nameLength = archive.readUInt16LE(offset + 28)
    const extra = archive.readUInt16LE(offset + 30)
    const comment = archive.readUInt16LE(offset + 32)
    const local = archive.readUInt32LE(offset + 42)
    if (archive.toString('utf8', offset + 46, offset + 46 + nameLength) === name) {
      const start = local + 30 + archive.readUInt16LE(local + 26) + archive.readUInt16LE(local + 28)
      const data = archive.subarray(start, start + size)
      return (method === 8 ? inflateRawSync(data) : data).toString('utf8')
    }
    offset += 46 + nameLength + extra + comment
  }
  throw new Error(`${name} not in the archive`)
}

const text = (value: string, marks: string[] = []): JSONContent => ({
  type: 'text',
  text: value,
  ...(marks.length > 0 ? { marks: marks.map((type) => ({ type })) } : {})
})
const paragraph = (...content: JSONContent[]): JSONContent => ({ type: 'paragraph', content })
const cell = (type: string, value: string): JSONContent => ({
  type,
  content: [paragraph(text(value))]
})

async function documentXml(doc: JSONContent): Promise<string> {
  const blob = await documentDocx(
    doc,
    {
      dated: (date) => `Export  |  Datum: ${date}`,
      pageHeader: 'Dokumenten-Export',
      output: 'Ausgabe:'
    },
    new Date(2026, 9, 1)
  )
  return zipEntry(Buffer.from(await blob.arrayBuffer()), 'word/document.xml')
}

describe('documentDocx', () => {
  it('writes a table as HAWKI does: the first row shaded, its text not bold', async () => {
    const xml = await documentXml({
      type: 'doc',
      content: [
        {
          type: 'table',
          content: [
            {
              type: 'tableRow',
              content: [cell('tableHeader', 'Name'), cell('tableHeader', 'Wert')]
            },
            {
              type: 'tableRow',
              content: [cell('tableCell', 'Prüfung'), cell('tableCell', 'Montag')]
            }
          ]
        }
      ]
    })
    expect(xml).toContain('Export  |  Datum: 01.10.2026')
    expect(xml).toContain('Name')
    expect(xml).not.toContain('<w:b/>')
    expect(xml).not.toContain('<w:b ')
    expect(xml.match(/w:fill="F1F5F9"/g)).toHaveLength(2)
  })

  it('keeps bold, italic and code, but drops struck lines and breaks, as HAWKI does', async () => {
    const xml = await documentXml({
      type: 'doc',
      content: [
        paragraph(
          text('fett', ['bold']),
          text('kursiv', ['italic']),
          { type: 'hardBreak' },
          text('gestrichen', ['strike']),
          text('code', ['code'])
        ),
        { type: 'bulletList', content: [{ type: 'listItem', content: [paragraph(text('Punkt'))] }] }
      ]
    })
    expect(xml.match(/<w:b\/>/g)).toHaveLength(2)
    expect(xml.match(/<w:i\/>/g)).toHaveLength(1)
    expect(xml).not.toContain('w:strike')
    expect(xml).not.toContain('<w:br/>')
    expect(xml).toContain('Courier New')
    expect(xml).toContain('•   ')
  })
})

describe('hasBlockText', () => {
  const paragraph = (text: string): JSONContent => ({
    type: 'paragraph',
    content: [{ type: 'text', text }]
  })

  it('looks at the top-level blocks’ own text only, as HAWKI does', () => {
    expect(hasBlockText({ type: 'doc', content: [paragraph('Prüfung')] })).toBe(true)
    expect(hasBlockText({ type: 'doc', content: [paragraph('  ')] })).toBe(false)
    for (const nested of [
      { type: 'bulletList', content: [{ type: 'listItem', content: [paragraph('Ausweis')] }] },
      { type: 'blockquote', content: [paragraph('Die Prüfung ist am Montag.')] },
      {
        type: 'table',
        content: [
          { type: 'tableRow', content: [{ type: 'tableCell', content: [paragraph('Name')] }] }
        ]
      }
    ]) {
      expect(hasBlockText({ type: 'doc', content: [nested] })).toBe(false)
      expect(hasBlockText({ type: 'doc', content: [nested, paragraph('Text')] })).toBe(true)
    }
  })
})
