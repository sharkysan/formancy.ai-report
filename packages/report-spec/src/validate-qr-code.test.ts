import { describe, expect, test } from 'vitest'
import { QR_ERROR_CORRECTION } from './components.js'
import { REGION_NAMES } from './definition.js'
import { printableArea, squareRoom } from './page.js'
import { append, edited, editable, getAt, refusals, removeAt, richReport, setAt } from './test-support.js'
import { validateReport } from './validate.js'

/** Where the fixture's QR code is: last in the summary. */
const CODE = '/regions/summary/2'

/** A QR code of `size` points whose content is `content`. */
function qrCode(content: unknown[] = [{ kind: 'text', text: 'https://formancy.ai/report/' }], size = 56.69): unknown {
  return { id: 'code', kind: 'qrCode', content, size, errorCorrection: 'M' }
}

describe('a QR code', () => {
  // A QR code is its content, the side of its square and how much of the
  // square may be lost and still read. A width beside the size would be a
  // second way to say how big it is, and a level the symbology does not
  // have would leave the renderer to guess one.
  test('has content, a size and one of the four error correction levels, and nothing else', () => {
    expect(getAt(richReport(), CODE)).toMatchObject({ kind: 'qrCode' })
    expect(QR_ERROR_CORRECTION).toEqual(['L', 'M', 'Q', 'H'])
    for (const level of QR_ERROR_CORRECTION) expect(refusals(edited((r) => setAt(r, `${CODE}/errorCorrection`, level))), level).toEqual([])
    for (const level of ['X', 'm', 'low']) {
      expect(refusals(edited((r) => setAt(r, `${CODE}/errorCorrection`, level))), level).toEqual([`not-one-of ${CODE}/errorCorrection`])
    }
    expect(refusals(edited((r) => setAt(r, `${CODE}/size`, 0)))).toEqual([`out-of-range ${CODE}/size`])
    expect(refusals(edited((r) => setAt(r, `${CODE}/size`, 85.045)))).toEqual([`too-precise ${CODE}/size`])
    expect(refusals(edited((r) => setAt(r, `${CODE}/width`, 85.04)))).toEqual([`unknown-property ${CODE}/width`])
    for (const key of ['content', 'size', 'errorCorrection']) {
      expect(refusals(edited((r) => removeAt(r, `${CODE}/${key}`))), key).toEqual([`missing-property ${CODE}/${key}`])
    }
  })

  // The renderer draws a code black on white and nothing else: a colour or
  // a fill the validator took would be one the PDF silently ignores, and an
  // author who chose a light one would believe the page printed it.
  test('takes no colour or fill of its own', () => {
    for (const key of ['color', 'fill', 'background']) {
      expect(refusals(edited((r) => setAt(r, `${CODE}/${key}`, '#ff0000'))), key).toEqual([`unknown-property ${CODE}/${key}`])
    }
  })

  // A table's cells, its group header and its footer cells hold runs of
  // text, read once a row. A code taken there would be a code per row,
  // which the renderer does not draw, or a cell that prints nothing where
  // its author put a code.
  test('cannot stand in a table: not in a cell, a group header or a footer cell', () => {
    for (const pointer of ['/regions/body/2/columns/0/value', '/regions/body/2/group/header/0', '/regions/body/2/totals/0/cells/0/value']) {
      expect(refusals(edited((r) => setAt(r, pointer, qrCode()))), pointer).toEqual([`unknown-kind ${pointer}/kind`])
    }
  })

  // A code with no runs encodes nothing in every render, a symbol of no
  // data that a scanner reads as no code at all, beside a square the page
  // reserves for it. A paragraph with no runs is an empty line; a code with
  // none is a mistake, refused where it is written.
  test('has at least one run in its content', () => {
    expect(refusals(edited((r) => setAt(r, `${CODE}/content`, [])))).toEqual([`too-few ${CODE}/content`])
    expect(refusals(edited((r) => setAt(r, `${CODE}/content`, [{ kind: 'text', text: 'A' }])))).toEqual([])
    // A text with no runs is still an empty line, as before.
    expect(refusals(edited((r) => setAt(r, '/regions/body/0/content', [])))).toEqual([])
  })

  // A QR code holds nothing and does not flow: it is a box of fixed size,
  // as an image is, so it stands wherever an image does -- a page footer,
  // a column, a keep-together block. Refused anywhere, a payment slip's
  // code could not stand where the slip is.
  test('stands wherever an image does: in every region and in every container', () => {
    for (const region of REGION_NAMES) {
      const report = editable(richReport())
      append(report, `/regions/${region}`, qrCode())
      expect(refusals(report), region).toEqual([])
    }
    for (const pointer of ['/regions/reportHeader/0/columns/0/components/1', '/regions/body/3/components/2', '/regions/summary/0/components/3']) {
      expect(refusals(edited((r) => setAt(r, pointer, qrCode()))), pointer).toEqual([])
    }
  })

  // Its content is read once, as a paragraph's in the same place is: a
  // header field or a parameter, never a detail field outside the table.
  // A page number or count is refused even in the page header and footer,
  // where a paragraph may print one: a paragraph leaves its counter for the
  // renderer to fill on each page, and a code's text is resolved whole,
  // once, before there are pages to count. Accepted, the counter would be
  // encoded as nothing, and nobody reading the page could see that.
  test('reads what a paragraph in its place reads, and never a page number or count', () => {
    const customer = { kind: 'field', field: { dataset: 'header', field: 'customer' } }
    const site = { kind: 'field', field: { dataset: 'detail', field: 'site' } }
    expect(refusals(edited((r) => setAt(r, `${CODE}/content`, [customer, { kind: 'parameter', parameter: 'region' }])))).toEqual([])
    expect(refusals(edited((r) => setAt(r, `${CODE}/content/1`, site)))).toEqual([`misplaced-detail-field ${CODE}/content/1/field`])
    for (const region of REGION_NAMES) {
      for (const counter of [{ kind: 'pageNumber' }, { kind: 'pageCount' }]) {
        const report = edited((r) => setAt(r, `/regions/${region}/0`, qrCode([{ kind: 'text', text: 'Page ' }, counter])))
        expect(refusals(report), `${counter.kind} in ${region}`).toEqual([`misplaced-page-counter /regions/${region}/0/content/1`])
      }
    }
  })

  // A QR code is a square, so its one size is measured against both sides
  // of the printable area, and refused once, on the side it overruns, when
  // it overruns both. A4 portrait with the fixture's margins leaves 510.24
  // by 728.51 points; landscape, 756.85 by 481.9. The fixture's QR-bill is
  // printed on A4 in portrait only, so the pages are measured without it.
  test('is a square the printable area holds both ways, refused once when it holds neither', () => {
    const sized = (size: number, orientation = 'portrait') =>
      edited((r) => {
        removeAt(r, '/paymentPart')
        setAt(r, '/page/orientation', orientation)
        setAt(r, `${CODE}/size`, size)
      })
    expect(refusals(sized(510.24))).toEqual([])
    expect(refusals(sized(510.25))).toEqual([`exceeds-printable-area ${CODE}/size`])
    expect(refusals(sized(728.52))).toEqual([`exceeds-printable-area ${CODE}/size`])
    expect(refusals(sized(481.9, 'landscape'))).toEqual([])
    expect(refusals(sized(481.91, 'landscape'))).toEqual([`exceeds-printable-area ${CODE}/size`])
    expect(refusals(sized(756.86, 'landscape'))).toEqual([`exceeds-printable-area ${CODE}/size`])
    // The message names the side that is short, and what the margins leave of it.
    const message = (document: unknown) => {
      const outcome = validateReport(document)
      return outcome.valid ? undefined : outcome.errors[0]?.message
    }
    expect(message(sized(728.52))).toBe('728.52 points of width for this QR code, and the margins leave 510.24')
    expect(message(sized(756.86, 'landscape'))).toBe('756.86 points of height for this QR code, and the margins leave 481.9')
  })

  // The builders size a new code by `squareRoom`, and name it as the room a
  // refused size lacks. Were the validator to measure a square otherwise, a
  // builder would offer a code the validator refuses, or say there is room
  // where there is none. Upright and landscape, and on a printable area
  // that is square, where either side is the shorter.
  test('is held to squareRoom, the largest square the printable area holds', () => {
    for (const [orientation, margins, side] of [
      ['portrait', { top: 56.69, right: 42.52, bottom: 56.69, left: 42.52 }, 'width'],
      ['landscape', { top: 56.69, right: 42.52, bottom: 56.69, left: 42.52 }, 'height'],
      ['portrait', { top: 165.82, right: 42.52, bottom: 165.83, left: 42.52 }, 'width'],
    ] as const) {
      const page = { size: 'A4', orientation, margins } as const
      const room = squareRoom(printableArea(page))
      expect(room.side, orientation).toBe(side)
      expect(room.length).toBe(Math.min(printableArea(page).width, printableArea(page).height))
      const sized = (size: number) =>
        edited((r) => {
          removeAt(r, '/paymentPart')
          setAt(r, '/page', page)
          setAt(r, `${CODE}/size`, size)
        })
      expect(refusals(sized(room.length)), `${orientation} ${room.length}`).toEqual([])
      expect(refusals(sized(Math.round((room.length + 0.01) * 100) / 100)), `${orientation} past ${room.length}`).toEqual([
        `exceeds-printable-area ${CODE}/size`,
      ])
    }
  })
})
