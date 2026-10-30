// The camera every README picture is taken with: one context's settings, the
// app served, the fonts waited for, the PDF's canvases waited for, the clip
// measured from the parts, the shot taken until it settles, and the WebP
// encoded -- so no picture is taken another way. formancy.ai-data's
// scripts/pictures/camera.mjs (its 0038), for a page that answers no server
// and draws PDF pages on canvases.
//
// Node built-ins only. The app script passes in its own Playwright objects --
// the browser, the context, the page, a locator per part -- because Playwright
// is the app's dependency, not the repository root's.
//
// What it reads from the DOM rather than the accessibility tree, and why
// (CLAUDE.md asks tests to find things by role and name; these are the reads
// that tree cannot answer, because it has no geometry, no fonts and no
// pixels):
//
//   - boxes: `locator.boundingBox()` of each part, for the clip, which is
//     their union, and again after the shot, to show they did not move;
//   - scroll: `window.scrollTo(0, 0)` before measuring, because a box is in
//     the viewport's coordinates and a full-page clip in the page's, and the
//     two agree only at the top; and the page's scroll size, so no box is
//     past it;
//   - blur: the focused element is blurred before a shot unless the scene
//     keeps it, so no focus ring is pictured by accident;
//   - the bench: every element drawn near the parts -- its box, its box
//     shadow, whether it has a border, a background or text -- so the
//     margin around them stops short of anything else on the page;
//   - the intrusion check: every visible text node, and every input,
//     textarea, select, img, svg and canvas, whose painted box meets the
//     clip, is asked whether a part contains it -- so what the record holds
//     is everything a person reads in the picture;
//   - fonts: `document.fonts`, for whether every family has arrived; which
//     families, and their versions, are read from the build and its font
//     packages by scripts/web-fonts.mjs, not from the DOM;
//   - canvases: the pixels of every canvas in the parts, read twice, since
//     PDF.js draws a page on one after the DOM that holds it is quiet;
//   - changes: a MutationObserver on the document while a picture is shot,
//     so a page that keeps changing is not pictured in one moment of it.
//
// One more is session.mjs's: `aria-busy` inside the parts, for a preview
// still being printed, which the accessibility snapshot does not carry.
//
// The app's stylesheet digest is read from its source files, as its gate
// inlines them, not from the DOM: `stylesheet()` below.

import { existsSync, readFileSync, statSync } from 'node:fs'
import { extname, join, normalize, sep } from 'node:path'
import { steadied } from './aria-text.mjs'

export { digest } from './record.mjs'

/** What a context is opened with, for every scene. Nothing here reads the colour scheme; light is Playwright's default, said. */
export const SETTINGS = Object.freeze({ deviceScaleFactor: 2, locale: 'en-US', timezoneId: 'UTC', reducedMotion: 'reduce', colorScheme: 'light', height: 900 })

/** How many shots a state may take to settle before the camera refuses it. */
export const SETTLE_LIMIT = 10

/**
 * The most bench a picture keeps around its parts, in CSS px on each side:
 * formancy.ai-data's measure, so a part with no frame of its own does not
 * run into the picture's edge. A side keeps less where something else is
 * drawn nearer (`bench`). What the bench adds is inside the clip, so the
 * intrusion check covers it.
 */
export const MARGIN = 16

/** WebP quality: formancy.ai-data's, measured there against 0.8 and 0.95. */
const QUALITY = 0.9

/** Every `max-width` breakpoint of `css`, in CSS pixels, read the way the app's browser gate reads them; refused when there is none. */
function breakpoints(css, file) {
  const found = [...css.matchAll(/@media\s*\(\s*max-width:\s*([\d.]+)rem\s*\)/g)].map((match) => Number(match[1]) * 16)
  if (found.length === 0) throw new Error(`found no max-width breakpoint in ${file}, so no width can be shown to be past them all, or below them all`)
  return found
}

/** The widest breakpoint: a scene of the wide layout is taken past it. */
export const widestBreakpoint = (css, file) => Math.max(...breakpoints(css, file))

/** The narrowest breakpoint: a scene that names its own width, a phone's, is taken at or below it. */
export const narrowestBreakpoint = (css, file) => Math.min(...breakpoints(css, file))

