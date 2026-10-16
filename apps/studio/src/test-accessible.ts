/**
 * The accessibility audit the Studio's suite runs, as the builders' suites
 * run it: axe, WCAG 2.2 AA by its tags, over the body. The rules about the
 * page as a whole -- its language, its title, a way past the bar -- are the
 * journey's `page()`.
 */
import axe from 'axe-core'

/**
 * WCAG 2.2 AA and what it subsumes. `best-practice` is left out, as
 * formancy.ai's and the builders' suites leave it out.
 */
const WCAG = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']

/**
 * Rules jsdom cannot decide, each with why: not "does not apply" but
 * "cannot be measured here". A browser gate decides them.
 */
const UNMEASURABLE_IN_JSDOM: Readonly<Record<string, string>> = {
  'color-contrast': 'jsdom computes no colour: the contrast of the room and of the workbench’s variables is for a browser to measure.',
  'target-size': 'WCAG 2.2 SC 2.5.8 is a size in CSS pixels, and jsdom lays nothing out, so every target is 0 by 0.',
}

/** axe's violations in the document as it stands: the rule, and the markup of each node. */
export async function violations(): Promise<{ readonly id: string; readonly nodes: readonly string[] }[]> {
  const rules = Object.fromEntries(Object.keys(UNMEASURABLE_IN_JSDOM).map((id) => [id, { enabled: false }]))
  const results = await axe.run(document.body, { runOnly: { type: 'tag', values: WCAG }, rules, resultTypes: ['violations'] })
  return results.violations.map((violation) => ({ id: violation.id, nodes: violation.nodes.map((node) => node.html) }))
}
