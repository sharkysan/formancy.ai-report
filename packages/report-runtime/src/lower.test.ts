import { emptyReport, MAX_ASSET_BYTES, MAX_SVG_BYTES, validateReport } from '@formancy/report-spec'
import * as spec from '@formancy/report-spec'
import type { Component, FieldRef, Inline, Regions, ReportDefinition } from '@formancy/report-spec'
import { describe, expect, test } from 'vitest'
import type { ReportData } from './data.js'
import type { Block, Image, QrCode, ResolvedDocument } from './document.js'
import * as runtime from './index.js'
import { lowerRegions } from './lower.js'
import type { ImageResolver, Render } from './render-context.js'
import { Problems } from './resolve-errors.js'
import { resolveReport } from './resolve.js'
import type { ResolveOptions } from './resolve.js'

const header = (field: string): FieldRef => ({ dataset: 'header', field })
const LOGO_DIGEST = `sha256:${'ab'.repeat(32)}`
const PHOTO = { asset: 'photo-1', digest: `sha256:${'cd'.repeat(32)}` }
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3])
/** Bytes the runtime hands on as an SVG: whether they are a drawing is the renderer's to say. */
const SVG = new Uint8Array([0x3c, 0x73, 0x76, 0x67])

/** A report in English with a header dataset, two parameters, four styles and a logo, whose regions are `regions`. */
function probe(regions: Partial<Regions>): ReportDefinition {
  return {
    ...emptyReport('probe', 'Probe', 'en'),
    styles: [
      { id: 'small', size: 8 },
      { id: 'strong', bold: true },
      { id: 'red', color: '#b00020' },
      { id: 'blue', color: '#0000ff', italic: true },
    ],
    datasets: {
      header: {
        id: 'visit',
        fields: [
          { id: 'customer', type: 'string', label: 'Customer', nullable: false },
          { id: 'visitedOn', type: 'date', label: 'Visited on', nullable: false },
          { id: 'flagged', type: 'boolean', label: 'Flagged', nullable: false },
          { id: 'amount', type: 'decimal', label: 'Amount', nullable: false, scale: 2 },
          { id: 'photo', type: 'image', label: 'Photo', nullable: true },
        ],
      },
    },
    parameters: [{ id: 'currency', type: 'string', label: 'Currency', required: false, default: 'CHF' }],
    assets: [{ id: 'logo', mediaType: 'image/png', digest: LOGO_DIGEST }],
    aggregates: [],
    regions: { reportHeader: [], pageHeader: [], body: [], pageFooter: [], summary: [], ...regions },
  }
}

function data(overrides: Record<string, unknown> = {}): ReportData {
  return {
    header: { customer: 'Muster AG', visitedOn: '2026-10-15', flagged: true, amount: '1234.50', photo: PHOTO, ...overrides },
    completeness: { complete: true, captured: 0 },
    consistency: 'host-captured',
  }
}

const OPTIONS: ResolveOptions = { mode: 'final', creationDate: '2026-10-15T08:00:00Z' }

function lowered(regions: Partial<Regions>, options: Partial<ResolveOptions> = {}, values: ReportData = data()): ResolvedDocument {
  const outcome = resolveReport(probe(regions), values, { ...OPTIONS, ...options })
  if (!outcome.ok) throw new Error(`refused: ${outcome.errors.map((error) => `${error.code} ${error.path} ${error.message}`).join('; ')}`)
  return outcome.document
}

function refusals(regions: Partial<Regions>, options: Partial<ResolveOptions> = {}, values: ReportData = data()): string[] {
  const outcome = resolveReport(probe(regions), values, { ...OPTIONS, ...options })
  return outcome.ok ? [] : outcome.errors.map((error) => `${error.stage} ${error.code} ${error.path}`)
}

const body = (...components: Component[]): Partial<Regions> => ({ body: components })
const words = (id: string, words: string, extra: Partial<Component> = {}): Component =>
  ({ id, kind: 'text', content: [{ kind: 'text', text: words }], ...extra }) as Component