/**
 * An app's stylesheet as one text, the way its browser gate reads it: `entry`
 * in `directory` with each `@import './…css';` replaced by the file it names.
 * Refuses an import it does not understand rather than reading less than the
 * page loads.
 */
export function stylesheet(directory, entry) {
  const text = readFileSync(join(directory, entry), 'utf8').replaceAll(/@import\s+'(\.\/[^']+\.css)';/g, (_, path) =>
    readFileSync(join(directory, path), 'utf8'),
  )
  if (/@import/.test(text.replaceAll(/\/\*[\s\S]*?\*\//g, ''))) throw new Error(`${entry} has an @import the camera does not inline`)
  return text
}

/**
 * A context with the settings every picture is taken in, `width` wide;
 * refuses a width at or below the stylesheet's widest breakpoint.
 */
export async function context(browser, { width, breakpoint }) {
  if (!(width > breakpoint)) throw new Error(`a picture is taken past the widest breakpoint, ${String(breakpoint)}px, and ${String(width)}px is not past it`)
  const { height, ...rest } = SETTINGS
  return browser.newContext({ viewport: { width, height }, ...rest })
}

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  // PDF.js's worker: a module worker whose type is not JavaScript does not start.
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  // The faces, which the build serves itself (0023).
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
}

/**
 * The built app at `origin` (an `http://<app>.invalid` address nothing
 * resolves), answered inside `opened` from `dist`. Nothing listens on a
 * port, so nothing on a shared machine can reach it and no port can be taken.
 */
export async function serve(opened, { origin, dist }) {
  await opened.route(`${origin}/**`, async (route) => {
    const url = new URL(route.request().url())
    // `normalize` then a prefix check: a path with `..` must not leave dist.
    let file = join(dist, normalize(decodeURIComponent(url.pathname)))
    if (file !== dist && !file.startsWith(`${dist}${sep}`)) return route.fulfill({ status: 403 })
    if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html')
    if (!existsSync(file)) return route.fulfill({ status: 404, contentType: 'text/plain', body: `no ${url.pathname}` })
    return route.fulfill({ status: 200, contentType: TYPES[extname(file)] ?? 'application/octet-stream', body: readFileSync(file) })
  })
}

/**
 * Waits, at most `within` ms, until `document.fonts` has settled with at
 * least one face of every family in `names` loaded and none still loading;
 * refuses naming the family that has not arrived. `document.fonts.ready` is
 * raced against the bound, because a face whose file never answers keeps it
 * pending.
 */
export async function fonts(page, names, { within }) {
  const deadline = Date.now() + within
  for (;;) {
    const state = await page.evaluate(
      async ({ wanted, wait }) => {
        const ready = await Promise.race([document.fonts.ready.then(() => true), new Promise((resolve) => setTimeout(() => resolve(false), wait))])
        const faces = [...document.fonts]
        const named = (status) => new Set(faces.filter((face) => face.status === status).map((face) => face.family.replaceAll('"', '')))
        const [loading, loaded, failed] = [named('loading'), named('loaded'), named('error')]
        return {
          ready,
          loading: wanted.filter((family) => loading.has(family)),
          missing: wanted.filter((family) => !loaded.has(family)),
          failed: wanted.filter((family) => failed.has(family)),
        }
      },
      { wanted: names, wait: Math.max(0, deadline - Date.now()) },
    )
    if (state.ready && state.loading.length === 0 && state.missing.length === 0) break
    if (Date.now() > deadline) {
      const [family] = [...state.missing, ...state.loading]
      const how = state.failed.includes(family) ? 'failed to load' : 'had not loaded'
      throw new Error(`the font ${family} ${how} after ${String(within)} ms, and a picture in a fallback face would look like a different product`)
    }
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
}

/** How long a canvas's pixels must stay as they are before it counts as drawn. */
const CANVAS_QUIET_MS = 300

/**
 * Waits, at most `within` ms, until every canvas in `parts` holds pixels and
 * gives the same pixels on two reads CANVAS_QUIET_MS apart. PDF.js draws a
 * page on its canvas in steps, from a worker, after the DOM that holds the
 * page is quiet; a shot taken between two steps would picture half a page,
 * and the DOM watch in `shoot` cannot see it. Each read is a digest of every
 * eighth pixel, which a step that draws text or a rule changes.
 */
export async function canvasesDrawn(page, parts, { within }) {
  const deadline = Date.now() + within
  const read = () =>
    Promise.all(
      Object.values(parts).map((part) =>
        part.evaluate((element) =>
          [...element.querySelectorAll('canvas')].map((canvas) => {
            if (canvas.width === 0 || canvas.height === 0) return 'empty'
            const { data } = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height)
            let sum = 0
            for (let index = 0; index < data.length; index += 32) sum = (sum * 31 + data[index] + data[index + 1] * 7 + data[index + 2] * 13) % 2147483647
            return String(sum)
          }),
        ),
      ),
    ).then((each) => each.flat())
  let before = await read()
  for (;;) {
    await new Promise((resolve) => setTimeout(resolve, CANVAS_QUIET_MS))
    const now = await read()
    if (!now.includes('empty') && JSON.stringify(now) === JSON.stringify(before)) return now.length
    if (Date.now() > deadline) throw new Error(`a canvas in the picture was still being drawn after ${String(within)} ms`)
    before = now
  }
}

/** Blur the focused element unless the scene keeps it, and park the pointer where it hovers nothing a part holds. */
export async function still(page, { keepFocus = false } = {}) {
  if (!keepFocus) await page.evaluate(() => (document.activeElement instanceof HTMLElement ? document.activeElement.blur() : undefined))
  await page.mouse.move(0, 0)
}

/** `area` grown by `margin` -- one number, or `{ top, right, bottom, left }` -- and stopped at the edges of `size`, the page. */
export function padded(area, margin, size) {
  const sides = typeof margin === 'number' ? { top: margin, right: margin, bottom: margin, left: margin } : margin
  const left = Math.max(0, area.x - sides.left)
  const top = Math.max(0, area.y - sides.top)
  const right = Math.min(size.width, area.x + area.width + sides.right)
  const bottom = Math.min(size.height, area.y + area.height + sides.bottom)
  return { x: left, y: top, width: right - left, height: bottom - top }
}

/**
 * How much of `margin` each side of `area` keeps: all of it, or less where
 * something drawn beside the area belongs to no part and holds none -- a
 * neighbouring panel's edge, a button's glow -- whole CSS px short of it, so
 * the bench never shows a sliver of something else. "Drawn" is a border, a
 * background, text, a control or an image, and a coloured box shadow by how
 * far it reaches; a black one is the bench darkened, and is not counted.
 * Something beside two sides -- a corner -- is kept out by the side that
 * loses less. Opposite sides keep the same, the less of the two, so a part
 * is never framed lopsidedly. An element over the area itself is the
 * intrusion check's to say. Run in the page, at scroll 0.
 */
function bench({ area, parts, margin }) {
  const related = (element) => parts.some((part) => part === element || part.contains(element) || element.contains(part))
  const transparent = (color) => color === 'transparent' || /^rgba\(.*,\s*0\)$/.test(color)
  // How far each coloured outer box shadow reaches past the border box, side by side.
  const reach = (shadow) => {
    const out = { top: 0, right: 0, bottom: 0, left: 0 }
    if (shadow === 'none') return out
    for (const one of shadow.split(/,(?![^(]*\))/)) {
      const color = /rgba?\([^)]*\)/.exec(one)?.[0] ?? ''
      if (/\binset\b/.test(one) || /^rgba?\(0, 0, 0\b/.test(color) || transparent(color)) continue
      const [x = 0, y = 0, blur = 0, spread = 0] = [...one.replace(color, '').matchAll(/(-?[\d.]+)px/g)].map((match) => Number(match[1]))
      out.top = Math.max(out.top, blur + spread - y)
      out.bottom = Math.max(out.bottom, blur + spread + y)
      out.left = Math.max(out.left, blur + spread - x)
      out.right = Math.max(out.right, blur + spread + x)
    }
    return out
  }
  const sides = ['Top', 'Right', 'Bottom', 'Left']
  const draws = (element, style) =>
    ['input', 'textarea', 'select', 'img', 'svg', 'canvas'].includes(element.localName) ||
    !transparent(style.backgroundColor) ||
    style.backgroundImage !== 'none' ||
    sides.some((side) => parseFloat(style[`border${side}Width`]) > 0 && style[`border${side}Style`] !== 'none' && !transparent(style[`border${side}Color`])) ||
    [...element.childNodes].some((node) => node.nodeType === Node.TEXT_NODE && node.data.trim() !== '')
  const [left, top, right, bottom] = [area.x, area.y, area.x + area.width, area.y + area.height]
  const kept = { top: margin, right: margin, bottom: margin, left: margin }
  for (const element of document.body.querySelectorAll('*')) {
    if (related(element) || !element.checkVisibility({ opacityProperty: true, visibilityProperty: true })) continue
    const style = getComputedStyle(element)
    const glow = reach(style.boxShadow)
    if (!draws(element, style) && Object.values(glow).every((length) => length <= 0)) continue
    const box = element.getBoundingClientRect()
    if (box.width === 0 || box.height === 0) continue
    // The room left on each side the element is beyond, its glow included.
    const rooms = [
      ...(box.bottom <= top ? [['top', top - (box.bottom + glow.bottom)]] : []),
      ...(box.top >= bottom ? [['bottom', box.top - glow.top - bottom]] : []),
      ...(box.right <= left ? [['left', left - (box.right + glow.right)]] : []),
      ...(box.left >= right ? [['right', box.left - glow.left - right]] : []),
    ]
    if (rooms.length === 0) continue
    const [side, room] = rooms.reduce((best, next) => (next[1] > best[1] ? next : best))
    kept[side] = Math.min(kept[side], room)
  }
  const across = Math.max(0, Math.floor(Math.min(kept.left, kept.right)))
  const down = Math.max(0, Math.floor(Math.min(kept.top, kept.bottom)))
  return { top: down, right: across, bottom: down, left: across }
}

/** Each part's box, at scroll 0, in page coordinates, and the page's size; refuses a part that is not drawn or is past the page. */
async function boxes(page, parts) {
  await page.evaluate(() => window.scrollTo(0, 0))
  const size = await page.evaluate(() => ({ width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight }))
  const found = {}
  for (const [name, locator] of Object.entries(parts)) {
    const box = await locator.boundingBox()
    if (box === null || box.width === 0 || box.height === 0) throw new Error(`the part ${name} has no size: it is not drawn`)
    if (box.x < 0 || box.y < 0 || box.x + box.width > size.width + 0.5 || box.y + box.height > size.height + 0.5) {
      throw new Error(`the part ${name} reaches past the page (${JSON.stringify(box)} on ${String(size.width)}x${String(size.height)})`)
    }
    found[name] = box
  }
  return { found, size }
}

/** The union of `found`'s boxes, rounded outward to whole CSS pixels. */
function union(found) {
  const all = Object.values(found)
  const left = Math.floor(Math.min(...all.map((box) => box.x)))
  const top = Math.floor(Math.min(...all.map((box) => box.y)))
  const right = Math.ceil(Math.max(...all.map((box) => box.x + box.width)))
  const bottom = Math.ceil(Math.max(...all.map((box) => box.y + box.height)))
  return { x: left, y: top, width: right - left, height: bottom - top }
}

/** The clip of `parts` as measured now: their union with the bench `bench` leaves around it, inside the page. */
async function measured(page, parts) {
  const { found, size } = await boxes(page, parts)
  const area = union(found)
  const handles = await Promise.all(Object.values(parts).map((locator) => locator.elementHandle()))
  try {
    return padded(area, await page.evaluate(bench, { area, parts: handles, margin: MARGIN }), size)
  } finally {
    await Promise.all(handles.map((handle) => handle.dispose()))
  }
}

/**
 * What is drawn inside `clip` and belongs to no part: visible text, and the
 * elements that show something without text. Run in the page.
 */
function intruders({ clip, parts }) {
  const inside = (node) => parts.some((part) => part.contains(node))
  // What of `rect` is painted: cut by every ancestor that clips what overflows it.
  const painted = (element, rect) => {
    let [left, top, right, bottom] = [rect.left, rect.top, rect.right, rect.bottom]
    for (let ancestor = element; ancestor !== null && ancestor !== document.documentElement; ancestor = ancestor.parentElement) {
      const style = getComputedStyle(ancestor)
      if (style.overflowX === 'visible' && style.overflowY === 'visible' && style.clipPath === 'none' && style.clip === 'auto') continue
      const box = ancestor.getBoundingClientRect()
      ;[left, top, right, bottom] = [Math.max(left, box.left), Math.max(top, box.top), Math.min(right, box.right), Math.min(bottom, box.bottom)]
    }
    return { left, top, right, bottom }
  }
  // At least 2 by 2 pixels and meeting the clip: a visually hidden element is one pixel, clipped.
  const meets = (box) =>
    box.right - box.left >= 2 &&
    box.bottom - box.top >= 2 &&
    box.right > clip.x &&
    box.left < clip.x + clip.width &&
    box.bottom > clip.y &&
    box.top < clip.y + clip.height
  const shown = (element) => element.checkVisibility({ opacityProperty: true, visibilityProperty: true })
  const found = []
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
    const parent = node.parentElement
    if (node.data.trim() === '' || parent === null || inside(node) || !shown(parent)) continue
    const range = document.createRange()
    range.selectNodeContents(node)
    if ([...range.getClientRects()].some((rect) => meets(painted(parent, rect)))) found.push(`the text "${node.data.trim().slice(0, 80)}"`)
  }
  for (const element of document.body.querySelectorAll('input, textarea, select, img, svg, canvas')) {
    if (inside(element) || (element instanceof HTMLInputElement && element.type === 'hidden') || !shown(element)) continue
    if (meets(painted(element, element.getBoundingClientRect())))
      found.push(`a ${element.tagName.toLowerCase()} "${(element.getAttribute('aria-label') ?? element.getAttribute('name') ?? '').slice(0, 40)}"`)
  }
  return found
}

