import { nextComponentId, validLocations } from '@formancy/report-core'
import { COMPONENT_KINDS, emptyReport, mmToPt } from '@formancy/report-spec'
import type { ReportDefinition } from '@formancy/report-spec'
import { describe, expect, test } from 'vitest'
import { defaultComponent } from './palette.js'
import { editorOver, richReport } from './test-support.js'
import { contentLocale, EDITOR_LOCALES, editorText } from './text.js'

describe('the palette', () => {
  // Every kind the format has is offered, in the format's order, named in
  // the person's language: a kind missing from it is one nobody can add
  // without editing JSON.
  test('offers every kind, in the format’s order, in the editor’s language', () => {
    const { editor } = editorOver(richReport(), { locale: 'de-CH' })
    const { palette } = editor.state()
    expect(palette.map((entry) => entry.kind)).toEqual([...COMPONENT_KINDS])
    expect(palette.map((entry) => entry.label)).toEqual(['Text', 'Bild', 'QR-Code', 'EPC-Zahlcode', 'Linie', 'Rechteck', 'Abstand', 'Spalten', 'Abschnitt', 'Tabelle', 'Seitenumbruch', 'Zusammenhalten'])
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
    const withoutTable: ReportDefinition = { ...report, regions: { ...report.regions, body: report.regions.body.filter((component) => component.kind !== 'table') }, aggregates: [] }
    const table = editorOver(withoutTable).editor.state().palette.find((entry) => entry.kind === 'table')
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
    const withoutTable: ReportDefinition = { ...report, locale: 'fr-CH', regions: { ...report.regions, body: report.regions.body.filter((component) => component.kind !== 'table') }, aggregates: [] }
    const table = editorOver(withoutTable, { locale: 'de-CH' }).editor.state().palette.find((entry) => entry.kind === 'table')
    expect(table?.component).toMatchObject({ emptyText: editorText('fr-CH')('default.emptyText') })
    expect(table?.label).toBe('Tabelle')
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

  // With no asset to pin, a new image draws the header's image field: a
  // signature captured with a form.
  test('draws a header image field when there is no asset', () => {
    const report = richReport()
    const withoutAssets: ReportDefinition = { ...report, assets: [], regions: { ...report.regions, reportHeader: report.regions.reportHeader.slice(1) } }
    const image = editorOver(withoutAssets).editor.state().palette.find((entry) => entry.kind === 'image')
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
    expect(defaultComponent({ ...richReport(), locale: 'en' }, 'qrCode')).toEqual({ id: 'qr-code', kind: 'qrCode', content: [{ kind: 'text', text: address }], size: mmToPt(30), errorCorrection: 'M' })
    expect(EDITOR_LOCALES.map((locale) => editorText(locale)('default.qrCode'))).toEqual(EDITOR_LOCALES.map(() => address))
  })
})
