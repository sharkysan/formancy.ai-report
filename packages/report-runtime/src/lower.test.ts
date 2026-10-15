import { emptyReport } from '@formancy/report-spec'
import type { Component, FieldRef, Regions, ReportDefinition } from '@formancy/report-spec'
import { describe, expect, test } from 'vitest'
import type { ReportData } from './data.js'
import { MAX_ASSET_BYTES } from './document.js'
import type { Block, Image, ResolvedDocument } from './document.js'
import type { ImageResolver } from './render-context.js'
import { resolveReport } from './resolve.js'
import type { ResolveOptions } from './resolve.js'

const header = (field: string): FieldRef => ({ dataset: 'header', field })
const LOGO_DIGEST = `sha256:${'ab'.repeat(32)}`
const PHOTO = { asset: 'photo-1', digest: `sha256:${'cd'.repeat(32)}` }
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3])

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
const words = (id: string, words: string, extra: Partial<Component> = {}): Component => ({ id, kind: 'text', content: [{ kind: 'text', text: words }], ...extra }) as Component

describe('conditions', () => {
  // A conditional section is the inspection report's defect block: when its
  // condition does not hold, nothing of it prints, not even an empty frame,
  // and what is inside it is not read.
  test('a component whose condition does not hold prints nothing, nor anything inside it', () => {
    const hidden: Component = { id: 'defects', kind: 'section', visibleWhen: { cel: 'header.flagged == false' }, border: { thickness: 1, color: '#b00020' }, components: [words('inside', 'Defect')] }
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
    const outcome = resolveReport(probe(body(words('shown', 'Flagged', { visibleWhen: { cel: 'header.flagged' } }))), { ...data(), header }, { ...OPTIONS, mode: 'preview' })
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
    const report = probe(body({
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
    }))
    const withCount: ReportDefinition = { ...report, aggregates: [{ id: 'visits', fn: 'count' }], datasets: { ...report.datasets, detail: { id: 'none', fields: [{ id: 'x', type: 'string', label: 'X', nullable: true }] } } }
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
    const footer: Component = { id: 'pages', kind: 'text', content: [{ kind: 'text', text: 'Page ' }, { kind: 'pageNumber' }, { kind: 'text', text: ' of ' }, { kind: 'pageCount' }] }
    expect(lowered({ pageFooter: [footer] }).pageFooter).toEqual([{ kind: 'paragraph', runs: [{ text: 'Page ' }, { field: 'pageNumber' }, { text: ' of ' }, { field: 'pageCount' }] }])
  })

  // A heading moves to the next page with what it heads.
  test('keeps a heading with what follows', () => {
    expect(lowered(body(words('heading', 'Notes', { keepWithNext: true }))).body).toEqual([{ kind: 'paragraph', runs: [{ text: 'Notes' }], keepWithNext: true }])
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
      { id: 'side', kind: 'columns', columns: [{ width: 120, components: [words('left', 'Left')] }, { width: 'fill', components: [] }] },
      { id: 'frame', kind: 'section', border: { thickness: 1, color: '#b00020' }, fill: '#fff0f0', padding: 6, components: [words('framed', 'Framed')] },
      { id: 'break', kind: 'pageBreak' },
      { id: 'kept', kind: 'keepTogether', components: [words('one', 'One'), words('two', 'Two')] },
    ]
    const paragraph = (text: string): Block => ({ kind: 'paragraph', runs: [{ text }] })
    expect(lowered(body(...components)).body).toEqual([
      { kind: 'rule', thickness: 0.75, color: '#999999' },
      { kind: 'rule', thickness: 0.5 },
      { kind: 'rectangle', width: 100, height: 20, fill: '#eeeeee', stroke: '#000000' },
      { kind: 'spacer', height: 12 },
      { kind: 'columns', columns: [{ width: 120, blocks: [paragraph('Left')] }, { width: 'fill', blocks: [] }] },
      { kind: 'section', blocks: [paragraph('Framed')], border: { thickness: 1, color: '#b00020' }, fill: '#fff0f0', padding: 6 },
      { kind: 'pageBreak' },
      { kind: 'keepTogether', blocks: [paragraph('One'), paragraph('Two')] },
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
    ['an answer of a type no report draws', () => ({ mediaType: 'image/svg+xml', bytes: PNG }), 'invalid-asset'],
  ]
  test.each(failures)('refuses an image with %s', (_name, images, code) => {
    expect(refusals(body(logo), images === undefined ? {} : { images })).toEqual([`resolve ${code} /regions/body/0/source`])
  })

  // A photo from the data has no declared type, and is held to the types a
  // report draws.
  test('refuses bytes for an image field of a type no report draws', () => {
    expect(refusals(body(photo), { images: () => ({ mediaType: 'image/gif', bytes: PNG }) })).toEqual(['resolve invalid-asset /regions/body/0/source'])
  })

  // An image field may be either type a report draws; only the template's
  // own asset declares one.
  test('takes a JPEG for an image field', () => {
    const [image] = lowered(body(photo), { images: () => ({ mediaType: 'image/jpeg', bytes: PNG }) }).body as Image[]
    expect(image?.asset.mediaType).toBe('image/jpeg')
  })
})
