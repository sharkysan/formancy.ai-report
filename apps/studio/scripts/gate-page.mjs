// What the Studio's browser gate reads from a page, apart from the journey
// that brings the page to each state (browser-test.mjs): the widths worth
// measuring, the measurements themselves, axe, the rules that reach the
// paper and the Preview, the Preview's controls a pane cuts, PDF.js's
// pages, the drawings of the PDF the page offers, and the web fonts. formancy.ai-data's apps/studio/scripts/
// browser-test.mjs and scripts/browser-gate.mjs, where these first ran.
//
// The reads that go to the DOM rather than the accessibility tree go there
// because the tree has no geometry, no pixels, no stylesheets and no fonts.

import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { drawingsOn, readPdf } from '@formancy/report-corpus'
import { declaredFamilies } from '../../../scripts/web-fonts.mjs'

export const app = join(dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(import.meta.url)
const AXE = readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8')

/** `entry` with each of its `@import './…css';` replaced by the file it names: what Vite builds. Refuses an import it does not understand. */
function inlined(file) {
  const text = readFileSync(file, 'utf8').replaceAll(/@import\s+'(\.\/[^']+\.css)';/g, (_, path) => readFileSync(join(dirname(file), path), 'utf8'))
  if (/@import/.test(text.replaceAll(/\/\*[\s\S]*?\*\//g, ''))) throw new Error(`${file} has an @import the gate does not inline`)
  return text
}

/** Every `max-width` breakpoint of `css`, in CSS pixels. */
const breakpointsOf = (css) => [...css.matchAll(/@media\s*\(\s*max-width:\s*([\d.]+)rem\s*\)/g)].map((match) => Number(match[1]) * 16)

/**
 * The passes worth measuring. Breakpoints are read from the Studio's
 * stylesheet and from report-builder.css, whose own tier shows the builder
 * one pane at a time, one pixel past each, where the wider layout is at its
 * narrowest; a breakpoint added to either is measured without anybody
 * editing this. Then the reflow width, the same with the web fonts refused,
 * a phone, a laptop, and the side-by-side layout made tall, so the rows
 * its panes scroll at 900 px are in view and axe can decide their contrast.
 *
 * And the viewports of the screens the Studio is opened on, which 0029 is
 * about (the screens the person who decided it named, on 17 October 2026):
 * 1366 by 768, 1536 by 864 and 1920 by 1080, each a screen's whole, and
 * 1366 by 657, what a browser's tabs, address bar and the system's taskbar
 * leave of the first -- taken as 111 pixels, not measured on any one
 * browser. They are `light`: the checks of where the Preview stands
 * (gate-place.mjs) and nothing else, since a pass of the whole journey
 * walks every starter in both builders with axe.
 *
 * `firstViewport` marks the passes at which the Preview's first page is in
 * the window as the Studio opens, unscrolled: every one but two kinds. The
 * phones, at or under the Studio's narrowest breakpoint, where the page
 * scrolls past the bar to the builder by design (narrow.css); and the first
 * width past report-builder.css's one-pane tier, where the builder draws its
 * three panes and the middle one is what the two side panes leave of the
 * window: a sliver (0029 says both).
 *
 * Each pass says where the Preview stands at its width -- `middle`, at or
 * under the widest breakpoint (narrow.css's, which layout.ts's query
 * equals) -- whether the builder shows one pane at a time (`onePane`, under
 * report-builder.css's), and the `widest` breakpoint, for the pass that
 * crosses it.
 *
 * The first pass in each layout report-builder.css draws the builder in is
 * marked `parity`: there the two builders' accessible trees are compared
 * (gate-parity.mjs). Only report-builder.css's own breakpoints change which
 * panes the builder's tree holds, so once per layout compares every tree
 * the widths give, and a breakpoint added to it is compared without anybody
 * editing this.
 */
export function passes() {
  const studio = breakpointsOf(inlined(join(app, 'src', 'studio.css')))
  const builder = breakpointsOf(readFileSync(require.resolve('@formancy/report-builder-core/report-builder.css'), 'utf8'))
  if (studio.length === 0 || builder.length === 0) throw new Error('found no max-width breakpoint in src/studio.css or report-builder.css, so the widths below measure nothing')
  const widest = Math.max(...studio)
  const narrowest = Math.min(...studio)
  // The builder's layout at a width: which of its max-width rules apply there.
  const layout = (width) => builder.filter((px) => width <= px).join()
  const compared = new Set()
  return [
    // WCAG 2.2 SC 1.4.10, Reflow: 320 CSS pixels with no horizontal scrolling.
    { label: 'reflow, 320', width: 320, height: 900 },
    // The same with the web fonts refused, whose fallback widths differ.
    { label: 'reflow, 320, web fonts refused', width: 320, height: 900, refuseFonts: true },
    { label: 'phone, 360', width: 360, height: 900 },
    ...[...new Set([...studio, ...builder])].sort((a, b) => a - b).map((px) => ({ label: `one past the ${String(px)}px breakpoint`, width: px + 1, height: 900 })),
    { label: 'laptop, 1440', width: 1440, height: 900 },
    ...[
      [1366, 657],
      [1366, 768],
      [1536, 864],
      [1920, 1080],
    ].map(([width, height]) => ({ label: `viewport, ${String(width)} by ${String(height)}`, width, height, light: true })),
    { label: 'side by side, 2400 high', width: widest + 1, height: 2400 },
  ].map((entry) => {
    const firstViewport = entry.width > narrowest && !builder.includes(entry.width - 1)
    const placed = { ...entry, middle: entry.width <= widest, onePane: layout(entry.width) !== '', widest, firstViewport }
    if (compared.has(layout(entry.width))) return placed
    compared.add(layout(entry.width))
    return { ...placed, parity: true }
  })
}

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
  if (!(await page.evaluate(() => 'axe' in window))) await page.addScriptTag({ content: AXE })
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
      undecided: undecided.filter((node) => !hidden.includes(node) && !overThePdf.includes(node)).map((node) => `${node.html.slice(0, 60)} (${why(node)})`).slice(0, 4),
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
 * The one rule of the builder's that reaches what a host draws in its
 * middle (0029): workbench.css's `.wb *` under `prefers-reduced-motion`,
 * which turns every transition in a workbench off. Admitted only while it
 * declares transitions and nothing else -- nothing on the Preview or its
 * paper has a transition, so it changes nothing drawn there -- as the
 * Studio's styles.test.tsx admits it in jsdom.
 */
const INERT = '.wb *'

/**
 * A selector that names the builder: the workbench's classes, its parts,
 * its panes, or its Angular element. styles.test.tsx's, for the rules as
 * the browser parsed the build.
 */
const NAMES_BUILDER = String.raw`(^|[\s>+~(,])\.wb(-[\w-]+)?\b|\[data-(report-part|pane|panel)\b|\breport-builder\b`

/**
 * Every rule of the page's stylesheets -- the room's, the workbench's and
 * the builder's, as the browser parsed the build -- that selects an
 * element inside the one `within` selects, among those `only` names (a
 * pattern), or all; but those that are `own` (a pattern), which may, and
 * workbench.css's inert `.wb *`, kept apart. A rule is matched for every
 * moment, not this one: a state the pointer or the keyboard puts an element
 * in comes off the selector first, and a pseudo-element is matched as the
 * element it hangs off. What the elements inherit -- the font, the line
 * height -- they would inherit from any host page; that is not a rule
 * selecting them. A stylesheet the page cannot read is named: every one is
 * the Studio's own, from its own origin (0023), so none may be. The rules
 * are also counted against what `beside` selects, outside: the guard that
 * the reading reaches anything at all.
 */
function rulesInside(page, { within, own = null, only = null, beside = null }) {
  return page.evaluate(
    ({ within, own, only, beside, inert }) => {
      const container = document.querySelector(within)
      if (container === null) return { rules: 0, own: 0, tags: [], reached: [], inert: [], broken: [], unread: [], besideReached: 0 }
      const rules = []
      const unread = []
      const walk = (list) => {
        for (const rule of list) {
          if (rule instanceof CSSStyleRule) rules.push(rule)
          if ('cssRules' in rule && rule.cssRules.length > 0) walk(rule.cssRules)
        }
      }
      for (const sheet of document.styleSheets) {
        try {
          walk(sheet.cssRules)
        } catch {
          unread.push(sheet.href ?? 'an inline stylesheet')
        }
      }
      // A selector list split at its top-level commas only: `:is(:lang(he), :lang(yi))` is one selector.
      const split = (list) => {
        const parts = ['']
        let depth = 0
        for (const character of list) {
          if (character === '(') depth += 1
          if (character === ')') depth -= 1
          if (character === ',' && depth === 0) parts.push('')
          else parts[parts.length - 1] += character
        }
        return parts.map((part) => part.trim())
      }
      const elements = [...container.querySelectorAll('*')]
      const others = beside === null ? [] : [...document.querySelectorAll(beside)]
      const declared = (rule) => Array.from({ length: rule.style.length }, (_, index) => rule.style.item(index))
      const reached = []
      const kept = []
      const broken = []
      let mine = 0
      let besideReached = 0
      for (const rule of rules) {
        for (const selector of split(rule.selectorText)) {
          if (only !== null && !new RegExp(only).test(selector)) continue
          if (own !== null && new RegExp(own).test(selector)) {
            mine += 1
            continue
          }
          const always = selector.replace(/::[\w-]+(\([^)]*\))?/g, '').replace(/:(?:focus-visible|focus-within|focus|hover|active)(?![\w-])/g, '').trim() || '*'
          try {
            if (others.some((element) => element.matches(always))) besideReached += 1
            const hit = elements.find((element) => element.matches(always))
            if (hit === undefined) continue
            const properties = declared(rule)
            if (selector === inert && properties.length > 0 && properties.every((property) => property.startsWith('transition'))) kept.push(`${selector} { ${properties.join(', ')} }`)
            else reached.push(`${selector} selects ${hit.outerHTML.slice(0, 60)}`)
          } catch {
            broken.push(selector)
          }
        }
      }
      return { rules: rules.length, own: mine, tags: [...new Set(elements.map((element) => element.localName))], reached, inert: [...new Set(kept)], broken, unread, besideReached }
    },
    { within, own, only, beside, inert: INERT },
  )
}

/**
 * Every rule that selects an element on the PDF's paper: the white page,
 * PDF.js's canvas and its text layer. Only the paper's own rules may: those
 * that name `.paper-page` or `.paper-text`; and, where the Preview stands
 * in the builder's middle, the workbench's inert `.wb *`, said apart.
 */
export const rulesOnThePaper = (page) => rulesInside(page, { within: '.paper', own: String.raw`\.paper-(page|text)\b` })

/**
 * Every rule that names the builder and selects an element of the Preview
 * standing in its middle, in the region the builder lends it: none may but
 * the inert `.wb *`, since the Preview there is the Studio's, dressed by the
 * Studio's rules, and no pane of the workbench (0029). Counted against the
 * builder's outline pane too, which the same rules must reach.
 */
export const builderRulesInThePreview = (page) =>
  rulesInside(page, { within: '[data-report-part="editor"] [data-report-part="view"]', only: NAMES_BUILDER, beside: '[data-report-part="editor"] [data-pane="outline"] *' })

/**
 * Every control of the Preview -- a button, a link, a field -- whose box an
 * ancestor cuts where nothing scrolls to the rest of it. Each ancestor that
 * clips is met from the control outwards, and one that cuts what is left of
 * the control's box without scrolling (`overflow: hidden` or `clip` on that
 * axis) leaves that part out of a pointer's reach. A control cut only by
 * one that scrolls -- the Preview standing in a middle pane narrower than
 * its tools -- is counted apart, as `scrolled`.
 */
export function cutControls(page) {
  return page.evaluate(() => {
    const controls = [...document.querySelectorAll('.studio-preview :is(button, a[href], input, select, textarea)')].filter((control) => control.getClientRects().length > 0)
    const cut = []
    let scrolled = 0
    for (const control of controls) {
      const own = control.getBoundingClientRect()
      let [left, top, right, bottom] = [own.left, own.top, own.right, own.bottom]
      let fault = null
      let scrolls = false
      for (let ancestor = control.parentElement; ancestor !== null && ancestor !== document.documentElement && right > left && bottom > top; ancestor = ancestor.parentElement) {
        const style = getComputedStyle(ancestor)
        const box = ancestor.getBoundingClientRect()
        const across = style.overflowX !== 'visible' && (box.left > left + 0.5 || box.right < right - 0.5)
        const down = style.overflowY !== 'visible' && (box.top > top + 0.5 || box.bottom < bottom - 0.5)
        if ((across && /hidden|clip/.test(style.overflowX)) || (down && /hidden|clip/.test(style.overflowY))) fault ??= ancestor
        if ((across && /auto|scroll/.test(style.overflowX)) || (down && /auto|scroll/.test(style.overflowY))) scrolls = true
        if (style.overflowX !== 'visible') [left, right] = [Math.max(left, box.left), Math.min(right, box.right)]
        if (style.overflowY !== 'visible') [top, bottom] = [Math.max(top, box.top), Math.min(bottom, box.bottom)]
      }
      const name = (control.getAttribute('aria-label') ?? control.textContent ?? '').trim().slice(0, 30) || control.localName
      if (fault !== null) cut.push(`${name}, by ${fault.localName}.${String(fault.className).slice(0, 24)}`)
      else if (scrolls) scrolled += 1
    }
    return { controls: controls.length, cut, scrolled }
  })
}

/**
 * Each page PDF.js drew, read once its text layer has text, its canvas has
 * ink and neither changes any more, or as it is after `within` ms: how much of its canvas is near-white and
 * how much is ink, every eighth pixel sampled; and its text layer as lines
 * a reader sees, rebuilt as report-render-pdf's `pageLines` rebuilds them
 * from PDF.js's runs -- runs on one baseline make one line, read left to
 * right, and lines are read top to bottom -- here from each run's box on
 * screen.
 */
export async function drawnPages(page, { within }) {
  const read = () =>
    page.evaluate(() =>
      [...document.querySelectorAll('.paper-page')].map((sheet) => {
        const canvas = sheet.querySelector('canvas')
        let white = 0
        let ink = 0
        let sampled = 0
        if (canvas !== null && canvas.width > 0 && canvas.height > 0) {
          const { data } = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height)
          for (let index = 0; index < data.length; index += 32) {
            sampled += 1
            const sum = data[index] + data[index + 1] + data[index + 2]
            if (data[index + 3] === 255 && sum >= 750) white += 1
            else if (data[index + 3] > 0 && sum < 600) ink += 1
          }
        }
        const runs = [...sheet.querySelectorAll('.paper-text span')]
          .filter((span) => span.children.length === 0 && (span.textContent ?? '').trim() !== '')
          .map((span) => {
            const box = span.getBoundingClientRect()
            return { text: span.textContent ?? '', x: box.left, right: box.right, bottom: box.bottom, height: box.height }
          })
          .sort((a, b) => a.bottom - b.bottom || a.x - b.x)
        const lines = []
        for (const run of runs) {
          const current = lines.at(-1)
          if (current !== undefined && Math.abs(run.bottom - current[0].bottom) < 0.3 * Math.min(run.height, current[0].height)) current.push(run)
          else lines.push([run])
        }
        return {
          number: Number(sheet.dataset.page),
          white: sampled === 0 ? 0 : white / sampled,
          ink: sampled === 0 ? 0 : ink / sampled,
          lines: lines.map((line) => {
            line.sort((a, b) => a.x - b.x)
            let joined = ''
            line.forEach((run, index) => {
              const before = line[index - 1]
              joined += (before !== undefined && run.x - before.right > 0.15 * Math.min(run.height, before.height) ? ' ' : '') + run.text
            })
            return joined.replace(/\s+/g, ' ').trim()
          }),
        }
      }),
    )
  // PDF.js streams a page's text into its layer in pieces, and draws its
  // canvas in steps: two reads alike, 200 ms apart, with text and ink on
  // every page, are a page drawn.
  const deadline = Date.now() + within
  let before = await read()
  for (;;) {
    if (Date.now() > deadline) return before
    await page.waitForTimeout(200)
    const now = await read()
    if (now.length > 0 && now.every((sheet) => sheet.lines.length > 0 && sheet.ink > 0) && JSON.stringify(now) === JSON.stringify(before)) return now
    before = now
  }
}

/**
 * The PDF at `href`, which Download PDF points at, fetched in the page and
 * read back with PDF.js in Node: its first five characters, which say
 * whether it is a PDF at all, and the drawings of its page `number`, read
 * by report-corpus's `drawingsOn`, the reader report-render-pdf's
 * pictures.json is written with (0030, 0032) -- each clip a painted path
 * stands inside, with its box, its paints and each of its paths -- so that
 * the firm's mark and a code drawn by the browser entry are held to those
 * the Node entry drew for the picture.
 */
export async function downloaded(page, href, number) {
  const bytes = new Uint8Array(await page.evaluate(async (address) => [...new Uint8Array(await (await fetch(address)).arrayBuffer())], href))
  const head = new TextDecoder().decode(bytes.subarray(0, 5))
  const sheet = head === '%PDF-' ? (await readPdf(bytes)).pages[number - 1] : undefined
  return { head, drawings: sheet === undefined ? [] : drawingsOn(sheet) }
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
  if (families.length === 0) return "no stylesheet of the built Studio declares a face; the gate reads its families from dist's @font-face rules"
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
