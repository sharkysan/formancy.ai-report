import { nextComponentId, validLocations } from '@formancy/report-core'
import { COMPONENT_KINDS, emptyReport, mmToPt, validateReport } from '@formancy/report-spec'
import type { Component, FieldContract, ReportDefinition } from '@formancy/report-spec'
import { describe, expect, test } from 'vitest'
import { recordingStore } from './image-test-support.js'
import { defaultComponent } from './palette.js'
import { editorOver, richReport } from './test-support.js'
import { contentLocale, EDITOR_LOCALES, editorText } from './text.js'

/** The errors `report` is refused with once `component` stands first in its summary; none where the validator takes it. */
function refusalsWith(report: ReportDefinition, component: Component | string): string[] {
  if (typeof component === 'string') return [component]
  const outcome = validateReport({ ...report, regions: { ...report.regions, summary: [component, ...report.regions.summary] } })
  return outcome.valid ? [] : outcome.errors.map((error) => `${error.code} ${error.path}`)
}

/** `report` with its detail fields replaced by what `change` makes of each. */
function withDetail(report: ReportDefinition, change: (field: FieldContract) => FieldContract): ReportDefinition {
  const detail = report.datasets.detail
  if (detail === undefined) throw new Error('the rich report has a detail dataset')
  return { ...report, datasets: { ...report.datasets, detail: { ...detail, fields: detail.fields.map(change) } } }
}

/** A blank report in `locale` whose detail rows have `fields`, and nothing that reads them. */
function detailOf(fields: readonly FieldContract[], locale = 'de-CH'): ReportDefinition {
  const blank = emptyReport('charted', 'Charted', locale)
  return { ...blank, datasets: { ...blank.datasets, detail: { id: 'rows', fields: [...fields] } } }
}

