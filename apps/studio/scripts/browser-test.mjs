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
//     mark, a code -- and no other;
//   - the framework switch keeps the document and its history: an edit made
//     in React is in the Angular builder with its Undo, undone there the PDF
//     follows, and back in React the Redo is offered; and the first moment
//     the paper says it is no longer busy after the edit, its text layer and
//     the Download PDF -- read back with PDF.js in Node -- both hold the edit;
//   - in each builder: a pointer drags a palette entry onto an outline row
//     and the component is inserted there, selected and focused; Enter on a
//     palette entry opens the place chooser with the keyboard on its first
//     place, and Escape puts the keyboard back on the entry; Final renders a
//     final PDF and back; and the Preview's Zoom in redraws every page
//     larger, on white, with ink;
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
import { readPdf } from '@formancy/report-corpus'
import { chromium } from 'playwright'
import { build, preview } from 'vite'
import { LAUNCH_OPTIONS } from '../../../scripts/browsers.mjs'
import { demoBase, readDemoConfig } from '../../../scripts/demo.mjs'
import { FONT_FILE } from '../../../scripts/web-fonts.mjs'
import { app, audit, cutControls, describeFocus, downloaded, drawnPages, fontProblem, fromTheTop, measureWidth, paletteProblem, passes, rulesOnThePaper } from './gate-page.mjs'
import { builderParity } from './gate-parity.mjs'
import { placeChecks } from './gate-place.mjs'
import { imageChecks } from './gate-images.mjs'
import { gateRecorder } from './gate-results.mjs'
import { roomChecks } from './gate-room.mjs'
import { builder, editorOf, open, previewInView, previewOf, selectRow, setField, settled, showing, untilLine, WITHIN } from './gate-steps.mjs'

const dist = join(app, 'dist')
const repo = join(app, '..', '..')

/**
 * What each starter's pictured page prints, as report-render-pdf's
 * pictures.test.ts holds it to the PDF the renderer writes in Node: the
 * lines PDF.js read on that page, top to bottom.
 */
const PICTURED = JSON.parse(readFileSync(join(repo, 'docs', 'images', 'pictures.json'), 'utf8'))

/** The quotation's payment line, and what the switch check makes of it. */
const PAYMENT = 'Zahlbar innert 30 Tagen netto.'
const EDITED = 'Zahlbar innert 10 Tagen netto.'

/** Null once `locator` is there, within a few seconds -- zoneless Angular draws a frame or two after the click -- or why not. */
const present = (locator, what) =>
  locator.waitFor({ timeout: 5_000 }).then(
    () => null,
    () => `no ${what}`,
  )

/**
 * A pointer drag from `source` to `position` on `target`, as a person makes
 * one. Both are in view before the press, so nothing scrolls between the
 * press and the release: the source at the top of the window, and the
 * target, below it, scrolled into view only if it is not then. Scrolled
 * into view one after the other, a target past the fold took the source
 * above the window's top and the press missed it -- on CI, at 320 pixels
 * with the web fonts refused, where Linux's fallback is wider. Two ends
 * that cannot be in view at once are said, with where they are. Then the
 * pointer moves in steps, as a hand does. Chromium starts an HTML drag
 * (Angular's builder, 0012) only once the pointer has moved some way with
 * the button held, and in the headless shell on Linux one jump from the
 * press to the target never started it: locator.dragTo passed on Windows
 * and inserted nothing on CI. Returns where the press and the release were,
 * and what was under each, for a drag that placed nothing to say so.
 */
