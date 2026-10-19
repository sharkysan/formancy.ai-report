import { createHash } from 'node:crypto'
import { decodePDFRawStream, PDFArray, PDFDict, PDFDocument, PDFHexString, PDFName, PDFNumber, PDFRawStream, PDFRef, PDFString, type PDFContext, type PDFObject } from '@pdfme/pdf-lib'

/**
 * The objects a PDF/A-3 with an embedded invoice is proved on, read by a
 * second reader: @pdfme/pdf-lib 6.2.4, which shares no code with the pdfkit
 * that writes a report, nor with the PDF.js that `readPdf` reads its pages
 * with. What a page shows is `readPdf`'s; what the file says of itself --
 * its version, its information dictionary, its XMP, the files it embeds and
 * where it names them, its output intent -- is read here, object by object,
 * as the PDF holds it, and so are its images: each image object, soft
 * masks among them, by its number.
 *
 * Every key is read as the type ISO 32000-1 gives it, and a key of another
 * type throws (pdf-lib's `lookupMaybe`), so that a name written as a string,
 * or a dictionary where a stream belongs, fails a test rather than reading
 * as absent. Streams are inflated through their /Filter; names and strings
 * are decoded as text, but a checksum, which is bytes.
 */

export interface PdfObjects {
  /** The version the header states: `1.7` for `%PDF-1.7`. */
  readonly version: string
  /** The trailer's /ID, its strings in lower-case hexadecimal; undefined where the trailer has none. */
  readonly id: readonly string[] | undefined
  /** The information dictionary's entries that are strings, decoded, by key: `Title`, `Producer`, `CreationDate` ... */
  readonly info: Readonly<Record<string, string>>
  /** The catalog's /Metadata stream; undefined where the catalog has none. */
  readonly metadata: PdfMetadata | undefined
  /** The catalog's /AF: every file associated with the document as a whole, in the array's order. */
  readonly associatedFiles: readonly PdfFileSpecification[]
  /** The catalog's /Names /EmbeddedFiles tree: every name, in its order, and the file specification it names. */
  readonly embeddedFiles: readonly PdfNamedFile[]
  /** The catalog's /OutputIntents, in order. */
  readonly outputIntents: readonly PdfOutputIntent[]
  /** Every image object the file holds, soft masks among them, in the order of their numbers. */
  readonly images: readonly PdfImage[]
}

export interface PdfImage {
  /** The object's number. */
  readonly object: number
  /** /Width and /Height, in samples. */
  readonly width: number
  readonly height: number
  /** The number of the image object /SMask refers to, the image's soft mask; undefined where it has none. */
  readonly softMask: number | undefined
}

export interface PdfMetadata {
  /** /Type and /Subtype: `Metadata` and `XML` in a metadata stream. */
  readonly type: string | undefined
  readonly subtype: string | undefined
  /** The packet, inflated where the stream is filtered and decoded as UTF-8, a byte order mark kept; bytes that are not UTF-8 throw. */
  readonly xmp: string
}

export interface PdfFileSpecification {
  /** /Type: `Filespec`. */
  readonly type: string | undefined
  /** /AFRelationship, a name: `Alternative`, `Data`, `Source` ... */
  readonly relationship: string | undefined
  readonly f: string | undefined
  readonly uf: string | undefined
  /** /Desc. */
  readonly description: string | undefined
  /** The stream /EF /F holds; undefined where the specification embeds no file. */
  readonly embedded: PdfEmbeddedFile | undefined
}

export interface PdfEmbeddedFile {
  /** /Type: `EmbeddedFile`. */
  readonly type: string | undefined
  /** /Subtype, the media type, its `#2F` decoded: `text/xml`. */
  readonly subtype: string | undefined
  /** /Params; undefined where the stream has none. */
  readonly params: PdfFileParams | undefined
  /** The file, inflated. */
  readonly bytes: Uint8Array
}

export interface PdfFileParams {
  /** /CreationDate and /ModDate, as written: `D:20261015080000Z`. */
  readonly creationDate: string | undefined
  readonly modDate: string | undefined
  readonly size: number | undefined
  /** /CheckSum's bytes, as the string holds them. ISO 32000-1 asks for the MD5's 16 bytes. */
  readonly checkSum: Uint8Array | undefined
}

export interface PdfNamedFile {
  readonly name: string
  /** Where in `associatedFiles` the specification it names is, as the same object; -1 where it is none of them. */
  readonly associated: number
  readonly specification: PdfFileSpecification
}

export interface PdfOutputIntent {
  /** /Type: `OutputIntent`. */
  readonly type: string | undefined
  /** /S: `GTS_PDFA1` for PDF/A. */
  readonly s: string | undefined
  readonly outputConditionIdentifier: string | undefined
  readonly info: string | undefined
  readonly registryName: string | undefined
  /** /DestOutputProfile: its /N, the number of colour components, and its bytes, inflated; undefined where the intent has none. */
  readonly profile: { readonly n: number | undefined; readonly bytes: Uint8Array } | undefined
}

const key = (name: string): PDFName => PDFName.of(name)

