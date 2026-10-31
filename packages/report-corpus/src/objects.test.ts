import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { deflateSync } from 'node:zlib'
import { PDFDocument, PDFName, type PDFObject, type PDFRef, PDFString } from '@pdfme/pdf-lib'
import { getDocument, VerbosityLevel } from 'pdfjs-dist/legacy/build/pdf.mjs'
import type { TDocumentDefinitions } from 'pdfmake/interfaces.js'
import { describe, expect, test } from 'vitest'
import { IMAGE_KINDS } from './image-kinds.js'
import { inflatedDigest, readPdfObjects } from './objects.js'
import { readPdf } from './read-pdf.js'
import { exactBuffer, pdfmakePdf, type PdfKitDocument } from './testing/pdfmake.js'

/**
 * The objects a PDF/A-3 with an embedded invoice is proved on, read by
 * pdf-lib, which is not the pdfkit that wrote them, from PDFs pdfkit
 * writes here: through pdfmake's `getStream`, between layout and `end`,
 * where the renderer embeds a file and appends XMP.
 */

/** pdfmake's options for a PDF/A-3b: without the version pdfkit writes no XMP (pdfkit.js 6070). */
const PDFA: TDocumentDefinitions = { version: '1.7', subset: 'PDF/A-3b', content: [{ text: 'PDF/A' }] }

/** Not well-formed on purpose, outside ASCII and with a CR: a file is bytes, and comes back as them. */
const XML = '<?xml version="1.0" encoding="UTF-8"?>\r\n<Rechnung>Grüße, 12,50 €</Rechnung>\n'
const xml = new TextEncoder().encode(XML)
const CREATED = new Date('2026-10-15T08:00:00Z')
const MODIFIED = new Date('2026-10-16T09:30:00Z')

/** `bytes` embedded as a Factur-X invoice embeds its XML (pdfkit.js 5160-5244). */
const embed =
  (bytes: Uint8Array, name = 'factur-x.xml', hidden = false) =>
  (document: PdfKitDocument): void => {
    document.file(exactBuffer(bytes), {
      name,
      type: 'text/xml',
      relationship: 'Alternative',
      description: 'invoice data',
      creationDate: CREATED,
      modifiedDate: MODIFIED,
      hidden,
    })
  }

/** The file pdfkit reads its ICC profile from: its own `data` folder, beside the build Node loads (pdfkit.js 5265). */
function pdfkitProfile(): Uint8Array {
  const pdfkit = createRequire(createRequire(import.meta.url).resolve('pdfmake')).resolve('pdfkit')
  return new Uint8Array(readFileSync(path.join(path.dirname(pdfkit), 'data', 'sRGB_IEC61966_2_1.icc')))
}

