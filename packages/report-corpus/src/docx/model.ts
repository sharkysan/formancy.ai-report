import type { Part, Relationship } from './package.js'

/**
 * A Word file as `readDocx` reads it back (0068): what the file states,
 * in the corpus's own terms and in points, so that a check compares it
 * with a resolved document without knowing how its writer rounds. Nothing
 * here is laid out: where a line and a page break is Word's, and no
 * reader in the repository says.
 */

/** What a run, or a paragraph's mark, is set in, as its own properties state it: nothing is inherited from a style, since the file has none. */
export interface DocxRunProps {
  /** The one family its four font slots name; absent where it names none. */
  readonly family?: string
  readonly bold: boolean
  readonly italic: boolean
  /** Lower-case `#rrggbb`. */
  readonly color?: string
  /** Points. */
  readonly size?: number
  readonly shift?: 'subscript' | 'superscript'
}

/** An inline picture: its extent on the page, the part it embeds and, for an SVG, the drawing beside its fallback. */
export interface DocxPicture {
  readonly id: number
  readonly name: string
  /** Points. */
  readonly width: number
  readonly height: number
  /** The part the picture embeds: the asset's bytes, or, beside `svg`, the fallback a reader that draws no SVG shows. */
  readonly part: Part
  /** The SVG part of an `asvg:svgBlip`. */
  readonly svg?: Part
  /** What is cut from each side, as a fraction of the picture's width or height; absent where nothing is. */
  readonly crop?: { readonly left: number; readonly top: number; readonly right: number; readonly bottom: number }
}

/** What a word of a chart is set in, as its own properties state it. */
export interface DocxChartFace {
  /** The one family its three typeface slots name. */
  readonly family: string
  /** Points. */
  readonly size: number
  readonly bold: boolean
  readonly italic: boolean
  /** Lower-case `#rrggbb`. */
  readonly color: string
}

/** A word the chart's part states itself: its text, and what it is set in. */
export interface DocxChartWord {
  readonly text: string
  readonly face: DocxChartFace
}

/** One series of a chart, every list of it as long as its points' count, a point the part states none for null. */
export interface DocxChartSeries {
  /** Its name, which the legend prints. */
  readonly name?: string
  /** A bar's fill, or a line's stroke and its markers' fill; a pie's series has none, each point its own. */
  readonly color?: string
  /** A line's weight in points, and its markers' size. */
  readonly line?: number
  readonly marker?: number
  readonly categories: readonly (string | null)[]
  /** Each value as the part writes it, digit for digit. */
  readonly values: readonly (string | null)[]
  /** Each point's label, where the part states one. */
  readonly labels: readonly (DocxChartWord | null)[]
  /** Where its labels stand; absent where it labels nothing. */
  readonly labelPosition?: string
  /** A pie's points' fills. */
  readonly points: readonly (string | null)[]
}

/** A chart's part as it states the chart (0076): Word's own chart, of literal data. */
export interface DocxChart {
  readonly part: string
  readonly kind: 'bar' | 'line' | 'pie'
  readonly title?: DocxChartWord
  readonly series: readonly DocxChartSeries[]
  /** A bar chart's gaps, in hundredths of a bar's width: between two categories, and how far two bars of one overlap, negative where they stand apart. */
  readonly bars?: { readonly gapWidth: number; readonly overlap: number }
  readonly categoryAxis?: {
    readonly title?: DocxChartWord
    readonly face: DocxChartFace
    /** Its line. */
    readonly line: DocxBorder
    /** Where on the value axis it stands: at zero, or at the axis's lowest value. */
    readonly crosses: 'autoZero' | 'min'
    /** Every how many categories one is labelled. */
    readonly every: number
  }
  readonly valueAxis?: {
    readonly title?: DocxChartWord
    readonly face: DocxChartFace
    /** Its lowest and highest value and the step between two gridlines, each as the part writes it. */
    readonly min: string
    readonly max: string
    readonly step: string
    /** The format Word prints its labels in. */
    readonly format: string
    readonly grid: DocxBorder
  }
  readonly legend?: { readonly position: string; readonly face: DocxChartFace }
  /** What every word Word writes itself is set in, where nothing nearer says. */
  readonly face: DocxChartFace
}

/** An inline chart: its extent on the page and the part it draws. */
export interface DocxChartFrame {
  readonly id: number
  readonly name: string
  /** Points. */
  readonly width: number
  readonly height: number
  readonly chart: DocxChart
}

export type DocxRun =
  /** Text, a line break in it a line feed. */
  | { readonly kind: 'text'; readonly text: string; readonly props: DocxRunProps }
  /** A field Word works out, written without a result. */
  | { readonly kind: 'field'; readonly field: 'PAGE' | 'NUMPAGES'; readonly props: DocxRunProps }
  | { readonly kind: 'picture'; readonly picture: DocxPicture; readonly props: DocxRunProps }
  | { readonly kind: 'chart'; readonly frame: DocxChartFrame; readonly props: DocxRunProps }

