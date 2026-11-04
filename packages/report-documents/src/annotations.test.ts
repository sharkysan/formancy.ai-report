import { deflate } from 'pako'
import { describe, expect, test } from 'vitest'
import { annotated, annotation, expectAnnotationRefused, form, widget } from './annotations-test-support.js'
import { MAX_DOCUMENT_INFLATED, MAX_DOCUMENT_PAGES, MAX_DOCUMENT_VALUES } from './limits.js'
import { Tally } from './notices.js'
import { pagesOf, type PrintablePage } from './pages.js'
import { AT_A_BOUND, parsed } from './parse-test-support.js'
import { Counted, expectPrintRefused, letter, outcome, pagesFile, pagesRead, printedWhole } from './pages-test-support.js'
import { refusal } from './refusals.js'
import { CONTENT, deflatedZeros, latin1 } from './test-pdf.js'

/**
 * A page's annotations, flattened into what prints by the print rule: each
 * that prints drawn as the appearance its file holds, placed over its
 * rectangle; what a print cannot draw as a viewer shows it refused, naming
 * the annotation and the page and nothing the file wrote; and what does
 * not survive printing counted.
 */

describe('an annotation prints the appearance its file holds', () => {
  // A filled field shows its value only through the appearance its file
  // holds: drawn at the form's own size, or anywhere but its rectangle,
  // the value would print beside or across the line it was typed on. ISO
  // 32000-1 12.5.5 maps the form's box onto the rectangle -- here a box of
  // 100 by 20 onto a rectangle of 200 by 40 at (72, 700), twice its size --
  // and what the form draws with is the closure's, as a page's is.
  test('a filled text field prints its appearance at its rectangle', () => {
    const whole = printedWhole(
      annotated([widget('/FT/Tx/T(Name)/V(Jane Doe)/Rect[72 700 272 740]/AP<</N 40 0 R>>')], {
        objects: { 40: form('[0 0 100 20]', '/Resources<</Font<</Helv 41 0 R>>>>'), 41: '<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>' },
      }),
    )
    const appearances = whole.pages[0]?.appearances ?? []
    expect(appearances).toHaveLength(1)
    expect(appearances[0]?.matrix).toEqual([2, 0, 0, 2, 72, 700])
    expect(appearances[0]?.form).toBe(whole.parsed.objects.get(40))
    expect([...whole.closure.keys()]).toEqual([41])
  })

  // A form drawn turned within its own space covers, once turned, another
  // box than its /BBox, and ISO 32000-1 12.5.5 maps that box onto the
  // rectangle: placed by its /BBox alone, a stamp turned a quarter would
  // print squashed, and beside its rectangle. A box of 100 by 20 turned a
  // quarter anticlockwise covers [-20 0 0 100], here mapped onto a
  // rectangle of 40 by 200 at (100, 100); the form's own /Matrix is left
  // for Do to apply.
  test('an appearance with its own /Matrix turned a quarter is mapped by its turned box', () => {
    const [page] = pagesRead(
      annotated([annotation('Stamp', '/Rect[100 100 140 300]/AP<</N 40 0 R>>')], { objects: { 40: form('[0 0 100 20]', '/Matrix[0 1 -1 0 0 0]') } }),
    )
    expect(page?.appearances.map((drawn) => drawn.matrix)).toEqual([[2, 0, 0, 2, 140, 100]])
  })

  // A rectangle is two corners in either order, and a form's box need not
  // stand at its origin, nor its matrix leave it there: each is placed by
  // where its corners fall, so that a box at (10, 10) moved by (5, 5) is
  // drawn from the rectangle's corner and not 30 points past it, and a
  // rectangle written right to left is not drawn at a negative size.
  test('a rectangle written right to left, and a box away from its origin, are placed by their corners', () => {
    const [page] = pagesRead(
      annotated([annotation('Stamp', '/Rect 30 0 R/AP<</N 40 0 R>>')], {
        objects: { 30: '[200 31 0 R 0 0]', 31: '40', 40: form('[10 10 110 30]', '/Matrix[1 0 0 1 5 5]') },
      }),
    )
    expect(page?.appearances.map((drawn) => drawn.matrix)).toEqual([[2, 0, 0, 2, -30, -30]])
  })

  // A checkbox holds an appearance for each of its states and shows the
  // one /AS names: printed by another, a box the person ticked would print
  // empty. One that names no state, or a state it holds no appearance for,
  // shows nothing in one viewer and the first state it holds in another.
  test('a checkbox prints the state /AS names, and a missing state is appearance-state-missing', () => {
    const box = (state: string): string => widget(`/FT/Btn${state}/Rect[72 600 92 620]/AP<</N<</Yes 40 0 R/Off 41 0 R>>>>`)
    const objects = { 40: form('[0 0 20 20]'), 41: form('[0 0 20 20]'), 42: '/Yes' }
    const whole = printedWhole(annotated([box('/AS/Yes'), box('/AS/Off'), box('/AS 42 0 R')], { objects }))
    const forms = whole.pages[0]?.appearances.map((drawn) => drawn.form) ?? []
    expect(forms).toHaveLength(3)
    expect(forms[0]).toBe(whole.parsed.objects.get(40))
    expect(forms[1]).toBe(whole.parsed.objects.get(41))
    expect(forms[2]).toBe(whole.parsed.objects.get(40))
    for (const state of ['/AS/Maybe', '', '/AS(Yes)']) {
      expectAnnotationRefused(annotated([box(state)], { objects }), 'appearance-state-missing', 'appearance-state', 1, { index: 1, subtype: 'Widget' })
    }
  })

  // A filled field with no appearance would print blank where the person
  // typed their value, and making one is a later record's: refused. Where
  // is said as the reader counts it -- the page, the annotation's place in
  // the page's list from 1, its subtype where ISO 32000 defines one -- and
  // with nothing the file wrote: not the field's name, its tooltip, its
  // value or its contents, nor a subtype the reader does not know or one
  // written as a string, any of which may be a person's data.
  test("a field with a value and no appearance is refused as annotation-without-appearance, naming the page and the annotation's index, never the field's name or value", () => {
    const filled = widget('/FT/Tx/T(Applicant SSN)/TU(Social security number)/V(123-45-6789)/Contents(Private)/Rect[72 700 272 740]')
    expectAnnotationRefused(pagesFile([letter(), letter('/Annots[null 20 0 R]')], { 20: filled }), 'annotation-without-appearance', 'no-appearance', 2, {
      index: 2,
      subtype: 'Widget',
    })
    expectAnnotationRefused(annotated([annotation('Applicant#20SSN', '/Rect[72 700 272 740]')]), 'annotation-without-appearance', 'no-appearance', 1, {
      index: 1,
      subtype: undefined,
    })
    const unnamed = '<</Type/Annot/Subtype(Widget)/F 4/T(Applicant SSN)/V(123-45-6789)/Rect[72 700 272 740]>>'
    expectAnnotationRefused(annotated([unnamed]), 'annotation-without-appearance', 'no-appearance', 1, { index: 1, subtype: undefined })
  })

  // An appearance is a form XObject (ISO 32000-1 12.5.5): an /AP that is
  // no dictionary or holds no /N, an /N that is neither a form nor a
  // dictionary of states, a state that is no stream, or a stream that says
  // it is an image, is none, and drawn as one would draw the wrong thing or
  // nothing. A form that does not say what it is is a form.
  test('an appearance that is not a form is no appearance', () => {
    const square = (entries: string, objects = {}): Uint8Array => annotated([annotation('Square', `/Rect[0 0 10 10]${entries}`)], { objects })
    const image = { dict: '/Type/XObject/Subtype/Image/Width 1/Height 1/ColorSpace/DeviceGray/BitsPerComponent 8', data: new Uint8Array(1) }
    for (const file of [
      square('/AP 40 0 R', { 40: '[1 2]' }),
      square('/AP<</D 40 0 R>>', { 40: form('[0 0 10 10]') }),
      square('/AP<</N 5>>'),
      square('/AS/On/AP<</N<</On 40 0 R>>>>', { 40: '<<>>' }),
      square('/AS/On/AP<</N<</On 99 0 R>>>>'),
      square('/AP<</N 40 0 R>>', { 40: image }),
    ]) {
      expectAnnotationRefused(file, 'annotation-without-appearance', 'no-appearance', 1, { index: 1, subtype: 'Square' })
    }
    const bare = square('/AP<</N 40 0 R>>', { 40: { dict: '/BBox[0 0 10 10]', data: CONTENT } })
    const named = square('/AP<</N 40 0 R>>', { 40: { dict: '/Type/XObject/Subtype 41 0 R/BBox[0 0 10 10]', data: CONTENT }, 41: '/Form' })
    expect(pagesRead(bare)[0]?.appearances).toHaveLength(1)
    expect(pagesRead(named)[0]?.appearances).toHaveLength(1)
  })

  // A form that asks the viewer to draw its fields holds appearances it
  // says are stale, or none: printed as they are, its fields would show
  // values the person never typed, or none. Refused before any annotation
  // is read, so that a field refused for its own fault is not what the
  // person is told, however its catalog writes the request.
  test('NeedAppearances is refused before any annotation is read', () => {
    const file = (acroForm: string, objects = {}): Uint8Array =>
      annotated([widget('/FT/Tx/V(x)/Rect[0 0 10 10]')], { catalog: `/AcroForm ${acroForm}`, objects })
    expectPrintRefused(file('<</Fields[20 0 R]/NeedAppearances true>>'), 'needs-appearances', 'need-appearances')
    expectPrintRefused(file('30 0 R', { 30: '<</Fields[20 0 R]/NeedAppearances 31 0 R>>', 31: 'true' }), 'needs-appearances', 'need-appearances')
    expectAnnotationRefused(file('<</Fields[20 0 R]/NeedAppearances false>>'), 'annotation-without-appearance', 'no-appearance', 1, {
      index: 1,
      subtype: 'Widget',
    })
  })

  // A form drawn from XFA is drawn by a viewer that reads the XFA, which
  // Report does not, and its pages may hold nothing but a line asking the
  // reader to wait: printed as they are, they would show that line, or
  // fields as stale as NeedAppearances says. Refused, whether the XFA is
  // a list of packets or one stream, or the catalog says it must be
  // rendered, before NeedAppearances and before any annotation is read; a
  // form of fields alone reads.
  test('an XFA form is refused as needs-appearances before any annotation is read', () => {
    const packet = { dict: '', data: latin1('<xdp:xdp/>') }
    const file = (catalog: string, objects = {}): Uint8Array =>
      annotated([widget('/FT/Tx/V(x)/Rect[0 0 10 10]')], { catalog, objects: { 30: packet, 31: 'true', ...objects } })
    expectPrintRefused(file('/AcroForm<</Fields[20 0 R]/XFA[(template) 30 0 R]>>'), 'needs-appearances', 'xfa')
    expectPrintRefused(file('/AcroForm<</Fields[20 0 R]/XFA 30 0 R/NeedAppearances true>>'), 'needs-appearances', 'xfa')
    expectPrintRefused(file('/AcroForm<</Fields[20 0 R]/XFA 32 0 R>>', { 32: '[(template) 30 0 R]' }), 'needs-appearances', 'xfa')
    expectPrintRefused(file('/NeedsRendering true'), 'needs-appearances', 'xfa')
    expectPrintRefused(file('/NeedsRendering 31 0 R'), 'needs-appearances', 'xfa')
    const fields = annotated([widget('/FT/Tx/V(x)/Rect[0 0 10 10]/AP<</N 40 0 R>>')], {
      catalog: '/AcroForm<</Fields[20 0 R]>>/NeedsRendering false',
      objects: { 40: form('[0 0 10 10]') },
    })
    expect(pagesRead(fields)[0]?.appearances).toHaveLength(1)
  })
})

