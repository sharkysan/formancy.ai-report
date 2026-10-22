import pdfmake from 'pdfmake'
import { readPdf } from '@formancy/report-corpus'
import { assetDigest, MAX_FONT_LINE, MIN_FONT_LINE, RenderRefusal, type ResolvedDocument, type ResolvedFonts, type Table } from '@formancy/report-runtime'
import { describe, expect, test, vi } from 'vitest'
import type { Glyphs } from './glyphs.js'
import { planFonts } from './host-fonts.js'
import { renderPdf } from './node.js'
import { LAYOUT_TABLES } from './strip-layout.js'
import { LINE_FACTOR } from './style.js'
import { bareBillDocument, GERMAN, resolvedBill } from './testing/bills.js'
import { bareDocument, documentOf, paragraph, TIMEOUT } from './testing/documents.js'
import { face, HOST_SANS, HOST_SANS_BOLD, layOutInWorker, LIBERATION_BOLD, LIBERATION_REGULAR, NEVER_ADVANCING, retag, ROBOTO_REGULAR, tableOf, THROWING, withCharacters, withEms, withFsType, withLine } from './testing/fonts.js'

/**
 * A report printing in fonts a host approved (0043): the renderer embeds
 * the faces the runtime hands it and refuses what it cannot draw in them.
 * Which face each run printed in is read back from the PDF by its
 * PostScript name (0003); the corpus's `host-fonts` fixture proves Latin,
 * Greek and Cyrillic in Liberation Serif and Mono the same way.
 *
 * The faces are the Liberation Sans the package ships and pdfmake's Roboto,
 * read as a host's font would be, and faces crafted from them under names
 * of their own (`testing/fonts.ts`): a font `readFont` refuses reaches the
 * renderer as `invalid-asset` naming the asset, and a character the face
 * lacks or the renderer does not print as `unsupported`. A face PDFKit
 * would draw as another is `face-identity.test.ts`'s.
 */
const REGULAR = LIBERATION_REGULAR
const BOLD = LIBERATION_BOLD
const OPTIONS = { maxPages: 5 }

/** Roboto's four faces, each mapping 'A', for the plan's fallback: the renderer's own glyphs come from the engine, which a unit test stands in for. */
const ROBOTO: Glyphs = { normal: new Set([0x41]), bold: new Set([0x41]), italics: new Set([0x41]), bolditalics: new Set([0x41]) }

/** pdfmake's process-wide virtual files, where a render writes its host faces. */
const virtualfs = (pdfmake as unknown as { virtualfs: { storage: Record<string, unknown> } }).virtualfs
const HOST_FILES = 'formancy-report-render-pdf/font/'
const hostFiles = (): string[] => Object.keys(virtualfs.storage).filter((name) => name.startsWith(HOST_FILES))

/** A document whose body is `body`, mapping `fonts`; no page regions, so every refusal names a body block. */
function mapped(fonts: ResolvedFonts, body: ResolvedDocument['body']): ResolvedDocument {
  return { ...bareDocument('Host fonts', body), fonts }
}

/** The refusal `document` is rejected with, or 'rendered' when it is not. */
async function refusal(document: ResolvedDocument, options: { readonly maxPages: number } = OPTIONS): Promise<RenderRefusal | 'rendered'> {
  return renderPdf(document, options).then(
    () => 'rendered' as const,
    (error: unknown) => {
      if (error instanceof RenderRefusal) return error
      throw error
    },
  )
}

/** Each run of `pdf` as its text and the PostScript name of the face it is drawn in, the subset prefix dropped. */
async function runs(pdf: Uint8Array): Promise<{ readonly text: string; readonly face: string }[]> {
  const { pages } = await readPdf(pdf)
  return pages.flatMap((page) => page.items.filter((item) => item.text.trim() !== '').map((item) => ({ text: item.text, face: item.font.replace(/^[A-Z]{6}\+/, '') })))
}

