/**
 * The problems: report-core's diagnostics, each a button named "Error:
 * Introduction" and described by report-core's sentence. Activating one
 * selects what it is about, and the builder moves focus to its outline row;
 * one about the report as a whole selects nothing, which shows the report's
 * own properties.
 */
import type { ReactElement, Ref } from 'react'
import type { DiagnosticEntry, EditorState, EditorText } from '@formancy/report-builder-core'

export interface DiagnosticsProps {
  readonly state: EditorState
  readonly t: EditorText
  readonly ids: string
  /** The element whose text names the list: the pane's heading. */
  readonly heading: string
  readonly list: Ref<HTMLUListElement>
  readonly follow: (entry: DiagnosticEntry) => void
}

export function Diagnostics({ state, t, ids, heading, list, follow }: DiagnosticsProps): ReactElement {
  return (
    <>
      {/* Not a tab stop: the problems pane's button moves focus here, to say how many there are. */}
      <ul ref={list} aria-labelledby={heading} data-report-part="diagnostics" tabIndex={-1}>
        {state.diagnostics.map((entry, at) => {
          const message = `${ids}-problem-${at}`
          return (
            <li key={`${at}-${entry.code}`} data-report-part="diagnostic" data-severity={entry.severity}>
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
