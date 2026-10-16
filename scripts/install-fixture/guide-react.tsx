/*
 * docs/getting-started.md's React page, from outside the workspace (0015).
 *
 * The install gate writes the guide's React blocks into guide/ in a
 * project that holds what the guide tells a React page to install -- the
 * builder, the renderer, the workbench's stylesheet -- beside React, at the
 * newest and the oldest React the builder's peer range admits; the host's
 * type-check covers them as a browser's code (DOM types, no Node types,
 * skipLibCheck OFF), and its browser build bundles each of them. This
 * runs what can run without a browser:
 *
 * - the page, drawn by React's server renderer in its development build,
 *   failing on anything React says: the builder as report-builder-core's
 *   README sets out (structure.ts), and Save, offered only once there is
 *   something to save;
 * - the preview, `keepPreviewing` over the guide's `printPreview`, which
 *   prints in Node through the renderer's browser entry: a PDF at once; one
 *   print for edits made together; a print the next edit overtakes aborted
 *   and never shown; the runtime's refusal shown as the reason; and nothing
 *   once stopped.
 *
 * What it cannot show is the page in a browser: the effect that starts the
 * preview, the iframe, a press of Save. A server render runs no effect.
 */
import { version } from 'react'
import type { ReactElement } from 'react'
import { renderToString } from 'react-dom/server'
import { insertComponent, setTitle } from '@formancy/report-core'
import { openEditor } from './guide/editor.js'
import { ReportPage } from './guide/report-page.js'
import { keepPreviewing } from './guide/preview.js'
import type { Preview, Print } from './guide/preview.js'
import { printPreview } from './guide/print.js'
import { elementsIn, readMarkup, spokenText } from './markup.js'
import { quotation, quotationData } from './quotation.js'
import { insertAndSelect, reportToDraw, structureProblems } from './structure.js'

/** What could be wrong, collected, so one run names every difference rather than the first. */
const wrong: string[] = []
const expect = (holds: boolean, what: string): void => {
  if (!holds) wrong.push(what)
}

/** `element` drawn to a string, failing on anything React's development build says while drawing it. */
function render(element: ReactElement): string {
  const said: string[] = []
  const { error, warn } = console
  console.error = console.warn = (...args: unknown[]): void => {
    said.push(args.map(String).join(' '))
  }
  try {
    return renderToString(element)
  } finally {
    console.error = error
    console.warn = warn
    if (said.length > 0) wrong.push(`React said this while drawing the guide's page:\n${said.join('\n')}`)
  }
}

/** Waits, a little at a time, until `holds`; fails after twenty seconds, naming what it waited for. */
async function until(holds: () => boolean, what: string): Promise<void> {
  const end = Date.now() + 20_000
  while (!holds()) {
    if (Date.now() > end) throw new Error(`the guide's preview did not ${what} within twenty seconds`)
    await new Promise((resolve) => setTimeout(resolve, 20))
  }
}

const isPdf = (preview: Preview | undefined): boolean => preview !== undefined && 'pdf' in preview && new TextDecoder().decode(preview.pdf.subarray(0, 5)) === '%PDF-'

// The page, drawn on the server, over the report structure.ts reads, opened
// by the guide's openEditor.
const drawn = openEditor(reportToDraw())
insertAndSelect(drawn.editor)
const listening = drawn.editor.listenerCount()
const never: Print = () => new Promise<Uint8Array>(() => undefined)
const page = readMarkup(render(<ReportPage opened={drawn} print={never} save={() => undefined} />))
const root = elementsIn(page).find((element) => element.attributes.get('data-report-part') === 'editor')
if (root === undefined) throw new Error("the guide's page draws no editor")
wrong.push(...structureProblems(root, drawn.editor.state()))
const saves = elementsIn(page).filter((element) => element.tag === 'button' && spokenText(element) === 'Save')
expect(saves.length === 1 && saves[0]?.attributes.has('disabled') === true, 'the page has not one Save button, offered only once there is something to save')
expect(drawn.editor.listenerCount() === listening, 'drawing the page added a listener to the editor')
drawn.editor.dispose()

