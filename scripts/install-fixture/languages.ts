/*
 * A report in several languages (0063), from the packed packages under
 * Node: a German order to which a report-core session adds French, a
 * command descriptor at a time, each word found by report-spec's walk;
 * report-core's diagnostics saying, in French alone, every word the
 * French still lacks; the runtime refusing a French render while one is
 * missing, and a locale the report does not declare, while the German
 * prints; then the French render once every word is written, its title,
 * its words and its amount as fr-CH writes them, its manifest naming
 * fr-CH and the template's hash, drawn to a PDF whose information names
 * the French title. consume.ts runs it and prints what it returns. It
 * lives apart because it changes when a report's languages do, and the
 * rest of consume.ts does not.
 */
import { emptyReport, reportHash, reportWords } from '@formancy/report-spec'
import type { Component, ReportDefinition } from '@formancy/report-spec'
import { diagnose, languageDiagnostics, openReportSession } from '@formancy/report-core'
import type { CommandDescriptor } from '@formancy/report-core'
import { resolveReport } from '@formancy/report-runtime'
import type { Block, ReportData, Resolution, ResolveOptions } from '@formancy/report-runtime'
import { renderPdf } from '@formancy/report-render-pdf'

const AMOUNT = { kind: 'number', scale: 2, grouping: true } as const

/** An order in German: its title, a sentence with its amount, and a table of its lines with a total and an empty text. */
function order(): ReportDefinition {
  const intro: Component = {
    id: 'intro',
    kind: 'text',
    content: [
      { kind: 'text', text: 'Bestellung über ' },
      { kind: 'field', field: { dataset: 'header', field: 'amount' }, format: AMOUNT },
    ],
  }
  const lines: Component = {
    id: 'lines',
    kind: 'table',
    dataset: 'detail',
    columns: [
      { id: 'name', header: 'Artikel', width: 'fill', align: 'left', value: { kind: 'field', field: { dataset: 'detail', field: 'name' } } },
      { id: 'amount', header: 'Betrag', width: 80, align: 'right', value: { kind: 'field', field: { dataset: 'detail', field: 'amount' }, format: AMOUNT } },
    ],
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
    ...emptyReport('order', 'Bestellung', 'de-CH'),
    datasets: {
      header: { id: 'order', fields: [{ id: 'amount', type: 'decimal', label: 'Amount', nullable: false, scale: 2 }] },
      detail: {
        id: 'order-lines',
        fields: [
          { id: 'name', type: 'string', label: 'Name', nullable: false },
          { id: 'amount', type: 'decimal', label: 'Amount', nullable: false, scale: 2 },
        ],
      },
    },
    aggregates: [{ id: 'total', fn: 'sum', of: { kind: 'field', field: { dataset: 'detail', field: 'amount' } } }],
    regions: { reportHeader: [], pageHeader: [], body: [intro, lines], pageFooter: [], summary: [] },
  }
}

/** The order's words in French, each by the German it translates. */
const FRENCH: Readonly<Record<string, string>> = {
  Bestellung: 'Commande',
  'Bestellung über ': 'Commande pour ',
  Artikel: 'Article',
  Betrag: 'Montant',
  Gesamt: 'Total',
  'Keine Positionen.': 'Aucune position.',
}

const DATA: ReportData = {
  header: { amount: '1234.50' },
  detail: [
    { name: 'Zange', amount: '1000.00' },
    { name: 'Öse', amount: '234.50' },
  ],
  completeness: { complete: true, captured: 2 },
  consistency: 'host-captured',
}

const FINAL: ResolveOptions = { mode: 'final', creationDate: '2026-10-15T08:00:00Z' }

/** Every text a document's body prints, its paragraphs' runs joined and its tables' headers, where a table has one (0078), and cells. */
function printed(blocks: readonly Block[]): string[] {
  return blocks.flatMap((block): string[] => {
    if (block.kind === 'paragraph') return [block.runs.map((run) => ('text' in run ? run.text : '')).join('')]
    if (block.kind === 'table') return [...(block.header ?? []), ...block.rows.flatMap((row) => row.cells), block.emptyText]
    return []
  })
}

/**
 * The title a PDF's information dictionary names, as PDFKit writes it: an
 * object of its own, uncompressed, which the trailer's `/Info` refers to;
 * undefined where it is not written so.
 */
function pdfTitle(pdf: Uint8Array): string | undefined {
  const text = new TextDecoder('latin1').decode(pdf)
  const object = (number: string | undefined): string | undefined =>
    number === undefined ? undefined : new RegExp(`\\n${number} 0 obj\\n([\\s\\S]*?)\\nendobj`).exec(text)?.[1]
  const info = object(/\/Info (\d+) 0 R/.exec(text.slice(text.lastIndexOf('trailer')))?.[1])
  return /^\((.*)\)$/.exec(object(/\/Title (\d+) 0 R/.exec(info ?? '')?.[1]) ?? '')?.[1]
}

