import { STARTERS } from '@formancy/report-corpus'
import type { Starter } from '@formancy/report-corpus'
import { insertComponent, languageDiagnostics, translateWord, updateColumn } from '@formancy/report-core'
import { reportWords, walkComponents, wordExpressionSites } from '@formancy/report-spec'
import type { ReportDefinition, TextComponent } from '@formancy/report-spec'
import { describe, expect, test } from 'vitest'
import { MAX_PLACES, translationRequest } from './request.js'
import type { TranslationRequest } from './request.js'
import { halfWritten, holds, notAWord, stringsIn, withLanguage } from './test-support.js'

/**
 * What a translation request carries, and what it never does (0085), over
 * every starter of the corpus: each with a language added and nothing
 * written in it, and again with half of it written -- every word of a
 * payment part's message among the half -- so that what a language lacks
 * is not every word the report holds.
 */

interface Variant {
  readonly name: string
  readonly starter: Starter
  readonly report: ReportDefinition
  readonly locale: string
}

const VARIANTS: readonly Variant[] = STARTERS.flatMap((starter) => {
  const { report, locale } = withLanguage(starter.report)
  return [
    { name: `${starter.id}, nothing written`, starter, report, locale },
    { name: `${starter.id}, half written`, starter, report: halfWritten(report, locale), locale },
  ]
})

/** The request `report` makes into `locale`, refused nowhere here. */
function requestOfReport(report: ReportDefinition, locale: string): TranslationRequest {
  const made = translationRequest(report, locale)
  if (!made.ok) throw new Error(`refused: ${made.bytes} bytes`)
  return made.request
}

/** The request `variant` makes. */
const requestOf = ({ report, locale }: Variant): TranslationRequest => requestOfReport(report, locale)

/** The monthly sales report, whose expressions print words in its table's group header and footer. */
const salesReport = (): ReportDefinition => (STARTERS.find(({ id }) => id === 'sales-report') as Starter).report

interface Payload {
  readonly from: string
  readonly into: string
  readonly words: readonly { readonly key: string; readonly source: string; readonly places: readonly string[]; readonly otherPlaces?: number }[]
  readonly expressions: readonly {
    readonly key: string
    readonly source: string
    readonly places: readonly string[]
    readonly gives: string
    readonly reads: readonly string[]
  }[]
  readonly translated: readonly { readonly source: string; readonly text: string }[]
}

const payloadOf = (request: TranslationRequest): Payload => JSON.parse(request.user) as Payload

const inPaymentPart = (path: string): boolean => path.startsWith('/paymentPart/')

/**
 * What `word-missing` says the language lacks, read back to each source
 * through report-spec's walk, apart from the request under test: the
 * sources standing anywhere in the payment part, and the rest.
 */
function missingOf({ report, locale }: Variant): { readonly asked: readonly string[]; readonly forPerson: readonly string[] } {
  const places = [
    ...reportWords(report).map(({ path, text }) => ({ path, entry: `word ${text}` })),
    ...wordExpressionSites(report).map(({ path, cel }) => ({ path, entry: `expression ${cel}` })),
  ]
  const at = new Map(places.map(({ path, entry }) => [path, entry]))
  const touching = new Set(places.filter(({ path }) => inPaymentPart(path)).map(({ entry }) => entry))
  const missing = languageDiagnostics(report, locale)
    .filter(({ code }) => code === 'word-missing')
    .map(({ path }) => at.get(path) as string)
  return { asked: missing.filter((entry) => !touching.has(entry)), forPerson: missing.filter((entry) => touching.has(entry)) }
}

/**
 * The strings a request carries by design, each held to the report by a
 * test of this file: its sources, the language's words so far, the two
 * locales, what an expression gives and reads, and its places, which the
 * last describe holds to their few shapes and the report's ids; and the
 * names of its own members, `from` and `expressions` among them.
 */
function carried(request: TranslationRequest, report: ReportDefinition): readonly string[] {
  const payload = payloadOf(request)
  // A source standing in the payment part is never one by design: taken
  // as one, a leak of the message would hide itself.
  const touching = new Set(
    [...reportWords(report), ...wordExpressionSites(report)]
      .filter(({ path }) => inPaymentPart(path))
      .map((place) => ('text' in place ? place.text : place.cel)),
  )
  const members = (value: unknown): string[] =>
    typeof value !== 'object' || value === null
      ? []
      : Object.entries(value).flatMap(([key, item]) => [...(Array.isArray(value) ? [] : [key]), ...members(item)])
  return [
    ...new Set(members(payload)),
    payload.from,
    payload.into,
    ...request.asked.flatMap(({ source, places }) => [...(touching.has(source) ? [] : [source]), ...places]),
    ...payload.expressions.flatMap(({ gives, reads }) => [gives, ...reads]),
    ...payload.translated.flatMap(({ source, text }) => [source, text]),
  ]
}

