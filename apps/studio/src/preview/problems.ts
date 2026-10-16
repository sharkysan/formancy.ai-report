/**
 * What stopped a preview, or what a preview lacks, as the list the Preview
 * pane shows: each entry with the stage and code that found it, the
 * runtime's or the renderer's own sentence, and the component it is about
 * when the document still has one -- named by its outline label, which the
 * editor keeps unique, so it can name the button that selects it.
 *
 * Read against the outline the editor shows now, not the one the render
 * saw: an entry about a component deleted since links to nothing.
 */
import type { OutlineNode, OutlineRegion } from '@formancy/report-builder-core'
import type { RuntimeError } from '@formancy/report-runtime'
import type { NotDrawn } from './pipeline.js'

export interface ProblemTarget {
  readonly id: string
  readonly column?: string
  /** The outline's label for it. */
  readonly label: string
}

export interface PreviewProblem {
  readonly key: string
  readonly severity: 'error' | 'warning'
  /** The stage that found it and its code there: "data missing-field", "render too-many-pages". */
  readonly code: string
  readonly message: string
  readonly target: ProblemTarget | null
}

function rowOf(nodes: readonly OutlineNode[], id: string, column: string | undefined): OutlineNode | undefined {
  for (const node of nodes) {
    if (node.id === id && node.column === column) return node
    const inside = rowOf(node.children, id, column)
    if (inside !== undefined) return inside
  }
  return undefined
}

/** The outline row of `id`'s `column`, else of `id`; null when the outline has neither. */
export function targetOf(outline: readonly OutlineRegion[], id: string | undefined, column?: string): ProblemTarget | null {
  if (id === undefined) return null
  const find = (wanted: string | undefined): OutlineNode | undefined => outline.map((region) => rowOf(region.nodes, id, wanted)).find((found) => found !== undefined)
  const inColumn = column === undefined ? undefined : find(column)
  if (inColumn !== undefined) return { id, column: column as string, label: inColumn.label }
  const component = find(undefined)
  return component === undefined ? null : { id, label: component.label }
}

export function runtimeProblems(errors: readonly RuntimeError[], severity: PreviewProblem['severity'], outline: readonly OutlineRegion[]): PreviewProblem[] {
  return errors.map((error, index) => ({
    key: `${String(index)} ${error.stage} ${error.code} ${error.path}`,
    severity,
    code: `${error.stage} ${error.code}`,
    message: error.message,
    target: 'componentId' in error ? targetOf(outline, error.componentId, error.columnId) : null,
  }))
}

export function renderProblem(refusal: NotDrawn, outline: readonly OutlineRegion[]): PreviewProblem {
  return { key: `render ${refusal.code}`, severity: 'error', code: `render ${refusal.code}`, message: refusal.message, target: targetOf(outline, refusal.subject) }
}