/** A table of one column, its header and one detail row; `rows` replaces the row. */
function table(rows: Table['rows'] = [{ kind: 'detail', cells: ['R-1'] }]): Table {
  return { kind: 'table', id: 'lines', columns: [{ width: 'fill', align: 'left' }], header: ['Key'], rows, emptyText: 'none' }
}

/** HostSans, or its bold, with a line `ems` tall, its descender kept: 0.5 is the shortest line the reader accepts (`MIN_FONT_LINE`), 4 the tallest. */
const lineOf = (ems: number, bytes = HOST_SANS): Uint8Array => withEms(bytes, ems)

/** `document` on a page whose body is `height` points tall. */
function onBody(height: number, document: ResolvedDocument): ResolvedDocument {
  const margin = (841.89 - height) / 2
  return { ...document, page: { ...document.page, margins: { ...document.page.margins, top: margin, bottom: margin } } }
}

describe('the plan for a report that maps nothing', () => {
  const plan = planFonts(undefined, ROBOTO)

  // sans and token-less text print in Roboto, as before a report could name
  // a host font; the default family and the family of sans are Roboto.
  test('prints sans and the default in Roboto', () => {
    expect(plan.defaultFamily).toBe('Roboto')
    expect(plan.familyOf('sans')).toBe('Roboto')
    expect(plan.face(undefined, false, false, 'x')).toEqual({ glyphs: ROBOTO.normal, lineFactor: LINE_FACTOR, name: 'Roboto' })
    expect(plan.face('sans', true, false, 'x')).toEqual({ glyphs: ROBOTO.bold, lineFactor: LINE_FACTOR, name: 'Roboto' })
    expect(plan.usable('sans')).toBe(true)
  })

  // serif and mono have no font, and are refused, naming the token: the
  // renderer embeds Roboto alone. Nothing is added to the engine.
  test('refuses serif and mono, and adds no host files', () => {
    expect(plan.usable('serif')).toBe(false)
    expect(plan.usable('mono')).toBe(false)
    expect(() => plan.face('serif', false, false, 'body[0]')).toThrow(/serif font, which the report maps to no host font/)
    expect(plan.engine.files.size).toBe(0)
    expect(plan.engine.families).toEqual({})
  })
})

describe('the plan for a report that maps a face twice', () => {
  // One asset named by two tokens and two faces is read once and embedded
  // once: a file for each name would put the same subset in the PDF twice.
  test('reads and files one asset once however many faces name it', () => {
    const brand = face('brand', REGULAR)
    const { files, families } = planFonts({ sans: { normal: brand }, serif: { normal: brand, bold: brand } }, ROBOTO).engine
    expect(files.size).toBe(1)
    const [file] = files.keys()
    expect(families).toEqual({ 'formancy-host-sans': { normal: file }, 'formancy-host-serif': { normal: file, bold: file } })
  })

  // The plan reads an asset once by its id. A document built by hand can
  // hand one id in two byte strings, and the mono then printed in the
  // sans's bytes, a face it was never handed (review of P07, 22 October
  // 2026). The runtime resolves each id once, so only such a document can
  // do it: refused as invalid-asset, naming the asset alone. One id in
  // equal bytes, a copy of them, is one face, read and filed once.
  test('refuses one asset handed in two byte strings, and reads one in equal bytes once', async () => {
    const twice = mapped({ sans: { normal: face('brand', HOST_SANS) }, mono: { normal: face('brand', BOLD) } }, [paragraph('Sans'), paragraph('Mono', { font: 'mono' })])
    expect(await refusal(twice)).toMatchObject({ code: 'invalid-asset', subject: 'brand', message: 'the font asset brand is handed to the renderer twice, in other bytes the second time: an asset is one font, read by its id' })
    expect(planFonts({ sans: { normal: face('brand', REGULAR) }, mono: { normal: face('brand', Uint8Array.from(REGULAR)) } }, ROBOTO).engine.files.size).toBe(1)
  }, TIMEOUT)
})

