/**
 * The outline: the report as an ARIA tree, a group per region and a row per
 * component or table column; with no row at all, an empty tree and the
 * sentence that says so.
 *
 * Rows are flat within their region and nest by `aria-level`, which is also
 * what report-builder.css indents by, so the nesting drawn and the nesting
 * announced cannot disagree. One row is a tab stop -- the selected one, or
 * the first -- and focus follows the selection: moving focus to a row
 * selects it, and every action that selects moves focus to its row. The
 * keys are report-builder-core's `actionForKey`, which the builder applies
 * to the whole tree; nothing here decides a key.
 */
import type { ReactElement, Ref } from 'react'
import type { EditorAction, EditorState, EditorText, OutlineNode } from '@formancy/report-builder-core'
import type { PointerDrag } from './pointer-drag.js'

export interface OutlineProps {
  readonly state: EditorState
  readonly t: EditorText
  readonly ids: string
  readonly tree: Ref<HTMLDivElement>
  readonly drag: PointerDrag
  readonly act: (action: EditorAction) => void
}

/** A node with its place among its siblings, for `aria-posinset` and `aria-setsize`. */
interface Row {
  readonly node: OutlineNode
  readonly position: number
  readonly siblings: number
}

function rows(nodes: readonly OutlineNode[], into: Row[] = []): Row[] {
  nodes.forEach((node, at) => {
    into.push({ node, position: at + 1, siblings: nodes.length })
    rows(node.children, into)
  })
  return into
}

/** The ids of what describes a row: how many problems it has, and that it is wider than its place. */
function described(node: OutlineNode, problems: string, overflow: string): string | undefined {
  const ids = [...(node.problems > 0 ? [problems] : []), ...(node.overflows ? [overflow] : [])]
  return ids.length === 0 ? undefined : ids.join(' ')
}

function selection(node: OutlineNode): EditorAction {
  return node.column === undefined ? { type: 'select', id: node.id } : { type: 'select', id: node.id, column: node.column }
}

export function Outline({ state, t, ids, tree, drag, act }: OutlineProps): ReactElement {
  const regions = state.outline.map((region) => ({ region, rows: rows(region.nodes) }))
  const all = regions.flatMap((region) => region.rows)
  // The tree's one tab stop: the selected row, else the first; the tree itself when it has none.
  const stop = all.find((row) => row.node.selected)?.node.key ?? all[0]?.node.key
  const empty = `${ids}-outline-empty`

  // With no row at all the tree holds nothing -- a tree owns rows, and a
  // region's name with none under it is not one -- and is itself the tab
  // stop, described by the sentence beside it. With rows it still takes
  // focus from a script, never from Tab: where focus goes when an action
  // leaves nothing selected, since focusing a row would select it.
  if (stop === undefined) {
    return (
      <>
        <div ref={tree} role="tree" aria-label={t('pane.outline')} aria-describedby={empty} data-report-part="outline" tabIndex={0} />
        <p id={empty} data-report-part="outline-empty">
          {t('outline.empty')}
        </p>
      </>
    )
  }

  return (
    <div ref={tree} role="tree" aria-label={t('pane.outline')} data-report-part="outline" tabIndex={-1}>
      {regions.map(({ region, rows: list }) => {
        const label = `${ids}-region-${region.region}`
        return (
          <div key={region.region} role="group" aria-labelledby={label} data-report-part="outline-region">
            <span id={label} data-report-part="region-label">
              {region.label}
            </span>
            {list.length === 0 ? <span>{t('outline.empty')}</span> : null}
            {list.map(({ node, position, siblings }) => {
              const problems = `${ids}-problems-${node.key}`
              const overflow = `${ids}-overflow-${node.key}`
              return (
                <div
                  key={node.key}
                  ref={(element) => drag.row(element, node)}
                  role="treeitem"
                  aria-level={node.depth + 1}
                  aria-posinset={position}
                  aria-setsize={siblings}
                  aria-selected={node.selected}
                  aria-describedby={described(node, problems, overflow)}
                  tabIndex={node.key === stop ? 0 : -1}
                  data-report-part="outline-item"
                  data-kind={node.kind}
                  onPointerDown={(event) => {
                    if (node.column === undefined) drag.press(event, { id: node.id })
                  }}
                  onFocus={() => {
                    if (!node.selected) act(selection(node))
                  }}
                  onClick={() => {
                    if (!drag.swallowClick()) act(selection(node))
                  }}
                >
                  {node.label}
                  {node.problems > 0 ? (
                    <>
                      {/* The count is drawn, and said as the row's description:
                          inside the name it would make "Introduction" read
                          "Introduction 1". */}
                      <span data-report-part="badge" data-severity={node.severity} aria-hidden="true">
                        {node.problems}
                      </span>
                      <span id={problems} hidden>
                        {t('outline.problems', { count: node.problems })}
                      </span>
                    </>
                  ) : null}
                  {/* What the canvas marks on a box too wide for its place,
                      said where a keyboard is: on its row. */}
                  {node.overflows ? (
                    <span id={overflow} hidden>
                      {t('canvas.overflow')}
                    </span>
                  ) : null}
                </div>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}
