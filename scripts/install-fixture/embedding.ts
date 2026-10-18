/*
 * What a PDF that PDFKit wrote says about the files it embeds, read from
 * its bytes. The Node consumer has only the tarballs and what they depend
 * on, so no PDF reader -- the corpus's, which reads these PDFs in the
 * workspace (`readPdfObjects`, with pdf-lib), is never packed -- and Node
 * itself.
 *
 * It reads PDFKit's way of writing, and only that: every object's
 * dictionary as text and only a stream compressed, which node:zlib
 * inflates; no object stream, no cross-reference stream, no incremental
 * update, no encryption; a name tree as one /Names array; a file's name as
 * a literal string without escapes. Anything else it reads as absent, so
 * the consumer fails on a PDF it cannot read rather than passing it.
 */
import { createHash } from 'node:crypto'
import { inflateSync } from 'node:zlib'

/** An entry of the catalog's /AF array: its file specification's keys, and the stream it embeds. */
export interface AssociatedFile {
  readonly relationship: string | undefined
  /** /F and /UF. */
  readonly file: string | undefined
  readonly unicodeFile: string | undefined
  /** The name the /EmbeddedFiles name tree gives this file specification, if it names it. */
  readonly named: string | undefined
  /** The embedded stream's /Subtype, its #-escapes undone: the file's media type. */
  readonly mediaType: string | undefined
  /** The embedded stream's bytes, inflated. */
  readonly bytes: Uint8Array | undefined
}

export interface Embedding {
  /** The header's version: `1.7` for `%PDF-1.7`. */
  readonly version: string | undefined
  readonly associated: readonly AssociatedFile[]
  /** Every name in the /EmbeddedFiles name tree, whichever file specification it names. */
  readonly names: readonly string[]
  /** The catalog's /Metadata stream, as UTF-8: the XMP packet. */
  readonly xmp: string | undefined
  /** The SHA-256, in hex, of the profile each of the catalog's /OutputIntents names, inflated. */
  readonly outputProfiles: readonly string[]
}

type Ref = string

interface PdfObject {
  readonly dictionary: string
  readonly stream: Uint8Array | undefined
}

export function readEmbedding(pdf: Uint8Array): Embedding {
  // One character per byte, so that an index into the text is an offset into the bytes.
  const text = Buffer.from(pdf.buffer, pdf.byteOffset, pdf.byteLength).toString('latin1')
  const object = (ref: Ref | undefined): PdfObject => {
    const at = ref === undefined ? -1 : text.indexOf(`\n${ref} obj`)
    if (at === -1) return { dictionary: '', stream: undefined }
    // The dictionary ends at the `>>` before `stream` or `endobj`; one inside it closes before a key, as PDFKit writes them.
    const end = /\s>>\s*(stream\r?\n|endobj)/g
    end.lastIndex = at
    const found = end.exec(text)
    if (found === null) return { dictionary: '', stream: undefined }
    const dictionary = text.slice(text.indexOf('<<', at) + 2, found.index)
    const length = Number(/\/Length (\d+)/.exec(dictionary)?.[1])
    if (found[1] === 'endobj' || !Number.isSafeInteger(length)) return { dictionary, stream: undefined }
    const from = found.index + found[0].length
    const raw = pdf.subarray(from, from + length)
    return { dictionary, stream: /\/Filter\s*\/FlateDecode\b/.test(dictionary) ? new Uint8Array(inflateSync(raw)) : raw }
  }
  const ref = (dictionary: string, key: string): Ref | undefined => new RegExp(`${key}\\s+(\\d+ \\d+) R`).exec(dictionary)?.[1]
  const refs = (dictionary: string, key: string): Ref[] => [...(new RegExp(`${key}\\s*\\[([^\\]]*)\\]`).exec(dictionary)?.[1] ?? '').matchAll(/(\d+ \d+) R/g)].map((match) => match[1] ?? '')
  const name = (dictionary: string, key: string): string | undefined => new RegExp(`${key}\\s*/([^\\s/<>\\[\\]()]+)`).exec(dictionary)?.[1]?.replace(/#([0-9A-Fa-f]{2})/g, (_, hex: string) => String.fromCharCode(Number.parseInt(hex, 16)))
  const literal = (dictionary: string, key: string): string | undefined => new RegExp(`${key}\\s*\\(([^()\\\\]*)\\)`).exec(dictionary)?.[1]

  const trailer = text.slice(text.lastIndexOf('trailer'))
  const catalog = object(ref(trailer, '/Root')).dictionary
  const tree = /\/EmbeddedFiles\s*<<\s*\/Names\s*\[([^\]]*)\]/.exec(object(ref(catalog, '/Names')).dictionary)?.[1] ?? ''
  const entries = [...tree.matchAll(/\(([^()\\]*)\)\s*(\d+ \d+) R/g)].map((match) => ({ name: match[1] ?? '', ref: match[2] ?? '' }))
  const metadata = object(ref(catalog, '/Metadata')).stream
  return {
    version: /^%PDF-(\d\.\d)/.exec(text)?.[1],
    associated: refs(catalog, '/AF').map((spec) => {
      const { dictionary } = object(spec)
      const embedded = object(/\/EF\s*<<\s*\/F\s+(\d+ \d+) R/.exec(dictionary)?.[1])
      return {
        relationship: name(dictionary, '/AFRelationship'),
        file: literal(dictionary, '/F'),
        unicodeFile: literal(dictionary, '/UF'),
        named: entries.find((entry) => entry.ref === spec)?.name,
        mediaType: name(embedded.dictionary, '/Subtype'),
        bytes: embedded.stream,
      }
    }),
    names: entries.map((entry) => entry.name),
    xmp: metadata === undefined ? undefined : new TextDecoder().decode(metadata),
    outputProfiles: refs(catalog, '/OutputIntents').map((intent) => {
      const profile = object(ref(object(intent).dictionary, '/DestOutputProfile')).stream
      return profile === undefined ? '' : createHash('sha256').update(profile).digest('hex')
    }),
  }
}