async function drag(page, source, target, position) {
  await source.evaluate((element) => element.scrollIntoView({ block: 'start', inline: 'nearest' }))
  await target.scrollIntoViewIfNeeded()
  const from = await source.boundingBox()
  const to = await target.boundingBox()
  if (from === null || to === null) throw new Error('a drag needs both ends drawn')
  const { width, height } = page.viewportSize() ?? { width: 0, height: 0 }
  // A pixel either way for a layout in fractions of one: scrolled to the top, a box can stand a third of a pixel above it.
  const seen = (box) => box.x >= -1 && box.y >= -1 && box.x + box.width <= width + 1 && box.y + box.height <= height + 1
  const at = (box) => `${String(Math.round(box.x))},${String(Math.round(box.y))} ${String(Math.round(box.width))}x${String(Math.round(box.height))}`
  if (!seen(from) || !seen(to)) throw new Error(`a drag needs both ends in view at once, and in ${String(width)}x${String(height)} the source is at ${at(from)} and the target at ${at(to)}`)
  const under = (x, y) =>
    page.evaluate(([px, py]) => {
      const element = document.elementFromPoint(px, py)
      return element === null ? 'nothing' : `<${element.tagName.toLowerCase()}> "${(element.getAttribute('aria-label') ?? element.textContent ?? '').trim().slice(0, 40)}"`
    }, [x, y])
  const said = `pressed at ${at(from)} on ${await under(from.x + from.width / 2, from.y + from.height / 2)}, released at ${String(Math.round(to.x + position.x))},${String(Math.round(to.y + position.y))} on ${await under(to.x + position.x, to.y + position.y)}`
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2)
  await page.mouse.down()
  for (let step = 1; step <= 12; step += 1) {
    const share = step / 12
    await page.mouse.move(from.x + from.width / 2 + (to.x + position.x - (from.x + from.width / 2)) * share, from.y + from.height / 2 + (to.y + position.y - (from.y + from.height / 2)) * share)
  }
  await page.mouse.move(to.x + position.x, to.y + position.y)
  await page.mouse.up()
  return said
}

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
  check(`${state}: no control of the Preview is cut off by a pane that does not scroll to it`, controls.cut.length === 0 ? null : controls.cut.slice(0, 4).join('; '))
  const { width: wide, height: high } = page.viewportSize() ?? { width: 0, height: 0 }
  gate.measure({ name: `${state}, ${String(wide)} by ${String(high)}: controls of the Preview its pane scrolls to`, value: controls.scrolled, unit: `of ${String(controls.controls)} controls` })
  await page.evaluate(() => (document.activeElement instanceof HTMLElement ? document.activeElement.blur() : undefined))
  const result = await audit(page)
  gate.axe(result.axe)
  check(`${state}: axe's default rules and target size find nothing`, result.violations.length === 0 ? null : result.violations.join('; '))
  check(`${state}: contrast and target size measured, over something`, result.measured.length === 2 ? null : `only ${result.measured.join(', ') || 'nothing'}`)
  check(`${state}: the contrast of every text in view decided, but PDF.js's text over the PDF`, result.undecided.length === 0 ? null : `undecided: ${result.undecided.join('; ')}`)
  gate.measure({ name: `${state}: texts whose contrast axe could not decide because their pane had scrolled them out of view`, value: result.hidden, unit: 'texts' })
}

/** The printed preview of a pictured starter, held to what its picture's page prints. */
async function paperChecks(gate, page, state, picture) {
  const { check } = gate
  const pages = await drawnPages(page, { within: WITHIN })
  const said = await previewOf(page).getByRole('group', { name: 'Pages', exact: true }).innerText()
  check(`${state}: PDF.js laid out every page the viewer counts`, said.includes(`of ${String(pages.length)}`) ? null : `${String(pages.length)} pages drawn, and the viewer says "${said.replaceAll(/\s+/g, ' ')}"`)
  const poor = pages.filter((sheet) => !(sheet.white > 0.5 && sheet.ink > 0.001)).map((sheet) => `page ${String(sheet.number)}: ${(sheet.white * 100).toFixed(1)}% white, ${(sheet.ink * 100).toFixed(2)}% ink`)
  check(`${state}: every page drawn on white paper, with ink on it`, pages.length > 0 && poor.length === 0 ? null : poor.join('; ') || 'no page was drawn')
  const lines = pages.find((sheet) => sheet.number === picture.page)?.lines ?? []
  const missing = picture.lines.filter((line) => !lines.includes(line))
  const extra = lines.filter((line) => !picture.lines.includes(line))
  check(
    `${state}: page ${String(picture.page)}'s text layer holds the ${String(picture.lines.length)} lines pictures.json says it prints, and no other`,
    missing.length === 0 && extra.length === 0 ? null : `missing ${JSON.stringify(missing.slice(0, 4))}, extra ${JSON.stringify(extra.slice(0, 4))}`,
  )
  const href = await previewOf(page).getByRole('link', { name: 'Download PDF', exact: true }).evaluate((link) => link.href)
  const { head, drawings } = await downloaded(page, href, picture.page)
  check(`${state}: Download PDF is a PDF`, head === '%PDF-' ? null : `it begins ${JSON.stringify(head)}`)
  // A manifest written before it recorded drawings records none, and fails here rather than passing a page it never pictured.
  const recorded = Array.isArray(picture.drawings) ? JSON.stringify(picture.drawings) : 'no drawings at all'
  check(`${state}: its page ${String(picture.page)} draws the drawings pictures.json records there, and no other`, JSON.stringify(drawings) === recorded ? null : `it draws ${JSON.stringify(drawings)}, and pictures.json records ${recorded}`)
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
    paper.reached.length === 0 && paper.broken.length === 0 ? null : [...paper.reached, ...paper.broken.map((selector) => `${selector} could not be matched`)].slice(0, 6).join('; '),
  )
  const missing = ['canvas', 'span', 'div'].filter((tag) => !paper.tags.includes(tag))
  gate.check('which matched every rule against a drawn page and its text layer', paper.rules > 100 && paper.own > 0 && missing.length === 0 ? null : `${String(paper.rules)} rules, ${String(paper.own)} of the paper's own, and no ${missing.join(', ')} on the paper`)
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
  check('Enter on it puts the keyboard on <main>', (await main.evaluate((element) => element === document.activeElement)) ? null : `the focus is on ${await describeFocus(page)}`)
  await page.keyboard.press('Tab')
  const into = await main.evaluate((element) => {
    const tabbable = [...element.querySelectorAll('*')].filter((each) => each.tabIndex >= 0 && !each.disabled && each.getClientRects().length > 0)
    return tabbable[0] === document.activeElement
  })
  check('and the next Tab reaches the first control in it', into ? null : `the focus is on ${await describeFocus(page)}`)
}

