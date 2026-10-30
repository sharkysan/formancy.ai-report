/**
 * Adding an image a person chose, and removing one nothing draws, against
 * the editor alone (0033): what is refused before the file is read, what
 * its bytes are taken for, what the host is handed and when, and what the
 * report declares, in how many steps.
 */
import { putAsset } from '@formancy/report-core'
import type { Refusal, ReportSession } from '@formancy/report-core'
import { assetDigest, cleanSvg, emptyReport, MAX_ASSET_BYTES, MAX_ASSETS } from '@formancy/report-spec'
import type { AssetRef, ReportDefinition } from '@formancy/report-spec'
import { describe, expect, test, vi } from 'vitest'
import { createReportEditor } from './editor.js'
import type { ReportEditor } from './editor.js'
import type { ImageFile, KeptImage } from './image-store.js'
import { chosen, eInvoiceReport, GIF, jpeg, png, recordingStore, utf8, xrechnungReport } from './image-test-support.js'
import type { EditorOutcome } from './model-actions.js'
import { editorOver, richReport, sessionOver } from './test-support.js'
import { editorText } from './text.js'

const t = editorText('en')
const PNG = png(2, 1)
const blank = (): ReportDefinition => emptyReport('letter', 'Letter', 'en')

/** A drawing with what cleaning removes in it: the XML declaration, a comment, metadata and a script. */
const MARK = `<?xml version="1.0" encoding="UTF-8"?>
<!-- the mark -->
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 20">
  <metadata>An invented firm's mark</metadata>
  <script>alert(1)</script>
  <rect width="40" height="20" fill="#1f4e79"/>
</svg>
`

function ok(outcome: EditorOutcome): void {
  if (!outcome.ok) throw new Error(`refused: ${outcome.code} ${outcome.message}`)
}

/** What a refused add says: the file's name, and why. */
const refused = (name: string, reason: string): string => t('images.refused', { name, reason })
const added = (id: string): string => t('images.added', { id, kind: t('kind.image') })

/** A report that declares `assets` and draws the first of them in its header. */
function declaring(...assets: AssetRef[]): ReportDefinition {
  const report = blank()
  const [first] = assets
  const header =
    first === undefined
      ? []
      : [{ id: 'logo-image', kind: 'image' as const, source: { kind: 'asset' as const, asset: first.id }, width: 100, height: 40, fit: 'contain' as const }]
  return { ...report, assets, regions: { ...report.regions, reportHeader: header } }
}

const asset = (id: string, digit: string): AssetRef => ({ id, mediaType: 'image/png', digest: `sha256:${digit.repeat(64)}` })

