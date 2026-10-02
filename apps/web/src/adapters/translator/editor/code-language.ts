import type { Editor } from '@tiptap/react'
import type { Transaction } from '@tiptap/pm/state'
import { common, createLowlight } from 'lowlight'

/** The grammars code blocks are highlighted with. */
export const lowlight = createLowlight(common)

/** The languages HAWKI's editor guesses between, when no rule below decides. */
const GUESSED = [
  'javascript',
  'typescript',
  'php',
  'xml',
  'css',
  'json',
  'python',
  'sql',
  'bash',
  'java',
  'cpp',
  'rust',
  'go',
  'yaml',
  'markdown'
]

const MERMAID =
  /^\s*(graph|flowchart|sequenceDiagram|gantt|classDiagram|stateDiagram-v2|stateDiagram|erDiagram|journey|pie|gitGraph|requirementDiagram|kanban)/

/**
 * The language of a piece of code as HAWKI's editor tells it: Mermaid, JSON, PHP and HTML by
 * their look, anything else by the highlighter's best guess; `null` when nothing fits.
 */
export function detectCodeLanguage(text: string): string | null {
  const trimmed = text.trim()
  if (!trimmed) return null
  const firstLines = trimmed.split('\n').slice(0, 5).join('\n')
  if (
    MERMAID.test(firstLines) ||
    (firstLines.includes('---') &&
      (firstLines.includes('kanban') || firstLines.includes('gitGraph')))
  ) {
    return 'mermaid'
  }
  if (
    (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
    (trimmed.startsWith('[') && trimmed.endsWith(']'))
  ) {
    try {
      JSON.parse(trimmed)
      return 'json'
    } catch {
      /* Not JSON after all. */
    }
  }
  if (
    trimmed.includes('<?php') ||
    trimmed.includes('namespace App\\') ||
    trimmed.includes('use Illuminate\\')
  ) {
    return 'php'
  }
  if (trimmed.startsWith('<!DOCTYPE html') || /^\s*<[a-zA-Z]+[^>]*>/.test(trimmed)) return 'html'
  const detected = (
    lowlight.highlightAuto(text, { subset: GUESSED }).data as { language?: string } | undefined
  )?.language
  if (detected === 'xml') return 'html'
  return detected || null
}

/**
 * Gives every code block without a language the one its code looks like, as HAWKI does after
 * each change of the document. Not an undo step of its own.
 */
export function detectCodeBlockLanguages(editor: Editor): void {
  let tr: Transaction | null = null
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name !== 'codeBlock' || node.attrs.language || !node.textContent.trim()) return
    const language = detectCodeLanguage(node.textContent)
    if (!language) return
    tr ??= editor.state.tr
    tr.setNodeMarkup(pos, undefined, { ...node.attrs, language })
  })
  if (tr) editor.view.dispatch((tr as Transaction).setMeta('addToHistory', false))
}
