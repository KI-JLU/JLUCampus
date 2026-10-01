import { Extension, type Editor } from '@tiptap/react'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'

/** The passage's look while it is marked. */
const PASSAGE_CLASS = 'rounded-sm bg-secondary-container text-on-secondary-container'

type Range = { from: number; to: number } | null

const passageKey = new PluginKey<DecorationSet>('passageHighlight')

/**
 * Keeps the passage the AI menu works on marked while the focus is in the menu, where the
 * browser hides the selection, as HAWKI draws it over the text.
 */
export const PassageHighlight = Extension.create({
  name: 'passageHighlight',
  addProseMirrorPlugins() {
    return [
      new Plugin<DecorationSet>({
        key: passageKey,
        state: {
          init: () => DecorationSet.empty,
          apply: (transaction, set) => {
            const range = transaction.getMeta(passageKey) as Range | undefined
            if (range === undefined) return set.map(transaction.mapping, transaction.doc)
            if (range === null || range.to <= range.from) return DecorationSet.empty
            const to = Math.min(range.to, transaction.doc.content.size)
            return DecorationSet.create(transaction.doc, [
              Decoration.inline(range.from, to, { class: PASSAGE_CLASS })
            ])
          }
        },
        props: {
          decorations: (state) => passageKey.getState(state)
        }
      })
    ]
  }
})

/** Marks a passage of the document, or nothing with `null`. */
export function highlightPassage(editor: Editor, range: Range): void {
  if (editor.isDestroyed) return
  editor.view.dispatch(editor.state.tr.setMeta(passageKey, range))
}
