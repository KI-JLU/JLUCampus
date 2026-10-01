import type { Mermaid } from 'mermaid'

let library: Promise<Mermaid> | null = null
/** Diagrams are drawn one after another, as Mermaid wants it. */
let queue: Promise<unknown> = Promise.resolve()
let count = 0

/** Mermaid, loaded with the first diagram; it is big and most documents have none. */
function load(): Promise<Mermaid> {
  library ??= import('mermaid').then((module) => module.default)
  library.catch(() => {
    library = null
  })
  return library
}

/** The diagram's source as Mermaid reads it: HTML entities undone, as in HAWKI. */
export function mermaidSource(text: string): string {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim()
}

/** Starts loading Mermaid ahead of the first diagram. */
export function preloadMermaid(): void {
  void load().catch(() => undefined)
}

/**
 * The diagram as SVG, in Mermaid's light or dark theme. Rejects with Mermaid's message when the
 * source is not a diagram it can draw.
 */
export function renderMermaid(text: string, dark: boolean): Promise<string> {
  const run = queue.then(async () => {
    const mermaid = await load()
    mermaid.initialize({
      startOnLoad: false,
      theme: dark ? 'dark' : 'default',
      // Labels are text only: a diagram cannot bring scripts or links into the page.
      securityLevel: 'strict',
      suppressErrorRendering: true
    })
    const { svg } = await mermaid.render(`justcampus-mermaid-${++count}`, mermaidSource(text))
    return svg
  })
  queue = run.catch(() => undefined)
  return run
}