/** What a refused resolution was refused with, as code and path; empty for one that resolved. */
const refusals = (resolution: Resolution): string[] => (resolution.ok ? [] : resolution.errors.map((error) => `${error.code} ${error.path}`))

/** Writes the order in French through the packed session, refuses and prints it; throws on the first wrong, and says what held. */
export async function languagesPrinted(): Promise<string> {
  const opening = openReportSession(order())
  if (!opening.ok) throw new Error(`the German order did not open a session: ${opening.errors.map((error) => error.code).join(', ')}`)
  const { session } = opening

  // A language added is one step, every word then missing in it alone:
  // the report's own words are whole, so its own diagnosis is empty.
  const added = session.apply(JSON.parse('{"command":"addLanguage","args":["fr-CH"]}') as CommandDescriptor)
  if (!added.ok || session.revision() !== 1) throw new Error('French was not added as one step')
  const words = [...new Set(reportWords(session.document()).map((place) => place.text))]
  if (words.length !== Object.keys(FRENCH).length || words.some((word) => FRENCH[word] === undefined))
    throw new Error(`report-spec's walk found other words than the order's: ${words.join(' | ')}`)
  const missing = languageDiagnostics(session.document(), 'fr-CH')
  if (missing.length !== words.length || missing.some((diagnostic) => diagnostic.code !== 'word-missing' || diagnostic.language !== 'fr-CH'))
    throw new Error(`French did not lack each word once: ${missing.map((diagnostic) => `${diagnostic.code} ${String(diagnostic.language)}`).join(', ')}`)
  if (diagnose(session.document()).some((diagnostic) => diagnostic.language === undefined))
    throw new Error('the German order was diagnosed in its own language')

  // An unfinished French refuses a French render and no other: the German
  // prints, and a locale the report does not declare is refused, never
  // printed in a near one.
  const unfinished = refusals(resolveReport(session.document(), DATA, { ...FINAL, locale: 'fr-CH' }))
  if (unfinished.length !== words.length || unfinished.some((refusal) => !refusal.startsWith('word-missing ')))
    throw new Error(`a French render lacking its words was not refused for each: ${unfinished.join('; ')}`)
  const german = resolveReport(session.document(), DATA, FINAL)
  if (!german.ok || german.document.info.title !== 'Bestellung' || german.manifest.locale !== 'de-CH')
    throw new Error(`the German order did not print while its French was unfinished: ${refusals(german).join('; ')}`)
  const near = refusals(resolveReport(session.document(), DATA, { ...FINAL, locale: 'fr-FR' }))
  if (near.join() !== 'undeclared-locale ') throw new Error(`fr-FR, which the report does not declare, was not refused: ${near.join('; ')}`)

  // Each word written by its descriptor, as a batch or a proposal would
  // carry it, and nothing is missing in French any more.
  for (const word of words) {
    const outcome = session.apply({ command: 'translateWord', args: ['fr-CH', word, FRENCH[word] ?? ''] } as CommandDescriptor)
    if (!outcome.ok) throw new Error(`"${word}" was not written in French: ${outcome.code}`)
  }
  const left = languageDiagnostics(session.document(), 'fr-CH')
  if (left.length !== 0) throw new Error(`French still lacked: ${left.map((diagnostic) => diagnostic.code).join(', ')}`)

  // The French render: its words, its amount as fr-CH writes it, the
  // template's hash and the render's locale in its manifest.
  const report = session.document()
  const french = resolveReport(report, DATA, { ...FINAL, locale: 'fr-CH' })
  if (!french.ok) throw new Error(`the French order was refused: ${refusals(french).join('; ')}`)
  const amount = new Intl.NumberFormat('fr-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: true }).format(
    '1234.50' as Intl.StringNumericLiteral,
  )
  const texts = printed(french.document.body)
  const expected = [`Commande pour ${amount}`, 'Article', 'Montant', 'Total', amount, 'Aucune position.']
  if (french.document.info.title !== 'Commande' || expected.some((text) => !texts.includes(text)))
    throw new Error(`the French order printed ${french.document.info.title}: ${texts.join(' | ')}`)
  if (texts.some((text) => Object.keys(FRENCH).some((word) => word.trim() !== '' && text.includes(word.trim()))))
    throw new Error(`the French order printed a German word: ${texts.join(' | ')}`)
  if (french.manifest.locale !== 'fr-CH' || french.manifest.reportHash !== reportHash(report))
    throw new Error(`the French manifest named ${french.manifest.locale} and ${french.manifest.reportHash}`)

  // Drawn: the PDF's information dictionary names the French title.
  const pdf = await renderPdf(french.document, { maxPages: 5 })
  const title = pdfTitle(pdf)
  if (title !== 'Commande') throw new Error(`the French PDF is titled ${String(title)}`)
  return `a German order written in French through the packed session, ${String(words.length)} words a command each, every one said missing in French alone until written; a French render refused while one was missing, and fr-FR as undeclared, while the German printed; then resolved in fr-CH, its words and its amount as fr-CH writes it, its manifest naming fr-CH and the template's hash, and drawn to a ${String(pdf.length)}-byte PDF titled in French`
}
