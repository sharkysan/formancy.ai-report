/*
 * The React builder from outside the workspace: installed from its tarball
 * in a project that holds only what a React host has -- the builder, the
 * packages it declares, React and React's types; no Node types and no other
 * @formancy package -- type-checked as a browser host's code (DOM types,
 * skipLibCheck OFF), and drawn under Node by React's server renderer. The
 * gate draws it twice: with React's development build, where React says
 * what it objects to, and with its production build, which is what a host's
 * bundler ships; and it does both again at the oldest React its peer range
 * admits.
 *
 * What a server render can show: that the packed code loads with the React
 * a host installs, draws an editor's state as the accessible structure
 * report-builder-core's README sets out (structure.ts), with every name from
 * the editor's catalogue, and subscribes to nothing while it draws. What it
 * cannot show is anything a browser does after the markup -- the
 * subscription itself, an effect, focus, a key, a pointer, and whether
 * unmounting lets the editor go. Those are the package suite's, in jsdom,
 * inside the workspace.
 */
import { version } from 'react'
import type { ReactElement } from 'react'
import { renderToString } from 'react-dom/server'
import { ReportBuilder, useEditorState } from '@formancy/report-builder-react'
import type { ReportBuilderProps } from '@formancy/report-builder-react'
import type { EditorState, ReportEditor } from '@formancy/report-builder-core'
import { elementsIn, readMarkup, spokenText } from './markup.js'
import type { MarkupElement } from './markup.js'
import { editorToDraw, structureProblems } from './structure.js'

/**
 * Which of React's builds runs: the gate sets NODE_ENV=production for the
 * one a host ships. Read from the global rather than typed as Node's,
 * because this is a browser host's code; a host's bundler replaces the same
 * expression.
 */
const build = (globalThis as { readonly process?: { readonly env?: Readonly<Record<string, string | undefined>> } }).process?.env?.['NODE_ENV'] === 'production' ? 'production' : 'development'

/**
 * `element` drawn to a string, failing on anything React says while drawing
 * it. The development build says what it objects to -- a list without keys,
 * an ARIA attribute that does not exist, a hook called out of order -- and
 * the production build should say nothing at all.
 */
function render(element: ReactElement): string {
  const said: string[] = []
  const { error, warn } = console
  console.error = console.warn = (...args: unknown[]): void => {
    said.push(args.map(String).join(' '))
  }
  let markup: string
  try {
    markup = renderToString(element)
  } finally {
    console.error = error
    console.warn = warn
  }
  if (said.length > 0) throw new Error(`React's ${build} build said this while drawing the builder:\n${said.join('\n')}`)
  return markup
}

const editor: ReportEditor = editorToDraw()
const state: EditorState = editor.state()
const listening = editor.listenerCount()

const props: ReportBuilderProps = { editor }
const page = readMarkup(render(<ReportBuilder {...props} />))

/** What could be wrong, collected, so one run names every difference rather than the first. */
const wrong: string[] = []
const expect = (holds: boolean, what: string): void => {
  if (!holds) wrong.push(what)
}

// The builder draws one element and no wrapper: the editor's own <section>.
const [root] = page.children
if (page.children.length !== 1 || root === undefined || typeof root === 'string' || root.tag !== 'section') throw new Error('the markup is not one editor root, a <section>')
wrong.push(...structureProblems(root, state))

// Drawing changed nothing, and subscribed to nothing. The server renderer
// runs no effect, so useSyncExternalStore never subscribes there and never
// unsubscribes: the count is not back to where it was, it never left. That
// still shows the builder subscribes in an effect and not while it draws,
// which would leave a listener behind on every server render, since nothing
// unmounts there. It does not show that unmounting unsubscribes.
expect(editor.state() === state, 'drawing the builder changed the editor state')
expect(editor.listenerCount() === listening, `the editor had ${String(listening)} listeners before the builder was drawn and ${String(editor.listenerCount())} after`)

// A host's own view of the state, through the hook the package exports.
function Title({ editor: shown }: { readonly editor: ReportEditor }): ReactElement {
  return <h1>{useEditorState(shown).document.title}</h1>
}
const title = elementsIn(readMarkup(render(<Title editor={editor} />)))
expect(title.length === 1 && spokenText(title[0] as MarkupElement) === state.document.title, 'useEditorState did not give a host the state')

// The host made the editor, so the host disposes of it; the builder never does.
editor.dispose()
if (wrong.length > 0) throw new Error(`the React builder, drawn on the server by React's ${build} build:\n- ${wrong.join('\n- ')}`)

console.log(
  `ok: React ${version}'s ${build} build drew the packed builder on the server, in Swiss German, as report-builder-core's README sets out: one region named by the catalogue, a toolbar that is one tab stop with a button per pane, a Hide in each side pane, a palette of ${String(state.palette.length)}, a tree with a group per region and a row per node, a design view of named pictures, a form named by its heading, the report's problems listed and counted, and the live region; every data-report-part one REPORT_PARTS names; nothing said by React, nothing changed and no listener added (the server runs no effects, so it never subscribes); useEditorState gave a host the state`,
)
