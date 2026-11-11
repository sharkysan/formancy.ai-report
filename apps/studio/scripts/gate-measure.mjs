// What the browser gates read from a page with nothing built but the page:
// the width and its overflow, axe, where the keyboard's focus is, the start
// of sequential navigation, the web fonts and the room's variables as the
// page computes them, what the page's content security policy refused it,
// and its connection hints. They import no workspace package, so an app's
// gate (the Studio's, the product pages') takes them with no package built,
// where gate-page.mjs needs the corpus and PDF.js. The first six were moved
// out of gate-page.mjs unchanged; the policy's recorder and the hints'
// reader were the Studio's gate's and a copy in the pages', one now.

import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { declaredFamilies } from '../../../scripts/web-fonts.mjs'

const require = createRequire(import.meta.url)
// Evaluated through the DevTools protocol, which the demo's policy does not
// govern: added as a `<script>`, the page's policy refuses it (0051).
const AXE = readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8')

/**
 * Sideways scroll, and every element whose painted box is past either edge.
 * Painted: cut by every ancestor that clips what overflows it, as
 * formancy.ai-data's camera cuts it. The builder's design view and the
 * Preview's paper scroll their drawings inside themselves, and a page at
 * 100 % is wider than a narrow pane; what such a pane clips is reached by
 * scrolling the pane, and the pane's own box is measured like any other.
 */
export function measureWidth(page) {
  return page.evaluate(() => {
    const edge = document.documentElement.clientWidth
    const painted = (element) => {
      let { left, right } = element.getBoundingClientRect()
      for (let ancestor = element.parentElement; ancestor !== null && ancestor !== document.documentElement; ancestor = ancestor.parentElement) {
        if (getComputedStyle(ancestor).overflowX === 'visible') continue
        const box = ancestor.getBoundingClientRect()
        ;[left, right] = [Math.max(left, box.left), Math.min(right, box.right)]
      }
      return { left, right }
    }
    const past = []
    for (const element of document.body.querySelectorAll('*')) {
      const whole = element.getBoundingClientRect()
      if (whole.width === 0 || whole.height === 0) continue
      const box = painted(element)
      if (box.right <= box.left) continue
      if (box.right <= edge + 0.5 && box.left >= -0.5) continue
      past.push(`${element.tagName.toLowerCase()}.${String(element.className).slice(0, 24)} at ${Math.round(box.left)}..${Math.round(box.right)}`)
    }
    return { overflow: document.documentElement.scrollWidth - edge, past: [...new Set(past)].slice(0, 6) }
  })
}

/**
 * axe's default rules, and target size, which axe ships switched off
 * (WCAG 2.2 SC 2.5.8), over `target` or the whole document. A guard on the
 * guard: the two measurements jsdom cannot make must have run over
 * something. Every text whose contrast axe left undecided is sorted: on the
 * paper, PDF.js's text layer, transparent text over the PDF's own drawing,
 * whose colours are the document's and not the Studio's (axe says it sits
 * over an image, or is too short to measure); elsewhere, scrolled out of
 * its pane, wholly or in part, which axe cannot see past -- the tall pass
 * brings the panes' rows into view -- and for which it gives either reason
 * it has for a text it cannot see whole; anything else is a text nobody
 * measured, and fails.
 */