describe('the palette', () => {
  // Every kind the format has but a chart is offered, in the format's
  // order, named in the person's language: a kind missing from it is one
  // nobody can add without editing JSON.
  test('offers every kind but a chart, in the format’s order, in the editor’s language', () => {
    const { editor } = editorOver(richReport(), { locale: 'de-CH' })
    const { palette } = editor.state()
    expect(palette.map((entry) => entry.kind)).toEqual(COMPONENT_KINDS.filter((kind) => kind !== 'chart'))
    expect(palette.map((entry) => entry.label)).toEqual([
      'Text',
      'Bild',
      'QR-Code',
      'EPC-Zahlcode',
      'Linie',
      'Rechteck',
      'Abstand',
      'Spalten',
      'Abschnitt',
      'Tabelle',
      'Seitenumbruch',
      'Zusammenhalten',
    ])
  })

  // A chart inserted now would be a box whose own properties no builder
  // edits, in a report the runtime refuses to render (0051): offered, it
  // would be a button that makes a report nobody can print. Sent anyway, an
  // insert or a drag of one is refused as of a kind the palette does not
  // have.
  test('offers no chart yet, and refuses one inserted or dragged', () => {
    const { editor, session } = editorOver(richReport())
    expect(editor.state().palette.some((entry) => entry.kind === 'chart')).toBe(false)
    expect(editor.dispatch({ type: 'insert', kind: 'chart', target: { region: 'summary', index: 0 } })).toMatchObject({ ok: false, code: 'unavailable' })
    expect(editor.dispatch({ type: 'startDrag', subject: { kind: 'chart' } })).toMatchObject({ ok: false, code: 'unavailable' })
    expect(session.revision()).toBe(0)
  })

  // A new component's id is report-core's, so two builders inserting the
  // same kind name it the same way, and never with a taken id.
  test('gives each default component the id nextComponentId gives its kind', () => {
    const report = richReport()
    const { editor } = editorOver(report)
    for (const entry of editor.state().palette) expect(entry.component?.id, entry.kind).toBe(nextComponentId(report, entry.kind))
  })

  // A default component the validator refuses everywhere would be a
  // palette entry that never works; each goes somewhere in a report that
  // has room for it -- the rich one already has its one table.
  test('offers default components the validator accepts somewhere', () => {
    const report = richReport()
    const { editor } = editorOver(report)
    for (const entry of editor.state().palette) {
      const places = validLocations(report, entry.component as NonNullable<typeof entry.component>)
      if (entry.kind === 'table') expect(places, entry.kind).toEqual([])
      else expect(places.length, entry.kind).toBeGreaterThan(0)
    }
    const withoutTable: ReportDefinition = {
      ...report,
      regions: { ...report.regions, body: report.regions.body.filter((component) => component.kind !== 'table') },
      aggregates: [],
    }
    const table = editorOver(withoutTable)
      .editor.state()
      .palette.find((entry) => entry.kind === 'table')
    expect(validLocations(withoutTable, table?.component as NonNullable<NonNullable<typeof table>['component']>).length).toBeGreaterThan(0)
  })

  // An image needs something to draw and a table a dataset to read; with
  // neither declared there is no default to offer, and the entry says what
  // to declare first.
  test('says what an empty report must declare before an image or a table', () => {
    const { editor } = editorOver(emptyReport('blank', 'Blank', 'en'))
    const byKind = Object.fromEntries(editor.state().palette.map((entry) => [entry.kind, entry]))
    expect(byKind.image).toMatchObject({ component: null, unavailable: 'Declare an image asset, or an image field of the header data, first.' })
    expect(byKind.table).toMatchObject({ component: null, unavailable: 'Declare a detail dataset with a field to show first.' })
    expect(byKind.text?.component).toMatchObject({ id: 'text', kind: 'text', content: [{ kind: 'text', text: 'New text' }] })
  })

  // A new text's words print, so they are the report's language and never
  // the editor's: two builders in two languages inserting into one report
  // must commit the same document, and a German author's "Neuer Text" must
  // not land in an English report.
  test('writes a new component’s words in the report’s language, whatever the editor’s', () => {
    const report = richReport()
    const english: ReportDefinition = { ...report, locale: 'en-GB' }
    const documents = (['en', 'de-CH', 'fr-CH'] as const).map((locale) => {
      const { editor, session } = editorOver(english, { locale })
      editor.dispatch({ type: 'insert', kind: 'text', target: { region: 'body', index: 0 } })
      return session.document()
    })
    expect(documents[1]).toEqual(documents[0])
    expect(documents[2]).toEqual(documents[0])
    expect(documents[0]?.regions.body[0]).toMatchObject({ kind: 'text', content: [{ kind: 'text', text: 'New text' }] })
    const withoutTable: ReportDefinition = {
      ...report,
      locale: 'fr-CH',
      regions: { ...report.regions, body: report.regions.body.filter((component) => component.kind !== 'table') },
      aggregates: [],
    }
    const table = editorOver(withoutTable, { locale: 'de-CH' })
      .editor.state()
      .palette.find((entry) => entry.kind === 'table')
    expect(table?.component).toMatchObject({ emptyText: editorText('fr-CH')('default.emptyText') })
    expect(table?.label).toBe('Tabelle')
  })

  // The palette offers no chart yet, but its default is the one the
  // builders will insert: a default the validator refuses would make
  // Insert's Chart a button that fails every time.
  test('makes a default chart the validator takes, over the detail rows, summing their first number', () => {
    const report = richReport()
    const de = editorText('de-CH')
    const chart = defaultComponent(report, 'chart')
    expect(chart).toMatchObject({
      id: 'chart',
      kind: 'chart',
      chart: 'bar',
      dataset: 'detail',
      category: { field: { dataset: 'detail', field: 'site' }, order: 'data', nullLabel: de('default.chartNoCategory') },
      series: [{ id: 'series-1', label: 'Amount', fn: 'sum', of: { dataset: 'detail', field: 'amount' } }],
      valueFormat: { kind: 'number', scale: 2, grouping: true },
      emptyText: de('default.chartEmpty'),
    })
    expect(refusalsWith(report, chart)).toEqual([])
  })

  // A category that may be null asks for the word its rows without one
  // print under, or the validator refuses the chart; and one that may not
  // has it too, so that a form version that removes the field can be
  // reviewed into printing nothing of it, which declares the field
  // nullable (0048). The word prints, so it is the report's language.
  test('labels the rows without a category, in the report’s language, whether or not the field may be null', () => {
    const site = { id: 'site', type: 'string', label: 'Site' } as const
    const amount = { id: 'amount', type: 'decimal', label: 'Amount', nullable: false, scale: 2 } as const
    for (const nullable of [false, true]) {
      const report = detailOf([{ ...site, nullable }, amount], 'fr-CH')
      const chart = defaultComponent(report, 'chart')
      expect(chart, String(nullable)).toMatchObject({
        category: { field: { dataset: 'detail', field: 'site' }, nullLabel: editorText('fr-CH')('default.chartNoCategory') },
      })
      expect(refusalsWith(report, chart), String(nullable)).toEqual([])
    }
    // A date names a category too, and an integer is summed at no places.
    const dated = detailOf([
      { id: 'shippedOn', type: 'date', label: 'Shipped on', nullable: true },
      { id: 'quantity', type: 'integer', label: 'Quantity', nullable: false },
    ])
    const chart = defaultComponent(dated, 'chart')
    expect(chart).toMatchObject({
      category: { field: { dataset: 'detail', field: 'shippedOn' } },
      series: [{ fn: 'sum', of: { dataset: 'detail', field: 'quantity' } }],
      valueFormat: { scale: 0 },
    })
    expect(refusalsWith(dated, chart)).toEqual([])
  })

  // A report with no number to sum charts how many rows there are; without that the default would hold a series of nothing.
  test('counts the rows where the detail has no number', () => {
    const texts = detailOf([
      { id: 'site', type: 'string', label: 'Site', nullable: false },
      { id: 'sku', type: 'string', label: 'SKU', nullable: false },
    ])
    const chart = defaultComponent(texts, 'chart')
    expect(chart).toMatchObject({
      series: [{ id: 'series-1', label: editorText('de-CH')('default.chartCount'), fn: 'count' }],
      valueFormat: { scale: 0 },
    })
    expect(refusalsWith(texts, chart)).toEqual([])
  })

  // A field's label may be blank, and a series' label is its legend entry,
  // which may not be: a default that took a blank label would be refused
  // on every insert. It says what the series is instead, in the report's
  // language.
  test('names a series of a number with a blank label after its function', () => {
    for (const blank of ['', '  ']) {
      const unlabelled = withDetail(richReport(), (field) => (field.id === 'amount' ? { ...field, label: blank } : field))
      const chart = defaultComponent(unlabelled, 'chart')
      expect(chart).toMatchObject({ series: [{ label: editorText('de-CH')('default.chartSum'), fn: 'sum' }] })
      expect(refusalsWith(unlabelled, chart)).toEqual([])
    }
  })

  // Without a detail field to group by there is nothing to chart; saying so
  // beats a refusal after the click.
  test('says what a report needs before it can hold a chart', () => {
    const de = editorText('de-CH')
    expect(defaultComponent(emptyReport('blank', 'Blank', 'de-CH'), 'chart')).toBe('palette.needsChartData')
    expect(defaultComponent(detailOf([{ id: 'shipped', type: 'boolean', label: 'Shipped', nullable: false }]), 'chart')).toBe('palette.needsChartData')
    expect(de('palette.needsChartData')).toContain('Erfassen Sie zuerst')
  })

  // The report's language picks the words: its own tag, else one of its
  // language -- Germany's German gets the Swiss words, which differ from it
  // in no word the defaults use -- else English.
  test('picks the words by the report’s tag, then its language, then English', () => {
    expect(contentLocale('de-CH')).toBe('de-CH')
    expect(contentLocale('FR-ch')).toBe('fr-CH')
    expect(contentLocale('de-DE')).toBe('de-CH')
    expect(contentLocale('fr')).toBe('fr-CH')
    expect(contentLocale('en-US')).toBe('en')
    expect(contentLocale('it-CH')).toBe('en')
  })

  // An add appends, and a person who adds a logo and then presses Image
  // means that logo: the oldest asset would insert the one the report had
  // before (0033).
  test('draws the newest image the report declares', () => {
    const report = richReport()
    const withMark: ReportDefinition = {
      ...report,
      assets: [...report.assets, { id: 'mark', mediaType: 'image/svg+xml', digest: `sha256:${'cd'.repeat(32)}` }],
    }
    const image = editorOver(withMark)
      .editor.state()
      .palette.find((entry) => entry.kind === 'image')
    expect(image?.component).toMatchObject({ kind: 'image', source: { kind: 'asset', asset: 'mark' } })
  })

  // Where the host keeps images, a report with nothing to draw is one Add
  // image… gives something to: the entry says so, rather than send the
  // person to declare an asset they have no way to declare.
  test('says to add an image first where the host keeps images', () => {
    const { editor } = editorOver(emptyReport('blank', 'Blank', 'de-CH'), { locale: 'de-CH', images: recordingStore() })
    const de = editorText('de-CH')
    expect(editor.state().palette.find((entry) => entry.kind === 'image')).toMatchObject({
      component: null,
      unavailable: de('palette.addImageFirst', { add: de('images.add') }),
    })
    expect(de('palette.addImageFirst', { add: de('images.add') })).toContain('Bild hinzufügen…')
  })

  // With no asset to pin, a new image draws the header's image field: a
  // signature captured with a form.
  test('draws a header image field when there is no asset', () => {
    const report = richReport()
    const withoutAssets: ReportDefinition = { ...report, assets: [], regions: { ...report.regions, reportHeader: report.regions.reportHeader.slice(1) } }
    const image = editorOver(withoutAssets)
      .editor.state()
      .palette.find((entry) => entry.kind === 'image')
    expect(image?.component).toMatchObject({ kind: 'image', source: { kind: 'field', field: { dataset: 'header', field: 'signature' } } })
  })

  // A default sized for an A4 page would not fit the smallest page the
  // format allows, and every insert of it would be refused. A QR code and
  // an EPC payment code are squares, so each is held to the shorter side:
  // here the height.
  test('sizes a default box to fit the printable area', () => {
    const blank = emptyReport('tight', 'Tight', 'en')
    const tight: ReportDefinition = {
      ...blank,
      assets: [{ id: 'logo', mediaType: 'image/png', digest: `sha256:${'ab'.repeat(32)}` }],
      page: { size: 'A4', orientation: 'portrait', margins: { top: 380, bottom: 380, left: 250, right: 250 } },
    }
    const { editor } = editorOver(tight)
    for (const kind of ['image', 'qrCode', 'epcQrCode', 'rectangle'] as const) {
      const entry = editor.state().palette.find((candidate) => candidate.kind === kind)
      expect(validLocations(tight, entry?.component as NonNullable<NonNullable<typeof entry>['component']>).length, kind).toBeGreaterThan(0)
    }
  })

  // A new QR code encodes the Studio's address, not nothing: a code that
  // encoded nothing would scan as no code at all, and report-spec refuses
  // one with no runs. The square is 30 mm, the level M. The address is the
  // same in every catalogue, so no language changes what a new code scans
  // to.
  test('starts a QR code as the Studio’s address in a 30 mm square at level M', () => {
    const address = 'https://formancy.ai/report/'
    expect(defaultComponent({ ...richReport(), locale: 'en' }, 'qrCode')).toEqual({
      id: 'qr-code',
      kind: 'qrCode',
      content: [{ kind: 'text', text: address }],
      size: mmToPt(30),
      errorCorrection: 'M',
    })
    expect(EDITOR_LOCALES.map((locale) => editorText(locale)('default.qrCode'))).toEqual(EDITOR_LOCALES.map(() => address))
  })
})
