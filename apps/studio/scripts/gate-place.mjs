// Where the Studio's Preview stands (0029), and what a person meets there,
// measured in the browser because it is layout, focus and pixels: in a
// window with no room beside the builder, the Preview in the builder's
// middle, in the design view's place, with the outline and the properties
// beside it; past that width, beside the builder, as 0019 had it.
//
// At the start of every pass, in each builder, on the starter the Studio
// opens on, as it opens:
//
//   - the Preview stands where the width says, read from the stylesheet's
//     widest breakpoint (gate-page.mjs's `passes()`), the bar's Preview
//     says it is on, and in the middle the outline and the properties are
//     beside it -- or, where the builder shows one pane at a time, it is
//     the pane shown;
//   - where the pass is a first viewport, the window holds the Studio
//     without scrolling, and the Preview's first page is in it, unscrolled:
//     its top edge, its first line of text, the page painted on top where
//     it is in view, drawn on white with ink; how much of it, and at what
//     fit zoom, measured;
//   - in a light pass, which walks no journey, that state measured as the
//     journey measures each starter's;
//   - in the middle, the toolbar's Design view takes the Preview out and
//     the design view back, the keyboard in it, the bar's Preview off and
//     the side panes beside it -- measured, as the journey's states are --
//     and Enter on the bar's Preview stands the Preview there again, the
//     keyboard kept on the button and the builder's live region saying how
//     to bring the design view back; and no rule of the builder's but the
//     workbench's inert `.wb *` reaches inside the Preview there;
//   - beside, the toolbar's Design view leaves the Preview beside it, on;
//     and the window narrowed to the widest breakpoint stands it in the
//     middle, printed, and widened again beside, printed;
//   - in the middle, the paper's width changed the moment an edit's PDF is
//     printed, before PDF.js has it -- a side pane hidden, or where the
//     builder shows one pane the bar's Preview bringing it into sight from
//     the properties -- leaves the Studio standing and the PDF redrawn.
//
// Elements are found by role and accessible name; what the accessibility
// tree has no word for -- a pane's box, a scroll, what is painted on top --
// is read from the DOM, by the builders' own hooks.

import { builderRulesInThePreview, describeFocus, drawnPages } from './gate-page.mjs'
import { designViewOf, editorOf, previewOf, printed, said, setField, standing, toggleOf, WITHIN } from './gate-steps.mjs'

const tools = (editor) => editor.getByRole('toolbar', { name: 'Report tools', exact: true })

/** The Preview standing in the builder's middle: the region the builder draws it in, named after it. */
const inTheMiddle = (page) => editorOf(page).getByRole('region', { name: 'Preview', exact: true })

/**
 * Null once `locator` is in `state`, within a few seconds -- zoneless
 * Angular draws a frame or two after the press -- or `why`: a sentence, or
 * what says one once the wait is over.
 */
const until = (locator, state, why) =>
  locator.waitFor({ state, timeout: 5_000 }).then(
    () => null,
    () => (typeof why === 'function' ? why() : why),
  )

/** Where the Preview stands, said as a failure says it. */
const stands = (page) => async () => `the Preview stands ${await standing(page)}`

/** Null when the bar's Preview says `on`, or what it says. */
async function saysOn(page, on) {
  const pressed = await toggleOf(page).getAttribute('aria-pressed')
  return pressed === String(on) ? null : `aria-pressed is ${String(pressed)}`
}

/** The builder's three columns as drawn: each pane's left, right and top, or null where it is not drawn. */
function columns(page) {
  return editorOf(page).evaluate((editor) => {
    const box = (selector) => {
      const element = editor.querySelector(selector)
      if (element === null || !element.checkVisibility()) return null
      const { left, right, top } = element.getBoundingClientRect()
      return { left, right, top }
    }
    return { outline: box('[data-pane="outline"]'), middle: box('[data-pane="canvas"]'), properties: box('[data-pane="properties"]') }
  })
}

/** Null when the outline stands left of the middle pane and the properties right of it, on one line, or where they do not. */
function besideIt({ outline, middle, properties }) {
  if (outline === null || middle === null || properties === null) return `drawn: ${['outline', 'middle', 'properties'].filter((pane) => ({ outline, middle, properties })[pane] !== null).join(', ') || 'none'}`
  const placed = outline.right <= middle.left + 1 && middle.right <= properties.left + 1 && Math.abs(outline.top - middle.top) < 1 && Math.abs(properties.top - middle.top) < 1
  const at = (box) => `${String(Math.round(box.left))}..${String(Math.round(box.right))} at ${String(Math.round(box.top))}`
  return placed ? null : `the outline at ${at(outline)}, the middle at ${at(middle)}, the properties at ${at(properties)}`
}