/** A single line of a border: its weight in points and its colour, lower-case `#rrggbb`. */
export interface DocxBorder {
  readonly weight: number
  readonly color: string
}

export interface DocxParagraph {
  readonly kind: 'paragraph'
  readonly runs: readonly DocxRun[]
  readonly align?: 'left' | 'center' | 'right'
  readonly keepNext: boolean
  readonly keepLines: boolean
  readonly pageBreakBefore: boolean
  /** Points of space before and after it; nothing where it states none. */
  readonly before: number
  readonly after: number
  /** Its line's height where it states one: exactly so many points, or, by Word's own rule, so many lines. */
  readonly line?: { readonly height: number; readonly rule: 'exact' | 'auto' }
  /** Points from the left, and from the right. */
  readonly indent: number
  readonly indentRight: number
  /** The border under it, and the one between it and a paragraph of the same borders. */
  readonly bottom?: DocxBorder
  readonly between?: DocxBorder
  /** The paragraph mark's own properties, which size an empty paragraph's line. */
  readonly mark: DocxRunProps
  /** Whether it ends a section: the report's, before a slip's page (0075). */
  readonly endsSection?: true
}

export interface Sides<T> {
  readonly top?: T
  readonly left?: T
  readonly bottom?: T
  readonly right?: T
}

export interface DocxCell {
  /** Points. */
  readonly width: number
  /** How many grid columns it spans. */
  readonly span: number
  readonly borders: Sides<DocxBorder>
  /** Its fill, lower-case `#rrggbb`. */
  readonly shade?: string
  /** Which way its text reads where it is turned: from bottom to top, each line to the right of the last, as an EPC QR code's caption reads (0074). */
  readonly direction?: 'btLr'
  /** Where its blocks stand in a cell taller than they are: in its middle, as an empty chart's words do (0076); absent, at its top. */
  readonly align?: 'center'
  readonly blocks: readonly DocxBlock[]
}

export interface DocxRow {
  /** Marked as the row to repeat at the top of every page the table reaches. */
  readonly header: boolean
  readonly cantSplit: boolean
  /** Points, and whether exactly so. */
  readonly height?: { readonly value: number; readonly rule: 'exact' | 'atLeast' }
  readonly cells: readonly DocxCell[]
}

export interface DocxTable {
  readonly kind: 'table'
  /** Points. */
  readonly width: number
  readonly grid: readonly number[]
  readonly borders: Sides<DocxBorder> & { readonly insideH?: DocxBorder; readonly insideV?: DocxBorder }
  /** Every cell's margins in points; absent where the table states none, and Word's own apply. */
  readonly margins?: Sides<number>
  readonly rows: readonly DocxRow[]
}

export type DocxBlock = DocxParagraph | DocxTable

/** A header's or a footer's part and what it holds. */
export interface DocxRegion {
  readonly part: string
  readonly blocks: readonly DocxBlock[]
}

export interface DocxPage {
  /** Points. */
  readonly width: number
  readonly height: number
  readonly orientation: 'portrait' | 'landscape'
  readonly margins: { readonly top: number; readonly right: number; readonly bottom: number; readonly left: number }
  /** From the paper's edge to the header's top and the footer's foot. */
  readonly header: number
  readonly footer: number
  /** Whether page 1 has a header and a footer of its own. */
  readonly titlePage: boolean
}

/** The page of a QR-bill's slip (0075): the file's last section, its page, the header and the footer it names, and what it holds. */
export interface DocxSlipPage {
  readonly page: DocxPage
  readonly header?: DocxRegion
  readonly footer?: DocxRegion
  readonly blocks: readonly DocxBlock[]
}

export interface Docx {
  /** The report's page, and its body: the file's one section, or its first where a slip's page follows it. */
  readonly page: DocxPage
  readonly body: readonly DocxBlock[]
  /** The section after the report's, where the file has one: a slip's page. */
  readonly slip?: DocxSlipPage
  /** The header and footer every page prints, and page 1's own where the section references them. */
  readonly header?: DocxRegion
  readonly firstHeader?: DocxRegion
  readonly footer?: DocxRegion
  readonly firstFooter?: DocxRegion
  /** The font table: each family, the kind a reader without it chooses another by, its pitch, and another name it may be found by. */
  readonly fonts: readonly { readonly name: string; readonly family: string; readonly pitch: string; readonly altName?: string }[]
  /** What the styles part makes the default of every run and paragraph. */
  readonly defaults: { readonly run: DocxRunProps; readonly before: number; readonly after: number; readonly line?: DocxParagraph['line'] }
  /** The compatibility mode the settings state. */
  readonly compatibilityMode?: string
  readonly title?: string
  /** The creation date as the core properties write it. */
  readonly created?: string
  /** Every part of the package by its name, and each part's relationships. */
  readonly parts: ReadonlyMap<string, Part>
  readonly relationships: (source: string) => readonly Relationship[]
}
