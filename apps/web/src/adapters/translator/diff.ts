export type DiffPart = { type: 'equal' | 'insert' | 'delete'; text: string }

/**
 * Words, single punctuation marks and the whitespace between them, so a diff
 * keeps line breaks and spacing and an added comma leaves its word unmarked.
 */
function tokenize(text: string): string[] {
  return text.match(/\s+|[\p{L}\p{M}\p{N}]+|[^\s\p{L}\p{M}\p{N}]/gu) ?? []
}

/**
 * What changed from `before` to `after`, word by word: the longest common
 * subsequence of their word and whitespace tokens is kept, the rest is
 * deleted or inserted. Adjacent parts of the same type are merged, and a
 * deletion comes before the insertion that replaces it.
 */
export function diffWords(before: string, after: string): DiffPart[] {
  const a = tokenize(before)
  const b = tokenize(after)

  // The common start and end need no table; texts that were only edited in places stay cheap.
  let start = 0
  while (start < a.length && start < b.length && a[start] === b[start]) start++
  let end = 0
  while (
    end < a.length - start &&
    end < b.length - start &&
    a[a.length - 1 - end] === b[b.length - 1 - end]
  ) {
    end++
  }

  const midA = a.slice(start, a.length - end)
  const midB = b.slice(start, b.length - end)
  const rows = midA.length
  const cols = midB.length
  // LCS lengths of every pair of suffixes, midA[i..] and midB[j..].
  const lengths = new Uint32Array((rows + 1) * (cols + 1))
  const lcs = (i: number, j: number): number => lengths[i * (cols + 1) + j] ?? 0
  for (let i = rows - 1; i >= 0; i--) {
    for (let j = cols - 1; j >= 0; j--) {
      lengths[i * (cols + 1) + j] =
        midA[i] === midB[j] ? lcs(i + 1, j + 1) + 1 : Math.max(lcs(i + 1, j), lcs(i, j + 1))
    }
  }

  const parts: DiffPart[] = []
  const push = (type: DiffPart['type'], text: string): void => {
    const last = parts[parts.length - 1]
    if (last?.type === type) last.text += text
    else parts.push({ type, text })
  }

  for (const token of a.slice(0, start)) push('equal', token)
  let i = 0
  let j = 0
  while (i < rows || j < cols) {
    const tokenA = midA[i]
    const tokenB = midB[j]
    if (tokenA !== undefined && tokenA === tokenB) {
      push('equal', tokenA)
      i++
      j++
    } else if (tokenA !== undefined && (tokenB === undefined || lcs(i + 1, j) >= lcs(i, j + 1))) {
      push('delete', tokenA)
      i++
    } else if (tokenB !== undefined) {
      push('insert', tokenB)
      j++
    }
  }
  for (const token of a.slice(a.length - end)) push('equal', token)
  return parts
}
