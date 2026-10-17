import { QR_BILL_SIZE } from '@formancy/report-spec'
import type { ReportDefinition } from '@formancy/report-spec'
import { describe, expect, test } from 'vitest'
import { PX_PER_PT } from './geometry.js'
import type { EditorAction, EditorOutcome } from './model.js'
import { EDITOR_LOCALES } from './text.js'
import { billedReport, editorOver, richReport } from './test-support.js'

/**
 * A report with a payment part -- a Swiss QR-bill, which report-spec holds
 * at the report's level, not in a region -- in the editor. The editor has
 * no fields for the bill yet; what it must do is open such a report, keep
 * the bill through every edit, refuse a page the bill cannot be printed
 * on, and show where the slip will print.
 */

function ok(outcome: EditorOutcome): void {
  if (!outcome.ok) throw new Error(`refused: ${outcome.code} ${outcome.message}`)
}

/** `report` with `count` spacers of 20 pt more at the end of its body: a body taller than the page. */
function longer(report: ReportDefinition, count: number): ReportDefinition {
  const spacers = Array.from({ length: count }, (_, index) => ({ id: `filler-${String(index)}`, kind: 'spacer' as const, height: 20 }))
  return { ...report, regions: { ...report.regions, body: [...report.regions.body, ...spacers] } }
}

