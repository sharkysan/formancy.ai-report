// What a person does in each builder, in a real browser, on the service
// inspection: a palette entry dragged with a pointer onto an outline row
// and inserted there, selected and focused; the place chooser opened from
// a palette entry with Enter, the keyboard on its first place, and closed
// with Escape, the keyboard back on the entry; Final, which prints a final
// render, and back; and the Preview's Zoom in, which draws every page
// larger, on white, with ink. Then the room made for the middle pane
// (gate-room.mjs), an image added (gate-images.mjs), the invoice's QR-bill
// edited (gate-payment-part.mjs) and the e-invoice's e-invoice edited
// (gate-e-invoice.mjs). Each is undone, so the journey goes on where the
// starters left off.
//
// React binds a pointer's drag to pointer events and Angular to HTML drag
// and drop (0012), and Playwright drives both as a mouse; where focus goes
// when a framework redraws is the browser's to say. Found by role and
// accessible name, but for where an element is drawn, which the drag and
// the zoom measure, and which of the chooser's places has the keyboard.

import { eInvoiceChecks } from './gate-e-invoice.mjs'
import { imageChecks } from './gate-images.mjs'
import { describeFocus, drawnPages } from './gate-page.mjs'
import { paymentPartChecks } from './gate-payment-part.mjs'
import { roomChecks } from './gate-room.mjs'
import { editorOf, open, present, previewInView, previewOf, settled, showing, WITHIN } from './gate-steps.mjs'

/**
 * A pointer drag from `source` to `position` on `target`, as a person makes
 * one. Both are in view before the press, so nothing scrolls between the
 * press and the release: the source at the top of the window, and the
 * target, below it, scrolled into view only if it is not then. Scrolled
 * into view one after the other, a target past the fold took the source
 * above the window's top and the press missed it -- on CI, at 320 pixels
 * with the web fonts refused, where Linux's fallback is wider. Two ends
 * that cannot be in view at once are said, with where they are. Then the
 * pointer moves in steps, as a hand does. Chromium starts an HTML drag
 * (Angular's builder, 0012) only once the pointer has moved some way with
 * the button held, and in the headless shell on Linux one jump from the
 * press to the target never started it: locator.dragTo passed on Windows
 * and inserted nothing on CI. Returns where the press and the release were,
 * and what was under each, for a drag that placed nothing to say so.
 */
async function drag(page, source, target, position) {
  await source.evaluate((element) => element.scrollIntoView({ block: 'start', inline: 'nearest' }))
  await target.scrollIntoViewIfNeeded()
  const from = await source.boundingBox()
  const to = await target.boundingBox()
  if (from === null || to === null) throw new Error('a drag needs both ends drawn')
  const { width, height } = page.viewportSize() ?? { width: 0, height: 0 }
  // A pixel either way for a layout in fractions of one: scrolled to the top, a box can stand a third of a pixel above it.
  const seen = (box) => box.x >= -1 && box.y >= -1 && box.x + box.width <= width + 1 && box.y + box.height <= height + 1
  const at = (box) => `${String(Math.round(box.x))},${String(Math.round(box.y))} ${String(Math.round(box.width))}x${String(Math.round(box.height))}`
  if (!seen(from) || !seen(to))
    throw new Error(
      `a drag needs both ends in view at once, and in ${String(width)}x${String(height)} the source is at ${at(from)} and the target at ${at(to)}`,
    )
  const under = (x, y) =>
    page.evaluate(
      ([px, py]) => {
        const element = document.elementFromPoint(px, py)
        return element === null
          ? 'nothing'
          : `<${element.tagName.toLowerCase()}> "${(element.getAttribute('aria-label') ?? element.textContent ?? '').trim().slice(0, 40)}"`
      },
      [x, y],
    )
  const said = `pressed at ${at(from)} on ${await under(from.x + from.width / 2, from.y + from.height / 2)}, released at ${String(Math.round(to.x + position.x))},${String(Math.round(to.y + position.y))} on ${await under(to.x + position.x, to.y + position.y)}`
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2)
  await page.mouse.down()
  for (let step = 1; step <= 12; step += 1) {
    const share = step / 12
    await page.mouse.move(
      from.x + from.width / 2 + (to.x + position.x - (from.x + from.width / 2)) * share,
      from.y + from.height / 2 + (to.y + position.y - (from.y + from.height / 2)) * share,
    )
  }
  await page.mouse.move(to.x + position.x, to.y + position.y)
  await page.mouse.up()
  return said
}

/**
 * What a person does with a pointer, the place chooser, the Final switch
 * and the Preview's zoom, in the builder `framework` names, on the service
 * inspection; each undone, so the next starts where the starters left off.
 */