describe('an annotation the print rule leaves out', () => {
  // Report prints, so an annotation prints as a print would: one without
  // the Print flag -- a sticky note, a reviewer's comment -- is shown on
  // screen and never printed, and drawn here would put a reviewer's note
  // into a customer's report. It is counted, so that the author is told
  // what the viewer showed them and the report does not.
  test('an annotation without the Print flag is not drawn and is counted', () => {
    const note = (flags: number): string => annotation('Text', '/Rect[72 700 92 720]/Contents(Call the client)/AP<</N 40 0 R>>', flags)
    const unflagged = '<</Type/Annot/Subtype/Text/Rect[72 700 92 720]/AP<</N 40 0 R>>>>'
    // Flags written as a reference to no object are none, as they are absent (ISO 32000-1 7.3.10).
    const dangling = annotation('Text', '/Rect[0 0 10 10]', '99 0 R')
    const whole = printedWhole(annotated([note(0), note(32), unflagged, dangling], { objects: { 40: form('[0 0 20 20]') } }))
    expect(whole.pages[0]?.appearances).toEqual([])
    expect(whole.notices).toEqual([{ code: 'unprinted-annotations', count: 4 }])
  })

  // A hidden annotation is shown by no viewer and printed by none, whatever
  // its Print flag says (ISO 32000-1 12.5.3).
  test('a hidden annotation is not drawn and is counted', () => {
    const stamp = (flags: number): string => annotation('Stamp', '/Rect[72 700 172 750]/AP<</N 40 0 R>>', flags)
    const whole = printedWhole(annotated([stamp(6), stamp(2)], { objects: { 40: form('[0 0 100 50]') } }))
    expect(whole.pages[0]?.appearances).toEqual([])
    expect(whole.notices).toEqual([{ code: 'unprinted-annotations', count: 2 }])
  })

  // An annotation of a subtype ISO 32000 does not define, marked
  // Invisible, is shown by no viewer that has no handler for it, and so
  // printed by none (ISO 32000-1 Table 165): drawn here, the report would
  // print what the person never saw. A subtype ISO defines is shown
  // whatever the flag says, and so is one that is not marked.
  test('an annotation of a subtype ISO does not define, marked Invisible, is not drawn and is counted', () => {
    const objects = { 40: form('[0 0 10 10]') }
    const unknown = (flags: number): string => annotation('Foo', '/Rect[0 0 10 10]/AP<</N 40 0 R>>', flags)
    const unnamed = '<</Type/Annot/F 5/Rect[0 0 10 10]/AP<</N 40 0 R>>>>'
    const hidden = printedWhole(annotated([unknown(5), unnamed], { objects }))
    expect(hidden.pages[0]?.appearances).toEqual([])
    expect(hidden.notices).toEqual([{ code: 'unprinted-annotations', count: 2 }])
    const shown = printedWhole(annotated([annotation('Stamp', '/Rect[0 0 10 10]/AP<</N 40 0 R>>', 5), unknown(4)], { objects }))
    expect(shown.pages[0]?.appearances).toHaveLength(2)
    expect(shown.notices).toEqual([])
  })

  // A link, a field or an attachment the print leaves out is still a link,
  // a field or an attachment that does not survive printing, and the
  // person is told so in those words, once: a LaTeX document's links carry
  // no Print flag, and drawing their border on screen alone, they are not
  // refused for it.
  test('what the print rule leaves out is counted as what it is, once', () => {
    const whole = printedWhole(
      annotated(
        [
          annotation('Link', '/Rect[72 700 172 712]/Border[0 0 1]/A<</S/URI/URI(https://example.com)>>', 0),
          widget('/FT/Tx/V(x)/Rect[72 600 172 620]', 2),
          annotation('FileAttachment', '/Rect[72 500 92 520]/FS 30 0 R', 0),
        ],
        { objects: { 30: '<</Type/Filespec/F(a.txt)>>' } },
      ),
    )
    expect(whole.pages[0]?.appearances).toEqual([])
    expect(whole.notices).toEqual([
      { code: 'links', count: 1 },
      { code: 'attachments', count: 1 },
      { code: 'form-fields', count: 1 },
    ])
  })

  // A popup shows the text of the annotation it belongs to and is never
  // drawn by itself (ISO 32000-1 12.5.6.14): neither printed nor counted,
  // whatever its flags and whatever it holds, so that a note's window is
  // not counted a second time beside the note.
  test('a Popup is never drawn by itself, and never counted', () => {
    const whole = printedWhole(
      annotated(
        [
          annotation('Popup', '/Rect[72 600 272 700]/AP<</N 40 0 R>>'),
          annotation('Popup', '/Rect[72 600 272 700]', 0),
          annotation('Popup', '/Rect[72 600 272 700]'),
        ],
        { objects: { 40: form('[0 0 200 100]') } },
      ),
    )
    expect(whole.pages[0]?.appearances).toEqual([])
    expect(whole.notices).toEqual([])
  })

  // An annotation in a layer is hidden by a viewer with the layer and
  // drawn by a print that copies its appearance: refused, as anything a
  // page draws with is, whether it prints or not and whatever /OC names.
  // An appearance's form in a layer is the closure's to refuse, as a
  // page's forms are, its dictionary being a root of what the pages draw
  // with.
  test('an annotation that belongs to a layer is refused as optional-content', () => {
    expectAnnotationRefused(
      annotated([annotation('Square', '/OC 30 0 R/Rect[0 0 10 10]/AP<</N 40 0 R>>')], {
        objects: { 30: '<</Type/OCG/Name(Layer)>>', 40: form('[0 0 10 10]') },
      }),
      'optional-content',
      'layers',
      1,
      { index: 1, subtype: 'Square' },
    )
    expectAnnotationRefused(annotated([annotation('Text', '/OC 99 0 R/Rect[0 0 10 10]', 0)]), 'optional-content', 'layers', 1, { index: 1, subtype: 'Text' })
    const layered = { 30: '<</Type/OCG/Name(Layer)>>', 40: form('[0 0 10 10]', '/OC 30 0 R') }
    expectPrintRefused(annotated([annotation('Square', '/Rect[0 0 10 10]/AP<</N 40 0 R>>')], { objects: layered }), 'optional-content', 'layers')
  })
})

