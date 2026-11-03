import { Deflate } from 'pako'
import { expect } from 'vitest'
import { closureOf } from './closure.js'
import type { PdfStream, PdfValue } from './model.js'
import { pagesOf, type PrintablePage } from './pages.js'
import { parseDocument, type ParsedDocument } from './parse.js'
import { refusal, type DocumentRefusal, type DocumentRefusalCode, type Finding } from './refusals.js'
import { basic, CONTENT, latin1, MIB, PdfWriter, type XrefEntry } from './test-pdf.js'

/**
 * What the pages' and the closure's tests write and assert, once: files of
 * pages written object by object, and a file printed as `readDocument`
 * will print it -- parsed, its pages read, and the closure of what they
 * draw with -- or refused, naming the page where the refusal belongs to
 * one. Never published: nothing in `index.ts` exports it.
 */

/** An object as a file writes it: a value, or a stream's dictionary entries, its /Length aside, and its data. */
export type Body = string | { readonly dict: string; readonly data: Uint8Array }

/** A file of `objects` as written, catalog 1 its root, under a classic cross-reference. */
export function fileOf(objects: Readonly<Record<number, Body>>): Uint8Array {
  const w = new PdfWriter()
  for (const [num, body] of Object.entries(objects)) {
    if (typeof body === 'string') w.object(Number(num), body)
    else w.stream(Number(num), body.dict, body.data)
  }
  return w.end(w.xref('/Root 1 0 R'))
}

/** A page under node `parent` holding `entries` and nothing else it could inherit. */
export const leaf = (entries: string, parent = 2): string => `<</Type/Page/Parent ${parent} 0 R${entries}>>`

/** A US Letter page under the root, drawing content 4 with `resources`, `entries` after. */
export const letter = (entries = '', resources = '<<>>'): string => leaf(`/MediaBox[0 0 612 792]/Resources ${resources}/Contents 4 0 R${entries}`)

/**
 * A file of catalog 1, the page tree 2 of `pages` -- objects 10, 11, … in
 * order -- content 4, a line with no text, and `objects` as written, which
 * may write any of them again; `catalog` is written into the catalog.
 */
export function pagesFile(pages: readonly string[], objects: Readonly<Record<number, Body>> = {}, catalog = ''): Uint8Array {
  const kids = pages.map((_, i) => `${10 + i} 0 R`).join(' ')
  return fileOf({
    1: `<</Type/Catalog/Pages 2 0 R${catalog}>>`,
    2: `<</Type/Pages/Kids[${kids}]/Count ${pages.length}>>`,
    4: { dict: '', data: CONTENT },
    ...Object.fromEntries(pages.map((body, i) => [10 + i, body])),
    ...objects,
  })
}

/** A file read as `readDocument` will read it: parsed, its pages, and the closure of what every page draws with. */
export interface Printed {
  readonly parsed: ParsedDocument
  readonly pages: readonly PrintablePage[]
  readonly closure: ReadonlyMap<number, PdfValue | PdfStream>
}

/** What a page draws with, which the closure is taken from: its resources, and its transparency group where it has one. */
export const rootsOf = (pages: readonly PrintablePage[]): PdfValue[] =>
  pages.flatMap((page) => (page.group === undefined ? [page.resources] : [page.resources, page.group]))

/** `bytes` parsed, their pages read and the closure of every page's resources and group taken, or the first refusal. */
export function printed(bytes: Uint8Array): Printed | DocumentRefusal {
  const parsed = parseDocument(bytes)
  if ('ok' in parsed) return parsed
  const pages = pagesOf(parsed)
  if ('ok' in pages) return pages
  const closure = closureOf(parsed, rootsOf(pages))
  if ('ok' in closure) return closure
  return { parsed, pages, closure }
}

/** What `bytes` print, failing the test where they are refused. */
export function printedWhole(bytes: Uint8Array): Printed {
  const result = printed(bytes)
  if ('ok' in result) throw new Error(`refused: ${result.message}`)
  return result
}