/**
 * Reads `bytes` as a PDF's objects; rejects when they are not a PDF, when it
 * is encrypted -- its strings and streams would read as ciphertext, and
 * PDF/A forbids /Encrypt, so a PDF this reads has none -- and where it
 * holds what this reader does not read whole.
 */
export async function readPdfObjects(bytes: Uint8Array): Promise<PdfObjects> {
  // Encryption is refused by pdf-lib's own load (EncryptedPDFError). The
  // Info dictionary is read as written, not as pdf-lib would update it.
  // An object pdf-lib cannot parse throws, rather than standing in as an
  // invalid one.
  const document = await PDFDocument.load(bytes, { updateMetadata: false, throwOnInvalidObject: true })
  const { context, catalog } = document
  const associated = dictionariesIn(catalog.lookupMaybe(key('AF'), PDFArray))
  const embeddedFiles = namedSpecifications(catalog).map(({ name, specification }) => ({ name, associated: associated.indexOf(specification), specification: fileSpecification(specification) }))
  const trailerId = context.lookup(context.trailerInfo.ID)
  // pdf-lib gives the header back as it parsed it: `%PDF-1.7`, then a line of binary characters.
  const header = context.header.toString()
  return {
    version: header.slice('%PDF-'.length, header.indexOf('\n')),
    id: trailerId instanceof PDFArray ? trailerId.asArray().map((_, index) => hex(trailerId.lookup(index, PDFString, PDFHexString).asBytes())) : undefined,
    info: information(context.lookup(context.trailerInfo.Info)),
    metadata: metadataOf(streamAt(catalog, 'Metadata')),
    associatedFiles: associated.map(fileSpecification),
    embeddedFiles,
    outputIntents: dictionariesIn(catalog.lookupMaybe(key('OutputIntents'), PDFArray)).map(outputIntent),
    images: imagesIn(context),
  }
}

/** A stream whose /Subtype is /Image: an image object, as ISO 32000-1, 8.9.5, gives one. */
const isImage = (object: PDFObject | undefined): object is PDFRawStream => object instanceof PDFRawStream && object.dict.get(key('Subtype')) === key('Image')

/**
 * Every image object, by number, wherever it stands: one no page draws is
 * still in the file. /SMask, where there is one, is a stream, so a
 * reference, and to an image (ISO 32000-1, 11.6.5.3): anything else names
 * no mask and is refused.
 */
function imagesIn(context: PDFContext): PdfImage[] {
  return context
    .enumerateIndirectObjects()
    .filter(([, object]) => isImage(object))
    .map(([ref, object]) => {
      const { dict } = object as PDFRawStream
      const mask = dict.get(key('SMask'))
      if (mask !== undefined && !(mask instanceof PDFRef && isImage(context.lookup(mask)))) throw new Error(`the /SMask of image ${String(ref.objectNumber)} is not a reference to an image`)
      return { object: ref.objectNumber, width: dict.lookup(key('Width'), PDFNumber).asNumber(), height: dict.lookup(key('Height'), PDFNumber).asNumber(), softMask: mask?.objectNumber }
    })
    .sort((a, b) => a.object - b.object)
}

/** Every entry of `array`, each a dictionary, references resolved: the same object for the same reference. */
function dictionariesIn(array: PDFArray | undefined): PDFDict[] {
  return array === undefined ? [] : array.asArray().map((_, index) => array.lookup(index, PDFDict))
}

const hex = (bytes: Uint8Array): string => Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')

function text(dict: PDFDict, name: string): string | undefined {
  return dict.lookupMaybe(key(name), PDFString, PDFHexString)?.decodeText()
}

function nameOf(dict: PDFDict, name: string): string | undefined {
  return dict.lookupMaybe(key(name), PDFName)?.decodeText()
}

/** The information dictionary's strings by key; its other entries, such as /Trapped's name, are not text and are left out. */
function information(info: PDFObject | undefined): Record<string, string> {
  if (!(info instanceof PDFDict)) return {}
  const read: Record<string, string> = {}
  for (const name of info.keys()) {
    const value = info.lookup(name)
    if (value instanceof PDFString || value instanceof PDFHexString) read[name.decodeText()] = value.decodeText()
  }
  return read
}

/** The stream `dict` holds at `name`, as pdf-lib parses every stream: raw, its /Filter not yet applied. */
function streamAt(dict: PDFDict, name: string): PDFRawStream | undefined {
  const value = dict.lookup(key(name))
  if (value === undefined || value instanceof PDFRawStream) return value
  throw new Error(`/${name} is not a stream`)
}

const inflated = (stream: PDFRawStream): Uint8Array => decodePDFRawStream(stream).decode()

function metadataOf(stream: PDFRawStream | undefined): PdfMetadata | undefined {
  if (stream === undefined) return undefined
  return { type: nameOf(stream.dict, 'Type'), subtype: nameOf(stream.dict, 'Subtype'), xmp: new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(inflated(stream)) }
}