export async function interactions(gate, page, framework) {
  const { check } = gate
  const editor = editorOf(page)
  await open(page, 'service-inspection')
  await settled(page)

  // A pointer: a palette entry dragged onto the upper half of an outline row
  // lands before it. React binds pointer events, Angular HTML drag and drop
  // (0012), and Playwright drives both as a mouse. The row is the report
  // header's second, in view without scrolling the pane: a pane scrolled
  // between the press and the move is a drag Playwright makes and a person
  // does not.
  const outline = await showing(editor, 'Outline', editor.getByRole('tree', { name: 'Outline', exact: true }))
  const rows = await outline.getByRole('treeitem').count()
  const entry = editor.getByRole('group', { name: 'Insert', exact: true }).getByRole('button', { name: 'Spacer', exact: true })
  const dragged = await drag(page, entry, outline.getByRole('treeitem').nth(1), { x: 24, y: 4 })
  const dropped = outline.getByRole('treeitem', { name: 'Spacer (spacer)', exact: true, selected: true })
  const inserted = await present(dropped, 'selected row "Spacer (spacer)"')
  check(`${framework}: a palette entry a pointer drags onto a row is inserted there, selected`, inserted === null ? null : `${inserted}: ${dragged}`)
  const after = await outline.getByRole('treeitem').count()
  check(`${framework}: and nothing else is`, after === rows + 1 ? null : `${String(rows)} rows before, ${String(after)} after`)
  const onDropped = (await dropped.count()) === 1 && (await dropped.evaluate((element) => element === document.activeElement))
  check(`${framework}: and the keyboard is on its row`, onDropped ? null : `the focus is on ${await describeFocus(page)}`)
  // Undone only when the drop changed something: a failed drop leaves Undo
  // disabled, and clicking it would end the gate on a timeout instead of
  // letting the checks after this one report.
  if (after !== rows) {
    await editor.getByRole('button', { name: 'Undo', exact: true }).click()
    await settled(page)
  }

  // The place chooser, the keyboard's path for every drag (formancy.ai 0046).
  const text = await showing(editor, 'Outline', editor.getByRole('group', { name: 'Insert', exact: true }).getByRole('button', { name: 'Text', exact: true }))
  await text.focus()
  await page.keyboard.press('Enter')
  const chooser = editor.getByRole('dialog', { name: 'Insert Text: choose a place', exact: true })
  check(`${framework}: Enter on a palette entry opens the place chooser`, await present(chooser, 'place chooser'))
  const onFirst = (await chooser.count()) === 1 && (await chooser.evaluate((dialog) => dialog.querySelector('button') === document.activeElement))
  check(`${framework}: with the keyboard on its first place`, onFirst ? null : `the focus is on ${await describeFocus(page)}`)
  await page.keyboard.press('Escape')
  const closed = await chooser.waitFor({ state: 'detached', timeout: 5_000 }).then(
    () => null,
    () => 'the chooser is still open',
  )
  check(`${framework}: Escape closes it`, closed)
  check(
    `${framework}: and puts the keyboard back on the palette entry`,
    (await text.evaluate((element) => element === document.activeElement)) ? null : `the focus is on ${await describeFocus(page)}`,
  )

  // Final, and back: the switch reaches the runtime, and the status says which printed.
  await previewInView(page)
  const final = previewOf(page).getByRole('checkbox', { name: 'Final', exact: true })
  await final.check()
  const finalPrinted = await settled(page, /^Final render: printed(, with \d+ warnings?)?\.$/).then(
    () => null,
    (error) => error.message,
  )
  check(`${framework}: Final prints a final render`, finalPrinted)
  await final.uncheck()
  await settled(page)

  // The Preview's zoom: every page drawn again, larger, on white, with ink.
  const firstPage = previewOf(page).getByRole('group', { name: /^Page 1 of \d+$/ })
  const before = await firstPage.evaluate((sheet) => sheet.getBoundingClientRect().width)
  await previewOf(page).getByRole('group', { name: 'Zoom', exact: true }).getByRole('button', { name: 'Zoom in', exact: true }).click()
  await settled(page)
  const zoomed = await drawnPages(page, { within: WITHIN })
  const larger = await firstPage.evaluate((sheet) => sheet.getBoundingClientRect().width)
  const drawnLarger = larger > before && zoomed.length > 0 && zoomed.every((sheet) => sheet.white > 0.5 && sheet.ink > 0.001)
  check(
    `${framework}: the Preview's Zoom in draws every page larger, on white, with ink`,
    drawnLarger ? null : `page 1 was ${String(before)}px wide and is ${String(larger)}px, with ${String(zoomed.length)} pages drawn`,
  )
  await previewOf(page).getByRole('button', { name: 'Fit width', exact: true }).click()
  await settled(page)

  // The room made for the middle pane: a pane hidden and shown, the Preview hidden and shown.
  await roomChecks(gate, page, framework)
  await imageChecks(gate, page, framework)
  await paymentPartChecks(gate, page, framework)
  await eInvoiceChecks(gate, page, framework)
}
