/**
 * A form version walked into the outline of a report generated from it
 * (0045), in model order: the version's own order of its fields, which a
 * submission is collected in and formancy renders by default. A layout the
 * version names is an arrangement for filling it in, and is not followed.
 *
 * - A field that holds an answer is a line of its label and its value; a
 *   matrix and ticked boxes a section of a line a row or an option.
 * - A group is a section headed by its label, its own fields in it, as
 *   deep as the format nests containers; deeper, its heading and its lines
 *   stand in the section around it, said.
 * - A page is looked through: it is a step of filling the form in, not a
 *   page of the report (plan 12.2).
 * - The repeater asked for is the table, where it stands, a column for
 *   each field of its rows, in the order a grid gives them where it is one
 *   (formancy's `datagridColumns`'s order, in time linear in the grid);
 *   every other repeater is listed.
 * - One row per submission is a table of the submission's answers, a
 *   group's among them, and every repeater is listed.
 */
import { MAX_NESTING_DEPTH, MAX_TEXT_LENGTH } from '@formancy/report-spec'
import type { DataGridColumn, FieldDef, Text } from '@formancy/spec'
import { at, named } from './errors.js'
import { leaf, note, onPage, within } from './generate-fields.js'
import type { Draft, Place, Planned } from './generate-fields.js'
import { labelOf, printable } from './generate-labels.js'
import type { Label } from './generate-labels.js'
import type { NoteCode } from './notes.js'

/** A part of the report's body, before it is laid out. */
export type Block =
  | { readonly kind: 'line'; readonly planned: Planned }
  | {
      readonly kind: 'section'
      readonly heading: string
      readonly blocks: readonly Block[]
      /** Deeper than the format nests sections: its heading and its blocks stand in the section around it. */
      readonly flat: boolean
    }
  | {
      readonly kind: 'table'
      /** The repeater's label over it; none over one row per submission, which the title heads. */
      readonly heading: string | undefined
    }

/** What the walk found: the body's blocks, each dataset's fields, and where the fields the table's columns read stand in the form. */
export interface Outline {
  readonly blocks: readonly Block[]
  readonly header: readonly Planned[]
  readonly detail: readonly Planned[]
  /** The list of fields the columns read: the repeater's, or the form's own for one row per submission; none without a table. */
  readonly columnsAt: string | undefined
}

/** What the table reads: the rows of `repeater`, one row per submission, or nothing. */
export type DetailOf = { readonly kind: 'repeater'; readonly repeater: FieldDef } | { readonly kind: 'submissions' } | undefined

const TOP: Place = { keys: [], target: '', hideable: false }

/** A heading's label, or undefined after refusing one no font draws or longer than a text holds. */
function headingOf(draft: Draft, text: Text | undefined, key: string, path: string, where: string): Label | undefined {
  const label = labelOf(draft, text, key)
  if (!printable(draft, label.text, where, named(path))) return undefined
  if (label.text.length <= MAX_TEXT_LENGTH) return label
  draft.f.report(
    where,
    'label-too-long',
    `${named(path)} is labelled longer than the ${MAX_TEXT_LENGTH} characters a heading holds; it is refused, never cut short`,
  )
  return undefined
}

/** What is said of how the heading of `path`, a group or a repeater, was had: by its key where it has no label, in the default locale's words where the report's catalogue lacks it. */
function headingSaid(
  heading: Label,
  path: string,
  where: string,
  what: string,
): { readonly code: NoteCode; readonly path: string; readonly message: string }[] {
  if (heading.said === 'unlabelled')
    return [{ code: 'unlabelled', path: where, message: `${named(path)} has no label in the form version, so ${what} is headed by its key` }]
  if (heading.said === 'label-default-locale')
    return [
      {
        code: 'label-default-locale',
        path: where,
        message: `${named(path)} has no label in the form version's catalogue in the report's locale, so ${what} is headed in its default locale's`,
      },
    ]
  return []
}

/**
 * A grid's columns in formancy's order, as its `datagridColumns` gives
 * them -- the configured columns first, in their order, then every other
 * field of the rows in the model's -- each with its place in the rows'
 * list. Ordered here, in time linear in the grid: `datagridColumns` finds
 * each column's field by a scan, which a form of many columns turns
 * quadratic before any bound is checked (`generate-untrusted.test.ts`).
 * Held equal to it over grids of every shape (`generate-kinds.test.ts`).
 * formancy's validator holds that a column names a field of the rows, and
 * none twice.
 */
export function gridOrder(repeater: FieldDef): { readonly child: FieldDef; readonly index: number; readonly column?: DataGridColumn }[] {
  const children = repeater.fields ?? []
  const places = new Map(children.map((child, index) => [child.key, index]))
  const configured = (repeater.columns ?? []).flatMap((column) => {
    const index = places.get(column.field)
    return index === undefined ? [] : [{ child: children[index] as FieldDef, index, column }]
  })
  const named = new Set(configured.map(({ child }) => child.key))
  return [...configured, ...children.flatMap((child, index) => (named.has(child.key) ? [] : [{ child, index }]))]
}

/**
 * A group, a matrix or ticked boxes walked into a section of what `inner`
 * gives, or none where it gives nothing. What is said of it stands at
 * `mark`, before what is said of what it holds; that its heading is its
 * key is said here only for a group, a matrix's and ticked boxes' being
 * their field's label, which the field says.
 */
