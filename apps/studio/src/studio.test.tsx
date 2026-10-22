import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { editorText, SCENARIO_PNG } from '@formancy/report-builder-core'
import type { ReportSession } from '@formancy/report-core'
import { STARTER_IMAGES, STARTERS } from '@formancy/report-corpus'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeAll, describe, expect, test, vi } from 'vitest'
import type { PreviewOutcome, PreviewRequest } from './preview/pipeline.js'
import { decodeStarters, encodeStarters } from './starters/codec.js'
import { studioImages } from './images/image-store.js'
import { studioStarters } from './starters/starters.js'
import { Studio } from './studio.js'
import { violations } from './test-accessible.js'
import { setWidth } from './test-width.js'
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
 *
 * jsdom's window is 1024 pixels wide, which has no room for the Preview
 * beside the builder: there it stands in the design view's place (0029).
 * A test that needs the room sets the width (test-width.ts), which the
 * matchMedia stand-in in test-setup.ts answers.
 *
 * An image is added as a person adds one (0033): Add image… pressed, and
 * the file handed to the hidden input it opens, which has no role and is
 * found beside the button in the DOM, as the builders' scenarios find it.
 */

/** A report's QR-bill's account as written, its runs joined: what the Preview is asked to print it to. */
const accountOf = vi.hoisted(() => (report: { readonly paymentPart?: { readonly account: readonly { readonly kind: string; readonly text?: string }[] } }): string | undefined => report.paymentPart?.account.map((run) => run.text ?? `[${run.kind}]`).join(''))

const seen = vi.hoisted(() => ({
  /** Every preview the pane asked for, in order. */
  requests: [] as { readonly id: string; readonly mode: string; readonly title: string; readonly account: string | undefined }[],
  /** How each preview ended -- printed, refused with the runtime's codes, or not drawn with the renderer's -- and the assets its report declared. */
  outcomes: [] as { readonly assets: readonly string[]; readonly kind: string }[],
  /** Each session the workspace opened, and how many subscriptions it has now. */
  subscriptions: new Map<object, number>(),
}))