export async function audit(page, target) {
  if (!(await page.evaluate(() => 'axe' in window))) await page.evaluate(AXE)
  const subject = target ?? (await page.evaluateHandle(() => document))
  return subject.evaluate(async (context) => {
    const results = await window.axe.run(context, { rules: { 'target-size': { enabled: true } } })
    const nodes = (list, id) => list.find((rule) => rule.id === id)?.nodes ?? []
    const why = (node) => node.any?.[0]?.data?.messageKey ?? node.any?.[0]?.message ?? 'no reason given'
    const elementOf = (node) => document.querySelector(String(node.target[0]))
    const onThePaper = (node) => elementOf(node)?.closest('.paper-page') != null
    // Scrolled out of its pane, wholly or in part: its box cut by an ancestor that clips what overflows it.
    const clipped = (node) => {
      const element = elementOf(node)
      if (element === null) return false
      const box = element.getBoundingClientRect()
      let [left, top, right, bottom] = [box.left, box.top, box.right, box.bottom]
      for (let ancestor = element.parentElement; ancestor !== null && ancestor !== document.documentElement; ancestor = ancestor.parentElement) {
        const style = getComputedStyle(ancestor)
        if (style.overflowX === 'visible' && style.overflowY === 'visible') continue
        const outer = ancestor.getBoundingClientRect()
        ;[left, top, right, bottom] = [Math.max(left, outer.left), Math.max(top, outer.top), Math.min(right, outer.right), Math.min(bottom, outer.bottom)]
      }
      const shown = Math.max(0, right - left) * Math.max(0, bottom - top)
      return shown < box.width * box.height - 1
    }
    const undecided = nodes(results.incomplete, 'color-contrast')
    const overThePdf = undecided.filter(onThePaper)
    const hidden = undecided.filter((node) => !overThePdf.includes(node) && clipped(node))
    return {
      axe: window.axe.version,
      violations: results.violations.map((rule) => `${rule.id} (${String(rule.nodes.length)}): ${rule.nodes[0]?.html.slice(0, 90) ?? ''}`),
      measured: ['color-contrast', 'target-size'].filter((id) => nodes(results.passes, id).length > 0),
      undecided: undecided
        .filter((node) => !hidden.includes(node) && !overThePdf.includes(node))
        .map((node) => `${node.html.slice(0, 60)} (${why(node)})`)
        .slice(0, 4),
      hidden: hidden.length,
    }
  })
}

/** What has the keyboard's focus, said so that a failure names it. */
export function describeFocus(page) {
  return page.evaluate(() => {
    const element = document.activeElement
    if (element === null || element === document.body) return 'the page itself'
    return `${element.tagName.toLowerCase()}${element.getAttribute('role') === null ? '' : `[role=${element.getAttribute('role')}]`} "${(element.textContent ?? '').trim().slice(0, 40)}"`
  })
}

/**
 * The harness putting the start of sequential navigation at the top of the
 * page, formancy.ai-data's `fromTheTop`: the focus blurred, a click at
 * (1, 1), the selection collapsed to the start of `body`. It stands for a
 * person who arrives at the top of the page, which is what a skip link is for.
 */
export async function fromTheTop(page) {
  await page.evaluate(() => (document.activeElement instanceof HTMLElement ? document.activeElement.blur() : undefined))
  await page.mouse.click(1, 1)
  await page.evaluate(() => window.getSelection()?.collapse(document.body, 0))
}

/**
 * Whether every family the page asks for -- each one an @font-face of the
 * built stylesheets declares (scripts/web-fonts.mjs) -- loaded, or, in the
 * pass that refuses the font files, none did, once `document.fonts` has
 * nothing pending: a state measured before a late family swapped in would
 * measure the fallback. Null when it holds.
 */