describe('readPdfObjects', () => {
  // pdfmake's plain render -- what every report but an e-invoice still is
  // -- has no /AF, no name tree, no output intent and, at PDF 1.3, no XMP.
  // A reader that answered "no file" for a PDF it had failed to look into
  // would hold an e-invoice to nothing; this one reads that nothing from a
  // PDF that has it, and the information dictionary beside it.
  test('reads a PDF that embeds no file as embedding none, with no XMP and no output intent', async () => {
    const objects = await readPdfObjects(await pdfmakePdf({ content: [{ text: 'plain' }] }))
    expect(objects).toMatchObject({ version: '1.3', metadata: undefined, associatedFiles: [], embeddedFiles: [], outputIntents: [] })
    expect(objects.info).toEqual({ Title: 'corpus test', Producer: 'pdfmake', Creator: 'pdfmake', CreationDate: 'D:20260101000000Z' })
  })

  // Factur-X wants the file on the catalog's /AF, related as Alternative,
  // named in /F and /UF, its stream typed text/xml with a /Params holding
  // at least /ModDate [S] (0031). A reader that took the keys from the wrong
  // dictionary -- the specification's for the stream's, or the creation
  // date for the modification date -- or handed back the stream still
  // deflated, would let a renderer that wrote any of them wrong pass.
  test('reads the file pdfkit embeds where pdfkit put it: the catalog /AF, the specification, the stream, the bytes inflated', async () => {
    const objects = await readPdfObjects(await pdfmakePdf(PDFA, embed(xml)))
    expect(objects.version).toBe('1.7')
    expect(objects.associatedFiles).toEqual([
      {
        type: 'Filespec',
        relationship: 'Alternative',
        f: 'factur-x.xml',
        uf: 'factur-x.xml',
        description: 'invoice data',
        embedded: {
          type: 'EmbeddedFile',
          subtype: 'text/xml',
          // pdfkit writes the MD5 as 32 hexadecimal digits, where ISO 32000-1 asks for its 16 bytes (pdfkit.js 5205): read as the string holds it.
          params: {
            creationDate: 'D:20261015080000Z',
            modDate: 'D:20261016093000Z',
            size: xml.byteLength,
            checkSum: new TextEncoder().encode(createHash('md5').update(xml).digest('hex')),
          },
          bytes: xml,
        },
      },
    ])
  })

  // The name tree is where PDF.js and most viewers find a file; /AF is
  // where PDF/A-3 and Factur-X want it. Read apart, a file named in one and
  // missing from the other would look whole. And the bytes are read twice,
  // by two readers that share no code, so that one reader's misreading
  // cannot pass as the file's content.
  test('names the file in /Names /EmbeddedFiles by the specification /AF holds, and PDF.js reads the same bytes there', async () => {
    const bytes = await pdfmakePdf(PDFA, embed(xml))
    const objects = await readPdfObjects(bytes)
    expect(objects.embeddedFiles).toEqual([{ name: 'factur-x.xml', associated: 0, specification: objects.associatedFiles[0] }])
    const { attachments } = await readPdf(bytes)
    expect(attachments.map(({ name }) => name)).toEqual(['factur-x.xml'])
    expect(attachments[0]!.bytes).toEqual(objects.associatedFiles[0]!.embedded!.bytes)
    expect(attachments[0]!.bytes).toEqual(xml)
  })

  // A hidden file stays on /AF and leaves the name tree (pdfkit.js
  // 5235-5242), so PDF.js, which reads only the tree, never sees it. A
  // second invoice embedded so would be invisible to a test that asked
  // PDF.js alone how many files the PDF carries. Embedded first, it also
  // shows that a name is tied to its own place on /AF, not to the first.
  test('reads a file on /AF that no name names, which PDF.js does not see', async () => {
    const bytes = await pdfmakePdf(PDFA, (document) => {
      embed(new TextEncoder().encode('second'), 'hidden.xml', true)(document)
      embed(xml)(document)
    })
    const objects = await readPdfObjects(bytes)
    expect(objects.associatedFiles.map(({ f }) => f)).toEqual(['hidden.xml', 'factur-x.xml'])
    expect(objects.embeddedFiles.map(({ name, associated }) => [name, associated])).toEqual([['factur-x.xml', 1]])
    expect((await readPdf(bytes)).attachments.map(({ name }) => name)).toEqual(['factur-x.xml'])
  })

  // What pdfkit never writes, built object by object: a specification
  // that names a file outside the PDF, a stream with no /Subtype and no
  // /Params, a named file on no /AF, an output intent that names a
  // registry and carries no profile, an information dictionary with a
  // name in it, a trailer with no /ID and no /Info. An invoice referred to
  // so is not in the PDF at all, a stream without /Params has no /ModDate
  // [S], and a file on no /AF is not associated, as PDF/A-3 wants it
  // (6.8-4): each reads as absent, in both readers where both read it,
  // rather than as an empty file or as the keys pdfkit would have written.
  test('reads what pdfkit never writes as absent: no embedded file, no /Params, no profile, no /ID', async () => {
    const document = await PDFDocument.create({ updateMetadata: false })
    document.addPage()
    const { context, catalog } = document
    const elsewhere = context.register(
      context.obj({ Type: 'Filespec', AFRelationship: 'Alternative', F: PDFString.of('elsewhere.xml'), UF: PDFString.of('elsewhere.xml') }),
    )
    const bare = context.register(
      context.obj({ Type: 'Filespec', F: PDFString.of('bare.xml'), EF: { F: context.register(context.stream('<a/>', { Type: 'EmbeddedFile' })) } }),
    )
    catalog.set(PDFName.of('AF'), context.obj([elsewhere, bare]))
    const unlisted = context.register(context.obj({ Type: 'Filespec', F: PDFString.of('unlisted.xml') }))
    catalog.set(
      PDFName.of('Names'),
      context.obj({ EmbeddedFiles: { Names: [PDFString.of('elsewhere.xml'), elsewhere, PDFString.of('unlisted.xml'), unlisted] } }),
    )
    catalog.set(
      PDFName.of('OutputIntents'),
      context.obj([
        { Type: 'OutputIntent', S: 'GTS_PDFA1', OutputConditionIdentifier: PDFString.of('FOGRA39'), RegistryName: PDFString.of('http://www.color.org') },
      ]),
    )
    const bytes = await document.save()
    const objects = await readPdfObjects(bytes)
    expect(objects.associatedFiles).toEqual([
      { type: 'Filespec', relationship: 'Alternative', f: 'elsewhere.xml', uf: 'elsewhere.xml', description: undefined, embedded: undefined },
      {
        type: 'Filespec',
        relationship: undefined,
        f: 'bare.xml',
        uf: undefined,
        description: undefined,
        embedded: { type: 'EmbeddedFile', subtype: undefined, params: undefined, bytes: new TextEncoder().encode('<a/>') },
      },
    ])
    expect(objects.embeddedFiles.map(({ name, associated }) => [name, associated])).toEqual([
      ['elsewhere.xml', 0],
      ['unlisted.xml', -1],
    ])
    expect(objects.outputIntents).toEqual([
      { type: 'OutputIntent', s: 'GTS_PDFA1', outputConditionIdentifier: 'FOGRA39', info: undefined, registryName: 'http://www.color.org', profile: undefined },
    ])
    expect([objects.id, objects.info]).toEqual([undefined, {}])
    expect((await readPdf(bytes)).attachments).toEqual([
      { name: 'elsewhere.xml', description: '', bytes: undefined },
      { name: 'unlisted.xml', description: '', bytes: undefined },
    ])
    // A name in the information dictionary is not text, and is left out of `info`.
    context.trailerInfo.Info = context.register(context.obj({ Title: PDFString.of('built'), Trapped: 'False' }))
    expect((await readPdfObjects(await document.save())).info).toEqual({ Title: 'built' })
  })

  // PDF/A wants one output intent whose profile describes the colours the
  // page uses; the renderer's digest test holds the profile's bytes to a
  // reviewed file through both of its entries. That holds only if the
  // bytes read here are the profile, inflated, and not the deflated stream.
  test('reads the output intent pdfkit writes, its profile byte for byte the file pdfkit read', async () => {
    const objects = await readPdfObjects(await pdfmakePdf(PDFA))
    expect(objects.outputIntents).toEqual([
      {
        type: 'OutputIntent',
        s: 'GTS_PDFA1',
        outputConditionIdentifier: 'sRGB IEC61966-2.1',
        info: 'sRGB IEC61966-2.1',
        registryName: undefined,
        profile: { n: 3, bytes: pdfkitProfile() },
      },
    ])
  })

  // A soft mask is an image object of its own, which PDFKit numbers once
  // its image's pixels are decoded, and the renderer holds those numbers
  // to the order of the images they mask (0035). A reader that took a
  // mask for no image, missed a JPEG, or read a number off the wrong
  // object would let any order pass. Read here from a PDF of a PNG with an
  // alpha channel, one without and a JPEG: four image objects in the order
  // of their numbers, the one mask named by its image, and the number
  // held to what the image's dictionary says as PDFKit wrote it.
  test('reads every image object by its number and size, and the soft mask each names by its number', async () => {
    const kinds = ['png-rgba', 'png-rgb', 'jpeg-colour'].map((id) => IMAGE_KINDS.find((each) => each.id === id)!)
    const images = Object.fromEntries(kinds.map((asset) => [asset.id, `data:${asset.mediaType};base64,${Buffer.from(asset.bytes).toString('base64')}`]))
    const bytes = await pdfmakePdf({ content: kinds.map((asset) => ({ image: asset.id, width: 32 })), images })
    const read = (await readPdfObjects(bytes)).images
    expect(read.map(({ width, height }) => [width, height]).sort()).toEqual([
      [16, 16],
      [16, 16],
      [16, 16],
      [8, 8],
    ])
    expect(read.map(({ object }) => object)).toEqual(read.map(({ object }) => object).sort((a, b) => a - b))
    const masked = read.filter(({ softMask }) => softMask !== undefined)
    expect(masked).toHaveLength(1)
    expect(read.find(({ object }) => object === masked[0]!.softMask)).toMatchObject({ width: 16, height: 16, softMask: undefined })
    expect(Buffer.from(bytes).toString('latin1')).toContain(`/SMask ${String(masked[0]!.softMask)} 0 R`)
  })

  // The XMP is where PDF/A and Factur-X identify the file, and what is
  // appended to it is the renderer's. Read as the stream holds it -- not
  // as PDF.js's metadata, which parses the packet its own way -- a packet
  // that is not well-formed reaches the strict XMP reader and fails there.
  test('reads the XMP as its stream holds it, with what was appended in it', async () => {
    const appended = '<rdf:Description rdf:about="" xmlns:ct="urn:formancy:corpus:test#"><ct:Version>1.0</ct:Version></rdf:Description>'
    const objects = await readPdfObjects(await pdfmakePdf(PDFA, (document) => document.appendXML(appended)))
    expect(objects.metadata).toMatchObject({ type: 'Metadata', subtype: 'XML' })
    expect(objects.metadata!.xmp.startsWith('<?xpacket begin="\uFEFF" id="W5M0MpCehiHzreSzNTczkc9d"?>')).toBe(true)
    expect(objects.metadata!.xmp).toContain(appended)
  })

  // Text outside ASCII goes into the information dictionary as UTF-16
  // (`PDFObject.convert`, pdfkit.js 119-134), and the trailer's /ID is the
  // MD5 of that dictionary, written twice (`generateFileID`, 607-616, and
  // 6322): two documents with one title and one creation date share one.
  // Both are read here as text and bytes, and the /ID is held to PDF.js's
  // first fingerprint, its reading of the same string -- PDF.js gives the
  // second as null where it is the first -- so that a test of either
  // rests on the file, not on pdfkit's account of it.
  test('reads the information dictionary as text and the trailer /ID as PDF.js reads it', async () => {
    const title = 'Rechnung Müller & Söhne <AG>'
    const bytes = await pdfmakePdf({ content: [{ text: 'plain' }], info: { title } })
    const objects = await readPdfObjects(bytes)
    expect(objects.info['Title']).toBe(title)
    const task = getDocument({ data: new Uint8Array(bytes), verbosity: VerbosityLevel.ERRORS })
    try {
      expect((await task.promise).fingerprints).toEqual([objects.id![0], null])
    } finally {
      await task.destroy()
    }
    expect(objects.id).toEqual([expect.stringMatching(/^[0-9a-f]{32}$/), objects.id![0]])
  })

  // A key of another type than ISO 32000-1 gives it -- XMP in a
  // dictionary, a relationship written as a string -- is a defect, and
  // read as absent it would pass a test that the key is missing for the
  // wrong reason, or fail one for a reason it does not name.
  test('refuses a key of another type than the PDF format gives it', async () => {
    const built = async (build: (document: PDFDocument) => void): Promise<Uint8Array> => {
      const document = await PDFDocument.create({ updateMetadata: false })
      document.addPage()
      build(document)
      return document.save()
    }
    const metadata = await built(({ catalog, context }) => catalog.set(PDFName.of('Metadata'), context.obj({ Type: 'Metadata', Subtype: 'XML' })))
    await expect(readPdfObjects(metadata)).rejects.toThrow('/Metadata is not a stream')
    const relationship = await built(({ catalog, context }) =>
      catalog.set(PDFName.of('AF'), context.obj([context.obj({ Type: 'Filespec', AFRelationship: PDFString.of('Alternative') })])),
    )
    await expect(readPdfObjects(relationship)).rejects.toThrow(/PDFName/)
    // An image's /SMask is a stream, so a reference to one; a name there, or a reference to what is no image, names no mask.
    const image = (document: PDFDocument, softMask: PDFObject): PDFRef =>
      document.context.register(document.context.stream(new Uint8Array([0]), { Type: 'XObject', Subtype: 'Image', Width: 1, Height: 1, SMask: softMask }))
    const named = await built((document) => image(document, PDFName.of('Mask')))
    await expect(readPdfObjects(named)).rejects.toThrow(/\/SMask of image \d+ is not a reference to an image/)
    const dictionary = await built((document) => image(document, document.context.register(document.context.obj({ Type: 'XObject' }))))
    await expect(readPdfObjects(dictionary)).rejects.toThrow(/\/SMask of image \d+ is not a reference to an image/)
    const sizeless = await built(({ context }) => context.register(context.stream(new Uint8Array([0]), { Subtype: 'Image', Width: 1 })))
    await expect(readPdfObjects(sizeless)).rejects.toThrow(/PDFNumber/)
  })

  // The packet is text a strict XML reader reads next, and PDF/A wants it
  // UTF-8 (veraPDF 6.6.2.1-2). Decoded leniently, a byte that is no UTF-8
  // would read as U+FFFD, and a test of the XMP would pass on characters
  // the PDF does not hold; so such a packet is refused.
  test('refuses an XMP packet that is not UTF-8', async () => {
    const document = await PDFDocument.create({ updateMetadata: false })
    document.addPage()
    const { context, catalog } = document
    const packet = Uint8Array.from([
      ...new TextEncoder().encode('<x:xmpmeta xmlns:x="adobe:ns:meta/">'),
      0xff,
      0xfe,
      ...new TextEncoder().encode('</x:xmpmeta>'),
    ])
    catalog.set(PDFName.of('Metadata'), context.register(context.stream(packet, { Type: 'Metadata', Subtype: 'XML' })))
    await expect(readPdfObjects(await document.save())).rejects.toThrow(/utf-8/i)
  })

  // pdf-lib, left to itself, keeps an object it cannot parse as an
  // invalid one and reads on (`throwOnInvalidObject`): a PDF damaged where
  // this reader does not look would read as whole. It is refused, wherever
  // the object stands -- here one the catalog does not even refer to.
  test('refuses an object pdf-lib cannot parse, wherever it stands', async () => {
    const document = await PDFDocument.create({ updateMetadata: false })
    document.addPage()
    document.context.register(document.context.obj({ Type: 'Filespec', F: PDFString.of('damaged.xml') }))
    const text = Buffer.from(await document.save({ useObjectStreams: false })).toString('latin1')
    const damaged = text.replace('/Type /Filespec', ') Type /Filespec')
    expect(damaged).not.toBe(text)
    await expect(readPdfObjects(new Uint8Array(Buffer.from(damaged, 'latin1')))).rejects.toThrow()
  })

  // PDF/A forbids /Encrypt, and the strings and streams of an encrypted
  // PDF read as its cipher wrote them: a reader that went on would compare
  // a test's values with ciphertext. So an encrypted PDF is refused, and a
  // PDF this reader reads has no /Encrypt.
  test('refuses an encrypted PDF', async () => {
    await expect(readPdfObjects(await pdfmakePdf({ content: [{ text: 'secret' }], userPassword: 'secret' }))).rejects.toThrow(/encrypted/)
  })

  // A name tree may split into /Kids. pdfkit writes none, and this reader
  // walks none: a tree it read only the top of would leave out every
  // file below it, so it refuses one, naming why.
  test('refuses an embedded-files name tree with /Kids, which it does not walk', async () => {
    const document = await PDFDocument.create()
    document.addPage()
    const { context } = document
    const leaf = context.register(context.obj({ Names: [] }))
    document.catalog.set(PDFName.of('Names'), context.obj({ EmbeddedFiles: context.obj({ Kids: [leaf] }) }))
    await expect(readPdfObjects(await document.save())).rejects.toThrow(/Kids/)
  })

  // An engine that returned something other than a PDF must fail the
  // test, not read as a PDF that embeds nothing.
  test('rejects bytes that are not a PDF', async () => {
    await expect(readPdfObjects(new TextEncoder().encode('not a pdf at all'))).rejects.toThrow()
  })
})

