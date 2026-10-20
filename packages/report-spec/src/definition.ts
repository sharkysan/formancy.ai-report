/**
 * The report definition, version 0: what a Formancy Report template is.
 *
 * A report is its own document, with its own version line
 * ([0007](../../../docs/decisions/0007-a-report-definition-is-its-own-versioned-document.md)).
 * Lengths are PDF points (1/72 inch), stored to the hundredth. Nothing here
 * holds customer data, credentials, asset bytes or rendered output: a
 * template names a dataset contract, an asset digest and a parameter, and
 * the deployment supplies what each resolves to.
 *
 * Four conventions hold throughout, so that one editor command, one binding
 * picker and one walk serve every part of the format:
 * - every shape that comes in kinds says which with `kind`;
 * - every declaration is a list of objects with an `id`, unique in its list;
 * - every reference to a dataset field is a `FieldRef`;
 * - a name an expression reads -- a field, a parameter, an aggregate -- is a
 *   field key, as formancy's form spec writes one (`isFieldKey`); every other
 *   id is an identifier (`isIdentifier`).
 *
 * The vocabularies are `const` lists, and each union type is derived from
 * its list, so the type and the validator's list cannot disagree.
 *
 * This module holds the definition, its regions and its provenance. Each
 * part it declares stands in a module of its own, named for what it
 * holds: the page (`page.ts`), print styles (`styles.ts`), the data it
 * reads (`data.ts`), assets (`assets.ts`), values (`values.ts`),
 * aggregates (`aggregates.ts`), components (`components.ts`) and the
 * table (`table.ts`).
 */
import type { AggregateDef } from './aggregates.js'
import type { AssetRef } from './assets.js'
import type { Component } from './components.js'
import type { Datasets, ParameterDef } from './data.js'
import type { EInvoice } from './e-invoice.js'
import type { PageSettings } from './page.js'
import type { PaymentPart } from './payment-part.js'
import type { PrintStyle } from './styles.js'
import type { REPORT_SPEC_VERSION } from './version.js'

/**
 * The report's regions, in the order a reader meets them. The body is flow
 * only in version 0: ordered blocks, so a growing table pushes what follows
 * down. Positioned elements in the page regions are deferred.
 */
export const REGION_NAMES = ['reportHeader', 'pageHeader', 'body', 'pageFooter', 'summary'] as const
export type RegionName = (typeof REGION_NAMES)[number]

export type Regions = { readonly [R in RegionName]: readonly Component[] }

export const PROVENANCE_KINDS = ['blank', 'form', 'dataset'] as const
export type ProvenanceKind = (typeof PROVENANCE_KINDS)[number]

/**
 * Where a report was started from, so a reviewer can find the exact form
 * version or the dataset a generated report came from.
 */
export type Provenance =
  | { readonly kind: 'blank' }
  | {
      readonly kind: 'form'
      /** The form's id, as formancy writes one. */
      readonly form: string
      /** `schemaHash` of the exact form version: 64 lower-case hex digits. */
      readonly formHash: string
    }
  | { readonly kind: 'dataset'; /** The dataset's id in the deployment's catalogue. */ readonly dataset: string }

export interface ReportDefinition {
  readonly reportSpecVersion: typeof REPORT_SPEC_VERSION
  readonly id: string
  readonly title: string
  /** A BCP 47 tag: language, optional script, optional region. */
  readonly locale: string
  readonly page: PageSettings
  readonly styles: readonly PrintStyle[]
  readonly datasets: Datasets
  readonly parameters: readonly ParameterDef[]
  readonly assets: readonly AssetRef[]
  readonly aggregates: readonly AggregateDef[]
  readonly regions: Regions
  /** A slip to pay the report by, printed at the foot of its last page: a Swiss QR-bill. Absent, the report has none. */
  readonly paymentPart?: PaymentPart
  /** The EN 16931 invoice the report is, written as Factur-X from what its page prints. Absent, the report is none. */
  readonly eInvoice?: EInvoice
  readonly provenance?: Provenance
}
