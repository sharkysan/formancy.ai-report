// The room a person makes for the builder's middle pane (0019): a side pane
// hidden from its header and shown again from the toolbar, and the Preview
// hidden and shown again from the bar. The middle pane is the design view,
// or the Preview standing in its place where there is no room beside the
// builder (0029), and these hold of whichever it is. The browser gate runs
// them at every pass of the journey, in each builder, because what they
// promise -- the middle pane grows, and nothing goes past the window's
// edge -- is layout, which jsdom does not do.

import { describeFocus, measureWidth } from './gate-page.mjs'
import { designViewOf, editorOf, previewInView, previewOf, settled, showing, standing, toggleOf } from './gate-steps.mjs'

/** The middle pane: its width, and, where it is the design view, how much wider the sheet in it is than it shows. */
async function middlePane(page) {
  return editorOf(page)
    .locator('[data-pane="canvas"]')
    .first()
    .evaluate((pane) => {
      const canvas = pane.querySelector('[data-report-part="canvas"]')
      return { width: pane.getBoundingClientRect().width, cut: canvas === null ? null : canvas.scrollWidth - canvas.clientWidth }
    })
}

/** Whether the keyboard is in the middle pane: on the design view, or on the region the Preview stands in. */
const keyboardInIt = (page) =>
  editorOf(page)
    .locator('[data-pane="canvas"]')
    .first()
    .evaluate((pane) => (pane.matches('[data-report-part="view"]') ? pane : pane.querySelector('[data-report-part="canvas"]')) === document.activeElement)

/** The checks, on the starter open now, at 100 %. */
export async function roomChecks(gate, page, framework) {
  const { check } = gate
  const editor = editorOf(page)
  const toggle = toggleOf(page)
  const where = await standing(page)
  const middle = where === 'in the middle'
  const pane = middle ? 'the Preview, in the design view’s place,' : 'the design view'
  // narrow.css puts the Preview beside the builder only where the design
  // view, beside it and both side panes, holds a page at 100 % whole.
  if (where === 'beside') {
    const { width, cut } = await middlePane(page)
    check(`${framework}: beside the Preview, the design view holds the page at 100 % whole`, cut <= 0 ? null : `the sheet is ${String(cut)}px wider than the ${String(Math.round(width))}px design view shows`)
  }

  // The outline hidden from its header: gone, the middle pane no narrower,
  // the keyboard in it, nothing past either edge; the toolbar brings it back.
  const tree = editor.getByRole('tree', { name: 'Outline', exact: true })
  await showing(editor, 'Outline', tree)
  const before = await middlePane(page)
  await editor.getByRole('button', { name: 'Hide Outline', exact: true }).click()
  const gone = await tree.waitFor({ state: 'detached', timeout: 5_000 }).then(
    () => null,
    () => 'the outline is still there',
  )
  check(`${framework}: Hide Outline takes the outline away`, gone)
  const after = await middlePane(page)
  check(`${framework}: and ${pane} is no narrower for it`, after.width >= before.width ? null : `it was ${String(Math.round(before.width))}px and is ${String(Math.round(after.width))}px`)
  check(`${framework}: and the keyboard is in ${pane}`, (await keyboardInIt(page)) ? null : `the focus is on ${await describeFocus(page)}`)
  const { overflow, past } = await measureWidth(page)
  check(`${framework}: and nothing is past either edge with it hidden`, overflow <= 0 && past.length === 0 ? null : `${String(overflow)}px of sideways scroll; ${past.join('; ')}`)
  await editor.getByRole('toolbar', { name: 'Report tools', exact: true }).getByRole('button', { name: 'Outline', exact: true }).click()
  const back = await tree.waitFor({ timeout: 5_000 }).then(
    () => null,
    () => 'no outline',
  )
  check(`${framework}: the toolbar's Outline shows it again`, back)

  // The Preview hidden from the bar, and shown again, printing. Where the
  // builder shows one pane at a time the outline is the one now, and the
  // bar's first press only brings the Preview back into sight.
  await previewInView(page)
  await toggle.click()
  const hidden = await previewOf(page).waitFor({ state: 'detached', timeout: 5_000 }).then(
    () => null,
    () => 'the Preview is still there',
  )
  check(`${framework}: the bar's Preview hides the Preview`, hidden)
  const pressed = await toggle.getAttribute('aria-pressed')
  check(`${framework}: and says it is off`, pressed === 'false' ? null : `aria-pressed is ${String(pressed)}`)
  if (middle) {
    const taken = await designViewOf(page).waitFor({ timeout: 5_000 }).then(
      () => null,
      () => 'no design view is drawn',
    )
    check(`${framework}: and the design view takes its place back`, taken)
  }
  await toggle.click()
  const printed = await settled(page).then(
    () => null,
    (error) => error.message,
  )
  check(`${framework}: and shows it again, printed`, printed)
  if (middle) check(`${framework}: in the design view's place`, (await editor.getByRole('region', { name: 'Preview', exact: true }).count()) === 1 ? null : 'it stands elsewhere')
}