describe('a host font the renderer embeds', () => {
  // A host-font render reads no clock and no random id: the same document
  // renders to the same bytes, so a preview and a server's PDF can be
  // compared, and a render found again by its digest.
  test('renders the same document to the same bytes', async () => {
    const document = mapped({ sans: { normal: face('brand', REGULAR), bold: face('brand-bold', BOLD) } }, [paragraph('Zürich', { font: 'sans' }), paragraph('Total', { font: 'sans', bold: true })])
    const [first, second] = await Promise.all([renderPdf(document, OPTIONS), renderPdf(document, OPTIONS)])
    expect(Buffer.from(first).equals(Buffer.from(second))).toBe(true)
  }, TIMEOUT)

  // pdfmake's virtual files are process-wide and have no delete, so each
  // pass takes its faces out again: after a render, and after one refused
  // once a pass had run -- a keep-together block taller than a page, which
  // the body pass measured -- none is left, and a process that renders many
  // firms' fonts holds none of them afterwards.
  test('leaves none of its faces in pdfmake’s virtual files, rendered or refused', async () => {
    const fonts = { sans: { normal: face('brand', REGULAR) } }
    await renderPdf(mapped(fonts, [paragraph('Zürich', { font: 'sans' })]), OPTIONS)
    expect(hostFiles()).toEqual([])
    const kept = { kind: 'keepTogether' as const, blocks: Array.from({ length: 120 }, (_, index) => paragraph(`Line ${index}`, { font: 'sans' })) }
    expect(await refusal(mapped(fonts, [kept]))).toMatchObject({ code: 'content-too-large', subject: 'body[0]' })
    expect(hostFiles()).toEqual([])
  }, TIMEOUT)

  // A serif paragraph with no host font is refused, as before: what an
  // earlier render mapped is not the next document's.
  test('leaves a later render of another document unaffected', async () => {
    await renderPdf(mapped({ serif: { normal: face('brand', REGULAR) } }, [paragraph('Serif', { font: 'serif' })]), OPTIONS)
    expect(await refusal(bareDocument('Plain', [paragraph('Serif', { font: 'serif' })]))).toMatchObject({ code: 'unsupported' })
  }, TIMEOUT)

  // Two renders of one firm's invoices at once, each of a page header and
  // footer measured before the body, the second started a few turns of the
  // event loop after the first writes its face: each names its virtual
  // files apart, so the first's cleanup never takes a face the second has
  // written and not yet read. Named by digest, the second render failed
  // with pdfmake's "Access to local file denied", a plain error, at five of
  // the first twelve delays.
  test('renders one face in two renders at once, however their passes interleave', async () => {
    const document: ResolvedDocument = { ...documentOf('Interleaved', [paragraph('Zürich')]), fonts: { sans: { normal: face('brand', REGULAR) } } }
    const storage = virtualfs.storage
    const failed: string[] = []
    try {
      for (let delay = 0; delay < 20; delay += 1) {
        let second: Promise<Uint8Array> | undefined
        const started = async (): Promise<Uint8Array> => {
          for (let turn = 0; turn < delay; turn += 1) await Promise.resolve()
          return renderPdf(document, OPTIONS)
        }
        virtualfs.storage = new Proxy(storage, {
          set(target, name, value) {
            if (second === undefined && String(name).startsWith(HOST_FILES)) second = started()
            return Reflect.set(target, name, value)
          },
        })
        // The second starts while the first runs, when it writes its first face; both are awaited once the first is done.
        const outcomes = await Promise.allSettled([renderPdf(document, OPTIONS)])
        if (second === undefined) failed.push(`delay ${delay}: no second render started`)
        else outcomes.push(...(await Promise.allSettled([second])))
        for (const outcome of outcomes) if (outcome.status === 'rejected') failed.push(`delay ${delay}: ${String(outcome.reason)}`)
        virtualfs.storage = storage
      }
    } finally {
      virtualfs.storage = storage
    }
    expect(failed).toEqual([])
  }, TIMEOUT)

  // Each render reads the bytes it is handed. A face another render read
  // under the same digest is never this one's: Bold under Regular's digest
  // prints Bold, and four bytes that are no font are refused, as they
  // would be under any digest, whatever ran before them in the process.
  test('prints each render in the bytes it was handed, whatever another handed under its digest', async () => {
    const digest = assetDigest(REGULAR)
    const document = (bytes: Uint8Array): ResolvedDocument => mapped({ serif: { normal: face('brand', bytes, digest) } }, [paragraph('Serif', { font: 'serif' })])
    expect(await runs(await renderPdf(document(REGULAR), OPTIONS))).toEqual([{ text: 'Serif', face: 'LiberationSans' }])
    expect(await runs(await renderPdf(document(BOLD), OPTIONS))).toEqual([{ text: 'Serif', face: 'LiberationSans-Bold' }])
    expect(await refusal(document(Uint8Array.from([0, 1, 0, 0])))).toMatchObject({ code: 'invalid-asset', subject: 'brand' })
  }, TIMEOUT)
})