function fileSpecification(specification: PDFDict): PdfFileSpecification {
  const files = specification.lookupMaybe(key('EF'), PDFDict)
  const stream = files === undefined ? undefined : streamAt(files, 'F')
  return {
    type: nameOf(specification, 'Type'),
    relationship: nameOf(specification, 'AFRelationship'),
    f: text(specification, 'F'),
    uf: text(specification, 'UF'),
    description: text(specification, 'Desc'),
    embedded: stream === undefined ? undefined : embeddedFile(stream),
  }
}

function embeddedFile(stream: PDFRawStream): PdfEmbeddedFile {
  const params = stream.dict.lookupMaybe(key('Params'), PDFDict)
  return {
    type: nameOf(stream.dict, 'Type'),
    subtype: nameOf(stream.dict, 'Subtype'),
    params:
      params === undefined
        ? undefined
        : {
            creationDate: text(params, 'CreationDate'),
            modDate: text(params, 'ModDate'),
            size: params.lookupMaybe(key('Size'), PDFNumber)?.asNumber(),
            checkSum: params.lookupMaybe(key('CheckSum'), PDFString, PDFHexString)?.asBytes(),
          },
    bytes: inflated(stream),
  }
}

/**
 * The /EmbeddedFiles tree's names and the specifications they name, from a
 * tree that is one node: pdfkit writes no /Kids (pdfkit.js 6227-6234), and a
 * tree read only at its top would leave out every file below it, so one
 * with /Kids is refused. A node holds /Kids or /Names (ISO 32000-1, 7.9.6),
 * so one without /Names is refused too, by pdf-lib's typed lookup, as is a
 * name paired with nothing.
 */
function namedSpecifications(catalog: PDFDict): { name: string; specification: PDFDict }[] {
  const tree = catalog.lookupMaybe(key('Names'), PDFDict)?.lookupMaybe(key('EmbeddedFiles'), PDFDict)
  if (tree === undefined) return []
  if (tree.has(key('Kids'))) throw new Error('the /EmbeddedFiles name tree has /Kids, which this reader does not walk')
  const names = tree.lookup(key('Names'), PDFArray)
  const named: { name: string; specification: PDFDict }[] = []
  for (let index = 0; index < names.size(); index += 2) named.push({ name: names.lookup(index, PDFString, PDFHexString).decodeText(), specification: names.lookup(index + 1, PDFDict) })
  return named
}

function outputIntent(intent: PDFDict): PdfOutputIntent {
  const profile = streamAt(intent, 'DestOutputProfile')
  return {
    type: nameOf(intent, 'Type'),
    s: nameOf(intent, 'S'),
    outputConditionIdentifier: text(intent, 'OutputConditionIdentifier'),
    info: text(intent, 'Info'),
    registryName: text(intent, 'RegistryName'),
    profile: profile === undefined ? undefined : { n: profile.dict.lookupMaybe(key('N'), PDFNumber)?.asNumber(), bytes: inflated(profile) },
  }
}

/**
 * The hexadecimal SHA-256 of `bytes`, a PDF, read as its objects with every
 * stream inflated: what a PDF is held to where its bytes may differ but
 * its document may not. pdfkit deflates every stream with the zlib it runs
 * on -- Node's, or the one pdfmake's browser build carries -- and two
 * builds of zlib may write one stream in different bytes; what a stream
 * inflates to is the same whoever deflated it, and so is every object
 * around it but for the stream's /Length, and the offsets the
 * cross-reference table gives, which follow the lengths. So the digest
 * reads the version the header states, the trailer's /Root, /Info and
 * /ID, and each object as pdf-lib parses it, in the order of its number,
 * each stream's dictionary without its /Length and its contents inflated
 * through its /Filter, but a JPEG's, which PDFKit copies in as it is and
 * is read so; and nothing else of the file. A file pdf-lib cannot
 * parse, an object it cannot parse and an encrypted file reject, as
 * `readPdfObjects` does. The e-invoice gate records each PDF it judged by
 * it, and the renderer's browser test holds its two entries to one.
 */
export async function inflatedDigest(bytes: Uint8Array): Promise<string> {
  const document = await PDFDocument.load(bytes, { updateMetadata: false, throwOnInvalidObject: true })
  const { context } = document
  const hash = createHash('sha256')
  const { Root, Info, ID } = context.trailerInfo
  // The header as pdf-lib parsed it is the version, then a line of binary characters of its own.
  const header = context.header.toString()
  hash.update(`${header.slice(0, header.indexOf('\n'))}\ntrailer /Root ${String(Root)} /Info ${String(Info)} /ID ${String(ID)}\n`)
  for (const [ref, object] of context.enumerateIndirectObjects()) {
    hash.update(`${ref.toString()} obj\n`)
    if (object instanceof PDFRawStream) {
      const dict = object.dict.clone(context)
      dict.delete(key('Length'))
      hash.update(`${dict.toString()}\nstream\n`)
      // A JPEG is copied in whole, as DCTDecode, which pdf-lib does not decode and no zlib wrote.
      hash.update(object.dict.get(key('Filter')) === key('DCTDecode') ? object.getContents() : inflated(object))
    } else hash.update(object.toString())
    hash.update('\nendobj\n')
  }
  return hash.digest('hex')
}
