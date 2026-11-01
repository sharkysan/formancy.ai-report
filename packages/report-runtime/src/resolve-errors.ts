/**
 * Why a report did not resolve, as one list a caller reads whatever stage
 * found the problem: the report itself, its expressions, the parameters, the
 * data, the options, an evaluation, a format, an image or a total.
 *
 * Each stage keeps the codes it already has -- report-spec's for structure,
 * report-core's diagnostics for expressions, the data check's for data and
 * parameters, the evaluator's and the formatter's -- so a code means one
 * thing wherever it appears. `stage` says which list a code is from. Like
 * every error the runtime gives, none holds a value from the data.
 */
import type { Diagnostic, DiagnosticCode } from '@formancy/report-core'
import type { ReportError, ReportErrorCode } from '@formancy/report-spec'
import type { DataError, DataErrorCode } from './data-errors.js'
import { MAX_DATA_ERRORS } from './data-errors.js'
import type { EvaluationError, EvaluationErrorCode } from './evaluate.js'
import type { FormatErrorCode } from './format.js'

/** What lowering a report can find wrong besides what each earlier stage finds. */
export const RESOLVE_ERROR_CODES = [
  /** A creation date that is not an ISO 8601 instant with its zone. */
  'invalid-creation-date',
  /** An image whose bytes the host does not have, or a report with images and no way to fetch them. */
  'missing-asset',
  /** Bytes for an image that are not a `Uint8Array`, or of another media type than the asset declares or a report may draw. */
  'invalid-asset',
  /** The host's image lookup threw. */
  'asset-lookup-failed',
  /** A declared rounding on a total that is not a decimal: an integer, a date or an instant has no places to round. */
  'rounding-not-decimal',
  /** A total over values that cannot be totalled together: a sum of text, a minimum of a number and a date. */
  'aggregate-value-type',
  /** In a final render, a run of a QR code's content, or of a QR-bill's or an EPC QR code's text, whose value is null: the code would scan as less than its content, and nothing on the page would say so. */
  'no-qr-value',
  /** In a final render, a QR code whose content prints nothing: a symbol of no data, which a scanner reads as no code. */
  'empty-qr-code',
  /**
   * A QR-bill a rule of SIX's breaks once its data has resolved it: an
   * account, a reference, an address part, a message or an amount. The
   * code report-spec gives a literal that breaks it, from the same rules.
   */
  'invalid-qr-bill',
  /**
   * An EPC QR code a rule of the EPC's breaks once its data has resolved
   * it: an IBAN, a BIC, a name, a reference, a text, an amount, or a
   * payload past its bytes. The code report-spec gives a literal that
   * breaks it, from the same rules.
   */
  'invalid-epc-qr-code',
  /**
   * An e-invoice a rule of EN 16931's breaks once its data has resolved it
   * -- a text, a date, a line's term, a row with none -- or a payment code
   * that asks for another amount or account than it names. The code
   * report-spec gives a literal that breaks it, from the same rules.
   */
  'invalid-e-invoice',
  /** A warning, never an error: a preview of an e-invoice, which writes no XML and is not the invoice. */
  'e-invoice-preview',
  /** A chart, which this release of the runtime does not yet resolve: lowered to nothing, the report would print without it. */
  'chart-not-resolved',
  /** More errors were found than are listed. */
  'too-many-errors',
] as const
export type ResolveErrorCode = (typeof RESOLVE_ERROR_CODES)[number]

/** Where in the report an error is, when it is in a component, a table column or a row. */
interface Place {
  readonly componentId?: string
  readonly columnId?: string
  /** The detail row's index in the data as the provider gave it. */
  readonly row?: number
}

/** One error, from the stage that found it, with that stage's code. Its path is a JSON Pointer into what the stage read: the report, the data, the parameters, or '' for the options. */
export type RuntimeError =
  | ({ readonly stage: 'report'; readonly code: ReportErrorCode; readonly path: string; readonly message: string } & Place)
  | ({ readonly stage: 'expressions'; readonly code: DiagnosticCode; readonly path: string; readonly message: string } & Place)
  | { readonly stage: 'parameters' | 'data'; readonly code: DataErrorCode; readonly path: string; readonly message: string }
  | ({
      readonly stage: 'evaluation'
      readonly code: EvaluationErrorCode
      readonly path: string
      readonly message: string
      readonly aggregateId?: string
    } & Place)
  | ({ readonly stage: 'format'; readonly code: FormatErrorCode; readonly path: string; readonly message: string } & Place)
  | ({ readonly stage: 'resolve'; readonly code: ResolveErrorCode; readonly path: string; readonly message: string } & Place)

export type RuntimeStage = RuntimeError['stage']

/** The optional parts of a place, written only when present, as exactOptionalPropertyTypes asks. */
export function placed(place: { readonly componentId?: string | undefined; readonly columnId?: string | undefined; readonly row?: number | undefined }): Place {
  return {
    ...(place.componentId === undefined ? {} : { componentId: place.componentId }),
    ...(place.columnId === undefined ? {} : { columnId: place.columnId }),
    ...(place.row === undefined ? {} : { row: place.row }),
  }
}

/** A type as a message says what a value is: "a decimal", "an integer". */
export function aType(type: string): string {
  return `${/^[aeiou]/.test(type) ? 'an' : 'a'} ${type}`
}

export function fromReport(error: ReportError): RuntimeError {
  return { stage: 'report', code: error.code, path: error.path, message: error.message, ...placed(error) }
}

export function fromDiagnostic(diagnostic: Diagnostic): RuntimeError {
  return { stage: 'expressions', code: diagnostic.code, path: diagnostic.path, message: diagnostic.message, ...placed(diagnostic) }
}

export function fromData(stage: 'parameters' | 'data', error: DataError): RuntimeError {
  return { stage, code: error.code, path: error.path, message: error.message }
}

export function fromEvaluation(error: EvaluationError): RuntimeError {
  return {
    stage: 'evaluation',
    code: error.code,
    path: error.path,
    message: error.message,
    ...placed(error),
    ...(error.aggregateId === undefined ? {} : { aggregateId: error.aggregateId }),
  }
}

/**
 * The errors and warnings one resolution collects. Errors are bounded as the
 * data check bounds its own: past `MAX_DATA_ERRORS`, one `too-many-errors`
 * says the list was cut short, and `full` tells a long loop to stop. A
 * warning is said once per path: a preview that lacks a field a thousand
 * rows read warns once for it.
 */
export class Problems {
  readonly #errors: RuntimeError[] = []
  readonly #warnings = new Map<string, RuntimeError>()
  #overflowed = false

  error(error: RuntimeError): void {
    if (this.#errors.length < MAX_DATA_ERRORS) this.#errors.push(error)
    else this.#overflowed = true
  }

  warn(warning: RuntimeError): void {
    const key = `${warning.stage} ${warning.code} ${warning.path}`
    if (!this.#warnings.has(key)) this.#warnings.set(key, warning)
  }

  /** Whether the error list is cut short: nothing more is worth computing. */
  get full(): boolean {
    return this.#overflowed
  }

  get failed(): boolean {
    return this.#errors.length > 0
  }

  errors(): RuntimeError[] {
    const errors = [...this.#errors]
    if (this.#overflowed)
      errors.push({
        stage: 'resolve',
        code: 'too-many-errors',
        path: '',
        message: `more than ${MAX_DATA_ERRORS} errors were found; the first ${MAX_DATA_ERRORS} are listed`,
      })
    return errors
  }

  warnings(): RuntimeError[] {
    return [...this.#warnings.values()]
  }
}