describe('a mapped sans', () => {
  // Text with no token prints in the mapped sans, not in Roboto, and so do
  // a table's cells, its header in the bold face the renderer sets it in:
  // read from the PDF, since every one of them would read the same in Roboto.
  test('prints text with no font token, and a table, in its faces, never in Roboto', async () => {
    const pdf = await renderPdf(mapped({ sans: { normal: face('brand', REGULAR), bold: face('brand-bold', BOLD) } }, [paragraph('Zürich'), table()]), OPTIONS)
    expect(await runs(pdf)).toEqual([
      { text: 'Zürich', face: 'LiberationSans' },
      { text: 'Key', face: 'LiberationSans-Bold' },
      { text: 'R-1', face: 'LiberationSans' },
    ])
  }, TIMEOUT)

  // A character is held to the face it prints in, not to Roboto's: U+FFFD,
  // which Roboto draws and Liberation Sans does not, is refused in the
  // mapped sans, naming the face, and prints where the report maps nothing.
  test('refuses a character its face lacks though Roboto has it, naming the face', async () => {
    const body = [paragraph('Customer �')]
    const outcome = await refusal(mapped({ sans: { normal: face('brand', REGULAR) } }, body))
    expect(outcome).toMatchObject({ code: 'unsupported', subject: 'body[0]' })
    expect((outcome as RenderRefusal).message).toContain("U+FFFD, which the sans font's regular face, the asset brand, has no glyph for")
    expect(await refusal(bareDocument('Roboto', body))).toBe('rendered')
  }, TIMEOUT)

  // The slip prints in the Liberation Sans SIX asks for whatever sans
  // maps: here a host's Roboto, which would show in every run of the slip
  // were it printed in the mapped sans.
  test('leaves the QR-bill’s slip in Liberation Sans', async () => {
    const document: ResolvedDocument = { ...bareBillDocument(resolvedBill(GERMAN)), fonts: { sans: { normal: face('brand', ROBOTO_REGULAR) } } }
    const faces = new Set((await runs(await renderPdf(document, OPTIONS))).map((run) => run.face))
    expect([...faces].sort()).toEqual(['LiberationSans', 'LiberationSans-Bold'])
  }, TIMEOUT)

  // The measuring passes stand their sentinels in Roboto, whose line they
  // assume: in a mapped sans of the tallest line the reader accepts, four
  // times the size, the slip's sheet, as tall as its section and three
  // sentinel lines, would overflow, and a bill that fits be refused.
  test('measures with sentinels in Roboto, whatever the mapped sans lays out', async () => {
    const tall = lineOf(MAX_FONT_LINE)
    const document: ResolvedDocument = { ...bareBillDocument(resolvedBill(GERMAN)), fonts: { sans: { normal: face('brand', tall) } } }
    expect(await refusal(document)).toBe('rendered')
  }, TIMEOUT)
})

