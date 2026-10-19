// An image added in a real browser (0033): what jsdom cannot show of it.
// Its file chooser is the platform's, opened only by a click inside a
// person's activation; clearing a file input empties its files there, and
// choosing the same file twice is a change only if the input was cleared;
// Space activates a button on its key up, which the Angular builder's
// jsdom suite does not fire; and the bytes the page keeps must reach the
// Preview's PDF, drawn by Chromium's own streams, without a request.
// Playwright's chooser fires a change for any file it is given, the same
// one included, so whether the input was cleared is read from the input
// itself, the one element found in the DOM: a hidden input has no role.
//
// On the quotation, in the builder `framework` names, at every pass of the
// journey: Add image… reached by Tab from the palette's last kind and
// pressed with Enter, Playwright's file chooser answered with the
// scenarios' PNG -- the press and the wait for the chooser started
// together, since the chooser opens inside the press -- the keyboard still
// on the button, and the input empty again, its value and its files, so
// that the same file chosen again is a change; the same file chosen again
// with Space, which the live region says the report holds already; the
// palette's Image placed in the first place the chooser offers, and the
// Download PDF read back with PDF.js: one image on its first page, at the
// left margin and the default box's size, where it had none; both steps
// undone, and the PDF without it, and redone, and the PDF with it again
// from the bytes the page kept; an SVG that holds text refused with what
// to do; an SVG with a script and metadata added, what cleaning removed
// said; and, from the
// first press to the last PDF read, nothing sent: no request by the page
// but to `blob:` and `data:` addresses and GETs, without a query, of the
// files `vite build` wrote -- PDF.js's worker, loaded again for each PDF it
// opens -- and no WebSocket at all, which a request listener never hears
// of. A GET of the Studio's own path with a query would carry what it asks
// into the server's log. Everything is undone, so the journey goes on from
// the quotation as it was.
//
// Found by role and accessible name, but for the Download PDF's bytes,
// which the gate fetches as the page offers them, and the requests, which
// are the browser's to report.

import { readdirSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { SCENARIO_PNG } from '@formancy/report-builder-core'
import { readPdf } from '@formancy/report-corpus'
import { describeFocus } from './gate-page.mjs'
import { editorOf, open, previewInView, previewOf, said, settled, showing, WITHIN } from './gate-steps.mjs'

/** The quotation's left margin, where an image placed first in its report header starts: 20 mm, in points. */
const MARGIN = 56.69
/** The box Insert's Image gives an image, in points, which the scenarios' PNG, 2 by 1 pixels, fills at `contain`. */
const BOX = { width: 100, height: 50 }

const PNG = { name: 'stamp.png', mimeType: 'image/png', buffer: Buffer.from(SCENARIO_PNG) }
/** An SVG whose words are text, which a report draws only as outlines (0030). */
const WORDS = { name: 'wordmark.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 20"><text x="0" y="15">Firm</text></svg>') }
/** A mark with what cleaning removes and says: metadata and a script. */
const MARK = {
  name: 'seal.svg',
  mimeType: 'image/svg+xml',
  buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><metadata>An invented seal</metadata><script>alert(1)</script><circle cx="20" cy="20" r="18" fill="#1f4e79"/></svg>'),
}

/** Null once the live region announces `text`, within the gate's wait, or what it says instead. */
const announced = (editor, text) =>
  editor
    .getByRole('status')
    .filter({ hasText: text })
    .first()
    .waitFor({ timeout: WITHIN })
    .then(
      () => null,
      async () => `the live region says ${JSON.stringify(await editor.locator('[data-report-part="status"]').innerText())}`,
    )

/**
 * The page's file choosers, caught from now until `close`: Playwright
 * starts catching one only once a listener is there, and a listener added
 * by the press's own wait raced the press on the gate's first pass, where
 * Chromium's chooser opened uncaught. One listener for every press, and a
 * round trip to the page, so the catching has begun before the first.
 */
