/**
 * The Studio: formancy.ai's room, with a report builder in it.
 *
 * One shell (formancy.ai 0106): a bar with the wordmark, the starter picker
 * and the framework switch; under it the builder -- the workbench's three
 * panes -- and the Preview, the real PDF on white paper. The picker opens a
 * starter's session, kept while the page lives (`workspace.ts`); the switch
 * shows the React or the Angular builder over the same editor
 * (`builder/builder-pane.tsx`); the Preview prints whatever the session
 * holds now (`preview/preview-pane.tsx`).
 */
import { useRef, useState } from 'react'
import type { ReactElement } from 'react'
import type { Selection } from '@formancy/report-builder-core'
import type { ImageResolver } from '@formancy/report-runtime'
import { BuilderPane, FRAMEWORKS } from './builder/builder-pane.js'
import type { Framework } from './builder/builder-pane.js'
import { focusWhenDrawn } from './focus.js'
import { PreviewPane } from './preview/preview-pane.js'
import type { ProblemTarget } from './preview/problems.js'
import { Segmented } from './segmented.js'
import type { StudioStarter } from './starters/codec.js'
import { starterLabel } from './starters/starters.js'
import type { Workspace } from './workspace.js'

const same = (selection: Selection | null, target: ProblemTarget): boolean => selection !== null && selection.id === target.id && selection.column === target.column

export function Studio({ starters, workspace, images }: { starters: readonly StudioStarter[]; workspace: Workspace; images: ImageResolver }): ReactElement {
  const [starterId, setStarterId] = useState(starters[0]?.id ?? '')
  const [framework, setFramework] = useState<Framework>('react')
  const builder = useRef<HTMLDivElement>(null)
  const opened = workspace.open(starterId)
  const { editor } = opened

  /**
   * A problem's component, selected in the builder and the keyboard put on
   * its outline row -- the pane a narrow screen shows is the outline's, so
   * the row is on screen -- once the builder has drawn the new selection.
   */
  function select(target: ProblemTarget): void {
    const row = (): HTMLElement | null => builder.current?.querySelector<HTMLElement>('[role="treeitem"][aria-selected="true"]') ?? null
    const before = row()
    const already = same(editor.state().selection, target)
    editor.dispatch(target.column === undefined ? { type: 'select', id: target.id } : { type: 'select', id: target.id, column: target.column })
    editor.dispatch({ type: 'openPanel', panel: 'outline' })
    focusWhenDrawn(() => {
      const now = row()
      return now !== null && (already || now !== before) ? now : null
    })
  }

  const proves = `${starterId}-proves`
  return (
    <div className="studio">
      <a className="skip" href="#studio-main">
        Skip to the builder
      </a>
      <header className="studio-bar">
        <h1 className="wordmark">Formancy Report Studio</h1>
        <div className="starter">
          <label htmlFor="studio-starter" className="eyebrow">
            Starter
          </label>
          <select id="studio-starter" value={starterId} aria-describedby={proves} onChange={(event) => setStarterId(event.target.value)}>
            {starters.map((starter) => (
              <option key={starter.id} value={starter.id}>
                {starterLabel(starter)}
              </option>
            ))}
          </select>
        </div>
        <Segmented legend="Builder" name="framework" className="framework" options={FRAMEWORKS} value={framework} onChange={setFramework} />
        <p id={proves} className="proves">
          Shows {opened.starter.proves}.
        </p>
      </header>
      <main id="studio-main" tabIndex={-1} className="studio-main">
        <div ref={builder} className="studio-builder">
          <BuilderPane key={starterId} framework={framework} editor={editor} />
        </div>
        <PreviewPane key={starterId} opened={opened} images={images} select={select} />
      </main>
    </div>
  )
}