/** Null once the design view is drawn with the keyboard in it, within a few seconds, or where the keyboard is. */
async function designViewFocused(page) {
  const deadline = Date.now() + 5_000
  for (;;) {
    const view = designViewOf(page)
    if ((await view.count()) === 1 && (await view.evaluate((element) => element === document.activeElement))) return null
    if (Date.now() > deadline) return (await view.count()) === 0 ? 'no design view is drawn' : `the focus is on ${await describeFocus(page)}`
    await page.waitForTimeout(50)
  }
}

/** The Preview's first page as the window shows it, unscrolled. */
async function firstViewport(gate, page, framework) {
  const { check } = gate
  const first = previewOf(page).getByRole('group', { name: /^Page 1 of \d+$/ })
  const seen = await first.evaluate((sheet) => {
    // What is painted of the page: its box cut by every ancestor that clips it, and by the window.
    const own = sheet.getBoundingClientRect()
    let [left, top, right, bottom] = [own.left, own.top, own.right, own.bottom]
    for (let ancestor = sheet.parentElement; ancestor !== null && ancestor !== document.documentElement; ancestor = ancestor.parentElement) {
      const style = getComputedStyle(ancestor)
      const box = ancestor.getBoundingClientRect()
      if (style.overflowX !== 'visible') [left, right] = [Math.max(left, box.left), Math.min(right, box.right)]
      if (style.overflowY !== 'visible') [top, bottom] = [Math.max(top, box.top), Math.min(bottom, box.bottom)]
    }
    ;[left, top, right, bottom] = [Math.max(left, 0), Math.max(top, 0), Math.min(right, innerWidth), Math.min(bottom, innerHeight)]
    const runs = [...sheet.querySelectorAll('.paper-text span')].filter((span) => span.children.length === 0 && (span.textContent ?? '').trim() !== '').map((span) => span.getBoundingClientRect())
    const whole = (box) => box.top >= top - 0.5 && box.bottom <= bottom + 0.5 && box.left >= left - 0.5 && box.right <= right + 0.5
    const firstLine = runs.length === 0 ? null : runs.reduce((a, b) => (b.top < a.top ? b : a))
    const hit = right > left && bottom > top ? document.elementFromPoint((left + right) / 2, (top + bottom) / 2) : null
    return {
      scrolled: window.scrollY,
      scrolls: document.documentElement.scrollHeight - innerHeight,
      top: own.top,
      shown: Math.max(0, bottom - top),
      height: own.height,
      inView: runs.filter(whole).length,
      firstLine: firstLine !== null && whole(firstLine),
      onTop: hit !== null && sheet.contains(hit),
    }
  })
  check(`${framework}: the window holds the Studio without scrolling`, seen.scrolled === 0 && seen.scrolls <= 0 ? null : `the page is scrolled ${String(seen.scrolled)}px, and scrolls ${String(seen.scrolls)}px`)
  check(
    `${framework}: and the Preview's first page is in it, unscrolled, from its top edge to its first line of text`,
    seen.top >= 0 && seen.firstLine ? null : `its top edge is at ${String(Math.round(seen.top))}px of a ${String(page.viewportSize()?.height)}px window, and its first line is ${seen.firstLine ? '' : 'not '}in view`,
  )
  check(`${framework}: and what is in view of it is the page, painted on top`, seen.onTop ? null : 'the point at the middle of what is in view of it is something else')
  const [sheet] = await drawnPages(page, { within: WITHIN })
  check(`${framework}: and it is drawn on white paper, with ink on it`, sheet !== undefined && sheet.white > 0.5 && sheet.ink > 0.001 ? null : sheet === undefined ? 'no page was drawn' : `${(sheet.white * 100).toFixed(1)}% white, ${(sheet.ink * 100).toFixed(2)}% ink`)
  const zoom = /(\d+)\s*%/.exec(await previewOf(page).getByRole('group', { name: 'Zoom', exact: true }).innerText())
  // Measurements are kept for the whole run, not under a pass: each says its window.
  const at = `${framework}, ${String(page.viewportSize()?.width)} by ${String(page.viewportSize()?.height)}`
  gate.measure({ name: `${at}: the Preview's first page, in view of the first viewport`, value: Math.round(seen.shown), unit: `px of its ${String(Math.round(seen.height))}` })
  gate.measure({ name: `${at}: the Preview's first page, its runs of text in view`, value: seen.inView, unit: 'runs' })
  gate.measure({ name: `${at}: the Preview's fit zoom`, value: zoom === null ? null : Number(zoom[1]), unit: '%' })
}

