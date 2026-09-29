import { describe, expect, it } from 'vitest'
import { linuxAutostartContent } from './system-utils'

describe('linuxAutostartContent', () => {
  it('quotes the executable path and adds the autostart flag', () => {
    expect(linuxAutostartContent('/opt/JLU Campus/jlu-campus')).toContain(
      'Exec="/opt/JLU Campus/jlu-campus" --autostart'
    )
    expect(linuxAutostartContent('/opt/campus')).toContain('Type=Application\nName=JLU Campus\n')
  })
})