describe('a report with a payment part, in the editor', () => {
  // A bill is the report's, so an editor that rebuilt a report from its
  // regions, or a command that spread only what it knew, would print an
  // invoice without its slip, and nothing on the canvas would say so.
  test('opens with nothing to report, and every edit and its undo keep the very same bill', () => {
    const { editor, session } = editorOver(billedReport())
    expect(editor.state().diagnostics).toEqual([])
    const bill = session.document().paymentPart
    expect(bill?.kind).toBe('swissQrBill')
    const actions: EditorAction[] = [
      { type: 'select', id: 'intro' },
      { type: 'moveDown' },
      { type: 'duplicate' },
      { type: 'delete' },
      { type: 'insert', kind: 'text', target: { region: 'body', index: 0 } },
      { type: 'move', id: 'gap', target: { region: 'summary', index: 0 } },
      { type: 'select', id: null },
      { type: 'setProperty', key: '/title', value: 'Orders, invoiced' },
      { type: 'setProperty', key: '/page/margins/top', value: '15' },
      { type: 'undo' },
      { type: 'undo' },
      { type: 'redo' },
    ]
    for (const action of actions) {
      ok(editor.dispatch(action))
      expect(session.document().paymentPart, action.type).toBe(bill)
    }
    expect(session.document().title).toBe('Orders, invoiced')
  })

  // SIX prints the slip across the foot of an A4 page in portrait, and
  // report-spec refuses any other page for a report with a bill: the
  // editor shows that refusal on the field, in the validator's words, and
  // the page stays as it was.
  test('refuses a page the bill cannot be printed on, with the reason on its field', () => {
    for (const [key, value] of [
      ['/page/orientation', 'landscape'],
      ['/page/size', 'Letter'],
    ] as const) {
      const { editor, session } = editorOver(billedReport())
      const outcome = editor.dispatch({ type: 'setProperty', key, value })
      expect(outcome.ok ? 'applied' : outcome.code, key).toBe('refused')
      const field = editor.state().properties.fields.find((candidate) => candidate.key === key)
      expect(field, key).toMatchObject({ value })
      expect(field?.error, key).toMatch(/^a QR-bill is printed across the foot of an A4 page in portrait/)
      expect(session.document().page, key).toEqual(billedReport().page)
    }
  })

  // The page header and the body start at the top margin, and the slip is
  // the page's foot: a top margin past the slip's top would print the
  // invoice into it. The editor refuses the edit on the field with the
  // spec's reason, where the margin is written, rather than leaving it to
  // the first render; up to the slip's top, the margin is the author's.
  test('refuses a top margin that leaves the slip no room, with the reason on its field', () => {
    const { editor, session } = editorOver(billedReport())
    ok(editor.dispatch({ type: 'setProperty', key: '/page/margins/top', value: '192' }))
    expect(session.document().page.margins.top).toBe(544.25)
    const outcome = editor.dispatch({ type: 'setProperty', key: '/page/margins/top', value: '195' })
    expect(outcome.ok ? 'applied' : outcome.code).toBe('refused')
    const field = editor.state().properties.fields.find((candidate) => candidate.key === '/page/margins/top')
    expect(field).toMatchObject({ value: '195' })
    expect(field?.error).toMatch(/^the top margin reaches 552\.76 pt down the page, past the top of the QR-bill's slip at 544\.25 pt/)
    expect(session.document().page.margins.top).toBe(544.25)
  })
})

describe('the payment part’s band', () => {
  // Where the slip prints is room the regions do not have on the last
  // page; a design view without it would show a body that fits where the
  // PDF has none. The band is the slip's size, from the spec's one number,
  // across the whole sheet and down to its foot, as the slip ignores the
  // margins.
  test('is drawn across the foot of the sheet, as large as the slip', () => {
    const { editor } = editorOver(billedReport())
    const { paymentPart, sheet } = editor.state().canvas
    expect(sheet.pt.height).toBe(841.89)
    expect(paymentPart?.pt).toEqual({ x: 0, y: 841.89 - QR_BILL_SIZE.height, width: QR_BILL_SIZE.width, height: QR_BILL_SIZE.height })
    expect(paymentPart?.pt.width).toBe(sheet.pt.width)
  })

  // A region drawn under the band would look as if it printed beside the
  // slip. The regions stand above it, the gap a region's label takes
  // between; a body too long for the page makes the sheet longer, and the
  // band stays at its foot, below the last of them.
  test('stands below every region, the sheet growing when they reach it', () => {
    for (const report of [billedReport(), longer(billedReport(), 40)]) {
      const { editor } = editorOver(report)
      const { paymentPart, sheet, regions } = editor.state().canvas
      if (paymentPart === null) throw new Error('no band')
      const lowest = Math.max(...regions.map((region) => region.pt.y + region.pt.height))
      expect(paymentPart.pt.y).toBeGreaterThanOrEqual(lowest + 14 - 0.01)
      expect(paymentPart.pt.y + paymentPart.pt.height).toBeCloseTo(sheet.pt.height, 2)
    }
    const long = editorOver(longer(billedReport(), 40)).editor.state().canvas
    const lowest = Math.max(...long.regions.map((region) => region.pt.y + region.pt.height))
    expect(long.sheet.pt.height).toBeGreaterThan(841.89)
    expect(long.paymentPart?.pt.y).toBeCloseTo(lowest + 14, 2)
  })

  // A report without a bill has no slip to show, and its sheet is what it
  // was: the page, or the regions and the bottom margin when they run past.
  test('is not drawn for a report without a payment part, whose sheet stays as it was', () => {
    for (const report of [richReport(), longer(richReport(), 40)]) {
      const { paymentPart, sheet, regions } = editorOver(report).editor.state().canvas
      expect(paymentPart).toBeNull()
      const lowest = Math.max(...regions.map((region) => region.pt.y + region.pt.height))
      expect(sheet.pt.height).toBeCloseTo(Math.max(841.89, lowest + report.page.margins.bottom), 2)
    }
  })

  // Drawn in pixels at the zoom by the same conversion as every box, so
  // the band and the rulers agree.
  test('scales with the zoom', () => {
    const { editor } = editorOver(billedReport(), { zoom: 1.5 })
    const { paymentPart, scale } = editor.state().canvas
    expect(scale).toBeCloseTo(1.5 * PX_PER_PT, 12)
    expect(paymentPart?.px.y).toBeCloseTo((paymentPart?.pt.y ?? 0) * scale, 1)
    expect(paymentPart?.px.height).toBeCloseTo(QR_BILL_SIZE.height * scale, 1)
  })

  // The band is named as SIX names the part, in the editor's language: its
  // name is what a screen reader says, and its label what is drawn.
  test('is named in the editor’s language', () => {
    const names = EDITOR_LOCALES.map((locale) => editorOver(billedReport(), { locale }).editor.state().canvas.paymentPart?.label)
    expect(names).toEqual(['Payment part', 'Zahlteil', 'Section paiement'])
  })
})
