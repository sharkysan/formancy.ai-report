import { emptyReport, reportHash, validateReport } from '@formancy/report-spec'
import type { Component, FieldRef, ReportDefinition, SwissQrBill, Translation } from '@formancy/report-spec'
import { describe, expect, test } from 'vitest'
import type { Chart } from './chart-document.js'
import type { ReportData } from './data.js'
import type { Block, Paragraph, ResolvedDocument, Table } from './document.js'
import { resolveReport } from './resolve.js'
import type { Resolution, ResolveOptions } from './resolve.js'
import { chartData, chartReport, chartRow, invoiceData, invoiceReport, sampleData, sampleReport, xrechnungData, xrechnungReport } from './test-support.js'

/**
 * A render in a language a report declares (0063): the locale a render
 * names decides every word it prints, every value's format and the order
 * of its rows, and a word missing in it is refused, never printed in
 * another. The expected numbers, dates and orders are Intl's for the
 * locale, computed here, not read from the runtime.
 */

const header = (field: string): FieldRef => ({ dataset: 'header', field })
const detail = (field: string): FieldRef => ({ dataset: 'detail', field })
const AMOUNT = { kind: 'number', scale: 2, grouping: true } as const

/** The plural the order's line count prints, in German, and the same in French and in Swedish. */
const COUNT = 'header.count == 1 ? "eine Position" : string(header.count) + " Positionen"'
const COUNT_FR = 'header.count == 1 ? "une position" : string(header.count) + " positions"'
const COUNT_SV = 'header.count == 1 ? "en rad" : string(header.count) + " rader"'

/** An order in German: a title, a sentence with a date, an amount and a plural, and a table grouped by site with a footer and a total. */
function order(): ReportDefinition {
  const intro: Component = {
    id: 'intro',
    kind: 'text',
    content: [
      { kind: 'text', text: 'Bestellung vom ' },
      { kind: 'field', field: header('orderedOn'), format: { kind: 'date', style: 'long' } },
      { kind: 'text', text: ' über ' },
      { kind: 'field', field: header('amount'), format: AMOUNT },
      { kind: 'text', text: ', ' },
      { kind: 'expression', expression: { cel: COUNT } },
    ],
  }
  const lines: Component = {
    id: 'lines',
    kind: 'table',
    dataset: 'detail',
    columns: [
      { id: 'name', header: 'Artikel', width: 'fill', align: 'left', value: { kind: 'field', field: detail('name') } },
      { id: 'amount', header: 'Betrag', width: 80, align: 'right', value: { kind: 'field', field: detail('amount'), format: AMOUNT } },
    ],
    sort: [{ field: detail('name'), direction: 'asc' }],
    group: {
      by: detail('site'),
      direction: 'asc',
      header: [
        { kind: 'text', text: 'Standort ' },
        { kind: 'field', field: detail('site') },
      ],
      footer: [
        {
          cells: [
            { column: 'name', value: { kind: 'text', text: 'Zwischensumme' } },
            { column: 'amount', value: { kind: 'aggregate', aggregate: 'total', over: 'group', format: AMOUNT } },
          ],
        },
      ],
    },
    totals: [
      {
        cells: [
          { column: 'name', value: { kind: 'text', text: 'Gesamt' } },
          { column: 'amount', value: { kind: 'aggregate', aggregate: 'total', over: 'report', format: AMOUNT } },
        ],
      },
    ],
    emptyText: 'Keine Positionen.',
    repeatHeader: true,
  }
  return {
    ...emptyReport('order', 'Bestellungen', 'de-CH'),
    datasets: {
      header: {
        id: 'order',
        fields: [
          { id: 'orderedOn', type: 'date', label: 'Ordered on', nullable: false },
          { id: 'amount', type: 'decimal', label: 'Amount', nullable: false, scale: 2 },
          { id: 'count', type: 'integer', label: 'Count', nullable: false },
          { id: 'number', type: 'string', label: 'Number', nullable: false },
        ],
      },
      detail: {
        id: 'order-lines',
        fields: [
          { id: 'name', type: 'string', label: 'Name', nullable: false },
          { id: 'site', type: 'string', label: 'Site', nullable: false },
          { id: 'amount', type: 'decimal', label: 'Amount', nullable: false, scale: 2 },
        ],
      },
    },
    aggregates: [{ id: 'total', fn: 'sum', of: { kind: 'field', field: detail('amount') } }],
    regions: { reportHeader: [], pageHeader: [], body: [intro, lines], pageFooter: [], summary: [] },
  }
}

