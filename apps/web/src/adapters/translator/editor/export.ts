import type { JSONContent } from '@tiptap/react'

import { parseExecutionOutput } from './python-output'

/**
 * The AI editor's exports, after HAWKI's: Word, PDF, plain text and Markdown, generated in the
 * browser from the document. Named after the first heading (or line) and the date.
 */

/** A document node's text, marks dropped. */
function textOf(node: JSONContent | undefined): string {
  if (!node) return ''
  if (node.type === 'text') return node.text ?? ''
  if (node.type === 'hardBreak') return '\n'
  return (node.content ?? []).map(textOf).join('')
}

/**
 * Whether HAWKI makes a Word or PDF file of the document: some top-level block has text of its
 * own. A document of only a table, a list or a quote is "empty" there.
 */
export function hasBlockText(doc: JSONContent): boolean {
  return (doc.content ?? []).some((block) =>
    (block.content ?? []).some((child) => !!child.text?.trim())
  )
}

/** The document as plain text: blocks apart by a blank line, lists with bullets or numbers. */
export function documentText(doc: JSONContent): string {
  const parts: string[] = []
  const list = (node: JSONContent, depth: number): void => {
    ;(node.content ?? []).forEach((item, index) => {
      const [first, ...rest] = item.content ?? []
      const prefix = node.type === 'orderedList' ? `${index + 1}. ` : '• '
      parts.push(`${'  '.repeat(depth)}${prefix}${textOf(first)}`)
      for (const child of rest) {
        if (child.type === 'bulletList' || child.type === 'orderedList') list(child, depth + 1)
        else parts.push(`${'  '.repeat(depth + 1)}${textOf(child)}`)
      }
    })
  }
  for (const node of doc.content ?? []) {
    switch (node.type) {
      case 'bulletList':
      case 'orderedList':
        list(node, 0)
        break
      case 'blockquote':
        for (const child of node.content ?? []) parts.push(`> ${textOf(child)}`)
        break
      case 'table':
        for (const row of node.content ?? []) {
          parts.push(
            (row.content ?? []).map((cell) => textOf(cell).replace(/\n/g, ' ')).join(' | ')
          )
        }
        break
      default:
        parts.push(textOf(node))
    }
  }
  return parts.join('\n\n').trim()
}

/** A title for a file name: lower case, umlauts spelled out, spaces as hyphens. */
export function sanitizeFilename(value: string): string {
  return value
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9\s_-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
}

/** `<title>_<yyyy-mm-dd>.<extension>`, the title from the first heading, else the first line. */
export function exportFilename(markdown: string, extension: string, now = new Date()): string {
  const heading = /^#+\s*(.+)$/m.exec(markdown)?.[1]
  const firstLine = markdown.trim().split('\n')[0] ?? ''
  const title = sanitizeFilename(heading?.trim() ?? firstLine).slice(0, 50) || 'ki-editor-dokument'
  const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  return `${title}_${date}.${extension}`
}

