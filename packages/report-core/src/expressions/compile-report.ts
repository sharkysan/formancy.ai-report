/**
 * Every expression in a report compiled where it stands: what the editor
 * diagnoses and what the runtime evaluates, from one function.
 *
 * The runtime compiles a report before it renders one. If it assembled its
 * own compile options, it could accept what the editor refuses -- `now()`,
 * a member nothing declares -- or bind a value as a type the editor did not
 * check it as. So both take this: the diagnostics are its errors, and the
 * runtime refuses a report that has any, evaluates the programs it gives,
 * binds each with `expressionValues`, and computes the aggregates in the
 * order it gives.
 */
import type { DeclaredType } from '@formancy/expressions'
import type { AggregateDef, ReportDefinition } from '@formancy/report-spec'
import { diagnostic } from '../diagnostics/codes.js'
import type { Diagnostic } from '../diagnostics/codes.js'
import { expressionSites } from '../diagnostics/parts.js'
import type { ExpressionSite } from '../diagnostics/parts.js'
import { quote } from '../outcome.js'
import { aggregateOrder, aggregateReads, cycleDiagnostic } from './aggregates.js'
import { compileSite } from './compile-site.js'
import type { CompiledExpression, Images, SiteOutcome } from './compile-site.js'
import { invoiceMembers, paidMember } from './e-invoice.js'
import { COMPUTES, fieldsOf, groupKeyOf, imagesOf, parametersOf, readAs, TOTALS } from './members.js'
import type { ExpressionMember, Members } from './members.js'

export interface ReportCompilation {
  /** What each name holds in this report: every member an expression can read, with the type it is checked and bound as. */
  readonly members: Members
  /** Every expression that compiled clean, by the JSON Pointer to its `cel`, in document order, the aggregates' last. */
  readonly expressions: ReadonlyMap<string, CompiledExpression>
  /** The aggregates in the order the runtime computes them: each after every aggregate its expression reads. One with no place in it is diagnosed. */
  readonly aggregateOrder: readonly string[]
  /** Every reason an expression cannot be evaluated, in document order, the aggregates' last: what the runtime refuses the report for. */
  readonly diagnostics: readonly Diagnostic[]
}

/** The CEL types a member can be declared as, of all the types an expression can give. */
const SCALARS: ReadonlySet<string> = new Set<DeclaredType>(['bool', 'int', 'double', 'decimal', 'string', 'timestamp', 'dyn'])

/** Where an e-invoice's paid amount stands: `invoice.paid` is what it gives. */
const PAID = '/eInvoice/paid/cel'

/**
 * Every expression in `report` -- a report the validator accepts --
 * compiled where it stands; or, with `only`, the expressions at those
 * pointers to their `cel` alone, with every aggregate's and the
 * e-invoice's paid amount, which what they read is computed from: what a
 * review compiles of a resolution that changes one field's type, the
 * expressions that change can reach (`fieldReaders`, 0048).
 */
export function compileReport(report: ReportDefinition, only?: ReadonlySet<string>): ReportCompilation {
  const sites = expressionSites(report)
  return compiledSites(report, only === undefined ? sites : sites.filter(({ path }) => only.has(path) || path.startsWith('/aggregates/') || path === PAID))
}

