/**
 * The order aggregates are computed in, and those that never can be.
 *
 * What an aggregate's expression reads from each row is read in the row
 * scope, which binds `totals`, so a share of the whole is
 * `divide(row.amount * dec("100"), totals.subtotal, 2)`. Such an aggregate
 * needs the totals it reads computed first, over every row: the runtime
 * computes aggregates in an order where each comes after every aggregate it
 * reads. One that reads itself -- directly, or through others -- has no
 * place in any order, and neither has one that reads such an aggregate.
 */
import { parse, referencedPaths } from '@formancy/expressions'
import type { ReportDefinition } from '@formancy/report-spec'
import { diagnostic } from '../diagnostics/codes.js'
import type { Diagnostic } from '../diagnostics/codes.js'
import type { ExpressionSite } from '../diagnostics/parts.js'
import { quote } from '../outcome.js'
import { pathParts } from './compile-site.js'
import { readSpans } from './spans.js'

/** For each aggregate -- every one has an entry -- the declared aggregates its expression reads as totals, once each, in the order first read. */
export function aggregateReads(report: ReportDefinition): ReadonlyMap<string, readonly string[]> {
  const declared = new Set(report.aggregates.map(({ id }) => id))
  return new Map(
    report.aggregates.map((aggregate) => {
      const parsed = aggregate.of?.kind === 'expression' ? parse(aggregate.of.expression.cel) : undefined
      if (parsed?.ok !== true) return [aggregate.id, []]
      const reads = referencedPaths(parsed.ast)
        .map(pathParts)
        .flatMap(({ name, member }) => (name === 'totals' && member !== undefined && declared.has(member) ? [member] : []))
      return [aggregate.id, [...new Set(reads)]]
    }),
  )
}

/** What the aggregate `id` reads; `aggregateReads` gives every aggregate an entry. */
function readsOf(reads: ReadonlyMap<string, readonly string[]>, id: string): readonly string[] {
  return reads.get(id) as readonly string[]
}

/**
 * The aggregates in an order where each comes after every aggregate it
 * reads, and otherwise the earliest declared first; and, in declaration
 * order, those that have no place in it.
 */
export function aggregateOrder(
  report: ReportDefinition,
  reads: ReadonlyMap<string, readonly string[]>,
): { readonly order: readonly string[]; readonly unordered: readonly string[] } {
  const placed = new Set<string>()
  const ready = (id: string): boolean => !placed.has(id) && readsOf(reads, id).every((read) => placed.has(read))
  for (let next = report.aggregates.find(({ id }) => ready(id)); next !== undefined; next = report.aggregates.find(({ id }) => ready(id))) placed.add(next.id)
  return { order: [...placed], unordered: report.aggregates.map(({ id }) => id).filter((id) => !placed.has(id)) }
}

/** Whether `from` reaches `to` by what the aggregates read, among `among`. */
function reaches(from: string, to: string, reads: ReadonlyMap<string, readonly string[]>, among: ReadonlySet<string>): boolean {
  const seen = new Set<string>()
  const visit = (id: string): boolean =>
    readsOf(reads, id).some((read) => {
      if (read === to) return true
      if (seen.has(read) || !among.has(read)) return false
      seen.add(read)
      return visit(read)
    })
  return visit(from)
}

/**
 * The diagnostic for the aggregate `id`, which has no place in the order:
 * at the first total it reads that has none either, saying whether that
 * read closes a circle back to it or reaches one.
 */
export function cycleDiagnostic(id: string, site: ExpressionSite, reads: ReadonlyMap<string, readonly string[]>, unordered: ReadonlySet<string>): Diagnostic {
  const blocker = readsOf(reads, id).find((read) => unordered.has(read)) as string
  const [position] = readSpans(site.cel, `totals.${blocker}`)
  const message = reaches(id, id, reads, unordered)
    ? `aggregate ${quote(id)} reads its own total${blocker === id ? '' : `, through ${quote(blocker)}`}, so it would have to be computed before itself and never can be`
    : `aggregate ${quote(id)} reads ${quote(blocker)}, which reads its own total, so neither can be computed`
  return diagnostic('aggregate-cycle', message, { path: site.path, position })
}
