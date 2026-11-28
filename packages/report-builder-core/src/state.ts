/**
 * The editor's state, built from the session's document and the editor's
 * own: what both builders render.
 *
 * What depends on the document alone -- labels, diagnostics, the layout,
 * the palette -- is derived once per document and language edited, and
 * kept while both are the same; the rest is built per state. The labels
 * and the layout are of the report as the language edited writes it
 * (0063), so the outline, the design view and the bar show its words, a
 * word it lacks in the report's own and marked. The state is frozen to
 * its leaves, so neither builder can write into what the other renders.
 */
import { diagnose } from '@formancy/report-core'
import type { Diagnostic, DiagnosticSeverity } from '@formancy/report-core'
import { heldRegions, walkComponents, writtenIn } from '@formancy/report-spec'
import type { Component, ReportDefinition } from '@formancy/report-spec'
import { duplicate, indent, moveBy, outdent } from './edits.js'
import { layoutReport, MAX_ZOOM, MIN_ZOOM, pageGeometry, PX_PER_PT, rulerTicks, toPx } from './geometry.js'
import type { Layout } from './geometry.js'
import { addRefusal, imageLibrary } from './images.js'
import type { Images } from './images.js'
import { kindLabel, partLabel, regionLabel, reportLabels } from './labels.js'
import { languageName, languagesOf, missingKeys } from './languages.js'
import type { Edited } from './languages.js'
import type {
  Announcement,
  Availability,
  DiagnosticEntry,
  DragState,
  DragSubject,
  DropTarget,
  EditorPanel,
  EditorState,
  HideablePanel,
  HistoryState,
  HostView,
  PaletteEntry,
  ReportLevelPart,
  Selection,
} from './model.js'
import type { Box, Canvas, CanvasPaymentPart } from './model-canvas.js'
import type { TranslationState } from './model-translation.js'
import { REPORT_LEVEL_PARTS } from './model.js'
import { buildOutline, outlineOrder, outlineParts, selectionKey } from './outline.js'
import { paletteEntries } from './palette.js'
import { propertyHeading, propertyPanel, propertyTarget, specsOf } from './properties.js'
import type { FieldError } from './properties.js'
import { selected } from './selection.js'
import type { EditorLocale, EditorText } from './text.js'
import { formatZoom } from './text.js'
import type { HeldTranslation } from './translation-review.js'

/** What is the editor's own and never the report's: one person's view of it. */
export interface Local {
  readonly selection: Selection | null
  readonly zoom: number
  readonly panel: EditorPanel
  readonly hidden: readonly HideablePanel[]
  /** The host's view, kept by reference, so the state's is the same object until it changes. */
  readonly host: HostView | null
  readonly drag: { readonly subject: DragSubject; readonly via: 'pointer' | 'keyboard'; readonly over: number | null } | null
  /** Values refused for the selection's fields, by key. */
  readonly errors: ReadonlyMap<string, FieldError>
  readonly status: Announcement
  /** The name of the file an add has taken, until it is done: one at a time. */
  readonly adding: string | null
  /** The language whose words are shown and edited, one a translation declares; null for the report's own (0063). */
  readonly language: string | null
  /** A model's translation, held for the language it was asked for, whichever is edited (0086). */
  readonly translation: HeldTranslation | null
}