/**
 * The clip of a picture made of `parts` (`{ name: locator }`): the union of
 * their boxes, measured at scroll 0, with the bench around it. Refuses when
 * anything drawn inside it -- the margin included -- belongs to no part,
 * since that would be text the record does not hold, and quotes it.
 */
export async function clip(page, parts, { scene } = {}) {
  const area = await measured(page, parts)
  const handles = await Promise.all(Object.values(parts).map((locator) => locator.elementHandle()))
  try {
    const stray = await page.evaluate(intruders, { clip: area, parts: handles })
    if (stray.length > 0)
      throw new Error(
        `${scene === undefined ? '' : `${scene}: `}the clip of ${Object.keys(parts).join(', ')} shows what no part holds, so the record would not say it: ${stray.slice(0, 6).join('; ')}`,
      )
  } finally {
    await Promise.all(handles.map((handle) => handle.dispose()))
  }
  return area
}

/**
 * Starts counting, in the page, every change to the DOM -- a node added or
 * removed, a text changed, an attribute given another value -- except the
 * caret colour Playwright sets on every text box for a shot and puts back.
 * Each change is kept as its kind, element and attribute name. Run in the page.
 */
function watchChanges() {
  window.__picturesChanges?.observer.disconnect()
  const caretless = (style) => (style ?? '').replaceAll(/caret-color\s*:[^;]*;?/g, '').replaceAll(/\s+/g, '')
  const seen = []
  const observer = new MutationObserver((records) => {
    for (const record of records) {
      if (record.type === 'attributes') {
        const now = record.target.getAttribute(record.attributeName)
        if (now === record.oldValue) continue
        if (record.attributeName === 'style' && caretless(now) === caretless(record.oldValue)) continue
      }
      const element = record.target instanceof Element ? record.target : record.target.parentElement
      seen.push(
        `${record.type === 'characterData' ? 'text' : record.type} of a ${element?.localName ?? 'node'}${record.type === 'attributes' ? `'s ${record.attributeName}` : ''}`,
      )
    }
  })
  observer.observe(document.documentElement, { subtree: true, childList: true, characterData: true, attributes: true, attributeOldValue: true })
  window.__picturesChanges = { observer, seen }
}