describe('a link', () => {
  // A link carries an action a print cannot, and draws nothing of its own
  // where it has no appearance and no border: it prints nothing, and is
  // counted, so that the author knows the document's links will not
  // follow. /BS's width decides over /Border's where both are given (ISO
  // 32000-1 12.5.4), and either may be written by reference. A border of
  // no colour -- /C an empty list -- is transparent (Table 164), and draws
  // nothing whatever its width.
  test('a Link with no appearance and no border is counted as a link and draws nothing', () => {
    const link = (border: string): string => annotation('Link', `/Rect[72 700 172 712]${border}`)
    const borders = [
      '/BS<</W 0>>',
      '/Border[0 0 0]',
      '/BS<</W 0>>/Border[0 0 1]',
      '/Border 30 0 R',
      '/BS<</W 31 0 R>>',
      '/C[]',
      '/C[]/Border[0 0 2]',
      '/C 32 0 R',
    ]
    const whole = printedWhole(annotated(borders.map(link), { objects: { 30: '[0 0 0]', 31: '0', 32: '[]' } }))
    expect(whole.pages[0]?.appearances).toEqual([])
    expect(whole.notices).toEqual([{ code: 'links', count: borders.length }])
  })

  // A link with no appearance whose border a viewer draws -- by default, a
  // solid line a point wide (ISO 32000-1 Table 164) -- would print without
  // it: refused, rather than printed otherwise than the viewer shows it,
  // in whatever colour it is drawn -- grey, RGB or CMYK. A link with an
  // appearance prints that, border or none.
  test('a Link with no appearance and a drawn border is refused as link-border', () => {
    const drawn = ['', '/Border[0 0 1]', '/Border[0 0]', '/BS<<>>', '/BS<</W 1>>/Border[0 0 0]', '/BS/Solid', '/C[0]', '/C[1 0 0]', '/C[0 0 0 1]/Border[0 0 2]']
    for (const border of drawn) {
      expectAnnotationRefused(annotated([annotation('Link', `/Rect[72 700 172 712]${border}`)]), 'link-border', 'link-border', 1, { index: 1, subtype: 'Link' })
    }
    const whole = printedWhole(annotated([annotation('Link', '/Rect[72 700 172 712]/AP<</N 40 0 R>>')], { objects: { 40: form('[0 0 100 12]') } }))
    expect(whole.pages[0]?.appearances).toHaveLength(1)
    expect(whole.notices).toEqual([{ code: 'links', count: 1 }])
  })
})