function section(
  draft: Draft,
  def: FieldDef,
  path: string,
  where: string,
  depth: number,
  mark: number,
  inner: (depth: number) => readonly Block[],
): Block | undefined {
  const flat = depth >= MAX_NESTING_DEPTH
  const blocks = inner(flat ? depth : depth + 1)
  if (blocks.length === 0) return undefined
  const heading = headingOf(draft, def.label, def.key, path, where)
  if (heading === undefined) return undefined
  const said = [
    ...(flat
      ? [
          {
            code: 'group-flattened' as const,
            path: where,
            message: `${named(path)} stands deeper than the ${MAX_NESTING_DEPTH} sections the format nests: its heading and its lines stand in the section around it`,
          },
        ]
      : []),
    ...(def.type === 'group' ? headingSaid(heading, path, where, 'it') : []),
  ]
  draft.notes.splice(mark, 0, ...said)
  return { kind: 'section', heading: heading.text, blocks, flat }
}

/** The fields of the rows of `repeater` as columns, in the order its grid gives them, under the headings it gives them. */
function columns(draft: Draft, repeater: FieldDef, place: Place, list: string, into: Planned[]): void {
  for (const { child, index, column } of gridOrder(repeater)) {
    // A grid's rows are flat (formancy.ai 0078), so a column with a heading is a field's.
    if (column?.header === undefined) flatten(draft, [child], place, list, into, [index])
    else into.push(...leaf(draft, child, place, at(list, index), 'detail', column.header))
  }
}

/**
 * `fields` as columns of the detail: a group's and a page's looked
 * through, a repeater's listed. `indices` are the fields' places in their
 * list, where they are not in order.
 */
function flatten(draft: Draft, fields: readonly FieldDef[], place: Place, list: string, into: Planned[], indices?: readonly number[]): void {
  for (const [position, def] of fields.entries()) {
    const where = at(list, indices?.[position] ?? position)
    if (def.type === 'page') flatten(draft, def.fields ?? [], onPage(draft, place, def), `${where}/fields`, into)
    else if (def.type === 'group') flatten(draft, def.fields ?? [], within(draft, place, def), `${where}/fields`, into)
    else if (def.type === 'repeater')
      note(
        draft,
        'repeater-excluded',
        where,
        `${named(`${place.target}${def.key}`)} is left out: a report has one detail table, and its rows are one per submission`,
      )
    else into.push(...leaf(draft, def, place, where, 'detail'))
  }
}

/** The body's blocks of `fields`, in model order, each field's declared into `header`, the table's rows' into `detail`. */
function blocksOf(
  draft: Draft,
  fields: readonly FieldDef[],
  place: Place,
  list: string,
  depth: number,
  outline: { header: Planned[]; detail: Planned[]; columnsAt: string | undefined },
  detail: DetailOf,
): Block[] {
  const blocks: Block[] = []
  for (const [index, def] of fields.entries()) {
    const where = at(list, index)
    const path = `${place.target}${def.key}`
    if (def.type === 'page') {
      blocks.push(...blocksOf(draft, def.fields ?? [], onPage(draft, place, def), `${where}/fields`, depth, outline, detail))
    } else if (def.type === 'group') {
      const inner = within(draft, place, def)
      const block = section(draft, def, path, where, depth, draft.notes.length, (nested) =>
        blocksOf(draft, def.fields ?? [], inner, `${where}/fields`, nested, outline, detail),
      )
      if (block !== undefined) blocks.push(block)
    } else if (def.type === 'repeater') {
      if (detail?.kind !== 'repeater' || detail.repeater !== def) {
        note(
          draft,
          'repeater-excluded',
          where,
          `${named(path)} is left out: a report has one detail table, and ${detail?.kind === 'repeater' ? 'another repeater is its rows' : 'none was asked for'}`,
        )
        continue
      }
      const heading = headingOf(draft, def.label, def.key, path, where)
      if (heading !== undefined) draft.notes.push(...headingSaid(heading, path, where, 'its table'))
      const rows: Place = { keys: [], target: `${path}[].`, hideable: place.hideable || draft.hidden.has(path) }
      columns(draft, def, rows, `${where}/fields`, outline.detail)
      outline.columnsAt = `${where}/fields`
      if (heading !== undefined) blocks.push({ kind: 'table', heading: heading.text })
    } else if (def.type === 'matrix' || def.type === 'selectboxes') {
      const mark = draft.notes.length
      const planned = leaf(draft, def, place, where, 'header')
      outline.header.push(...planned)
      const block = section(draft, def, path, where, depth, mark, () => planned.map((each): Block => ({ kind: 'line', planned: each })))
      if (block !== undefined) blocks.push(block)
    } else {
      const planned = leaf(draft, def, place, where, 'header')
      outline.header.push(...planned)
      blocks.push(...planned.map((each): Block => ({ kind: 'line', planned: each })))
    }
  }
  return blocks
}

/** `draft`'s version walked into the report's outline, as `detail` asks. */
export function outlineOf(draft: Draft, detail: DetailOf): Outline {
  const fields = draft.version.schema.model.fields
  if (detail?.kind === 'submissions') {
    const columns: Planned[] = []
    flatten(draft, fields, TOP, '/form/model/fields', columns)
    return { blocks: [{ kind: 'table', heading: undefined }], header: [], detail: columns, columnsAt: '/form/model/fields' }
  }
  const outline = { header: [] as Planned[], detail: [] as Planned[], columnsAt: undefined as string | undefined }
  const blocks = blocksOf(draft, fields, TOP, '/form/model/fields', 0, outline, detail)
  return { blocks, ...outline }
}