export async function fontProblem(page, { dist, refused }) {
  const families = declaredFamilies(dist)
  if (families.length === 0) return "no stylesheet of the build declares a face; the gate reads its families from dist's @font-face rules"
  const loaded = await page.evaluate(async () => {
    await document.fonts.ready
    return [...new Set([...document.fonts].filter((face) => face.status === 'loaded').map((face) => face.family.replaceAll(/["']/g, '')))]
  })
  if (refused) {
    const arrived = families.filter((family) => loaded.includes(family))
    return arrived.length === 0 ? null : `${arrived.join(', ')} loaded anyway, so this pass measured the web fonts, not the fallback stack`
  }
  const missing = families.filter((family) => !loaded.includes(family))
  return missing.length === 0 ? null : `${missing.join(', ')} did not load, so this pass measured the fallback stack in their place`
}

/**
 * Why the page does not wear the released room, or null (0034): each custom
 * property the installed @formancy/themes/room.css sets on :root, as the
 * page computes it on <html>, against room.css's own value, a var() of
 * another of its variables resolved to that one's; and its colour scheme.
 * Compared as Chromium computes each -- a colour as a colour, a stack as a
 * font-family -- because the build's minifier writes the room's values
 * otherwise (rgb(17 22 36 / 74%) as #111624bd), and an alpha within one
 * step of 255 is the same colour, which is all a hex alpha can say. Read on
 * the built page, so what scripts/palette.test.mjs reads in the sources is
 * measured where it lands, by whatever path the build took a stylesheet:
 * one that sets a variable of the room's again, the workbench taken again
 * after the room, a room taken nowhere.
 */
export async function paletteProblem(page) {
  const css = readFileSync(require.resolve('@formancy/themes/room.css'), 'utf8').replaceAll(/\/\*[\s\S]*?\*\//g, '')
  const block = /:root\s*\{([^}]*)\}/.exec(css)?.[1] ?? ''
  const declared = Object.fromEntries([...block.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map((match) => [match[1] ?? '', (match[2] ?? '').trim()]))
  const scheme = /(?<![\w-])color-scheme\s*:\s*([^;]+);/.exec(block)?.[1]?.trim()
  if (Object.keys(declared).length === 0 || scheme === undefined) return 'the installed room.css reads as no :root with variables and a colour scheme'
  const resolved = (value, depth = 0) =>
    depth > 8 ? value : value.replaceAll(/var\(\s*(--[\w-]+)\s*\)/g, (_, name) => resolved(declared[name] ?? '', depth + 1))
  const room = Object.entries(declared).map(([name, value]) => [name, resolved(value)])
  const wrong = await page.evaluate(
    ({ room, scheme }) => {
      const probe = document.createElement('i')
      document.body.append(probe)
      /** `value` as Chromium computes it: a colour's channels, a stack as a font-family, or null for neither. */
      const computed = (value) => {
        const property = value === '' ? null : CSS.supports('color', value) ? 'color' : CSS.supports('font-family', value) ? 'font-family' : null
        if (property === null) return null
        probe.style.setProperty(property, value)
        const said = getComputedStyle(probe).getPropertyValue(property)
        probe.style.removeProperty(property)
        return property === 'color' ? { property, channels: (said.match(/[\d.]+/g) ?? []).map(Number) } : { property, said }
      }
      const same = (one, other) => {
        if (one === null || other === null || one.property !== other.property) return false
        if (one.property !== 'color') return one.said === other.said
        const [a, b] = [one.channels, other.channels]
        return (
          a.length >= 3 && a.length === b.length && a.slice(0, 3).every((channel, at) => channel === b[at]) && Math.abs((a[3] ?? 1) - (b[3] ?? 1)) <= 1 / 255
        )
      }
      const root = getComputedStyle(document.documentElement)
      const wrong = room.flatMap(([name, value]) => {
        const now = root.getPropertyValue(name).trim()
        return same(computed(now), computed(value)) ? [] : [`${name} is ${now === '' ? 'unset' : now}, where the room has ${value}`]
      })
      if (root.colorScheme !== scheme) wrong.push(`color-scheme is ${root.colorScheme}, where the room has ${scheme}`)
      probe.remove()
      return wrong
    },
    { room, scheme },
  )
  return wrong.length === 0 ? null : wrong.join('; ')
}

/**
 * Records whatever the page's content security policy refuses it, by
 * directive, what it refused and where from, for refusalsOf() to read:
 * listened for before any script of a document the page opens runs, by a
 * script the policy does not govern (0051). Each document records its own.
 */
export function listenForRefusals(page) {
  return page.addInitScript(() => {
    const refused = []
    Object.defineProperty(window, '__refused', { value: refused })
    document.addEventListener('securitypolicyviolation', (event) =>
      refused.push(`${event.effectiveDirective} refused ${event.blockedURI} at ${event.sourceFile}:${String(event.lineNumber)}`),
    )
  })
}

/** What the policy has refused the document the page holds, as listenForRefusals() recorded it: undefined where nothing listened. */
export function refusalsOf(page) {
  return page.evaluate(() => window.__refused)
}

/**
 * The address of every preconnect and dns-prefetch hint of the document the
 * page holds. A hint opens a connection with no request a listener would
 * hear, and a connection gives the host the address all the same
 * (formancy.ai 0154), so it is read from the page.
 */
export function connectionHints(page) {
  return page.evaluate(() =>
    [...document.querySelectorAll('link')]
      .filter((link) => link.relList.contains('preconnect') || link.relList.contains('dns-prefetch'))
      .map((link) => link.href),
  )
}