describe('conditions', () => {
  // A conditional section is the inspection report's defect block: when its
  // condition does not hold, nothing of it prints, not even an empty frame,
  // and what is inside it is not read.
  test('a component whose condition does not hold prints nothing, nor anything inside it', () => {
    const hidden: Component = {
      id: 'defects',
      kind: 'section',
      visibleWhen: { cel: 'header.flagged == false' },
      border: { thickness: 1, color: '#b00020' },
      components: [words('inside', 'Defect')],
    }
    const shown = words('shown', 'Flagged', { visibleWhen: { cel: 'header.flagged' } })
    expect(lowered(body(hidden, shown)).body).toEqual([{ kind: 'paragraph', runs: [{ text: 'Flagged' }] }])
    expect(lowered(body(hidden, shown), {}, data({ flagged: false })).body.map((block) => block.kind)).toEqual(['section'])
  })

  // A condition that fails is an error, never read as false: a section
  // silently missing is content silently dropped.
  test('refuses a report whose condition fails', () => {
    const failing = words('failing', 'Shown?', { visibleWhen: { cel: 'divide(header.amount, dec("0"), 2) > dec("1")' } })
    expect(refusals(body(failing))).toEqual(['evaluation expression-failed /regions/body/0/visibleWhen/cel'])
  })

  // In a preview whose data lacks what a condition reads, the component is
  // not shown, and that is said; the final render refuses the data.
  test('shows nothing for a condition a preview cannot read, and says so', () => {
    const { flagged: _flagged, ...header } = data().header as Record<string, unknown>
    const outcome = resolveReport(
      probe(body(words('shown', 'Flagged', { visibleWhen: { cel: 'header.flagged' } }))),
      { ...data(), header },
      { ...OPTIONS, mode: 'preview' },
    )
    expect(outcome.ok && outcome.document.body).toEqual([])
    expect(outcome.ok && outcome.warnings.map((warning) => `${warning.stage} ${warning.code} ${warning.path}`)).toEqual([
      'data missing-field /header/flagged',
      'evaluation missing-value /regions/body/0/visibleWhen/cel',
    ])
  })
})

