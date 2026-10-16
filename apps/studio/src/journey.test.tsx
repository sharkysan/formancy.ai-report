import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { OutlineNode } from '@formancy/report-builder-core'
import { STARTER_IMAGES, STARTERS } from '@formancy/report-corpus'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import axe from 'axe-core'
import { afterEach, beforeAll, describe, expect, test, vi } from 'vitest'
import type { PreviewOutcome, PreviewRequest } from './preview/pipeline.js'
import { decodeStarters, encodeStarters } from './starters/codec.js'
import { imagesOf, studioStarters } from './starters/starters.js'
import { Studio } from './studio.js'
import { violations } from './test-accessible.js'
import { createWorkspace } from './workspace.js'
import type { Workspace } from './workspace.js'

/**
 * The Studio's journey as one person walks it, in jsdom: every starter the
 * picker offers, each in both builders and in both modes, then an edit the
 * renderer refuses, followed to the component it names. What holds across
 * the steps rather than inside one is checked at each of them.
 *
 * The preview is the real pipeline -- the runtime, and the renderer's
 * browser entry, pdfmake's browser build with its virtual-file Roboto --
 * not the Node entry: it runs in jsdom once test-setup.ts has given the
 * page the Blob and DecompressionStream it lacks. Each outcome is recorded
 * on its way through. PDF.js is stood in for, since jsdom has no canvas;
 * the stand-in keeps the bytes it is handed, which are what the paper
 * would show.
 */

const seen = vi.hoisted(() => ({
  /** Every outcome the pipeline gave, with the starter and the mode it was for. */
  outcomes: [] as { readonly id: string; readonly mode: string; readonly outcome: PreviewOutcome }[],
  /** The bytes PDF.js was handed, in order. */
  shown: [] as Uint8Array[],
  /** Each object URL the page made, and the Blob behind it. */
  downloads: new Map<string, Blob>(),
}))

vi.mock('./preview/pipeline.js', async (importOriginal) => {
  const pipeline = await importOriginal<typeof import('./preview/pipeline.js')>()
  return {
    ...pipeline,
    preview: async (request: PreviewRequest, signal: AbortSignal, options?: { readonly maxPages?: number }): Promise<PreviewOutcome> => {
      const outcome = await pipeline.preview(request, signal, options)
      seen.outcomes.push({ id: request.starter.id, mode: request.mode, outcome })
      return outcome
    },
  }
})

vi.mock('./preview/pdf-document.js', () => ({
  loadPdf: (bytes: Uint8Array) => {
    seen.shown.push(bytes)
    return {
      promise: Promise.resolve({ pageCount: 1, pageSize: () => Promise.resolve({ width: 595.28, height: 841.89 }), drawPage: () => ({ done: Promise.resolve(), cancel: () => undefined }) }),
      destroy: () => undefined,
    }
  },
}))

const { starters, images } = decodeStarters(encodeStarters(STARTERS, STARTER_IMAGES))
let workspace: Workspace | undefined

beforeAll(() => {
  // jsdom has no object URLs: one per Blob, so a link's address finds its bytes.
  URL.createObjectURL = (blob: Blob) => {
    const url = `blob:studio-journey/${String(seen.downloads.size + 1)}`
    seen.downloads.set(url, blob)
    return url
  }
  URL.revokeObjectURL = () => undefined
})

afterEach(() => {
  cleanup()
  workspace?.dispose()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  seen.outcomes.length = 0
  seen.shown.length = 0
  seen.downloads.clear()
})

type User = ReturnType<typeof userEvent.setup>
type Framework = 'React' | 'Angular'

/** The Studio where index.html puts it, in a `#root`, under index.html's language and title, which the page audit reads. */
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

/** Which framework drew the builder: the one question no role answers, since both render the same roles and names (0012). */
const drawnBy = (): Framework => (document.querySelector('report-builder') === null ? 'React' : 'Angular')

async function show(user: User, framework: Framework): Promise<void> {
  await user.click(screen.getByRole('radio', { name: framework }))
  await waitFor(() => {
    expect(screen.queryByText('Starting the Angular builder…')).toBeNull()
    expect(drawnBy()).toBe(framework)
  })
  await screen.findByRole('region', { name: 'Report editor' })
}

/**
 * The status says `status`, and the paper and Download PDF hold one PDF
 * the pipeline printed for starter `id` in `mode`: the same bytes in both,
 * and a PDF by its header. A preview of the starter before, or a download
 * of other bytes than those shown, fails here.
 */
