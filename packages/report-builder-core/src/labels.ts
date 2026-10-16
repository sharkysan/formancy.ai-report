/**
 * What a person calls each thing in a report: the label an outline row, a
 * canvas box, a drop target and an announcement all use, so the four can
 * never name one component two ways.
 *
 * A text is named by what it prints, a bound run by the name of what it
 * binds, a QR code by its kind and what it encodes; anything else by its
 * kind and what it draws. Where two would read the same, each says its id,
 * because a label is also an accessible name and two rows with one name
 * cannot be told apart by a screen reader or found by a test.
 */
import { walkComponents } from '@formancy/report-spec'
import type { Component, Inline, RegionName, ReportDefinition } from '@formancy/report-spec'
import type { PartKind } from './model.js'
import type { EditorText, MessageId } from './text.js'

/** Characters a label keeps before it is cut, so a paragraph does not become an outline row. */
const LONGEST = 40

/** The key of a table's column: no component id holds a slash, so it never meets one. */
export function columnKey(table: string, column: string): string {
  return `${table}/${column}`
}

export function regionLabel(region: RegionName, t: EditorText): string {
  return t(`region.${region}`)
}

export function kindLabel(kind: PartKind, t: EditorText): string {
  return t(`kind.${kind}` as MessageId)
}

function fieldLabel(report: ReportDefinition, dataset: 'header' | 'detail', field: string): string {
  return report.datasets[dataset]?.fields.find((candidate) => candidate.id === field)?.label ?? field
}

/** One run as a person reads it in a label: literal text as written, anything bound as the name of what it binds, in brackets. */
function runText(run: Inline, report: ReportDefinition, t: EditorText): string {
  switch (run.kind) {
    case 'text':
      return run.text
    case 'field':
      return `[${fieldLabel(report, run.field.dataset, run.field.field)}]`
    case 'parameter':
      return `[${report.parameters.find((parameter) => parameter.id === run.parameter)?.label ?? run.parameter}]`
    case 'expression':
      return t('label.expression')
    case 'aggregate':
      return `[${run.aggregate}]`
    case 'pageNumber':
      return t('label.pageNumber')
    case 'pageCount':
      return t('label.pageCount')
  }
}

/** Spaces collapsed and the ends trimmed, cut at LONGEST characters with an ellipsis. */
function tidy(text: string): string {
  const collapsed = text.replace(/\s+/g, ' ').trim()
  return collapsed.length > LONGEST ? `${collapsed.slice(0, LONGEST).trimEnd()}…` : collapsed
}

/** What a list of runs reads as, tidied: a text's content, a column's value. */
export function printedText(content: readonly Inline[], report: ReportDefinition, t: EditorText): string {
  return tidy(content.map((run) => runText(run, report, t)).join(''))
}

/** A component's label before it is made unique. */
export function componentLabel(component: Component, report: ReportDefinition, t: EditorText): string {
  const kind = kindLabel(component.kind, t)
  switch (component.kind) {
    case 'text':
      return printedText(component.content, report, t) || kind
    case 'image': {
      const { source } = component
      const detail = source.kind === 'asset' ? source.asset : fieldLabel(report, source.field.dataset, source.field.field)
      return t('label.kindDetail', { kind, detail })
    }
    case 'qrCode': {
      const detail = printedText(component.content, report, t)
      return detail === '' ? kind : t('label.kindDetail', { kind, detail })
    }
    default:
      return kind
  }
}

/** A table column's label before it is made unique: its heading, or its kind when the heading is empty. */
function columnLabel(header: string, t: EditorText): string {
  return tidy(header) || kindLabel('tableColumn', t)
}

/**
 * Every component's and every table column's label, by key, unique in the
 * report: where two would read the same, each is followed by its id.
 */
export function reportLabels(report: ReportDefinition, t: EditorText): ReadonlyMap<string, string> {
  const raw: (readonly [key: string, id: string, label: string])[] = []
  for (const { component } of walkComponents(report)) {
    raw.push([component.id, component.id, componentLabel(component, report, t)])
    if (component.kind === 'table') for (const column of component.columns) raw.push([columnKey(component.id, column.id), column.id, columnLabel(column.header, t)])
  }
  const counts = new Map<string, number>()
  for (const [, , label] of raw) counts.set(label, (counts.get(label) ?? 0) + 1)
  return new Map(raw.map(([key, id, label]) => [key, (counts.get(label) ?? 0) > 1 ? t('outline.duplicate', { label, id }) : label]))
}
