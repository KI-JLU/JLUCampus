import { describe, expect, it } from 'vitest'
import { parseExecutionOutput, splitOutputImages } from './python-output'

describe('the output', () => {
  it('takes PNGs out of the text as images', () => {
    const png = 'iVBORw0KGgoAAAANSUhEUgAAAAE='
    expect(splitOutputImages(`Plot:\ndata:image/png;base64,${png}\n`)).toEqual({
      text: 'Plot:\n\n',
      images: [png]
    })
  })

  it('reads what a block kept of its last run', () => {
    expect(parseExecutionOutput('{"text":"42\\n","images":[],"isError":false}')).toEqual({
      text: '42\n',
      images: [],
      isError: false
    })
    expect(parseExecutionOutput('kaputt')).toBeNull()
    expect(parseExecutionOutput(null)).toBeNull()
  })
})
