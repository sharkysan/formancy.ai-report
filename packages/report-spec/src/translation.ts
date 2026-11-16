/**
 * A report's own words, and their translations
 * ([0063](../../../docs/decisions/0063-a-reports-own-words-are-written-in-each-language-it-declares-and-a-render-names-the-one-it-prints-in.md)).
 *
 * A report is written in its own `locale`. It may declare `translations`:
 * for each other language, its words written in that language, each
 * looked up by its exact text in the report's own, and each expression
 * that prints words by its exact source. What a word is, is this module's
 * walk, and the places it walks are the only ones: every other string of
 * the format prints as written in every language, and `NOT_WORDS` names
 * each of them, so that a string added to the format is one or the other
 * by a decision. `report-in.ts` writes a report in one of its languages;
 * `validate-translations.ts` holds what a translation may be.
 */
import type { ChartComponent } from './chart.js'
import type { Component, ComponentKind } from './components.js'
import type { ReportDefinition } from './definition.js'
import { at } from './pointer.js'
import type { TableComponent, TableFooterRow } from './table.js'
import type { Expression, Inline } from './values.js'
import { walkComponents } from './walk.js'

/** A word of the report, exactly as it stands in the report's own language, and what prints for it in a translation's. */
export interface TranslatedWord {
  readonly word: string
  readonly text: string
}

/** An expression that prints words, by its source exactly, and the expression that prints in its place in a translation's language. */
export interface TranslatedExpression {
  readonly cel: string
  readonly expression: Expression
}

/** The report's words in one language besides its own. */
export interface Translation {
  /** A BCP 47 tag, written as the report's `locale` is; never the report's own. */
  readonly locale: string
  /** Each word once; a language just added holds none yet. */
  readonly words: readonly TranslatedWord[]
  readonly expressions: readonly TranslatedExpression[]
}

/** A literal string where a word stands, and where it is. */
export interface WordPlace {
  /** The JSON Pointer to the string: a run's `text`, a column's `header`, the report's `title`. */
  readonly path: string
  readonly text: string
  /** The innermost component it stands in; none for the title or the payment part's message. */
  readonly componentId?: string
  /** For a table column's header and its value, the column's id. */
  readonly columnId?: string
}

/** An expression run where a word stands: a word where it prints text and its source holds a quote, which only the core can tell (0063). */
export interface WordExpressionSite {
  /** The JSON Pointer to the expression's `cel`, as report-core names the site it compiles. */
  readonly path: string
  readonly cel: string
  readonly componentId?: string
  readonly columnId?: string
}

/** Every place a word may stand: literal strings, whether or not each holds a letter, and expression runs. */
export interface WordPlaces {
  readonly literals: readonly WordPlace[]
  readonly expressions: readonly WordExpressionSite[]
}

const LETTER = /\p{L}/u

/** Whether `text` is a word: whether it holds a letter, of any script. A separator, a number or a sign prints as written in every language. */
export function isWord(text: string): boolean {
  return LETTER.test(text)
}

/** Where a word stands: the component and the column, where there is one. */
interface Owner {
  readonly componentId?: string
  readonly columnId?: string
}

/** What one walk collects. */
class Places implements WordPlaces {
  readonly literals: WordPlace[] = []
  readonly expressions: WordExpressionSite[] = []

  literal(text: string | undefined, path: string, owner: Owner): void {
    if (text !== undefined) this.literals.push({ path, text, ...owner })
  }

  run(inline: Inline, path: string, owner: Owner): void {
    if (inline.kind === 'text') this.literal(inline.text, at(path, 'text'), owner)
    if (inline.kind === 'expression') this.expressions.push({ path: `${path}/expression/cel`, cel: inline.expression.cel, ...owner })
  }

  runs(inlines: readonly Inline[] | undefined, path: string, owner: Owner): void {
    for (const [index, inline] of (inlines ?? []).entries()) this.run(inline, at(path, index), owner)
  }

  footer(rows: readonly TableFooterRow[] | undefined, path: string, owner: Owner): void {
    for (const [index, row] of (rows ?? []).entries()) {
      for (const [cell, { value }] of row.cells.entries()) this.run(value, `${path}/${index}/cells/${cell}/value`, owner)
    }
  }
}

type Walker<K extends ComponentKind> = (component: Extract<Component, { kind: K }>, path: string, into: Places) => void

const NONE = (): void => undefined

const table: Walker<'table'> = (component: TableComponent, path, into) => {
  const owner = { componentId: component.id }
  for (const [index, column] of component.columns.entries()) {
    const where = `${path}/columns/${index}`
    const inColumn = { ...owner, columnId: column.id }
    into.literal(column.header, `${where}/header`, inColumn)
    into.run(column.value, `${where}/value`, inColumn)
  }
  into.runs(component.group?.header, `${path}/group/header`, owner)
  into.footer(component.group?.footer, `${path}/group/footer`, owner)
  into.footer(component.totals, `${path}/totals`, owner)
  into.literal(component.emptyText, `${path}/emptyText`, owner)
}