describe('a mapped face’s own line', () => {
  // A face of the tallest line the reader accepts, four times its size: a
  // 96pt line of it, 384pt, is taller than a body of 300, in a paragraph
  // and in a table's header, though in Roboto's line, 112.5pt, it would
  // fit; each is refused as too tall, never laid out past the foot of the
  // page.
  test('refuses a line that face makes taller than the body', async () => {
    const tall = lineOf(MAX_FONT_LINE)
    const fonts = { sans: { normal: face('brand', tall), bold: face('brand-bold', tall) } }
    expect(await refusal(onBody(300, mapped(fonts, [paragraph('Tall', { font: 'sans', size: 96 })])))).toMatchObject({ code: 'content-too-large', subject: 'body[0]' })
    expect(await refusal(onBody(300, mapped(fonts, [{ ...table(), headerStyle: { font: 'sans', size: 96 } }])))).toMatchObject({ code: 'content-too-large', subject: 'lines' })
  }, TIMEOUT)

  // A line is as tall as its tallest run: a paragraph in a regular face
  // whose 96pt line fits a body of 300, with one bold run in a face four
  // times its size, was measured by the regular face alone, and pdfmake
  // dropped the whole 384pt line without a word, its page left empty. It is
  // refused as too tall, naming the paragraph.
  test('refuses a line a run’s own face makes taller than the body', async () => {
    const fonts = { sans: { normal: face('brand', REGULAR), bold: face('brand-bold', lineOf(MAX_FONT_LINE, HOST_SANS_BOLD)) } }
    const body: ResolvedDocument['body'] = [{ kind: 'paragraph', runs: [{ text: 'A' }, { text: 'B', bold: true }], style: { size: 96 } }, paragraph('After')]
    expect(await refusal(onBody(300, mapped(fonts, body)))).toMatchObject({ code: 'content-too-large', subject: 'body[0]' })
  }, TIMEOUT)

  // A table's cell prints at the table's 9pt where its style sets no size,
  // and its empty text in italic: in a face of a 4 em line, a header of no
  // size is a 36pt line in a body of 30, and so is the empty text. Counted
  // at no size, the header printed with page 1 empty and the header gone;
  // never counted, the empty text's table printed its header alone on
  // three pages. Each is refused as too tall, naming the table.
  test.each<[string, Table]>([
    ['a header of no size', { ...table([{ kind: 'detail', cells: ['a'], style: { size: 4 } }]), headerStyle: { font: 'sans' } }],
    ['the empty text, in italic', { ...table([]), headerStyle: { size: 4 } }],
  ])('refuses %s whose line that face makes taller than the body', async (_, tall) => {
    const fonts = { sans: { normal: face('brand', lineOf(MAX_FONT_LINE)), bold: face('brand-bold', lineOf(MAX_FONT_LINE, HOST_SANS_BOLD)), italic: face('brand', lineOf(MAX_FONT_LINE)) } }
    const outcome = await refusal(onBody(30, mapped(fonts, [tall, paragraph('After', { size: 4 })])))
    expect(outcome).toMatchObject({ code: 'content-too-large', subject: 'lines', message: 'a line of table lines is 40.00 pt tall; the body is 30.00 pt where it stands' })
  }, TIMEOUT)

  // The body's least height is a floor no taller than pdfmake lays out: in
  // a face of the shortest line the reader accepts, half its size, a
  // hundred lines fit on one page that in Roboto's line would need two, and
  // the report is not refused for pages it does not need.
  test('measures a line in a face of a shorter line than Roboto’s by its own', async () => {
    const body = Array.from({ length: 100 }, (_, index) => paragraph(`Line ${index}`, { font: 'sans' }))
    expect(await refusal(mapped({ sans: { normal: face('brand', lineOf(MIN_FONT_LINE)) } }, body), { maxPages: 1 })).toBe('rendered')
  }, TIMEOUT)

  // A host face's line once lowered the bound for all the text: with mono
  // mapped to a face of half its size, a hundred lines in Roboto -- 1054
  // pt, where one page holds 770 -- or a table of sixty rows of it, 887 pt,
  // passed the page bound counted at the short face's line, and pdfmake
  // laid or measured every one of them before the page limit refused it.
  // Each line counts by the face it prints in, and the report is refused by
  // the bound, before pdfmake is handed it.
  test.each<[string, ResolvedDocument['body']]>([
    ['a paragraph', Array.from({ length: 100 }, (_, index) => paragraph(`Line ${index}`))],
    ['a table row', [table(Array.from({ length: 60 }, (_, index) => ({ kind: 'detail' as const, cells: [`R-${index}`] })))]],
  ])('counts %s in Roboto by Roboto’s line, whatever shorter face the report maps beside it', async (_, roboto) => {
    const body = [paragraph('code', { font: 'mono' }), ...roboto]
    const handed = vi.spyOn(pdfmake, 'createPdf')
    try {
      const outcome = await refusal(mapped({ mono: { normal: face('code', lineOf(MIN_FONT_LINE)) } }, body), { maxPages: 1 })
      expect(outcome).toMatchObject({ code: 'too-many-pages', message: expect.stringContaining('its body is at least') as string })
      expect(handed).not.toHaveBeenCalled()
    } finally {
      handed.mockRestore()
    }
  }, TIMEOUT)

  // A paragraph whose runs print in two faces lays each line out as tall
  // as its tallest run (pdfmake's `Line.getHeight`), so its least line is
  // that run's: 42 lines of a short run and a run twice the size's line,
  // 756 pt, fit the 770 pt page and print on it, and 43 need a second page
  // and are refused by the bound before pdfmake is handed them. Counted by
  // the shorter run, the 43 passed the bound; counted by more than the
  // tallest, the 42 that fit were refused.
  test('counts a paragraph of two faces by its tallest run, never more', async () => {
    const fonts = { sans: { normal: face('brand', lineOf(MIN_FONT_LINE)), bold: face('brand-bold', lineOf(2, HOST_SANS_BOLD)) } }
    const lines = (count: number): ResolvedDocument['body'] => Array.from({ length: count }, (_, index) => ({ kind: 'paragraph', runs: [{ text: `Line ${index} ` }, { text: 'due', bold: true }], style: { size: 9 } }))
    const fitting = await renderPdf(mapped(fonts, lines(42)), { maxPages: 1 })
    expect((await readPdf(fitting)).pages).toHaveLength(1)
    const handed = vi.spyOn(pdfmake, 'createPdf')
    try {
      expect(await refusal(mapped(fonts, lines(43)), { maxPages: 1 })).toMatchObject({ code: 'too-many-pages', message: expect.stringContaining('its body is at least 774.00 pt tall') as string })
      expect(handed).not.toHaveBeenCalled()
    } finally {
      handed.mockRestore()
    }
  }, TIMEOUT)
})