/**
 * After an edit: the paper busy while the render is on its way, then the
 * first frame it is not -- what its text layer holds then, and where
 * Download PDF points then -- and the bytes at that address, read in Node.
 * A paper that settled on the earlier PDF, or a link to bytes the paper
 * does not show, is found here.
 */
async function firstSettled(page) {
  await page.waitForFunction(() => document.querySelector('.paper')?.getAttribute('aria-busy') === 'true', undefined, { timeout: WITHIN })
  const handle = await page.waitForFunction(
    () => {
      const paper = document.querySelector('.paper')
      if (paper === null || paper.getAttribute('aria-busy') !== 'false') return null
      const text = [...paper.querySelectorAll('.paper-text span')].map((span) => span.textContent ?? '').join(' ')
      const link = [...document.querySelectorAll('a[download]')].find((anchor) => anchor.textContent.trim() === 'Download PDF')
      return { text: text.replace(/\s+/g, ' '), href: link?.href ?? null }
    },
    undefined,
    { timeout: WITHIN },
  )
  const { text, href } = await handle.jsonValue()
  const bytes = href === null ? [] : await page.evaluate(async (address) => [...new Uint8Array(await (await fetch(address)).arrayBuffer())], href)
  const read = bytes.length === 0 ? { pages: [] } : await readPdf(new Uint8Array(bytes))
  return { text, downloaded: read.pages.flatMap((each) => each.items.map((item) => item.text)).join(' ').replace(/\s+/g, ' ') }
}

/**
 * Plan 21's switch in a real browser: an edit in React, the switch, Undo
 * in Angular, the switch back. The quotation's payment line, which prints,
 * so the PDF is held to the session too.
 */