async function choosers(page) {
  const opened = []
  const waiting = []
  const listener = (chooser) => {
    const next = waiting.shift()
    if (next === undefined) opened.push(chooser)
    else next(chooser)
  }
  page.on('filechooser', listener)
  await page.evaluate(() => null)
  return {
    /**
     * The chooser `press` opens, answered with `file`. Null once chosen, or
     * why no chooser opened within a few seconds of the press.
     */
    async choose(press, file) {
      await press()
      const chooser =
        opened.shift() ??
        (await new Promise((resolve) => {
          const timer = setTimeout(() => {
            waiting.splice(waiting.indexOf(answer), 1)
            resolve(null)
          }, 5_000)
          const answer = (caught) => {
            clearTimeout(timer)
            resolve(caught)
          }
          waiting.push(answer)
        }))
      if (chooser === null) return 'no file chooser opened'
      await chooser.setFiles(file)
      return null
    },
    close: () => page.off('filechooser', listener),
  }
}

/**
 * Until the Download PDF the Preview offers draws `count` images on its
 * first page, as the page prints after an edit: the boxes of them, or why
 * not, with the last count read.
 */
async function untilImages(page, count) {
  const deadline = Date.now() + WITHIN
  let seen = 'no PDF'
  let read = null
  for (;;) {
    await previewInView(page)
    const link = previewOf(page).getByRole('link', { name: 'Download PDF', exact: true })
    const href = (await link.count()) === 1 ? await link.evaluate((anchor) => anchor.href) : null
    // Each PDF the Preview offers has an address of its own: one read already is not read again.
    if (href !== null && href !== read) {
      read = href
      const bytes = new Uint8Array(await page.evaluate(async (address) => [...new Uint8Array(await (await fetch(address)).arrayBuffer())], href))
      const images = (await readPdf(bytes)).pages[0]?.images ?? []
      if (images.length === count) return { images }
      seen = `${String(images.length)} images`
    }
    if (Date.now() > deadline) return { problem: `its first page drew ${seen}, not ${String(count)}, in ${String(WITHIN)} ms` }
    await page.waitForTimeout(250)
  }
}

/**
 * The toolbar's `name` -- Undo, Redo -- pressed `times` times, or fewer
 * when it has no step left: Playwright waits for an `aria-disabled` button
 * to become enabled, and a check that failed before would end the gate on
 * a timeout rather than let it report.
 */
async function press(editor, name, times) {
  const tool = editor.getByRole('toolbar', { name: said('toolbar.label'), exact: true }).getByRole('button', { name, exact: true })
  for (let time = 0; time < times; time += 1) {
    if ((await tool.getAttribute('aria-disabled')) === 'true') return
    await tool.click()
  }
}

