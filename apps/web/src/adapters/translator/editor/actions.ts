import type { TranslatorComposeAction } from '@justcampus/shared'

/** What a result is called in the result bar: after an action, or the instruction itself. */
export type AgentTitle =
  { key: TranslatorComposeAction | 'friendly' | 'objective' | 'compact' } | { text: string }

/**
 * The action an instruction stands for and what its result is called, as HAWKI tells them from
 * its (German) words; anything else is rephrased, named after the instruction while it is short.
 */
export function agentFor(instruction: string): {
  action: TranslatorComposeAction
  title: AgentTitle
} {
  const text = instruction
  if (!text) return { action: 'rephrase', title: { key: 'rephrase' } }
  if (text.includes('Korrekturlesen')) return { action: 'proofread', title: { key: 'proofread' } }
  if (text.includes('freundlich')) return { action: 'rephrase', title: { key: 'friendly' } }
  if (text.includes('sachlich')) return { action: 'rephrase', title: { key: 'objective' } }
  if (text.includes('prägnant') || text.includes('kompakt')) {
    return { action: 'rephrase', title: { key: 'compact' } }
  }
  if (
    text.includes('Zusammenfassung') ||
    text.includes('kürzen') ||
    text.includes('Wesentliche reduzieren')
  ) {
    return { action: 'shorten', title: { key: 'shorten' } }
  }
  if (text.includes('Hauptpunkten')) return { action: 'key_points', title: { key: 'key_points' } }
  if (text.includes('Liste')) return { action: 'list', title: { key: 'list' } }
  if (/tabe|spalt|matrix/i.test(text)) return { action: 'table', title: { key: 'table' } }
  if (text.includes('weiterschreiben') || text.includes('verfassen')) {
    return { action: 'compose', title: { key: 'compose' } }
  }
  if (text.includes('ausformulieren')) return { action: 'expand', title: { key: 'expand' } }
  if (text.includes('paraphrasieren')) {
    return { action: 'paraphrase', title: { key: 'paraphrase' } }
  }
  return { action: 'rephrase', title: text.length < 20 ? { text } : { key: 'rephrase' } }
}

/**
 * The instruction each menu action sends, in HAWKI's words; "Bearbeiten" shows it again.
 * Rephrasing sends what is typed in the menu's field, else its name.
 */
export const ACTION_INSTRUCTION_KEYS = {
  proofread: 'component.translator.editor.instructions.proofread',
  rephrase: 'component.translator.editor.instructions.rephrase',
  key_points: 'component.translator.editor.instructions.key_points',
  paraphrase: 'component.translator.editor.instructions.paraphrase',
  shorten: 'component.translator.editor.instructions.shorten',
  expand: 'component.translator.editor.instructions.expand',
  list: 'component.translator.editor.instructions.list',
  table: 'component.translator.editor.instructions.table',
  compose: 'component.translator.editor.instructions.compose'
} as const satisfies Record<TranslatorComposeAction, string>

/** A web address or HAWKI's "/suche" command in a compose instruction shows the web search. */
export function webSearchTrigger(instruction: string): { shown: boolean; command: boolean } {
  const command = /^\/suche(\s|$)/i.test(instruction.trim())
  return { shown: command || /https?:\/\/[^\s]+|www\.[^\s]+/i.test(instruction), command }
}

/** The instruction as it is sent: HAWKI drops a leading "/suche". */
export function withoutSearchCommand(instruction: string): string {
  return /^\/suche(\s|$)/i.test(instruction.trim())
    ? instruction.trim().replace(/^\/suche\s*/i, '')
    : instruction
}