/**
 * The picture of `area`: shot until two shots in a row are the same bytes
 * and nothing in the page changed from before the first began until the
 * second was taken, at most SETTLE_LIMIT shots, and refused after that.
 * formancy.ai-data measured both halves: a single shot right after a click
 * caught a page still drawing, and two equal shots alone let a background
 * toggled every 16 ms through, because two shots can fall in the same
 * phase. What the DOM watch cannot see -- a canvas drawn in steps -- is
 * waited for before the first shot (`canvasesDrawn`).
 */
export async function shoot(page, area, { keepFocus = false } = {}) {
  await still(page, { keepFocus })
  await page.evaluate(watchChanges)
  const changes = () => page.evaluate(() => window.__picturesChanges.seen.splice(0))
  try {
    let previous
    let quietBefore = false
    let last
    for (let shots = 1; shots <= SETTLE_LIMIT; shots += 1) {
      const png = await page.screenshot({ clip: area, fullPage: true, animations: 'disabled', caret: 'hide' })
      // Every change since the read after the shot before: during this shot, and between the two.
      const changed = await changes()
      const quiet = changed.length === 0
      if (previous !== undefined && previous.equals(png) && quietBefore && quiet) return { png, shots }
      last = changed.at(-1) ?? last
      previous = png
      quietBefore = quiet
    }
    const why = last === undefined ? 'no two shots in a row were the same' : `the page kept changing while it was shot (the last change: the ${last})`
    throw new Error(`the picture did not settle in ${String(SETTLE_LIMIT)} shots: ${why}`)
  } finally {
    await page.evaluate(() => {
      window.__picturesChanges?.observer.disconnect()
      delete window.__picturesChanges
    })
  }
}

