/**
 * Sentences of a text, as HAWKI's translator splits them: the text is sent sentence by sentence,
 * so a result lines up with its source, a live edit only redoes the sentences that changed, and a
 * click on a sentence of the result can offer other wordings of just that sentence.
 */

/** Abbreviations after which a full stop does not end a sentence. */
const ABBREVIATIONS = [
  'z.b',
  'u.a',
  'd.h',
  'bzw',
  'etc',
  'vgl',
  'usw',
  'ca',
  'inkl',
  'exkl',
  'm.e',
  'i.d.r',
  'u.v.m',
  'o.ä',
  'u.ä',
  's.o',
  'v.a',
  'dr',
  'prof',
  'st',
  'fr',
  'hr',
  'dipl',
  'ing',
  'mag',
  'nr',
  'no',
  'jan',
  'feb',
  'mrz',
  'mär',
  'apr',
  'mai',
  'jun',
  'jul',
  'aug',
  'sep',
  'okt',
  'nov',
  'dez',
  'min',
  'std',
  'sek',
  'tel',
  's',
  'p.a',
  'v.v',
  'a.d',
  'o.g'
]

/** Titles, after which a sentence never ends. */
const TITLE = /^(dr|prof|st|fr|hr|dipl|ing|mag|nr|no)$/i

/** A text with markup is split after closing block tags instead, to keep its layout. */
const MARKUP = /<[a-z/][^>]*>/i
const MARKUP_CHUNKS =
  /[\s\S]*?(?:<\/(?:p|h[1-6]|div|li|tr|section|article|header|footer|td|table|ul|ol|blockquote|pre|hr)>|-->)\s*|[\s\S]+/g

/** Whether a text looks like HTML, which the sentence tools then leave in blocks. */
export function isMarkup(text: string): boolean {
  return text.includes('<') && text.includes('>') && MARKUP.test(text)
}

/**
 * Splits a text into sentences, each keeping its punctuation and the whitespace after it, so
 * that joined they give the text back. Abbreviations, titles, ordinals and initials do not end a
 * sentence unless the next word starts with a capital letter.
 */
export function splitIntoSentences(text: string): string[] {
  if (!text) return []
  if (isMarkup(text)) {
    const chunks = text.match(MARKUP_CHUNKS)
    return chunks && chunks.length > 0 ? chunks : [text]
  }

  const parts = text.match(/.*?([.!?]+(?:\s+|$))|.+$/gs) ?? []
  const result: string[] = []
  let buffer = ''
  parts.forEach((part, index) => {
    buffer += part
    const current = buffer.trim()
    const next = parts[index + 1] ?? ''
    const nextTrimmed = next.trim()
    const nextFirst = nextTrimmed.charAt(0)
    const nextUpper = !!nextFirst && /[A-ZÄÖÜ]/.test(nextFirst)

    const words = current.split(/\s+/)
    const lastPart = words[words.length - 1] ?? ''
    const lastWord = lastPart.toLowerCase().replace(/\.+$/, '')
    const secondLast =
      words.length > 1 ? (words[words.length - 2] ?? '').toLowerCase().replace(/\.+$/, '') : ''
    const nextWord = (nextTrimmed.split(/\s+/)[0] ?? '').replace(/\.+$/, '')
    const lookahead = `${lastWord}.${nextWord}`.replace(/\s/g, '').toLowerCase()

    let abbreviation =
      ABBREVIATIONS.includes(lastWord) ||
      ABBREVIATIONS.includes(lastPart.toLowerCase().replace(/[.]$/, ''))
    if (!abbreviation && lastWord.length === 1 && /[a-z]/i.test(lastWord)) abbreviation = true
    if (ABBREVIATIONS.includes(`${secondLast}.${lastWord}`.replace(/\s/g, ''))) abbreviation = true
    const digit = /^\d+$/.test(lastWord)
    if (digit) abbreviation = true

    let breaks = true
    if (ABBREVIATIONS.includes(lookahead) || lookahead === 'z.b') breaks = false
    else if (abbreviation) {
      if (TITLE.test(lastWord)) breaks = false
      else if (!nextUpper && next) breaks = false
      else if (digit && nextUpper && next.length > 1) breaks = false
    }

    if (breaks || !next) {
      result.push(buffer)
      buffer = ''
    }
  })
  if (buffer) result.push(buffer)
  return result.length > 0 ? result : [text.trim()]
}

/** A sentence as words, tags, links, punctuation and the whitespace between them. */
export function sentenceTokens(sentence: string): string[] {
  if (!sentence) return []
  return (
    sentence.match(
      /<!--[\s\S]*?-->|<[^>]+>|https?:\/\/[^\s<]+|[\wÄÖÜäöüß]+(?:[-.'][\wÄÖÜäöüß]+)*|[^\w\sÄÖÜäöüß<]+|\s+/g
    ) ?? []
  )
}

/** Share of words two sentences have in common (Jaccard over their words). */
export function similarity(a: string, b: string): number {
  if (a === b) return 1
  const wordsA = a.toLowerCase().split(/\s+/)
  const wordsB = b.toLowerCase().split(/\s+/)
  const setA = new Set(wordsA)
  let shared = 0
  for (const word of wordsB) if (setA.has(word)) shared++
  const union = wordsA.length + wordsB.length - shared
  return union === 0 ? 0 : shared / union
}

/**
 * Which sentence of `baselines` each of `sentences` comes from, `-1` for a sentence of its own
 * (one the user added). Aligned in order by the words they share; lists of equal length fall back
 * to pairing by position where nothing matched.
 */
export function sentenceMapping(
  sentences: readonly string[],
  baselines: readonly string[]
): number[] {
  if (baselines.length === 0) return sentences.map((_, index) => index)
  const n = sentences.length
  const m = baselines.length
  const score = (i: number, j: number): number => {
    const s = sentences[i - 1]!.trim()
    const b = baselines[j - 1]!.trim()
    return !s && !b ? 1 : !s || !b ? 0 : similarity(s, b)
  }
  const dp = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0))
  const choice = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0))
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const sim = score(i, j)
      let best = dp[i - 1]![j]!
      let direction = 2
      if (dp[i]![j - 1]! > best) {
        best = dp[i]![j - 1]!
        direction = 3
      }
      const match = sim > 0.2 ? dp[i - 1]![j - 1]! + sim : -1
      if (match >= best && match > dp[i - 1]![j - 1]!) {
        best = match
        direction = 1
      }
      dp[i]![j] = best
      choice[i]![j] = direction
    }
  }
  const mapping = new Array<number>(n).fill(-1)
  let i = n
  let j = m
  while (i > 0 && j > 0) {
    if (choice[i]![j] === 1) {
      if (score(i, j) > 0.2) mapping[i - 1] = j - 1
      i--
      j--
    } else if (choice[i]![j] === 2) i--
    else j--
  }
  if (n === m) {
    for (let k = 0; k < n; k++) if (mapping[k] === -1) mapping[k] = k
  }
  return mapping
}

/** Sentences that end with their punctuation: live editing sends a text once one more is done. */
export function completeSentenceCount(text: string): number {
  if (!text) return 0
  return splitIntoSentences(text).filter((sentence) => /[.!?]+(\s*['"»”]*\s*)$/.test(sentence))
    .length
}

/** `result` with the whitespace that followed `source` at its end, when the engine dropped it. */
export function withTrailingWhitespace(result: string, source: string): string {
  const trailing = /\s+$/.exec(source)?.[0] ?? ''
  return trailing && !result.endsWith(trailing) ? result.trimEnd() + trailing : result
}