describe('an annotation on a turned page', () => {
  // An annotation that keeps upright (NoRotate) is shown upright on a
  // turned page, and its appearance, drawn into the page, would turn with
  // it: printed otherwise than it is shown, so refused -- on whichever
  // page the same annotation is listed turned -- and drawn where the page
  // is upright, or where nothing of it draws.
  test('NoRotate on a turned page is refused', () => {
    const upright = annotation('Stamp', '/Rect[72 700 172 750]/AP<</N 40 0 R>>', 20)
    const objects = { 40: form('[0 0 100 50]') }
    expectAnnotationRefused(annotated([upright], { objects, page: '/Rotate 90' }), 'annotation-turned', 'upright', 1, { index: 1, subtype: 'Stamp' })
    expect(pagesRead(annotated([upright], { objects }))[0]?.appearances).toHaveLength(1)
    const shared = pagesFile([letter('/Annots[20 0 R]'), letter('/Rotate 180/Annots[20 0 R]')], { 20: upright, ...objects })
    expectAnnotationRefused(shared, 'annotation-turned', 'upright', 2, { index: 1, subtype: 'Stamp' })
    const hidden = annotation('Stamp', '/Rect[72 700 172 750]/AP<</N 40 0 R>>', 22)
    const bare = annotation('Link', '/Rect[72 700 172 712]/Border[0 0 0]', 20)
    expect(pagesRead(annotated([hidden, bare], { objects, page: '/Rotate 270' }))[0]?.appearances).toEqual([])
  })
})

