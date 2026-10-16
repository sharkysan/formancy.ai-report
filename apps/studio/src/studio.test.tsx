import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { editorText } from '@formancy/report-builder-core'
import type { ReportSession } from '@formancy/report-core'
import { STARTER_IMAGES, STARTERS } from '@formancy/report-corpus'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeAll, describe, expect, test, vi } from 'vitest'
import type { PreviewOutcome, PreviewRequest } from './preview/pipeline.js'
import { decodeStarters, encodeStarters } from './starters/codec.js'
import { imagesOf, studioStarters } from './starters/starters.js'
import { Studio } from './studio.js'
import { violations } from './test-accessible.js'
import { createWorkspace } from './workspace.js'
import type { Workspace } from './workspace.js'

/**
 * The Studio as a person meets it, in jsdom: both builders, the framework
 * switch over one session, the starter picker, and the Preview pane --
 * found by role and accessible name, with axe over what is on screen.
 *
 * The preview is the real pipeline: the runtime and the renderer's browser
 * entry, which runs in jsdom with the two stream classes test-setup.ts
 * gives it. It is watched, not replaced: each request is recorded on its
 * way through. PDF.js is stood in for, because jsdom has no canvas for it
 * to draw on; what the paper shows is a browser gate's.
 */

const seen = vi.hoisted(() => ({
  /** Every preview the pane asked for, in order. */
  requests: [] as { readonly id: string; readonly mode: string; readonly title: string }[],
  /** Each session the workspace opened, and how many subscriptions it has now. */
  subscriptions: new Map<object, number>(),
}))

vi.mock('./preview/pipeline.js', async (importOriginal) => {
  const pipeline = await importOriginal<typeof import('./preview/pipeline.js')>()
  return {
    ...pipeline,
    preview: (request: PreviewRequest, signal: AbortSignal, options?: { readonly maxPages?: number }): Promise<PreviewOutcome> => {
      seen.requests.push({ id: request.starter.id, mode: request.mode, title: request.report.title })
      return pipeline.preview(request, signal, options)
    },
  }
})

/**
 * Each session counted from outside, as report-builder-core's
 * `countingSession` counts one: the editor reports its own listeners, and
 * this is what reports everything else that holds on to the session.
 */
vi.mock('@formancy/report-core', async (importOriginal) => {
  const core = await importOriginal<typeof import('@formancy/report-core')>()
  return {
    ...core,
    openReportSession: (...args: Parameters<typeof core.openReportSession>): ReturnType<typeof core.openReportSession> => {
      const opening = core.openReportSession(...args)
      if (!opening.ok) return opening
      const { session } = opening
      const counted: ReportSession = {
        ...session,
        subscribe(listener) {
          seen.subscriptions.set(counted, (seen.subscriptions.get(counted) ?? 0) + 1)
          const unsubscribe = session.subscribe(listener)
          let subscribed = true
          return () => {
            if (!subscribed) return
            subscribed = false
            seen.subscriptions.set(counted, (seen.subscriptions.get(counted) ?? 0) - 1)
            unsubscribe()
          }
        },
      }
      seen.subscriptions.set(counted, 0)
      return { ...opening, session: counted }
    },
  }
})

vi.mock('./preview/pdf-document.js', () => ({
  loadPdf: () => ({
    promise: Promise.resolve({ pageCount: 1, pageSize: () => Promise.resolve({ width: 595.28, height: 841.89 }), drawPage: () => ({ done: Promise.resolve(), cancel: () => undefined }) }),
    destroy: () => undefined,
  }),
}))

const { starters, images } = decodeStarters(encodeStarters(STARTERS, STARTER_IMAGES))
let workspace: Workspace | undefined

beforeAll(() => {
  // jsdom has no object URLs; the download link needs one.
  URL.createObjectURL = () => 'blob:studio-test'
  URL.revokeObjectURL = () => undefined
})

afterEach(() => {
  cleanup()
  workspace?.dispose()
  seen.requests.length = 0
})

type User = ReturnType<typeof userEvent.setup>
type Framework = 'React' | 'Angular'

/**
 * The Studio where index.html puts it, in a `#root`, under index.html's
 * language and title. Not in a bare container: formancy.ai-data's reason,
 * an element of the page's own with that id would then be the only one.
 */
