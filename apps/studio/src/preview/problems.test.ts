import { createReportEditor } from '@formancy/report-builder-core'
import type { OutlineNode, OutlineRegion } from '@formancy/report-builder-core'
import { openReportSession } from '@formancy/report-core'
import { QUOTATION } from '@formancy/report-corpus'
import type { RuntimeError } from '@formancy/report-runtime'
import { describe, expect, test } from 'vitest'
import { renderProblem, runtimeProblems } from './problems.js'

function outline(): readonly OutlineRegion[] {
  const opened = openReportSession(QUOTATION.report)
  if (!opened.ok) throw new Error('the quotation does not open')
  const editor = createReportEditor(opened.session)
  const { outline: regions } = editor.state()
  editor.dispose()
  return regions
}

/** The outline row the editor gives `id` (and `column`), whose label is what the builder calls it. */
function row(regions: readonly OutlineRegion[], id: string, column?: string): OutlineNode {
  const walk = (nodes: readonly OutlineNode[]): OutlineNode | undefined => nodes.map((node) => (node.id === id && node.column === column ? node : walk(node.children))).find((found) => found !== undefined)
  const found = regions.map((region) => walk(region.nodes)).find((each) => each !== undefined)
  if (found === undefined) throw new Error(`no outline row ${id} ${column ?? ''}`)
  return found
}

const regions = outline()

describe("the preview's problems", () => {
  // A refusal in a column of a table is followed to that column: the
  // person lands on what to change, named as the builder names it, not on
  // the whole table or nowhere.
  test('link an error in a column to that column, by its outline label', () => {
    const error: RuntimeError = { stage: 'evaluation', code: 'evaluation-failed' as never, path: '/regions/body/0/columns/5', message: 'it failed', componentId: 'positions', columnId: 'amount' }
    const [problem] = runtimeProblems([error], 'error', regions)
    expect(problem?.target).toEqual({ id: 'positions', column: 'amount', label: row(regions, 'positions', 'amount').label })
    expect(problem).toMatchObject({ severity: 'error', code: 'evaluation evaluation-failed', message: 'it failed' })
  })

  // A problem about a component the document no longer has -- the report
  // was edited after the render -- links to nothing, rather than to an id
  // the editor would refuse to select.
  test('link nothing the document no longer has, nor a problem in the data', () => {
    const errors: RuntimeError[] = [
      { stage: 'resolve', code: 'missing-asset', path: '/x', message: 'gone', componentId: 'deleted-in-the-meantime' },
      { stage: 'data', code: 'missing-field' as never, path: '/header/customer', message: 'missing' },
    ]
    expect(runtimeProblems(errors, 'warning', regions).map((problem) => problem.target)).toEqual([null, null])
  })

  // A column the outline does not list is still in its table: the table is
  // what the person can select.
  test('fall back to the component when its column is not in the outline', () => {
    const error: RuntimeError = { stage: 'format', code: 'unsupported-locale' as never, path: '', message: 'm', componentId: 'positions', columnId: 'no-such-column' }
    expect(runtimeProblems([error], 'error', regions)[0]?.target).toEqual({ id: 'positions', label: row(regions, 'positions').label })
  })

  // The renderer names a table by its id, which is the component's; it
  // names a block it has no id for by its place in the document, which is
  // no component, and links nowhere.
  test("link a renderer's refusal by the component it names", () => {
    expect(renderProblem({ code: 'content-too-large', message: 'too wide', subject: 'positions' }, regions).target).toEqual({ id: 'positions', label: row(regions, 'positions').label })
    expect(renderProblem({ code: 'unsupported', message: 'margins', subject: 'page.margins' }, regions)).toEqual({ key: 'render unsupported', severity: 'error', code: 'render unsupported', message: 'margins', target: null })
  })

  // React keys: two identical errors -- the same missing field read in two
  // places of one stage -- are still two entries.
  test('each have a key of their own', () => {
    const error: RuntimeError = { stage: 'data', code: 'missing-field' as never, path: '/header/x', message: 'm' }
    const keys = runtimeProblems([error, error], 'error', regions).map((problem) => problem.key)
    expect(new Set(keys).size).toBe(2)
  })
})
