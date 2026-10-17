// The two builders' accessible trees, compared in Chromium: what makes
// "equivalent accessible controls", plan 25.1's middle clause of release
// gate G3, fail when it stops being true. Until this, the shared scenarios
// held the builders to each other only where a scenario finds a control by
// role and name (0012); a control no scenario names, a description, a
// state, or a name the browser computes otherwise than jsdom was held by
// nothing, and the review that found the builders apart found it by reading
// both.
//
// For every starter the picker offers, each builder is opened on a page of
// its own -- so nothing done in one builder is in the editor the other is
// shown -- and walked through the same states by the same steps, every
// element found by role and accessible name (STATES below). At each state
// the editor's region is read twice, and each reading must be the same in
// React and in Angular:
//
//   - Playwright's accessibility snapshot, `locator.ariaSnapshot()`, as the
//     README's pictures record it: each role and name, the states it prints
//     ([disabled], [selected], [level], [invalid], [checked], [expanded]),
//     and the text. It holds no id, and is compared as it is.
//   - Chromium's own tree, read over the DevTools protocol and written by
//     accessible-tree.mjs, whose header says its normalisation: what the
//     snapshot leaves out -- each description, a field's value, whether it
//     is required, what can take focus and what has it -- and each name as
//     Chromium computes it rather than as Playwright does. Chromium puts a
//     stylesheet's text-transform into a name it takes from text on the
//     page and Playwright does not: that is how the React builder's outline
//     groups, named after report-builder.css's capitals, were "BODY" where
//     the Angular builder's were "Body", which Playwright's snapshot alone
//     never showed.
//
// And at each state, in both builders, Chromium's tree is the same with the
// page's text-transform switched off: a name is the builder's words, never
// its host's typography. The count of problems, named after the Studio's
// capitals in both builders alike, was "PROBLEMS" -- equal, and wrong.
//
// Run in the first pass of each layout report-builder.css draws the builder
// in (gate-page.mjs's `passes()`): one pane at a time, where a step shows
// the pane it needs from the toolbar as a person would, and every pane side
// by side. Chromium only, as the gate is: the protocol is Chromium's, and a
// browser added to scripts/browsers.mjs brings this half of the parity
// checks to write for it.

import { decode } from '../../../scripts/pictures/aria-text.mjs'
import { FONT_FILE } from '../../../scripts/web-fonts.mjs'
import { difference, treeLines } from './accessible-tree.mjs'
import { builder, editorOf, open, showing } from './gate-steps.mjs'

const FRAMEWORKS = ['React', 'Angular']

/** How long a reading may take to settle, after the step that brought its state: zoneless Angular draws a frame or two later. */
const SETTLE = 5_000

const tools = (editor) => editor.getByRole('toolbar', { name: 'Report tools', exact: true })
const treeOf = (editor) => editor.getByRole('tree', { name: 'Outline', exact: true })

/**
 * The states, in the order each builder is walked through them, each with
 * the step that brings it from the one before. `walk.placed` is the name of
 * the text the third step places: "New text", or the report's own words for
 * it in a starter written in German.
 */