/** What the document and the language edited decide. */
export interface Derived {
  readonly report: ReportDefinition
  readonly edited: Edited
  /** The report as the language edited writes it, a word it lacks left in the report's own: what the labels and the layout are of. */
  readonly written: ReportDefinition
  /** The keys of what prints a word the language edited lacks. */
  readonly missing: ReadonlySet<string>
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

/**
 * The part of the report's own level a diagnostic is about: one that names
 * no component, at a path inside the part -- report-core names none for
 * the bill, which stands in no region.
 */
function partOf(diagnostic: Diagnostic): ReportLevelPart | undefined {
  if (diagnostic.componentId !== undefined) return undefined
  return REPORT_LEVEL_PARTS.find((part) => diagnostic.path === `/${part}` || diagnostic.path.startsWith(`/${part}/`))
}

/** What a diagnostic is about, to select: a component, a column, a part of the report's own level, or the report. */
function targetOf(diagnostic: Diagnostic): Selection | null {
  const { componentId, columnId } = diagnostic
  const part = partOf(diagnostic)
  if (part !== undefined) return { part }
  if (componentId === undefined) return null
  return columnId === undefined ? { id: componentId } : { id: componentId, column: columnId }
}

/**
 * What `report` and the language edited decide, in the words of `t`;
 * `stored` says whether the host keeps images a person adds, which the
 * palette's Image says; `known`, `report`'s diagnostics where they are
 * known already, which no language changes.
 */
export function derive(report: ReportDefinition, t: EditorText, stored: boolean, edited: Edited, known?: readonly Diagnostic[]): Derived {
  const written = edited.translation === undefined ? report : writtenIn(report, edited.locale)
  const components = reportLabels(written, t)
  const labels = new Map([...components, ...REPORT_LEVEL_PARTS.map((part) => [selectionKey({ part }), partLabel(part, t)] as const)])
  const diagnostics = known ?? diagnose(report)
  const problems = new Map<string, number>()
  // An error outranks a warning, whichever comes first: a count drawn in a
  // warning's colour would say the report still renders.
  const severities = new Map<string, DiagnosticSeverity>()
  for (const diagnostic of diagnostics) {
    const target = targetOf(diagnostic)
    if (target === null) continue
    const key = selectionKey(target)
    problems.set(key, (problems.get(key) ?? 0) + 1)
    if (severities.get(key) !== 'error') severities.set(key, diagnostic.severity)
  }
  const layout = layoutReport(written)
  const overflowing = new Set(layout.parts.filter((part) => part.overflows).map((part) => part.key))
  const inputs = { labels, selection: null, problems, severities, overflowing }
  const order = outlineOrder(buildOutline(report, inputs, t), outlineParts(report, inputs, t))
  const missing = missingKeys(edited)
  return { report, edited, written, missing, labels, diagnostics, problems, severities, overflowing, layout, palette: paletteEntries(report, t, stored), order }
}

/** What a box or a band says of a word it prints that the language edited lacks: nothing, or the sentence naming the language. */
function missingIn(derived: Derived, key: string, t: EditorText): { readonly missing?: string } {
  return derived.missing.has(key) ? { missing: t('canvas.missing', { language: derived.edited.name }) } : {}
}

/** What the middle pane shows: the host's view while it is shown there, else the design view. Decided here once, for the state and the editor's actions. */
export function viewOf(host: HostView | null): 'design' | 'host' {
  return host?.shown === true && host.place === 'middle' ? 'host' : 'design'
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

/** The payment part's band: where the slip prints, selected and counted as the bill's outline row is. */
function paymentBand(derived: Derived, box: Box, chosen: string | undefined, zoom: number, t: EditorText): CanvasPaymentPart {
  const key = selectionKey({ part: 'paymentPart' })
  const severity = derived.severities.get(key)
  return {
    label: partLabel('paymentPart', t),
    selected: chosen === key,
    problems: derived.problems.get(key) ?? 0,
    ...(severity === undefined ? {} : { severity }),
    ...missingIn(derived, key, t),
    pt: box,
    px: toPx(box, zoom),
  }
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
    paymentPart: layout.paymentPart === null ? null : paymentBand(derived, layout.paymentPart, chosen, local.zoom, t),
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
        ...missingIn(derived, part.key, t),
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
  return diagnostics.map(({ code, path, position, language }) => {
    const at = position === undefined ? '' : ` ${String(position.start)}-${String(position.end)}`
    // One word missing in two languages is two problems, at one path.
    const key = `${code} ${path}${at}${language === undefined ? '' : ` ${language}`}`
    const count = (seen.get(key) ?? 0) + 1
    seen.set(key, count)
    return count === 1 ? key : `${key} ${String(count)}`
  })
}

/** The problems, each linked to what it is about, and one about a language a translation declares named by it (0063). */
function diagnosticEntries(derived: Derived, t: EditorText, locale: EditorLocale): DiagnosticEntry[] {
  const keys = diagnosticKeys(derived.diagnostics)
  return derived.diagnostics.map((diagnostic, at) => {
    const target = targetOf(diagnostic)
    const where = target === null ? t('problem.report') : (derived.labels.get(selectionKey(target)) ?? selectionKey(target))
    const severity = t(`severity.${diagnostic.severity}`)
    const { language } = diagnostic
    return {
      key: keys[at] as string,
      severity: diagnostic.severity,
      code: diagnostic.code,
      message: diagnostic.message,
      where,
      label:
        language === undefined ? t('problem.item', { severity, where }) : t('problem.itemIn', { severity, where, language: languageName(language, locale) }),
      target,
      ...(language === undefined ? {} : { language }),
    }
  })
}

/**
 * The diagnostics a field shows: those about the report in every language
 * and those about the language edited, but a word missing, which the
 * field's own note says -- a translated expression's among them, which
 * report-core points at its translation and the field that writes it
 * finds there (`diagnosed`). In the report's own language, none that
 * names a translation's: a field there writes no translation.
 */
function fieldDiagnostics(derived: Derived): readonly Diagnostic[] {
  const { diagnostics, edited } = derived
  return diagnostics.filter(({ code, language }) => language === undefined || (language === edited.locale && code !== 'word-missing'))
}

const REPORT = { kind: 'report', path: '' } as const

/**
 * Which actions have somewhere to go: the selection's, decided by the same
 * plans that make them; the zoom's -- none while the host's view stands in
 * the design view's place, whose zoom it is; and Add image…'s, by the rule
 * that refuses it.
 */
function availability(report: ReportDefinition, local: Local, images: Images): Availability {
  const { selection, zoom } = local
  const design = viewOf(local.host) === 'design'
  const zooms = {
    zoomIn: design && zoom < MAX_ZOOM,
    zoomOut: design && zoom > MIN_ZOOM,
    zoomReset: design && zoom !== 1,
    addImage: addRefusal(images, local.adding, report) === undefined,
  }
  const target = selection === null ? undefined : selected(report, selection)
  if (target === undefined) return { delete: false, duplicate: false, moveUp: false, moveDown: false, indent: false, outdent: false, moveTo: false, ...zooms }
  const goes = (planned: object): boolean => !('edge' in planned)
  return {
    ...zooms,
    delete: true,
    duplicate: goes(duplicate(target)),
    moveUp: goes(moveBy(report, target, -1)),
    moveDown: goes(moveBy(report, target, 1)),
    indent: goes(indent(report, target)),
    outdent: goes(outdent(report, target)),
    moveTo: target.kind === 'component',
  }
}

/** The drag as the state shows it, and where its subject may go. */
function dragOf(
  derived: Derived,
  local: Local,
  t: EditorText,
  targets: () => readonly DropTarget[],
): { readonly drag: DragState | null; readonly dropTargets: readonly DropTarget[] } {
  if (local.drag === null) return { drag: null, dropTargets: [] }
  const { subject, via, over } = local.drag
  const name = 'id' in subject ? (derived.labels.get(subject.id) ?? subject.id) : kindLabel(subject.kind, t)
  const title = 'id' in subject ? t('places.move', { name }) : t('places.insert', { kind: name })
  const found = targets()
  return { drag: { subject, via, over, title, ...(found.length === 0 ? { nowhere: t('places.none', { name }) } : {}) }, dropTargets: found }
}

/** The whole state, frozen, from the document's derivations, the session's history and the editor's own, and a model's translation as translation-review.ts says it. */
export function buildState(
  derived: Derived,
  session: SessionView,
  local: Local,
  locale: EditorLocale,
  t: EditorText,
  targets: () => readonly DropTarget[],
  images: Images,
  translation: TranslationState | null,
): EditorState {
  const { report, labels, problems, severities, overflowing } = derived
  const inputs = { labels, selection: local.selection, problems, severities, overflowing }
  // The editor keeps its selection one the document has, so this finds it.
  const panelTarget = propertyTarget(report, local.selection) ?? REPORT
  // A first page header is listed only where the report has one (0060).
  const counts = new Map(heldRegions(report.regions).map(([region]) => [region, 0]))
  for (const { region } of walkComponents(report)) counts.set(region, (counts.get(region) ?? 0) + 1)
  const placing = dragOf(derived, local, t, targets)
  return freeze({
    locale,
    revision: session.revision,
    zoom: local.zoom,
    zoomLabel: formatZoom(local.zoom, locale),
    document: {
      id: report.id,
      title: derived.written.title,
      locale: report.locale,
      page: pageGeometry(report, local.zoom),
      regions: [...counts].map(([region, count]) => ({ region, label: regionLabel(region, t), count })),
    },
    selection: local.selection,
    languages: languagesOf(report, derived.edited, derived.diagnostics, t, locale),
    outline: buildOutline(report, inputs, t),
    outlineParts: outlineParts(report, inputs, t),
    palette: derived.palette,
    images: imageLibrary(images, derived, local.adding),
    properties: propertyPanel(
      panelTarget,
      specsOf(panelTarget, report, t, locale, derived.edited),
      propertyHeading(panelTarget, labels, t),
      local.errors,
      fieldDiagnostics(derived),
      t,
    ),
    canvas: canvasOf(derived, local, t),
    diagnostics: diagnosticEntries(derived, t, locale),
    history: session.history,
    drag: placing.drag,
    dropTargets: placing.dropTargets,
    can: availability(report, local, images),
    panel: local.panel,
    hidden: local.hidden,
    hostView: local.host,
    view: viewOf(local.host),
    status: local.status,
    translation,
  })
}