/**
 * `bytes` of type `from` re-encoded by Chromium's canvas as `to`, in a blank
 * page of the same browser. Refuses when the canvas answers with another
 * type, which is what it does, silently, for one it cannot encode.
 */
export async function encode(browser, bytes, { from, to, quality }) {
  const page = await browser.newPage()
  try {
    const url = await page.evaluate(
      async ({ data, type, q }) => {
        const image = new Image()
        image.src = data
        await image.decode()
        const canvas = document.createElement('canvas')
        canvas.width = image.naturalWidth
        canvas.height = image.naturalHeight
        canvas.getContext('2d').drawImage(image, 0, 0)
        return canvas.toDataURL(type, q)
      },
      { data: `data:${from};base64,${bytes.toString('base64')}`, type: to, q: quality },
    )
    if (!url.startsWith(`data:${to};`))
      throw new Error(`Chromium's canvas did not encode ${to}: it answered ${url.slice(5, url.indexOf(';'))}, as it does for a type it cannot encode`)
    return Buffer.from(url.slice(url.indexOf(',') + 1), 'base64')
  } finally {
    await page.context().close()
  }
}

/** A shot as the WebP the README shows. */
export const webp = (browser, png) => encode(browser, png, { from: 'image/png', to: 'image/webp', quality: QUALITY })