function mount(): { workspace: Workspace; user: User } {
  const served = new DOMParser().parseFromString(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'index.html'), 'utf8'), 'text/html')
  document.documentElement.lang = served.documentElement.lang
  document.title = served.title
  const listed = studioStarters(starters)
  workspace = createWorkspace(listed)
  const root = document.createElement('div')
  root.id = 'root'
  render(<Studio starters={listed} workspace={workspace} images={imagesOf(images)} />, { container: document.body.appendChild(root) })
  return { workspace, user: userEvent.setup() }
}

const editor = (): HTMLElement => screen.getByRole('region', { name: 'Report editor' })
const title = (): HTMLInputElement => within(editor()).getByRole('textbox', { name: 'Title' })
/** The editor's Undo or Redo; with `description`, only one that says what it would take back in those words. */
const tool = (name: 'Undo' | 'Redo', description?: string): HTMLElement => within(editor()).getByRole('button', { name, ...(description === undefined ? {} : { description }) })
const available = (button: HTMLElement): boolean => button.getAttribute('aria-disabled') !== 'true'
const picker = (): HTMLElement => screen.getByRole('combobox', { name: 'Starter' })
const subscriptions = (session: ReportSession): number | undefined => seen.subscriptions.get(session)

/**
 * Which framework drew the builder. The one question no role answers: the
 * two builders render the same roles and names, which is what they are for
 * (0012). So it is asked of the element Angular's builder is,
 * `<report-builder>`, which React's never renders.
 */
const drawnBy = (): Framework => (document.querySelector('report-builder') === null ? 'React' : 'Angular')

/** Switches the builder by the framework radio, and waits until that framework has drawn the editor. */
async function show(user: User, framework: Framework): Promise<void> {
  await user.click(screen.getByRole('radio', { name: framework }))
  await waitFor(() => {
    expect(screen.queryByText('Starting the Angular builder…')).toBeNull()
    expect(drawnBy()).toBe(framework)
  })
  await screen.findByRole('region', { name: 'Report editor' })
}

