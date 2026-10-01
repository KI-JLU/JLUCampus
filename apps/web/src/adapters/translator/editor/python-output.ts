/**
 * The output of a Python code block's run, after HAWKI's "Code ausführen": the server runs the
 * code (`API.translatorExecutePython`); the block shows the text and each plot in it.
 */

/** A PNG in the output, with or without its data URL prefix, as HAWKI finds plots. */
const PNG = /(?:data:image\/png;base64,)?(iVBORw0KGgoAAAANSUhEUg[A-Za-z0-9+/=]+)/g

/** The output as HAWKI shows it: the text, and each PNG in it as an image of its own. */
export function splitOutputImages(output: string): { text: string; images: string[] } {
  const images: string[] = []
  const text = output.replace(PNG, (_match, base64: string) => {
    images.push(base64.replace(/\s/g, ''))
    return ''
  })
  return { text, images }
}

/** What a block keeps of its last run (`data-execution-output`), so a reload shows it again. */
export interface ExecutionOutput {
  text: string
  images: string[]
  isError: boolean
}

export function parseExecutionOutput(value: unknown): ExecutionOutput | null {
  if (typeof value !== 'string' || !value) return null
  try {
    const parsed = JSON.parse(value) as Partial<ExecutionOutput> | null
    if (!parsed || typeof parsed !== 'object') return null
    return {
      text: typeof parsed.text === 'string' ? parsed.text : '',
      images: Array.isArray(parsed.images)
        ? parsed.images.filter((image): image is string => typeof image === 'string')
        : [],
      isError: parsed.isError === true
    }
  } catch {
    return null
  }
}