/** In the middle: the toolbar's Design view takes the Preview's place back, and the bar's Preview gives it back. */
async function swap(gate, page, framework, { onePane, measured }) {
  const { check } = gate
  const editor = editorOf(page)
  const toggle = toggleOf(page)
  await tools(editor).getByRole('button', { name: 'Design view', exact: true }).click()
  check(`${framework}: the toolbar's Design view takes the Preview out of the design view's place`, await until(previewOf(page), 'detached', 'the Preview is still there'))
  check(`${framework}: and puts the design view back, the keyboard in it`, await designViewFocused(page))
  check(`${framework}: and the bar's Preview says it is off`, await saysOn(page, false))
  if (!onePane) check(`${framework}: with the outline and the properties beside the design view`, besideIt(await columns(page)))
  await measured(gate, page, `the design view back in its place, ${framework}`)

  // Back, by the keyboard: the bar's Preview is a toggle, and keeps it.
  await toggle.focus()
  await page.keyboard.press('Enter')
  check(`${framework}: Enter on the bar's Preview stands the Preview in the design view's place again`, await until(inTheMiddle(page), 'visible', stands(page)))
  check(`${framework}: and says it is on`, await saysOn(page, true))
  check(`${framework}: and keeps the keyboard on itself`, (await toggle.evaluate((element) => element === document.activeElement)) ? null : `the focus is on ${await describeFocus(page)}`)
  const sentence = said('status.hostViewShown', { view: 'Preview', pane: said('pane.canvas') })
  check(`${framework}: and the builder's live region says how to bring the design view back`, await until(editor.getByRole('status').filter({ hasText: sentence }), 'attached', `no status of the builder's says "${sentence}"`))
  check(
    `${framework}: and the Preview prints there`,
    await printed(page).then(
      () => null,
      (error) => error.message.split('\n')[0],
    ),
  )
  if (!onePane) check(`${framework}: with the outline and the properties beside it again`, besideIt(await columns(page)))
}

/**
 * In the middle: the paper's width changed the moment an edit's PDF is
 * printed, while PDF.js still loads it -- a side pane's Hide, or, where the
 * builder shows one pane, the bar's Preview bringing it into sight from the
 * properties the edit was made in, each pressed by the page itself as the
 * Preview's status turns. The PDF on the paper is redrawn at the new width:
 * the document under it was once let go of as the newer PDF arrived, and
 * the redraw threw and took the whole Studio down. The edit is undone after.
 */
async function resizedAsItPrints(gate, page, framework, { onePane }) {
  const { check } = gate
  const errors = []
  const heard = (error) => errors.push(error.message)
  page.on('pageerror', heard)
  try {
    await page.evaluate((press) => {
      window.pressedAsPrinted = undefined
      const status = document.querySelector('.preview-status')
      const done = /^Preview: printed(, with \d+ warnings?)?\.$/
      let was = status?.textContent ?? ''
      const observer = new MutationObserver(() => {
        const now = status?.textContent ?? ''
        if (done.test(now) && !done.test(was)) {
          observer.disconnect()
          const button =
            press === 'bar' ? document.querySelector('.studio-bar button[aria-pressed]') : document.querySelector('[data-report-part="editor"] [data-pane="outline"] [data-report-part="hide-pane"]')
          window.pressedAsPrinted = { button: button?.textContent ?? null, busy: document.querySelector('.paper')?.getAttribute('aria-busy') ?? null }
          button?.click()
        }
        was = now
      })
      if (status !== null) observer.observe(status, { childList: true, characterData: true, subtree: true })
    }, onePane ? 'bar' : 'hide')
    await setField(editorOf(page), 'Title', 'Printed as the paper moved')
    const pressed = await page
      .waitForFunction(() => window.pressedAsPrinted, undefined, { timeout: WITHIN })
      .then((handle) => handle.jsonValue())
      .catch(() => null)
    const what = onePane ? "the bar's Preview, bringing the Preview into sight from the properties" : "the outline's Hide"
    check(
      `${framework}: ${what}, pressed the moment an edit prints, while PDF.js still loads it`,
      pressed !== null && pressed.button !== null && pressed.busy === 'true' ? null : pressed === null ? 'the Preview never said it printed the edit' : `pressed ${String(pressed.button)} with the paper's aria-busy ${String(pressed.busy)}`,
    )
    const redrawn = await printed(page).then(
      () => null,
      (error) => error.message.split('\n')[0],
    )
    const alive = (await editorOf(page).count()) === 1
    check(`${framework}: leaves the Studio standing, the PDF redrawn on the paper`, errors.length === 0 && alive && redrawn === null ? null : [...errors, alive ? redrawn : 'the builder is gone'].filter(Boolean).slice(0, 3).join('; '))
  } finally {
    page.off('pageerror', heard)
  }
  // As it was: the outline back beside the Preview -- the keyboard going
  // into it selects its row -- the edit undone, the report's own
  // properties shown, printed.
  const editor = editorOf(page)
  if (!onePane) await tools(editor).getByRole('button', { name: 'Outline', exact: true }).click()
  await tools(editor).getByRole('button', { name: 'Undo', exact: true }).click()
  const report = editor.getByRole('button', { name: said('properties.report'), exact: true })
  if (await report.isVisible()) await report.click()
  await printed(page)
}

