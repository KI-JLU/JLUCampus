import { detectCodeLanguage } from './code-language'

/** The toolbar's tools, which work on the Markdown text too while formatting is off. */
export type MarkdownTool =
  | { kind: 'heading'; level: 1 | 2 | 3 }
  | {
      kind:
        | 'bold'
        | 'italic'
        | 'strike'
        | 'quote'
        | 'bullet'
        | 'ordered'
        | 'outdent'
        | 'indent'
        | 'code'
        | 'codeBlock'
        | 'table'
    }

/** The Markdown text with its marked part. */
export interface MarkdownEdit {
  value: string
  start: number
  end: number
}

/**
 * A tool applied to the Markdown text, as HAWKI's editor does it: marks wrap the marked text,
 * block tools put their sign before it (and before each of its lines), indenting works on the
 * marked lines or the cursor's line, a code block takes the language its code looks like, and the
 * table is a 3×3 sample. The result marks the text inside the new formatting. `table` gives the
 * sample's column and cell names.
 */
export function applyMarkdownTool(
  { value: text, start, end }: MarkdownEdit,
  tool: MarkdownTool,
  table: { column: (n: number) => string; cell: string }
): MarkdownEdit {
  const selected = text.slice(start, end)
  let prefix = ''
  let suffix = ''
  let replaced = selected

  // The cursor's line, for the tools that work on it when nothing is marked.
  const lineStart = text.lastIndexOf('\n', start - 1) + 1
  const lineBreak = text.indexOf('\n', end)
  const lineEnd = lineBreak === -1 ? text.length : lineBreak
  const line = text.slice(lineStart, lineEnd)
  const replaceLine = (next: string, cursor: number): MarkdownEdit => ({
    value: text.slice(0, lineStart) + next + text.slice(lineEnd),
    start: cursor,
    end: cursor
  })

  switch (tool.kind) {
    case 'heading':
      prefix = `${'#'.repeat(tool.level)} `
      break
    case 'bold':
      prefix = suffix = '**'
      break
    case 'italic':
      prefix = suffix = '*'
      break
    case 'strike':
      prefix = suffix = '~~'
      break
    case 'quote':
      prefix = '> '
      replaced = selected.replace(/\n/g, '\n> ')
      break
    case 'bullet':
      prefix = '- '
      replaced = selected.replace(/\n/g, '\n- ')
      break
    case 'ordered':
      prefix = '1. '
      replaced = selected.replace(/\n/g, '\n1. ')
      break
    case 'outdent': {
      const indent = /^(\t| {2,4})/
      const marker = /^(\s*[-*+]\s|\s*\d+\.\s)/
      if (!selected) {
        const next = indent.test(line) ? line.replace(indent, '') : line.replace(marker, '')
        return replaceLine(next, Math.max(lineStart, start - (line.length - next.length)))
      }
      replaced = indent.test(selected)
        ? selected.replace(/^(\t| {2,4})/gm, '')
        : selected.replace(/^(\s*[-*+]\s|\s*\d+\.\s)/gm, '')
      break
    }
    case 'indent': {
      const listed = /^\s*([-*+]\s|\d+\.\s)/
      if (!selected) {
        const next = listed.test(line) ? `    ${line}` : `- ${line}`
        return replaceLine(next, start + (next.length - line.length))
      }
      replaced = selected.replace(/^/gm, listed.test(selected) ? '    ' : '- ')
      break
    }
    case 'code':
      prefix = suffix = '`'
      break
    case 'codeBlock': {
      // Without a marked text, the cursor's line becomes the block, if it has any text.
      const from = text.slice(0, start).lastIndexOf('\n') + 1
      const next = text.indexOf('\n', start)
      const to = next === -1 ? text.length : next
      const code = selected || text.slice(from, to)
      const wrapLine = !selected && code.trim() !== ''
      prefix = `\n\`\`\`${detectCodeLanguage(wrapLine ? code : selected) ?? ''}\n`
      suffix = '\n```\n'
      if (wrapLine) {
        return {
          value: text.slice(0, from) + prefix + code + suffix + text.slice(to),
          start: from + prefix.length,
          end: from + prefix.length + code.length
        }
      }
      break
    }
    case 'table': {
      const row = (cells: string[]): string => `| ${cells.join(' | ')} |`
      const columns = [1, 2, 3].map(table.column)
      prefix = `\n${[
        row(columns),
        row(['---', '---', '---']),
        row([table.cell, table.cell, table.cell]),
        row([table.cell, table.cell, table.cell])
      ].join('\n')}\n`
      replaced = ''
      break
    }
  }

  const inner = start + prefix.length
  return {
    value: text.slice(0, start) + prefix + replaced + suffix + text.slice(end),
    start: inner,
    end: inner + replaced.length
  }
}