describe('the Studio', () => {
  // Plan 21's critical test and gate G3, across the two frameworks: edit in
  // Angular, switch to React, undo, switch back, redo. A switch that opened
  // a fresh session, or that dropped the history with the builder, fails on
  // the title or on Undo; a switch that did not switch fails on which
  // framework drew. After every switch the counts are what they were with
  // that builder shown before: an unmounted builder still subscribed to the
  // editor, or an editor made per mount and left on the session, adds one.
  test('edits in Angular, undoes in React and redoes in Angular, over one session', async () => {
    const { workspace: opened, user } = mount()
    await user.selectOptions(picker(), 'Quotation')
    await waitFor(() => expect(title().value).toBe('Offerte'))
    const { session, editor: model } = opened.open('quotation')
    const original = session.document().title
    const edited = `${original} 2026-117`
    const onSession = subscriptions(session)
    const onReact = model.listenerCount()
    expect(onSession).toBeGreaterThan(0)

    await show(user, 'Angular')
    const onAngular = model.listenerCount()
    expect(subscriptions(session)).toBe(onSession)
    await user.clear(title())
    await user.type(title(), edited)
    await user.tab()
    expect(session.document().title).toBe(edited)
    // What undo would take back, in the model's words, which each builder
    // says as Undo's description.
    const undoing = editorText('en')('action.undoWhat', { label: model.state().history.undoLabel ?? '(none)' })
    expect(tool('Undo', undoing)).toBeTruthy()

    await show(user, 'React')
    expect(model.listenerCount()).toBe(onReact)
    expect(subscriptions(session)).toBe(onSession)
    expect(title().value).toBe(edited)
    expect(available(tool('Undo', undoing))).toBe(true)
    await user.click(tool('Undo'))
    await waitFor(() => expect(title().value).toBe(original))
    expect(session.document().title).toBe(original)

    await show(user, 'Angular')
    expect(model.listenerCount()).toBe(onAngular)
    expect(subscriptions(session)).toBe(onSession)
    expect(title().value).toBe(original)
    expect(available(tool('Redo'))).toBe(true)
    await user.click(tool('Redo'))
    await waitFor(() => expect(title().value).toBe(edited))
    expect(session.document().title).toBe(edited)
    expect(await violations()).toEqual([])
  })

  // The picker opens each starter's own session and keeps the others:
  // coming back to a starter finds what was done to it, and the preview is
  // of the starter shown, never the one before. The starter left keeps
  // nothing subscribed: its builder and its preview are gone, and only its
  // editor still follows its session.
  test('opens each starter, and keeps what was done to the others', async () => {
    const { workspace: opened, user } = mount()
    await user.clear(title())
    await user.type(title(), 'Kept')
    await user.tab()
    await user.selectOptions(picker(), 'Quotation')
    await waitFor(() => expect(title().value).toBe('Offerte'))
    await waitFor(() => expect(seen.requests.at(-1)).toEqual({ id: 'quotation', mode: 'preview', title: 'Offerte' }))
    const left = opened.open('service-inspection')
    expect(left.editor.listenerCount()).toBe(0)
    expect(subscriptions(left.session)).toBe(1)
    await user.selectOptions(picker(), 'Service inspection')
    await waitFor(() => expect(title().value).toBe('Kept'))
    expect(within(picker()).getAllByRole('option').map((option) => option.textContent)).toEqual(['Service inspection', 'Quotation', 'Grouped equipment', 'Blank'])
  })

  // Final runs a final render, which refuses what a preview shows with a
  // warning (0010): the toggle reaches the runtime, and the status says
  // which was printed.
  test('renders final when asked, and says so', async () => {
    const { user } = mount()
    await screen.findByText('Preview: printed.')
    await user.click(screen.getByRole('checkbox', { name: 'Final' }))
    await screen.findByText('Final render: printed.')
    expect(seen.requests.at(-1)?.mode).toBe('final')
    expect(screen.getByRole('link', { name: 'Download PDF' }).getAttribute('download')).toBe('service-inspection.pdf')
    expect(await violations()).toEqual([])
  })

  // What printing found is named for the render it was found by: a final
  // render's refusal listed under "Why the preview was not printed" would
  // send the person looking at the preview, which may print.
  test('names what printing found by the mode that found it', async () => {
    const { user } = mount()
    await user.selectOptions(picker(), 'Grouped equipment')
    await screen.findByText('Preview: printed.')
    await user.click(within(editor()).getByRole('treeitem', { name: 'Book value' }))
    const condition = within(editor()).getByRole('textbox', { name: 'Show only when' })
    await user.type(condition, 'row.value > 1000')
    await user.tab()
    await screen.findByText('Preview: refused by the runtime, 1 problem.')
    expect(screen.getByRole('list', { name: 'Why the preview was not printed' })).toBeTruthy()
    await user.click(screen.getByRole('checkbox', { name: 'Final' }))
    await screen.findByText('Final render: refused by the runtime, 1 problem.')
    expect(screen.getByRole('list', { name: 'Why the final render was not printed' })).toBeTruthy()
    expect(screen.queryByRole('list', { name: 'Why the preview was not printed' })).toBeNull()
  })

  // The Preview is the widest thing beside the design view. Hidden, it
  // gives the builder the row and prints nothing while it is away; the
  // bar's toggle, which says whether it is shown, brings it back printing
  // what the session holds now.
  test('hides the Preview from the bar, and shows it again printing the latest edit', async () => {
    const { user } = mount()
    await screen.findByText('Preview: printed.')
    const toggle = screen.getByRole('button', { name: 'Preview', pressed: true })
    expect(toggle.getAttribute('aria-controls')).toBe(screen.getByRole('region', { name: 'Preview' }).id)
    await user.click(toggle)
    expect(screen.queryByRole('region', { name: 'Preview' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Preview', pressed: false })).toBe(toggle)
    const asked = seen.requests.length
    await user.clear(title())
    await user.type(title(), 'Hidden while edited')
    await user.tab()
    expect(seen.requests.length).toBe(asked)
    expect(await violations()).toEqual([])
    await user.click(toggle)
    await screen.findByText('Preview: printed.')
    expect(seen.requests.at(-1)?.title).toBe('Hidden while edited')
    expect(screen.getByRole('button', { name: 'Preview', pressed: true })).toBe(toggle)
  })

  // The first Tab says where the keyboard can go: past the bar, into the
  // builder, which takes focus so the next Tab starts there.
  test('offers a skip link into the builder first', async () => {
    const { user } = mount()
    await user.tab()
    const skip = screen.getByRole('link', { name: 'Skip to the builder' })
    expect(document.activeElement).toBe(skip)
    const target = document.querySelector(skip.getAttribute('href') ?? '')
    expect(target).toBe(screen.getByRole('main'))
    expect(target?.getAttribute('tabindex')).toBe('-1')
  })
})