async function frameworkSwitch(gate, page) {
  const { check } = gate
  const editor = editorOf(page)
  await open(page, 'quotation')
  await settled(page)
  await selectRow(editor, PAYMENT)
  await setField(editor, 'Text', EDITED)
  const first = await firstSettled(page)
  check('the edit: once the paper is no longer busy, its pages show the edit', first.text.includes(EDITED) ? null : `the text layer then held ${first.text.includes(PAYMENT) ? `the line before the edit, "${PAYMENT}"` : 'neither line'}`)
  check('and Download PDF gives that PDF, read back with PDF.js', first.downloaded.includes(EDITED) ? null : `the download ${first.downloaded === '' ? 'was empty' : 'does not hold the edit'}`)
  await untilLine(page, EDITED)
  await builder(page, 'Angular')
  const angular = await editor.evaluate((element) => element.closest('report-builder') !== null)
  check('the switch: the builder shown is Angular’s', angular ? null : 'the region "Report editor" is not inside <report-builder>')
  const outline = () => showing(editor, 'Outline', editor.getByRole('tree', { name: 'Outline', exact: true }))
  check('and the edit made in React is in it', await present((await outline()).getByRole('treeitem', { name: EDITED, exact: true }), `outline row "${EDITED}"`))
  const undo = editor.getByRole('button', { name: 'Undo', exact: true })
  check('and so is its history: Undo is offered', await present(editor.getByRole('button', { name: 'Undo', exact: true, disabled: false }), 'Undo that is not disabled'))
  await undo.click()
  await untilLine(page, PAYMENT).then(
    () => check('undone in Angular, the PDF prints the line as it was', null),
    (error) => check('undone in Angular, the PDF prints the line as it was', error.message),
  )
  await builder(page, 'React')
  const back = await editor.evaluate((element) => element.closest('report-builder') === null)
  check('switched back, the builder shown is React’s', back ? null : 'the region "Report editor" is still inside <report-builder>')
  check('and it shows the line as Angular left it', await present((await outline()).getByRole('treeitem', { name: PAYMENT, exact: true }), `outline row "${PAYMENT}"`))
  check('and offers Redo of the edit made before the switch', await present(editor.getByRole('button', { name: 'Redo', exact: true, disabled: false }), 'Redo that is not disabled'))
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
 * What a person does with a pointer, the place chooser, the Final switch
 * and the Preview's zoom, in the builder `framework` names, on the service
 * inspection; each undone, so the next starts where the starters left off.
 */
async function interactions(gate, page, framework) {
  const { check } = gate
  const editor = editorOf(page)
  await open(page, 'service-inspection')
  await settled(page)

  // A pointer: a palette entry dragged onto the upper half of an outline row
  // lands before it. React binds pointer events, Angular HTML drag and drop
  // (0012), and Playwright drives both as a mouse. The row is the report
  // header's second, in view without scrolling the pane: a pane scrolled
  // between the press and the move is a drag Playwright makes and a person
  // does not.
  const outline = await showing(editor, 'Outline', editor.getByRole('tree', { name: 'Outline', exact: true }))
  const rows = await outline.getByRole('treeitem').count()
  const entry = editor.getByRole('group', { name: 'Insert', exact: true }).getByRole('button', { name: 'Spacer', exact: true })
  const dragged = await drag(page, entry, outline.getByRole('treeitem').nth(1), { x: 24, y: 4 })
  const dropped = outline.getByRole('treeitem', { name: 'Spacer (spacer)', exact: true, selected: true })
  const inserted = await present(dropped, 'selected row "Spacer (spacer)"')
  check(`${framework}: a palette entry a pointer drags onto a row is inserted there, selected`, inserted === null ? null : `${inserted}: ${dragged}`)
  const after = await outline.getByRole('treeitem').count()
  check(`${framework}: and nothing else is`, after === rows + 1 ? null : `${String(rows)} rows before, ${String(after)} after`)
  const onDropped = (await dropped.count()) === 1 && (await dropped.evaluate((element) => element === document.activeElement))
  check(`${framework}: and the keyboard is on its row`, onDropped ? null : `the focus is on ${await describeFocus(page)}`)
  // Undone only when the drop changed something: a failed drop leaves Undo
  // disabled, and clicking it would end the gate on a timeout instead of
  // letting the checks after this one report.
  if (after !== rows) {
    await editor.getByRole('button', { name: 'Undo', exact: true }).click()
    await settled(page)
  }

  // The place chooser, the keyboard's path for every drag (formancy.ai 0046).
  const text = await showing(editor, 'Outline', editor.getByRole('group', { name: 'Insert', exact: true }).getByRole('button', { name: 'Text', exact: true }))
  await text.focus()
  await page.keyboard.press('Enter')
  const chooser = editor.getByRole('dialog', { name: 'Insert Text: choose a place', exact: true })
  check(`${framework}: Enter on a palette entry opens the place chooser`, await present(chooser, 'place chooser'))
  const onFirst = (await chooser.count()) === 1 && (await chooser.evaluate((dialog) => dialog.querySelector('button') === document.activeElement))
  check(`${framework}: with the keyboard on its first place`, onFirst ? null : `the focus is on ${await describeFocus(page)}`)
  await page.keyboard.press('Escape')
  const closed = await chooser.waitFor({ state: 'detached', timeout: 5_000 }).then(
    () => null,
    () => 'the chooser is still open',
  )
  check(`${framework}: Escape closes it`, closed)
  check(`${framework}: and puts the keyboard back on the palette entry`, (await text.evaluate((element) => element === document.activeElement)) ? null : `the focus is on ${await describeFocus(page)}`)

  // Final, and back: the switch reaches the runtime, and the status says which printed.
  await previewInView(page)
  const final = previewOf(page).getByRole('checkbox', { name: 'Final', exact: true })
  await final.check()
  const finalPrinted = await settled(page, /^Final render: printed(, with \d+ warnings?)?\.$/).then(
    () => null,
    (error) => error.message,
  )
  check(`${framework}: Final prints a final render`, finalPrinted)
  await final.uncheck()
  await settled(page)

  // The Preview's zoom: every page drawn again, larger, on white, with ink.
  const firstPage = previewOf(page).getByRole('group', { name: /^Page 1 of \d+$/ })
  const before = await firstPage.evaluate((sheet) => sheet.getBoundingClientRect().width)
  await previewOf(page).getByRole('group', { name: 'Zoom', exact: true }).getByRole('button', { name: 'Zoom in', exact: true }).click()
  await settled(page)
  const zoomed = await drawnPages(page, { within: WITHIN })
  const larger = await firstPage.evaluate((sheet) => sheet.getBoundingClientRect().width)
  const drawnLarger = larger > before && zoomed.length > 0 && zoomed.every((sheet) => sheet.white > 0.5 && sheet.ink > 0.001)
  check(`${framework}: the Preview's Zoom in draws every page larger, on white, with ink`, drawnLarger ? null : `page 1 was ${String(before)}px wide and is ${String(larger)}px, with ${String(zoomed.length)} pages drawn`)
  await previewOf(page).getByRole('button', { name: 'Fit width', exact: true }).click()
  await settled(page)

  // The room made for the middle pane: a pane hidden and shown, the Preview hidden and shown.
  await roomChecks(gate, page, framework)
  await imageChecks(gate, page, framework)
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
  gate.check('the picker offers every starter pictures.json pictures', unlisted.length === 0 ? null : `no ${unlisted.map((picture) => picture.starter).join(', ')}`)
  let ruled = false
  for (const framework of ['React', 'Angular']) {
    await builder(page, framework)
    for (const { id, label: name } of starters) {
      await open(page, id)
      await settled(page)
      const state = `${name}, ${framework}`
      const picture = PICTURED.find((each) => each.starter === id)
      if (picture !== undefined) await paperChecks(gate, page, state, picture)
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
  gate.check(refuseFonts ? 'with the web fonts refused, none loaded' : 'every web font the page asks for loaded', await fontProblem(page, { dist, refused: refuseFonts }))
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
    gate.check("the page wears the released room, every variable and the colour scheme of the installed room.css as it has them", await paletteProblem(page))
    for (const framework of ['React', 'Angular']) {
      await builder(page, framework)
      await placeChecks(gate, page, framework, entry, { measured })
    }
    if (!light) starters = await journey(gate, page, picker, { refuseFonts })
    // A preconnect or dns-prefetch hint opens a connection with no request
    // the listener would hear, and a connection gives the host the address
    // all the same (formancy.ai 0154): read from the page as it ends.
    const hinted = await page.evaluate(() => [...document.querySelectorAll('link')].filter((link) => link.relList.contains('preconnect') || link.relList.contains('dns-prefetch')).map((link) => link.href))
    for (const address of hinted) if (!address.startsWith(url)) elsewhere.add(`${address} (a hint)`)
    gate.check('the page fetched nothing and hinted no connection outside the built Studio, its faces included: the PDFs were printed in it', elsewhere.size === 0 ? null : [...elsewhere].slice(0, 4).join(', '))
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
    console.log(`\nbrowser checks passed: the Studio's whole journey in ${String(list.filter((each) => each.light !== true).length)} of ${String(list.length)} passes and the Preview's place in all of them, from ${String(Math.min(...list.map((each) => each.width)))} to ${String(Math.max(...list.map((each) => each.width)))}px wide, for the layout, focus, colour and printing facts jsdom cannot represent`)
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