vi.mock('./preview/pipeline.js', async (importOriginal) => {
  const pipeline = await importOriginal<typeof import('./preview/pipeline.js')>()
  return {
    ...pipeline,
    preview: async (request: PreviewRequest, signal: AbortSignal, options?: { readonly maxPages?: number }): Promise<PreviewOutcome> => {
      seen.requests.push({ id: request.starter.id, mode: request.mode, title: request.report.title, account: accountOf(request.report) })
      const outcome = await pipeline.preview(request, signal, options)
      const kind = outcome.kind === 'printed' ? 'printed' : outcome.kind === 'refused' ? `refused: ${outcome.errors.map((error) => error.code).join()}` : `not drawn: ${outcome.refusal.code}`
      seen.outcomes.push({ assets: request.report.assets.map((asset) => asset.id), kind })
      return outcome
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
  seen.outcomes.length = 0
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
  const kept = studioImages(images)
  workspace = createWorkspace(listed, { images: kept.store })
  const root = document.createElement('div')
  root.id = 'root'
  render(<Studio starters={listed} workspace={workspace} images={kept.resolve} />, { container: document.body.appendChild(root) })
  return { workspace, user: userEvent.setup() }
}

const t = editorText('en')
const editor = (): HTMLElement => screen.getByRole('region', { name: 'Report editor' })
const title = (): HTMLInputElement => within(editor()).getByRole('textbox', { name: 'Title' })
/** The design view, by the name that says it is not the PDF; null while the Preview stands in its place. */
const designView = (): HTMLElement | null => within(editor()).queryByRole('region', { name: t('canvas.label') })
/** The bar's Preview, pressed while the Preview is shown, wherever it stands. */
const toggle = (pressed?: boolean): HTMLElement => screen.getByRole('button', { name: 'Preview', ...(pressed === undefined ? {} : { pressed }) })
/** The toolbar's button for a pane. */
const paneButton = (name: string): HTMLElement => within(within(editor()).getByRole('toolbar', { name: 'Report tools' })).getByRole('button', { name })
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

/**
 * Switches the builder by the framework radio, and waits until that
 * framework has drawn the editor, and the Preview shown in its middle
 * (0029): the builder shown draws the Preview there again.
 */
async function show(user: User, framework: Framework): Promise<void> {
  await user.click(screen.getByRole('radio', { name: framework }))
  await waitFor(() => {
    expect(screen.queryByText('Starting the Angular builder…')).toBeNull()
    expect(drawnBy()).toBe(framework)
  })
  await screen.findByRole('region', { name: 'Report editor' })
  if (toggle().getAttribute('aria-pressed') === 'true') await screen.findByRole('checkbox', { name: 'Final' })
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
    // The Preview in Angular's middle prints the edit made beside it.
    expect(editor().contains(screen.getByRole('region', { name: 'Preview' }))).toBe(true)
    await waitFor(() => expect(seen.requests.at(-1)?.title).toBe(edited))
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

  // Plan 21's switch with an image (0033): added in Angular, kept by the
  // page, inserted and printed; both steps undone in React, and redone in
  // Angular, where the Preview prints it again from the bytes the page
  // kept. A store given to one framework's builder and not the other's, or
  // lost with the builder, offers no Add image… after the switch; one that
  // let the bytes go on the undo refuses the redo's preview as
  // missing-asset.
  test('adds an image in Angular, undoes it in React and redoes it in Angular, printing it wherever it stands', async () => {
    /** Each preview that neither printed nor gave way to a later one: a render the scheduler cancelled for the next edit is neither. */
    const unprinted = (): string[] => seen.outcomes.filter(({ kind }) => kind !== 'printed' && kind !== 'not drawn: cancelled').map(({ assets, kind }) => `${kind} (${assets.join()})`)
    const { user } = mount()
    await user.selectOptions(picker(), 'blank')
    await screen.findByText('Preview: printed.')
    await show(user, 'Angular')
    const add = within(editor()).getByRole('button', { name: t('images.add') })
    await user.click(add)
    const input = add.parentElement?.querySelector('input[type="file"]')
    if (!(input instanceof HTMLInputElement)) throw new Error('no file input beside Add image…')
    fireEvent.change(input, { target: { files: [new File([Uint8Array.from(SCENARIO_PNG)], 'logo.png', { type: 'image/png' })] } })
    await within(editor()).findByText(t('images.added', { id: 'logo', kind: t('kind.image') }))
    expect(document.activeElement).toBe(within(editor()).getByRole('button', { name: t('images.add') }))
    await user.click(within(editor()).getByRole('button', { name: t('kind.image') }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: t('target.inside', { where: t('region.reportHeader') }) }))
    await waitFor(() => expect(seen.outcomes.at(-1)).toEqual({ assets: ['logo'], kind: 'printed' }))
    expect(unprinted()).toEqual([])

    await show(user, 'React')
    // Back at the report's properties, the image is listed, drawn by the image just inserted.
    await user.click(within(editor()).getByRole('button', { name: t('properties.report') }))
    expect(within(editor()).getByRole('button', { name: t('images.removeOne', { id: 'logo' }), description: t('images.inUse', { names: t('label.kindDetail', { kind: t('kind.image'), detail: 'logo' }) }) })).toBeTruthy()
    await user.click(tool('Undo'))
    await user.click(tool('Undo'))
    await waitFor(() => expect(seen.outcomes.at(-1)).toEqual({ assets: [], kind: 'printed' }))
    expect(within(editor()).queryByRole('group', { name: t('images.heading') })).toBeNull()

    await show(user, 'Angular')
    await user.click(tool('Redo'))
    await user.click(tool('Redo'))
    await waitFor(() => expect(seen.outcomes.at(-1)).toEqual({ assets: ['logo'], kind: 'printed' }))
    expect(unprinted()).toEqual([])
    expect(await violations()).toEqual([])
  })

  // Plan 21's switch with the QR-bill selected (0039): its IBAN changed in
  // Angular, where a click on its band in the design view selected it; the
  // bill still selected once React draws the editor, where the change is
  // undone; and redone back in Angular, the Preview, shown again in the
  // design view's place, asked each time to print the account as it
  // stands. A selection of the bill one builder drew and the other did
  // not, or lost with the switch, fails on the selected row; an edit made
  // past the session fails on Undo.
  test('edits the invoice’s QR-bill in Angular, undoes in React and redoes in Angular, the bill selected throughout', async () => {
    const { workspace: opened, user } = mount()
    await user.selectOptions(picker(), 'invoice')
    await screen.findByText('Preview: printed.')
    const { session } = opened.open('invoice')
    const original = accountOf(session.document())
    const typed = 'CH58 3000 0000 0000 0000 0'
    const bill = (): HTMLElement => within(editor()).getByRole('treeitem', { name: t('canvas.paymentPart'), selected: true })
    const iban = (): HTMLInputElement => within(editor()).getByRole('textbox', { name: t('field.iban') })

    await show(user, 'Angular')
    await user.click(paneButton('Design view'))
    await user.click(within(editor()).getByRole('img', { name: t('canvas.paymentPart') }))
    await waitFor(() => expect(document.activeElement).toBe(bill()))
    await user.clear(iban())
    await user.type(iban(), typed)
    await user.tab()
    expect(accountOf(session.document())).toBe(typed)
    // The Preview back in the design view's place, from the bar, prints the bill as it stands.
    await user.click(toggle(false))
    await waitFor(() => expect(seen.requests.at(-1)?.account).toBe(typed))

    await show(user, 'React')
    expect(bill()).toBeTruthy()
    expect(iban().value).toBe(typed)
    await user.click(tool('Undo', t('action.undoWhat', { label: t('history.change', { field: t('field.iban') }) })))
    await waitFor(() => expect(iban().value).toBe(original))
    expect(accountOf(session.document())).toBe(original)
    await waitFor(() => expect(seen.requests.at(-1)?.account).toBe(original))

    await show(user, 'Angular')
    expect(bill()).toBeTruthy()
    await user.click(tool('Redo'))
    await waitFor(() => expect(iban().value).toBe(typed))
    await waitFor(() => expect(seen.requests.at(-1)?.account).toBe(typed))
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
    expect(within(picker()).getAllByRole('option').map((option) => option.textContent)).toEqual(['Service inspection', 'Quotation', 'Grouped equipment', 'Invoice', 'Euro invoice', 'E-invoice', 'Site visit', 'Blank'])
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

  // The list of what a render lacks scrolls inside the Preview, at most
  // two fifths of its height, and an e-invoice's preview lists its one
  // warning with no button in it (0027, 0044): a list a keyboard cannot
  // reach would be one it cannot scroll, which axe's
  // scrollable-region-focusable found in the browser gate. It is one tab
  // stop, as the design view is: Tab from Final, before it, lands on it.
  test('makes what a render lacks one tab stop, so a keyboard scrolls it', async () => {
    const { user } = mount()
    await user.selectOptions(picker(), 'E-invoice')
    await screen.findByText('Preview: printed, with 1 warning.')
    const lacks = screen.getByRole('list', { name: 'What the preview lacks' })
    expect(within(lacks).queryAllByRole('button')).toEqual([])
    act(() => screen.getByRole('checkbox', { name: 'Final' }).focus())
    await user.tab()
    expect(document.activeElement).toBe(lacks)
    expect(await violations()).toEqual([])
  })

  // Hidden, the Preview gives its place back to the design view and prints
  // nothing while it is away; the bar's toggle, which says whether it is
  // shown, brings it back printing what the session holds now. In the
  // builder's middle the region named Preview is the builder's, which has
  // no id: the toggle names the Preview inside it.
  test('hides the Preview from the bar, and shows it again printing the latest edit', async () => {
    const { user } = mount()
    await screen.findByText('Preview: printed.')
    const bar = toggle(true)
    const controlled = document.getElementById(bar.getAttribute('aria-controls') ?? '')
    expect(controlled).not.toBeNull()
    expect(screen.getByRole('region', { name: 'Preview' }).contains(controlled)).toBe(true)
    await user.click(bar)
    expect(screen.queryByRole('region', { name: 'Preview' })).toBeNull()
    expect(designView()).not.toBeNull()
    expect(toggle(false)).toBe(bar)
    const asked = seen.requests.length
    await user.clear(title())
    await user.type(title(), 'Hidden while edited')
    await user.tab()
    expect(seen.requests.length).toBe(asked)
    expect(await violations()).toEqual([])
    await user.click(bar)
    await screen.findByText('Preview: printed.')
    expect(seen.requests.at(-1)?.title).toBe('Hidden while edited')
    expect(toggle(true)).toBe(bar)
  })

  // Decision 0029, the user's "Preview in the middle": in a window with no
  // room beside the builder the PDF stands where the design view stood,
  // the outline and the properties beside it, so a person edits a property
  // and watches what prints change -- in both builders, the same. A PDF
  // under a builder that fills the window, as before, was below the fold.
  for (const framework of ['React', 'Angular'] as const) {
    test(`stands the Preview in the design view’s place in ${framework}, and prints what is edited beside it`, async () => {
      const { user } = mount()
      if (framework === 'Angular') await show(user, 'Angular')
      await screen.findByText('Preview: printed.')
      const preview = within(editor()).getByRole('region', { name: 'Preview' })
      expect(await within(preview).findByRole('link', { name: 'Download PDF' })).toBeTruthy()
      expect(designView()).toBeNull()
      expect(within(editor()).getByRole('tree', { name: 'Outline' })).toBeTruthy()
      expect(toggle(true)).toBeTruthy()
      await user.clear(title())
      await user.type(title(), 'Watched')
      await user.tab()
      await waitFor(() => expect(seen.requests.at(-1)?.title).toBe('Watched'))
      await within(preview).findByText('Preview: printed.')
      expect(within(editor()).getByRole('region', { name: 'Preview' })).toBe(preview)
      expect(await violations()).toEqual([])
    })
  }

  // The toolbar's Design view gives the design view its place back, the
  // keyboard going into it, and the Preview goes with nothing printed while
  // away; the bar's Preview, by keyboard, brings it back, keeping the
  // keyboard on itself as a toggle does, and the builder's live region
  // says how to get the design view back.
  test('gives the design view its place back from the toolbar, and the PDF again from the bar', async () => {
    const { user } = mount()
    await screen.findByText('Preview: printed.')
    await user.click(paneButton('Design view'))
    expect(screen.queryByRole('region', { name: 'Preview' })).toBeNull()
    await waitFor(() => expect(document.activeElement).toBe(designView()))
    const bar = toggle(false)
    const asked = seen.requests.length
    await user.clear(title())
    await user.type(title(), 'Away')
    await user.tab()
    expect(seen.requests.length).toBe(asked)
    bar.focus()
    await user.keyboard('{Enter}')
    expect(toggle(true)).toBe(bar)
    expect(document.activeElement).toBe(bar)
    expect(designView()).toBeNull()
    expect(within(editor()).getByText(t('status.hostViewShown', { view: 'Preview', pane: t('pane.canvas') }))).toBeTruthy()
    await within(editor()).findByText('Preview: printed.')
    expect(seen.requests.at(-1)?.title).toBe('Away')
  })

  // Past 2052 pixels the design view holds a page beside the Preview and
  // both side panes (0019), and the Preview stands beside the builder,
  // where the toolbar's Design view leaves it and the bar hides and shows
  // it, as before 0029. The window crossing the width moves it into the
  // builder's middle and back, shown all along.
  test('stands the Preview beside the builder past 2052 pixels, and moves it as the window crosses', async () => {
    setWidth(2053)
    const { user } = mount()
    await screen.findByText('Preview: printed.')
    const beside = screen.getByRole('region', { name: 'Preview' })
    expect(editor().contains(beside)).toBe(false)
    expect(designView()).not.toBeNull()
    await user.click(paneButton('Design view'))
    expect(screen.getByRole('region', { name: 'Preview' })).toBe(beside)
    expect(toggle(true)).toBeTruthy()
    await user.click(toggle(true))
    expect(screen.queryByRole('region', { name: 'Preview' })).toBeNull()
    expect(designView()).not.toBeNull()
    await user.click(toggle(false))
    await screen.findByText('Preview: printed.')
    expect(editor().contains(screen.getByRole('region', { name: 'Preview' }))).toBe(false)
    act(() => setWidth(2052))
    await within(editor()).findByText('Preview: printed.')
    expect(editor().contains(screen.getByRole('region', { name: 'Preview' }))).toBe(true)
    expect(designView()).toBeNull()
    expect(toggle(true)).toBeTruthy()
    act(() => setWidth(2053))
    await screen.findByText('Preview: printed.')
    expect(editor().contains(screen.getByRole('region', { name: 'Preview' }))).toBe(false)
    expect(designView()).not.toBeNull()
  })

  // Angular takes the element it lends the Preview back a render after the
  // editor moves the Preview beside the builder, where the Studio draws it
  // at once: drawn into the element until then, two Previews printed under
  // one id. And the keyboard on the Preview beside the builder goes with it
  // into the middle, onto the region it stands in there, rather than down
  // to the page as its pane goes.
  test('moves the Preview in Angular with one Preview drawn at any moment, and the keyboard with it', async () => {
    setWidth(2052)
    const { user } = mount()
    await show(user, 'Angular')
    await within(editor()).findByText('Preview: printed.')
    act(() => setWidth(2053))
    expect(document.querySelectorAll('#studio-preview')).toHaveLength(1)
    await waitFor(() => expect(within(editor()).queryByRole('region', { name: 'Preview' })).toBeNull())
    await screen.findByText('Preview: printed.')
    const fit = within(screen.getByRole('region', { name: 'Preview' })).getByRole('button', { name: 'Fit width' })
    fit.focus()
    act(() => setWidth(2052))
    expect(document.querySelectorAll('#studio-preview').length).toBeLessThanOrEqual(1)
    await waitFor(() => expect(document.activeElement).toBe(within(editor()).getByRole('region', { name: 'Preview' })))
    await within(editor()).findByText('Preview: printed.')
  })

  // Whether the Preview is shown is the editor's, as its hidden panes are
  // (0029): each starter keeps its own, and one opened for the first time
  // shows its PDF whatever the starter before had.
  test('keeps whether each starter’s Preview is shown', async () => {
    const { user } = mount()
    await screen.findByText('Preview: printed.')
    await user.click(toggle(true))
    await user.selectOptions(picker(), 'Quotation')
    await waitFor(() => expect(title().value).toBe('Offerte'))
    expect(toggle(true)).toBeTruthy()
    await screen.findByText('Preview: printed.')
    await user.selectOptions(picker(), 'Service inspection')
    expect(toggle(false)).toBeTruthy()
    expect(screen.queryByRole('region', { name: 'Preview' })).toBeNull()
  })

  // On a phone the builder shows one pane at a time, and the Preview, shown
  // in the middle, is out of sight while another pane is chosen. The bar's
  // Preview then brings it into sight rather than hiding what nobody sees,
  // and only a press with the Preview in sight hides it. jsdom lays nothing
  // out, so it cannot tell that report-builder.css's narrow layout hides
  // every pane but the one the editor's root names: `checkVisibility`,
  // which the bar asks, answers here as that layout does.
  test('brings a Preview shown out of sight into view from the bar, rather than hiding it', async () => {
    Object.defineProperty(Element.prototype, 'checkVisibility', {
      configurable: true,
      value(this: Element): boolean {
        const pane = this.closest('[data-pane]')
        const root = this.closest('[data-report-part="editor"]')
        return pane === null || root === null || pane.getAttribute('data-pane') === root.getAttribute('data-panel')
      },
    })
    try {
      setWidth(390)
      const { user } = mount()
      await screen.findByText('Preview: printed.')
      const bar = toggle(true)
      const preview = (): HTMLElement | null => document.getElementById(bar.getAttribute('aria-controls') ?? '')
      expect(preview()?.checkVisibility()).toBe(true)
      await user.click(paneButton('Outline'))
      expect(preview()?.checkVisibility()).toBe(false)
      await user.click(bar)
      expect(toggle(true)).toBe(bar)
      expect(preview()?.checkVisibility()).toBe(true)
      await user.click(bar)
      expect(toggle(false)).toBe(bar)
      expect(screen.queryByRole('region', { name: 'Preview' })).toBeNull()
    } finally {
      Reflect.deleteProperty(Element.prototype, 'checkVisibility')
    }
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