/**
 * Whether `text` stands inside a string the request carries by design: a
 * field's name inside an expression's source, a word inside a longer one,
 * a component's id, or a name that is also an English word of a place.
 */
const insideCarried = (request: TranslationRequest, report: ReportDefinition, text: string): boolean =>
  carried(request, report).some((held) => held.includes(text))

/** A name in a place: a component's id or a column's, quoted. */
const NAME = "'([^']+)'"

/** What a place inside a component says it is, one shape for each place report-spec's walk of the words visits. */
const WHAT = [
  `a run of text in paragraph ${NAME}`,
  `the header of column ${NAME} in table ${NAME}`,
  `what each row prints in column ${NAME} of table ${NAME}`,
  `the header each group of table ${NAME} prints`,
  `a cell of the footer each group of table ${NAME} prints`,
  `a cell of the totals under table ${NAME}`,
  `what table ${NAME} prints when it has no rows`,
  `the label chart ${NAME} gives the rows that have no category`,
  `the label of a series in chart ${NAME}`,
  `what chart ${NAME} prints when it has nothing to draw`,
  `the title of chart ${NAME}`,
  `the title of the category axis of chart ${NAME}`,
  `the title of the value axis of chart ${NAME}`,
]

/** Where on the pages each region prints. */
const WHERE = [
  'in the report header, before the body',
  "in the first page's own page header",
  'in the page header, on every page',
  'in the body',
  'in the page footer, on every page',
  'in the summary, after the body',
]

const PLACE = new RegExp(`^(?:${WHAT.join('|')}), (?:${WHERE.join('|')})$`)

/** Every id of a component, and of a table's column, `report` holds. */
function idsOf(report: ReportDefinition): ReadonlySet<string> {
  return new Set(
    walkComponents(report).flatMap(({ component }) => [component.id, ...(component.kind === 'table' ? component.columns.map(({ id }) => id) : [])]),
  )
}

describe('what a translation request asks for', () => {
  // A request built from the report's own words, rather than from what
  // word-missing says, would ask again for what a person translated, and
  // for an expression that prints no words, which the format refuses to
  // translate (0063).
  test.each(VARIANTS)("asks for exactly what word-missing names, but the payment part's: $name", (variant) => {
    const request = requestOf(variant)
    const missing = missingOf(variant)
    expect(request.asked.map(({ kind, source }) => `${kind} ${source}`)).toEqual(missing.asked)
    expect(request.forPerson.map(({ kind, source }) => `${kind} ${source}`)).toEqual(missing.forPerson)
    expect([request.later, request.noRoom]).toEqual([0, []])
  })

  // The keys are the request's own, and the payload is what the answer is
  // read against: a payload keyed otherwise than `asked`, or carrying a
  // source another than the one asked for, would have an answer read back
  // to the wrong word.
  test.each(VARIANTS)('keys every entry once, words and expressions apart, in the order asked: $name', (variant) => {
    const request = requestOf(variant)
    const payload = payloadOf(request)
    const told = [
      ...payload.words.map(({ key, source }) => `word ${key} ${source}`),
      ...payload.expressions.map(({ key, source }) => `expression ${key} ${source}`),
    ]
    expect(told).toEqual(request.asked.map(({ kind, key, source }) => `${kind} ${key} ${source}`))
    const counts = { word: 0, expression: 0 }
    const keys = request.asked.map(({ kind }) => `${kind === 'word' ? 'w' : 'e'}${String((counts[kind] += 1))}`)
    expect(request.asked.map(({ key }) => key)).toEqual(keys)
    expect([payload.from, payload.into]).toEqual([variant.report.locale, variant.locale])
  })

  // The words so far are the register to match, and nothing else of the
  // language: one of the payment part's among them would send the slip's
  // message after all.
  test.each(VARIANTS)("sends the language's words so far, but the payment part's: $name", (variant) => {
    const translation = variant.report.translations?.find(({ locale }) => locale === variant.locale)
    const touching = new Set([
      ...reportWords(variant.report).flatMap(({ path, text }) => (inPaymentPart(path) ? [text] : [])),
      ...wordExpressionSites(variant.report).flatMap(({ path, cel }) => (inPaymentPart(path) ? [cel] : [])),
    ])
    const expected = [
      ...(translation?.words ?? []).filter(({ word }) => !touching.has(word)).map(({ word, text }) => ({ source: word, text })),
      ...(translation?.expressions ?? []).filter(({ cel }) => !touching.has(cel)).map(({ cel, expression }) => ({ source: cel, text: expression.cel })),
    ]
    expect(payloadOf(requestOf(variant)).translated).toEqual(expected)
  })

  // A translation kept for a word the report no longer prints is no
  // register of the report, and a request that sent it would carry what a
  // person replaced -- the old text of a header -- and grow toward its
  // bound with nothing anybody asked for.
  test('sends no translation of a word the report no longer prints', () => {
    const { report, locale } = withLanguage(salesReport())
    const written = translateWord(report, locale, 'Datum', 'Date')
    const replaced = written.ok ? updateColumn(written.report, 'lines', 'date', { header: 'Belegdatum' }) : written
    if (!replaced.ok) throw new Error(replaced.message)
    const request = requestOfReport(replaced.report, locale)
    expect(payloadOf(request).translated).toEqual([])
    expect(request.asked.map(({ source }) => source)).toEqual(expect.arrayContaining(['Belegdatum']))
  })
})

