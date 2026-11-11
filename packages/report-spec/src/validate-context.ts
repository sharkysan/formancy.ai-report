/**
 * What one validation knows while it reads a report: what the report
 * declares, which component ids it has seen, where its detail table is and
 * how much of the page its margins leave.
 */
import type { AnyAssetMediaType } from './assets.js'
import { Findings, quote } from './check.js'
import type { FieldType, ParameterType } from './data.js'
import type { ReportErrorCode } from './errors.js'
import type { PageDimensions } from './page.js'

/**
 * Declared names and what each declares. `undefined` when the declarations
 * could not all be read: that was reported where they are, and a reference
 * that matches none of the rest could be the one that was unreadable, so
 * references into them are not reported again, one by one, as unknown.
 */
export type Declarations<T> = ReadonlyMap<string, T> | undefined

export interface Declared {
  styles: Declarations<true>
  /** By role; a role's fields are `undefined` when its contract could not be read. A field's type is `undefined` when its contract could not. */
  datasets: Declarations<Declarations<FieldType | undefined>>
  parameters: Declarations<ParameterType | undefined>
  /** Each asset's media type, so a reference can be held to being an image or a font (0043); `undefined` where the type could not be read. */
  assets: Declarations<AnyAssetMediaType | undefined>
  /** What each aggregate computes, when that is known: what an expression computes is not. */
  aggregates: Declarations<FieldType | undefined>
  /** The fields each dataset role declares that may be null, when its contract could be read; a chart asks the label its null rows print under. */
  nullable: Map<string, ReadonlySet<string>>
}

export interface Ctx {
  readonly f: Findings
  readonly declared: Declared
  /** Component ids seen so far, and the path of the first component with each. */
  readonly componentIds: Map<string, string>
  /** Where the table over the detail dataset is, once one has been read. */
  detailTable: string | undefined
  /** What the margins leave of the page, once they are known to leave enough; fixed sizes are measured against it. */
  printable: PageDimensions | undefined
}

export function newContext(): Ctx {
  return {
    f: new Findings(),
    declared: { styles: undefined, datasets: undefined, parameters: undefined, assets: undefined, aggregates: undefined, nullable: new Map() },
    componentIds: new Map(),
    detailTable: undefined,
    printable: undefined,
  }
}

/** What `name` declares, after reporting `code` when it is not declared. Nothing is checked when either is unknown. */
export function resolve<T>(f: Findings, names: Declarations<T>, name: string | undefined, path: string, code: ReportErrorCode, what: string): T | undefined {
  if (names === undefined || name === undefined) return undefined
  if (names.has(name)) return names.get(name)
  f.report(path, code, `${quote(name)} is not a ${what} this report declares`)
  return undefined
}

/** One entry of a list of declarations: its id when it could be read, where the id is, and what it declares. */
export interface Declaration<T> {
  readonly id: string | undefined
  readonly path: string
  readonly value: T
}

/**
 * The names a list declares, each id after the first reported as a
 * duplicate, with `code` and what `again` says of it. `undefined` when an id
 * could not be read.
 *
 * One rule for every list whose entries are named -- declarations, a
 * table's columns, a footer row's cells, the keys that order a table -- so
 * that a second entry with one name is refused the same way everywhere.
 */
export function declare<T>(f: Findings, entries: readonly Declaration<T>[], code: ReportErrorCode, again: (id: string) => string): Map<string, T> | undefined {
  const declared = new Map<string, T>()
  let complete = true
  for (const { id, path, value } of entries) {
    if (id === undefined) complete = false
    else if (declared.has(id)) f.report(path, code, again(quote(id)))
    else declared.set(id, value)
  }
  return complete ? declared : undefined
}

/**
 * Reports a fixed length the page cannot hold. The page and its margins are
 * in the same document, so a size that can never fit is refused while the
 * author edits; what fits inside a container is the layout's question.
 */
export function withinPage(c: Ctx, length: number | undefined, path: string, side: 'width' | 'height', what: string): void {
  const room = c.printable?.[side]
  if (length === undefined || room === undefined || length <= room) return
  c.f.report(path, 'exceeds-printable-area', `${length} points of ${side} for ${what}, and the margins leave ${room}`)
}
