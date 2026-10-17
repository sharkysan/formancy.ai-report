// XML, read for the e-invoice gate (0027): each tool's report, and the
// schematrons the pinned tools run. One reader, strict and namespace-aware:
// an element is known by its namespace URI and local name, never by the
// prefix a tool happened to write, and a document that is not well formed
// throws rather than reading as an empty report.
//
// The parser is saxes 6.0.0 (ISC), the corpus's own dependency, resolved
// from packages/report-corpus as that package resolves it: the gate runs
// after `pnpm install`, as the corpus's tests do, and the repository's root
// manifest declares nothing for it. It expands no external entity and
// fetches nothing; a DOCTYPE is refused outright, since no output the gate
// reads has one.

import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const repo = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const { SaxesParser } = createRequire(join(repo, 'packages', 'report-corpus', 'package.json'))('saxes')

/**
 * `text` parsed: its root element as
 * `{ uri, local, name, attributes: [{ uri, local, name, value }], children, text }`,
 * where `text` is the element's own character data, references and CDATA
 * resolved, and `children` its elements in order.
 */
export function readXml(text) {
  const open = []
  let root
  const parser = new SaxesParser({ xmlns: true })
  parser.on('error', (error) => {
    throw error
  })
  parser.on('doctype', () => {
    throw new Error('a DOCTYPE, which no output the gate reads has')
  })
  parser.on('opentag', (tag) => {
    const element = {
      uri: tag.uri,
      local: tag.local,
      name: tag.name,
      attributes: Object.values(tag.attributes).map((entry) => ({ uri: entry.uri, local: entry.local, name: entry.name, value: entry.value })),
      children: [],
      text: '',
    }
    const parent = open.at(-1)
    if (parent === undefined) root = element
    else parent.children.push(element)
    open.push(element)
  })
  const append = (chunk) => {
    const element = open.at(-1)
    // Outside the root there is only white space, which is nobody's text.
    if (element !== undefined) element.text += chunk
  }
  parser.on('text', append)
  parser.on('cdata', append)
  parser.on('closetag', () => {
    open.pop()
  })
  // saxes refuses a document with no root element.
  parser.write(String(text)).close()
  return root
}

/** The value of `element`'s attribute `local` in namespace `uri` (none by default), or undefined. */
export const attribute = (element, local, uri = '') => element?.attributes.find((entry) => entry.local === local && entry.uri === uri)?.value

/** `element`'s own text. */
export const textOf = (element) => element?.text

/** `element`'s child elements named `local` in namespace `uri`. */
export const childrenOf = (element, uri, local) => (element?.children ?? []).filter((child) => child.uri === uri && child.local === local)

/** `element`'s first child element named `local` in namespace `uri`, or undefined. */
export const childOf = (element, uri, local) => childrenOf(element, uri, local)[0]

/** Every element below `element` named `local` in namespace `uri`, in document order. */
export function descendants(element, uri, local) {
  const found = []
  const walk = (at) => {
    for (const child of at.children) {
      if (child.uri === uri && child.local === local) found.push(child)
      walk(child)
    }
  }
  walk(element)
  return found
}

/**
 * Every element below `element` named `local` in namespace `uri`, each with
 * the elements above it, nearest last: `[{ element, ancestors }]`.
 */
export function descendantsWithAncestors(element, uri, local) {
  const found = []
  const walk = (at, above) => {
    for (const child of at.children) {
      if (child.uri === uri && child.local === local) found.push({ element: child, ancestors: [...above, at] })
      walk(child, [...above, at])
    }
  }
  walk(element, [])
  return found
}