describe('adding an image', () => {
  // A name ends in what the person typed and a browser's type is a guess
  // from it; a GIF renamed logo.png would be kept, declared and refused at
  // every print, and a PNG named .svg sent to the SVG cleaner.
  test('recognises an image by its bytes, never by its name or its type', async () => {
    const store = recordingStore()
    const { editor, session } = editorOver(blank(), { images: store })
    ok(await editor.addImage({ ...chosen('logo.svg', PNG), type: 'image/svg+xml' } as ImageFile))
    expect(session.document().assets).toEqual([{ id: 'logo', mediaType: 'image/png', digest: assetDigest(PNG) }])
    const gif = chosen('banner.png', GIF)
    const outcome = await editor.addImage(gif)
    expect(outcome).toEqual({ ok: false, code: 'not-an-image', message: refused('banner.png', t('images.reason.notImage')) })
    expect(editor.state().status.text).toBe(refused('banner.png', t('images.reason.notImage')))
    expect(gif.reads()).toBe(1)
    expect(store.offered.map((image) => image.mediaType)).toEqual(['image/png'])
    expect(session.document().assets).toHaveLength(1)
  })

  // A 2 GB file read to be refused would take the page's memory with it; a
  // file whose size understates its bytes is held to the limit once read.
  test('refuses a file past the limit before reading it, and again by its bytes', async () => {
    const store = recordingStore()
    const { editor, session } = editorOver(blank(), { images: store })
    const huge = chosen('scan.png', PNG, MAX_ASSET_BYTES + 1)
    expect(await editor.addImage(huge)).toEqual({
      ok: false,
      code: 'not-an-image',
      message: refused('scan.png', t('images.reason.tooLarge', { size: '20.1 MB', limit: '20 MB' })),
    })
    expect(huge.reads()).toBe(0)
    // A PNG with a byte past the limit after it, which is past the limit before it is anything else.
    const padded = new Uint8Array(MAX_ASSET_BYTES + 1)
    padded.set(PNG)
    const understated = chosen('scan.png', padded, 10)
    expect(await editor.addImage(understated)).toEqual({
      ok: false,
      code: 'not-an-image',
      message: refused('scan.png', t('images.reason.tooLarge', { size: '20.1 MB', limit: '20 MB' })),
    })
    expect(understated.reads()).toBe(1)
    expect(store.offered).toEqual([])
    expect(session.canUndo()).toBe(false)
    expect(editor.state().images.adding).toBeNull()
  })

  // A file that cannot be read -- moved, or its permission withdrawn, after
  // it was chosen -- is said, and the report is left as it was.
  test('says a file that cannot be read', async () => {
    const { editor, session } = editorOver(blank(), { images: recordingStore() })
    const gone: ImageFile = { name: 'logo.png', size: 10, arrayBuffer: () => Promise.reject(new Error('NotReadableError')) }
    expect(await editor.addImage(gone)).toEqual({ ok: false, code: 'not-an-image', message: refused('logo.png', t('images.reason.unreadable')) })
    expect(session.document().assets).toEqual([])
    // A builder in plain JavaScript that hands on no file at all is told so, never thrown at.
    expect(await editor.addImage(undefined as never)).toEqual({ ok: false, code: 'not-an-image', message: refused('', t('images.reason.unreadable')) })
    expect(editor.state().images.adding).toBeNull()
  })

  // The Preview renders the moment the document changes, and its resolver
  // is synchronous: an asset declared before the host held its bytes would
  // print as missing in between.
  test('has the host keep the bytes before the report declares them', async () => {
    const session = sessionOver(blank())
    const during: { assets: number; revision: number }[] = []
    const store = recordingStore(() => {
      during.push({ assets: session.document().assets.length, revision: session.revision() })
      return { ok: true }
    })
    const editor = createReportEditor(session, { images: store })
    const before = session.revision()
    ok(await editor.addImage(chosen('logo.png', PNG)))
    expect(during).toEqual([{ assets: 0, revision: before }])
    expect(session.revision()).toBe(before + 1)
    expect(store.kept).toEqual([{ asset: 'logo', mediaType: 'image/png', digest: assetDigest(PNG), bytes: PNG, fileName: 'logo.png', width: 2, height: 1 }])
  })

  // An asset declared whose bytes no host holds prints as missing; a host's
  // own error -- an address, a stack -- on the page tells a stranger about
  // the host. Its refusal's words are shown; its failure's never are.
  test('changes nothing when the host refuses or fails, and shows only the host’s refusal', async () => {
    const answers: [string, () => KeptImage | Promise<KeptImage>, string][] = [
      ['refuses', () => ({ ok: false, message: 'The library holds no more images.' }), 'The library holds no more images.'],
      ['rejects', () => Promise.reject(new Error('ECONNRESET 10.0.0.7:5432')), t('images.reason.notKept')],
      ['answers nothing it should', () => ({ yes: true }) as unknown as KeptImage, t('images.reason.notKept')],
      // A host in plain JavaScript may refuse without words, or in words that are no text: the editor's own words stand in, never "undefined".
      ['refuses without words', () => ({ ok: false }) as unknown as KeptImage, t('images.reason.notKept')],
      ['refuses in words that are no text', () => ({ ok: false, message: 42 }) as unknown as KeptImage, t('images.reason.notKept')],
    ]
    for (const [what, answer, reason] of answers) {
      const { editor, session } = editorOver(blank(), { images: recordingStore(answer) })
      const before = session.revision()
      expect(await editor.addImage(chosen('logo.png', PNG)), what).toEqual({ ok: false, code: 'not-kept', message: refused('logo.png', reason) })
      expect(session.revision(), what).toBe(before)
      expect(session.canUndo(), what).toBe(false)
      expect(editor.state().images.adding, what).toBeNull()
    }
  })

  // Undo and redo take and give back the declaration, and the bytes stay
  // with the host for the redo: a second keep would be a host asked to keep
  // what it holds, and two steps an undo that left half an image.
  test('is one undo step, and the host is asked once whatever is undone', async () => {
    const store = recordingStore()
    const { editor, session } = editorOver(blank(), { images: store, locale: 'de-CH' })
    ok(await editor.addImage(chosen('logo.png', PNG)))
    expect(session.undoLabel()).toBe('Add image')
    expect(editor.state().history.undoLabel).toBe(editorText('de-CH')('history.addImage'))
    ok(editor.dispatch({ type: 'undo' }))
    expect(session.document().assets).toEqual([])
    expect(session.canUndo()).toBe(false)
    ok(editor.dispatch({ type: 'redo' }))
    expect(session.document().assets.map((declared) => declared.id)).toEqual(['logo'])
    expect(store.offered).toHaveLength(1)
  })

  // A logo chosen twice would be two assets of one picture, and the second
  // image drawn with it would be another id for the same bytes. The host is
  // handed them again, under the id the report holds them by, which costs
  // a keep of bytes it may hold already.
  test('adds the same bytes once, and says under which id the report holds them', async () => {
    const store = recordingStore()
    const { editor, session } = editorOver(blank(), { images: store })
    ok(await editor.addImage(chosen('logo.png', PNG)))
    expect(await editor.addImage(chosen('logo copy.png', PNG))).toEqual({ ok: true })
    expect(editor.state().status.text).toBe(t('images.already', { id: 'logo' }))
    expect(store.offered.map(({ asset, fileName }) => [asset, fileName])).toEqual([
      ['logo', 'logo.png'],
      ['logo', 'logo copy.png'],
    ])
    expect(session.document().assets).toHaveLength(1)
    ok(editor.dispatch({ type: 'undo' }))
    expect(session.canUndo()).toBe(false)
  })

  // A report can declare an image whose bytes its host does not hold -- one
  // made where another host kept them -- and prints it as missing. Choosing
  // the very file is how a person supplies them; an add that only said the
  // report holds it already would leave it missing however often they did.
  test('has the host keep the bytes of an image the report declares already', async () => {
    const report: ReportDefinition = { ...blank(), assets: [{ id: 'logo', mediaType: 'image/png', digest: assetDigest(PNG) }] }
    const store = recordingStore()
    const { editor, session } = editorOver(report, { images: store })
    const before = session.revision()
    ok(await editor.addImage(chosen('Firmenlogo.png', PNG)))
    expect(store.kept).toEqual([
      { asset: 'logo', mediaType: 'image/png', digest: assetDigest(PNG), bytes: PNG, fileName: 'Firmenlogo.png', width: 2, height: 1 },
    ])
    expect(session.revision()).toBe(before)
    expect(editor.state().status.text).toBe(t('images.already', { id: 'logo' }))
    // A host's refusal of them is said as any other.
    const refusing = editorOver(report, { images: recordingStore(() => ({ ok: false, message: 'The library is full.' })) })
    expect(await refusing.editor.addImage(chosen('Firmenlogo.png', PNG))).toEqual({
      ok: false,
      code: 'not-kept',
      message: refused('Firmenlogo.png', 'The library is full.'),
    })
  })

  // An asset declared as another type than its bytes are -- which the
  // renderer refuses at every print -- is not the image a person adds:
  // taken for it, the add would leave the report printing that refusal.
  test('takes bytes declared as another type for another image', async () => {
    const report: ReportDefinition = { ...blank(), assets: [{ id: 'logo', mediaType: 'image/jpeg', digest: assetDigest(PNG) }] }
    const { editor, session } = editorOver(report, { images: recordingStore() })
    ok(await editor.addImage(chosen('logo.png', PNG)))
    expect(session.document().assets).toEqual([report.assets[0], { id: 'logo-2', mediaType: 'image/png', digest: assetDigest(PNG) }])
  })

  // A host that keys what it keeps by id alone would hold two images under
  // one: logo.png added and removed, another logo.png kept under the same
  // id, and two undos declaring the first again over the second's bytes.
  // An id a host kept bytes under is never handed it again for others; one
  // it refused holds nothing, and the next try is not numbered for it.
  test('never hands a host an id it kept other bytes under', async () => {
    const store = recordingStore((image) => (image.width === 4 ? { ok: false, message: 'Not now.' } : { ok: true }))
    const { editor, session } = editorOver(blank(), { images: store })
    ok(await editor.addImage(chosen('logo.png', PNG)))
    ok(editor.dispatch({ type: 'removeImage', asset: 'logo' }))
    ok(await editor.addImage(chosen('logo.png', png(3, 1))))
    expect(store.kept.map(({ asset, width }) => [asset, width])).toEqual([
      ['logo', 2],
      ['logo-2', 3],
    ])
    ok(editor.dispatch({ type: 'undo' }))
    ok(editor.dispatch({ type: 'undo' }))
    expect(session.document().assets).toEqual([{ id: 'logo', mediaType: 'image/png', digest: assetDigest(PNG) }])
    expect(await editor.addImage(chosen('mark.png', png(4, 1)))).toMatchObject({ ok: false, code: 'not-kept' })
    ok(await editor.addImage(chosen('mark.png', png(5, 1))))
    expect(session.document().assets.map((declared) => declared.id)).toEqual(['logo', 'mark'])
  })

  // The same bytes the host kept under an id are the image that id names:
  // a logo added, its add undone, and the same file chosen again is the
  // logo it was, where a person would read logo-2 as a second image.
  test('hands the host the id it kept the same bytes under, once the report no longer declares it', async () => {
    const store = recordingStore()
    const { editor, session } = editorOver(blank(), { images: store })
    ok(await editor.addImage(chosen('logo.png', PNG)))
    ok(editor.dispatch({ type: 'undo' }))
    ok(await editor.addImage(chosen('logo.png', PNG)))
    expect(store.kept.map(({ asset }) => asset)).toEqual(['logo', 'logo'])
    expect(session.document().assets.map((declared) => declared.id)).toEqual(['logo'])
  })

  // The id is the file's name, folded; a second file of the same name is
  // numbered, as a copy of a component is, and a number the name ends in
  // is its own: a second IMG_4711.png announced as img-2 would be read as
  // another photo's.
  test('names the asset after the file, numbered when the name is taken', async () => {
    const { editor, session } = editorOver(blank(), { images: recordingStore() })
    ok(await editor.addImage(chosen('Logo Müller AG.png', PNG)))
    ok(await editor.addImage(chosen('Logo Müller AG.png', png(3, 1))))
    ok(await editor.addImage(chosen('2024.jpg', jpeg(2, 2))))
    expect(editor.state().status.text).toBe(added('image-2024'))
    ok(await editor.addImage(chosen('IMG_4711.png', png(4, 1))))
    ok(await editor.addImage(chosen('IMG_4711.png', png(5, 1))))
    expect(session.document().assets.map((declared) => declared.id)).toEqual(['logo-muller-ag', 'logo-muller-ag-2', 'image-2024', 'img-4711', 'img-4711-2'])
    expect(editor.state().status.text).toBe(added('img-4711-2'))
  })

  // While the host keeps an image another editor of the session may
  // declare another one under the same id; a put would swap that image for
  // this one, unseen, so the add is refused instead. The same image declared
  // meanwhile under another id is the report holding it already.
  test('refuses rather than replace an asset the report gained meanwhile, and takes the same image declared meanwhile for its own', async () => {
    const other = { mediaType: 'image/jpeg' as const, digest: `sha256:${'cd'.repeat(32)}` }
    const session = sessionOver(blank())
    const editor = createReportEditor(session, { images: recordingStore(() => (session.apply((report) => putAsset(report, 'logo', other)), { ok: true })) })
    const outcome = await editor.addImage(chosen('logo.png', PNG))
    expect(outcome).toMatchObject({ ok: false, code: 'changed', message: refused('logo.png', t('images.reason.changed', { id: 'logo' })) })
    expect(session.document().assets).toEqual([{ id: 'logo', ...other }])

    const twin = sessionOver(blank())
    const declares = createReportEditor(twin, {
      images: recordingStore((image) => (twin.apply((report) => putAsset(report, 'mark', { mediaType: image.mediaType, digest: image.digest })), { ok: true })),
    })
    expect(await declares.addImage(chosen('logo.png', PNG))).toEqual({ ok: true })
    expect(twin.document().assets.map((declared) => declared.id)).toEqual(['mark'])
    expect(declares.state().status.text).toBe(t('images.already', { id: 'mark' }))
  })

  // Two adds at once would ask the host to keep two images the person
  // chose one after the other, and announce them interleaved.
  test('takes one image at a time, and says which is being added', async () => {
    let release: (answer: KeptImage) => void = () => undefined
    const store = recordingStore(() => new Promise<KeptImage>((resolve) => (release = resolve)))
    const { editor } = editorOver(blank(), { images: store })
    const first = editor.addImage(chosen('logo.png', PNG))
    const busy = t('images.busy', { name: 'logo.png' })
    expect(editor.state().images).toMatchObject({ adding: 'logo.png', unavailable: busy })
    expect(editor.state().can.addImage).toBe(false)
    expect(editor.state().status.text).toBe(t('images.adding', { name: 'logo.png' }))
    expect(editor.dispatch({ type: 'chooseImage' })).toEqual({ ok: false, code: 'busy', message: busy })
    const second = chosen('other.png', png(3, 1))
    expect(await editor.addImage(second)).toEqual({ ok: false, code: 'busy', message: busy })
    expect(second.reads()).toBe(0)
    await vi.waitFor(() => expect(store.offered).toHaveLength(1))
    release({ ok: true })
    ok(await first)
    expect(editor.state().images.adding).toBeNull()
    expect(editor.state().images.unavailable).toBeUndefined()
    ok(editor.dispatch({ type: 'chooseImage' }))
  })

  // An editor closed while the host keeps an image -- the builder gone with
  // its page -- declares nothing into a session someone else may now hold.
  test('declares nothing once disposed, before the read or while the host keeps it', async () => {
    const session = sessionOver(blank())
    const editor: ReportEditor = createReportEditor(session, { images: recordingStore(() => (editor.dispose(), { ok: true })) })
    expect(await editor.addImage(chosen('logo.png', PNG))).toEqual({ ok: false, code: 'disposed', message: t('status.disposed') })
    expect(session.document().assets).toEqual([])
    const file = chosen('logo.png', PNG)
    expect(await editor.addImage(file)).toEqual({ ok: false, code: 'disposed', message: t('status.disposed') })
    expect(file.reads()).toBe(0)
    // Closed while the file is read: the host is never asked.
    const store = recordingStore()
    const reading = createReportEditor(session, { images: store })
    const read = { name: 'logo.png', size: PNG.length, arrayBuffer: async () => (reading.dispose(), Uint8Array.from(PNG).buffer) }
    expect(await reading.addImage(read)).toEqual({ ok: false, code: 'disposed', message: t('status.disposed') })
    expect(store.offered).toEqual([])
  })

  // The host keeps what prints, and an SVG prints as cleanSvg writes it:
  // the file as chosen, its script included, must never reach the host, and
  // its digest must be the cleaned drawing's, which the renderer checks.
  test('hands the host an SVG as cleaned, and says what cleaning removed', async () => {
    const store = recordingStore()
    const { editor, session } = editorOver(blank(), { images: store })
    const cleaned = cleanSvg(utf8(MARK))
    if (!cleaned.ok) throw new Error(cleaned.message)
    ok(await editor.addImage(chosen('mark.svg', utf8(MARK))))
    expect(store.kept).toEqual([
      { asset: 'mark', mediaType: 'image/svg+xml', digest: assetDigest(cleaned.bytes), bytes: cleaned.bytes, fileName: 'mark.svg', width: 40, height: 20 },
    ])
    expect(session.document().assets).toEqual([{ id: 'mark', mediaType: 'image/svg+xml', digest: assetDigest(cleaned.bytes) }])
    const names = new Intl.ListFormat('en', { type: 'conjunction' }).format([t('images.svgDeclaration'), t('images.svgComment'), 'metadata', 'script'])
    expect(editor.state().status.text).toBe(`${added('mark')} ${t('images.cleaned', { names })}`)
    // A drawing cleaning leaves whole is added without a word about cleaning.
    ok(
      await editor.addImage(
        chosen('plain.svg', utf8('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10" fill="#000000"/></svg>')),
      ),
    )
    expect(editor.state().status.text).toBe(added('plain'))
  })

  // cleanSvg repeats no name it cannot show -- too long, or past ASCII --
  // and says it in English instead, which a German author would read as
  // the one English phrase on the page: the editor says it in theirs.
  test('says a removed name cleanSvg will not repeat in the editor’s words', async () => {
    const de = editorText('de-CH')
    const long = 'y'.repeat(70)
    const { editor } = editorOver(blank(), { images: recordingStore(), locale: 'de-CH' })
    ok(
      await editor.addImage(
        chosen(
          'mark.svg',
          utf8(`<svg xmlns="http://www.w3.org/2000/svg" xmlns:x="urn:x" viewBox="0 0 10 10"><x:${long}/><rect width="1" height="1" x:${long}="1"/></svg>`),
        ),
      ),
    )
    const names = new Intl.ListFormat('de-CH', { type: 'conjunction' }).format(['xmlns:x', de('images.svgElement'), de('images.svgAttribute')])
    expect(editor.state().status.text).toBe(`${de('images.added', { id: 'mark', kind: de('kind.image') })} ${de('images.cleaned', { names })}`)
    expect(editor.state().status.text).toContain('ein Element aus einem anderen Namensraum')
  })

  // cleanSvg lists the first names it removed and counts the rest; the live
  // region says the count, not fifty thousand names.
  test('says how many more cleaning removed past the names it lists', async () => {
    const many = Array.from({ length: 40 }, (_, index) => `data-a${index}="1"`).join(' ')
    const { editor } = editorOver(blank(), { images: recordingStore() })
    ok(
      await editor.addImage(chosen('many.svg', utf8(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="1" height="1" ${many}/></svg>`))),
    )
    const names = new Intl.ListFormat('en', { type: 'conjunction' }).format([
      ...Array.from({ length: 32 }, (_, index) => `data-a${index}`),
      t('images.cleanedMore', { count: '8' }),
    ])
    expect(editor.state().status.text).toBe(`${added('many')} ${t('images.cleaned', { names })}`)
  })

  // Each refusal of 0030 says what to do in the editor's words: "unsupported"
  // in English alone would leave a German author with nothing to try, and a
  // file that is no SVG at all is said as any file that is no image is.
  test.each([
    ['text', `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><text>Hi</text></svg>`, 'images.reason.svgText'],
    [
      'raster',
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><image href="data:image/png;base64,AAAA" width="1" height="1"/></svg>`,
      'images.reason.svgRaster',
    ],
    ['not-svg', '<html/>', 'images.reason.notImage'],
    ['not-well-formed', `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect></svg>`, 'images.reason.svgBroken'],
    ['doctype', `<!DOCTYPE svg [<!ENTITY a "b">]><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"/>`, 'images.reason.svgDoctype'],
    ['reference', `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><use href="#x"/></svg>`, 'images.reason.svgReference'],
    ['unsupported', `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><foreignObject/></svg>`, 'images.reason.svgUnsupported'],
    ['out-of-range', `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 0.5 10"><rect width="1" height="1"/></svg>`, 'images.reason.svgRange'],
    [
      'too-deep',
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10">${'<g>'.repeat(40)}<rect width="1" height="1"/>${'</g>'.repeat(40)}</svg>`,
      'images.reason.svgDeep',
    ],
    [
      'too-large',
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><!--${' '.repeat(1_048_576)}--><rect width="1" height="1"/></svg>`,
      'images.reason.svgLarge',
    ],
  ] as const)('refuses an SVG cleanSvg refuses as %s, saying what to do', async (code, text, reason) => {
    expect(cleanSvg(utf8(text))).toMatchObject({ ok: false, code })
    const store = recordingStore()
    const { editor } = editorOver(blank(), { images: store })
    expect(await editor.addImage(chosen('mark.svg', utf8(text)))).toEqual({ ok: false, code: 'not-an-image', message: refused('mark.svg', t(reason)) })
    expect(store.offered).toEqual([])
  })

  // A UTF-16 SVG is an SVG saved the wrong way, not something else: the
  // person is told to save it as UTF-8.
  test('tells a person to save a UTF-16 SVG as UTF-8', async () => {
    const { editor } = editorOver(blank(), { images: recordingStore() })
    const wide = Uint8Array.from([0xff, 0xfe, ...[...'<svg/>'].flatMap((char) => [char.charCodeAt(0), 0])])
    expect(await editor.addImage(chosen('mark.svg', wide))).toMatchObject({ message: refused('mark.svg', t('images.reason.svgEncoding')) })
  })

  // What the renderer refuses at every print is refused at the door, in
  // the person's numbers: a host would otherwise keep a picture no report
  // can print. A JPEG turned by its Exif is as wide as it is shown.
  test('holds a PNG or a JPEG to what the renderer prints, sized as it is shown', async () => {
    const store = recordingStore()
    const { editor } = editorOver(blank(), { images: store, locale: 'de-CH' })
    const de = editorText('de-CH')
    const number = new Intl.NumberFormat('de-CH')
    const wide = de('images.reason.tooWide', { width: number.format(5000), height: '1', side: number.format(4096) })
    expect(await editor.addImage(chosen('wide.png', png(5000, 1)))).toMatchObject({
      code: 'not-an-image',
      message: de('images.refused', { name: 'wide.png', reason: wide }),
    })
    expect(await editor.addImage(chosen('tall.jpg', jpeg(1, 4097)))).toMatchObject({ code: 'not-an-image' })
    expect(await editor.addImage(chosen('empty.png', png(0, 1)))).toMatchObject({
      message: de('images.refused', { name: 'empty.png', reason: de('images.reason.noPixels', { width: '0', height: '1' }) }),
    })
    expect(await editor.addImage(chosen('broken.png', png(2, 1, true)))).toMatchObject({
      message: de('images.refused', { name: 'broken.png', reason: de('images.reason.malformed', { type: 'PNG' }) }),
    })
    expect(store.offered).toEqual([])
    ok(await editor.addImage(chosen('turned.jpg', jpeg(3, 2, 6))))
    expect(store.kept.map(({ width, height }) => [width, height])).toEqual([[2, 3]])
  })

  // A Factur-X invoice prints as a PDF/A-3b whose output intent is sRGB
  // (0031), beside which no image may be CMYK: a CMYK JPEG kept and
  // declared in one printed in the preview and was refused at every final
  // render. It is refused at the door instead, saying what to do; elsewhere
  // it prints.
  test('refuses a CMYK JPEG in a Factur-X invoice, and adds it to any other report', async () => {
    const cmyk = jpeg(16, 16, undefined, 4)
    const store = recordingStore()
    const { editor, session } = editorOver(eInvoiceReport(), { images: store, locale: 'de-CH' })
    const de = editorText('de-CH')
    expect(await editor.addImage(chosen('logo-druckerei.jpg', cmyk))).toEqual({
      ok: false,
      code: 'not-an-image',
      message: de('images.refused', { name: 'logo-druckerei.jpg', reason: de('images.reason.cmykEInvoice') }),
    })
    expect(store.offered).toEqual([])
    expect(session.canUndo()).toBe(false)
    ok(await editor.addImage(chosen('logo.jpg', jpeg(16, 16))))
    const plain = editorOver(blank(), { images: recordingStore() })
    ok(await plain.editor.addImage(chosen('logo-druckerei.jpg', cmyk)))
    expect(plain.session.document().assets.map((declared) => declared.mediaType)).toEqual(['image/jpeg'])
  })

  // An XRechnung's PDF is a plain copy, no PDF/A (0038), and the renderer
  // draws a CMYK JPEG in it as in any report: refused at the door, a print
  // shop's logo would be kept from a report that can print it, and the
  // builder and the renderer would disagree on what an XRechnung holds.
  test('adds a CMYK JPEG to an XRechnung, whose copy is no PDF/A', async () => {
    const store = recordingStore()
    const { editor, session } = editorOver(xrechnungReport(), { images: store })
    ok(await editor.addImage(chosen('logo-druckerei.jpg', jpeg(16, 16, undefined, 4))))
    expect(store.kept).toHaveLength(1)
    expect(session.document().assets.map((declared) => declared.mediaType)).toEqual(['image/jpeg'])
  })

  // An editor that offered a kind the host will not keep would lead the
  // person to choose a file only to be refused it.
  test('offers and takes only what the host keeps', async () => {
    const store = recordingStore(undefined, ['image/png'])
    const { editor, session } = editorOver(blank(), { images: store })
    expect(editor.state().images.accept).toBe('image/png,.png')
    expect(await editor.addImage(chosen('mark.svg', utf8(MARK)))).toEqual({
      ok: false,
      code: 'not-an-image',
      message: refused('mark.svg', t('images.reason.notAccepted')),
    })
    ok(await editor.addImage(chosen('logo.png', PNG)))
    expect(session.document().assets.map((declared) => declared.mediaType)).toEqual(['image/png'])
    expect(editorOver(blank(), { images: recordingStore() }).editor.state().images.accept).toBe('image/png,.png,image/jpeg,.jpg,.jpeg,image/svg+xml,.svg')
  })

  // A store that keeps nothing, or a type nobody draws, is the host's
  // mistake, refused when the editor is made rather than met by a person.
  test('refuses a store that keeps nothing, a type it does not know, or no way to keep', () => {
    const session = sessionOver(blank())
    expect(() => createReportEditor(session, { images: recordingStore(undefined, []) })).toThrow(RangeError)
    expect(() => createReportEditor(session, { images: recordingStore(undefined, ['image/gif' as never]) })).toThrow(RangeError)
    expect(() => createReportEditor(session, { images: { keep: 'somewhere' } as never })).toThrow(RangeError)
    expect(() => createReportEditor(session, { images: null as never })).toThrow(RangeError)
    expect(() => createReportEditor(session, { images: { ...recordingStore(), accept: 'image/png' as never } })).toThrow(RangeError)
  })

  // Without a store there is nowhere for the bytes: no Add image… is drawn,
  // and an add asked anyway says so and reads nothing.
  test('without a store, offers no Add image… and says why', async () => {
    const { editor, session } = editorOver(blank())
    expect(editor.state().images).toEqual({ store: false, accept: '', adding: null, assets: [] })
    expect(editor.state().can.addImage).toBe(false)
    expect(editor.dispatch({ type: 'chooseImage' })).toEqual({ ok: false, code: 'unavailable', message: t('images.none') })
    const file = chosen('logo.png', PNG)
    expect(await editor.addImage(file)).toEqual({ ok: false, code: 'unavailable', message: t('images.none') })
    expect(file.reads()).toBe(0)
    expect(session.canUndo()).toBe(false)
  })

  // Bytes kept for an asset the validator refuses -- one past MAX_ASSETS --
  // are kept for nothing; the count said is the format's, never typed.
  test('refuses another image once the report holds all it may', async () => {
    const full = {
      ...blank(),
      assets: Array.from({ length: MAX_ASSETS }, (_, index) => ({
        id: `image-${index}`,
        mediaType: 'image/png' as const,
        digest: `sha256:${index.toString(16).padStart(64, '0')}`,
      })),
    }
    const { editor } = editorOver(full, { images: recordingStore() })
    const message = t('images.full', { count: String(MAX_ASSETS) })
    expect(editor.state().images.unavailable).toBe(message)
    expect(editor.state().can.addImage).toBe(false)
    expect(editor.dispatch({ type: 'chooseImage' })).toEqual({ ok: false, code: 'unavailable', message })
    const file = chosen('logo.png', PNG)
    expect(await editor.addImage(file)).toEqual({ ok: false, code: 'unavailable', message })
    expect(file.reads()).toBe(0)
  })

  // Each phase of an add is told once: the add chosen, and what became of
  // it. A listener that throws -- another builder's, after the edit stood
  // -- leaves the add finished and is thrown once it is, as dispatch does.
  test('tells listeners once per phase, and throws a listener’s error once the add is done', async () => {
    const { editor, session } = editorOver(blank(), { images: recordingStore() })
    let heard = 0
    const unsubscribe = editor.subscribe(() => (heard += 1))
    ok(await editor.addImage(chosen('logo.png', PNG)))
    expect(heard).toBe(2)
    unsubscribe()
    let calls = 0
    editor.subscribe(() => {
      calls += 1
      if (calls === 1) throw new Error('drawn badly while adding')
      if (session.document().assets.length === 2) throw new Error('drawn badly once added')
    })
    await expect(editor.addImage(chosen('mark.png', png(3, 1)))).rejects.toThrow(AggregateError)
    expect(session.document().assets.map((declared) => declared.id)).toEqual(['logo', 'mark'])
    expect(editor.state().images.adding).toBeNull()
    expect(editor.state().status.text).toBe(added('mark'))
  })

  // A host's session that refuses the edit -- read-only for now -- leaves
  // the report as it was, and its reason is said; an add or a remove that
  // said it was done would be a step nobody can find.
  test('says a session’s refusal of the add or the remove', async () => {
    const open = sessionOver(declaring(asset('logo', 'a'), asset('unused', 'b')))
    const refuses = (): Refusal => ({ ok: false, code: 'invalid-document', message: 'this report is read only' })
    const readOnly: ReportSession = { ...open, apply: refuses }
    const editor = createReportEditor(readOnly, { images: recordingStore() })
    expect(await editor.addImage(chosen('mark.png', PNG))).toMatchObject({
      ok: false,
      code: 'refused',
      message: refused('mark.png', 'this report is read only'),
      refusal: { code: 'invalid-document' },
    })
    expect(editor.dispatch({ type: 'removeImage', asset: 'unused' })).toMatchObject({
      ok: false,
      code: 'refused',
      message: t('status.refused', { name: 'unused', reason: 'this report is read only' }),
    })
    expect(open.document().assets.map((declared) => declared.id)).toEqual(['logo', 'unused'])
  })

  // A host's session that throws as it commits -- one kept read-only by its
  // host -- makes the add fail with its error, and the editor lets go of the
  // file all the same: an editor left busy would take no image again.
  test('lets go of the file when the commit throws, and rejects with the error', async () => {
    const open = sessionOver(blank())
    const editor = createReportEditor(
      {
        ...open,
        apply: () => {
          throw new Error('read only')
        },
      },
      { images: recordingStore() },
    )
    await expect(editor.addImage(chosen('logo.png', PNG))).rejects.toThrow('read only')
    expect(editor.state().images.adding).toBeNull()
    expect(editor.dispatch({ type: 'chooseImage' })).toEqual({ ok: true })
  })

  // The library is the report's images, each by what it is and what draws
  // it, so a person knows before pressing Remove why it will not go.
  test('lists the report’s images, each with what draws it', () => {
    const report = richReport()
    const twice = {
      ...report,
      assets: [...report.assets, asset('mark', 'e')],
      regions: {
        ...report.regions,
        summary: [
          ...report.regions.summary,
          { id: 'logo-again', kind: 'image' as const, source: { kind: 'asset' as const, asset: 'logo' }, width: 50, height: 20, fit: 'contain' as const },
        ],
      },
    }
    const { editor } = editorOver(twice, { locale: 'de-CH' })
    const de = editorText('de-CH')
    const labels = editor
      .state()
      .outline.flatMap((region) => region.nodes)
      .flatMap(function all(node): string[] {
        return [node.label, ...node.children.flatMap(all)]
      })
    const drawing = labels.filter((label) => label.startsWith(de('kind.image')) && label.includes('logo'))
    expect(drawing).toHaveLength(2)
    expect(editor.state().images.assets).toEqual([
      {
        id: 'logo',
        label: de('images.item', { id: 'logo', type: 'PNG' }),
        removeLabel: de('images.removeOne', { id: 'logo' }),
        inUse: de('images.inUse', { names: new Intl.ListFormat('de-CH', { type: 'conjunction' }).format(drawing) }),
      },
      { id: 'mark', label: de('images.item', { id: 'mark', type: 'PNG' }), removeLabel: de('images.removeOne', { id: 'mark' }) },
    ])
  })

  // A font asset a report maps is no picture (0043): listed as an image, it
  // would be offered for removal from under the text it prints, and its
  // label would name an image format it has not. The library is images alone.
  test('lists no font asset among the images', () => {
    const report = richReport()
    const branded: ReportDefinition = {
      ...report,
      assets: [...report.assets, { id: 'brand', mediaType: 'font/ttf', digest: `sha256:${'c3'.repeat(32)}` }],
      fonts: { sans: { normal: 'brand' } },
    }
    const { editor } = editorOver(branded)
    expect(editor.state().images.assets.map((listed) => listed.id)).toEqual(report.assets.map((declared) => declared.id))
  })
})

describe('removing an image', () => {
  const session = (): { editor: ReportEditor; session: ReportSession } => editorOver(declaring(asset('logo', 'a'), asset('unused', 'b')))

  // An image nothing draws is clutter a person can now clear; one step,
  // undone back to where it stood in the report's order.
  test('removes an image nothing draws in one undo step', () => {
    const { editor, session: over } = session()
    ok(editor.dispatch({ type: 'removeImage', asset: 'unused' }))
    expect(over.document().assets.map((declared) => declared.id)).toEqual(['logo'])
    expect(editor.state().status.text).toBe(t('images.removed', { id: 'unused' }))
    expect(over.undoLabel()).toBe('Remove image')
    ok(editor.dispatch({ type: 'undo' }))
    expect(over.document().assets.map((declared) => declared.id)).toEqual(['logo', 'unused'])
  })

  // Removing an image something draws would leave an image of nothing; the
  // validator would refuse it too, in words about a path, where the person
  // needs to hear what draws it.
  test('refuses to remove an image something draws, saying what draws it', () => {
    const { editor, session: over } = session()
    const before = over.revision()
    const inUse = t('images.inUse', { names: t('label.kindDetail', { kind: t('kind.image'), detail: 'logo' }) })
    expect(editor.dispatch({ type: 'removeImage', asset: 'logo' })).toEqual({ ok: false, code: 'unavailable', message: inUse })
    expect(editor.state().images.assets[0]?.inUse).toBe(inUse)
    expect(editor.dispatch({ type: 'removeImage', asset: 'nothing' })).toEqual({
      ok: false,
      code: 'not-found',
      message: t('status.notFound', { name: 'nothing' }),
    })
    expect(over.revision()).toBe(before)
  })
})
