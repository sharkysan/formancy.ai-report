// What jsdom cannot see in the Studio, measured in the browser it is given.
//
// formancy.ai-data's apps/studio/scripts/browser-test.mjs, applied to this
// Studio as CLAUDE.md asks. The suite in src/ runs in jsdom, which applies no
// CSS, resolves no media queries, lays nothing out, has no canvas for PDF.js
// and no streams for pdfmake, so these claims the Studio makes could only be
// checked by hand:
//
//   - nothing scrolls sideways and nothing is past either edge, in every
//     state, from the side-by-side layout down to a 320px phone;
//   - the keyboard path: from the top of the page the first Tab reaches the
//     skip link, on screen, and Enter on it puts the keyboard on <main>,
//     where the next Tab reaches its first control; and Enter on a refusal's
//     "Select …" button puts the keyboard on its component's outline row,
//     selected, in the React builder and in the Angular one;
//   - axe's default rules and its target-size rule find nothing, and
//     contrast and target size were measured, in each state: every starter
//     in React and in Angular with its preview printed, a refusal by the
//     runtime and one by the renderer;
//   - the preview really prints in the page: the renderer's browser entry
//     and PDF.js, and nothing fetched, nor a connection hinted, outside the
//     built Studio: its faces are its own files (0023), so the page tells
//     no other site who opened it;
//     every page of each starter drawn on white paper with ink on it, its
//     text layer holding every line docs/images/pictures.json says that
//     page prints, and the Download PDF link a PDF whose page draws the
//     drawings pictures.json records there, path by path -- the firm's
//     mark, a code -- and no other; an e-invoice's with Final on, since its
//     preview says on every page that it is no e-invoice (0044);
//   - the framework switch keeps the document and its history: an edit made
//     in React is in the Angular builder with its Undo, undone there the PDF
//     follows, and back in React the Redo is offered; and the first moment
//     the paper says it is no longer busy after the edit, its text layer and
//     the Download PDF -- read back with PDF.js in Node -- both hold the edit
//     (gate-switch.mjs);
//   - in each builder: a pointer drags a palette entry onto an outline row
//     and the component is inserted there, selected and focused; Enter on a
//     palette entry opens the place chooser with the keyboard on its first
//     place, and Escape puts the keyboard back on the entry; Final renders a
//     final PDF and back; and the Preview's Zoom in redraws every page
//     larger, on white, with ink (gate-interactions.mjs);
//   - the Preview stands where the window has room for it (0029): in the
//     builder's middle, in the design view's place, with the outline and
//     the properties beside it, up to the Studio's widest breakpoint, and
//     beside the builder past it; at each pass gate-page.mjs's `passes()`
//     marks a first viewport -- the laptop's, and the screens 0029 names --
//     the window holds the Studio whole as it opens, and the Preview's first
//     page in it, unscrolled; the toolbar's Design view and the bar's
//     Preview swap the two, the window crossing the breakpoint moves it,
//     and the paper resized as an edit prints is redrawn (gate-place.mjs);
//   - the design view's note is never cut by its pane, nor a control of the
//     Preview by a pane that does not scroll to it;
//   - no rule of the page's stylesheets selects an element on the paper but
//     the paper's own, so what is shown is what prints -- and, where the
//     Preview stands in the builder's middle, the workbench's `.wb *`,
//     which turns transitions off and nothing else; nor any rule of the
//     builder's an element of the Preview there, but that one;
//   - every web font the built page asks for had loaded by the end of each
//     pass, and in the pass that refuses them, none had;
//   - in each builder, an image added from the keyboard through the
//     platform's file chooser, placed, printed, undone and redone, an SVG
//     refused and one cleaned, and nothing sent (gate-images.mjs, 0033);
//   - in each builder, the invoice's QR-bill selected from its outline
//     row, an IBAN with a wrong check digit refused on its field, and one
//     SIX's rules take typed: the Swiss QR Code the Download PDF draws,
//     decoded from its pixels with ZXing, pays it, and once undone pays the
//     starter's account again (gate-payment-part.mjs, 0039);
//   - in each builder, the e-invoice's e-invoice selected from its outline
//     row, its buyer's electronic address, a VAT rate and its IBAN typed,
//     each read back from the XML the final Download PDF embeds and held to
//     the page it prints, the IBAN to the EPC QR code its page draws too,
//     decoded from its pixels, and each undone (gate-e-invoice.mjs, 0044);
//   - the page wears the released room: every variable the installed
//     @formancy/themes/room.css sets, and its colour scheme, computed on
//     the page as room.css gives it, at every pass (0034);
//   - the two builders' accessible trees are the same, in every starter and
//     in each state the same steps bring each builder to, as Playwright's
//     snapshot reads them and as Chromium's own tree does, once in each
//     layout the builder is drawn in; and no name in either changes with
//     the page's text-transform (gate-parity.mjs).
//
// Against the page `vite build` writes, served by `vite preview` on the port
// vite.config.ts fixes, which fails rather than wander when the port is
// taken, and under the path the demo on formancy.ai is served at
// (scripts/demo.mjs, 0018). Asserted as numbers and computed results, never
// screenshots.
// Chromium only, the browser installed for this repository's gates: Data's
// gate also runs Firefox and WebKit, and nothing here has.
//
// `pnpm --filter @formancy/report-studio test:browser`, after `pnpm build`
// has built the packages the Studio imports. Each check is printed and kept
// in test-results/browser-chromium.json (gate-results.mjs), with the passes
// planned, which the release report reads (collect.mjs --job browser).

import { existsSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { STARTERS } from '@formancy/report-corpus'
import { chromium } from 'playwright'
import { build, preview } from 'vite'
import { LAUNCH_OPTIONS } from '../../../scripts/browsers.mjs'
import { demoBase, readDemoConfig } from '../../../scripts/demo.mjs'
import { FONT_FILE } from '../../../scripts/web-fonts.mjs'
import { interactions } from './gate-interactions.mjs'
import {
  app,
  audit,
  cutControls,
  describeFocus,
  downloaded,
  drawnPages,
  fontProblem,
  fromTheTop,
  measureWidth,
  paletteProblem,
  passes,
  rulesOnThePaper,
} from './gate-page.mjs'
import { builderParity } from './gate-parity.mjs'
import { placeChecks } from './gate-place.mjs'
import { gateRecorder } from './gate-results.mjs'
import { builder, editorOf, open, previewInView, previewOf, selectRow, setField, settled, WITHIN } from './gate-steps.mjs'
import { frameworkSwitch } from './gate-switch.mjs'

const dist = join(app, 'dist')
const repo = join(app, '..', '..')

/**
 * What each starter's pictured page prints, as report-render-pdf's
 * pictures.test.ts holds it to the PDF the renderer writes in Node: the
 * lines PDF.js read on that page, top to bottom.
 */
const PICTURED = JSON.parse(readFileSync(join(repo, 'docs', 'images', 'pictures.json'), 'utf8'))

/**
 * The starters that are e-invoices: a preview of one is no e-invoice and
 * says so on every page (0027), so its paper is held to its picture, drawn
 * from its final render, with Final on (0044).
 */
const INVOICED = new Set(STARTERS.filter((starter) => starter.report.eInvoice !== undefined).map((starter) => starter.id))

/** What the Preview says once a final render printed. */
const FINAL = /^Final render: printed(, with \d+ warnings?)?\.$/

/**
 * Enter on `pressed`, as a keyboard user presses it; then whether
 * `expected` has the focus once the Studio has drawn what the press asked
 * for, which `focusWhenDrawn` waits up to 30 frames for. In a browser
 * because where focus goes when a framework redraws is the browser's to say.
 */
async function focusAfterEnter(page, pressed, expected) {
  await pressed.focus()
  await page.keyboard.press('Enter')
  const deadline = Date.now() + 2_000
  for (;;) {
    if ((await expected.count()) === 1 && (await expected.evaluate((element) => element === document.activeElement))) return null
    if (Date.now() > deadline) return `the focus is on ${await describeFocus(page)}`
    await page.waitForTimeout(50)
  }
}

/**
 * The design view's note, which says the view is not the PDF, as the page
 * paints it: how much of its width an ancestor that scrolls cuts off. Null
 * when the design view is not shown (one pane at a time, below 48rem).
 */
function noteCut(page) {
  return page.evaluate(() => {
    const note = document.querySelector("[data-report-part='canvas-note']")
    if (note === null || note.getClientRects().length === 0) return null
    const own = note.getBoundingClientRect()
    let [left, right] = [own.left, own.right]
    for (let ancestor = note.parentElement; ancestor !== null && ancestor !== document.documentElement; ancestor = ancestor.parentElement) {
      if (getComputedStyle(ancestor).overflowX === 'visible') continue
      const box = ancestor.getBoundingClientRect()
      ;[left, right] = [Math.max(left, box.left), Math.min(right, box.right)]
    }
    return Math.max(0, Math.round(own.width - Math.max(0, right - left)))
  })
}

/** The layout, the colours and the targets of the state the page is in, said under `state`. */
async function measured(gate, page, state) {
  const { check } = gate
  const width = await measureWidth(page)
  check(`${state}: no sideways scroll`, width.overflow > 0 ? `${String(width.overflow)}px of horizontal overflow` : null)
  check(`${state}: nothing past either edge`, width.past.length === 0 ? null : width.past.join('; '))
  // The pane scrolls the sheet, and the gate's edges count what it paints;
  // a sentence it cuts is read by nobody, so it wraps to the pane instead.
  const cut = await noteCut(page)
  check(`${state}: the design view's note is not cut by its pane`, cut === null || cut === 0 ? null : `${String(cut)}px of it is cut off`)
  // The Preview in a middle pane narrower than its tools scrolls to them
  // (0029); one that clipped them would leave them out of a pointer's reach.
  const controls = await cutControls(page)
  check(
    `${state}: no control of the Preview is cut off by a pane that does not scroll to it`,
    controls.cut.length === 0 ? null : controls.cut.slice(0, 4).join('; '),
  )
  const { width: wide, height: high } = page.viewportSize() ?? { width: 0, height: 0 }
  gate.measure({
    name: `${state}, ${String(wide)} by ${String(high)}: controls of the Preview its pane scrolls to`,
    value: controls.scrolled,
    unit: `of ${String(controls.controls)} controls`,
  })
  await page.evaluate(() => (document.activeElement instanceof HTMLElement ? document.activeElement.blur() : undefined))
  const result = await audit(page)
  gate.axe(result.axe)
  check(`${state}: axe's default rules and target size find nothing`, result.violations.length === 0 ? null : result.violations.join('; '))
  check(`${state}: contrast and target size measured, over something`, result.measured.length === 2 ? null : `only ${result.measured.join(', ') || 'nothing'}`)
  check(
    `${state}: the contrast of every text in view decided, but PDF.js's text over the PDF`,
    result.undecided.length === 0 ? null : `undecided: ${result.undecided.join('; ')}`,
  )
  gate.measure({
    name: `${state}: texts whose contrast axe could not decide because their pane had scrolled them out of view`,
    value: result.hidden,
    unit: 'texts',
  })
}

/** The printed preview of a pictured starter, held to what its picture's page prints. */
async function paperChecks(gate, page, state, picture) {
  const { check } = gate
  const pages = await drawnPages(page, { within: WITHIN })
  const said = await previewOf(page).getByRole('group', { name: 'Pages', exact: true }).innerText()
  check(
    `${state}: PDF.js laid out every page the viewer counts`,
    said.includes(`of ${String(pages.length)}`) ? null : `${String(pages.length)} pages drawn, and the viewer says "${said.replaceAll(/\s+/g, ' ')}"`,
  )
  const poor = pages
    .filter((sheet) => !(sheet.white > 0.5 && sheet.ink > 0.001))
    .map((sheet) => `page ${String(sheet.number)}: ${(sheet.white * 100).toFixed(1)}% white, ${(sheet.ink * 100).toFixed(2)}% ink`)
  check(`${state}: every page drawn on white paper, with ink on it`, pages.length > 0 && poor.length === 0 ? null : poor.join('; ') || 'no page was drawn')
  const lines = pages.find((sheet) => sheet.number === picture.page)?.lines ?? []
  const missing = picture.lines.filter((line) => !lines.includes(line))
  const extra = lines.filter((line) => !picture.lines.includes(line))
  check(
    `${state}: page ${String(picture.page)}'s text layer holds the ${String(picture.lines.length)} lines pictures.json says it prints, and no other`,
    missing.length === 0 && extra.length === 0 ? null : `missing ${JSON.stringify(missing.slice(0, 4))}, extra ${JSON.stringify(extra.slice(0, 4))}`,
  )
  const href = await previewOf(page)
    .getByRole('link', { name: 'Download PDF', exact: true })
    .evaluate((link) => link.href)
  const { head, drawings } = await downloaded(page, href, picture.page)
  check(`${state}: Download PDF is a PDF`, head === '%PDF-' ? null : `it begins ${JSON.stringify(head)}`)
  // A manifest written before it recorded drawings records none, and fails here rather than passing a page it never pictured.
  const recorded = Array.isArray(picture.drawings) ? JSON.stringify(picture.drawings) : 'no drawings at all'
  check(
    `${state}: its page ${String(picture.page)} draws the drawings pictures.json records there, and no other`,
    JSON.stringify(drawings) === recorded ? null : `it draws ${JSON.stringify(drawings)}, and pictures.json records ${recorded}`,
  )
}

/**
 * The paper's own rules reach it, and nothing else's but the workbench's
 * inert `.wb *` where the Preview stands in the builder's middle (0029):
 * checked once per pass, on a page PDF.js has drawn.
 */
async function paperRules(gate, page) {
  const paper = await rulesOnThePaper(page)
  gate.check(
    'the paper: no rule of the page selects anything on it but the paper’s own, and the workbench’s .wb *, which declares transitions alone',
    paper.reached.length === 0 && paper.broken.length === 0
      ? null
      : [...paper.reached, ...paper.broken.map((selector) => `${selector} could not be matched`)].slice(0, 6).join('; '),
  )
  const missing = ['canvas', 'span', 'div'].filter((tag) => !paper.tags.includes(tag))
  gate.check(
    'which matched every rule against a drawn page and its text layer',
    paper.rules > 100 && paper.own > 0 && missing.length === 0
      ? null
      : `${String(paper.rules)} rules, ${String(paper.own)} of the paper's own, and no ${missing.join(', ')} on the paper`,
  )
  gate.check('and read every stylesheet of the page', paper.unread.length === 0 ? null : `could not read ${paper.unread.join(', ')}`)
}

/** From the top of the page: the skip link, on screen, then <main>, then its first control. */
async function keyboard(gate, page) {
  const { check } = gate
  await fromTheTop(page)
  await page.keyboard.press('Tab')
  const skip = page.getByRole('link', { name: 'Skip to the builder', exact: true })
  const shown = await skip.evaluate((link) => {
    const box = link.getBoundingClientRect()
    return { focused: link === document.activeElement, onScreen: box.top >= 0 && box.left >= 0 && box.right <= document.documentElement.clientWidth }
  })
  check('the first Tab reaches the skip link', shown.focused ? null : `focus went to ${await describeFocus(page)} first`)
  check('which is on screen while it has focus', shown.onScreen ? null : 'it stayed off screen')
  const skipAudit = await audit(page, skip)
  check('the skip link, shown: axe finds nothing', skipAudit.violations.length === 0 ? null : skipAudit.violations.join('; '))
  await page.keyboard.press('Enter')
  const main = page.getByRole('main')
  check(
    'Enter on it puts the keyboard on <main>',
    (await main.evaluate((element) => element === document.activeElement)) ? null : `the focus is on ${await describeFocus(page)}`,
  )
  await page.keyboard.press('Tab')
  const into = await main.evaluate((element) => {
    const tabbable = [...element.querySelectorAll('*')].filter((each) => each.tabIndex >= 0 && !each.disabled && each.getClientRects().length > 0)
    return tabbable[0] === document.activeElement
  })
  check('and the next Tab reaches the first control in it', into ? null : `the focus is on ${await describeFocus(page)}`)
}

/**
 * A refusal in the state the page is in, measured, and its "Select …"
 * button pressed with Enter: `edit` brings the refusal, `outcome` is what
 * the status then says, `away` a row selected before the press so the
 * button has somewhere to take the builder, `target` the row it should.
 */
async function refusal(gate, page, { state, edit, outcome, away, button, target }) {
  const editor = editorOf(page)
  await open(page, 'grouped-equipment')
  await settled(page)
  await edit(editor)
  await settled(page, outcome)
  await selectRow(editor, away)
  await measured(gate, page, state)
  // Where the builder shows one pane at a time, the outline was the pane
  // measured; the Preview, brought back into sight, is measured too.
  if (await previewInView(page)) await measured(gate, page, `${state}, the Preview brought into sight`)
  const pressed = previewOf(page).getByRole('list', { name: 'Why the preview was not printed', exact: true }).getByRole('button', { name: button, exact: true })
  const row = editor.getByRole('treeitem', { name: target, exact: true, selected: true })
  gate.check(`${state}: Enter on "${button}" puts the keyboard on its outline row, selected`, await focusAfterEnter(page, pressed, row))
  await editor.getByRole('button', { name: 'Undo', exact: true }).click()
  await settled(page)
}

/**
 * The journey, on the page `pass` opened: the keyboard from the top, every
 * starter printed and measured in each builder, what a person does with a
 * pointer and the keyboard, the framework switch, two refusals and the
 * fonts. Returns the starters the picker offers.
 */
async function journey(gate, page, picker, { refuseFonts }) {
  await keyboard(gate, page)
  const starters = await picker.locator('option').evaluateAll((options) => options.map((option) => ({ id: option.value, label: option.textContent })))
  const unlisted = PICTURED.filter((picture) => !starters.some((starter) => starter.id === picture.starter))
  gate.check(
    'the picker offers every starter pictures.json pictures',
    unlisted.length === 0 ? null : `no ${unlisted.map((picture) => picture.starter).join(', ')}`,
  )
  let ruled = false
  for (const framework of ['React', 'Angular']) {
    await builder(page, framework)
    for (const { id, label: name } of starters) {
      await open(page, id)
      await settled(page)
      const state = `${name}, ${framework}`
      const picture = PICTURED.find((each) => each.starter === id)
      const final = INVOICED.has(id) ? previewOf(page).getByRole('checkbox', { name: 'Final', exact: true }) : null
      if (final !== null) {
        await final.check()
        await settled(page, FINAL)
      }
      if (picture !== undefined) await paperChecks(gate, page, final === null ? state : `${state}, its final render`, picture)
      if (final !== null) {
        await final.uncheck()
        await settled(page)
      }
      if (picture !== undefined && !ruled) {
        await paperRules(gate, page)
        ruled = true
      }
      await measured(gate, page, state)
    }
    await interactions(gate, page, framework)
    if (framework === 'React') await frameworkSwitch(gate, page)
  }
  await refusal(gate, page, {
    state: 'refused by the runtime, Angular',
    edit: async (editor) => {
      await selectRow(editor, 'Book value')
      await setField(editor, 'Show only when', 'row.value > 1000')
    },
    outcome: /^Preview: refused by the runtime, 1 problem\.$/,
    away: 'Tag',
    button: 'Select Book value',
    target: 'Book value',
  })
  await builder(page, 'React')
  await refusal(gate, page, {
    state: 'not drawn by the renderer, React',
    edit: async (editor) => {
      // A word wider than its column: the renderer refuses it rather than break it or let it run over.
      await selectRow(editor, 'Tag')
      await setField(editor, 'Heading', 'Inventarnummernkennzeichnung')
    },
    outcome: /^Preview: not drawn by the renderer\.$/,
    away: 'Description',
    button: 'Select Table',
    target: 'Table',
  })
  gate.check(
    refuseFonts ? 'with the web fonts refused, none loaded' : 'every web font the page asks for loaded',
    await fontProblem(page, { dist, refused: refuseFonts }),
  )
  return starters
}

/**
 * One pass at one viewport: where the Preview stands as the Studio opens,
 * in each builder (gate-place.mjs); then, but in a `light` pass, the whole
 * journey; what the page asked of any other origin; and, where `parity`
 * marks it, the two builders compared (gate-parity.mjs).
 */
async function pass(gate, browser, url, entry) {
  const { label, width, height, refuseFonts = false, parity = false, light = false } = entry
  gate.pass({ label, width, height })
  const page = await browser.newPage({ viewport: { width, height } })
  page.setDefaultTimeout(WITHIN)
  // Every request outside the built Studio, its faces included: they are
  // its own files (0023), so a font from anywhere else is named here too.
  const elsewhere = new Set()
  page.on('request', (request) => {
    const address = request.url()
    if (!address.startsWith(url) && !/^(blob|data):/.test(address)) elsewhere.add(address)
  })
  // The fallback stack's pass: every font file refused, wherever it is from.
  if (refuseFonts) await page.route(FONT_FILE, (route) => route.abort())
  let starters = []
  try {
    await page.goto(url, { waitUntil: 'load' })
    const picker = page.getByRole('combobox', { name: 'Starter', exact: true })
    await picker.waitFor()
    gate.check('the page wears the released room, every variable and the colour scheme of the installed room.css as it has them', await paletteProblem(page))
    for (const framework of ['React', 'Angular']) {
      await builder(page, framework)
      await placeChecks(gate, page, framework, entry, { measured })
    }
    if (!light) starters = await journey(gate, page, picker, { refuseFonts })
    // A preconnect or dns-prefetch hint opens a connection with no request
    // the listener would hear, and a connection gives the host the address
    // all the same (formancy.ai 0154): read from the page as it ends.
    const hinted = await page.evaluate(() =>
      [...document.querySelectorAll('link')]
        .filter((link) => link.relList.contains('preconnect') || link.relList.contains('dns-prefetch'))
        .map((link) => link.href),
    )
    for (const address of hinted) if (!address.startsWith(url)) elsewhere.add(`${address} (a hint)`)
    gate.check(
      'the page fetched nothing and hinted no connection outside the built Studio, its faces included: the PDFs were printed in it',
      elsewhere.size === 0 ? null : [...elsewhere].slice(0, 4).join(', '),
    )
  } finally {
    await page.close()
  }
  if (parity) {
    gate.check('the picker offers starters for the two builders to be compared in', starters.length > 0 ? null : 'it offers none, so no tree would be compared')
    await builderParity(gate, browser, url, { starters, viewport: { width, height }, refuseFonts })
  }
}

async function main() {
  const gate = gateRecorder('apps/studio', { browser: 'chromium', playwright: createRequire(import.meta.url)('playwright/package.json').version })
  let server
  let browser
  try {
    const list = passes()
    gate.plan(list)
    await build({ root: app, logLevel: 'warn' })
    if (!existsSync(join(dist, 'index.html'))) throw new Error('vite build wrote no apps/studio/dist/index.html')
    // Under the path formancy.ai serves the demo at (0018), so every check
    // below is of the build as the demo is served: a file asked for by an
    // absolute path is outside it, and the check on what the page fetched
    // names it.
    server = await preview({ root: app, base: demoBase(readDemoConfig()), logLevel: 'warn' })
    const [url] = server.resolvedUrls?.local ?? []
    if (url === undefined) throw new Error('vite preview gave no local address')
    console.log(`the built Studio, served by vite preview at ${url}`)
    const options = { ...LAUNCH_OPTIONS }
    browser = await chromium.launch(options)
    gate.launched(browser, options)
    for (const each of list) await pass(gate, browser, url, each)
    const failures = gate.failures()
    if (failures.length > 0) throw new Error(`${String(failures.length)} browser check(s) failed:\n  ${failures.join('\n  ')}`)
    console.log(
      `\nbrowser checks passed: the Studio's whole journey in ${String(list.filter((each) => each.light !== true).length)} of ${String(list.length)} passes and the Preview's place in all of them, from ${String(Math.min(...list.map((each) => each.width)))} to ${String(Math.max(...list.map((each) => each.width)))}px wide, for the layout, focus, colour and printing facts jsdom cannot represent`,
    )
  } catch (error) {
    gate.error(error)
    throw error
  } finally {
    await browser?.close()
    await server?.close()
    gate.write(app)
  }
}

try {
  await main()
} catch (error) {
  console.error(`\nthe Studio's browser gate failed: ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
}