async function printed(id: string, mode: 'preview' | 'final', status: string): Promise<void> {
  await screen.findByText(status)
  const pdfs = seen.outcomes.flatMap((each) => (each.id === id && each.mode === mode && each.outcome.kind === 'printed' ? [each.outcome.pdf] : []))
  await waitFor(() => expect(pdfs).toContain(seen.shown.at(-1)))
  const shown = seen.shown.at(-1) ?? new Uint8Array()
  expect(new TextDecoder().decode(shown.subarray(0, 5))).toBe('%PDF-')
  const link = screen.getByRole('link', { name: 'Download PDF' })
  expect(link.getAttribute('download')).toBe(`${id}.pdf`)
  const download = seen.downloads.get(link.getAttribute('href') ?? '')
  expect(new Uint8Array((await download?.arrayBuffer()) ?? new ArrayBuffer(0))).toEqual(shown)
}

/**
 * Rules about the page as a whole, which `violations()` -- axe over the
 * body -- never reaches: the document's language and title, a way past
 * the bar, everything inside a landmark, each landmark told apart, one
 * main landmark and a first-level heading. formancy.ai's conformance
 * package excuses a form fragment from the last five because "the real
 * pages" are held to them (its ACCESSIBILITY_EXCLUSIONS); the Studio is a
 * page.
 */
const PAGE_RULES = ['document-title', 'html-has-lang', 'html-lang-valid', 'bypass', 'region', 'landmark-unique', 'landmark-one-main', 'page-has-heading-one']

/** Page rules axe cannot decide in jsdom, each with why. `page()` reads the same fact by role instead. */
const UNDECIDED_IN_JSDOM: Readonly<Record<string, string>> = {
  'landmark-one-main': 'axe asks document.elementFromPoint whether a modal is open, jsdom has no such function, and axe reports an error and decides nothing.',
  'page-has-heading-one': 'the same call, the same error.',
}

/** What the page rules find, and any of them that checked nothing: a rule that applied to nothing passed vacuously. */
async function page(): Promise<string[]> {
  const results = await axe.run(document, { runOnly: { type: 'rule', values: PAGE_RULES } })
  const decided = new Set([...results.passes, ...results.violations].map((rule) => rule.id))
  const mains = screen.queryAllByRole('main').length
  return [
    ...results.violations.map((rule) => `${rule.id}: ${rule.nodes.map((node) => node.html.slice(0, 120)).join(' | ')}`),
    ...PAGE_RULES.filter((id) => !decided.has(id) && !(id in UNDECIDED_IN_JSDOM)).map((id) => `${id}: checked nothing`),
    ...(mains === 1 ? [] : [`landmark-one-main, by role: ${String(mains)} main landmarks`]),
    ...(screen.queryAllByRole('heading', { level: 1 }).length > 0 ? [] : ['page-has-heading-one, by role: no heading of level 1']),
  ]
}

/**
 * The roles a person operates, or moves through as one. axe does not notice
 * a control whose name computes to nothing; computing every name, as
 * formancy.ai-data's suites do, does -- here by Testing Library's own
 * computation, the one every query by name in this suite goes through.
 */
const CONTROLS = ['button', 'checkbox', 'combobox', 'link', 'listbox', 'menuitem', 'option', 'radio', 'searchbox', 'slider', 'spinbutton', 'switch', 'tab', 'textbox', 'tree', 'treeitem'] as const

function unnamed(): string[] {
  const empty = (name: string): boolean => name.trim() === ''
  return CONTROLS.flatMap((role) => screen.queryAllByRole(role, { name: empty })).map((element) => `unnamed: ${element.outerHTML.slice(0, 120)}`)
}

/**
 * The journey: each starter the picker offers, picked in the builder the
 * last one ended in, previewed, shown in the other builder, and rendered
 * final; then the quotation with its table's last column made 8 mm wide,
 * too narrow for the words in it, the renderer's refusal shown in both
 * builders, and its button followed to the table. `record` is called at
 * each state.
 */