/** A chart's words, in the order its type holds them. */
const chart: Walker<'chart'> = (component: ChartComponent, path, into) => {
  const owner = { componentId: component.id }
  into.literal(component.category.nullLabel, `${path}/category/nullLabel`, owner)
  for (const [index, series] of component.series.entries()) into.literal(series.label, `${path}/series/${index}/label`, owner)
  into.literal(component.emptyText, `${path}/emptyText`, owner)
  into.literal(component.title, `${path}/title`, owner)
  into.literal(component.categoryTitle, `${path}/categoryTitle`, owner)
  into.literal(component.valueTitle, `${path}/valueTitle`, owner)
}

/**
 * The words each kind holds. A table over every kind, so a kind added to
 * the format without saying where its words are does not compile. A QR
 * code's content and an EPC QR code's texts are codes a scanner reads, and
 * hold none; what a container holds is visited by the walk itself.
 */
const WALKERS: { readonly [K in ComponentKind]: Walker<K> } = {
  text: (component, path, into) => into.runs(component.content, `${path}/content`, { componentId: component.id }),
  image: NONE,
  qrCode: NONE,
  epcQrCode: NONE,
  line: NONE,
  rectangle: NONE,
  spacer: NONE,
  columns: NONE,
  section: NONE,
  table,
  chart,
  pageBreak: NONE,
  keepTogether: NONE,
}

/**
 * Every place a word may stand in `report`, in document order: the title,
 * each component's as the walk meets it, and the payment part's message
 * last. Literals whether or not they hold a letter; `reportWords` keeps
 * those that do.
 */
export function wordPlaces(report: ReportDefinition): WordPlaces {
  const into = new Places()
  into.literal(report.title, '/title', {})
  for (const { component, path } of walkComponents(report)) (WALKERS[component.kind] as Walker<ComponentKind>)(component, path, into)
  into.runs(report.paymentPart?.message, '/paymentPart/message', {})
  return into
}

/** Every word of `report`, at each place it stands, in document order: a word in several places is yielded at each. */
export function reportWords(report: ReportDefinition): readonly WordPlace[] {
  return wordPlaces(report).literals.filter(({ text }) => isWord(text))
}

/** Every expression run where a word stands, in document order: report-core says which of them print words. */
export function wordExpressionSites(report: ReportDefinition): readonly WordExpressionSite[] {
  return wordPlaces(report).expressions
}

/**
 * Every string of the format that is not a word, as JSON Pointer
 * patterns: from the report's root, or, after a component's kind and a
 * colon, from that component (`*` for any kind). A segment `*` is any one
 * segment, `**` any number of them. Each prints as written in every
 * language, for the reason given; `words.test.ts` holds every string a
 * report can hold to being a word place or one of these, and never both.
 */
export const NOT_WORDS: readonly { readonly why: string; readonly at: readonly string[] }[] = [
  {
    why: 'what names a part of the report, the format or a vocabulary, which no reader reads',
    at: [
      '/reportSpecVersion',
      '**/id',
      '**/kind',
      '**/style',
      '**/headerStyle',
      '**/dataset',
      '**/field',
      '**/parameter',
      '**/aggregate',
      '**/asset',
      '**/column',
      '**/over',
      '**/fn',
      '**/mode',
      '**/increment',
      '**/direction',
      '**/order',
      '**/transform',
      '**/code',
      '**/align',
      '**/baseline',
      '**/width',
      '**/fit',
      '**/errorCorrection',
      '**/color',
      '**/fill',
      '**/stroke',
      '**/palette/*',
      'chart:/chart',
    ],
  },
  { why: "the report's own language, and the languages its translations are in", at: ['/locale', '/translations/**'] },
  {
    why: 'conditions, which print nothing',
    at: ['*:/visibleWhen/cel', '*:/styleWhen/*/when/cel', 'table:/columns/*/visibleWhen/cel', 'table:/columns/*/styleWhen/*/when/cel'],
  },
  {
    why: "declarations the editor and the host show, and the page: a field's and a parameter's label is no word the report prints; a parameter's default is the value the host may replace",
    at: ['/page/**', '/styles/**', '/datasets/**', '/parameters/**', '/assets/**', '/aggregates/**', '/fonts/**', '/provenance/**'],
  },
  { why: "a code a scanner reads: a QR code's content and an EPC QR code's texts", at: ['qrCode:/content/**', 'epcQrCode:/**'] },
  {
    why: "a QR-bill's account, parties, reference, billing information, amount, currency and the language of its headings, which are identifiers and names; its message is a word",
    at: [
      '/paymentPart/language',
      '/paymentPart/currency',
      '/paymentPart/amount/cel',
      '/paymentPart/account/**',
      '/paymentPart/creditor/**',
      '/paymentPart/debtor/**',
      '/paymentPart/reference/**',
      '/paymentPart/billingInformation/**',
    ],
  },
  { why: "an e-invoice's texts, which its XML alone holds", at: ['/eInvoice/**'] },
]