/** Every file `vite build` wrote, by its path under the Studio's base, read when the checks start: the build is there by then. */
function builtFiles() {
  const dist = fileURLToPath(new URL('../dist/', import.meta.url))
  return new Set(
    readdirSync(dist, { recursive: true, withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => relative(dist, join(entry.parentPath, entry.name)).split(sep).join('/')),
  )
}

/**
 * Whether the page asking for `address` by `method` sends nothing: a
 * `blob:` or `data:` address, or a GET without a query of a file the build
 * wrote, under `studio`, the Studio's base.
 */
function sendsNothing(method, address, studio, built) {
  const url = new URL(address)
  if (url.protocol === 'blob:' || url.protocol === 'data:') return true
  if (method !== 'GET' || url.search !== '' || url.origin !== studio.origin || !url.pathname.startsWith(studio.pathname)) return false
  const path = decodeURIComponent(url.pathname.slice(studio.pathname.length))
  return built.has(path === '' ? 'index.html' : path)
}

/** The keyboard on `element`, or where it is instead. */
const onIt = async (page, element) => ((await element.evaluate((node) => node === document.activeElement)) ? null : `the keyboard is on ${await describeFocus(page)}`)

/** The checks, in the builder shown, which `framework` names. */
export async function imageChecks(gate, page, framework) {
  const { check } = gate
  const editor = editorOf(page)
  await open(page, 'quotation')
  await settled(page)
  const studio = new URL('.', page.url())
  const built = builtFiles()
  const asked = []
  const listen = (request) => {
    if (!sendsNothing(request.method(), request.url(), studio, built)) asked.push(`${request.method()} ${request.url()}`)
  }
  const socket = (opened) => asked.push(`a WebSocket to ${opened.url()}`)
  page.on('request', listen)
  page.on('websocket', socket)
  const files = await choosers(page)
  try {
    // Tab from the palette's last kind reaches Add image…, and Enter opens the chooser.
    const palette = editor.getByRole('group', { name: said('pane.palette'), exact: true })
    const last = await showing(editor, 'Outline', palette.getByRole('button', { name: said('kind.keepTogether'), exact: true }))
    const add = palette.getByRole('button', { name: said('images.add'), exact: true })
    await last.focus()
    await page.keyboard.press('Tab')
    check(`${framework}: Tab from the palette's last kind reaches ${said('images.add')}`, await onIt(page, add))
    check(`${framework}: Enter on it opens the file chooser`, await files.choose(() => page.keyboard.press('Enter'), PNG))
    const added = await announced(editor, said('images.added', { id: 'stamp', kind: said('kind.image') }))
    check(`${framework}: and the image chosen is added`, added)
    check(`${framework}: with the keyboard still on ${said('images.add')}`, await onIt(page, add))
    const left = await add.evaluate((button) => {
      const input = button.parentElement?.querySelector('input[type="file"]')
      return input instanceof HTMLInputElement ? { value: input.value, files: input.files?.length ?? 0 } : null
    })
    check(`${framework}: and its file input empty again, so the same file chosen again is a change`, left !== null && left.value === '' && left.files === 0 ? null : `the input holds ${JSON.stringify(left)}`)

    // The same file again, with Space: a change only because the input was cleared.
    check(`${framework}: Space on it opens the chooser again`, await files.choose(() => page.keyboard.press(' '), PNG))
    check(`${framework}: and the same file chosen again is said to be held already`, await announced(editor, said('images.already', { id: 'stamp' })))
    // Nothing added is nothing to place: Image would place the quotation's own mark. What
    // the second choice added is taken back, so the next builder starts from the quotation as it was.
    if (added !== null) {
      if ((await editor.locator('[data-report-part="status"]').innerText()).startsWith(said('images.added', { id: 'stamp', kind: said('kind.image') }))) await press(editor, said('action.undo'), 1)
      return
    }

    // Placed with Insert's Image, which draws the image just added, and printed.
    const image = palette.getByRole('button', { name: said('kind.image'), exact: true })
    await image.focus()
    await page.keyboard.press('Enter')
    const places = editor.getByRole('dialog', { name: said('places.insert', { kind: said('kind.image') }), exact: true })
    await places.waitFor({ timeout: 5_000 })
    await page.keyboard.press('Enter')
    await places.waitFor({ state: 'detached', timeout: 5_000 })
    const printed = await untilImages(page, 1)
    const [box] = printed.images ?? []
    const at = box === undefined ? null : [box.x, box.width, box.height].map((points) => Math.round(points * 100) / 100)
    check(`${framework}: placed with ${said('kind.image')}, the Download PDF draws it on its first page`, printed.problem ?? null)
    check(`${framework}: at the left margin, ${String(BOX.width)} by ${String(BOX.height)} pt`, JSON.stringify(at) === JSON.stringify([MARGIN, BOX.width, BOX.height]) ? null : `it is at ${JSON.stringify(at)}`)

    // Undone, and the PDF without it; redone, and the PDF with it, from the bytes the page kept.
    await press(editor, said('action.undo'), 2)
    check(`${framework}: both steps undone, the PDF draws no image`, (await untilImages(page, 0)).problem ?? null)
    await press(editor, said('action.redo'), 2)
    check(`${framework}: and redone, it draws the image again`, (await untilImages(page, 1)).problem ?? null)
    await press(editor, said('action.undo'), 2)
    await untilImages(page, 0)

    // An SVG that holds text is refused, saying what to do; one with a script is added, cleaned, and taken back.
    await showing(editor, 'Outline', add)
    check(`${framework}: an SVG chosen`, await files.choose(() => add.click(), WORDS))
    check(`${framework}: an SVG of text is refused with what to do`, await announced(editor, said('images.refused', { name: WORDS.name, reason: said('images.reason.svgText') })))
    check(`${framework}: another SVG chosen`, await files.choose(() => add.click(), MARK))
    const sealed = await announced(editor, said('images.added', { id: 'seal', kind: said('kind.image') }))
    check(`${framework}: an SVG with a script and metadata is added, and what cleaning removed is said`, sealed)
    check(`${framework}: naming the script`, await announced(editor, 'script'))
    if (sealed === null) await press(editor, said('action.undo'), 1)
    await settled(page)
  } finally {
    files.close()
    page.off('request', listen)
    page.off('websocket', socket)
  }
  check(`${framework}: adding and printing the images sent nothing: no request but blob: and data: addresses and GETs without a query of the files the build wrote, and no WebSocket`, asked.length === 0 ? null : asked.slice(0, 4).join(', '))
}
