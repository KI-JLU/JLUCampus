import { describe, expect, it } from 'vitest'
import { applyMarkdownTool, type MarkdownEdit, type MarkdownTool } from './markdown-format'

const table = { column: (n: number) => `Spalte ${n}`, cell: 'Inhalt' }
const apply = (edit: MarkdownEdit, tool: MarkdownTool): MarkdownEdit =>
  applyMarkdownTool(edit, tool, table)
const marked = (value: string): MarkdownEdit => ({ value, start: 0, end: value.length })

describe('applyMarkdownTool', () => {
  it('wraps the marked lines in marks and keeps them marked', () => {
    expect(apply(marked('Alpha\nBeta'), { kind: 'bold' })).toEqual({
      value: '**Alpha\nBeta**',
      start: 2,
      end: 12
    })
    expect(apply(marked('x'), { kind: 'strike' }).value).toBe('~~x~~')
    expect(apply(marked('x'), { kind: 'code' }).value).toBe('`x`')
  })

  it('puts block signs before the text and each of its lines', () => {
    expect(apply(marked('Alpha\nBeta'), { kind: 'heading', level: 2 }).value).toBe('## Alpha\nBeta')
    expect(apply(marked('Alpha\nBeta'), { kind: 'bullet' }).value).toBe('- Alpha\n- Beta')
    expect(apply(marked('Alpha\nBeta'), { kind: 'ordered' }).value).toBe('1. Alpha\n1. Beta')
    expect(apply(marked('Alpha\nBeta'), { kind: 'quote' }).value).toBe('> Alpha\n> Beta')
  })

  it("indents the cursor's line, starting a list outside one", () => {
    expect(apply({ value: 'Alpha', start: 2, end: 2 }, { kind: 'indent' })).toEqual({
      value: '- Alpha',
      start: 4,
      end: 4
    })
    expect(apply({ value: '- Alpha', start: 3, end: 3 }, { kind: 'indent' }).value).toBe(
      '    - Alpha'
    )
    expect(apply({ value: '    - Alpha', start: 6, end: 6 }, { kind: 'outdent' }).value).toBe(
      '- Alpha'
    )
    expect(apply({ value: '- Alpha', start: 4, end: 4 }, { kind: 'outdent' })).toEqual({
      value: 'Alpha',
      start: 2,
      end: 2
    })
    expect(apply(marked('- A\n- B'), { kind: 'indent' }).value).toBe('    - A\n    - B')
  })

  it("makes the cursor's line a code block with the language it looks like", () => {
    const edit = apply({ value: 'Text\n{"a": 1}', start: 7, end: 7 }, { kind: 'codeBlock' })
    expect(edit.value).toBe('Text\n\n```json\n{"a": 1}\n```\n')
    expect(edit.value.slice(edit.start, edit.end)).toBe('{"a": 1}')
    expect(apply({ value: '', start: 0, end: 0 }, { kind: 'codeBlock' }).value).toBe(
      '\n```\n\n```\n'
    )
  })

  it('inserts the sample table in place of the marked text', () => {
    expect(apply({ value: 'ab', start: 1, end: 2 }, { kind: 'table' }).value).toBe(
      'a\n| Spalte 1 | Spalte 2 | Spalte 3 |\n| --- | --- | --- |\n| Inhalt | Inhalt | Inhalt |\n| Inhalt | Inhalt | Inhalt |\n'
    )
  })
})
