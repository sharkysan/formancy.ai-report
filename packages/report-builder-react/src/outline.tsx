/**
 * The outline: the report as an ARIA tree, a group per region and a row per
 * component or table column, then a row at the tree's top for each part of
 * the report's own level -- its payment part, after every region, as it
 * prints (0039); with no row at all, an empty tree and the sentence that
 * says so.
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
import type { EditorAction, EditorState, EditorText, OutlineNode, OutlinePart } from '@formancy/report-builder-core'
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
function described(node: Pick<OutlineNode, 'problems'> & { readonly overflows?: boolean }, problems: string, overflow: string): string | undefined {
  const ids = [...(node.problems > 0 ? [problems] : []), ...(node.overflows === true ? [overflow] : [])]
  return ids.length === 0 ? undefined : ids.join(' ')
}

/** A row's count of problems: drawn, and said as its description; inside the name it would make "Introduction" read "Introduction 1". */
function Problems({ row, id, t }: { readonly row: Pick<OutlineNode, 'problems' | 'severity'>; readonly id: string; readonly t: EditorText }): ReactElement | null {
  if (row.problems === 0) return null
  return (
    <>
      <span data-report-part="badge" data-severity={row.severity} aria-hidden="true">
        {row.problems}
      </span>
      <span id={id} hidden>
        {t('outline.problems', { count: row.problems })}
      </span>
    </>
  )
}

function selection(node: OutlineNode): EditorAction {
  return node.column === undefined ? { type: 'select', id: node.id } : { type: 'select', id: node.id, column: node.column }
}

export function Outline({ state, t, ids, tree, drag, act }: OutlineProps): ReactElement {
  const regions = state.outline.map((region) => ({ region, rows: rows(region.nodes) }))
  const all: readonly { readonly key: string; readonly selected: boolean }[] = [...regions.flatMap((region) => region.rows.map((row) => row.node)), ...state.outlineParts]
  // The tree's one tab stop: the selected row, else the first; the tree itself when it has none.
  const stop = all.find((row) => row.selected)?.key ?? all[0]?.key
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
        return (
          // Named in the editor's words, not after the label drawn in it:
          // Chromium would put report-builder.css's capitals into that name,
          // "BODY". The label is hidden from the tree, which would read it
          // again as a text among the group's rows.
          <div key={region.region} role="group" aria-label={region.label} data-report-part="outline-region">
            <span data-report-part="region-label" aria-hidden="true">
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
                  <Problems row={node} id={problems} t={t} />
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
      {state.outlineParts.map((part, at) => (
        <PartRow key={part.key} part={part} position={at + 1} siblings={state.outlineParts.length} tabbable={part.key === stop} ids={ids} t={t} act={act} />
      ))}
    </div>
  )
}

/**
 * A part of the report's own level, as a row at the tree's top: selected by
 * focus or a click, as a component's row is, and dragged nowhere, since it
 * has one place.
 */
function PartRow({ part, position, siblings, tabbable, ids, t, act }: { readonly part: OutlinePart; readonly position: number; readonly siblings: number; readonly tabbable: boolean; readonly ids: string; readonly t: EditorText; readonly act: (action: EditorAction) => void }): ReactElement {
  const problems = `${ids}-problems-${part.key}`
  const select = (): void => act({ type: 'select', part: part.part })
  return (
    <div
      role="treeitem"
      aria-level={1}
      aria-posinset={position}
      aria-setsize={siblings}
      aria-selected={part.selected}
      aria-describedby={described(part, problems, '')}
      tabIndex={tabbable ? 0 : -1}
      data-report-part="outline-item"
      onFocus={() => {
        if (!part.selected) select()
      }}
      onClick={select}
    >
      {part.label}
      <Problems row={part} id={problems} t={t} />
    </div>
  )
}