/** `compileReport` over sites already walked: `diagnose` walks the report once for this and for its warnings. */
export function compiledSites(report: ReportDefinition, sites: readonly ExpressionSite[]): ReportCompilation {
  const images: Images = { header: imagesOf(report.datasets.header), row: imagesOf(report.datasets.detail) }
  const byPath = new Map(sites.map((site) => [site.path, site]))
  const siteOf = (index: number): ExpressionSite => byPath.get(`/aggregates/${index}/of/expression/cel`) as ExpressionSite
  const reads = aggregateReads(report)
  const { order, unordered } = aggregateOrder(report, reads)
  const cyclic = new Set(unordered)
  const known = new Map<string, ExpressionMember>()
  const invoiced = report.eInvoice !== undefined
  // What is compiled before the e-invoice's totals are known -- an
  // aggregate's expression, the paid amount -- cannot read them, and finds
  // them empty.
  const base = { params: parametersOf(report), header: fieldsOf(report.datasets.header), row: fieldsOf(report.datasets.detail), ...invoiceMembers(undefined, undefined) }
  const outcomes = new Map<string, SiteOutcome>()

  /** What `aggregate` computes, its expression compiled against the totals before it; and why it cannot be computed, when it cannot. */
  const computed = (aggregate: AggregateDef, index: number): ExpressionMember => {
    if (aggregate.of?.kind !== 'expression') {
      const read = aggregate.of?.field.field
      return COMPUTES[aggregate.fn](readAs(report.datasets.detail?.fields.find(({ id }) => id === read)?.type))
    }
    const site = siteOf(index)
    const outcome = compileSite(site, { ...base, totals: known, group: known }, images, invoiced)
    outcomes.set(site.path, outcome)
    if (!outcome.ok) return COMPUTES[aggregate.fn](undefined)
    const result = outcome.compiled.program.resultType
    const takes = TOTALS[aggregate.fn]
    if (takes === 'any' || takes.has(result)) return COMPUTES[aggregate.fn](SCALARS.has(result) ? (result as DeclaredType) : undefined)
    const said = `aggregate ${quote(aggregate.id)} is a ${aggregate.fn} of what its expression gives, ${result}, and a ${aggregate.fn} takes ${[...takes].filter((type) => type !== 'dyn').join(', ')}`
    outcomes.set(site.path, { ok: false, diagnostics: [diagnostic('expression-aggregate-type', said, { path: site.path })] })
    return COMPUTES[aggregate.fn](undefined)
  }
  for (const id of order) {
    const index = report.aggregates.findIndex((aggregate) => aggregate.id === id)
    known.set(id, computed(report.aggregates[index] as AggregateDef, index))
  }
  // An aggregate that can never be computed has no value anyone could check
  // a read of; it is read as a value that may be anything, so that only the
  // circle is reported, once, where it closes.
  for (const id of unordered) known.set(id, { type: 'dyn', nullable: true })
  const totals = new Map(report.aggregates.map(({ id }) => [id, known.get(id) as ExpressionMember]))
  // A group holds its aggregates and its key; report-spec keeps the key's name from every aggregate.
  const key = groupKeyOf(report)
  const group = key === undefined ? totals : new Map([...totals, key])
  // The paid amount reads none of the e-invoice's totals, and invoice.paid
  // is what it gives: it is compiled before the members that hold it, as
  // an aggregate's expression is, and that compilation is the one kept.
  const paid = byPath.get(PAID)
  const paidOutcome = paid === undefined ? undefined : compileSite(paid, { ...base, totals, group }, images, invoiced)
  if (paidOutcome !== undefined) outcomes.set(PAID, paidOutcome)
  const members: Members = { ...base, totals, group, ...invoiceMembers(report.eInvoice, paidOutcome === undefined ? undefined : paidMember(paidOutcome)) }

  const expressions = new Map<string, CompiledExpression>()
  const diagnostics: Diagnostic[] = []
  for (const site of sites) {
    const outcome = outcomes.get(site.path) ?? compileSite(site, members, images, invoiced)
    const aggregate = site.path.startsWith('/aggregates/') ? report.aggregates[Number(site.path.split('/')[2])]?.id : undefined
    if (aggregate !== undefined && cyclic.has(aggregate)) diagnostics.push(cycleDiagnostic(aggregate, site, reads, cyclic))
    else if (outcome.ok) expressions.set(site.path, outcome.compiled)
    if (!outcome.ok) diagnostics.push(...outcome.diagnostics)
  }
  return { members, expressions, aggregateOrder: order, diagnostics }
}
