import { MAX_DOCUMENT_PAGES } from './limits.js'
import { isArray, isDict, isName, isRef, resolved, type PdfDict, type PdfObjects, type PdfValue } from './model.js'
import { refuse } from './refusals.js'

/**
 * The page tree, walked from the catalog by its /Kids without recursion,
 * each node once: its pages in order, or why it is not a tree. pdf-lib
 * recurses around a /Kids or /Parent cycle until the stack ends and never
 * reads /Count; here every kid's /Parent is the node whose /Kids holds it,
 * the root has none, every /Count is the pages counted under its node, and
 * the page past `MAX_DOCUMENT_PAGES` is refused the moment the walk reaches
 * it. Once it is walked, a climb up any page's /Parent ends at the root.
 */

interface Node {
  readonly object: number
  readonly dict: PdfDict
  readonly kids: readonly PdfValue[]
  next: number
  pages: number
}

function node(objects: PdfObjects, object: number, dict: PdfDict): Node {
  const kids = resolved(objects, dict.entries.get('Kids'))
  if (!isArray(kids)) refuse('pages-kids')
  return { object, dict, kids, next: 0, pages: 0 }
}

/** The object numbers of a document's pages, in the order they print. */
export function pageTree(objects: PdfObjects, catalog: PdfDict): readonly number[] {
  const root = catalog.entries.get('Pages')
  const rootDict = isRef(root) ? objects.get(root.object) : undefined
  if (!isRef(root) || !isDict(rootDict) || !isName(rootDict.entries.get('Type'), 'Pages')) refuse('pages-root')
  if (rootDict.entries.has('Parent')) refuse('pages-root-parent')
  const visited = new Set<number>([root.object])
  const pages: number[] = []
  const stack: Node[] = [node(objects, root.object, rootDict)]
  for (let top = stack.at(-1); top !== undefined; top = stack.at(-1)) {
    const kid = top.kids[top.next]
    if (kid === undefined) {
      stack.pop()
      if (resolved(objects, top.dict.entries.get('Count')) !== top.pages) refuse('pages-count')
      const parent = stack.at(-1)
      if (parent !== undefined) parent.pages += top.pages
      continue
    }
    top.next += 1
    if (!isRef(kid)) refuse('pages-kid')
    if (visited.has(kid.object)) refuse('pages-twice')
    visited.add(kid.object)
    const dict = objects.get(kid.object)
    if (!isDict(dict)) refuse('pages-kid')
    const parent = dict.entries.get('Parent')
    if (!isRef(parent) || parent.object !== top.object) refuse('pages-parent')
    const type = dict.entries.get('Type')
    if (isName(type, 'Pages')) stack.push(node(objects, kid.object, dict))
    else if (isName(type, 'Page')) {
      top.pages += 1
      pages.push(kid.object)
      if (pages.length > MAX_DOCUMENT_PAGES) refuse('pages')
    } else refuse('pages-kid')
  }
  return pages
}
