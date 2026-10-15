import type { ReportData, ReportDefinition } from '@formancy/report-runtime'

/**
 * A starter (plan 7, R19): a report definition an author begins from, and
 * synthetic data it renders. Each proves something different about the
 * pipeline from definition to PDF, and the end-to-end tests in
 * `@formancy/report-render-pdf` hold each to the PDF it produces.
 */
export interface Starter {
  readonly id: string
  readonly title: string
  /** What the starter exercises that the others do not. */
  readonly proves: string
  readonly report: ReportDefinition
  /** Synthetic data: no customer's, and no value a reader could mistake for one. */
  readonly data: ReportData
  /** The values a person would supply on the parameter form. */
  readonly parameters: Readonly<Record<string, unknown>>
}

/**
 * An approved asset a starter's data names, with the bytes a host would
 * hold for it: its digest is the SHA-256 of exactly these bytes.
 */
export interface StarterImage {
  readonly asset: string
  readonly digest: string
  readonly mediaType: 'image/png'
  readonly bytes: Uint8Array
}