describe('a signed field', () => {
  // A visible signature prints as the appearance its file holds -- a name,
  // a date, the image of a hand -- and the signature itself, which a print
  // cannot carry, is counted, so that the author knows the report holds a
  // picture of it and not it. /FT and /V are a field's, which a widget
  // below it inherits (ISO 32000-1 12.7.3.1); a signature field no one has
  // signed is a field like any other.
  test('a visibly signed field prints its appearance and is counted as a signature', () => {
    const whole = printedWhole(
      annotated(
        [
          widget('/FT/Sig/T(Signature1)/V 30 0 R/Rect[72 100 272 150]/AP<</N 40 0 R>>'),
          widget('/Parent 31 0 R/Rect[300 100 500 150]/AP<</N 40 0 R>>'),
          widget('/FT/Sig/T(Unsigned)/Rect[72 200 272 250]/AP<</N 40 0 R>>'),
        ],
        {
          objects: {
            30: '<</Type/Sig/Filter/Adobe.PPKLite/SubFilter/adbe.pkcs7.detached/Name(Jane Doe)/Contents<00>>>',
            31: '<</FT/Sig/T(Signature2)/V 30 0 R/Kids[21 0 R]>>',
            40: form('[0 0 200 50]'),
          },
        },
      ),
    )
    expect(whole.pages[0]?.appearances.map((drawn) => drawn.matrix)).toEqual([
      [1, 0, 0, 1, 72, 100],
      [1, 0, 0, 1, 300, 100],
      [1, 0, 0, 1, 72, 200],
    ])
    expect(whole.notices).toEqual([
      { code: 'signatures', count: 2 },
      { code: 'form-fields', count: 1 },
    ])
  })

  // Most signatures are invisible: a widget of no area, which a viewer
  // draws nothing of whatever it holds, and which ISO 32000-2 (Table 166)
  // needs no appearance for. Refused for a missing appearance, every PDF
  // signed so would be; skipped uncounted, its signature would be lost
  // without a word. A form whose box, turned, has no area draws nothing
  // either.
  test('an annotation of no area draws nothing, needs no appearance, and is counted', () => {
    const whole = printedWhole(
      annotated(
        [
          widget('/FT/Sig/V 30 0 R/Rect[0 0 0 0]', 132),
          annotation('Text', '/Rect[72 700 72 720]'),
          annotation('Stamp', '/Rect[72 700 172 750]/AP<</N 40 0 R>>'),
          annotation('Stamp', '/Rect[72 700 172 750]/AP<</N 41 0 R>>'),
        ],
        { objects: { 30: '<</Type/Sig>>', 40: form('[0 0 0 50]'), 41: form('[0 0 100 50]', '/Matrix[0 0 0 0 0 0]') } },
      ),
    )
    expect(whole.pages[0]?.appearances).toEqual([])
    expect(whole.notices).toEqual([{ code: 'signatures', count: 1 }])
  })

  // A widget's field is found by climbing its /Parent, which a thousand
  // widgets may share under a chain of ten thousand fields: climbed from
  // each, ten million steps; here each field is read once, which the
  // objects map counts. A chain that reaches a field it climbed already
  // would be climbed for ever, and is refused -- held to a count too, so
  // that a climb that missed it stops rather than spins. A parent that
  // names nothing, or no dictionary, is where the chain ends.
  test('the fields above a widget are climbed once, however many widgets share them', AT_A_BOUND, () => {
    const widgets = 1_000
    const chain = 10_000
    const top = 2_000 + chain - 1
    const objects: Record<number, string> = { 5: '<</Type/Sig>>', [top]: '<</FT/Sig/V 5 0 R>>' }
    for (let num = 2_000; num < top; num += 1) objects[num] = `<</Parent ${num + 1} 0 R>>`
    const document = parsed(
      annotated(
        Array.from({ length: widgets }, () => widget('/Parent 2000 0 R/Rect[0 0 0 0]')),
        { objects },
      ),
    )
    const counted = new Counted(document.objects, 2 * (widgets + chain))
    const tally = new Tally()
    expect(outcome(pagesOf({ ...document, objects: counted }, tally))).toBe('read whole')
    expect(counted.gets).toBeLessThan(counted.limit)
    expect(tally.notices()).toEqual([{ code: 'signatures', count: widgets }])

    for (const [parent, objects] of [
      ['30', { 30: '<</Parent 31 0 R>>', 31: '<</Parent 30 0 R>>' }],
      ['20', {}],
    ] as const) {
      const cycled = parsed(annotated([widget(`/Parent ${parent} 0 R/Rect[0 0 0 0]`)], { objects }))
      const climbs = new Counted(cycled.objects, 100)
      expect(outcome(pagesOf({ ...cycled, objects: climbs }, new Tally()))).toEqual(refusal('fields', 1, { index: 1, subtype: 'Widget' }))
    }
    const ended = printedWhole(annotated([widget('/Parent 99 0 R/Rect[0 0 0 0]'), widget('/Parent 30 0 R/Rect[0 0 0 0]')], { objects: { 30: '[]' } }))
    expect(ended.notices).toEqual([{ code: 'form-fields', count: 2 }])
  })
})

