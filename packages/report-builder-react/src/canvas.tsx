/**
 * The design view: one sheet as wide as the page, the regions as bands on it,
 * a box per component and table column, a payment part's band at its foot,
 * rulers in millimetres, and while something is being placed, an indicator
 * at every place it may go.
 *
 * It draws the state's geometry and decides none: every left, top, width and
 * height is a number report-builder-core computed in pixels at the zoom. It
 * is labelled as not the PDF, because it is not -- the renderer measures text
 * and breaks pages, and the preview shows what prints.
 *
 * Each box is a picture of where a component stands -- `role="img"`, named
 * by its label, so reading the view says what is on it. A click selects; a
 * box is not a tab stop, because the outline is the keyboard's way to every
 * box and two ways to the same place would double the tabbing. The payment
 * part's band is the same for the bill (0039). The view itself is one
 * stop, so a keyboard can scroll it.
 */
import type { CSSProperties, ReactElement, Ref } from 'react'
import type { Box, CanvasBox, EditorAction, EditorState, EditorText, RulerTick } from '@formancy/report-builder-core'
import type { PointerDrag } from './pointer-drag.js'

export interface CanvasProps {
  readonly state: EditorState
  readonly t: EditorText
  readonly canvas: Ref<HTMLElement>
  readonly sheet: Ref<HTMLDivElement>
  readonly drag: PointerDrag
  /** Selects a box, focus to follow to its outline row. */
  readonly select: (action: EditorAction) => void
}

/** A box's place on the sheet: physical left and top, because a page's coordinates run from its top-left whatever the language. */
function placed(box: Box): CSSProperties {
  return { left: box.x, top: box.y, width: box.width, height: box.height }
}

function Ruler({
  orientation,
  ticks,
  length,
  label,
}: {
  readonly orientation: 'horizontal' | 'vertical'
  readonly ticks: readonly RulerTick[]
  readonly length: number
  readonly label: string
}): ReactElement {
  const across = orientation === 'horizontal'
  return (
    <div role="img" aria-label={label} data-report-part="ruler" data-orientation={orientation} style={across ? { width: length } : { height: length }}>
      {ticks.map((tick) => (
        <span key={tick.mm} data-report-part="ruler-tick" data-major={tick.major ? 'true' : undefined} style={across ? { left: tick.at } : { top: tick.at }}>
          {tick.label === undefined ? null : <span>{tick.label}</span>}
        </span>
      ))}
    </div>
  )
}

function selection(box: CanvasBox): EditorAction {
  return box.column === undefined ? { type: 'select', id: box.id } : { type: 'select', id: box.id, column: box.column }
}

export function Canvas({ state, t, canvas: canvasRef, sheet: sheetRef, drag, select }: CanvasProps): ReactElement {
  const { canvas, drag: placing, dropTargets } = state
  const moving = placing !== null && 'id' in placing.subject ? placing.subject.id : undefined
  return (
    <section ref={canvasRef} aria-label={canvas.label} data-report-part="canvas" tabIndex={0}>
      <p data-report-part="canvas-note">{canvas.note}</p>
      <Ruler orientation="horizontal" ticks={canvas.rulers.horizontal} length={canvas.sheet.px.width} label={t('ruler.horizontal')} />
      <Ruler orientation="vertical" ticks={canvas.rulers.vertical} length={canvas.sheet.px.height} label={t('ruler.vertical')} />
      <div ref={sheetRef} data-report-part="sheet" style={{ width: canvas.sheet.px.width, height: canvas.sheet.px.height }}>
        {canvas.regions.map((region) => (
          <div key={region.region} data-report-part="region" data-empty={region.empty ? 'true' : undefined} style={placed(region.px)}>
            <span data-report-part="region-label">{region.label}</span>
          </div>
        ))}
        {canvas.boxes.map((box) => (
          <div
            key={box.key}
            role="img"
            aria-label={box.label}
            data-report-part="box"
            data-kind={box.kind}
            data-selected={box.selected ? 'true' : undefined}
            data-overflows={box.overflows ? 'true' : undefined}
            data-dragging={box.column === undefined && box.id === moving ? 'true' : undefined}
            title={box.overflows ? t('canvas.overflow') : undefined}
            style={placed(box.px)}
            onPointerDown={(event) => {
              if (box.column === undefined) drag.press(event, { id: box.id })
            }}
            onClick={() => {
              if (!drag.swallowClick()) select(selection(box))
            }}
          >
            <span data-report-part="box-label">{box.label}</span>
            {box.problems > 0 ? (
              <span data-report-part="badge" data-severity={box.severity} aria-hidden="true">
                {box.problems}
              </span>
            ) : null}
          </div>
        ))}
        {/* Where a payment part's slip prints, below every region: a
            picture named as SIX names the part, as a box is named by its
            label, which a click selects the bill by, as it does a box's
            component. */}
        {canvas.paymentPart === null ? null : (
          <div
            role="img"
            aria-label={canvas.paymentPart.label}
            data-report-part="payment-part"
            data-selected={canvas.paymentPart.selected ? 'true' : undefined}
            style={placed(canvas.paymentPart.px)}
            onClick={() => select({ type: 'select', part: 'paymentPart' })}
          >
            <span data-report-part="region-label">{canvas.paymentPart.label}</span>
            {canvas.paymentPart.problems > 0 ? (
              <span data-report-part="badge" data-severity={canvas.paymentPart.severity} aria-hidden="true">
                {canvas.paymentPart.problems}
              </span>
            ) : null}
          </div>
        )}
        {/* Drawn only for the places the session accepts, named as the place
            dialog names them; the one under the pointer, or focused in the
            dialog, is marked. */}
        {placing === null
          ? null
          : dropTargets.map((target) => (
              <div
                key={target.index}
                role="img"
                aria-label={target.label}
                data-report-part="drop-indicator"
                data-over={placing.over === target.index ? 'true' : undefined}
                style={placed(target.px)}
              />
            ))}
      </div>
    </section>
  )
}
