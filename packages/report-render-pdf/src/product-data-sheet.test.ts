import {
  inflatedDigest,
  PRODUCT_DATA_SHEET,
  productDataSheetAlone,
  productDataSheetData,
  readPdf,
  readPdfObjects,
  SHEET_EDITIONS,
  starterImages,
  verify,
  type ReadPdf,
  type SheetWords,
} from '@formancy/report-corpus'
import { resolveReport, type ReportDefinition, type ResolvedDocument } from '@formancy/report-runtime'
import { describe, expect, test } from 'vitest'
import { renderPdf } from './node.js'
import { expectation, fixtureOf, normalise, TIMEOUT } from './testing/documents.js'
import { MARGIN, markAt, marksOn } from './testing/letterhead.js'
import { pageLines } from './testing/lines.js'

/**
 * The product data sheet starter (0064), end to end, in each language it
 * is written in (0063): resolved by the runtime in that locale, rendered
 * by pdfmake and proved on the PDF it produced, read back with PDF.js
 * (0003). Its powers, its index and its footnotes' marks are proved by the
 * corpus's `shiftedRuns`, each at its size and its move off the line
 * (0061), and read into the line they stand on; every line of the page is
 * held to the sheet's words in that language and to its values as Intl
 * writes them in that locale, the U-value recomputed here in BigInt from
 * the data; and no German word that differs prints on another language's
 * page.
 */

const CREATED = '2026-11-16T08:00:00Z'
const DATA = productDataSheetData()
const header = DATA.header as Readonly<Record<string, string>>

function resolved(report: ReportDefinition, locale?: string): ResolvedDocument {
  const outcome = resolveReport(report, DATA, {
    mode: 'final',
    parameters: {},
    images: starterImages,
    creationDate: CREATED,
    ...(locale === undefined ? {} : { locale }),
  })
  if (!outcome.ok) throw new Error(`refused: ${outcome.errors.map((error) => `${error.stage} ${error.code} ${error.path} ${error.message}`).join('; ')}`)
  return outcome.document
}

const printed = async (document: ResolvedDocument): Promise<{ readonly bytes: Uint8Array; readonly pdf: ReadPdf }> => {
  const bytes = await renderPdf(document, { maxPages: 5 })
  return { bytes, pdf: await readPdf(bytes) }
}

/** `value`, exact, as Intl writes it in `locale` with `places` places and no grouping. */
const number = (locale: string, value: string, places: number): string =>
  normalise(
    new Intl.NumberFormat(locale, { minimumFractionDigits: places, maximumFractionDigits: places, useGrouping: false }).format(
      value as Intl.StringNumericLiteral,
    ),
  )

/** 1/R to the hundredth, half away from zero, from R's digits in BigInt: R is written with two places. */
function transmittance(resistance: string): string {
  const hundredths = BigInt(resistance.replace('.', ''))
  const value = (2n * 10000n + hundredths) / (2n * hundredths)
  return `${value / 100n}.${String(value % 100n).padStart(2, '0')}`
}

/** The sender line under the mark: the firm's, its UID called the VAT number it is in `words`' language. */
const sender = (words: SheetWords): string => `Formancy Haustechnik AG · Industriestrasse 7 · 3052 Zollikofen · CHE-123.456.789 ${words.vatNumber}`

/**
 * Every line of the sheet's page in `words`' language, top to bottom: each
 * label beside its value on one line, every power, index and mark read
 * into the line it stands on, as the reader joins a run set off the line
 * to the run beside it.
 */
function sheetLines(words: SheetWords): string[] {
  const { locale } = words
  const issued = new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(`${header['issuedOn']}T00:00:00Z`))
  return [
    sender(words),
    words.title,
    'ThermoPlan FB 30',
    `${words.article}TP-FB30-1200`,
    words.description,
    words.technical,
    `${words.thickness} ${number(locale, header['thickness']!, 0)} mm`,
    `${words.density} ${number(locale, header['density']!, 0)} kg/m3`,
    `${words.conductivity} ${number(locale, header['conductivity']!, 3)} W/(m·K)`,
    `${words.resistance} ${number(locale, header['resistance']!, 2)} m2·K/W`,
    `${words.transmittance}1 ${number(locale, transmittance(header['resistance']!), 2)} W/(m2·K)`,
    `${words.compressive} ${number(locale, header['compressive']!, 0)} kPa`,
    `${words.fire} ${header['fireClass']}`,
    words.environment,
    `${words.warming}2 ${number(locale, header['warming']!, 1)}${words.carbon[0]}2${words.carbon[1]}2`,
    `1${words.notes[0]}`,
    `2${words.notes[1]}`,
    `${words.issued[0]}${issued}${words.issued[1]}`,
  ].map(normalise)
}

