/**
 * The reports the Studio opens: the corpus's starters, plan 7's three
 * (R19), the invoice with its QR-bill, the invoice with its EPC QR code and
 * the e-invoice (0044) and the site visit generated from a formancy form
 * (0045), each with its synthetic data, and a blank report to build from
 * nothing.
 */
import { emptyReport } from '@formancy/report-spec'
import type { StudioStarter } from './codec.js'

/** An empty A4 page, nothing declared: what Blank opens, with the data envelope of a report that reads none. */
export const BLANK: StudioStarter = {
  id: 'blank',
  title: 'Blank report',
  proves: 'nothing yet: an empty page to build on',
  report: emptyReport('blank', 'Blank report', 'en-GB'),
  data: { completeness: { complete: true, captured: 0 }, consistency: 'host-captured' },
  parameters: {},
}

/** The corpus's starters, in its order, then Blank. */
export function studioStarters(corpus: readonly StudioStarter[]): readonly StudioStarter[] {
  return [...corpus, BLANK]
}

/**
 * What the picker calls a starter, from its id: 'grouped-equipment' is
 * "Grouped equipment", and a letter standing alone keeps its hyphen, as
 * English writes it: 'e-invoice' is "E-invoice".
 */
export function starterLabel(starter: Pick<StudioStarter, 'id'>): string {
  const words = starter.id
    .split('-')
    .reduce<string[]>((joined, part) => {
      const last = joined.at(-1)
      return last?.length === 1 ? [...joined.slice(0, -1), `${last}-${part}`] : [...joined, part]
    }, [])
    .join(' ')
  return `${words.charAt(0).toUpperCase()}${words.slice(1)}`
}
