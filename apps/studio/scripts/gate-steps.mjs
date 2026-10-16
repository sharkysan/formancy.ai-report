// How the Studio's browser gate moves the page: a starter picked, the
// builder switched, a builder pane shown. Shared by the journey
// (browser-test.mjs) and the walk that compares the two builders
// (gate-parity.mjs), so both reach a state the same way. Elements are found
// by role and accessible name, but for whether a pane is drawn, which the
// accessibility tree cannot say of a pane it does not hold.

/** The builder's region, whichever framework drew it. */
export const editorOf = (page) => page.getByRole('region', { name: 'Report editor', exact: true })

/** Each pane button's pane, as the builders mark it (`data-pane`). */
export const PANES = { Outline: 'outline', 'Design view': 'canvas', Properties: 'properties', Problems: 'diagnostics' }

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
  const drawn = await editor.locator(`[data-pane="${PANES[pane]}"]`).first().isVisible()
  if (!drawn) await editor.getByRole('toolbar', { name: 'Report tools', exact: true }).getByRole('button', { name: pane, exact: true }).click()
  await probe.waitFor()
  return probe
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