async function walk(user: User, opened: Workspace, record: (state: string) => Promise<void>): Promise<void> {
  const picker = screen.getByRole('combobox', { name: 'Starter' })
  let framework: Framework = 'React'
  for (const option of within(picker).getAllByRole('option') as HTMLOptionElement[]) {
    const { value: id, text: name } = option
    await user.selectOptions(picker, option)
    await printed(id, 'preview', 'Preview: printed.')
    await record(`${name}, preview, in ${framework}`)
    framework = framework === 'React' ? 'Angular' : 'React'
    await show(user, framework)
    await record(`${name}, preview, in ${framework}`)
    await user.click(screen.getByRole('checkbox', { name: 'Final' }))
    await printed(id, 'final', 'Final render: printed.')
    await record(`${name}, final, in ${framework}`)
  }

  await user.selectOptions(picker, 'Quotation')
  await printed('quotation', 'preview', 'Preview: printed.')
  const { editor: model, session } = opened.open('quotation')
  const table = session.document().regions.body.find((component) => component.kind === 'table')
  const column = table !== undefined && 'columns' in table ? table.columns.at(-1) : undefined
  if (table === undefined || column === undefined) throw new Error('the quotation has no table with columns')
  // A row's label read from the outline the model gives, not through the
  // Studio's own lookup (preview/problems.ts), which names the button.
  const rows = model.state().outline.flatMap((region) => region.nodes)
  const find = (nodes: readonly OutlineNode[], wanted: string, inColumn: string | undefined): string | undefined =>
    nodes.map((node) => (node.id === wanted && node.column === inColumn ? node.label : find(node.children, wanted, inColumn))).find((found) => found !== undefined)
  const label = (wanted: string, inColumn?: string): string => find(rows, wanted, inColumn) ?? `(no row for ${wanted})`
  // Narrower than the header's one word: the renderer refuses rather than
  // breaking it (0011), naming the table.
  await user.click(within(editor()).getByRole('treeitem', { name: label(table.id, column.id) }))
  const width = within(editor()).getByRole('spinbutton', { name: 'Width (mm)' })
  await user.clear(width)
  await user.type(width, '8')
  await user.tab()
  await screen.findByText('Preview: not drawn by the renderer.')
  const [refusal, ...more] = within(screen.getByRole('list', { name: 'Why the preview was not printed' })).getAllByRole('listitem')
  expect(more).toEqual([])
  expect(refusal?.textContent).toMatch(/^render content-too-large /)
  await record(`Quotation, refused, in ${framework}`)
  framework = framework === 'React' ? 'Angular' : 'React'
  await show(user, framework)
  await record(`Quotation, refused, in ${framework}`)

  // Enter on the refusal's button, as a keyboard presses it: the table is
  // selected, and the keyboard is on its outline row, in the builder shown.
  const select = within(screen.getByRole('list', { name: 'Why the preview was not printed' })).getByRole('button', { name: `Select ${label(table.id)}` })
  select.focus()
  await user.keyboard('{Enter}')
  await waitFor(() => expect(document.activeElement).toBe(within(editor()).getByRole('treeitem', { name: label(table.id), selected: true })))
  expect(model.state().selection).toEqual({ id: table.id })
  await record(`Quotation, the refusal's table selected, in ${framework}`)
}

/**
 * Every request the page makes by script -- `fetch`, `XMLHttpRequest`, a
 * WebSocket -- recorded, and refused as a browser refuses a blocked one, so
 * that nothing leaves the test.
 */
function requests(): string[] {
  const asked: string[] = []
  const ask = (url: string | URL): void => {
    asked.push(new URL(url, location.href).href)
  }
  vi.stubGlobal('fetch', (input: RequestInfo | URL) => {
    ask(typeof input === 'string' || input instanceof URL ? input : input.url)
    return Promise.reject(new TypeError('Failed to fetch'))
  })
  vi.spyOn(XMLHttpRequest.prototype, 'open').mockImplementation((_method: string, url: string | URL) => {
    ask(url)
    throw new DOMException('refused by the journey', 'NetworkError')
  })
  vi.stubGlobal(
    'WebSocket',
    class {
      constructor(url: string | URL) {
        ask(url)
        throw new DOMException('refused by the journey', 'SecurityError')
      }
    },
  )
  return asked
}

describe('the journey', () => {
  // Every state of the walk, audited where it stands, in both builders: one
  // state that broke the floor -- an unnamed control, two landmarks with one
  // name, content outside every landmark -- fails here with the state it is
  // in. Each preview on the way is a PDF the real pipeline printed for the
  // starter shown, and the download is those very bytes; and a refusal the
  // person caused is listed, and its button takes them to what it names.
  test('every state passes axe and names every control, and every preview is a PDF', async () => {
    const { workspace: opened, user } = mount()
    const findings: Record<string, string[]> = {}
    await walk(user, opened, async (state) => {
      findings[state] = [...(await violations()).map((rule) => `${rule.id}: ${rule.nodes.join(' | ')}`), ...(await page()), ...unnamed()]
    })
    expect(Object.keys(findings)).toHaveLength(studioStarters(starters).length * 3 + 3)
    expect(findings).toEqual(Object.fromEntries(Object.keys(findings).map((state) => [state, []])))
  })

  // Nothing the Studio's scripts do asks another origin for anything: no
  // image, no telemetry, no renderer reaching out. A starter's photo is the
  // host's bytes by id and digest (0010), and the renderer denies every
  // address (0011); a page that fetched one anyway would be found here. In
  // jsdom the scripts ask nothing at all: the chunks and PDF.js's worker,
  // the page's own assets, are modules here, not requests. What index.html
  // asks for itself -- Google Fonts' stylesheet and the fonts it names, as
  // formancy.ai-data's Studio does -- is not a script's request, jsdom does
  // not load it, and it is not held here.
  test('requests nothing from another origin by script', async () => {
    const asked = requests()
    const { workspace: opened, user } = mount()
    await walk(user, opened, () => Promise.resolve())
    expect(asked.filter((url) => new URL(url).origin !== location.origin)).toEqual([])
  })
})
