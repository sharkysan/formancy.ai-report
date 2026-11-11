// What jsdom cannot see in the product pages, measured in the browser it is
// given: the Studio's browser gate (apps/studio/scripts/browser-test.mjs),
// applied to the pages. Their suite renders the site and reads the HTML
// back with jsdom, which applies no CSS, resolves no media query, lays
// nothing out, loads no face and enforces no content security policy. Of
// the claims below, the layout, axe's findings and the contrast were
// measured by hand when each page arrived (0021, 0024, 0028), and the
// requests by the last two of those rounds; the keyboard path, the room and
// the faces never were, and the policy was opened once, by hand (0051):
//
//   - every page the built sitemap lists answers as itself: 200, with the
//     production address the sitemap gives it as its one canonical, so a
//     fallback served for an address the build does not hold is refused,
//     never measured as though it were the page;
//   - nothing scrolls sideways and nothing is past either edge, at the
//     reflow width of 320 pixels, again there with the web fonts refused,
//     whose fallback widths differ, a phone, one pixel past each rem
//     `max-width` breakpoint of the built stylesheet, a laptop and a screen
//     (gate-site.mjs, which refuses a stylesheet that asks about the width
//     in any other form);
//   - axe's default rules and its target-size rule find nothing,
//     contrast and target size were measured, over something, and the
//     contrast of every text was decided, none of it left undecided by an
//     ancestor that clips it;
//   - the keyboard path: from the top of the page as it loads, the first
//     Tab reaches the skip link, on screen, where axe finds nothing on it
//     and measured its contrast, and Enter on it puts the keyboard on <main>;
//   - and in each pass, over every page: the page wears the released room,
//     every variable and the colour scheme of @formancy/themes/room.css as
//     it has them (0034); every web font the built stylesheet declares
//     loaded, and in the pass that refuses them, none did; nothing was
//     fetched, nor a connection hinted, outside the built pages but a
//     `data:` address, so a page tells no other site who opened it (0023);
//     and the demo's content security policy refused no page anything
//     (0051). Each of these fails in a pass where no page answered as
//     itself, rather than saying ok of nothing.
//
// The DOM is read where the accessibility tree cannot answer: a page's
// canonical address and its preconnect hints are in its head, which the
// tree does not hold; the skip link is found by its class, `a.skip`, since
// its accessible name is in each page's own language and the same check
// runs on all of them; and geometry, faces, computed colours and the
// policy's refusals are not the tree's to say. <main> is found by its role.
//
// Against the pages `pnpm build` writes, served by `vite preview` on the port
// vite.config.ts fixes, which fails rather than wander when the port is
// taken, under the path the demo on formancy.ai serves them at
// (scripts/demo.mjs, 0018, 0021) and with the headers the deploy writes for
// it, for this address (scripts/demo-headers.mjs, 0051). The Studio is not
// served beside them, so a link to it is not followed. Asserted as numbers
// and computed results, never screenshots; nothing here says what a page
// looks like. Chromium only, the browser installed for this repository's
// gates. The page reads are the Studio's gate's own, from gate-measure.mjs,
// which imports no workspace package, so this gate needs nothing built but
// the pages: every one but `fromTheTop`, for the reason keyboard() gives.
// Its record is the Studio's recorder's (gate-results.mjs).
//
// `pnpm --filter @formancy/report-pages test:browser`, after `pnpm build`.
// Each check is printed and kept in test-results/browser-chromium.json, with
// the passes planned, which the release report reads (collect.mjs --job
// browser).

import { existsSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
import { preview, resolveConfig } from 'vite'
import { LAUNCH_OPTIONS } from '../../../scripts/browsers.mjs'
import { headersFor, SITE } from '../../../scripts/demo-headers.mjs'
import { demoBase, demoUrl, readDemoConfig } from '../../../scripts/demo.mjs'
import { FONT_FILE } from '../../../scripts/web-fonts.mjs'
import {
  audit,
  connectionHints,
  describeFocus,
  fontProblem,
  listenForRefusals,
  measureWidth,
  paletteProblem,
  refusalsOf,
} from '../../studio/scripts/gate-measure.mjs'
import { gateRecorder } from '../../studio/scripts/gate-results.mjs'
import { sitemapPages, sitePasses } from './gate-site.mjs'

const app = join(dirname(fileURLToPath(import.meta.url)), '..')
const dist = join(app, 'dist')

/** The built stylesheet every page links, pages.ts's STYLESHEET: pages.css in demo-headers.mjs's SITE, which demo.test.mjs holds to pages.ts's FILES. */
const STYLESHEET = join(dist, SITE, 'pages.css')

/** Whether the page has its production address as its one canonical, and the status it was answered with: null when both hold. */
async function answered(page, response, production) {
  const status = response?.status() ?? null
  const canonical = await page.evaluate(() => [...document.querySelectorAll('link[rel=canonical]')].map((link) => link.getAttribute('href')))
  if (status === 200 && canonical.length === 1 && canonical[0] === production) return null
  return `answered ${String(status)}, its canonical ${canonical.length === 0 ? 'none' : canonical.join(' and ')}, where the sitemap gives ${production}`
}

/** The layout, the colours and the targets of the page, said under `path`. */
async function measured(gate, page, path) {
  const { check } = gate
  const width = await measureWidth(page)
  check(`${path}: no sideways scroll`, width.overflow > 0 ? `${String(width.overflow)}px of horizontal overflow` : null)
  check(`${path}: nothing past either edge`, width.past.length === 0 ? null : width.past.join('; '))
  await page.evaluate(() => (document.activeElement instanceof HTMLElement ? document.activeElement.blur() : undefined))
  const result = await audit(page)
  gate.axe(result.axe)
  check(`${path}: axe's default rules and target size find nothing`, result.violations.length === 0 ? null : result.violations.join('; '))
  check(`${path}: contrast and target size measured, over something`, result.measured.length === 2 ? null : `only ${result.measured.join(', ') || 'nothing'}`)
  // A text an ancestor clips is undecided too: the pages have no pane that
  // scrolls by design, where the Studio's gate counts such texts and brings
  // its panes' rows into view in a tall pass.
  check(
    `${path}: the contrast of every text decided, none of it left to an ancestor that clips it`,
    result.undecided.length === 0 && result.hidden === 0
      ? null
      : [
          ...(result.undecided.length === 0 ? [] : [`undecided: ${result.undecided.join('; ')}`]),
          ...(result.hidden === 0 ? [] : [`${String(result.hidden)} undecided, cut by an ancestor that clips what overflows it`]),
        ].join('; '),
  )
}

/**
 * From the top of the page as it loads, where a person arriving at it
 * starts: nothing has the focus, and sequential navigation starts at the
 * document's start. Then the skip link, on screen and as axe finds it
 * shown, and <main>, each a check of its own: a first Tab that went
 * elsewhere fails the first alone. Called before anything moves the focus:
 * the page has only been read.
 *
 * Not the Studio's `fromTheTop`, whose click at (1, 1) lands in `.site`'s
 * padding wherever `.site` reaches the window's corner, and Chromium starts
 * sequential navigation at the node a click lands on, so the next Tab
 * passes the skip link, which comes before `.site`: in the first run, on 6
 * November 2026, the first Tab after it reached the wordmark in every pass
 * up to 641px wide, where a fresh load's reached the skip link in all of
 * them. In the Studio the skip link is the first thing inside the element
 * that click lands on.
 */
async function keyboard(gate, page, path) {
  const { check } = gate
  const skip = page.locator('a.skip')
  const links = await skip.count()
  await page.keyboard.press('Tab')
  if (links !== 1) {
    check(`${path}: the first Tab reaches the skip link`, `the page has ${String(links)} a.skip, where it has one skip link`)
    return
  }
  const focused = await skip.evaluate((link) => link === document.activeElement)
  check(`${path}: the first Tab reaches the skip link`, focused ? null : `focus went to ${await describeFocus(page)} first`)
  // What follows is of the skip link itself. Where the first Tab went
  // elsewhere, the link is given the focus, so that Enter is pressed on it
  // and never on whatever had the focus: a link there would take the page
  // away from every check after it.
  if (!focused) await skip.focus()
  const onScreen = await skip.evaluate((link) => {
    const box = link.getBoundingClientRect()
    return box.top >= 0 && box.left >= 0 && box.right <= document.documentElement.clientWidth
  })
  check(`${path}: which is on screen while it has focus`, onScreen ? null : 'it stayed off screen')
  // Off screen, axe leaves the link's contrast out, so shown is where it is measured, or by nobody.
  const skipAudit = await audit(page, skip)
  check(
    `${path}: the skip link, shown: axe finds nothing, and measured its contrast`,
    skipAudit.violations.length > 0
      ? skipAudit.violations.join('; ')
      : skipAudit.measured.includes('color-contrast')
        ? null
        : 'axe measured no contrast on it, so its colours were read by nobody',
  )
  await page.keyboard.press('Enter')
  check(
    `${path}: Enter on it puts the keyboard on <main>`,
    (await page.getByRole('main').evaluate((element) => element === document.activeElement)) ? null : `the focus is on ${await describeFocus(page)}`,
  )
}

/**
 * One pass at one viewport: every page of the sitemap opened in turn in one
 * browser page, each checked under its path, and what is said once a pass
 * gathered from all of them, each under the path it was found on. A pass in
 * which no page answered as itself read nothing those four could be said
 * of, and each says so rather than ok.
 */
async function pass(gate, browser, { served, site, pages }, entry) {
  const { label, width, height, refuseFonts = false } = entry
  gate.pass({ label, width, height })
  const page = await browser.newPage({ viewport: { width, height } })
  // Every request outside the built pages, their faces and pictures
  // included: they are their own files (0023), so a font or a picture from
  // anywhere else is named here too.
  const elsewhere = new Set()
  page.on('request', (request) => {
    const address = request.url()
    if (!address.startsWith(served) && !address.startsWith('data:')) elsewhere.add(address)
  })
  // Whatever the demo's policy refuses a page, listened for before the page is parsed (0051).
  await listenForRefusals(page)
  // The fallback stack's pass: every font file refused, wherever it is from.
  if (refuseFonts) await page.route(FONT_FILE, (route) => route.abort())
  const unroomed = []
  const unfaced = []
  const refused = []
  let read = 0
  /** What a pass-wide check found, over the pages read: null for nothing found, and never over no page. */
  const gathered = (found) =>
    read === 0 ? 'no page of the pass answered as itself, so this was read on none' : found.length === 0 ? null : found.slice(0, 4).join('; ')
  try {
    for (const address of pages) {
      const path = address.slice(served.length)
      const production = `${site}${path}`
      const response = await page.goto(address, { waitUntil: 'load' })
      const problem = await answered(page, response, production)
      gate.check(`${path}: answered as itself`, problem)
      // Another page, or none, measured under this one's name would pass for it.
      if (problem !== null) continue
      read += 1
      // The faces before anything is measured: a box measured before a late face swapped in would measure the fallback.
      const faces = await fontProblem(page, { dist, refused: refuseFonts })
      if (faces !== null) unfaced.push(`${path}: ${faces}`)
      await keyboard(gate, page, path)
      const room = await paletteProblem(page)
      if (room !== null) unroomed.push(`${path}: ${room}`)
      await measured(gate, page, path)
      // The connection hints, which no request listener hears, and the policy's refusals: read from each page, as it ends.
      for (const hint of await connectionHints(page)) if (!hint.startsWith(served)) elsewhere.add(`${hint} (a hint, on ${path})`)
      for (const each of await refusalsOf(page)) refused.push(`${path}: ${each}`)
    }
    gate.check('every page wears the released room, every variable and the colour scheme of the installed room.css as it has them', gathered(unroomed))
    gate.check(
      refuseFonts ? 'with the web fonts refused, no page loaded one' : 'on every page, every web font the built stylesheet declares loaded',
      gathered(unfaced),
    )
    gate.check('no page fetched anything or hinted a connection outside the built pages, their faces and pictures included', gathered([...elsewhere]))
    gate.check(
      "the demo's content security policy refused no page anything: no style, face or picture of the pages is outside it",
      gathered([...new Set(refused)]),
    )
  } finally {
    await page.close()
  }
}

async function main() {
  const gate = gateRecorder('apps/pages', { browser: 'chromium', playwright: createRequire(import.meta.url)('playwright/package.json').version })
  let server
  let browser
  try {
    const sitemap = join(dist, 'sitemap.xml')
    if (!existsSync(sitemap)) throw new Error('apps/pages/dist/sitemap.xml is not there: run `pnpm build` first')
    const list = sitePasses(readFileSync(STYLESHEET, 'utf8'))
    gate.plan(list)
    // Under the path formancy.ai serves the pages at (0018, 0021), with the
    // headers the deploy writes for it, for this address (0051), so every
    // check below is of the build as the demo serves it. As separate pages,
    // `mpa`: a path the build holds no page for is answered 404, never with
    // a page that stands in for it.
    const config = readDemoConfig()
    const base = demoBase(config)
    const site = demoUrl(config)
    if (base === undefined || site === undefined) throw new Error('apps/studio/wrangler.json routes no path of formancy.ai, so the pages have no address')
    const { port } = (await resolveConfig({ root: app, logLevel: 'error' }, 'serve', 'production', 'production', true)).preview
    const served = `http://localhost:${String(port)}${base}`
    server = await preview({ root: app, base, appType: 'mpa', preview: { headers: headersFor(served) }, logLevel: 'warn' })
    const [url] = server.resolvedUrls?.local ?? []
    if (url !== served) throw new Error(`vite preview serves the pages at ${String(url)}, not ${served}, the address their headers were written for`)
    const pages = sitemapPages(readFileSync(sitemap, 'utf8'), site, served)
    console.log(`the built pages, served by vite preview at ${url}: the ${String(pages.length)} pages of the sitemap`)
    const options = { ...LAUNCH_OPTIONS }
    browser = await chromium.launch(options)
    gate.launched(browser, options)
    for (const entry of list) await pass(gate, browser, { served, site, pages }, entry)
    const failures = gate.failures()
    if (failures.length > 0) throw new Error(`${String(failures.length)} browser check(s) failed:\n  ${failures.join('\n  ')}`)
    const widths = list.map((entry) => entry.width)
    console.log(
      `\nbrowser checks passed: every page of the sitemap in ${String(list.length)} passes, from ${String(Math.min(...widths))} to ${String(Math.max(...widths))}px wide, for the layout, focus, colour and requests jsdom cannot represent`,
    )
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
  console.error(`\nthe pages' browser gate failed: ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
}
