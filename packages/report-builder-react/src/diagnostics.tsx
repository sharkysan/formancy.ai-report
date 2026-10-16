/**
 * The problems: report-core's diagnostics, each a button named "Error:
 * Introduction" and described by report-core's sentence. Activating one
 * selects what it is about, and the builder moves focus to its outline row;
 * one about the report as a whole selects nothing, which shows the report's
 * own properties.
 *
 * Each entry is keyed by what it is (`DiagnosticEntry.key`), never by its
 * place in the list: a problem listed before the one the keyboard is on
 * leaves that one's button, and the keyboard, where they were.
 */
import type { ReactElement, Ref } from 'react'
import type { DiagnosticEntry, EditorState, EditorText } from '@formancy/report-builder-core'

export interface DiagnosticsProps {
  readonly state: EditorState
  readonly t: EditorText
  readonly ids: string
  readonly list: Ref<HTMLUListElement>
  readonly follow: (entry: DiagnosticEntry) => void
}

export function Diagnostics({ state, t, ids, list, follow }: DiagnosticsProps): ReactElement {
  return (
    <>
      {/* Not a tab stop: the problems pane's button moves focus here, to say
          how many there are. Named in words, as the pane's heading says. */}
      <ul ref={list} aria-label={t('pane.problems')} data-report-part="diagnostics" tabIndex={-1}>
        {state.diagnostics.map((entry, at) => {
          const message = `${ids}-problem-${at}`
          return (
            <li key={entry.key} data-report-part="diagnostic" data-severity={entry.severity}>
              <button type="button" aria-describedby={message} onClick={() => follow(entry)}>
                {entry.label}
              </button>
              <div id={message}>{entry.message}</div>
            </li>
          )
        })}
      </ul>
      {state.diagnostics.length === 0 ? <p>{t('problems.none')}</p> : null}
    </>
  )
}
