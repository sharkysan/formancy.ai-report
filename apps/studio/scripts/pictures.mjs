// The Studio's README pictures: the studio scenes of
// scripts/pictures/scenes.json, taken -- or, with --check, walked and their
// text compared -- by scripts/pictures/session.mjs. Its header says the
// arguments; the camera's says what it reads from the DOM and why.
// formancy.ai-data's apps/studio/scripts/pictures.mjs, for a page with no
// server: the built Studio, answered from dist/ on an origin nothing
// resolves, over the corpus's starters and their synthetic data, which the
// build carries.
//
// One session: the acts run in their table's order, each starting where the
// last one left the Studio, as a person would go: the quotation in React; an
// edit in React and the switch to Angular; back in React, the equipment
// register with a column's value changed; that undone and a condition the
// runtime refuses, followed to its component by the Preview's button; and,
// on a page opened afresh at a phone's width, the narrow layout. Elements are
// found by role and accessible name; the starter is chosen by its option's
// value, the corpus's id.
//
// `pnpm --filter @formancy/report-studio pictures`, after its build; the
// root's `node scripts/pictures.mjs` runs it and then writes README.md.

import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { pictures, untilSnapshot } from '../../../scripts/pictures/session.mjs'

const app = join(dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(import.meta.url)
const ORIGIN = 'http://studio.invalid'

/** How long a step may take to answer: Playwright's default, which the Studio's gate's waits run under too. */
const WITHIN = 30_000

/** The summary line of the quotation, and what the edit in React makes of it. */
const PAYMENT = 'Zahlbar innert 30 Tagen netto.'
const EDITED = 'Zahlbar innert 10 Tagen netto.'
/** The condition Book value is given: a column's condition has no row to read. */
const CONDITION = 'row.value > 1000'

/**
 * The Studio's three panels, each a whole element: the bar, the builder and
 * the Preview -- beside the builder past narrow.css's widest breakpoint,
 * where the wide scenes are taken, and in the builder's middle under it.
 */
function panels(page) {
  return {
    Bar: page.getByRole('banner'),
    Builder: page.getByRole('region', { name: 'Report editor', exact: true }),
    Preview: page.getByRole('region', { name: 'Preview', exact: true }),
  }
}

/**
 * The Preview's snapshot once it says it printed and every page it counts
 * holds its text: PDF.js fills a page's text layer after the status, a page
 * at a time. In the shape `untilSnapshot` asks of a pattern.
 */
const PRINTED = {
  test(said) {
    if (!/^ *- status: "Preview: printed\."$/m.test(said)) return false
    const pages = [...said.matchAll(/group "Page \d+ of (\d+)": /g)]
    return pages.length > 0 && pages.length === Number(pages[0][1])
  },
}

const untilPrinted = (preview) => untilSnapshot(preview, PRINTED, { within: WITHIN, what: 'the printed preview, with every page’s text' })

/** The starter whose corpus id is `id`, opened from the picker. */
async function open(page, id) {
  await page.getByRole('combobox', { name: 'Starter', exact: true }).selectOption(id)
}

/** The builder the switch names, once it is drawn: Angular's is bootstrapped after the click and says so until it has started. */
async function builder(page, name) {
  await page.getByRole('group', { name: 'Builder', exact: true }).getByRole('radio', { name, exact: true }).check()
  await page.getByText('Starting the Angular builder…').waitFor({ state: 'hidden' })
  await panels(page).Builder.waitFor()
}

const acts = {
  'studio-react': async (page) => {
    await open(page, 'quotation')
    const parts = panels(page)
    await untilPrinted(parts.Preview)
    return { parts }
  },

  'studio-angular': async (page) => {
    const parts = panels(page)
    await parts.Builder.getByRole('treeitem', { name: PAYMENT, exact: true }).click()
    const text = parts.Builder.getByRole('textbox', { name: 'Text', exact: true })
    await text.fill(EDITED)
    await text.press('Tab')
    await untilSnapshot(parts.Preview, new RegExp(EDITED.replaceAll('.', '\\.')), { within: WITHIN, what: 'the edited line in the PDF' })
    await builder(page, 'Angular')
    // The caption: Angular's builder shows the edit selected, and offers its Undo.
    await parts.Builder.getByRole('treeitem', { name: EDITED, exact: true, selected: true }).waitFor()
    await parts.Builder.getByRole('button', { name: 'Undo', exact: true, disabled: false }).waitFor()
    await untilPrinted(parts.Preview)
    return { parts }
  },

  'studio-diagnostic': async (page) => {
    await builder(page, 'React')
    await open(page, 'grouped-equipment')
    const { Builder, Preview } = panels(page)
    await untilPrinted(Preview)
    await Builder.getByRole('treeitem', { name: 'Category', exact: true }).click()
    await Builder.getByRole('combobox', { name: 'Value', exact: true }).selectOption({ label: 'Description' })
    await Builder.getByRole('list', { name: 'Problems', exact: true }).getByRole('listitem').waitFor()
    // The caption: a warning renders as written, so the register still prints.
    await untilPrinted(Preview)
    return { parts: { Builder, Preview } }
  },

  'studio-refusal': async (page) => {
    const { Builder, Preview } = panels(page)
    // The column's value put back, so the one problem is the condition.
    await Builder.getByRole('button', { name: 'Undo', exact: true }).click()
    await Builder.getByRole('list', { name: 'Problems', exact: true }).getByRole('listitem').waitFor({ state: 'detached' })
    await Builder.getByRole('treeitem', { name: 'Book value', exact: true }).click()
    const condition = Builder.getByRole('textbox', { name: 'Show only when', exact: true })
    await condition.fill(CONDITION)
    await condition.press('Tab')
    // Somewhere else selected, so the button has somewhere to take the builder.
    await Builder.getByRole('treeitem', { name: 'Tag', exact: true }).click()
    const select = Preview.getByRole('list', { name: 'Why the preview was not printed', exact: true }).getByRole('button', { name: 'Select Book value', exact: true })
    await select.focus()
    await page.keyboard.press('Enter')
    // The caption: the keyboard is on the column's outline row, which is selected.
    const row = Builder.getByRole('treeitem', { name: 'Book value', exact: true, selected: true })
    await row.waitFor()
    await page.waitForFunction(() => document.activeElement?.getAttribute('role') === 'treeitem' && document.activeElement.getAttribute('aria-selected') === 'true', undefined, { timeout: WITHIN })
    if (!(await row.evaluate((element) => element === document.activeElement))) throw new Error('the keyboard is not on the Book value row')
    const value = await Builder.getByRole('textbox', { name: 'Show only when', exact: true }).inputValue()
    if (value !== CONDITION) throw new Error(`the selected column's condition is ${JSON.stringify(value)}, not ${JSON.stringify(CONDITION)}`)
    return { parts: { Builder, Preview }, keepFocus: true }
  },

  'studio-narrow': async (page) => {
    // A page opened afresh: the workspace, and every edit above, go with it.
    await page.reload()
    const { Bar, Builder, Preview } = panels(page)
    await untilPrinted(Preview)
    // At a phone's width the Preview stands in the builder's middle, the
    // pane the builder shows (0029): the builder holds it, and its text.
    return { parts: { Bar, Builder } }
  },
}

const manifest = JSON.parse(readFileSync(join(app, 'package.json'), 'utf8'))
try {
  const { chromium } = await import('playwright')
  await pictures({
    app: 'studio',
    chromium,
    playwright: require('playwright/package.json').version,
    // Past narrow.css's widest breakpoint, which the camera holds it to: the
    // Preview beside the builder, as the captions say, and the design view
    // holding the page whole (0019, 0029).
    width: 2100,
    css: { directory: join(app, 'src'), entry: 'studio.css' },
    themes: manifest.dependencies['@formancy/themes'],
    origin: ORIGIN,
    dist: join(app, 'dist'),
    within: WITHIN,
    data: 'the starters of @formancy/report-corpus and their synthetic data, as the Studio’s build carries them',
    open: async (page) => {
      await page.goto(`${ORIGIN}/`)
      await page.getByRole('combobox', { name: 'Starter', exact: true }).waitFor()
    },
    acts,
  })
} catch (error) {
  console.error(`studio pictures: ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
}