/** Past the widest breakpoint: the Preview stays beside, and crossing the breakpoint moves it into the middle and back. */
async function beside(gate, page, framework, { width, height, widest }) {
  const { check } = gate
  await tools(editorOf(page)).getByRole('button', { name: 'Design view', exact: true }).click()
  check(`${framework}: beside the builder, the toolbar's Design view puts the keyboard in the design view`, await designViewFocused(page))
  const left = await standing(page)
  check(`${framework}: and leaves the Preview beside it`, left === 'beside' ? null : `the Preview stands ${left}`)
  check(`${framework}: on`, await saysOn(page, true))
  const print = () =>
    printed(page).then(
      () => null,
      (error) => error.message.split('\n')[0],
    )
  await page.setViewportSize({ width: widest, height })
  check(`${framework}: narrowed to the ${String(widest)}px breakpoint, the window stands the Preview in the builder's middle`, await until(inTheMiddle(page), 'visible', stands(page)))
  check(`${framework}: on, and printed there`, (await saysOn(page, true)) ?? (await print()))
  await page.setViewportSize({ width, height })
  await inTheMiddle(page).waitFor({ state: 'detached', timeout: 5_000 }).catch(() => undefined)
  const widened = await standing(page)
  check(`${framework}: widened again to ${String(width)}px, beside the builder again`, widened === 'beside' ? null : `the Preview stands ${widened}`)
  check(`${framework}: on, and printed there`, (await saysOn(page, true)) ?? (await print()))
}

/** In the middle: what of the builder's stylesheets reaches inside the Preview. */
async function rulesInIt(gate, page, framework) {
  const { check } = gate
  const found = await builderRulesInThePreview(page)
  check(
    `${framework}: no rule of the builder's reaches inside the Preview in its middle but the workbench's inert .wb *, which declares transitions alone`,
    found.reached.length === 0 && found.broken.length === 0 ? null : [...found.reached, ...found.broken.map((selector) => `${selector} could not be matched`)].slice(0, 6).join('; '),
  )
  // A guard on the guard: the rules were read, they reach the builder's own
  // outline beside the Preview, and the Preview held its controls and paper.
  const missing = ['button', 'input', 'canvas', 'span'].filter((tag) => !found.tags.includes(tag))
  check(
    `${framework}: which matched the builder's rules against the Preview's controls and paper, and against the outline beside it`,
    found.besideReached > 0 && missing.length === 0 && found.unread.length === 0 ? null : `${String(found.besideReached)} rules of the builder's reach its outline; no ${missing.join(', ')} in the Preview; ${found.unread.join(', ') || 'every stylesheet'} unread`,
  )
}

/**
 * The checks of where the Preview stands, in the builder `framework` names,
 * at the pass `entry` describes (gate-page.mjs's `passes()`), on the
 * starter the Studio has open, as it is: `measured` is the journey's
 * measure of a state (browser-test.mjs), made of the design view back in
 * its place, and in a light pass of the state the Studio opens in. They
 * leave the Preview where they found it, shown, and the window at the
 * pass's size.
 */
export async function placeChecks(gate, page, framework, entry, { measured }) {
  const { check } = gate
  const { middle, onePane } = entry
  check(
    `${framework}: the Studio shows the Preview, printed`,
    await printed(page).then(
      () => null,
      (error) => error.message.split('\n')[0],
    ),
  )
  const where = await standing(page)
  const drawn = (await designViewOf(page).count()) === 0 ? '' : ', and the design view is drawn'
  check(`${framework}: the Preview stands ${middle ? 'in the builder’s middle, in the design view’s place' : 'beside the builder'}`, where === (middle ? 'in the middle' : 'beside') && (drawn === '' || !middle) ? null : `it stands ${where}${drawn}`)
  check(`${framework}: and the bar's Preview says it is on`, await saysOn(page, true))
  if (middle && onePane) {
    const { outline, properties } = await columns(page)
    check(`${framework}: the pane the builder shows, and the only one`, outline === null && properties === null ? null : 'another pane is drawn beside it')
  }
  if (middle && !onePane) check(`${framework}: with the outline and the properties beside it`, besideIt(await columns(page)))
  if (entry.firstViewport) await firstViewport(gate, page, framework)
  // A light pass walks no journey, whose states measure the Preview as each starter opens: this one is measured here.
  if (entry.light) await measured(gate, page, `as the Studio opens, ${framework}`)
  if (middle) {
    await rulesInIt(gate, page, framework)
    await swap(gate, page, framework, { onePane, measured })
    await resizedAsItPrints(gate, page, framework, { onePane })
  } else await beside(gate, page, framework, entry)
}
