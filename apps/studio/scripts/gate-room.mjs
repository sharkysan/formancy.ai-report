// The room a person makes for the design view (0019): a side pane hidden
// from its header and shown again from the toolbar, and the Preview hidden
// and shown again from the bar. The browser gate runs these at every pass,
// in each builder, because what they promise -- the design view grows, and
// nothing goes past the window's edge -- is layout, which jsdom does not do.

import { describeFocus, measureWidth } from './gate-page.mjs'
import { editorOf, showing } from './gate-steps.mjs'

/** The design view's pane: its width, and whether the sheet in it is wider than it shows. */
async function designView(page) {
  return editorOf(page)
    .locator('[data-report-part="canvas"]')
    .evaluate((canvas) => ({ width: canvas.closest('[data-pane]').getBoundingClientRect().width, cut: canvas.scrollWidth - canvas.clientWidth }))
}

/**
 * The checks, on the starter open now, at 100 %. `preview` is the Preview's
 * region and `settled` waits for it to print, both the journey's.
 */
export async function roomChecks(gate, page, framework, { preview, settled }) {
  const { check } = gate
  const editor = editorOf(page)
  const toggle = page.getByRole('button', { name: 'Preview', exact: true })
  const sideBySide = await page.evaluate(() => {
    const [builder, shown] = [document.querySelector('.studio-builder'), document.querySelector('.studio-preview')]
    return builder !== null && shown !== null && Math.abs(builder.getBoundingClientRect().top - shown.getBoundingClientRect().top) < 1
  })
  // narrow.css puts the Preview beside the builder only where the design
  // view, beside it and both side panes, holds a page at 100 % whole.
  if (sideBySide) {
    const { width, cut } = await designView(page)
    check(`${framework}: beside the Preview, the design view holds the page at 100 % whole`, cut <= 0 ? null : `the sheet is ${String(cut)}px wider than the ${String(Math.round(width))}px design view shows`)
  }

  // The outline hidden from its header: gone, the design view no narrower,
  // the keyboard in it, nothing past either edge; the toolbar brings it back.
  const tree = editor.getByRole('tree', { name: 'Outline', exact: true })
  await showing(editor, 'Outline', tree)
  const before = await designView(page)
  await editor.getByRole('button', { name: 'Hide Outline', exact: true }).click()
  const gone = await tree.waitFor({ state: 'detached', timeout: 5_000 }).then(
    () => null,
    () => 'the outline is still there',
  )
  check(`${framework}: Hide Outline takes the outline away`, gone)
  const after = await designView(page)
  check(`${framework}: and the design view is no narrower for it`, after.width >= before.width ? null : `it was ${String(Math.round(before.width))}px and is ${String(Math.round(after.width))}px`)
  const onView = await editor.locator('[data-report-part="canvas"]').evaluate((canvas) => canvas === document.activeElement)
  check(`${framework}: and the keyboard is in the design view`, onView ? null : `the focus is on ${await describeFocus(page)}`)
  const { overflow, past } = await measureWidth(page)
  check(`${framework}: and nothing is past either edge with it hidden`, overflow <= 0 && past.length === 0 ? null : `${String(overflow)}px of sideways scroll; ${past.join('; ')}`)
  await editor.getByRole('toolbar', { name: 'Report tools', exact: true }).getByRole('button', { name: 'Outline', exact: true }).click()
  const back = await tree.waitFor({ timeout: 5_000 }).then(
    () => null,
    () => 'no outline',
  )
  check(`${framework}: the toolbar's Outline shows it again`, back)

  // The Preview hidden from the bar, and shown again, printing.
  await toggle.click()
  const hidden = await preview.waitFor({ state: 'detached', timeout: 5_000 }).then(
    () => null,
    () => 'the Preview is still there',
  )
  check(`${framework}: the bar's Preview hides the Preview`, hidden)
  const pressed = await toggle.getAttribute('aria-pressed')
  check(`${framework}: and says it is off`, pressed === 'false' ? null : `aria-pressed is ${String(pressed)}`)
  await toggle.click()
  const printed = await settled(page).then(
    () => null,
    (error) => error.message,
  )
  check(`${framework}: and shows it again, printed`, printed)
}