/**
 * How a PDF is held where its bytes may differ and its document may not
 * (0031): by its objects, every stream inflated -- the e-invoice gate's
 * record, and the renderer's two entries, which deflate with two zlibs.
 * Tested on PDFs pdf-lib writes here, each with one content stream
 * deflated by Node's zlib at the level a case asks for.
 */
describe('inflatedDigest', () => {
  /** A page of text that does not repeat itself, as a page's operators do not. */
  const PAGE = Array.from(
    { length: 400 },
    (_, line) =>
      `BT /F1 9 Tf 40 ${String(800 - line * 2)} Td (Position ${String((line * 7919) % 1009)}: ${String(line * 31)},${String(line % 100).padStart(2, '0')} EUR) Tj ET`,
  ).join('\n')

  /** A one-page PDF whose page's stream is `text` deflated at `level`, with `extra` in its dictionary. */
  async function pdf({ text = PAGE, level = 6, extra = {} } = {}): Promise<Uint8Array> {
    const document = await PDFDocument.create({ updateMetadata: false })
    const page = document.addPage([595, 842])
    const contents = document.context.register(
      document.context.stream(deflateSync(Buffer.from(text, 'latin1'), { level }), { Filter: 'FlateDecode', ...extra }),
    )
    page.node.set(PDFName.of('Contents'), contents)
    return document.save({ useObjectStreams: false })
  }

  // The case it exists for: one page deflated by two zlibs, here two
  // levels of one, is two files whose bytes and lengths differ and one
  // document; a record held to the bytes would fail CI on a Node it was not
  // made on, and two entries held to theirs could never agree.
  test('is the same for a stream deflated otherwise, though the bytes differ', async () => {
    const [fast, small] = await Promise.all([pdf({ level: 1 }), pdf({ level: 9 })])
    expect(Buffer.compare(Buffer.from(fast), Buffer.from(small))).not.toBe(0)
    expect(fast.length).not.toBe(small.length)
    expect(await inflatedDigest(fast)).toBe(await inflatedDigest(small))
  })

  // What the digest stands for is the document: a character of a page, a
  // key of a stream's dictionary, or the version the header states is
  // another PDF than the one recorded.
  test('differs for a stream that inflates otherwise, a dictionary that says otherwise, or another version', async () => {
    const digest = await inflatedDigest(await pdf())
    expect(await inflatedDigest(await pdf({ text: PAGE.replace('Position', 'Pos1tion') }))).not.toBe(digest)
    expect(await inflatedDigest(await pdf({ extra: { Type: 'XObject' } }))).not.toBe(digest)
    const older = Buffer.from(await pdf())
      .toString('latin1')
      .replace(/^%PDF-1\.7/, '%PDF-1.4')
    expect(older.startsWith('%PDF-1.4')).toBe(true)
    expect(await inflatedDigest(new Uint8Array(Buffer.from(older, 'latin1')))).not.toBe(digest)
    expect(digest).toMatch(/^[0-9a-f]{64}$/)
  })

  // PDFKit copies a JPEG into the PDF whole, as DCTDecode, which pdf-lib
  // does not decode: such a stream is the JPEG's own bytes, which no zlib
  // wrote, and is read as it is -- a digest that threw on it could hold no
  // e-invoice with a JPEG logo, and one that skipped it would not see the
  // logo change.
  test('reads a JPEG’s stream as the bytes it holds, which no zlib wrote', async () => {
    const withJpeg = async (byte: number): Promise<Uint8Array> => {
      const document = await PDFDocument.create({ updateMetadata: false })
      document.addPage([595, 842])
      document.context.register(
        document.context.stream(new Uint8Array([0xff, 0xd8, byte, 0xff, 0xd9]), { Type: 'XObject', Subtype: 'Image', Filter: 'DCTDecode' }),
      )
      return document.save({ useObjectStreams: false })
    }
    const digest = await inflatedDigest(await withJpeg(1))
    expect(digest).toMatch(/^[0-9a-f]{64}$/)
    expect(await inflatedDigest(await withJpeg(2))).not.toBe(digest)
  })

  // A file that is no PDF has no objects to record, and must not record as
  // an empty one.
  test('refuses what is not a PDF', async () => {
    await expect(inflatedDigest(new TextEncoder().encode('<?xml version="1.0"?><rsm:CrossIndustryInvoice/>'))).rejects.toThrow()
  })
})
