import { schemaHash } from '@formancy/spec'
import { describe, expect, test } from 'vitest'
import type { ReportDefinition } from './definition.js'
import { reportHash } from './hash.js'
import { eInvoiceReport, richReport } from './test-support.js'
import { REPORT_FORMAT } from './version.js'

/**
 * A fixed report whose canonical JSON holds what canonicalisation could
 * change: non-ASCII text, booleans, numbers with decimals, and arrays of
 * objects with keys out of order. Its hash below was computed with
 * `@formancy/spec`'s `schemaHash` over the envelope, outside this package,
 * on 15 October 2026.
 */
const PINNED: ReportDefinition = {
  reportSpecVersion: '0',
  title: 'Prüfbericht Zürich',
  id: 'pinned',
  locale: 'de-CH',
  page: { size: 'A4', orientation: 'portrait', margins: { top: 56.69, right: 42.52, bottom: 56.69, left: 42.52 } },
  styles: [{ id: 'strong', bold: true, italic: false, size: 10.5 }],
  datasets: { header: { id: 'visit', fields: [{ id: 'site', type: 'string', label: 'Standort', nullable: false }] } },
  parameters: [{ id: 'draft', type: 'boolean', label: 'Entwurf', required: false, default: false }],
  assets: [],
  aggregates: [],
  regions: {
    reportHeader: [
      {
        id: 'title',
        kind: 'text',
        style: 'strong',
        content: [
          { kind: 'text', text: 'Grüße aus Zürich' },
          { kind: 'field', field: { dataset: 'header', field: 'site' } },
        ],
      },
    ],
    pageHeader: [],
    body: [{ id: 'gap', kind: 'spacer', height: 12.5 }],
    pageFooter: [{ id: 'page', kind: 'text', content: [{ kind: 'pageNumber' }] }],
    summary: [],
  },
  provenance: { kind: 'blank' },
}

/** The same JSON with every object's keys in reverse order. */
function reversed(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(reversed)
  if (typeof value !== 'object' || value === null) return value
  return Object.fromEntries(
    Object.entries(value)
      .reverse()
      .map(([key, child]) => [key, reversed(child)]),
  )
}

describe('reportHash', () => {
  // The hash names a published template version; a stored hash that a later
  // release computed differently would make every published report look
  // tampered with. Pinned on a fixed report computed outside this package,
  // so a change to the envelope, or to upstream's handling of non-ASCII
  // text, booleans, numbers or arrays, fails here first.
  test('is pinned for a fixed report', () => {
    expect(reportHash(PINNED)).toBe('4d32728c7eab9c50d3699e791ed63135201575d05268f3236b7f38c9b155bf46')
  })

  // Two editors that write the same report with keys in a different order
  // have written the same report.
  test('does not depend on the order of keys', () => {
    const report = richReport()
    expect(reportHash(reversed(report) as ReportDefinition)).toBe(reportHash(report))
    expect(JSON.stringify(reversed(report))).not.toBe(JSON.stringify(report))
  })

  // An e-invoice is part of the template a hash names, and its keys are
  // canonicalised as every object's: a rate edited from 7.00 to 7 is
  // another template, written another way, and keys in another order are
  // the same one.
  test("names a report's e-invoice, whatever the order of its keys", () => {
    const report = eInvoiceReport()
    const { eInvoice, ...without } = report
    expect(reportHash(reversed(report) as ReportDefinition)).toBe(reportHash(report))
    expect(reportHash(without)).not.toBe(reportHash(report))
    expect(eInvoice?.vat[1]?.rate).toBe('7.00')
    const rate = JSON.parse(JSON.stringify(report).replace('"rate":"7.00"', '"rate":"7"')) as ReportDefinition
    expect(reportHash(rate)).not.toBe(reportHash(report))
  })

  // The font a token prints in is part of the template a hash names: a
  // firm that swaps its typeface publishes a new version, and "the same
  // report renders the same PDF" survives (0043). A report without the map,
  // and one that maps a token to another face, each hash their own way;
  // keys in another order are the same one.
  test("names a report's font map, whatever the order of its keys", () => {
    const report = richReport()
    const { fonts, ...without } = report
    expect(fonts).toBeDefined()
    expect(reportHash(reversed(report) as ReportDefinition)).toBe(reportHash(report))
    expect(reportHash(without)).not.toBe(reportHash(report))
    const other: ReportDefinition = { ...report, fonts: { sans: { normal: 'brand-bold', bold: 'brand-bold' } } }
    expect(reportHash(other)).not.toBe(reportHash(report))
  })

  // A hash that missed a one-character edit would let a changed template
  // pass as the published one.
  test('changes with a one-character change', () => {
    const report = richReport()
    expect(reportHash({ ...report, title: 'Orders by sitE' })).not.toBe(reportHash(report))
  })

  // The envelope names the format, so a formancy form and a report whose
  // JSON bodies are equal never share a hash.
  test('is taken over the format envelope, not over the bare body', () => {
    const report = richReport()
    expect(reportHash(report)).not.toBe(schemaHash(report))
    expect(reportHash(report)).toBe(schemaHash({ format: REPORT_FORMAT, reportSpecVersion: '0', report }))
  })

  // A hash names a valid template. A report the validator refuses -- here
  // one with two detail tables, which its type cannot tell from one -- is
  // refused rather than given a hash that something might later publish.
  test('refuses to hash a report the validator refuses, naming why', () => {
    const report = richReport()
    const table = report.regions.body[2]
    if (table?.kind !== 'table') throw new Error('the fixture has its table third in the body')
    const twoTables: ReportDefinition = { ...report, regions: { ...report.regions, summary: [...report.regions.summary, { ...table, id: 'again' }] } }
    expect(() => reportHash(twoTables)).toThrow(RangeError)
    expect(() => reportHash(twoTables)).toThrow(/second-detail-table \/regions\/summary\/4/)
  })

  // Upstream's canonicalisation builds each object by assignment, so an own
  // "__proto__" key sets a prototype instead of adding a key, and two
  // different documents would share one hash. Such a document is never
  // hashed: the validator refuses the key first.
  test('never hashes a document with an own __proto__ key', () => {
    const polluted = JSON.parse(JSON.stringify(richReport()).replace('"styles":[{', '"styles":[{"__proto__":{"bold":true},')) as ReportDefinition
    expect(Object.keys(polluted.styles[0] ?? {})).toContain('__proto__')
    expect(() => reportHash(polluted)).toThrow(/unknown-property \/styles\/0\/__proto__/)
  })
})