describe('an appearance is decoded', () => {
  // An appearance's form is content a viewer of the report decodes, as a
  // page's is: decoded here, once however many annotations draw it, from
  // the document's one budget, and refused where it would pass it or
  // cannot be decoded, naming the annotation and the page.
  test("an appearance is decoded once against the document's budget, and refused where it cannot be", () => {
    const stamp = annotation('Stamp', '/Rect[0 0 10 10]/AP<</N 40 0 R>>')
    const flate = { dict: '/Type/XObject/Subtype/Form/BBox[0 0 10 10]/Filter/FlateDecode', data: deflate(CONTENT) }
    const whole = printedWhole(pagesFile([letter('/Annots[20 0 R 21 0 R]'), letter('/Annots[20 0 R]')], { 20: stamp, 21: stamp, 40: flate }))
    // Page 2 holds page 1's content again; the form, drawn three times, inflated once.
    expect(whole.parsed.budget.left).toBe(MAX_DOCUMENT_INFLATED - CONTENT.length - CONTENT.length)
    const drawing = (filter: string, data: Uint8Array): Uint8Array =>
      annotated([stamp], { objects: { 40: { dict: `/Type/XObject/Subtype/Form/BBox[0 0 10 10]${filter}`, data } } })
    const place = { index: 1, subtype: 'Stamp' } as const
    expectAnnotationRefused(drawing('/Filter/FlateDecode', deflatedZeros(MAX_DOCUMENT_INFLATED + 1)), 'inflates-too-far', 'inflated', 1, place)
    expectAnnotationRefused(drawing('/Filter/LZWDecode', latin1('x')), 'unsupported-filter', 'filter', 1, place)
    expectAnnotationRefused(drawing('/Filter/DCTDecode', latin1('x')), 'unsupported-filter', 'filter', 1, place)
  })
})