/** The order's words in French, every one. */
const FRENCH: Translation = {
  locale: 'fr-CH',
  words: [
    { word: 'Bestellungen', text: 'Commandes' },
    { word: 'Bestellung vom ', text: 'Commande du ' },
    { word: ' über ', text: ' pour ' },
    { word: 'Artikel', text: 'Article' },
    { word: 'Betrag', text: 'Montant' },
    { word: 'Standort ', text: 'Site ' },
    { word: 'Zwischensumme', text: 'Sous-total' },
    { word: 'Gesamt', text: 'Total général' },
    { word: 'Keine Positionen.', text: 'Aucune position.' },
  ],
  expressions: [{ cel: COUNT, expression: { cel: COUNT_FR } }],
}

/** The order's words in Swedish, every one: a locale that orders Ä and Ö after Z. */
const SWEDISH: Translation = {
  locale: 'sv-SE',
  words: [
    { word: 'Bestellungen', text: 'Beställningar' },
    { word: 'Bestellung vom ', text: 'Beställning den ' },
    { word: ' über ', text: ' på ' },
    { word: 'Artikel', text: 'Artikel' },
    { word: 'Betrag', text: 'Belopp' },
    { word: 'Standort ', text: 'Plats ' },
    { word: 'Zwischensumme', text: 'Delsumma' },
    { word: 'Gesamt', text: 'Summa' },
    { word: 'Keine Positionen.', text: 'Inga rader.' },
  ],
  expressions: [{ cel: COUNT, expression: { cel: COUNT_SV } }],
}

/** `report` with `translations`, checked valid. */
function translated(report: ReportDefinition, ...translations: Translation[]): ReportDefinition {
  const result = { ...report, translations }
  const outcome = validateReport(result)
  if (!outcome.valid) throw new Error(`not valid: ${outcome.errors.map((error) => `${error.code} ${error.path} ${error.message}`).join('; ')}`)
  return result
}

/** The order's data: lines at two sites whose names German and Swedish order apart. */
function orderData(rows: readonly Record<string, unknown>[] = LINES, count = 3): ReportData {
  return {
    header: { orderedOn: '2026-10-15', amount: '1234.50', count: String(count), number: 'B-2026-0042' },
    detail: rows,
    completeness: { complete: true, captured: rows.length },
    consistency: 'host-captured',
  }
}

const LINES = [
  { name: 'Zange', site: 'Zug', amount: '1000.00' },
  { name: 'Ärmel', site: 'Zug', amount: '200.00' },
  { name: 'Öse', site: 'Örebro', amount: '34.50' },
]

const FINAL: ResolveOptions = { mode: 'final', creationDate: '2026-10-15T08:00:00Z' }
const PREVIEW: ResolveOptions = { ...FINAL, mode: 'preview' }

function resolved(report: ReportDefinition, data: ReportData, options: ResolveOptions = FINAL): Extract<Resolution, { ok: true }> {
  const outcome = resolveReport(report, data, options)
  if (!outcome.ok) throw new Error(`refused: ${outcome.errors.map((error) => `${error.stage} ${error.code} ${error.path} ${error.message}`).join('; ')}`)
  return outcome
}

/** The errors a resolution was refused with, as stage, code and path. */
function refusals(report: ReportDefinition, data: ReportData, options: ResolveOptions = FINAL): string[] {
  const outcome = resolveReport(report, data, options)
  return outcome.ok ? [] : outcome.errors.map((error) => `${error.stage} ${error.code} ${error.path}`)
}