describe('text', () => {
  // Each kind of run gets its value from where it has one and prints it in
  // its format, for the report's locale: a literal as written, a date in
  // words, an amount in its currency, a computed value, a total.
  test('prints each kind of run, formatted', () => {
    const report = probe(
      body({
        id: 'line',
        kind: 'text',
        content: [
          { kind: 'text', text: 'Visit to ' },
          { kind: 'field', field: header('customer'), format: { kind: 'text', transform: 'upper' } },
          { kind: 'field', field: header('visitedOn'), format: { kind: 'date', style: 'long' } },
          { kind: 'field', field: header('amount'), format: { kind: 'currency', currency: { kind: 'parameter', parameter: 'currency' }, scale: 2 } },
          { kind: 'parameter', parameter: 'currency' },
          { kind: 'expression', expression: { cel: 'string(header.amount * dec("2"))' } },
          { kind: 'aggregate', aggregate: 'visits', over: 'report' },
        ],
      }),
    )
    const withCount: ReportDefinition = {
      ...report,
      aggregates: [{ id: 'visits', fn: 'count' }],
      datasets: { ...report.datasets, detail: { id: 'none', fields: [{ id: 'x', type: 'string', label: 'X', nullable: true }] } },
    }
    const outcome = resolveReport(withCount, { ...data(), detail: [] }, OPTIONS)
    if (!outcome.ok) throw new Error(outcome.errors.map((error) => error.code).join())
    const chf = new Intl.NumberFormat('en', { style: 'currency', currency: 'CHF', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format('1234.50')
    expect(outcome.document.body[0]).toEqual({
      kind: 'paragraph',
      runs: [{ text: 'Visit to ' }, { text: 'MUSTER AG' }, { text: 'October 15, 2026' }, { text: chf }, { text: 'CHF' }, { text: '2469.00' }, { text: '0' }],
    })
  })

  // Only the engine knows the page a line falls on, so a page counter stays
  // a field the renderer fills in.
  test('keeps a page counter a field, in the page footer', () => {
    const footer: Component = {
      id: 'pages',
      kind: 'text',
      content: [{ kind: 'text', text: 'Page ' }, { kind: 'pageNumber' }, { kind: 'text', text: ' of ' }, { kind: 'pageCount' }],
    }
    expect(lowered({ pageFooter: [footer] }).pageFooter).toEqual([
      { kind: 'paragraph', runs: [{ text: 'Page ' }, { field: 'pageNumber' }, { text: ' of ' }, { field: 'pageCount' }] },
    ])
  })

  // A heading moves to the next page with what it heads.
  test('keeps a heading with what follows', () => {
    expect(lowered(body(words('heading', 'Notes', { keepWithNext: true }))).body).toEqual([
      { kind: 'paragraph', runs: [{ text: 'Notes' }], keepWithNext: true },
    ])
  })
})

describe('styles', () => {
  // A section styled small prints its text small; a component's own style
  // is laid over what it stands in, and each rule that holds over that, a
  // later rule winning. An engine merging these itself could disagree.
  test('lays what a component stands in, its own style and the rules that hold over each other, in that order', () => {
    const styledText = words('note', 'Note', {
      style: 'strong',
      styleWhen: [
        { when: { cel: 'header.flagged' }, style: 'red' },
        { when: { cel: 'header.flagged == false' }, style: 'small' },
        { when: { cel: 'header.customer != ""' }, style: 'blue' },
      ],
    })
    const section: Component = { id: 'notes', kind: 'section', style: 'small', components: [styledText, words('plain', 'Plain')] }
    const [lowered_] = lowered(body(section)).body
    expect(lowered_).toEqual({
      kind: 'section',
      blocks: [
        { kind: 'paragraph', runs: [{ text: 'Note' }], style: { size: 8, bold: true, color: '#0000ff', italic: true } },
        { kind: 'paragraph', runs: [{ text: 'Plain' }], style: { size: 8 } },
      ],
    })
  })
})

describe('blocks', () => {
  // Every kind of component has its block, with every property it was
  // given and none it was not: a rule at its weight and colour, a framed
  // section, columns at their widths, a kept block, a page break.
  test('lowers each kind of component to its block', () => {
    const components: Component[] = [
      { id: 'rule', kind: 'line', thickness: 0.75, color: '#999999' },
      { id: 'thin', kind: 'line', thickness: 0.5 },
      { id: 'box', kind: 'rectangle', width: 100, height: 20, fill: '#eeeeee', stroke: '#000000' },
      { id: 'gap', kind: 'spacer', height: 12 },
      {
        id: 'side',
        kind: 'columns',
        columns: [
          { width: 120, components: [words('left', 'Left')] },
          { width: 'fill', components: [] },
        ],
      },
      { id: 'frame', kind: 'section', border: { thickness: 1, color: '#b00020' }, fill: '#fff0f0', padding: 6, components: [words('framed', 'Framed')] },
      { id: 'break', kind: 'pageBreak' },
      { id: 'kept', kind: 'keepTogether', components: [words('one', 'One'), words('two', 'Two')] },
      { id: 'code', kind: 'qrCode', content: [{ kind: 'text', text: 'https://formancy.ai/report/' }], size: 85.04, errorCorrection: 'M' },
    ]
    const paragraph = (text: string): Block => ({ kind: 'paragraph', runs: [{ text }] })
    expect(lowered(body(...components)).body).toEqual([
      { kind: 'rule', thickness: 0.75, color: '#999999' },
      { kind: 'rule', thickness: 0.5 },
      { kind: 'rectangle', width: 100, height: 20, fill: '#eeeeee', stroke: '#000000' },
      { kind: 'spacer', height: 12 },
      {
        kind: 'columns',
        columns: [
          { width: 120, blocks: [paragraph('Left')] },
          { width: 'fill', blocks: [] },
        ],
      },
      { kind: 'section', blocks: [paragraph('Framed')], border: { thickness: 1, color: '#b00020' }, fill: '#fff0f0', padding: 6 },
      { kind: 'pageBreak' },
      { kind: 'keepTogether', blocks: [paragraph('One'), paragraph('Two')] },
      { kind: 'qrCode', id: 'code', text: 'https://formancy.ai/report/', size: 85.04, errorCorrection: 'M' },
    ])
  })
})

describe('QR codes', () => {
  const qr = (id: string, content: readonly Inline[]): Component => ({ id, kind: 'qrCode', content, size: 85.04, errorCorrection: 'Q' })
  const printed = (block: Block | undefined): string =>
    block?.kind === 'paragraph' ? block.runs.map((run) => ('text' in run ? run.text : '')).join('') : `<${block?.kind}>`

  // A QR code is scanned to the text a paragraph with its content prints:
  // the same formats for the same locale, the same values from the same
  // places. If the two ever formatted a date or an amount apart, the code
  // beside a printed reference would scan as something else.
  test('encodes what a paragraph with its content prints, formatted as it is', () => {
    const content: Inline[] = [
      { kind: 'text', text: 'Visit to ' },
      { kind: 'field', field: header('customer') },
      { kind: 'text', text: ', ' },
      { kind: 'field', field: header('visitedOn'), format: { kind: 'date', style: 'long' } },
      { kind: 'text', text: ', ' },
      { kind: 'field', field: header('amount'), format: { kind: 'currency', currency: { kind: 'parameter', parameter: 'currency' }, scale: 2 } },
      { kind: 'text', text: ', ' },
      { kind: 'expression', expression: { cel: 'string(header.amount * dec("2"))' } },
    ]
    const [paragraph, code] = lowered(body({ id: 'line', kind: 'text', content }, qr('visit-code', content)), {}, data({ customer: 'Bäckerei Müller AG' })).body
    const chf = new Intl.NumberFormat('en', { style: 'currency', currency: 'CHF', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format('1234.50')
    expect(code).toEqual({
      kind: 'qrCode',
      id: 'visit-code',
      text: `Visit to Bäckerei Müller AG, October 15, 2026, ${chf}, 2469.00`,
      size: 85.04,
      errorCorrection: 'Q',
    })
    expect((code as QrCode).text).toBe(printed(paragraph))
  })

  // A preview whose data lacks a field encodes nothing for it, as a
  // paragraph prints nothing for it, and says so once; the final render
  // refuses the same data, so no code printed for real misses a value.
  test('encodes nothing for a value a preview lacks, says so, and is refused for it in a final render', () => {
    const { customer: _customer, ...lacking } = data().header as Record<string, unknown>
    const code = qr('order-code', [
      { kind: 'text', text: 'Order for ' },
      { kind: 'field', field: header('customer') },
      { kind: 'expression', expression: { cel: '" by " + header.customer' } },
    ])
    const outcome = resolveReport(probe(body(code)), { ...data(), header: lacking }, { ...OPTIONS, mode: 'preview' })
    expect(outcome.ok && outcome.document.body).toEqual([{ kind: 'qrCode', id: 'order-code', text: 'Order for ', size: 85.04, errorCorrection: 'Q' }])
    expect(outcome.ok && outcome.warnings.map((warning) => `${warning.stage} ${warning.code} ${warning.path}`)).toEqual([
      'data missing-field /header/customer',
      'evaluation missing-value /regions/body/0/content/2/expression/cel',
    ])
    expect(refusals(body(code), {}, { ...data(), header: lacking })).toEqual(['data missing-field /header/customer'])
  })

  /** The probe with two values a final render may hold as null: a header field that is nullable, and a parameter neither required nor defaulted. */
  function nullable(regions: Partial<Regions>): ReportDefinition {
    const report = probe(regions)
    const visit = report.datasets.header as NonNullable<ReportDefinition['datasets']['header']>
    return {
      ...report,
      datasets: {
        ...report.datasets,
        header: { ...visit, fields: [...visit.fields, { id: 'reference', type: 'string', label: 'Reference', nullable: true }] },
      },
      parameters: [...report.parameters, { id: 'branch', type: 'string', label: 'Branch', required: false }],
    }
  }
  const reference = (id: string): Component =>
    qr(id, [
      { kind: 'text', text: 'REF-' },
      { kind: 'field', field: header('reference') },
      { kind: 'text', text: '/' },
      { kind: 'parameter', parameter: 'branch' },
    ])

  // A paragraph prints a value that is null as nothing, and a reader sees
  // the gap. A code is scanned, not read: one that encoded less than its
  // content scans as some other reference, and nothing on the page says
  // so. A final render refuses it, naming the code and the run, as it
  // refuses an amount whose currency has no value: a field's and a
  // parameter's alike.
  test('is refused in a final render for a run with no value, naming the code and the run', () => {
    const outcome = resolveReport(nullable(body(reference('pay-code'))), data({ reference: null }), OPTIONS)
    expect(outcome.ok ? [] : outcome.errors).toMatchObject([
      { stage: 'resolve', code: 'no-qr-value', path: '/regions/body/0/content/1', componentId: 'pay-code' },
      { stage: 'resolve', code: 'no-qr-value', path: '/regions/body/0/content/3', componentId: 'pay-code' },
    ])
    // With both values, the same code is drawn.
    const whole = resolveReport(nullable(body(reference('pay-code'))), data({ reference: '42' }), { ...OPTIONS, parameters: { branch: 'ZH' } })
    expect(whole.ok && whole.document.body).toEqual([{ kind: 'qrCode', id: 'pay-code', text: 'REF-42/ZH', size: 85.04, errorCorrection: 'Q' }])
  })

  // A code of nothing is a symbol of no data, which a scanner reads as no
  // code at all, in a square the page keeps for it. A final render refuses
  // content that prints nothing, whether its runs are empty text or a value
  // that is the empty string, naming the code.
  test('is refused in a final render when its content prints nothing', () => {
    const empty = resolveReport(probe(body(qr('blank-code', [{ kind: 'text', text: '' }]))), data(), OPTIONS)
    expect(empty.ok ? [] : empty.errors).toMatchObject([
      { stage: 'resolve', code: 'empty-qr-code', path: '/regions/body/0/content', componentId: 'blank-code' },
    ])
    const unnamed = resolveReport(probe(body(qr('customer-code', [{ kind: 'field', field: header('customer') }]))), data({ customer: '' }), OPTIONS)
    expect(unnamed.ok ? [] : unnamed.errors).toMatchObject([
      { stage: 'resolve', code: 'empty-qr-code', path: '/regions/body/0/content', componentId: 'customer-code' },
    ])
  })

  // A preview is for looking at a report before its data is final. Refused
  // for a value it does not have yet, a template whose reference is still
  // empty could not be previewed at all. It encodes the runs as they
  // resolve, as a paragraph prints them: nothing for a null, and the empty
  // text when that is all there is.
  test('is drawn as it resolves in a preview, a value that is null as nothing', () => {
    const preview: ResolveOptions = { ...OPTIONS, mode: 'preview' }
    const partial = resolveReport(nullable(body(reference('pay-code'))), data({ reference: null }), preview)
    expect(partial.ok && partial.document.body).toEqual([{ kind: 'qrCode', id: 'pay-code', text: 'REF-/', size: 85.04, errorCorrection: 'Q' }])
    const empty = resolveReport(probe(body(qr('blank-code', [{ kind: 'text', text: '' }]))), data(), preview)
    expect(empty.ok && empty.document.body).toEqual([{ kind: 'qrCode', id: 'blank-code', text: '', size: 85.04, errorCorrection: 'Q' }])
  })

  // report-spec refuses a page number or count in a code, which is encoded
  // once, before there are pages. Were one to reach the runtime all the
  // same, joined as the empty text it would encode a code without its page
  // number, and nothing would say so. Lowering it throws instead.
  test('throws on a page counter in its content, never encoding it as nothing', () => {
    const report = probe({ pageFooter: [qr('page-code', [{ kind: 'text', text: 'Page ' }, { kind: 'pageNumber' }])] })
    expect(validateReport(report)).toMatchObject({ valid: false, errors: [{ code: 'misplaced-page-counter', path: '/regions/pageFooter/0/content/1' }] })
    // Only what lowering a page footer of one code reads: the report, the header, the parameters, the totals and the styles.
    const render = {
      report,
      data: { header: {} },
      params: {},
      totals: { report: new Map() },
      styles: new Map(),
      problems: new Problems(),
      preview: false,
    } as unknown as Render
    expect(() => lowerRegions(render)).toThrow('component page-code holds a pageNumber at /regions/pageFooter/0/content/1')
  })

  // A code that encoded less than its content would scan as some other
  // reference: a value its format cannot show refuses the report, naming
  // the code and the run, as it does in a paragraph.
  test('refuses a value its content cannot format, naming the code', () => {
    const code = qr('pay-code', [
      { kind: 'field', field: header('amount'), format: { kind: 'currency', currency: { kind: 'parameter', parameter: 'currency' }, scale: 2 } },
    ])
    const outcome = resolveReport(probe(body(code)), data(), { ...OPTIONS, parameters: { currency: 'chf' } })
    // An array matches only an array of its length: this is the one error.
    expect(outcome.ok ? [] : outcome.errors).toMatchObject([
      { stage: 'format', code: 'invalid-currency', path: '/regions/body/0/content/0', componentId: 'pay-code' },
    ])
  })
})

describe('images', () => {
  const logo: Component = { id: 'logo-image', kind: 'image', source: { kind: 'asset', asset: 'logo' }, width: 100, height: 40, fit: 'contain' }
  const photo: Component = { id: 'photo-image', kind: 'image', source: { kind: 'field', field: header('photo') }, width: 240, height: 160, fit: 'cover' }

  // The runtime fetches nothing: it asks the host for an approved asset by
  // its id and digest -- the template's own, or the one the data names --
  // and draws the bytes it is handed.
  test('draws the bytes the host hands over for an asset and for an image field', () => {
    const asked: unknown[] = []
    const images: ImageResolver = (ref) => {
      asked.push(ref)
      return { mediaType: 'image/png', bytes: PNG }
    }
    const blocks = lowered(body(logo, photo), { images }).body as Image[]
    expect(asked).toEqual([{ asset: 'logo', digest: LOGO_DIGEST }, PHOTO])
    expect(blocks.map(({ kind, asset, width, height, fit }) => ({ kind, id: asset.id, mediaType: asset.mediaType, width, height, fit }))).toEqual([
      { kind: 'image', id: 'logo', mediaType: 'image/png', width: 100, height: 40, fit: 'contain' },
      { kind: 'image', id: 'photo-1', mediaType: 'image/png', width: 240, height: 160, fit: 'cover' },
    ])
    expect([...(blocks[0] as Image).asset.bytes]).toEqual([...PNG])
  })

  // The document holds its own copy: bytes the host changes afterwards
  // never reach a render of it.
  test('copies the bytes', () => {
    const bytes = new Uint8Array(PNG)
    const [image] = lowered(body(logo), { images: () => ({ mediaType: 'image/png', bytes }) }).body as Image[]
    bytes[0] = 0
    expect(image?.asset.bytes[0]).toBe(0x89)
  })

  // One megabyte drawn by forty components was asked for, copied and
  // embedded forty times: a 40 MB PDF. Each approved asset is asked for
  // once per render, and every component that draws it shares one copy,
  // which the renderer embeds once.
  test('asks for each asset once, and shares one copy between the images that draw it', () => {
    let asked = 0
    const images: ImageResolver = () => {
      asked++
      return { mediaType: 'image/png', bytes: PNG }
    }
    const blocks = lowered(body(logo, { ...logo, id: 'logo-again' }, { ...logo, id: 'logo-third' }), { images }).body as Image[]
    expect(asked).toBe(1)
    expect(new Set(blocks.map(({ asset }) => asset)).size).toBe(1)
    expect(blocks).toHaveLength(3)
  })

  // A 50 MB answer drawn by twenty components grew the process by a
  // gigabyte before the renderer refused it. Bytes past the limit are
  // refused before they are copied, under the limit the renderer holds too.
  test('refuses bytes past the asset limit before copying them', () => {
    const huge = new Uint8Array(MAX_ASSET_BYTES + 1)
    expect(refusals(body(logo), { images: () => ({ mediaType: 'image/png', bytes: huge }) })).toEqual(['resolve invalid-asset /regions/body/0/source'])
    expect(lowered(body(logo), { images: () => ({ mediaType: 'image/png', bytes: new Uint8Array(MAX_ASSET_BYTES) }) }).body).toHaveLength(1)
  })

  // A photo that was not taken prints as nothing, and its box is kept, so
  // what follows stands where it would with one.
  test('keeps the box of an image field with no value as space', () => {
    expect(lowered(body(photo), { images: () => undefined }, data({ photo: null })).body).toEqual([{ kind: 'spacer', height: 160 }])
  })

  // Each way the bytes cannot be had is an error that names the image,
  // never an empty box: no lookup at all, a lookup that has nothing or
  // throws, and an answer that is not bytes of a type a report may draw --
  // for the template's asset, the type it declares.
  const throwing: ImageResolver = () => {
    throw new Error('storage unavailable')
  }
  const failures: readonly (readonly [string, ImageResolver | undefined, string])[] = [
    ['no lookup', undefined, 'missing-asset'],
    ['a lookup that has nothing', () => undefined, 'missing-asset'],
    ['a lookup that throws', throwing, 'asset-lookup-failed'],
    ['an answer of another media type', () => ({ mediaType: 'image/jpeg', bytes: PNG }), 'invalid-asset'],
    ['an answer that is not bytes', () => ({ mediaType: 'image/png', bytes: [0x89] as unknown as Uint8Array }), 'invalid-asset'],
    ['an answer of a type no report draws', () => ({ mediaType: 'image/gif', bytes: PNG }), 'invalid-asset'],
    ['an SVG answer for an asset declared a PNG', () => ({ mediaType: 'image/svg+xml', bytes: SVG }), 'invalid-asset'],
  ]
  test.each(failures)('refuses an image with %s', (_name, images, code) => {
    expect(refusals(body(logo), images === undefined ? {} : { images })).toEqual([`resolve ${code} /regions/body/0/source`])
  })

  // A photo from the data has no declared type, and is held to the types a
  // report draws.
  test('refuses bytes for an image field of a type no report draws', () => {
    expect(refusals(body(photo), { images: () => ({ mediaType: 'image/gif', bytes: PNG }) })).toEqual(['resolve invalid-asset /regions/body/0/source'])
  })

  // An image field may be any type a report draws; only the template's
  // own asset declares one.
  test('takes a JPEG and an SVG for an image field', () => {
    const [jpeg] = lowered(body(photo), { images: () => ({ mediaType: 'image/jpeg', bytes: PNG }) }).body as Image[]
    expect(jpeg?.asset.mediaType).toBe('image/jpeg')
    const [svg] = lowered(body(photo), { images: () => ({ mediaType: 'image/svg+xml', bytes: SVG }) }).body as Image[]
    expect(svg?.asset.mediaType).toBe('image/svg+xml')
  })
})

describe('an SVG image', () => {
  const mark: Component = { id: 'mark-image', kind: 'image', source: { kind: 'asset', asset: 'mark' }, width: 42.52, height: 42.52, fit: 'contain' }
  const withMark = (regions: Partial<Regions>): ReportDefinition => ({
    ...probe(regions),
    assets: [{ id: 'mark', mediaType: 'image/svg+xml', digest: LOGO_DIGEST }],
  })

  /** Bytes whose every read but their length is counted: copying them reads them, and refusing them on their length does not. */
  function counted(length: number): { readonly bytes: Uint8Array; readonly reads: () => number } {
    const target = new Uint8Array(length).fill(0x20)
    let reads = 0
    const bytes = new Proxy(target, {
      get(of, key) {
        if (key !== 'length') reads += 1
        const value: unknown = Reflect.get(of, key, of)
        return typeof value === 'function' ? (value as (...args: unknown[]) => unknown).bind(of) : value
      },
    })
    return { bytes, reads: () => reads }
  }

  // The media type of a template's SVG asset travels with its bytes to the
  // renderer, which draws an SVG and a PNG by different checks: lost, the
  // renderer would read the drawing as a PNG and refuse it, or worse.
  test('resolves to an image whose asset is declared an SVG', () => {
    const outcome = resolveReport(withMark(body(mark)), data(), { ...OPTIONS, images: () => ({ mediaType: 'image/svg+xml', bytes: SVG }) })
    expect(
      outcome.ok && (outcome.document.body as Image[]).map(({ asset }) => ({ id: asset.id, mediaType: asset.mediaType, bytes: [...asset.bytes] })),
    ).toEqual([{ id: 'mark', mediaType: 'image/svg+xml', bytes: [...SVG] }])
  })

  // A logo is kilobytes and an SVG asset may be a mebibyte (0030): a host
  // that handed over 20 MB as an SVG had it copied for every render, and
  // refused only by the renderer. Past MAX_SVG_BYTES it is refused on its
  // length, and not one of its bytes is read; at it, it is copied.
  test('refuses an SVG past MAX_SVG_BYTES before copying it', () => {
    const over = counted(MAX_SVG_BYTES + 1)
    const outcome = resolveReport(withMark(body(mark)), data(), { ...OPTIONS, images: () => ({ mediaType: 'image/svg+xml', bytes: over.bytes }) })
    expect(outcome.ok ? [] : outcome.errors.map(({ code, path, message }) => ({ code, path, message }))).toEqual([
      {
        code: 'invalid-asset',
        path: '/regions/body/0/source',
        message: `component mark-image: the host's answer for the approved asset mark is ${MAX_SVG_BYTES + 1} bytes; an SVG asset may have ${MAX_SVG_BYTES} (1 MiB)`,
      },
    ])
    expect(over.reads()).toBe(0)
    const at = counted(MAX_SVG_BYTES)
    const accepted = resolveReport(withMark(body(mark)), data(), { ...OPTIONS, images: () => ({ mediaType: 'image/svg+xml', bytes: at.bytes }) })
    expect(accepted.ok && (accepted.document.body[0] as Image).asset.bytes.length).toBe(MAX_SVG_BYTES)
    expect(at.reads()).toBeGreaterThan(0)
  })
})

describe("what an engine reads of report-spec's image decisions", () => {
  // The renderer depends on the runtime alone, and reads a picture's
  // structure and holds its size by the reader a builder refuses an upload
  // by (0033), handed on here with the limits. A copy in the engine could
  // disagree with the builder's, and nobody would find out until an image
  // a person had added was refused at every print.
  test("hands them on as report-spec's own", () => {
    expect(typeof runtime.imageHeader).toBe('function')
    expect(runtime.imageHeader).toBe(spec.imageHeader)
    expect(runtime.sniffImage).toBe(spec.sniffImage)
    expect(runtime.MAX_ASSET_SIDE).toBe(spec.MAX_ASSET_SIDE)
    expect(runtime.MAX_ASSET_BYTES).toBe(spec.MAX_ASSET_BYTES)
  })
})
