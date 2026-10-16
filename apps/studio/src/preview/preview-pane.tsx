/**
 * The Preview pane: the session's current document resolved against the
 * starter's data and printed, as a host would (0010, 0011), and shown on
 * white paper; or, where it was not printed, why -- each problem linked to
 * the component it is about, which selecting puts the builder on.
 *
 * Preview runs the runtime's preview mode, which prints what the data lacks
 * as nothing and says so; Final runs a final render, which refuses it.
 */
import { useId, useState } from 'react'
import type { ReactElement } from 'react'
import { useEditorState } from '@formancy/report-builder-react'
import type { DataMode, ImageResolver } from '@formancy/report-runtime'
import type { Opened } from '../workspace.js'
import { PdfView } from './pdf-view.js'
import { renderProblem, runtimeProblems } from './problems.js'
import type { PreviewProblem, ProblemTarget } from './problems.js'
import { usePreview } from './use-preview.js'
import type { Shown } from './use-preview.js'
import { count } from './view.js'

/** What the status line says: what is shown, and whether a newer one is on its way. */
function said(shown: Shown | null, rendering: boolean, problems: number): string {
  const mode = shown?.mode === 'final' ? 'Final render' : 'Preview'
  const now = rendering ? ' Rendering the latest edit…' : ''
  if (shown === null) return rendering ? 'Rendering the preview…' : 'Nothing printed yet.'
  switch (shown.outcome.kind) {
    case 'printed':
      return `${mode}: printed${problems === 0 ? '' : `, with ${count(problems, 'warning', 'warnings')}`}.${now}`
    case 'refused':
      return `${mode}: refused by the runtime, ${count(problems, 'problem', 'problems')}.${now}`
    case 'not-drawn':
      return `${mode}: not drawn by the renderer.${now}`
  }
}

/** The name of the list of what printing found: what a printed render lacks, or why one was not printed. */
function listName(mode: DataMode, printed: boolean): string {
  const render = mode === 'final' ? 'the final render' : 'the preview'
  return printed ? `What ${render} lacks` : `Why ${render} was not printed`
}

function Problems({ problems, label, select }: { problems: readonly PreviewProblem[]; label: string; select: (target: ProblemTarget) => void }): ReactElement {
  return (
    <ul className="problems" aria-label={label}>
      {problems.map((problem) => (
        <li key={problem.key} data-severity={problem.severity}>
          <code>{problem.code}</code> <span>{problem.message}</span>
          {problem.target === null ? null : (
            <button type="button" className="quiet" onClick={() => select(problem.target as ProblemTarget)}>
              Select {problem.target.label}
            </button>
          )}
        </li>
      ))}
    </ul>
  )
}

export function PreviewPane({ id, opened, images, select }: { id: string; opened: Opened; images: ImageResolver; select: (target: ProblemTarget) => void }): ReactElement {
  const [mode, setMode] = useState<DataMode>('preview')
  const { shown, rendering, fault } = usePreview(opened, images, mode)
  const { outline } = useEditorState(opened.editor)
  const heading = useId()

  const outcome = shown?.outcome
  const problems =
    outcome === undefined ? [] : outcome.kind === 'printed' ? runtimeProblems(outcome.warnings, 'warning', outline) : outcome.kind === 'refused' ? runtimeProblems(outcome.errors, 'error', outline) : [renderProblem(outcome.refusal, outline)]

  return (
    <section id={id} className="studio-preview" aria-labelledby={heading}>
      <header className="preview-head">
        <h2 id={heading}>Preview</h2>
        <label className="check">
          <input type="checkbox" checked={mode === 'final'} onChange={(event) => setMode(event.target.checked ? 'final' : 'preview')} />
          Final
        </label>
        <p role="status" className="preview-status" data-outcome={outcome?.kind ?? 'none'}>
          {said(shown, rendering, problems.length)}
        </p>
      </header>
      {fault === null ? null : (
        <p role="alert" className="problem-box">
          The preview failed: {fault}
        </p>
      )}
      {/* Named apart from the builder's own "Problems", which are the
          editor's diagnostics: these are what printing found, named for
          the render that found them. */}
      {problems.length === 0 ? null : <Problems problems={problems} label={listName(shown?.mode ?? mode, outcome?.kind === 'printed')} select={select} />}
      {outcome?.kind === 'printed' ? <PdfView pdf={outcome.pdf} fileName={`${opened.starter.id}.pdf`} stale={rendering} /> : null}
    </section>
  )
}