describe('what a translation request never carries', () => {
  // translationRequest takes no data by type; a string of the sample data
  // in the request would mean a report string that holds it went out, or
  // that the type was widened. formancy.ai 0161 found a check that looked
  // only for the written form passing with every rule in the request, JSON
  // having escaped each one's quotes.
  test.each(STARTERS)('holds none of the sample data, as written or as JSON escapes it: $id', (starter) => {
    const variant = VARIANTS.find((each) => each.starter === starter) as Variant
    const request = requestOf(variant)
    const checked = stringsIn({ data: starter.data, parameters: starter.parameters }).filter(({ text }) => !insideCarried(request, variant.report, text))
    expect(checked.length).toBeGreaterThan(0)
    expect(checked.filter(({ text }) => holds(request.user, text))).toEqual([])
  })

  // Every string of a report is a word or one NOT_WORDS names (report-spec's
  // words.test.ts). Of the second, a request carries the ids and the kinds
  // a place is named by, the report's locale and the language's words so
  // far, by design; any other -- a condition, a parameter's default, a
  // dataset's label, a QR code's content, the e-invoice -- in a request
  // would be the report sent beside its words.
  test.each(VARIANTS)('holds no string NOT_WORDS names but the ids, the kinds, the locale and the words so far: $name', (variant) => {
    const request = requestOf(variant)
    const byDesign = new Set(['**/id', '**/column', '**/kind', '/locale', '/translations/**'])
    const named = stringsIn(variant.report).flatMap(({ path, text }) => {
      const pattern = notAWord(variant.report, path)
      return pattern === undefined || byDesign.has(pattern) || insideCarried(request, variant.report, text) ? [] : [{ path, text }]
    })
    expect(named.length).toBeGreaterThan(0)
    expect(named.filter(({ text }) => holds(request.user, text))).toEqual([])
  })

  // The payment part's message is a word (0063), printed on the slip and
  // encoded in its code, and no proposal changes what the payment part
  // prints (0039, 0048): none of its strings, nor a translation of one of
  // its words, may reach a model.
  test.each(VARIANTS.filter(({ report }) => report.paymentPart !== undefined))('holds nothing of the payment part: $name', (variant) => {
    const request = requestOf(variant)
    const message = new Set(reportWords(variant.report).flatMap(({ path, text }) => (inPaymentPart(path) ? [text] : [])))
    const translation = variant.report.translations?.find(({ locale }) => locale === variant.locale)
    const partStrings = [
      ...stringsIn(variant.report.paymentPart, '/paymentPart'),
      ...(translation?.words ?? []).filter(({ word }) => message.has(word)).map(({ text }, index) => ({ path: `translated ${String(index)}`, text })),
    ]
    const checked = partStrings.filter(({ text }) => !insideCarried(request, variant.report, text))
    expect(checked.length).toBeGreaterThan(0)
    expect(checked.filter(({ text }) => holds(request.user, text))).toEqual([])
  })

  // The payment reminder pays by a QR-bill whose message is a word the
  // report prints nowhere else: it is the person's to write, listed, and
  // the request into a language with nothing written holds it nowhere.
  test("lists the payment reminder's message for a person, and asks for it nowhere", () => {
    const variant = VARIANTS.find(({ name }) => name === 'payment-reminder, nothing written') as Variant
    const request = requestOf(variant)
    const message = reportWords(variant.report).filter(({ path }) => inPaymentPart(path))
    expect(message.length).toBeGreaterThan(0)
    expect(request.forPerson.map(({ source }) => source)).toEqual(expect.arrayContaining(message.map(({ text }) => text)))
    expect(message.filter(({ text }) => request.asked.some(({ source }) => source === text))).toEqual([])
  })
})

