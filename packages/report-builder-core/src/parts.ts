/**
 * The hooks both builders render and report-builder.css dresses: one
 * `data-report-part` per piece of the editor, the `data-*` states on them,
 * and the workbench's shell classes for the three panes. One part is drawn
 * and never dressed: the host's view, which is the host's.
 *
 * The stylesheet selects by these and nothing else -- never a React or an
 * Angular class -- so the two builders are dressed identically, and a test
 * of the stylesheet fails on a part neither builder renders.
 */

export const REPORT_PARTS = [
  /** The editor's root, which also carries the workbench's `wb` grid. */
  'editor',
  /** The report's title, in the bar above the panes. */
  'title',
  'toolbar',
  /** The zoom readout, an `<output>` named "Zoom". */
  'zoom',
  'palette',
  'palette-item',
  'outline',
  /** One region's group in the outline's tree. */
  'outline-region',
  'outline-item',
  /** The sentence beside an outline with no row, which describes the empty tree. */
  'outline-empty',
  /** The count of diagnostics on an outline row or a canvas box. */
  'badge',
  'canvas',
  /**
   * The host's view in the design view's place: a region named by the
   * state's `hostView`, holding what the host gave the builder. Not a
   * workbench pane, so no rule of report-builder.css dresses anything in
   * it, and of the workbench's only `.wb *`, which turns transitions off
   * under reduced motion and reaches every element under the root (0029).
   */
  'view',
  /** The sentence that says the canvas is not the PDF. */
  'canvas-note',
  'ruler',
  'ruler-tick',
  /** The design sheet, as wide as the page. */
  'sheet',
  /** One region's band on the sheet. */
  'region',
  /** A band's label: a region's, or the payment part's. */
  'region-label',
  /** The payment part's band, at the sheet's foot, labelled as a region's band is. */
  'payment-part',
  /** A component's or a table column's box on the sheet. */
  'box',
  'box-label',
  'drop-indicator',
  /** The dialog a keyboard chooses a place from, and each place in it. */
  'places',
  'place',
  'properties',
  'property',
  /** A group of fields in the properties -- a QR-bill's creditor or debtor -- its name drawn above them and its one button after them. */
  'property-group',
  'property-error',
  'diagnostics',
  'diagnostic',
  /** The live region that says what an action did. */
  'status',
  /** The button in a side pane's header that hides that pane. */
  'hide-pane',
] as const

export type ReportPart = (typeof REPORT_PARTS)[number]

/** Every attribute report-builder.css selects by: the part, and the states a builder sets on it. */
export const REPORT_ATTRIBUTES = [
  'data-report-part',
  /** A box's or an outline row's kind -- a component kind, or `tableColumn` -- or a property row's `PropertyKind`. */
  'data-kind',
  /** "true" on the selected box, as `aria-selected` is on its outline row. */
  'data-selected',
  /** "true" on a box wider than the space it stands in. */
  'data-overflows',
  /** "true" on a region band with nothing in it. */
  'data-empty',
  /** "true" on the drop indicator the pointer is over. */
  'data-over',
  /** "true" on the box being dragged. */
  'data-dragging',
  /** A diagnostic's or a badge's severity: `error` or `warning`. */
  'data-severity',
  /** A ruler's: `horizontal` or `vertical`. */
  'data-orientation',
  /** "true" on a ruler's major tick. */
  'data-major',
  /** On the root: the pane a narrow layout shows, the state's `panel`. */
  'data-panel',
  /** On the root, when any pane is hidden: the state's `hidden`, the panes' names in one space-separated list. */
  'data-hidden',
  /** On each pane: which one it is, one of `EDITOR_PANELS`. */
  'data-pane',
  // The tree's own ARIA, which the stylesheet reads rather than a copy of
  // it, so the nesting drawn and the nesting announced cannot disagree.
  'aria-level',
  'aria-selected',
  'aria-invalid',
  /** On a tool or a palette entry with nothing to act on, which stays focusable. */
  'aria-disabled',
] as const

/**
 * The workbench's shell classes (`@formancy/themes`' workbench.css) a
 * builder puts on its three panes: the grid on the root, a pane on each
 * side, the canvas pane between, each pane's scrolling body, and the
 * toolbar. Named once so both builders use the same.
 */
export const WORKBENCH_CLASSES = {
  root: 'wb',
  pane: 'wb-pane',
  canvas: 'wb-canvas',
  body: 'wb-body',
  tools: 'wb-tools',
  problem: 'wb-problem',
} as const
