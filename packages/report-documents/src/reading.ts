import { PDFContext } from '@pdfme/pdf-lib'
import { MAX_DOCUMENT_NAME_BYTES, MAX_DOCUMENT_STRING_LENGTH, MAX_DOCUMENT_VALUES } from './limits.js'
import type { PdfDict, PdfName, PdfRef, PdfString, PdfValue } from './model.js'
import { refuse } from './refusals.js'

/**
 * What one document's parse holds as it reads, and the values it makes:
 * its counts against the bounds, its names and references each held once,
 * and its strings' bytes held together -- what every grammar over the
 * file's bytes, its object streams and its inline images shares
 * (grammar.ts), apart from the syntax they are read by.
 */

/** The bytes of every empty string: an array of none, which nothing can change, shared by every document. */
const EMPTY = new Uint8Array(0)

/** The size of a chunk the document's decoded strings are held in: a string of the bound, `MAX_DOCUMENT_STRING_LENGTH`, fits one whole. */
const CHUNK = 64 * 1024

export class Name implements PdfName {
  readonly name: string

  constructor(name: string) {
    this.name = name
  }
}

export class Reference implements PdfRef {
  readonly object: number

  constructor(object: number) {
    this.object = object
  }
}

export class Bytes implements PdfString {
  readonly bytes: Uint8Array

  constructor(bytes: Uint8Array) {
    this.bytes = bytes
  }
}

export class Dict implements PdfDict {
  readonly entries: ReadonlyMap<string, PdfValue>

  constructor(entries: ReadonlyMap<string, PdfValue>) {
    this.entries = entries
  }
}

/**
 * What one document's parse has made so far, which every grammar over its
 * bytes and its object streams shares: its counts, its names, and its
 * references, each held once.
 */
export class Reading {
  readonly context = PDFContext.create()
  private values = 0
  private nameBytes = 0
  private readonly names = new Map<string, Name>()
  /** References by object number, where they name generation 0, as almost every reference does; by number and generation where not. */
  private readonly refs = new Map<number, Reference>()
  private readonly otherRefs = new Map<string, Reference>()
  /** The reference to object 0, which no definition is (`parse.ts` refuses one): what a number no object can have names. */
  private readonly nowhere = new Reference(0)
  /** The generation a reference names, where it is not 0; every other reference names 0. */
  readonly generations = new Map<PdfRef, number>()
  /** Where a string that does not read as written -- escaped, or hexadecimal -- is decoded, before its bytes are held (`decoded`). */
  readonly scratch = new Uint8Array(MAX_DOCUMENT_STRING_LENGTH + 1)
  private chunk = EMPTY
  private used = 0

  /** `values` more counted against `MAX_DOCUMENT_VALUES`: a value, or what a costlier read is counted as. */
  counted(values = 1): void {
    this.values += values
    if (this.values > MAX_DOCUMENT_VALUES) refuse('values')
  }

  /**
   * The first `length` bytes of `scratch`, held with the document's other
   * decoded strings, each a view of a chunk of them -- never a buffer of its
   * own, which costs a string 248 bytes of heap however short -- and the
   * chunks no more than twice what they hold, since a string fits one whole.
   */
  decoded(length: number): Uint8Array {
    if (length === 0) return EMPTY
    if (this.used + length > this.chunk.length) {
      this.chunk = new Uint8Array(CHUNK)
      this.used = 0
    }
    const bytes = this.chunk.subarray(this.used, this.used + length)
    bytes.set(this.scratch.subarray(0, length))
    this.used += length
    return bytes
  }

  /** The document's one name of this written form, its decoded bytes counted the first time it is met. */
  name(written: string, length: number): Name {
    const known = this.names.get(written)
    if (known !== undefined) return known
    this.nameBytes += length
    if (this.nameBytes > MAX_DOCUMENT_NAME_BYTES) refuse('name-bytes')
    const made = new Name(written)
    this.names.set(written, made)
    return made
  }

  /**
   * The document's one reference to an object at a generation: a whole
   * object number, a generation from 0 to 65,535. An object number no file
   * can define -- below 1, or past what a number holds exactly, as a writer
   * that wraps a negative one through 2^64 writes it -- names no object, as
   * a reference to any object a file does not hold names none (ISO 32000-1
   * 7.3.10): the one reference to object 0, which no definition is, however
   * many such numbers the file writes. A fraction would name an object to a
   * reader that rounded it, and is refused.
   */
  ref(object: number, generation: number): Reference {
    if (!Number.isInteger(object) || !Number.isInteger(generation) || generation < 0 || generation > 65_535) refuse('reference')
    if (object < 1 || !Number.isSafeInteger(object)) return this.nowhere
    const known = generation === 0 ? this.refs.get(object) : this.otherRefs.get(`${object} ${generation}`)
    if (known !== undefined) return known
    const made = new Reference(object)
    if (generation === 0) this.refs.set(object, made)
    else {
      this.otherRefs.set(`${object} ${generation}`, made)
      this.generations.set(made, generation)
    }
    return made
  }
}