describe('where a request says each word stands', () => {
  // A word in every row of a table, or in many paragraphs, would otherwise
  // be told once for each, and a request would grow with the report's
  // repetitions rather than its words.
  test('tells three places of a word and counts the rest', () => {
    const { report, locale } = withLanguage(STARTERS[0]?.report as ReportDefinition)
    let working = report
    for (const index of [0, 1, 2, 3, 4]) {
      const paragraph: TextComponent = { id: `repeated-${String(index)}`, kind: 'text', content: [{ kind: 'text', text: 'Wiederholt' }] }
      const inserted = insertComponent(working, { region: 'body', index: 0 }, paragraph)
      if (!inserted.ok) throw new Error(inserted.message)
      working = inserted.report
    }
    const made = translationRequest(working, locale)
    const entry = made.ok ? made.request.asked.find(({ source }) => source === 'Wiederholt') : undefined
    expect(entry?.places).toHaveLength(MAX_PLACES)
    expect(entry?.otherPlaces).toBe(2)
    expect(entry?.places.every((place) => /^a run of text in paragraph 'repeated-\d', in the body$/.test(place))).toBe(true)
    const told = made.ok ? payloadOf(made.request).words.find(({ source }) => source === 'Wiederholt') : undefined
    expect(told?.otherPlaces).toBe(2)
  })

  // A place told twice is a place told for nothing; a word told nowhere
  // gives a model nothing to tell a header from a sentence by.
  test.each(VARIANTS)('tells each word somewhere, at most three places, each once: $name', (variant) => {
    for (const { places, otherPlaces } of requestOf(variant).asked) {
      expect(places.length).toBeGreaterThan(0)
      expect(places.length).toBeLessThanOrEqual(MAX_PLACES)
      expect(new Set(places).size).toBe(places.length)
      if (otherPlaces > 0) expect(places).toHaveLength(MAX_PLACES)
    }
  })

  // A place says what kind of thing a word stands in and where, by the
  // ids the report names its components and columns by, and nothing else
  // of the report: a place that quoted a condition, a label or a word
  // would carry the report out beside its words, unseen by the checks
  // above, which take a place's words as the request's own.
  test.each(VARIANTS)("says each place in one of its shapes, naming only the report's ids: $name", (variant) => {
    const ids = idsOf(variant.report)
    const report = new Set(["the report's title, which the PDF's properties show"])
    for (const { places } of requestOf(variant).asked) {
      for (const place of places) {
        if (report.has(place)) continue
        expect([place, PLACE.test(place)]).toEqual([place, true])
        const names = [...place.matchAll(/'([^']+)'/g)].map((match) => match[1] as string)
        expect(names.filter((name) => !ids.has(name))).toEqual([])
      }
    }
  })

  // word-missing names an expression at its first site that prints words,
  // which need not be its first site: one that cannot compile where it
  // first stands -- a group's key in the report header -- and prints words
  // in a table's group header is lacking all the same, and asked with what
  // it gives and reads where it prints them.
  test('asks for an expression at the site word-missing names, where its first site does not compile', () => {
    const { report, locale } = withLanguage(salesReport())
    const source = 'group.key + " (" + string(group.documents) + " Belege)"'
    const paragraph: TextComponent = { id: 'misplaced', kind: 'text', content: [{ kind: 'expression', expression: { cel: source } }] }
    const inserted = insertComponent(report, { region: 'reportHeader', index: 0 }, paragraph)
    if (!inserted.ok) throw new Error(inserted.message)
    const request = requestOfReport(inserted.report, locale)
    expect(request.asked.filter((entry) => entry.source === source).map(({ kind }) => kind)).toEqual(['expression'])
    const told = payloadOf(request).expressions.find((entry) => entry.source === source)
    expect([told?.gives, told?.reads]).toEqual(['string', ['group.documents', 'group.key']])
  })

  // An expression's translation must give what its source gives and read
  // what it reads (0063); a request that told the model otherwise would
  // have it write translations report-core then refuses.
  test('tells an expression what it gives and what it reads', () => {
    const variant = VARIANTS.find(({ name }) => name === 'sales-report, nothing written') as Variant
    const expressions = payloadOf(requestOf(variant)).expressions
    expect(expressions.map(({ gives, reads }) => [gives, reads])).toEqual([
      ['string', ['group.documents', 'group.key']],
      ['string', ['group.key']],
    ])
  })

  // A request for a language the report does not declare would ask for
  // words the report has no place to keep: a caller's mistake, said.
  test('refuses a language the report declares no translation into', () => {
    const report = STARTERS[0]?.report as ReportDefinition
    expect(() => translationRequest(report, 'fr-CH')).toThrow(RangeError)
    expect(() => translationRequest(report, report.locale)).toThrow(RangeError)
  })
})