/** The pages `bytes` print, failing the test where they are refused. */
export const pagesRead = (bytes: Uint8Array): readonly PrintablePage[] => printedWhole(bytes).pages

/**
 * That `bytes` are refused as `code`, for what `finding` says, on `page`
 * where one is given: the finding's words, then where `page` is given the
 * reader's own count of the page, then the code's advice, and nothing of
 * the file.
 */
export function expectPrintRefused(bytes: Uint8Array, code: DocumentRefusalCode, finding: Finding, page?: number): void {
  const result = printed(bytes)
  expect(result).toEqual(refusal(finding, page))
  expect(result).toMatchObject({ ok: false, code })
  const message = (result as DocumentRefusal).message
  if (page !== undefined) expect(message).toContain(`, on page ${page};`)
  expect(message.replace(`, on page ${page};`, ';')).toMatch(/^[A-Za-z ,;'-]+$/)
}

/**
 * `pages` pages under a chain of `nodes` nodes of one kid each below the
 * root, the root holding the box and the resources every page inherits:
 * what a climb up /Parent from each page would pay `pages` times `nodes`
 * for. Objects 1 to 3 are the catalog, the root and the content, so that
 * the file holds `nodes + pages + 3` objects numbered from 1 without a gap.
 * Written as `manyPages` writes its pages, a line at a time.
 */
export function underAChain(nodes: number, pages: number): Uint8Array {
  const w = new PdfWriter()
  w.object(1, '<</Type/Catalog/Pages 2 0 R>>')
  w.object(2, `<</Type/Pages/Kids[4 0 R]/Count ${pages}/MediaBox[0 0 612 792]/Resources<<>>>>`)
  w.stream(3, '', CONTENT)
  const bottom = 3 + nodes
  const lines: string[] = []
  let at = w.length
  const put = (num: number, body: string): void => {
    const line = `${num} 0 obj\n${body}\nendobj\n`
    w.offsets.set(num, at)
    at += line.length
    lines.push(line)
  }
  const leaves = Array.from({ length: pages }, (_, i) => `${bottom + 1 + i} 0 R`).join(' ')
  for (let num = 4; num <= bottom; num += 1) {
    put(num, `<</Type/Pages/Parent ${num === 4 ? 2 : num - 1} 0 R/Kids[${num < bottom ? `${num + 1} 0 R` : leaves}]/Count ${pages}>>`)
  }
  for (let i = 1; i <= pages; i += 1) put(bottom + i, `<</Type/Page/Parent ${bottom} 0 R/Contents 3 0 R>>`)
  w.raw(lines.join(''))
  return w.end(w.xref('/Root 1 0 R'))
}

/**
 * Object 1 to 4 drawing `content`, deflated, and an object stream, 6, of
 * object 5 -- which the page names, so that the parse reads it -- followed
 * by `mebibytes` of zeros nothing reads: what the parse inflates, and so
 * takes from the document's budget, before a page is read.
 */
export function spentByObjectStream(mebibytes: number, content: Uint8Array): Uint8Array {
  const w = new PdfWriter()
  basic(w, { page: '/Probe 5 0 R', content, contentDict: '/Filter/FlateDecode' })
  const deflater = new Deflate({ level: 1 })
  deflater.push(latin1('5 0\n<</A 1>>\n'), false)
  const chunk = new Uint8Array(MIB)
  for (let i = 0; i < mebibytes; i += 1) deflater.push(chunk, false)
  deflater.push(new Uint8Array(0), true)
  w.stream(6, '/Type/ObjStm/N 1/First 4/Filter/FlateDecode', deflater.result)
  const entries = new Map<number, XrefEntry>([...w.offsets].map(([num, offset]) => [num, { kind: 'at', offset }]))
  entries.set(5, { kind: 'in', stream: 6, index: 0 })
  return w.end(w.xrefStream(7, '/Root 1 0 R', entries))
}