/**
 * Every word of `words` the sheet prints as whole words of a line, each a
 * label, a heading or a sentence of its own. Not the words after CO₂'s
 * index, which stand between two runs set off the line, "CO2-Äq. pro
 * m2", and are never whole words there: the exact lines of
 * `sheetLines` hold them in each language.
 */
const ownWords = (words: SheetWords): string[] =>
  [
    words.title,
    words.article,
    words.description,
    words.technical,
    words.thickness,
    words.density,
    words.conductivity,
    words.resistance,
    words.transmittance,
    words.compressive,
    words.fire,
    words.environment,
    words.warming,
    ...words.notes,
    ...words.issued,
  ].map(normalise)

const [GERMAN] = SHEET_EDITIONS as [SheetWords, ...SheetWords[]]
const languages = SHEET_EDITIONS.map((words) => [words.locale, words] as const)

describe('the product data sheet, printed in each of its languages', () => {
  // Its powers, its index and its footnotes' marks, by the corpus's
  // checks over the document the runtime resolved in that language: each
  // run the document sets below or above the line drawn at SHIFTED_SIZE of
  // its paragraph's size and moved by SHIFTED_RISE, on the line of the text
  // beside it, and no run read so that the document does not set; the mark
  // where a letter's is, nothing over a margin or over other text. A power
  // printed on the line, or as a character of its own, would fail here.
  test.each(languages)(
    'sets each power, index and mark off the line in %s, as shiftedRuns reads it',
    async (locale, words) => {
      const document = resolved(PRODUCT_DATA_SHEET.report, locale)
      const { pdf } = await printed(document)
      expect(pdf.pages).toHaveLength(1)
      const stated = { maxPagesExpected: 1, exactText: sheetLines(words) }
      // The guard on the guard: a check of no run would pass a sheet that sets none.
      expect(expectation(document, stated).shiftedRuns.map(({ text, shift }) => `${text} ${shift}`)).toEqual([
        '3 superscript',
        '2 superscript',
        '1 superscript',
        '2 superscript',
        '2 superscript',
        '2 subscript',
        '2 superscript',
        '1 superscript',
        '2 superscript',
      ])
      expect(verify(fixtureOf(`product-data-sheet-${locale}`, document, stated), pdf)).toEqual([])
      expect(marksOn(pdf.pages[0]!)).toEqual([markAt(MARGIN)])
    },
    TIMEOUT,
  )

  // A render in a language is a sheet a reader of that language uses:
  // every line of its page in its words, its values as its locale writes
  // them -- the U-value 1/R, computed here, not by the runtime -- its title
  // the PDF's; and none of the German words that differ from its own. A
  // German label left at one place, a value formatted in German, or a
  // power read off its line would each fail here.
  test.each(languages)(
    'prints every line in %s, its values as its locale writes them, and no German word that differs',
    async (locale, words) => {
      const { bytes, pdf } = await printed(resolved(PRODUCT_DATA_SHEET.report, locale))
      expect(pageLines(pdf.pages[0]!).map((line) => line.text)).toEqual(sheetLines(words))
      expect((await readPdfObjects(bytes)).info['Title']).toBe(words.title)
      const own = new Set(ownWords(words))
      const text = ` ${pageLines(pdf.pages[0]!)
        .map((line) => line.text)
        .join(' ')} `
      expect(ownWords(GERMAN).filter((word) => !own.has(word) && text.includes(` ${word} `))).toEqual([])
    },
    TIMEOUT,
  )

  // The renderer has no language step: it draws what the runtime
  // resolved. So a render in a language is the same PDF as the sheet
  // written in that language alone; a stage that read the report's own
  // words or its own locale rather than the render's would differ here
  // wherever the lines above do not look.
  test.each(languages)(
    'prints in %s the same PDF as the sheet written in that language alone',
    async (locale, words) => {
      const translated = await printed(resolved(PRODUCT_DATA_SHEET.report, locale))
      const alone = await printed(resolved(productDataSheetAlone(words)))
      expect(await inflatedDigest(translated.bytes)).toBe(await inflatedDigest(alone.bytes))
    },
    TIMEOUT,
  )
})
