/**
 * The properties pane: what it edits for a selection, the fields it shows,
 * and the command a changed field becomes.
 *
 * A change is a typed command through report-core -- `updateComponent`,
 * `updateColumn`, `setTitle`, `setLocale`, `setPage` -- so a property edit
 * is validated, undone and refused like any other edit, and a refused one
 * shows the validator's own message on the field it came from.
 */
import { setLocale, setPage, setTitle, updateColumn, updateComponent } from '@formancy/report-core'
import type { Command, ComponentPatch, Diagnostic, PagePatch, Refusal } from '@formancy/report-core'
import { printableArea, ptToMm } from '@formancy/report-spec'
import type { ReportDefinition } from '@formancy/report-spec'
import { columnKey, kindLabel } from './labels.js'
import type { PropertyField, PropertyPanel, Selection } from './model.js'
import { columnFields, componentFields, fieldWords, reportFields } from './property-fields.js'
import type { FieldSpec } from './property-fields.js'
import { selected } from './selection.js'
import type { Selected } from './selection.js'
import type { EditorText } from './text.js'

/** What the properties pane edits: the report, or what is selected. */
export type PropertyTarget = { readonly kind: 'report'; readonly path: '' } | Selected

/** What the pane edits for `selection`, or undefined when the report has no such thing. */
export function propertyTarget(report: ReportDefinition, selection: Selection | null): PropertyTarget | undefined {
  return selection === null ? { kind: 'report', path: '' } : selected(report, selection)
}

export function fieldsOf(target: PropertyTarget, report: ReportDefinition, t: EditorText): FieldSpec[] {
  switch (target.kind) {
    case 'report':
      return reportFields(report, t)
    case 'component':
      return componentFields(target.component, { report, t, row: false })
    case 'column':
      return columnFields(target.column, { report, t, row: true })
  }
}

/** A field's accessible name: its words, and its unit where it has one. */
export function fieldLabel(spec: FieldSpec, t: EditorText): string {
  const label = fieldWords(spec.words, t)
  return spec.unit === undefined ? label : t('field.withUnit', { label, unit: t(`unit.${spec.unit}`) })
}

/** A value the pane refused or the session refused, as the pane keeps it: what was typed, and why. */
export interface FieldError {
  readonly input: string | boolean
  readonly message: string
}

/** Whether `path` is `at` or inside it. */
function within(path: string, at: string): boolean {
  return path === at || path.startsWith(`${at}/`)
}

/**
 * The pane for `target`: each field with its value -- what was typed, after
 * a refusal -- and its error: the refusal's, else the first diagnostic
 * about what the field holds.
 */
export function propertyPanel(target: PropertyTarget, specs: readonly FieldSpec[], heading: string, errors: ReadonlyMap<string, FieldError>, diagnostics: readonly Diagnostic[], t: EditorText): PropertyPanel {
  const fields = specs.map((spec): PropertyField => {
    const error = errors.get(spec.key)
    const about = error?.message ?? diagnostics.find((diagnostic) => within(diagnostic.path, `${target.path}${spec.key}`))?.message
    return {
      key: spec.key,
      label: fieldLabel(spec, t),
      kind: spec.kind,
      value: error?.input ?? spec.read(),
      ...(spec.options === undefined ? {} : { options: spec.options }),
      ...(spec.placeholder === undefined ? {} : { placeholder: t(spec.placeholder) }),
      required: spec.required,
      ...(about === undefined ? {} : { error: about }),
    }
  })
  return { heading, fields }
}

/** The pane's heading: "Report", or the kind and label of what is selected. */
export function propertyHeading(target: PropertyTarget, labels: ReadonlyMap<string, string>, t: EditorText): string {
  switch (target.kind) {
    case 'report':
      return t('properties.report')
    case 'component':
      return t('properties.heading', { kind: kindLabel(target.component.kind, t), name: labels.get(target.component.id) ?? target.component.id })
    case 'column':
      return t('properties.heading', { kind: kindLabel('tableColumn', t), name: labels.get(columnKey(target.table.id, target.column.id)) ?? target.column.id })
  }
}

/** `current` with the value at `path` replaced by `next`; a `null` removes a property of an object. */
function withValue(current: unknown, path: readonly string[], next: unknown): unknown {
  const [head, ...rest] = path
  if (head === undefined) return next
  if (Array.isArray(current)) return current.map((item: unknown, index) => (index === Number(head) ? withValue(item, rest, next) : item))
  const record: Record<string, unknown> = { ...(current as Record<string, unknown> | undefined) }
  const inner = withValue(record[head], rest, next)
  if (inner === null) delete record[head]
  else record[head] = inner
  return record
}

/** The patch of top-level properties that puts `next` at the pointer `at` in `owner`. */
function patchAt(owner: object, at: string, next: unknown): Record<string, unknown> {
  const [top = '', ...rest] = at.split('/').slice(1)
  return { [top]: rest.length === 0 ? next : withValue((owner as Record<string, unknown>)[top], rest, next) }
}

/** The command that puts `next` at `at` in the target: report-core's own, typed for what it changes. */
export function propertyCommand(target: PropertyTarget, at: string, next: unknown): Command {
  switch (target.kind) {
    case 'report': {
      const [top, ...rest] = at.split('/').slice(1)
      if (top === 'title') return (report) => setTitle(report, next as string)
      if (top === 'locale') return (report) => setLocale(report, next as string)
      return (report) => setPage(report, withValue({}, rest, next) as PagePatch)
    }
    case 'component': {
      const { component } = target
      return (report) => updateComponent(report, component.id, component.kind, patchAt(component, at, next) as ComponentPatch<typeof component.kind>)
    }
    case 'column': {
      const { table, column } = target
      return (report) => updateColumn(report, table.id, column.id, patchAt(column, at, next))
    }
  }
}

/** A value the session refused, and what it was written into. */
export interface Written {
  readonly spec: FieldSpec
  /** The value as the command wrote it: points, for a length. */
  readonly value: unknown
  /** The report it was written into. */
  readonly report: ReportDefinition
}

/**
 * The validator's "more than the page holds", said in the unit the field is
 * edited in, with the room the margins leave. report-spec counts in points,
 * and a field edited in millimetres that answered in points would leave the
 * person to convert. Undefined for any other refusal.
 */
export function pageRoomMessage(refusal: Refusal, path: string, written: Written, t: EditorText, format: (value: number) => string): string | undefined {
  const error = refusal.errors?.find((candidate) => within(candidate.path, path))
  if (error?.code !== 'exceeds-printable-area' || written.spec.unit !== 'mm' || typeof written.value !== 'number') return undefined
  // Which side the validator measured is the property's own name: a height, or a width.
  const room = printableArea(written.report.page)[error.path.endsWith('/height') ? 'height' : 'width']
  return t('input.exceedsPage', { value: format(ptToMm(written.value)), room: format(ptToMm(room)), unit: t('unit.mm') })
}

/** The validator's message for a value written at `path`: its error there, else its first, else the refusal's own. */
export function refusalMessage(refusal: Refusal, path: string): string {
  return refusal.errors?.find((error) => within(error.path, path))?.message ?? refusal.errors?.[0]?.message ?? refusal.message
}
