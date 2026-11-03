import { describe, expect, test } from 'vitest'
import { MAX_DOCUMENT_PAGES } from './limits.js'
import { expectRefused, parsed } from './parse-test-support.js'
import { manyPages } from './test-hostile.js'
import { CONTENT, PdfWriter } from './test-pdf.js'

/**
 * The page tree, walked from the catalog by its /Kids, each node once:
 * which pages a document has, in order, or why it has no such list. The
 * parse's tests hold the spike's three hostile trees (H7); these hold the
 * rest of what makes a tree a tree.
 */

/** A file of catalog 1, naming `root` as its page tree, content stream 4, and `objects` as written. */
function tree(objects: Readonly<Record<number, string>>, root = '2 0 R'): Uint8Array {
  const w = new PdfWriter()
  w.object(1, `<</Type/Catalog/Pages ${root}>>`)
  w.stream(4, '', CONTENT)
  for (const [num, body] of Object.entries(objects)) w.object(Number(num), body)
  return w.end(w.xref('/Root 1 0 R'))
}

const page = (parent: number): string => `<</Type/Page/Parent ${parent} 0 R/MediaBox[0 0 612 792]/Resources<<>>/Contents 4 0 R>>`

describe('the page tree reads', () => {
  // Pages print in the tree's order, left to right through every node:
  // a walk that took a node's pages before its earlier siblings', or
  // followed /Kids and /Count only where written directly, would print
  // them in another order, or not at all.
  test('its pages in order, through nodes, its /Kids and /Count by reference or not', () => {
    const file = tree({
      2: '<</Type/Pages/Kids[10 0 R 3 0 R 12 0 R]/Count 4>>',
      10: '<</Type/Pages/Parent 2 0 R/Kids 20 0 R/Count 21 0 R>>',
      20: '[11 0 R 13 0 R]',
      21: '2',
      11: page(10),
      13: page(10),
      3: page(2),
      12: page(2),
    })
    expect(parsed(file).pages).toEqual([11, 13, 3, 12])
  })

  // A document of no pages prints nothing; the reader reports none, and
  // what is done with that is the caller's.
  test('a tree of no pages, as an empty list', () => {
    expect(parsed(tree({ 2: '<</Type/Pages/Kids[]/Count 0>>' })).pages).toEqual([])
  })

  // The bound refuses the page past it, not the page at it: a document of
  // exactly MAX_DOCUMENT_PAGES pages prints whole.
  test(`${MAX_DOCUMENT_PAGES} pages, the bound`, () => {
    expect(parsed(manyPages(MAX_DOCUMENT_PAGES)).pages).toHaveLength(MAX_DOCUMENT_PAGES)
  })
})

describe('the page tree is refused', () => {
  // Each page past the bound would be laid out, and each one counted in a
  // report's page numbers: refused the moment the walk reaches it.
  test('more pages than MAX_DOCUMENT_PAGES', () => {
    expectRefused(manyPages(MAX_DOCUMENT_PAGES + 1), 'too-many-pages', 'pages')
  })

  // A catalog whose /Pages is written in place, names a page, or names
  // nothing has no tree to walk: read as one, it would print nothing, or
  // one page as if it were all of them.
  test('a catalog that names no page tree, or names a page as one', () => {
    expectRefused(tree({ 2: '<</Type/Pages/Kids[3 0 R]/Count 1>>', 3: page(2) }, '<<>>'), 'page-tree', 'pages-root')
    expectRefused(tree({ 2: '<</Type/Pages/Kids[3 0 R]/Count 1>>', 3: page(2) }, '3 0 R'), 'page-tree', 'pages-root')
    expectRefused(tree({ 2: '<</Type/Pages/Kids[3 0 R]/Count 1>>', 3: page(2) }, '9 0 R'), 'page-tree', 'pages-root')
  })

  // Kids named by a reference to an object that is no array, or to no object,
  // are no list a walk can follow.
  test('a node whose kids are not an array', () => {
    expectRefused(tree({ 2: '<</Type/Pages/Kids 3 0 R/Count 1>>', 3: page(2) }), 'page-tree', 'pages-kids')
    expectRefused(tree({ 2: '<</Type/Pages/Kids 9 0 R/Count 1>>', 3: page(2) }), 'page-tree', 'pages-kids')
  })

  // A kid written in place, a kid that is a number, and a kid of no page
  // type are each read one way by one viewer and another by the next.
  test('a kid that is neither a page nor a node', () => {
    expectRefused(tree({ 2: `<</Type/Pages/Kids[${page(2)}]/Count 1>>` }), 'page-tree', 'pages-kid')
    expectRefused(tree({ 2: '<</Type/Pages/Kids[3 0 R]/Count 1>>', 3: '7' }), 'page-tree', 'pages-kid')
    expectRefused(tree({ 2: '<</Type/Pages/Kids[3 0 R]/Count 1>>', 3: '<</Type/Template/Parent 2 0 R>>' }), 'page-tree', 'pages-kid')
  })

  // A page's /Parent is what a viewer climbs for the attributes it
  // inherits; one that names another node inherits another node's box and
  // resources.
  test('a page or a node whose /Parent is not the node that holds it', () => {
    expectRefused(tree({ 2: '<</Type/Pages/Kids[3 0 R]/Count 1>>', 3: page(1) }), 'page-tree', 'pages-parent')
    expectRefused(tree({ 2: '<</Type/Pages/Kids[3 0 R]/Count 1>>', 3: '<</Type/Page/Contents 4 0 R>>' }), 'page-tree', 'pages-parent')
  })

  // One page named twice by the tree would print twice.
  test('a page the tree reaches twice', () => {
    expectRefused(tree({ 2: '<</Type/Pages/Kids[3 0 R 3 0 R]/Count 2>>', 3: page(2) }), 'page-tree', 'pages-twice')
  })
})