describe('a page of many annotations', () => {
  // A page's list is walked once, each annotation read where it is
  // listed: ten thousand links cost ten thousand look-ups, and one
  // annotation listed ten thousand times is read once -- its entries,
  // written by reference, looked up once -- and counted and drawn each
  // time, the same appearance each time. A walk that read the list again
  // for each, or each listing whole, stops at the count before it spins.
  test('ten thousand annotations are each read once where they are listed', AT_A_BOUND, () => {
    const count = 10_000
    const link = annotation('Link', '/Rect[0 0 10 10]/Border[0 0 0]')
    const distinct = parsed(annotated(Array.from({ length: count }, () => link)))
    const once = new Counted(distinct.objects, 2 * count)
    const tally = new Tally()
    expect(outcome(pagesOf({ ...distinct, objects: once }, tally))).toBe('read whole')
    expect(once.gets).toBeLessThan(once.limit)
    expect(tally.notices()).toEqual([{ code: 'links', count }])

    const stamp = '<</Type/Annot/Subtype 5 0 R/F 6 0 R/Rect 7 0 R/AP 8 0 R>>'
    const listed = { 20: stamp, 5: '/Stamp', 6: '4', 7: '[0 0 10 10]', 8: '<</N 9 0 R>>', 9: form('[0 0 10 10]') }
    const shared = parsed(pagesFile([letter(`/Annots[${'20 0 R '.repeat(count)}]`)], listed))
    const repeated = new Counted(shared.objects, 2 * count)
    const pages = pagesOf({ ...shared, objects: repeated }, new Tally())
    expect(outcome(pages)).toBe('read whole')
    expect(repeated.gets).toBeLessThan(repeated.limit)
    const drawn = (pages as readonly PrintablePage[])[0]?.appearances ?? []
    expect(drawn).toHaveLength(count)
    expect(drawn.every((one) => one === drawn[0])).toBe(true)
  })

  // One /Annots a thousand pages share is walked a thousand times, and a
  // list of two thousand would draw two million times, from a file that
  // writes it once: what the pages list, every page together, is held to
  // MAX_DOCUMENT_VALUES -- the most a file that lists each annotation once
  // could list -- and refused on the page where the walk passes it.
  test('the annotations the pages list are bounded, every page together', AT_A_BOUND, () => {
    const pages = Array.from({ length: MAX_DOCUMENT_PAGES }, () => letter('/Annots 5 0 R'))
    const atBound = MAX_DOCUMENT_VALUES / MAX_DOCUMENT_PAGES
    expect(pagesRead(pagesFile(pages, { 5: `[${'null '.repeat(atBound)}]` }))).toHaveLength(MAX_DOCUMENT_PAGES)
    const past = atBound + 1
    expectPrintRefused(pagesFile(pages, { 5: `[${'null '.repeat(past)}]` }), 'too-many-objects', 'annotations', Math.floor(MAX_DOCUMENT_VALUES / past) + 1)
  })
})

