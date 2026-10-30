/**
 * The Studio: formancy.ai's room, with a report builder in it.
 *
 * One shell (formancy.ai 0106): a bar with the wordmark, the starter picker,
 * the framework switch and the Preview's toggle; under it the builder --
 * the workbench's three panes, whose side panes each hide from their own
 * header -- and the Preview, the real PDF on white paper. The picker opens a
 * starter's session, kept while the page lives (`workspace.ts`); the switch
 * shows the React or the Angular builder over the same editor
 * (`builder/builder-pane.tsx`); the Preview prints whatever the session
 * holds now (`preview/preview-pane.tsx`).
 *
 * The Preview stands beside the builder in a window with room for it, and
 * in the builder's middle, in the design view's place, in any other
 * (0029, `layout.ts`). Whether it is shown, and where, is the editor's: the
 * bar's toggle, the toolbar's Design view and both builders read and change
 * the one state, and a framework switch keeps it.
 */
import { useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { ReactElement } from 'react'
import type { HostViewPlace, Selection } from '@formancy/report-builder-core'
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

/** The Preview's id, for the bar's toggle to say what it shows and hides. */
const PREVIEW = 'studio-preview'

const same = (selection: Selection | null, target: ProblemTarget): boolean =>
  selection !== null && 'id' in selection && selection.id === target.id && selection.column === target.column

export function Studio({ starters, workspace, images }: { starters: readonly StudioStarter[]; workspace: Workspace; images: ImageResolver }): ReactElement {
  const [starterId, setStarterId] = useState(starters[0]?.id ?? '')
  const [framework, setFramework] = useState<Framework>('react')
  const builder = useRef<HTMLDivElement>(null)
  /** The element the keyboard last stood on below the bar, for a Preview moved from under it to take it along. */
  const lastFocused = useRef<EventTarget | null>(null)
  const opened = workspace.open(starterId)
  const { editor } = opened
  const preview = useSyncExternalStore(editor.subscribe, () => editor.state().hostView)
  const shown = preview?.shown === true
  const beside = shown && preview.place === 'beside'

  // The window narrowed past the width moves the Preview from beside the
  // builder into its middle: the keyboard in it goes along, onto the
  // region the builder draws it in, rather than down to the page. Out of
  // the middle, the builder hands it to the design view itself.
  useLayoutEffect(() => {
    const last = lastFocused.current
    const dropped = document.activeElement === null || document.activeElement === document.body
    if (beside || !(last instanceof Node) || last.isConnected || !dropped) return
    focusWhenDrawn(() => builder.current?.querySelector<HTMLElement>('[data-report-part="view"]') ?? null)
  }, [beside])

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

  /**
   * The bar's toggle: hides the Preview in sight, and shows one hidden. One
   * shown but out of sight -- in the middle of a phone's builder while it
   * shows another pane -- it brings into sight, so every press changes what
   * is seen; a browser that cannot say what is in sight hides it.
   */
  function toggle(): void {
    const inSight = document.getElementById(PREVIEW)?.checkVisibility?.() !== false
    editor.dispatch({ type: shown && inSight ? 'hideHostView' : 'showHostView' })
  }

  // Hidden, the Preview is not drawn and prints nothing; shown again, it
  // prints what the session holds then.
  const pane = (place: HostViewPlace): ReactElement => (
    <PreviewPane key={starterId} id={PREVIEW} place={place} opened={opened} images={images} select={select} />
  )
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
        <button type="button" className="tool" aria-pressed={shown} aria-controls={shown ? PREVIEW : undefined} onClick={toggle}>
          Preview
        </button>
        <p id={proves} className="proves">
          Shows {opened.starter.proves}.
        </p>
      </header>
      <main
        id="studio-main"
        tabIndex={-1}
        className="studio-main"
        data-preview={shown ? undefined : 'hidden'}
        onFocus={(event) => {
          lastFocused.current = event.target
        }}
      >
        <div ref={builder} className="studio-builder">
          <BuilderPane key={starterId} framework={framework} editor={editor} hostView={pane('middle')} />
        </div>
        {beside ? pane('beside') : null}
      </main>
    </div>
  )
}
