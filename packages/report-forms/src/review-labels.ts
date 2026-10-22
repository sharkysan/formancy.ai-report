/**
 * A relabel, offered (0048, FB-Q6): the form calls a field something else
 * now, its answers where they were. Nothing regenerates a report, and no
 * generated base is kept beside it, so the review compares the report's
 * own texts with the label each version it was made from or reviewed
 * against gave the field, in the report's locale, and offers the new
 * label for each text that still says an old one: the field's own label,
 * a line's label run before the run that prints the field -- as the
 * generator writes one, `labelled` -- and a column's heading over it.
 * What prints the field is what the compiler says an expression reads,
 * never a second reading; a text the author reworded is not touched.
 */
import { READ_AS } from '@formancy/report-core'
import type { ReportCompilation, StepDescriptor } from '@formancy/report-core'
import { walkComponents } from '@formancy/report-spec'
import type { DatasetRole, FieldRef, Inline, ReportDefinition } from '@formancy/report-spec'
import { resolveText } from '@formancy/spec'
import { drawable, oneLine } from './generate-labels.js'
import { labelled } from './generate-layout.js'
import type { ReadPlan } from './kinds.js'
import type { Version } from './version.js'

/**
 * The label a field the report reads has in `version`, in `locale`, on one
 * line, as the generator prints it: a matrix row's or an option's, where
 * the field reads one, or the field's own; undefined where it has none a
 * font draws.
 */
export function labelIn(version: Version, plan: ReadPlan, locale: string): string | undefined {
  const members = plan.as === 'matrix' ? plan.def.rows : plan.def.options
  const text = plan.member === undefined ? plan.def.label : members?.find((member) => member.value === plan.member)?.label
  const resolved = resolveText(version.schema, text, locale)
  const line = resolved === undefined ? '' : oneLine(resolved)
  return line === '' || !drawable(line) ? undefined : line
}

/** Whether `inline`, at `path`, prints the field `ref`: a run of it, or an expression the compiler says reads it. */
function prints(inline: Inline | undefined, path: string, ref: FieldRef, compiled: ReportCompilation): boolean {
  if (inline?.kind === 'field') return inline.field.dataset === ref.dataset && inline.field.field === ref.field
  if (inline?.kind !== 'expression') return false
  return compiled.expressions.get(`${path}/expression/cel`)?.reads.some((read) => read.name === READ_AS[ref.dataset] && read.member === ref.field) === true
}

/**
 * The commands that say `now` wherever `report` says one of `was` of the
 * field `id` of the dataset in `role`: its own label, each line's label run
 * before a run that prints it, each column's heading over a value that
 * prints it. None where nothing says an old label any more.
 */
export function relabelSteps(report: ReportDefinition, compiled: ReportCompilation, role: DatasetRole, id: string, was: ReadonlySet<string>, now: string): StepDescriptor[] {
  const ref: FieldRef = { dataset: role, field: id }
  const steps: StepDescriptor[] = []
  const field = report.datasets[role]?.fields.find((each) => each.id === id)
  if (field !== undefined && was.has(field.label)) {
    const { id: _id, ...body } = field
    steps.push({ command: 'putField', args: [role, id, { ...body, label: now }] })
  }
  const lines = new Set([...was].map(labelled))
  for (const { component, path } of walkComponents(report)) {
    if (component.kind === 'text') {
      const said = (run: Inline, index: number): boolean => run.kind === 'text' && lines.has(run.text) && prints(component.content[index + 1], `${path}/content/${index + 1}`, ref, compiled)
      if (component.content.some(said)) steps.push({ command: 'updateComponent', args: [component.id, 'text', { content: component.content.map((run, index) => (said(run, index) ? { kind: 'text', text: labelled(now) } : run)) }] })
    }
    if (component.kind !== 'table') continue
    for (const [index, column] of component.columns.entries()) {
      if (was.has(column.header) && prints(column.value, `${path}/columns/${index}/value`, ref, compiled)) steps.push({ command: 'updateColumn', args: [component.id, column.id, { header: now }] })
    }
  }
  return steps
}