const STATES = [
  {
    state: 'the starter opened',
    step: async ({ page, url, id, framework, editor }) => {
      await page.goto(url, { waitUntil: 'load' })
      await open(page, id)
      await builder(page, framework)
      await tools(editor).waitFor()
    },
  },
  {
    state: 'the place chooser open from the palette',
    step: async ({ page, editor }) => {
      const text = await showing(editor, 'Outline', editor.getByRole('group', { name: 'Insert', exact: true }).getByRole('button', { name: 'Text', exact: true }))
      await text.focus()
      await page.keyboard.press('Enter')
      await editor.getByRole('dialog', { name: 'Insert Text: choose a place', exact: true }).waitFor()
    },
  },
  {
    state: 'a text placed at the first place, by the keyboard, selected',
    step: async (walk) => {
      await walk.page.keyboard.press('Enter')
      await walk.editor.getByRole('dialog').waitFor({ state: 'detached' })
      const row = treeOf(walk.editor).getByRole('treeitem', { selected: true })
      await row.waitFor()
      walk.placed = decode(await row.ariaSnapshot())[0]?.name
    },
  },
  { state: 'the first row selected with Home', step: ({ page }) => page.keyboard.press('Home') },
  {
    state: 'the placed text selected again with a click',
    step: async ({ editor, placed }) => {
      await (await showing(editor, 'Outline', treeOf(editor))).getByRole('treeitem', { name: placed, exact: true }).click()
      await treeOf(editor).getByRole('treeitem', { name: placed, exact: true, selected: true }).waitFor()
    },
  },
  {
    state: 'Move to… open for it',
    step: async ({ editor, placed }) => {
      await tools(editor).getByRole('button', { name: 'Move to…', exact: true }).click()
      await editor.getByRole('dialog', { name: `Move ${String(placed)}: choose a place`, exact: true }).waitFor()
    },
  },
  {
    state: 'a condition naming no parameter, its problem listed',
    step: async ({ page, editor, placed }) => {
      await page.keyboard.press('Escape')
      await editor.getByRole('dialog').waitFor({ state: 'detached' })
      const condition = await showing(editor, 'Properties', editor.getByRole('textbox', { name: 'Show only when', exact: true }))
      await condition.fill('params.missing')
      await condition.press('Tab')
      await showing(editor, 'Problems', editor.getByRole('list', { name: 'Problems', exact: true }).getByRole('button', { name: `Error: ${String(placed)}`, exact: true }))
    },
  },
  {
    state: 'that problem followed to its component',
    step: ({ editor, placed }) => editor.getByRole('list', { name: 'Problems', exact: true }).getByRole('button', { name: `Error: ${String(placed)}`, exact: true }).click(),
  },
  {
    state: 'the condition undone',
    step: async ({ editor, placed }) => {
      await tools(editor).getByRole('button', { name: 'Undo', exact: true }).click()
      await editor.getByRole('button', { name: `Error: ${String(placed)}`, exact: true }).waitFor({ state: 'detached' })
    },
  },
  {
    state: 'a top margin too large for the page, refused with its error',
    step: async ({ editor }) => {
      await (await showing(editor, 'Properties', editor.getByRole('button', { name: 'Report', exact: true }))).click()
      const margin = editor.getByRole('spinbutton', { name: 'Top margin (mm)', exact: true })
      await margin.fill('400')
      await margin.press('Tab')
      // The live region says why, in the field's words, once the editor has refused it.
      await editor.getByRole('status').filter({ hasText: /^Top margin \(mm\): / }).waitFor()
    },
  },
  ...['Outline', 'Design view', 'Properties', 'Problems'].map((pane) => ({
    state: `the ${pane} pane shown from the toolbar`,
    step: ({ editor }) => tools(editor).getByRole('button', { name: pane, exact: true }).click(),
  })),
]

/** Chromium's own tree of the editor, as accessible-tree.mjs writes it. */
async function chromiumTree(cdp) {
  const { nodes } = await cdp.send('Accessibility.getFullAXTree')
  return treeLines(nodes, { role: 'region', name: 'Report editor' })
}

/** Both readings of the editor as the page stands. */
async function readings(page, cdp) {
  return { snapshot: (await editorOf(page).ariaSnapshot()).split('\n'), chromium: await chromiumTree(cdp) }
}

/** Two frames: what a stylesheet changed is laid out, and Chromium's tree follows it. */
const frames = (page) => page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))))

/**
 * The readings once two in a row, 100 ms apart, are the same, within
 * SETTLE; then Chromium's tree again with every text-transform on the page
 * switched off, which a builder's names must not notice. A state that never
 * settles is compared as it last stood, and a reading that fails throws.
 */