/** The blocks of the document's body, sections and columns included. */
function blocks(list: readonly Block[]): Block[] {
  return list.flatMap((block): Block[] => {
    if (block.kind === 'keepTogether' || block.kind === 'section') return [block, ...blocks(block.blocks)]
    if (block.kind === 'columns') return [block, ...block.columns.flatMap((column) => blocks(column.blocks))]
    return [block]
  })
}

/** Each paragraph's text, run by run joined. */
const paragraphs = (document: ResolvedDocument): string[] =>
  blocks(document.body)
    .filter((block): block is Paragraph => block.kind === 'paragraph')
    .map((paragraph) => paragraph.runs.map((run) => ('text' in run ? run.text : '')).join(''))

const tableOf = (document: ResolvedDocument): Table => blocks(document.body).find((block): block is Table => block.kind === 'table') as Table

/** Every text the document prints, as one string, so that a word of another language is found wherever it stands. */
const everything = (document: ResolvedDocument): string => JSON.stringify(document)

/** An amount as Intl writes it in `locale`, two places and grouped, handed the exact decimal. */
const amount = (locale: string, digits: string): string =>
  new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: true }).format(digits as Intl.StringNumericLiteral)

/** A date of the data as Intl writes it in `locale`, long, in UTC as the runtime formats a date. */
const longDate = (locale: string, date: string): string =>
  new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`))

/** The German words of the order that differ in French: none may print in a French render. */
const GERMAN_WORDS = ['Bestellung', 'über', 'Betrag', 'Standort', 'Zwischensumme', 'Gesamt', 'Keine Positionen', 'Positionen']

describe('a render that names no locale, or the report’s own', () => {
  // A report without translations takes the path it took before: one whose
  // document changed when its own locale is named would print otherwise
  // for a host that names it than for one that does not.
  test.each([
    ['the sample', sampleReport(), sampleData()],
    ['the e-invoice', invoiceReport(), invoiceData()],
    ['the XRechnung', xrechnungReport(), xrechnungData()],
    ['the chart', chartReport(), chartData()],
    ['the order', order(), orderData()],
  ])('resolves %s to the same document and manifest with its own locale named as with none', (_name, report, data) => {
    expect(resolveReport(report, data, { ...FINAL, locale: report.locale })).toEqual(resolveReport(report, data, FINAL))
  })

  // A French translation still being written must not stop the invoice
  // printing in German: an error of one language refusing every render
  // would leave a firm unable to bill while a translator works.
  test('prints a report whose French lacks a word in its own language, as the same report without translations', () => {
    const unfinished = translated(order(), { ...FRENCH, words: FRENCH.words.slice(1) })
    const plain = resolved(order(), orderData())
    for (const options of [FINAL, { ...FINAL, locale: 'de-CH' }]) {
      const outcome = resolved(unfinished, orderData(), options)
      expect(outcome.document).toEqual(plain.document)
      expect({ ...outcome.manifest, reportHash: plain.manifest.reportHash }).toEqual(plain.manifest)
    }
  })

  // An error of the report's own language -- an expression no language
  // can print -- refuses every render, a translation's among them: a
  // translation that compiles where its source does not would otherwise
  // print a report the editor calls broken.
  test('refuses every language where the report’s own has an error', () => {
    const broken = order()
    const intro = broken.regions.body[0] as Extract<Component, { kind: 'text' }>
    const content = [...intro.content.slice(0, 5), { kind: 'expression', expression: { cel: 'header.missing + " x"' } } as const]
    const report = { ...broken, regions: { ...broken.regions, body: [{ ...intro, content }, ...broken.regions.body.slice(1)] } }
    const french = { ...FRENCH, expressions: [{ cel: 'header.missing + " x"', expression: { cel: '"une"' } }] }
    const withFrench = { ...report, translations: [french] }
    expect(validateReport(withFrench).valid).toBe(true)
    for (const locale of [undefined, 'de-CH', 'fr-CH']) {
      const refused = refusals(withFrench, orderData(), { ...FINAL, ...(locale === undefined ? {} : { locale }) })
      expect(refused.some((refusal) => refusal.startsWith('expressions ') && refusal.endsWith('/regions/body/0/content/5/expression/cel'))).toBe(true)
    }
  })
})

describe('a render in a locale the report does not declare', () => {
  // A host that asks for French of a report written in German alone must
  // be told, not handed German: and a near locale is another language, so
  // fr-FR is not fr-CH.
  test.each([
    ['a report without translations', order(), 'fr-CH'],
    ['a near locale', translated(order(), FRENCH), 'fr-FR'],
    ['a language without its region', translated(order(), FRENCH), 'fr'],
    ['a malformed tag', translated(order(), FRENCH), 'fr_CH'],
    ['what is not a tag', translated(order(), FRENCH), 42],
  ])('refuses %s as undeclared-locale', (_name, report, locale) => {
    expect(refusals(report, orderData(), { ...FINAL, locale: locale as string })).toEqual(['resolve undeclared-locale '])
  })

  // The message names the locales a report is written in, so that a host
  // can ask again; it quotes no value a host could not have read itself.
  test('names the locales the report is written in', () => {
    const outcome = resolveReport(translated(order(), FRENCH, SWEDISH), orderData(), { ...FINAL, locale: 'en' })
    expect(outcome.ok ? [] : outcome.errors.map((error) => error.message)).toEqual([expect.stringContaining('de-CH, fr-CH, sv-SE')])
  })

  // A translation's locale the engine's Intl lacks would print in the
  // host's locale without a word; it is refused at the translation that
  // declares it, as the report's own is at /locale.
  test('refuses a translation’s locale the engine does not have, at the translation', () => {
    const report = translated(order(), FRENCH, { ...SWEDISH, locale: 'qaa' })
    expect(refusals(report, orderData(), { ...FINAL, locale: 'qaa' })).toEqual(['format unsupported-locale /translations/1/locale'])
    expect(refusals(report, orderData(), { ...FINAL, locale: 'fr-CH' })).toEqual([])
  })
})

describe('a render in a translation’s locale', () => {
  // Each place a word stands prints the translation and none of the
  // report's own words: a title, a sentence's runs, a column header, a
  // group header, a group's footer and a total, each in French.
  test('prints the translation’s words at every place, and none of the report’s own', () => {
    const { document } = resolved(translated(order(), FRENCH), orderData(), { ...FINAL, locale: 'fr-CH' })
    expect(document.info.title).toBe('Commandes')
    expect(paragraphs(document)).toEqual([`Commande du ${longDate('fr-CH', '2026-10-15')} pour ${amount('fr-CH', '1234.50')}, 3 positions`])
    const table = tableOf(document)
    expect(table.header).toEqual(['Article', 'Montant'])
    expect(table.rows.filter((row) => row.kind === 'groupHeader').map((row) => row.cells)).toEqual([['Site Örebro'], ['Site Zug']])
    expect(table.rows.filter((row) => row.kind === 'groupFooter').map((row) => row.cells[0])).toEqual(['Sous-total', 'Sous-total'])
    expect(table.rows.filter((row) => row.kind === 'total').map((row) => row.cells)).toEqual([['Total général', amount('fr-CH', '1234.50')]])
    expect(GERMAN_WORDS.filter((word) => everything(document).includes(word))).toEqual([])
  })

  // A table with no rows prints its empty text, which is a word too.
  test('prints the table’s empty text in the translation', () => {
    const { document } = resolved(translated(order(), FRENCH), orderData([]), { ...FINAL, locale: 'fr-CH' })
    expect(tableOf(document).emptyText).toBe('Aucune position.')
  })

  // Page 1's own header prints in the page header's place (0060), its
  // words the report's own: lowered from the report as written in its own
  // language, it would head a French render's first page in German.
  test('prints page 1’s own header in the translation, as it prints the page header', () => {
    const own = (id: string, text: string): Component => ({ id, kind: 'text', content: [{ kind: 'text', text }] })
    const report = order()
    const headed = { ...report, regions: { ...report.regions, firstPageHeader: [own('letterhead', 'Bestellungen')], pageHeader: [own('running', 'Gesamt')] } }
    const { document } = resolved(translated(headed, FRENCH), orderData(), { ...FINAL, locale: 'fr-CH' })
    const texts = (list: readonly Block[] | undefined): string[] =>
      (list ?? [])
        .filter((block): block is Paragraph => block.kind === 'paragraph')
        .map((paragraph) => paragraph.runs.map((run) => ('text' in run ? run.text : '')).join(''))
    expect({ firstPageHeader: texts(document.firstPageHeader), pageHeader: texts(document.pageHeader) }).toEqual({
      firstPageHeader: ['Commandes'],
      pageHeader: ['Total général'],
    })
  })

  // A run set below or above the line (0061) is a word where it holds a
  // letter, and a translation writes its text and nothing else of it: a
  // French render keeps every run's baseline, a digit so set printed as
  // written and a word so set in French. A translation that rebuilt the
  // run would print the French word on the line; and a word so set that
  // the language lacks is missing, as any word is, never printed in German.
  test('keeps each run’s baseline, a word set below or above the line printed in the translation', () => {
    const unit: Component = {
      id: 'unit',
      kind: 'text',
      content: [
        { kind: 'text', text: 'Fläche in m' },
        { kind: 'text', text: '2', baseline: 'superscript' },
        { kind: 'text', text: ', Spitze bei t' },
        { kind: 'text', text: 'Ende', baseline: 'subscript' },
      ],
    }
    const report = order()
    const shifted = { ...report, regions: { ...report.regions, body: [...report.regions.body, unit] } }
    const words = [...FRENCH.words, { word: 'Fläche in m', text: 'Surface en m' }, { word: ', Spitze bei t', text: ', pic à t' }, { word: 'Ende', text: 'fin' }]
    const { document } = resolved(translated(shifted, { ...FRENCH, words }), orderData(), { ...FINAL, locale: 'fr-CH' })
    const last = blocks(document.body)
      .filter((block): block is Paragraph => block.kind === 'paragraph')
      .at(-1)
    expect(last?.runs).toEqual([
      { text: 'Surface en m' },
      { text: '2', baseline: 'superscript' },
      { text: ', pic à t' },
      { text: 'fin', baseline: 'subscript' },
    ])
    const lacking = translated(shifted, { ...FRENCH, words: words.filter(({ word }) => word !== 'Ende') })
    expect(refusals(lacking, orderData(), { ...FINAL, locale: 'fr-CH' })).toEqual(['expressions word-missing /regions/body/2/content/3/text'])
  })

  // A word that follows a number is written as an expression, whole: one
  // line, one position, three positions, in French as in German.
  test('prints a translated expression, a plural, as that language writes it', () => {
    const report = translated(order(), FRENCH)
    const said = (count: number, locale?: string): string =>
      (paragraphs(resolved(report, orderData(LINES, count), { ...FINAL, ...(locale === undefined ? {} : { locale }) }).document)[0] ?? '').split(', ')[1] ?? ''
    expect([said(1), said(3), said(1, 'fr-CH'), said(3, 'fr-CH')]).toEqual(['eine Position', '3 Positionen', 'une position', '3 positions'])
  })

  // The locale decides every value's format as it decides the words: a
  // French sentence with a German date or a German number would be a
  // report half in each language.
  test('writes its numbers and dates as that locale writes them', () => {
    const report = translated(order(), FRENCH, SWEDISH)
    for (const locale of ['de-CH', 'fr-CH', 'sv-SE']) {
      const text = paragraphs(resolved(report, orderData(), { ...FINAL, locale }).document)[0] ?? ''
      expect([text.includes(longDate(locale, '2026-10-15')), text.includes(amount(locale, '1234.50'))]).toEqual([true, true])
    }
    // The three write the amount three ways, so the test above holds three formats and not one.
    expect(new Set(['de-CH', 'fr-CH', 'sv-SE'].map((locale) => amount(locale, '1234.50'))).size).toBe(3)
  })

  // Rows and groups are ordered by the render's collation: German orders
  // Ä and Ö with A and O, Swedish after Z. A Swedish render in German
  // order would list its rows as no Swedish reader looks for them.
  test('orders its rows and groups by that locale’s collation', () => {
    const report = translated(order(), FRENCH, SWEDISH)
    const names = (locale: string): string[] =>
      tableOf(resolved(report, orderData(), { ...FINAL, locale }).document)
        .rows.filter((row) => row.kind !== 'total' && row.kind !== 'groupFooter')
        .map((row) => row.cells[0] as string)
    expect(names('de-CH')).toEqual(['Standort Örebro', 'Öse', 'Standort Zug', 'Ärmel', 'Zange'])
    expect(names('sv-SE')).toEqual(['Plats Zug', 'Zange', 'Ärmel', 'Plats Örebro', 'Öse'])
  })

  // A table's row condition (0062) is no word: it selects the rows the
  // table prints, and is read as written in every language, so that a
  // French render and a Swedish one list what the German does. A
  // translator who wrote every quoted string in French, the condition's
  // among them, would otherwise empty the table in French; the entry is
  // the editor's unused translation, never printed and never read.
  test('selects the same rows by a table’s condition in every language, a translation of the condition read nowhere', () => {
    const report = order()
    const zug: Component = {
      id: 'zug',
      kind: 'table',
      dataset: 'detail',
      rowsWhen: { cel: 'row.site == "Zug"' },
      columns: [{ id: 'name', header: 'Artikel', width: 'fill', align: 'left', value: { kind: 'field', field: detail('name') } }],
      emptyText: 'Keine Positionen.',
      repeatHeader: true,
    }
    const french = { ...FRENCH, expressions: [...FRENCH.expressions, { cel: 'row.site == "Zug"', expression: { cel: 'row.site == "Zoug"' } }] }
    const both = translated({ ...report, regions: { ...report.regions, body: [...report.regions.body, zug] } }, french, SWEDISH)
    const selected = (locale: string): string[] => {
      const tables = blocks(resolved(both, orderData(), { ...FINAL, locale }).document.body).filter((block): block is Table => block.kind === 'table')
      return (tables.find((table) => table.id === 'zug')?.rows ?? []).map((row) => row.cells[0] as string)
    }
    expect(['de-CH', 'fr-CH', 'sv-SE'].map(selected)).toEqual([
      ['Zange', 'Ärmel'],
      ['Zange', 'Ärmel'],
      ['Zange', 'Ärmel'],
    ])
  })

  // A word missing in the language a render names is refused, never
  // printed in the report's own: a preview as a final render, since a
  // preview prints the report's words as a final render does. The report's
  // own language prints meanwhile.
  test('refuses a word missing in that language, in a preview as in a final render, and prints the report’s own', () => {
    const report = translated(order(), { ...FRENCH, words: FRENCH.words.filter(({ word }) => word !== 'Betrag') })
    for (const options of [FINAL, PREVIEW]) {
      const outcome = resolveReport(report, orderData(), { ...options, locale: 'fr-CH' })
      expect(outcome.ok ? [] : outcome.errors.map((error) => [error.stage, error.code, error.path, 'columnId' in error ? error.columnId : undefined])).toEqual([
        ['expressions', 'word-missing', '/regions/body/1/columns/1/header', 'amount'],
      ])
    }
    expect(resolved(report, orderData(), FINAL).document.info.title).toBe('Bestellungen')
  })

  // An expression that prints words and has no translation is missing as
  // a word is: printing the German plural in a French render would be the
  // fallback the decision refuses.
  test('refuses an expression that prints words and is not translated', () => {
    const report = translated(order(), { ...FRENCH, expressions: [] })
    expect(refusals(report, orderData(), { ...FINAL, locale: 'fr-CH' })).toEqual(['expressions word-missing /regions/body/0/content/5/expression/cel'])
  })

  // The manifest names what was printed: the template, translations and
  // all, by its hash, and the locale it was printed in, so that a PDF kept
  // for years says which of its languages it is.
  test('names the template’s hash and the render’s locale in its manifest', () => {
    const report = translated(order(), FRENCH)
    const french = resolved(report, orderData(), { ...FINAL, locale: 'fr-CH' }).manifest
    const own = resolved(report, orderData(), FINAL).manifest
    expect([french.reportHash, french.locale]).toEqual([reportHash(report), 'fr-CH'])
    expect([own.reportHash, own.locale]).toEqual([reportHash(report), 'de-CH'])
  })
})

/** A QR-bill in German whose message is a word and the order's number. */
const BILL: SwissQrBill = {
  kind: 'swissQrBill',
  language: 'de',
  account: [{ kind: 'text', text: 'CH44 3199 9123 0008 8901 2' }],
  creditor: {
    name: [{ kind: 'text', text: 'Formancy Haustechnik AG' }],
    street: [{ kind: 'text', text: 'Industriestrasse' }],
    buildingNumber: [{ kind: 'text', text: '7' }],
    postalCode: [{ kind: 'text', text: '3052' }],
    town: [{ kind: 'text', text: 'Zollikofen' }],
    country: [{ kind: 'text', text: 'CH' }],
  },
  currency: 'CHF',
  amount: { cel: 'header.amount' },
  reference: [{ kind: 'text', text: '210000000003139471430009017' }],
  message: [
    { kind: 'text', text: 'Bestellung ' },
    { kind: 'field', field: header('number') },
  ],
}

describe('a QR-bill in a translation’s locale', () => {
  const billed = (): ReportDefinition => ({ ...order(), paymentPart: BILL })
  const words = (translation: Translation): Translation => ({ ...translation, words: [...translation.words, { word: 'Bestellung ', text: 'Commande ' }] })

  // The slip's message is a word, and its headings follow a translated
  // render where SIX has headings in its language: a French invoice with a
  // German slip is the case one template in several languages is for.
  test('prints its message in the translation and its headings in that locale’s language', () => {
    const report = translated(billed(), words(FRENCH))
    const part = resolved(report, orderData(), { ...FINAL, locale: 'fr-CH' }).document.paymentPart
    expect([part?.headings.paymentPart, part?.headings.receipt]).toEqual(['Section paiement', 'Récépissé'])
    expect(part?.additionalInformation).toEqual(['Commande B-2026-0042'])
    expect(part?.payload.split('\n')).toContain('Commande B-2026-0042')
    const own = resolved(report, orderData(), FINAL).document.paymentPart
    expect([own?.headings.paymentPart, own?.additionalInformation]).toEqual(['Zahlteil', ['Bestellung B-2026-0042']])
  })

  // SIX writes its headings in five languages; a translation in a sixth
  // keeps the bill's own, which the report chose, rather than a language
  // nobody chose.
  test('keeps the bill’s own language where SIX has no headings in the translation’s', () => {
    const spanish: Translation = {
      locale: 'es-ES',
      words: [...FRENCH.words.map(({ word, text }) => ({ word, text: `${text} (es)` })), { word: 'Bestellung ', text: 'Pedido ' }],
      expressions: [{ cel: COUNT, expression: { cel: 'header.count == 1 ? "una línea" : string(header.count) + " líneas"' } }],
    }
    const part = resolved(translated(billed(), spanish), orderData(), { ...FINAL, locale: 'es-ES' }).document.paymentPart
    expect([part?.headings.paymentPart, part?.headings.receipt, part?.additionalInformation]).toEqual(['Zahlteil', 'Empfangsschein', ['Pedido B-2026-0042']])
  })
})

describe('a chart in a translation’s locale', () => {
  // A chart's words are words, and its categories are ordered by the
  // render's collation (0055): a chart is translated with no stage of its
  // own, so one left in English, or in English order, would show here.
  test('prints its title, series labels and null label in the translation, its categories in that locale’s order', () => {
    const swedish: Translation = {
      locale: 'sv-SE',
      words: [
        { word: 'Sales', text: 'Försäljning' },
        { word: 'Sales by region', text: 'Försäljning per region' },
        { word: 'No region', text: 'Ingen region' },
        { word: 'Revenue', text: 'Intäkter' },
        { word: 'Rounded', text: 'Avrundat' },
        { word: 'Region', text: 'Region' },
        { word: 'Amount', text: 'Belopp' },
        { word: 'No sales.', text: 'Ingen försäljning.' },
        { word: 'Month', text: 'Månad' },
      ],
      expressions: [],
    }
    const report = translated(chartReport(), swedish)
    const data = chartData([chartRow({ region: 'Zug' }), chartRow({ region: 'Örebro' }), chartRow({ region: null })])
    const chart = (locale?: string): Chart =>
      blocks(resolved(report, data, { ...FINAL, ...(locale === undefined ? {} : { locale }) }).document.body).find(
        (block): block is Chart => block.kind === 'chart',
      ) as Chart
    const words = ({ title, legend, ...rest }: Chart) => ({
      title,
      legend: legend.map(({ text }) => text),
      categories: 'categories' in rest ? rest.categories : [],
    })
    expect(words(chart('sv-SE'))).toEqual({ title: 'Försäljning per region', legend: ['Intäkter', 'Avrundat'], categories: ['Zug', 'Örebro', 'Ingen region'] })
    expect(words(chart())).toEqual({ title: 'Sales by region', legend: ['Revenue', 'Rounded'], categories: ['Örebro', 'Zug', 'No region'] })
  })
})

describe('form data in a translation’s locale', () => {
  /** The order's data as a formancy form's submission, its labels read in `locale` where it names one. */
  const formData = (locale?: string): ReportData => ({
    ...orderData(),
    source: {
      provider: 'formancy-form',
      submissions: [{ id: 'submission-1', form: 'order', formHash: 'a'.repeat(64) }],
      ...(locale === undefined ? {} : { locale }),
    },
  })

  // A choice's label prints in the locale it was read in: German labels
  // in a French render would be the fallback the decision refuses, so
  // data read in another locale than the render's is refused, and data
  // that names none was read in the report's own.
  test.each([
    ['labels read in the report’s own, rendered in French', undefined, 'fr-CH', ['data labels-locale-differs /source']],
    ['labels read in French, rendered in the report’s own', 'fr-CH', undefined, ['data labels-locale-differs /source/locale']],
    ['labels read in Swedish, rendered in French', 'sv-SE', 'fr-CH', ['data labels-locale-differs /source/locale']],
    ['labels read in French, rendered in French', 'fr-CH', 'fr-CH', []],
    ['labels read in the report’s own, rendered in it', undefined, undefined, []],
    ['labels said to be read in the report’s own, rendered in it', 'de-CH', 'de-CH', []],
  ])('%s', (_name, read, render, expected) => {
    const report = translated(order(), FRENCH, SWEDISH)
    expect(refusals(report, formData(read), { ...FINAL, ...(render === undefined ? {} : { locale: render }) })).toEqual(expected)
  })

  // A source names identifiers, and a locale is held to the tag a report
  // writes: anything else might be an answer riding into the manifest.
  test('refuses a source’s locale that is not a tag a report writes', () => {
    expect(refusals(order(), formData('de_CH'))).toEqual(['data invalid-source /source/locale'])
  })

  // The manifest carries the source as the check read it, its locale
  // among it, so that a PDF says in which language its labels were read.
  test('carries the source’s locale into the manifest', () => {
    const { manifest } = resolved(translated(order(), FRENCH), formData('fr-CH'), { ...FINAL, locale: 'fr-CH' })
    expect(manifest.source).toEqual(formData('fr-CH').source)
  })
})
