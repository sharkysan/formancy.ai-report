import { describe, expect, test } from 'vitest'
import { MAX_DOCUMENT_BYTES, MAX_DOCUMENT_NESTING, MAX_DOCUMENT_INFLATED, MAX_DOCUMENT_OBJECTS, MAX_DOCUMENT_PAGES } from './limits.js'
import { AT_A_BOUND } from './parse-test-support.js'
import { readDocument, type DocumentRead } from './read.js'
import { refusal } from './refusals.js'
import { manyPages, nestedArrays } from './test-hostile.js'
import { deflatedZeros, hybridOf, objectsListed, ofBytes, onePage, withObject5 } from './test-pdf.js'

/**
 * Each bound a host may state, held where a host meets it, at
 * `readDocument`: a document exactly at the bound reads, whole, and one
 * past it is refused by the bound's own code, so that a bound that moved,
 * or a count that slipped by one, fails here. What each costs at the bound
 * and one past it is `limits.ts`'s to say, measured.
 */

/** How many pages `bytes` read to, failing the test where they are refused. */
function pagesRead(bytes: Uint8Array): number {
  const read = readDocument(bytes)
  if (!read.ok) throw new Error(`refused: ${read.message}`)
  return read.document.pages.length
}

/** A refusal as it is, and anything read as only that it read: a failing assertion's diff would print every stream of a document at a bound. */
const outcome = (read: DocumentRead): unknown => (read.ok ? 'read whole' : read)

describe('a document at each bound reads, and one past it is refused', () => {
  // A host states the page bound to the person who adds a PDF; a reader
  // that refused at it, or read one page past it, would make that sentence
  // false either way.
  test('a document at MAX_DOCUMENT_PAGES reads and one page more is refused as too-many-pages', AT_A_BOUND, () => {
    expect(pagesRead(manyPages(MAX_DOCUMENT_PAGES))).toBe(MAX_DOCUMENT_PAGES)
    expect(outcome(readDocument(manyPages(MAX_DOCUMENT_PAGES + 1)))).toEqual(refusal('pages'))
  })

  // The byte bound is a host's upload limit too: a file of exactly it is
  // read, and one byte more is refused for its size whatever its bytes
  // are -- the header broken, it is still too large and not not-pdf, so
  // nothing of it was parsed.
  test('a document of MAX_DOCUMENT_BYTES reads and one byte more is refused as too-large, before a byte is parsed', AT_A_BOUND, () => {
    expect(pagesRead(ofBytes(MAX_DOCUMENT_BYTES))).toBe(1)
    const past = ofBytes(MAX_DOCUMENT_BYTES + 1)
    expect(outcome(readDocument(past))).toEqual(refusal('bytes'))
    past[0] = 0
    expect(outcome(readDocument(past))).toEqual(refusal('bytes'))
    // A subclass's length may say less than it holds: what the reader's copy holds is held to the bound too.
    class Short extends Uint8Array {
      override get length(): number {
        return 0
      }
    }
    expect(outcome(readDocument(new Short(ofBytes(MAX_DOCUMENT_BYTES + 1))))).toEqual(refusal('bytes'))
  })

  // Every object a file defines is counted as it is read: a count that
  // began at 0 where it should begin at 1, or compared with >= for >,
  // would refuse a file at the bound or read one past it.
  test('a document of MAX_DOCUMENT_OBJECTS objects reads and one object more is refused as too-many-objects', AT_A_BOUND, () => {
    expect(pagesRead(objectsListed(MAX_DOCUMENT_OBJECTS))).toBe(1)
    expect(outcome(readDocument(objectsListed(MAX_DOCUMENT_OBJECTS + 1)))).toEqual(refusal('objects'))
  })

  // What a document's streams decode to is held to one budget, every
  // stream together: a page whose content inflates to exactly it reads,
  // and one byte more is refused on the page that holds it.
  test('a document whose content inflates to MAX_DOCUMENT_INFLATED reads and one byte more is refused as inflates-too-far', AT_A_BOUND, () => {
    expect(pagesRead(onePage({ content: deflatedZeros(MAX_DOCUMENT_INFLATED), contentDict: '/Filter/FlateDecode' }))).toBe(1)
    expect(outcome(readDocument(onePage({ content: deflatedZeros(MAX_DOCUMENT_INFLATED + 1), contentDict: '/Filter/FlateDecode' })))).toEqual(
      refusal('inflated', 1),
    )
  })

  // Nesting is counted as it is read, before the stack is in question:
  // arrays nested exactly the bound deep read, one level more is refused.
  test('a document nested MAX_DOCUMENT_NESTING deep reads and one level more is refused as too-deep', () => {
    expect(pagesRead(withObject5(nestedArrays(MAX_DOCUMENT_NESTING)))).toBe(1)
    expect(outcome(readDocument(withObject5(nestedArrays(MAX_DOCUMENT_NESTING + 1))))).toEqual(refusal('depth'))
  })

  // A hybrid file lists every object twice, in its classic table and in
  // the stream its /XRefStm names, each with the free head of the list:
  // a file of MAX_DOCUMENT_OBJECTS objects claims 2 x (MAX_DOCUMENT_OBJECTS
  // + 1) entries. A bound of twice the objects alone refused that file,
  // within every other bound; one entry more anywhere -- here a section
  // nothing chains -- is refused.
  test('a hybrid file of MAX_DOCUMENT_OBJECTS objects, each listed twice, reads and one entry more is refused as too-many-objects', AT_A_BOUND, () => {
    expect(pagesRead(hybridOf(MAX_DOCUMENT_OBJECTS))).toBe(1)
    expect(outcome(readDocument(hybridOf(MAX_DOCUMENT_OBJECTS, 'xref\n0 1\n0000000000 65535 f \ntrailer\n<</Size 1>>\n')))).toEqual(refusal('xref-claim'))
  })
})