describe('an annotation written otherwise than ISO 32000 writes one', () => {
  // A list, an annotation, its flags, its rectangle, or its appearance's
  // box or matrix that is not what ISO 32000-1 writes there is read by one
  // viewer one way and by another another, or not at all: refused rather
  // than guessed at, its place named.
  test('a list, an annotation, flags, a rectangle, a box or a matrix that is not what ISO writes is refused as malformed', () => {
    expectPrintRefused(pagesFile([letter('/Annots/None')]), 'malformed', 'annots', 1)
    expectPrintRefused(pagesFile([letter('/Annots 99 0 R')]), 'malformed', 'annots', 1)
    expectAnnotationRefused(pagesFile([letter('/Annots[null 5]')]), 'malformed', 'annotation', 1, { index: 2, subtype: undefined })
    expectAnnotationRefused(pagesFile([letter('/Annots[4 0 R]')]), 'malformed', 'annotation', 1, { index: 1, subtype: undefined })
    const square = (entries: string, flags: number | string = 4): Uint8Array =>
      annotated([annotation('Square', entries, flags)], {
        objects: { 40: form('[0 0 10 10]'), 41: form('[0 0 10]'), 42: form('[0 0 10 10]', '/Matrix[1 0 0 1 0]') },
      })
    const refused = (file: Uint8Array, finding: 'flags' | 'rect' | 'bbox' | 'matrix'): void =>
      expectAnnotationRefused(file, 'malformed', finding, 1, { index: 1, subtype: 'Square' })
    for (const flags of ['/Print', -4, 4.5]) refused(square('/Rect[0 0 10 10]/AP<</N 40 0 R>>', flags), 'flags')
    for (const rect of ['', '/Rect[0 0 10]', '/Rect[0 0 10/Ten]']) refused(square(`${rect}/AP<</N 40 0 R>>`), 'rect')
    refused(square('/Rect[0 0 10 10]/AP<</N 41 0 R>>'), 'bbox')
    refused(annotated([annotation('Square', '/Rect[0 0 10 10]/AP<</N 40 0 R>>')], { objects: { 40: { dict: '/Subtype/Form', data: CONTENT } } }), 'bbox')
    refused(square('/Rect[0 0 10 10]/AP<</N 42 0 R>>'), 'matrix')
    refused(
      annotated([annotation('Square', '/Rect[0 0 10 10]/AP<</N 40 0 R>>')], { objects: { 40: form('[0 0 10 10]', '/Matrix[1 0 0 1 0/Nought]') } }),
      'matrix',
    )
  })
})

describe('a fault of the reader', () => {
  // Anything but a refusal thrown while an annotation is read -- a fault
  // of the reader's -- is a refusal of the reader's own words, as one
  // thrown anywhere else in a page is, never the exception's, which may
  // quote the file. The objects map throws at its last look-up, the
  // appearance's form, which only an annotation's read asks for.
  test('an exception that is not a refusal, thrown while an annotation is read, is a refusal of its own words', () => {
    const document = parsed(annotated([annotation('Stamp', '/Rect[0 0 10 10]/AP<</N 40 0 R>>')], { objects: { 40: form('[0 0 10 10]') } }))
    const all = new Counted(document.objects, Number.MAX_SAFE_INTEGER)
    expect(outcome(pagesOf({ ...document, objects: all }, new Tally()))).toBe('read whole')
    expect(pagesOf({ ...document, objects: new Counted(document.objects, all.gets - 1) }, new Tally())).toEqual(refusal('unreadable'))
  })
})
