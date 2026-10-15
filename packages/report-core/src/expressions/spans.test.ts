import { describe, expect, test } from 'vitest'
import { readSpans } from './spans.js'

/** The text each span covers. */
const covered = (source: string, path: string): string[] => readSpans(source, path).map(({ start, end }) => source.slice(start, end))

describe('readSpans', () => {
  // The editor underlines what is wrong; for a name the expression reads,
  // that is the read itself, however it is written.
  test.each([
    ['a dotted read', 'params.nope == true', 'params.nope', 'params.nope'],
    ['a read after other text', 'size(header.x) > 0', 'header.x', 'header.x'],
    ['an index read', 'row["nope"] > 1', 'row.nope', 'row["nope"]'],
    ['a read with spaces', 'row . nope > 1', 'row.nope', 'row . nope'],
    ['a member ending in an underscore', 'row.amount_ > 1', 'row.amount_', 'row.amount_'],
    ['a member ending in a digit', 'row.line0 > 1', 'row.line0', 'row.line0'],
    ['a read inside has()', 'has(params.x)', 'params.x', 'params.x'],
    ['a name read whole', 'size(params) > 0', 'params', 'params'],
    ['a read next to a comprehension local', '[1].map(a, row.x)', 'row.x', 'row.x'],
  ])('covers %s exactly', (_name, source, path, text) => {
    expect(covered(source, path)).toEqual([text])
  })

  // Each read is underlined where it is, so a diagnostic about the second
  // does not cover the unrelated text between them.
  test('covers each read of the path on its own', () => {
    expect(readSpans('row.x > 1 && row.sku == "a" && row.x < 3', 'row.x')).toEqual([
      { start: 0, end: 5 },
      { start: 31, end: 36 },
    ])
    expect(covered('group.a + group.b', 'group')).toEqual(['group', 'group'])
  })

  // Where one read is written with more than the path's own characters --
  // an index, spaces -- the reads cannot be told apart by length, and one
  // stretch from the first to the last covers them all.
  test('covers reads it cannot tell apart as one stretch, from the first to the last', () => {
    expect(covered('row["x"] > 1 && row.x < 3', 'row.x')).toEqual(['row["x"] > 1 && row.x'])
  })

  // The splice marks each read with a name the source does not contain, so
  // no local can capture it and no text of the source can be taken for it;
  // a source that holds every letter still has such a name.
  test('finds the reads in a source that holds every letter', () => {
    const source = '"abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ" == row.x && row.x != "q"'
    expect(readSpans(source, 'row.x').map(({ start, end }) => source.slice(start, end))).toEqual(['row.x', 'row.x'])
  })

  // Only a source far past the format's bound on an expression's length
  // holds every pair of letters; one that did would leave nothing to mark a
  // read with, and is refused rather than misread.
  test('throws a RangeError for a source that holds every pair of letters', () => {
    const letters = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'
    const pairs = [...letters].flatMap((first) => [...letters].map((second) => `${first}${second}`)).join(' ')
    expect(() => readSpans(`"${pairs}" == row.x`, 'row.x')).toThrow(RangeError)
  })

  // A path written only inside a string is not read, and has no span.
  test.each([
    ['only inside a string', '"row.x" == params.y', 'row.x'],
    ['that does not parse', 'row.x ==', 'row.x'],
  ])('is empty for a path %s', (_name, source, path) => {
    expect(readSpans(source, path)).toEqual([])
  })
})