async function settled(page, cdp) {
  const deadline = Date.now() + SETTLE
  let before = await readings(page, cdp)
  for (;;) {
    await page.waitForTimeout(100)
    const now = await readings(page, cdp)
    if (JSON.stringify(now) === JSON.stringify(before) || Date.now() > deadline) {
      const sheet = await page.addStyleTag({ content: '*, *::before, *::after { text-transform: none !important; }' })
      try {
        await frames(page)
        return { ...now, untransformed: await chromiumTree(cdp) }
      } finally {
        await sheet.evaluate((element) => element.remove())
        await frames(page)
      }
    }
    before = now
  }
}

/**
 * One builder walked through STATES on a page of its own, over the starter
 * `id`: the readings at each state it reached, and what stopped it, if
 * anything did.
 */
async function walked(browser, url, { id, framework, viewport, refuseFonts }) {
  const page = await browser.newPage({ viewport })
  page.setDefaultTimeout(30_000)
  if (refuseFonts) await page.route(FONT_FILE, (route) => route.abort())
  const cdp = await page.context().newCDPSession(page)
  const reached = new Map()
  try {
    const walk = { page, url, id, framework, editor: editorOf(page), placed: undefined }
    for (const { state, step } of STATES) {
      try {
        await step(walk)
        reached.set(state, await settled(page, cdp))
      } catch (error) {
        return { reached, stopped: { state, why: error instanceof Error ? error.message.split('\n')[0] : String(error) } }
      }
    }
    return { reached, stopped: null }
  } finally {
    await cdp.detach().catch(() => undefined)
    await page.close()
  }
}

/**
 * The parity checks of one pass, for each of `starters` ({ id, label }, as
 * the picker offers them): each builder walked, then each state compared.
 */
export async function builderParity(gate, browser, url, { starters, viewport, refuseFonts = false }) {
  for (const { id, label } of starters) {
    const walks = {}
    for (const framework of FRAMEWORKS) walks[framework] = await walked(browser, url, { id, framework, viewport, refuseFonts })
    const stopped = FRAMEWORKS.filter((framework) => walks[framework].stopped !== null).map((framework) => `${framework} stopped at "${walks[framework].stopped.state}": ${walks[framework].stopped.why}`)
    gate.check(`parity, ${label}: each builder reached every state of the walk`, stopped.length === 0 ? null : stopped.join('; '))
    for (const { state } of STATES) {
      const [react, angular] = FRAMEWORKS.map((framework) => walks[framework].reached.get(state))
      if (react === undefined || angular === undefined) continue
      const names = { names: FRAMEWORKS }
      gate.check(`parity, ${label}, ${state}: Playwright's snapshot of the editor is the same in React and in Angular`, difference(react.snapshot, angular.snapshot, names))
      // A guard on the guard: two readings with no toolbar in them are two that agreed about nothing.
      const vacuous = FRAMEWORKS.filter((framework) => !walks[framework].reached.get(state).chromium.some((line) => line.trimStart().startsWith('toolbar "Report tools"')))
      gate.check(
        `parity, ${label}, ${state}: Chromium's tree of the editor -- every role, name, description, value and state -- is the same in React and in Angular`,
        vacuous.length > 0 ? `${vacuous.join(' and ')}'s tree holds no toolbar, so it was read before the editor was drawn` : difference(react.chromium, angular.chromium, names),
      )
      const transformed = FRAMEWORKS.map((framework) => [framework, difference(walks[framework].reached.get(state).chromium, walks[framework].reached.get(state).untransformed, { names: ['as styled', 'with text-transform off'] })]).filter(([, found]) => found !== null)
      gate.check(`parity, ${label}, ${state}: no name in either builder's tree changes with the page's text-transform switched off`, transformed.length === 0 ? null : transformed.map(([framework, found]) => `${framework}: ${found}`).join('; '))
    }
  }
}