export function download(content: BlobPart, filename: string, type: string): void {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

interface Run {
  text: string
  bold: boolean
  italic: boolean
  code: boolean
}

/**
 * The inline content of a block as runs of equally formatted text: bold, italic and code, as
 * HAWKI exports it (struck text keeps its words, not the line).
 */
function runsOf(node: JSONContent, italic = false): Run[] {
  const runs: Run[] = []
  for (const child of node.content ?? []) {
    if (child.type === 'hardBreak') {
      runs.push({ text: '\n', bold: false, italic, code: false })
      continue
    }
    if (child.type !== 'text') {
      runs.push(...runsOf(child, italic))
      continue
    }
    const marks = new Set((child.marks ?? []).map((mark) => mark.type))
    runs.push({
      text: child.text ?? '',
      bold: marks.has('bold'),
      italic: italic || marks.has('italic'),
      code: marks.has('code')
    })
  }
  return runs
}

function formattedDate(now: Date): string {
  return `${String(now.getDate()).padStart(2, '0')}.${String(now.getMonth() + 1).padStart(2, '0')}.${now.getFullYear()}`
}

/** The texts of a Word export besides the document's own. */
export interface DocxLabels {
  /** The line above the document, with the date. */
  dated: (date: string) => string
  /** The head of every page. */
  pageHeader: string
  /** Above the output of a Python block's last run. */
  output: string
}

/**
 * The document as a Word file, as HAWKI writes it: the text of headings, paragraphs, quotes,
 * code blocks with their last output and plots, the first paragraph of each list item behind a
 * bullet or number, and tables with a shaded first row. Of the inline content only text counts,
 * bold, italic and code kept; other blocks are left out. The colours are those of the printed
 * document, not of the app's theme. `docx` is pinned to HAWKI's version (9.5.1), which writes the
 * same file parts.
 */
export async function documentDocx(
  doc: JSONContent,
  labels: DocxLabels,
  now = new Date()
): Promise<Blob> {
  const docx = await import('docx')
  const textRun = (child: JSONContent, italic: boolean): InstanceType<typeof docx.TextRun> => {
    const marks = new Set((child.marks ?? []).map((mark) => mark.type))
    return new docx.TextRun({
      text: child.text,
      size: 22,
      ...(marks.has('bold') ? { bold: true } : {}),
      ...(italic || marks.has('italic') ? { italics: true } : {}),
      ...(marks.has('code')
        ? { font: 'Courier New', color: 'C7254E', shading: { fill: 'F4F4F5' } }
        : { font: 'Calibri', color: '1E293B' })
    })
  }
  const runsOfParagraph = (
    node: JSONContent,
    italic = false
  ): InstanceType<typeof docx.TextRun>[] =>
    (node.content ?? [])
      .filter((child) => child.type === 'text')
      .map((child) => textRun(child, italic))
  const plainText = (node: JSONContent): string =>
    (node.content ?? []).map((child) => child.text ?? '').join('')

  const children: Array<InstanceType<typeof docx.Paragraph> | InstanceType<typeof docx.Table>> = [
    new docx.Paragraph({
      children: [
        new docx.TextRun({
          text: labels.dated(formattedDate(now)),
          font: 'Calibri',
          size: 16,
          color: '94A3B8'
        })
      ],
      spacing: { after: 400 }
    })
  ]
  const codeOutput = (value: unknown): void => {
    const output = parseExecutionOutput(value)
    if (!output) return
    children.push(
      new docx.Paragraph({
        children: [
          new docx.TextRun({
            text: labels.output,
            font: 'Calibri',
            bold: true,
            size: 18,
            color: '64748B'
          })
        ],
        indent: { left: 360 },
        spacing: { before: 120, after: 60 }
      })
    )
    if (output.text.trim()) {
      for (const line of output.text.trim().split('\n')) {
        children.push(
          new docx.Paragraph({
            children: [
              new docx.TextRun({
                text: line,
                font: 'Courier New',
                size: 16,
                color: output.isError ? 'EF4444' : '475569'
              })
            ],
            indent: { left: 360 },
            spacing: { before: 20, after: 20 }
          })
        )
      }
    }
    for (const image of output.images) {
      try {
        const base64 = image.replace(/\s/g, '')
        const data = Uint8Array.from(
          atob(base64.startsWith('data:') ? (base64.split(',')[1] ?? '') : base64),
          (char) => char.charCodeAt(0)
        )
        children.push(
          new docx.Paragraph({
            children: [
              new docx.ImageRun({ type: 'png', data, transformation: { width: 450, height: 300 } })
            ],
            indent: { left: 360 },
            spacing: { before: 120, after: 120 }
          })
        )
      } catch {
        // A plot that is no valid base64 is left out, as in HAWKI.
      }
    }
  }

  for (const node of doc.content ?? []) {
    switch (node.type) {
      case 'heading': {
        const level = Number(node.attrs?.level ?? 1) || 1
        children.push(
          new docx.Paragraph({
            children: [
              new docx.TextRun({
                text: plainText(node),
                font: 'Calibri',
                bold: true,
                size: ({ 1: 40, 2: 32, 3: 26 } as Record<number, number>)[level] ?? 24,
                color: '0F172A'
              })
            ],
            spacing: { before: level === 1 ? 360 : 240, after: 120 }
          })
        )
        break
      }
      case 'paragraph': {
        const runs = runsOfParagraph(node)
        children.push(
          runs.length === 0
            ? new docx.Paragraph({ spacing: { after: 120 } })
            : new docx.Paragraph({ children: runs, spacing: { after: 120 } })
        )
        break
      }
      case 'blockquote':
        for (const child of node.content ?? []) {
          if (child.type !== 'paragraph') continue
          children.push(
            new docx.Paragraph({
              children: runsOfParagraph(child, true),
              indent: { left: 540 },
              spacing: { before: 80, after: 80 }
            })
          )
        }
        break
      case 'codeBlock':
        for (const line of plainText(node).split('\n')) {
          children.push(
            new docx.Paragraph({
              children: [
                new docx.TextRun({ text: line, font: 'Courier New', size: 18, color: '334155' })
              ],
              indent: { left: 360 },
              spacing: { before: 40, after: 40 }
            })
          )
        }
        codeOutput(node.attrs?.executionOutput)
        break
      case 'bulletList':
      case 'orderedList':
        ;(node.content ?? []).forEach((item, index) => {
          const paragraph = item.content?.find((child) => child.type === 'paragraph')
          if (!paragraph) return
          children.push(
            new docx.Paragraph({
              children: [
                new docx.TextRun({
                  text: node.type === 'bulletList' ? '•   ' : `${index + 1}.  `,
                  font: 'Calibri',
                  bold: true,
                  color: '6366F1'
                }),
                ...runsOfParagraph(paragraph)
              ],
              spacing: { after: 80 }
            })
          )
        })
        break
      case 'table': {
        const rows = node.content ?? []
        if (rows.length === 0) break
        children.push(
          new docx.Table({
            rows: rows.map(
              (row, rowIndex) =>
                new docx.TableRow({
                  children: (row.content ?? []).map((cell) => {
                    const paragraphs = (cell.content ?? [])
                      .filter((child) => child.type === 'paragraph')
                      .map(
                        (child) =>
                          new docx.Paragraph({
                            children: runsOfParagraph(child),
                            spacing: { after: 60 }
                          })
                      )
                    return new docx.TableCell({
                      children: paragraphs.length > 0 ? paragraphs : [new docx.Paragraph({})],
                      shading: rowIndex === 0 ? { fill: 'F1F5F9' } : undefined,
                      margins: { top: 120, bottom: 120, left: 120, right: 120 }
                    })
                  })
                })
            ),
            width: { size: 100, type: docx.WidthType.PERCENTAGE }
          })
        )
        break
      }
      case 'horizontalRule':
        children.push(
          new docx.Paragraph({
            border: { bottom: { style: docx.BorderStyle.SINGLE, size: 6, color: 'E2E8F0' } },
            spacing: { before: 120, after: 120 }
          })
        )
        break
    }
  }
  const file = new docx.Document({
    styles: { default: { document: { run: { font: 'Calibri' } } } },
    sections: [
      {
        headers: {
          default: new docx.Header({
            children: [
              new docx.Paragraph({
                children: [
                  new docx.TextRun({
                    text: labels.pageHeader,
                    font: 'Calibri',
                    size: 18,
                    color: 'CBD5E1'
                  })
                ]
              })
            ]
          })
        },
        properties: { type: docx.SectionType.CONTINUOUS },
        children
      }
    ]
  })
  return docx.Packer.toBlob(file)
}

/** A word or a space of a paragraph, with its formatting. */
type Word = Pick<Run, 'text' | 'bold' | 'italic' | 'code'>

/**
 * The document as a PDF, laid out as HAWKI's: headings, paragraphs with bold, italic and code
 * words, quotes with a bar, code blocks and tables in boxes, lists with bullets or numbers, a
 * head with the title and date and a foot with the page number on every page. The colours are
 * those of the printed document, not of the app's theme.
 */
export async function documentPdf(
  doc: JSONContent,
  heading: string,
  pageLabel: (page: number, count: number) => string,
  now = new Date()
): Promise<Blob> {
  const { jsPDF } = await import('jspdf')
  const pdf = new jsPDF()
  const margin = 20
  const maxWidth = 210 - margin * 2
  const maxPageHeight = 270
  let y = 25
  const newPage = (): void => {
    pdf.addPage()
    y = 25
  }
  const fontOf = (word: Word): void => {
    if (word.code) pdf.setFont('courier', 'normal')
    else {
      pdf.setFont(
        'helvetica',
        word.bold && word.italic
          ? 'bolditalic'
          : word.bold
            ? 'bold'
            : word.italic
              ? 'italic'
              : 'normal'
      )
    }
  }
  /** One line of words, each in its font; code on a light ground. */
  const drawLine = (line: Word[], x: number, lineY: number): void => {
    let left = x
    for (const word of line) {
      fontOf(word)
      const width = pdf.getTextWidth(word.text)
      if (word.code) {
        pdf.setTextColor(199, 37, 78)
        pdf.setFillColor(248, 250, 252)
        pdf.rect(left, lineY - 3.5, width, 5, 'F')
      } else pdf.setTextColor(30, 41, 59)
      pdf.text(word.text, left, lineY)
      left += width
    }
  }
  /** The runs of a paragraph broken into lines of at most `limit`. */
  const wrap = (runs: Run[], limit: number): Word[][] => {
    const lines: Word[][] = []
    let line: Word[] = []
    let width = 0
    for (const run of runs) {
      for (const text of run.text.match(/[^\s]+|\s+/g) ?? []) {
        const word = { text, bold: run.bold, italic: run.italic, code: run.code }
        fontOf(word)
        const wordWidth = pdf.getTextWidth(text)
        if (line.length === 0 && !text.trim()) continue
        if (width + wordWidth <= limit) {
          line.push(word)
          width += wordWidth
        } else if (wordWidth > limit) {
          line.push(word)
          lines.push(line)
          line = []
          width = 0
        } else {
          lines.push(line)
          line = text.trim() ? [word] : []
          width = text.trim() ? wordWidth : 0
        }
      }
    }
    if (line.length > 0) lines.push(line)
    return lines
  }
  /** Text runs of a paragraph, as HAWKI takes them: text only. */
  const textRuns = (node: JSONContent | undefined, italic = false): Run[] =>
    runsOf(node ?? {}, italic).filter((run) => run.text !== '\n')

  ;(doc.content ?? []).forEach((block, index) => {
    switch (block.type) {
      case 'heading': {
        const level = Math.min(3, Math.max(1, Number(block.attrs?.level ?? 1)))
        const size = [20, 16, 13][level - 1]!
        pdf.setFont('helvetica', 'bold')
        pdf.setFontSize(size)
        pdf.setTextColor(15, 23, 42)
        const lines = pdf.splitTextToSize(textOf(block), maxWidth) as string[]
        if (index > 0) y += level === 1 ? 12 : 8
        if (y + lines.length * size * 0.4 > maxPageHeight) newPage()
        for (const line of lines) {
          pdf.text(line, margin, y)
          y += size * 0.4 + 2
        }
        y += 4
        break
      }
      case 'paragraph': {
        const runs = textRuns(block)
        if (runs.length === 0) {
          y += 6
          break
        }
        pdf.setFontSize(10.5)
        const lines = wrap(runs, maxWidth)
        if (index > 0) y += 4
        for (const line of lines) {
          if (y + 6 > maxPageHeight) newPage()
          drawLine(line, margin, y)
          y += 6
        }
        break
      }
      case 'blockquote': {
        const runs = (block.content ?? [])
          .filter((child) => child.type === 'paragraph')
          .flatMap((child) => textRuns(child, true))
        if (runs.length === 0) break
        pdf.setFontSize(10.5)
        const lines = wrap(runs, maxWidth - 10)
        if (index > 0) y += 4
        let start = y
        const bar = (): void => {
          pdf.setDrawColor(203, 213, 225)
          pdf.setLineWidth(1.2)
          pdf.line(margin + 2, start - 2, margin + 2, y - 4)
        }
        for (const line of lines) {
          if (y + 6 > maxPageHeight) {
            bar()
            newPage()
            start = y
          }
          drawLine(line, margin + 8, y)
          y += 6
        }
        bar()
        break
      }
      case 'codeBlock': {
        pdf.setFont('courier', 'normal')
        pdf.setFontSize(9)
        const lines = textOf(block)
          .split('\n')
          .flatMap((line) => pdf.splitTextToSize(line, maxWidth - 8) as string[])
        if (lines.length === 0) break
        if (index > 0) y += 4
        let start = y
        let pageLines: string[] = []
        const box = (): void => {
          if (pageLines.length === 0) return
          pdf.setFillColor(248, 250, 252)
          pdf.setDrawColor(226, 232, 240)
          pdf.rect(margin, start - 3.5, maxWidth, y - start + 1.5, 'FD')
          pdf.setFont('courier', 'normal')
          pdf.setFontSize(9)
          pdf.setTextColor(51, 65, 85)
          pageLines.forEach((line, lineIndex) => pdf.text(line, margin + 4, start + lineIndex * 5))
        }
        for (const line of lines) {
          if (y + 5 > maxPageHeight) {
            box()
            newPage()
            start = y
            pageLines = []
          }
          pageLines.push(line)
          y += 5
        }
        box()
        y += 2
        break
      }
      case 'bulletList':
      case 'orderedList': {
        y += 2
        ;(block.content ?? []).forEach((item, itemIndex) => {
          const paragraph = item.content?.find((child) => child.type === 'paragraph')
          if (!paragraph) return
          pdf.setFontSize(10.5)
          wrap(textRuns(paragraph), maxWidth - 8).forEach((line, lineIndex) => {
            if (y + 6 > maxPageHeight) newPage()
            if (lineIndex === 0) {
              pdf.setFont('helvetica', 'bold')
              pdf.setTextColor(99, 102, 241)
              pdf.text(block.type === 'bulletList' ? '•' : `${itemIndex + 1}.`, margin + 2, y)
            }
            drawLine(line, margin + 8, y)
            y += 6
          })
          y += 1.5
        })
        break
      }
      case 'table': {
        const rows = block.content ?? []
        const columns = Math.max(0, ...rows.map((row) => row.content?.length ?? 0))
        if (rows.length === 0 || columns === 0) break
        const columnWidth = maxWidth / columns
        if (index > 0) y += 4
        rows.forEach((row, rowIndex) => {
          const cells = row.content ?? []
          pdf.setFontSize(9.5)
          const cellLines = cells.map((cell) => {
            pdf.setFont('helvetica', rowIndex === 0 ? 'bold' : 'normal')
            const text = (cell.content ?? []).map((child) => textOf(child)).join('\n')
            return pdf.splitTextToSize(text, columnWidth - 4) as string[]
          })
          const rowHeight = Math.max(1, ...cellLines.map((lines) => lines.length)) * 5 + 4
          if (y + rowHeight > maxPageHeight) newPage()
          cells.forEach((cell, cellIndex) => {
            const x = margin + cellIndex * columnWidth
            const header = rowIndex === 0 || cell.type === 'tableHeader'
            if (header) pdf.setFillColor(241, 245, 249)
            else pdf.setFillColor(255, 255, 255)
            pdf.rect(x, y - 3.5, columnWidth, rowHeight, 'F')
            pdf.setDrawColor(203, 213, 225)
            pdf.setLineWidth(0.2)
            pdf.rect(x, y - 3.5, columnWidth, rowHeight, 'S')
            if (header) pdf.setTextColor(15, 23, 42)
            else pdf.setTextColor(51, 65, 85)
            pdf.setFont('helvetica', header ? 'bold' : 'normal')
            pdf.setFontSize(9.5)
            cellLines[cellIndex]!.forEach((line, lineIndex) =>
              pdf.text(line, x + 2, y + lineIndex * 5 + 1)
            )
          })
          y += rowHeight
        })
        y += 2
        break
      }
      case 'horizontalRule':
        if (index > 0) y += 4
        if (y + 5 > maxPageHeight) newPage()
        pdf.setDrawColor(226, 232, 240)
        pdf.setLineWidth(0.5)
        pdf.line(margin, y, margin + maxWidth, y)
        y += 6
        break
    }
  })

  // Head and foot on every page.
  const date = formattedDate(now)
  const pages = pdf.getNumberOfPages()
  for (let page = 1; page <= pages; page++) {
    pdf.setPage(page)
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(8)
    pdf.setTextColor(148, 163, 184)
    pdf.text(heading, margin, 15)
    pdf.text(date, 210 - margin - pdf.getTextWidth(date), 15)
    pdf.setDrawColor(226, 232, 240)
    pdf.setLineWidth(0.2)
    pdf.line(margin, 17, 210 - margin, 17)
    pdf.line(margin, 280, 210 - margin, 280)
    const label = pageLabel(page, pages)
    pdf.text(label, 210 - margin - pdf.getTextWidth(label), 285)
  }
  return pdf.output('blob')
}
