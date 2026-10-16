/**
 * The editor's state, built from the session's document and the editor's
 * own: what both builders render.
 *
 * What depends on the document alone -- labels, diagnostics, the layout,
 * the palette -- is derived once per document and kept while the document
 * is the same object; the rest is built per state. The state is frozen to
 * its leaves, so neither builder can write into what the other renders.
 */
import { diagnose } from '@formancy/report-core'
import type { Diagnostic, DiagnosticSeverity } from '@formancy/report-core'
import { REGION_NAMES, walkComponents } from '@formancy/report-spec'
import type { Component, ReportDefinition } from '@formancy/report-spec'
import { indent, moveBy, outdent } from './edits.js'
import { layoutReport, MAX_ZOOM, MIN_ZOOM, pageGeometry, PX_PER_PT, rulerTicks, toPx } from './geometry.js'
import type { Layout } from './geometry.js'
import { columnKey, kindLabel, regionLabel, reportLabels } from './labels.js'
import type {
  Announcement,
  Availability,
  Canvas,
  DiagnosticEntry,
  DragState,
  DragSubject,
  DropTarget,
  EditorPanel,
  EditorState,
  HideablePanel,
  HistoryState,
  PaletteEntry,
  Selection,
} from './model.js'
import { buildOutline, outlineOrder, selectionKey } from './outline.js'
import { paletteEntries } from './palette.js'
import { fieldsOf, propertyHeading, propertyPanel, propertyTarget } from './properties.js'
import type { FieldError } from './properties.js'
import { selected } from './selection.js'
import type { EditorLocale, EditorText } from './text.js'
import { formatZoom } from './text.js'

/** What is the editor's own and never the report's: one person's view of it. */
export interface Local {
  readonly selection: Selection | null
  readonly zoom: number
  readonly panel: EditorPanel
  readonly hidden: readonly HideablePanel[]
  readonly drag: { readonly subject: DragSubject; readonly via: 'pointer' | 'keyboard'; readonly over: number | null } | null
  /** Values refused for the selection's fields, by key. */
  readonly errors: ReadonlyMap<string, FieldError>
  readonly status: Announcement
}

/** What the document alone decides. */
export interface Derived {
  readonly report: ReportDefinition
  readonly labels: ReadonlyMap<string, string>
  readonly diagnostics: readonly Diagnostic[]
  readonly problems: ReadonlyMap<string, number>
  /** The worst diagnostic about each key that has one. */
  readonly severities: ReadonlyMap<string, DiagnosticSeverity>
  /** The keys of what is wider than the space it stands in. */
  readonly overflowing: ReadonlySet<string>
  readonly layout: Layout
  readonly palette: readonly PaletteEntry[]
  /** Every outline row, in the outline's order. */
  readonly order: readonly Selection[]
}

export function derive(report: ReportDefinition, t: EditorText): Derived {
  const labels = reportLabels(report, t)
  const diagnostics = diagnose(report)
  const problems = new Map<string, number>()
  // An error outranks a warning, whichever comes first: a count drawn in a
  // warning's colour would say the report still renders.
  const severities = new Map<string, DiagnosticSeverity>()
  for (const { componentId, columnId, severity } of diagnostics) {
    if (componentId === undefined) continue
    const key = columnId === undefined ? componentId : columnKey(componentId, columnId)
    problems.set(key, (problems.get(key) ?? 0) + 1)
    if (severities.get(key) !== 'error') severities.set(key, severity)
  }
  const layout = layoutReport(report)
  const overflowing = new Set(layout.parts.filter((part) => part.overflows).map((part) => part.key))
  const order = outlineOrder(buildOutline(report, { labels, selection: null, problems, severities, overflowing }, t))
  return { report, labels, diagnostics, problems, severities, overflowing, layout, palette: paletteEntries(report, t), order }
}

/** What the history shows, from the session, with the labels in the editor's words. */
export interface SessionView {
  readonly revision: number
  readonly history: HistoryState
}

/** The component a drag places: the palette's default for a kind, or the id of one the report holds. */
export function dragged(derived: Derived, subject: DragSubject): Component | string | null {
  return 'id' in subject ? subject.id : (derived.palette.find((entry) => entry.kind === subject.kind)?.component ?? null)
}

function freeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freeze(child)
    Object.freeze(value)
  }
  return value
}

function canvasOf(derived: Derived, local: Local, t: EditorText): Canvas {
  const { layout, labels, problems, severities } = derived
  const chosen = local.selection === null ? undefined : selectionKey(local.selection)
  return {
    label: t('canvas.label'),
    note: t('canvas.note'),
    scale: local.zoom * PX_PER_PT,
    sheet: { pt: layout.sheet, px: toPx(layout.sheet, local.zoom) },
    regions: layout.regions.map(({ region, box, empty }) => ({ region, label: regionLabel(region, t), empty, pt: box, px: toPx(box, local.zoom) })),
    boxes: layout.parts.map((part) => {
      const severity = severities.get(part.key)
      return {
        key: part.key,
        id: part.id,
        ...(part.column === undefined ? {} : { column: part.column }),
        kind: part.kind,
        label: labels.get(part.key) ?? part.key,
        depth: part.depth,
        selected: part.key === chosen,
        problems: problems.get(part.key) ?? 0,
        ...(severity === undefined ? {} : { severity }),
        overflows: part.overflows,
        pt: part.box,
        px: toPx(part.box, local.zoom),
      }
    }),
    rulers: { horizontal: rulerTicks(layout.sheet.width, local.zoom), vertical: rulerTicks(layout.sheet.height, local.zoom) },
  }
}