describe('a face whose line pdfmake cannot lay a page out by', () => {
  // A face the reader accepted before review: its line nothing, its
  // ascender its descender; below nothing, its ascender under its
  // descender; or 4 units of its 2048. pdfmake laid 2,000 lines of each out
  // on one page of a report limited to one, each on the last, above the top
  // margin or 0.02 pt below the last, since the page bound counted each
  // line as its size times that line. Each face is refused as the asset it
  // is, in the reader's words, before anything is laid out.
  test.each([
    ['a line of nothing', 1854, 1854, 'has a descender of 1854 units, above its baseline'],
    ['a line below nothing', -434, 1854, 'has an ascender of -434 units, at or below its baseline'],
    ['a line of 4 units to the em', 3, -1, 'has a line 4 units tall'],
  ])('refuses %s', async (_, ascender, descender, said) => {
    const body = Array.from({ length: 2000 }, (_, index) => paragraph(`Line ${index}`))
    const outcome = await refusal(mapped({ sans: { normal: face('brand', withLine(REGULAR, ascender, descender)) } }, body), { maxPages: 1 })
    expect(outcome).toMatchObject({ code: 'invalid-asset', subject: 'brand' })
    expect((outcome as RenderRefusal).message).toContain(`the font asset brand ${said}`)
  }, TIMEOUT)
})