// The preview, run over the quotation starter: every print the guide's
// printPreview, each one recorded. A held print finishes whatever its
// signal says, as a pass already under way or a server that has already
// answered does: renderPdf alone would refuse an aborted signal before its
// first pass, and the guide's own check that an overtaken print is never
// shown would go untested.
const opened = openEditor(quotation)
const prints: { readonly title: string; readonly signal: AbortSignal }[] = []
/** Which print, by its place in `prints`, made each PDF; and how many prints have ended either way. */
const madeBy = new Map<Uint8Array, number>()
let ended = 0
const shown: Preview[] = []
let holding = false
let release: (() => void) | undefined
const print: Print = async (report, signal) => {
  const at = prints.push({ title: report.title, signal }) - 1
  try {
    const held = holding
    if (held) await new Promise<void>((resolve) => (release = resolve))
    const pdf = await printPreview(report, quotationData, held ? new AbortController().signal : signal)
    madeBy.set(pdf, at)
    return pdf
  } finally {
    ended += 1
  }
}
/** The print, by its place in `prints`, whose PDF the `at`-th preview shown is; undefined for a refusal. */
const shownFrom = (at: number): number | undefined => {
  const preview = shown[at]
  return preview !== undefined && 'pdf' in preview ? madeBy.get(preview.pdf) : undefined
}
const stop = keepPreviewing(opened.session, print, (preview) => shown.push(preview))
const retitle = (title: string): void => {
  if (!opened.session.apply((report) => setTitle(report, title)).ok) throw new Error(`the session refused the title ${title}`)
}

// At once, without an edit.
await until(() => shown.length === 1, 'print the opened report')
expect(prints.length === 1 && isPdf(shown[0]) && shownFrom(0) === 0, 'the first preview is not a PDF of the opened report')

// Two edits together: one print, of the second.
retitle('Offerte, revised')
retitle('Offerte, revised again')
await until(() => shown.length === 2, 'print after two edits')
expect(prints.length === 2 && prints[1]?.title === 'Offerte, revised again' && shownFrom(1) === 1, `two edits made together printed ${String(prints.length - 1)} times, the last of ${String(prints[1]?.title)}`)

// A print still running when the next edit arrives: aborted, and, though
// it finishes, never shown -- only the print of the latest document is.
holding = true
retitle('Offerte, overtaken')
await until(() => prints.length === 3, 'start a print after an edit')
holding = false
retitle('Offerte, latest')
expect(prints[2]?.signal.aborted === true, 'a print the next edit overtook was not aborted')
release?.()
await until(() => ended === 4, 'finish the overtaken print and the next')
await new Promise((resolve) => setTimeout(resolve, 50))
expect(shown.length === 3 && prints[3]?.title === 'Offerte, latest' && shownFrom(2) === 3, `after a print the next edit overtook, the previews shown came from prints ${shown.map((_, at) => String(shownFrom(at))).join(', ')}, where only print 3, of the latest document, should follow 1`)

// A report the runtime refuses: its reason, shown.
const clock = { id: 'clock', kind: 'text', content: [{ kind: 'expression', expression: { cel: 'string(now())' } }] } as const
if (!opened.session.apply((report) => insertComponent(report, { region: 'body', index: 0 }, clock)).ok) throw new Error('the session refused a text printing the clock')
await until(() => shown.length === 4, 'say why a refused report was not printed')
const refused = shown[3]
const described = refused === undefined ? 'nothing' : 'pdf' in refused ? `the PDF of print ${String(shownFrom(3))}` : `refused, ${refused.refused}`
expect(refused !== undefined && 'refused' in refused && refused.refused.includes('now()'), `a report the runtime refuses, printing the clock, was shown as ${described}`)

// Stopped: an edit prints nothing.
stop()
const before = prints.length
retitle('Offerte, after the page')
await new Promise((resolve) => setTimeout(resolve, 1000))
expect(prints.length === before && shown.length === 4, 'the preview printed after it was stopped')

opened.editor.dispose()
if (wrong.length > 0) throw new Error(`the guide's React page, on React ${version}:\n- ${wrong.join('\n- ')}`)

console.log(
  `ok: React ${version}'s development build drew the guide's page on the server, its builder as report-builder-core's README sets out and Save offered only with something to save; keepPreviewing printed the quotation through the renderer's browser entry at once, once for two edits made together, aborted a print the next edit overtook and showed nothing of it, showed the runtime's reason for a report it refused, and printed nothing once stopped`,
)
