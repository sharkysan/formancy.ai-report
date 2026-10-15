/**
 * Where in its source an expression reads a path, for the editor to
 * underline.
 *
 * `@formancy/expressions` gives spans only on its errors, and a read of a
 * member nothing declares is caught here, before it compiles. It does
 * splice: its `rewritePath` replaces exactly the characters of each read,
 * verified by parsing the result again. So a read is where such a rewrite
 * put its replacement -- the real parser's answer, not a second one.
 */
import { rewritePath } from '@formancy/expressions'
import type { SourceSpan } from '@formancy/expressions'

const LETTERS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'

/** CEL's reserved words of two letters, which no identifier may be. */
const RESERVED = new Set(['as', 'if', 'in'])

/**
 * A name `source` does not contain anywhere, to mark each read with: one
 * letter, or two different ones. Absent from the source, no local of a
 * comprehension can capture it, and no text of the source can be taken
 * for it; two different letters cannot overlap themselves, so splitting on
 * the mark finds each one. A source of at most 1,024 characters has fewer
 * pairs than there are, so there is always one.
 */
function markFor(source: string): string {
  for (const letter of LETTERS) if (!source.includes(letter)) return letter
  for (const first of LETTERS) {
    for (const second of LETTERS) {
      const mark = `${first}${second}`
      if (first !== second && !RESERVED.has(mark) && !source.includes(mark)) return mark
    }
  }
  throw new RangeError('no two letters are absent from this expression; it is longer than any expression a report holds')
}

/**
 * The characters of `source` that read `path`, each read on its own,
 * half-open, in order. None when the source does not parse or does not
 * read the path.
 *
 * Each read is at least as long as the path written plainly -- an index or
 * spaces only add to it -- so when the reads together are exactly that
 * long, every read is written plainly and each one's place is known. When
 * one is not, the reads cannot be told apart by length, and one span from
 * the first read to the last covers them all.
 */
export function readSpans(source: string, path: string): SourceSpan[] {
  const mark = markFor(source)
  const rewritten = rewritePath(source, path, mark)
  if (!rewritten.ok || !rewritten.changed) return []
  const pieces = rewritten.source.split(mark)
  const reads = pieces.length - 1
  const between = pieces.reduce((length, piece) => length + piece.length, 0)
  if (source.length - between !== reads * path.length) {
    return [{ start: (pieces[0] as string).length, end: source.length - (pieces.at(-1) as string).length }]
  }
  const spans: SourceSpan[] = []
  let at = 0
  for (const piece of pieces.slice(0, -1)) {
    at += piece.length
    spans.push({ start: at, end: at + path.length })
    at += path.length
  }
  return spans
}