describe('what a host font cannot print', () => {
  // A character the mapped face has no glyph for is refused, naming the
  // token, the face and the code point: it would print as an empty box,
  // and as nothing in the PDF's text.
  test('refuses a character the face has no glyph for, naming the face and the code point', async () => {
    const outcome = await refusal(mapped({ serif: { normal: face('brand', REGULAR) } }, [paragraph('Paid ✓', { font: 'serif' })]))
    expect(outcome).toMatchObject({ code: 'unsupported', subject: 'body[0]' })
    expect((outcome as RenderRefusal).message).toContain("U+2713, which the serif font's regular face, the asset brand, has no glyph for")
  }, TIMEOUT)

  // A page number prints its digits in the paragraph's face: a face that
  // has none would print the footer's "Page 1 of 1" as "Page  of ", and
  // nothing in the text layer. Refused, naming the page field.
  test('refuses a page field whose face has no digits', async () => {
    const letters = withCharacters(HOST_SANS, 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz :')
    const document: ResolvedDocument = { ...documentOf('Letters', [paragraph('Text')]), fonts: { sans: { normal: face('brand', letters) } } }
    const outcome = await refusal(document)
    expect(outcome).toMatchObject({ code: 'unsupported', subject: 'pageFooter[0]' })
    expect((outcome as RenderRefusal).message).toContain("pageFooter[0]'s page field prints U+0030")
  }, TIMEOUT)

  // A weight or slant the family does not map is refused, never synthesised:
  // the renderer draws no faux bold.
  test('refuses a face the family does not map', async () => {
    const outcome = await refusal(mapped({ serif: { normal: face('brand', REGULAR) } }, [paragraph('Heading', { font: 'serif', bold: true })]))
    expect(outcome).toMatchObject({ code: 'unsupported', subject: 'body[0]' })
    expect((outcome as RenderRefusal).message).toContain('bold')
    expect((outcome as RenderRefusal).message).toContain('serif')
  }, TIMEOUT)

  // A right-to-left script is refused by code point even where the face maps
  // it, since pdfmake lays out no bidi; the message says so, not a missing
  // glyph.
  test('refuses a right-to-left script the face maps', async () => {
    const outcome = await refusal(mapped({ serif: { normal: face('brand', REGULAR) } }, [paragraph('Shalom שלום', { font: 'serif' })]))
    expect(outcome).toMatchObject({ code: 'unsupported', subject: 'body[0]' })
    expect((outcome as RenderRefusal).message).toContain('right-to-left')
    expect((outcome as RenderRefusal).message).toContain('U+05E9')
  }, TIMEOUT)

  // Liberation Sans maps the right-to-left override, and fontkit draws it
  // as a space: "abc‮def" would print as "abc def". Refused as the
  // control it is.
  test('refuses a bidirectional control the face maps', async () => {
    const outcome = await refusal(mapped({ serif: { normal: face('brand', REGULAR) } }, [paragraph('abc‮def', { font: 'serif' })]))
    expect(outcome).toMatchObject({ code: 'unsupported', subject: 'body[0]' })
    expect((outcome as RenderRefusal).message).toContain('U+202E, a bidirectional control')
  }, TIMEOUT)

  // A byte-order mark is ordinary in data, and Roboto maps it: a report
  // that maps nothing prints it as 0.2.0 did.
  test('prints a byte-order mark in Roboto, as before', async () => {
    expect(await refusal(bareDocument('Plain', [paragraph('﻿Invoice 42')]))).toBe('rendered')
  }, TIMEOUT)

  // The header and total rows the renderer prints bold are held to the map
  // too: a table in a family mapped without a bold face is refused, naming
  // the table, though no style of its own asked for bold.
  test('refuses a table whose bold header the family cannot print', async () => {
    const outcome = await refusal(mapped({ sans: { normal: face('brand', REGULAR) } }, [table()]))
    expect(outcome).toMatchObject({ code: 'unsupported', subject: 'lines' })
    expect((outcome as RenderRefusal).message).toContain('bold')
  }, TIMEOUT)

  // The empty text prints in italic where a table has no detail rows, and
  // only there: a table of rows in a family mapped without an italic face
  // prints, and the same table empty is refused for the italic it needs.
  test('holds a table to the italic face only where it prints its empty text', async () => {
    const fonts = { sans: { normal: face('brand', REGULAR), bold: face('brand-bold', BOLD) } }
    expect(await refusal(mapped(fonts, [table()]))).toBe('rendered')
    const outcome = await refusal(mapped(fonts, [table([])]))
    expect(outcome).toMatchObject({ code: 'unsupported', subject: 'lines' })
    expect((outcome as RenderRefusal).message).toContain('italic')
  }, TIMEOUT)
})

describe('a font the renderer cannot read', () => {
  // The renderer reads each face with readFont first, as the runtime did:
  // a font it refuses reaches the renderer as invalid-asset naming the
  // asset, never an error deep in pdfmake. The renderer is a package
  // boundary that takes resolved input and refuses what it cannot draw.
  test.each([
    ['Restricted License embedding (fsType 2)', withFsType(REGULAR, 0x0002)],
    ['No subsetting (fsType 0x0100)', withFsType(REGULAR, 0x0100)],
    ['Bitmap embedding only (fsType 0x0200)', withFsType(REGULAR, 0x0200)],
    ['a collection', Uint8Array.from([0x74, 0x74, 0x63, 0x66, 0, 1, 0, 0, 0, 0, 0, 1])],
    ['a variable font', retag(REGULAR, 'cmap', 'fvar')],
  ])('refuses %s as invalid-asset, naming the asset', async (_, bytes) => {
    const outcome = await refusal(mapped({ serif: { normal: face('brand', bytes) } }, [paragraph('Serif', { font: 'serif' })]))
    expect(outcome).toMatchObject({ code: 'invalid-asset', subject: 'brand' })
  }, TIMEOUT)
})

describe('a crafted layout table at print', () => {
  const fonts: ResolvedFonts = { serif: { normal: face('looping', NEVER_ADVANCING), bold: face('throwing', THROWING) } }

  // What the engine embeds is the face with every layout table fontkit
  // reads zeroed in its directory: the strip is on the render's path, not
  // beside it.
  test('hands the engine each face with its layout tables zeroed', () => {
    const { files } = planFonts(fonts, ROBOTO).engine
    expect(files.size).toBe(2)
    for (const bytes of files.values()) {
      for (const tag of LAYOUT_TABLES) {
        const found = (() => {
          try {
            return tableOf(bytes, tag)
          } catch {
            return undefined
          }
        })()
        if (found !== undefined) expect(found.length, tag).toBe(0)
      }
    }
  })

  // The two faces strip-layout.test.ts holds to hang and to throw before the
  // strip: what the engine is handed of each is laid out and embedded by
  // fontkit and PDFKit in a worker, and only then the render runs here,
  // drawing both, where before one held its thread for good and the other
  // threw a plain error out of pdfmake.
  test('renders a face whose morx never advances and one whose GSUB fontkit throws on', async () => {
    for (const bytes of planFonts(fonts, ROBOTO).engine.files.values()) expect(await layOutInWorker(bytes, 'Af', 10_000)).toBe('laid out')
    const pdf = await renderPdf(mapped(fonts, [paragraph('Af', { font: 'serif' }), paragraph('Af', { font: 'serif', bold: true })]), OPTIONS)
    expect((await runs(pdf)).map((run) => run.text)).toEqual(['Af', 'Af'])
  }, TIMEOUT)
})
