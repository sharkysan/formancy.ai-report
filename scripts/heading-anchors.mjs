// The anchors GitHub gives a Markdown file's headings, decided once for
// every check here that follows a link into one: the architecture's guard
// (scripts/architecture.test.mjs, 0026), the getting-started guide's
// (scripts/getting-started.test.mjs, 0015) and the product pages' link
// check (apps/pages/src/checks/links.ts, 0021). Each kept its own copy
// until they were found to disagree about a heading with a link, a mark or
// an entity in it; a link one of them passed could be one GitHub lands at
// the top of the page.
//
// GitHub anchors a heading by the text it renders: a link as its words,
// code as its text, an image as nothing, an entity as its character. That
// text is lowercased, everything but letters, digits, marks, spaces,
// hyphens and underscores is dropped, and each space becomes a hyphen; an
// anchor already taken gets -1, -2. Markdown's own lexer finds the
// headings, so a line in a fenced block is no heading, and a heading
// underlined rather than marked, inside a list or a quote, is one.
//
// apps/pages/scripts/inputs.mjs derives the anchor of the changelog's one
// release heading for the pages' build without a Markdown parser; the pages'
// link check holds what it derives to this.

import { lexer } from 'marked'

/** Every token of a Markdown document, depth first: lists, quotes and table cells included. */
function* tokensOf(tokens) {
  for (const token of tokens ?? []) {
    yield token
    yield* tokensOf(token.tokens)
    yield* tokensOf(token.items)
    if (token.type === 'table') {
      for (const cell of token.header) yield* tokensOf(cell.tokens)
      for (const row of token.rows) for (const cell of row) yield* tokensOf(cell.tokens)
    }
  }
}

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'" }

/** A heading's inline tokens as the text GitHub renders: a link as its words, code as its text, an image as nothing. */
function renderedText(tokens) {
  return tokens
    .map((token) => {
      if (token.type === 'image' || token.type === 'html' || token.type === 'br') return ''
      if (token.tokens !== undefined && token.tokens.length > 0) return renderedText(token.tokens)
      return token.text ?? ''
    })
    .join('')
    .replaceAll(/&(amp|lt|gt|quot|#39);/g, (_, name) => ENTITIES[name])
}

/**
 * The anchors GitHub gives the headings of `markdown`, in document order.
 *
 * @param {string} markdown
 * @returns {Set<string>}
 */
export function headingAnchors(markdown) {
  const anchors = new Set()
  const taken = new Map()
  for (const token of tokensOf(lexer(markdown.replaceAll('\r\n', '\n')))) {
    if (token.type !== 'heading') continue
    const base = renderedText(token.tokens)
      .toLowerCase()
      .replaceAll(/[^\p{L}\p{N}\p{M}\s_-]/gu, '')
      .replaceAll(/\s/g, '-')
    const count = taken.get(base) ?? 0
    taken.set(base, count + 1)
    anchors.add(count === 0 ? base : `${base}-${String(count)}`)
  }
  return anchors
}