/** A committed WebP decoded back to PNG, for a reviewer to open at 100%. */
export const decodedPng = (browser, picture) => encode(browser, picture, { from: 'image/webp', to: 'image/png', quality: 1 })

/**
 * Each part's accessibility snapshot, by part name: the text the record
 * holds and `--check` compares. Refuses an empty one. An object URL's UUID,
 * new on every walk, is said as `<uuid>` (aria-text.mjs's steadied).
 */
export async function text(parts, { scene }) {
  const said = {}
  for (const [name, locator] of Object.entries(parts)) {
    const snapshot = await locator.ariaSnapshot()
    if (snapshot.trim() === '') throw new Error(`${scene}: the part ${name} says nothing, so nothing would hold its picture`)
    said[name] = steadied(snapshot)
  }
  return said
}

/**
 * One scene's picture, as capture takes it: the fonts arrived, the canvases
 * drawn, the page still, the clip measured and checked, the shot settled,
 * each part's text, and the parts' boxes measured again so a picture whose
 * parts moved while it was taken is refused.
 */
export async function take(page, parts, { scene, families: names, within, keepFocus = false }) {
  await fonts(page, names, { within })
  await canvasesDrawn(page, parts, { within })
  await still(page, { keepFocus })
  const area = await clip(page, parts, { scene })
  const { png, shots } = await shoot(page, area, { keepFocus })
  const said = await text(parts, { scene })
  const after = await measured(page, parts)
  if (JSON.stringify(after) !== JSON.stringify(area))
    throw new Error(`${scene}: the parts moved while the picture was taken, from ${JSON.stringify(area)} to ${JSON.stringify(after)}`)
  return { png, shots, clip: area, text: said }
}

/** What the pictures were taken on: one look for every record. `playwright` is the app's installed version. */
export function look(browser, { playwright, fonts: versions }) {
  return { platform: `${process.platform}-${process.arch}`, playwright, chromium: browser.version(), fonts: versions }
}
