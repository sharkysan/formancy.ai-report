import { describe, expect, test } from 'vitest'
import { headingAnchors } from './heading-anchors.mjs'

/**
 * The one reading of GitHub's heading anchors that the architecture's
 * guard, the getting-started guide's and the product pages' link check
 * share (scripts/heading-anchors.mjs). Each case is a heading the copies it
 * replaced read differently; read wrongly, a link to it passes while GitHub
 * lands the reader at the top of the page, or fails while GitHub finds it.
 */
describe('headingAnchors', () => {
  // A section's number loses its dot, and code keeps its text: the shapes
  // the architecture's own headings take.
  test('reads a numbered heading and one in code', () => {
    expect([...headingAnchors('# 8. Cross-cutting concepts\n\n## 8.2 Refusals\n\n## `@formancy/report-spec` (L0)\n')]).toEqual([
      '8-cross-cutting-concepts',
      '82-refusals',
      'formancyreport-spec-l0',
    ])
  })

  // The getting-started guide's copy read a heading's source, so a link in
  // one read as "linkxmd"; the pages' kept "&amp;" as "amp". GitHub reads
  // the words a reader sees: the link's words, "&" dropped like any sign.
  test('reads a link as its words and an entity as its character', () => {
    expect([...headingAnchors('## A [link](x.md) — and &amp; more\n\n## *Stressed, with a [link](x.md) inside*\n')]).toEqual(['a-link--and--more', 'stressed-with-a-link-inside'])
  })

  // The guide's copy dropped combining marks, so a heading written with a
  // decomposed "ö" lost its letter there and kept it on GitHub.
  test('keeps letters, digits, marks, hyphens and underscores, and nothing else', () => {
    expect([...headingAnchors('## Grösse_und Breite: 12 mm!\n')]).toEqual(['grösse_und-breite-12-mm'])
  })

  // The second of two equal headings is -1 on GitHub; a code block's "#"
  // line is code; a heading underlined rather than marked is a heading.
  test('numbers a repeated heading, reads no code, and reads an underlined heading', () => {
    const markdown = ['## Same', '', '## Same', '', '```bash', '# not a heading', '```', '', 'Underlined', '----------', ''].join('\n')
    expect([...headingAnchors(markdown)]).toEqual(['same', 'same-1', 'underlined'])
  })

  // A file checked out with CRLF line ends is the same document.
  test('reads CRLF as LF', () => {
    expect([...headingAnchors('# One\r\n\r\n## Two\r\n')]).toEqual(['one', 'two'])
  })
})
