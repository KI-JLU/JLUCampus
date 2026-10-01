import { describe, expect, it } from 'vitest'

import { detectCodeLanguage } from './code-language'

describe('code language', () => {
  it('tells the language as HAWKI does', () => {
    expect(detectCodeLanguage('const zahl = 42;')).toBe('javascript')
    expect(detectCodeLanguage('{"a": 1}')).toBe('json')
    expect(detectCodeLanguage('<?php echo 1;')).toBe('php')
    expect(detectCodeLanguage('<div>Hallo</div>')).toBe('html')
    expect(detectCodeLanguage('graph TD\n  A --> B')).toBe('mermaid')
    expect(detectCodeLanguage('def f(x):\n    return x * 2\n\nprint(f(2))')).toBe('python')
    expect(detectCodeLanguage('   ')).toBeNull()
  })
})