/**
 * Each diagnostic's key: its code, its path and, in an expression, its
 * characters -- what it is, not where it stands in the list. Two that
 * report-core says alike are told apart by their order, the second and
 * later numbered, so the first keeps the key it would have alone.
 */
export function diagnosticKeys(diagnostics: readonly Diagnostic[]): string[] {
  const seen = new Map<string, number>()
  return diagnostics.map(({ code, path, position }) => {
    const key = `${code} ${path}${position === undefined ? '' : ` ${String(position.start)}-${String(position.end)}`}`
    const count = (seen.get(key) ?? 0) + 1
    seen.set(key, count)
    return count === 1 ? key : `${key} ${String(count)}`
  })
}

function diagnosticEntries(derived: Derived, t: EditorText): DiagnosticEntry[] {
  const keys = diagnosticKeys(derived.diagnostics)
  return derived.diagnostics.map((diagnostic, at) => {
    const { componentId, columnId } = diagnostic
    const target: Selection | null = componentId === undefined ? null : columnId === undefined ? { id: componentId } : { id: componentId, column: columnId }
    const where = target === null ? t('problem.report') : (derived.labels.get(selectionKey(target)) ?? componentId ?? '')
    return { key: keys[at] as string, severity: diagnostic.severity, code: diagnostic.code, message: diagnostic.message, where, label: t('problem.item', { severity: t(`severity.${diagnostic.severity}`), where }), target }
  })
}

const REPORT = { kind: 'report', path: '' } as const

/** Which actions have somewhere to go: the selection's, decided by the same plans that make them, and the zoom's. */
function availability(report: ReportDefinition, selection: Selection | null, zoom: number): Availability {
  const zooms = { zoomIn: zoom < MAX_ZOOM, zoomOut: zoom > MIN_ZOOM, zoomReset: zoom !== 1 }
  const target = selection === null ? undefined : selected(report, selection)
  if (target === undefined) return { delete: false, duplicate: false, moveUp: false, moveDown: false, indent: false, outdent: false, moveTo: false, ...zooms }
  const goes = (planned: object): boolean => !('edge' in planned)
  return {
    ...zooms,
    delete: true,
    duplicate: true,
    moveUp: goes(moveBy(report, target, -1)),
    moveDown: goes(moveBy(report, target, 1)),
    indent: goes(indent(report, target)),
    outdent: goes(outdent(report, target)),
    moveTo: target.kind === 'component',
  }
}

/** The drag as the state shows it, and where its subject may go. */
function dragOf(derived: Derived, local: Local, t: EditorText, targets: () => readonly DropTarget[]): { readonly drag: DragState | null; readonly dropTargets: readonly DropTarget[] } {
  if (local.drag === null) return { drag: null, dropTargets: [] }
  const { subject, via, over } = local.drag
  const name = 'id' in subject ? (derived.labels.get(subject.id) ?? subject.id) : kindLabel(subject.kind, t)
  const title = 'id' in subject ? t('places.move', { name }) : t('places.insert', { kind: name })
  const found = targets()
  return { drag: { subject, via, over, title, ...(found.length === 0 ? { nowhere: t('places.none', { name }) } : {}) }, dropTargets: found }
}

/** The whole state, frozen, from the document's derivations, the session's history and the editor's own. */
export function buildState(derived: Derived, session: SessionView, local: Local, locale: EditorLocale, t: EditorText, targets: () => readonly DropTarget[]): EditorState {
  const { report, labels, problems, severities, overflowing } = derived
  // The editor keeps its selection one the document has, so this finds it.
  const panelTarget = propertyTarget(report, local.selection) ?? REPORT
  const counts = new Map(REGION_NAMES.map((region) => [region, 0]))
  for (const { region } of walkComponents(report)) counts.set(region, (counts.get(region) ?? 0) + 1)
  const placing = dragOf(derived, local, t, targets)
  return freeze({
    locale,
    revision: session.revision,
    zoom: local.zoom,
    zoomLabel: formatZoom(local.zoom, locale),
    document: {
      id: report.id,
      title: report.title,
      locale: report.locale,
      page: pageGeometry(report, local.zoom),
      regions: REGION_NAMES.map((region) => ({ region, label: regionLabel(region, t), count: counts.get(region) ?? 0 })),
    },
    selection: local.selection,
    outline: buildOutline(report, { labels, selection: local.selection, problems, severities, overflowing }, t),
    palette: derived.palette,
    properties: propertyPanel(panelTarget, fieldsOf(panelTarget, report, t), propertyHeading(panelTarget, labels, t), local.errors, derived.diagnostics, t),
    canvas: canvasOf(derived, local, t),
    diagnostics: diagnosticEntries(derived, t),
    history: session.history,
    drag: placing.drag,
    dropTargets: placing.dropTargets,
    can: availability(report, local.selection, local.zoom),
    panel: local.panel,
    hidden: local.hidden,
    status: local.status,
  })
}
