// How the Studio's browser gate moves the page: a starter picked, the
// builder switched, a builder pane shown, the Preview brought into sight and
// waited for. Shared by the journey (browser-test.mjs), the checks of where
// the Preview stands (gate-place.mjs), the room made for the design view
// (gate-room.mjs), the framework switch (gate-switch.mjs), what a person
// does in each builder (gate-interactions.mjs), an image added
// (gate-images.mjs) and the walk that compares the two builders
// (gate-parity.mjs), so all of them reach a state the same way. Elements
// are found by role and accessible name, but for whether a pane is drawn,
// which the accessibility tree cannot say of a pane it does not hold.

import { editorText } from '@formancy/report-builder-core'
import { drawnPages } from './gate-page.mjs'

/** How long a state may take to come: Playwright's default, which every wait of the gate runs under. */
export const WITHIN = 30_000

/** The builder's own words, as its English editor says them: the gate finds what it draws by them. */
export const said = editorText('en')

/** Null once `locator` is there, within a few seconds -- zoneless Angular draws a frame or two after the click -- or why not. */
export const present = (locator, what) =>
  locator.waitFor({ timeout: 5_000 }).then(
    () => null,
    () => `no ${what}`,
  )

/** The builder's region, whichever framework drew it. */
export const editorOf = (page) => page.getByRole('region', { name: 'Report editor', exact: true })

/**
 * The Preview's region: beside the builder its own, in the builder's middle
 * the one the builder draws it in, named after it (0029). One region of
 * that name either way, which the Studio's jsdom suite holds.
 */
export const previewOf = (page) => page.getByRole('region', { name: 'Preview', exact: true })

/** The bar's Preview, which shows and hides it. */
export const toggleOf = (page) => page.getByRole('button', { name: 'Preview', exact: true })

/**
 * Where the Preview stands: in the builder's middle, in the region the
 * builder draws it in; beside the builder, its panel's top on the
 * builder's panel's; under it, as the Studio stacked it before 0029; or
 * nowhere in sight. The tops are read from the DOM, the accessibility tree
 * having no geometry.
 */
export async function standing(page) {
  if ((await editorOf(page).getByRole('region', { name: 'Preview', exact: true }).count()) === 1) return 'in the middle'
  if ((await previewOf(page).count()) === 0) return 'nowhere in sight'
  const level = await previewOf(page).evaluate((region) => {
    const panel = document.querySelector('.studio-builder')
    return panel !== null && Math.abs(region.getBoundingClientRect().top - panel.getBoundingClientRect().top) < 1
  })
  return level ? 'beside' : 'under the builder'
}

/** The design view, by the name that says it is not the PDF. */
export const designViewOf = (page) => editorOf(page).getByRole('region', { name: said('canvas.label'), exact: true })

/**
 * Each pane button's pane, as what the builders draw when it is shown: the
 * pane's hook (`data-pane`), and for the design view the view itself, since
 * the host's view standing in its place carries the design view's pane
 * hook too (0029).
 */
export const PANES = { Outline: '[data-pane="outline"]', 'Design view': '[data-report-part="canvas"]', Properties: '[data-pane="properties"]', Problems: '[data-pane="diagnostics"]' }

/**
 * The builder's pane that holds `probe`, shown: below report-builder.css's
 * one-pane tier only the pane chosen from the toolbar is drawn, and the
 * others are not in the accessibility tree at all. Whether the pane is
 * drawn is read from the DOM, by the hook the stylesheet hides it by,
 * because the probe may not be drawn yet when it is: zoneless Angular
 * draws a selection's fields a frame after the click, and a pane button
 * pressed in that frame moved the keyboard into the first field while the
 * next step typed into another.
 */
export async function showing(editor, pane, probe) {
  const drawn = await editor.locator(PANES[pane]).first().isVisible()
  if (!drawn) await editor.getByRole('toolbar', { name: 'Report tools', exact: true }).getByRole('button', { name: pane, exact: true }).click()
  await probe.waitFor()
  return probe
}

/**
 * The Preview in sight, as a person brings it there: the bar's Preview
 * pressed when the bar says it is off, or when it stands in the builder's
 * middle while another pane is the one a narrow builder shows -- the press
 * brings it into sight (studio.tsx's toggle); nothing pressed when it is in
 * sight already. Read from the bar's pressed state and from the DOM, by the
 * builder's hook for the host's view, because a pane report-builder.css
 * hides is in no accessibility tree; and from what is drawn now, not what
 * is about to be: every step before this one waited for what it drew.
 * Returns whether it pressed.
 */
export async function previewInView(page) {
  const off = (await toggleOf(page).getAttribute('aria-pressed')) !== 'true'
  const hidden = await page.evaluate(() => {
    const view = document.querySelector('[data-report-part="editor"] [data-report-part="view"]')
    return view !== null && !view.checkVisibility()
  })
  if (off || hidden) await toggleOf(page).click()
  await previewOf(page).waitFor()
  return off || hidden
}

/** What the Preview says once it has printed. */
export const PRINTED = /^Preview: printed(, with \d+ warnings?)?\.$/

/**
 * Until the Preview says `outcome` with nothing newer on its way, and, once
 * printed, PDF.js has the PDF and has laid out its pages: as it stands,
 * brought into sight by nothing.
 */
export async function printed(page, outcome = PRINTED) {
  await previewOf(page).getByRole('status').filter({ hasText: outcome }).waitFor()
  if (!outcome.test('Preview: printed.')) return
  await page.waitForFunction(
    () => {
      const paper = document.querySelector('.paper')
      return paper !== null && paper.getAttribute('aria-busy') === 'false' && paper.querySelectorAll('.paper-page canvas').length > 0
    },
    undefined,
    { timeout: WITHIN },
  )
}

/** The same, the Preview brought into sight first: what every step that reads the Preview waits for. */
export async function settled(page, outcome = PRINTED) {
  await previewInView(page)
  await printed(page, outcome)
}

/** Until a line of the PDF's text layer, in sight, is `line`: what an edit's render is waited for by. */
export async function untilLine(page, line) {
  await previewInView(page)
  const deadline = Date.now() + WITHIN
  for (;;) {
    const pages = await drawnPages(page, { within: 0 })
    if (pages.some((sheet) => sheet.lines.includes(line))) return
    if (Date.now() > deadline) throw new Error(`no line of the PDF became "${line}" in ${String(WITHIN)} ms`)
    await page.waitForTimeout(100)
  }
}

/** The outline row named `name`, shown and selected with a click. */
export async function selectRow(editor, name) {
  await (await showing(editor, 'Outline', editor.getByRole('tree', { name: 'Outline', exact: true }))).getByRole('treeitem', { name, exact: true }).click()
}

/** The selected component's field named `name`, given `value` and left with Tab, as a person commits it; until the editor says it changed. */
export async function setField(editor, name, value) {
  const field = await showing(editor, 'Properties', editor.getByRole('textbox', { name, exact: true }))
  await field.fill(value)
  await field.press('Tab')
  await editor.getByRole('status').filter({ hasText: `Changed ${name}.` }).waitFor()
}

/** The starter whose corpus id is `id`, opened from the picker by its option's value. */
export async function open(page, id) {
  await page.getByRole('combobox', { name: 'Starter', exact: true }).selectOption(id)
}

/** The builder the switch names, once drawn: Angular's is bootstrapped after the click, and says so until it has started. */
export async function builder(page, name) {
  await page.getByRole('group', { name: 'Builder', exact: true }).getByRole('radio', { name, exact: true }).check()
  await page.getByText('Starting the Angular builder…').waitFor({ state: 'hidden' })
  await editorOf(page).waitFor()
}
