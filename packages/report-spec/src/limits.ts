/**
 * The bounds a report definition is held to, and why each exists.
 *
 * A template is untrusted input, even when an administrator wrote it. Every
 * array, string and number in it is bounded, so that validating, hashing,
 * editing and later laying one out costs work that does not grow with
 * whatever a broken or hostile document holds. An array is measured before
 * any element of it is read.
 *
 * The numbers are chosen, not measured: each sits well above what the three
 * starter reports need (plan 7) and low enough to keep that work small. Two
 * are not chosen, and say where they come from. Raising a bound is safe;
 * lowering one refuses reports that were valid, which once the format is
 * frozen means a new reportSpecVersion.
 *
 * The bounds of an SVG asset and of a font, at the end, are the
 * exception: each but `MAX_SVG_REMOVED_NAMES` was measured, and says how,
 * on what and when (0030, 0040).
 */

/**
 * Errors listed per validation. Past it, one `too-many-errors` entry says
 * the list was cut short, so a caller never mistakes a partial list for a
 * whole one. Enough to fix a broken template in one pass; not so many that
 * a document of junk produces megabytes of messages.
 */
export const MAX_ERRORS = 100

/**
 * Components in one region, counting those inside containers, so wrapping
 * components in a container does not get round it. A printed page holds a
 * few dozen blocks; a region of five hundred is a document that should be
 * two.
 */
export const MAX_REGION_COMPONENTS = 500

/**
 * How deep containers (columns, keep-together blocks) nest. A container
 * inside four others is refused. Every stage that walks the tree --
 * validation, the core's commands, the runtime, the layout -- recurses this
 * deep and no deeper, and nesting past it is a layout no reader follows.
 */
export const MAX_NESTING_DEPTH = 4

/** Columns in a columns block: fewer than two is not columns; more than four on A4 is too narrow to read. */
export const MIN_COLUMNS = 2
export const MAX_COLUMNS = 4

/** Columns in a table: wider than a landscape page can show legibly, and a bound on per-row work. */
export const MAX_TABLE_COLUMNS = 32

/** Sort keys on a table. Each one costs a comparison per row pair; a longer sort is usually a missing key. */
export const MAX_SORT_KEYS = 8

/** Rows under a group or under the table: a subtotal, a discount, two tax lines and a total fit with room to spare. */
export const MAX_FOOTER_ROWS = 8

/** Fields in one dataset contract: a report prints a fraction of any source table's columns. */
export const MAX_DATASET_FIELDS = 64

/** Print styles in one report. A report's look is a handful of tokens; this is many handfuls. */
export const MAX_STYLES = 64

/** Conditional style rules on one component or column. Each is an expression evaluated per render or per row. */
export const MAX_STYLE_RULES = 8

/** Parameters: each is a field on the parameter form a person fills in before rendering. */
export const MAX_PARAMETERS = 32

/** Asset references: each is a lookup and a byte budget at render time. */
export const MAX_ASSETS = 64

/**
 * The most bytes one image asset may have: 20 MB, the renderer trial's
 * limit, the plan's "enforced limits" made a number to test, and chosen, not
 * measured. A builder refuses a file past it before reading it, the runtime
 * a host's answer past it before copying it, and the renderer bytes past it
 * before decoding them, from this one constant; an SVG is held to
 * `MAX_SVG_BYTES` besides.
 */
export const MAX_ASSET_BYTES = 20 * 1024 * 1024

/**
 * Pixels a side of a PNG or a JPEG asset: the renderer trial's limit too,
 * and as chosen. What pictures of this size cost the renderer to embed is
 * measured beside report-render-pdf's `MAX_IMAGE_DATA`, which bounds a
 * render by them. `imageHeader` holds a picture to it, where a person adds
 * one and where it prints.
 */
export const MAX_ASSET_SIDE = 4096

/** Aggregates: each is a pass over the detail rows, per group and once overall. */
export const MAX_AGGREGATES = 32

/**
 * VAT categories an e-invoice declares, each a VAT breakdown (BG-23) its
 * XML writes and a basis and an amount its page reads. Germany's two rates,
 * an exempt category and a reverse-charged one take four; eight is twice
 * that, and a list of breakdowns no invoice prints is refused unread.
 */
export const MAX_VAT_CATEGORIES = 8

/** Inline runs in one paragraph or group header. A paragraph with more bindings than this is a table. */
export const MAX_INLINES = 64

/**
 * Characters in a property name. The format's own names are short and its
 * ids are at most 64 characters, so a longer name is never one it knows. It
 * is refused before a path is built from it, so that no path and no message
 * grows with what a document holds.
 */
export const MAX_KEY_LENGTH = 64

/** Characters (UTF-16 code units, as JavaScript counts) in a literal run of text: several pages of prose. */
export const MAX_TEXT_LENGTH = 10_000

/** Characters in a title, label, column header, empty-state text or parameter default: one line, generously. */
export const MAX_LABEL_LENGTH = 200

/** Characters in a CEL expression. An expression is a formula, not a program; the runtime bounds its evaluation too. */
export const MAX_EXPRESSION_LENGTH = 1024

/** Digits after the decimal point, for fields, formats and rounding. Covers every currency's minor unit and unit prices to many places. */
export const MAX_SCALE = 20

/** Font sizes in points: below 4 is not legible print, above 96 is a poster. */
export const MIN_FONT_SIZE = 4
export const MAX_FONT_SIZE = 96

/**
 * The longest length anything in a report may have, in points. Not chosen:
 * 14,400 units (200 inches) is the largest page dimension PDF readers
 * implement (ISO 32000-1, Annex C), so nothing longer can appear on a page.
 */
export const MAX_LENGTH_PT = 14_400

/**
 * The smallest printable area the margins may leave, each way: one inch,
 * 72 points. Not chosen so much as named: less than an inch of width does
 * not hold a word of body text.
 */
export const MIN_PRINTABLE_PT = 72

/*
 * The bounds of an SVG asset (0030). Each is held by report-spec's
 * `cleanSvg` when an asset is approved and by `checkSvg` when it prints, so
 * that an approved drawing costs a bounded amount to clean, to draw and to
 * read back, wherever it is drawn. A `source.js:N` below is a line of
 * pdfmake 0.3.11's `src/3rd-party/svg-to-pdfkit/source.js`, of which Node
 * runs a transpiled copy under `js/`.
 *
 * Measured on 2026-10-18 on an Intel i9-10900K under Node 24.21.0 with
 * pdfmake 0.3.11, and in Chromium 156.0.8078.4 (Playwright 1.64.1's headless
 * shell, drawing in software) with pdfjs-dist 6.4.299, as the Studio's
 * Preview draws a page. A starter page costs 63-89 ms to pixels there. The
 * aim the per-drawing bounds were set by is that the worst logo they
 * accept, at the starters' 15 mm, costs about what one more starter page
 * costs; what they give is more, two to six starter pages at 15 mm and
 * three to eight page-wide (`MAX_SVG_SEGMENTS`), since a bound low enough
 * to keep the aim against a rasteriser's worst would refuse detailed
 * logos. The machine was shared, so a time below is a median, and a range
 * where repeated runs differed.
 */

/**
 * Bytes in an SVG asset, both as the file comes and as `cleanSvg` writes it:
 * the written form can be several times its input -- a relative path written
 * as absolute coordinates, a colour name as `#rrggbb` -- so a drawing whose
 * cleaned form would pass this is refused when it is approved, not at every
 * print after. A logo is kilobytes; the exporters' invented samples were
 * 545-2,520 bytes in and 483-994 out. At the bound the cleaner itself took
 * at most 179 ms in Node on the costliest it accepts (`MAX_SVG_CASCADE`'s
 * worst; 3,000 moves, each styled with every property and turned, written
 * to 1.04 MB, 141-162 ms), 35-120 ms on a mebibyte of each shape of value
 * `svg-threats.test.ts` holds it to, and 292-331 ms to refuse a mebibyte of
 * path past MAX_SVG_SEGMENTS (Node alone, on the day these were measured
 * again); a page of rectangles of that size takes the renderer 0.94 s to
 * draw.
 */
export const MAX_SVG_BYTES = 1_048_576

/**
 * Element levels in a drawing, the root's included, as the file nests them
 * and as `cleanSvg` writes them; also the longest chain of gradients that
 * name each other. pdfmake's XML reader and svg-to-pdfkit both recurse once
 * per level, and 5,000 levels overflowed the stack in a probe. 32 and 64
 * levels with a transform each cost the same as none (122 ms to render, 59-65
 * ms to pixels), so this bounds recursion, not time. The deepest exporter
 * sample nests four.
 */
export const MAX_SVG_DEPTH = 32

/**
 * Elements in a cleaned drawing. svg-to-pdfkit re-reads and draws every one
 * on every page it is drawn on, at about 34 microseconds an element: 10,000
 * one-unit rectangles took 545 ms of the renderer's final pass against 55
 * without them, and 234 ms (DPR 1) and 198 ms (DPR 2) to pixels.
 */
export const MAX_SVG_ELEMENTS = 10_000

/**
 * What one drawing costs a reader to paint, in weighted segments. Each
 * command the converter draws counts: a move, a line or a close 1, a curve
 * 3 (10,000 short crossing cubics cost about what 30,000 such lines do, in
 * Node and in Chromium; a cubic spanning the box costs less than three
 * lines that do, 10,000 of them 238 ms against 933 ms for 30,000 lines,
 * as review measured the same day), an arc 3 for each curve svg-to-pdfkit splits it
 * into (one per 60 degrees, `source.js:1054` at its default precision), and
 * an arc that ends where it starts, which draws nothing, 1. A stroked shape
 * counts its commands twice more, three times in all when it is also filled
 * (10,000 lines filled and stroked cost about what 30,000 filled do). A clip
 * path's commands count once for every element it clips, a gradient's stops
 * once for every shape painted with it, and a dashed stroke one more for
 * each dash it could draw.
 *
 * A rasteriser's worst is a path whose every segment crosses the whole
 * box: it pays for each segment on every row of pixels the segment spans,
 * so the cost grows faster than the count. A zigzag of such lines took 121
 * ms to pixels at DPR 1 and 132 ms at DPR 2 in a 15 mm box at this bound,
 * 268-276 ms at 15,000, 490-500 ms at 20,000 and 1.15-1.27 s at 30,000; the
 * worst accepted -- that zigzag in a clipped group, with three more clipped
 * shapes, every group the bounds allow -- took 190 and 392 ms at 15 mm and
 * 269 and 550 ms page-wide, against 63 to 89 ms for a starter page (on
 * 2026-10-18, in the Chromium and pdfjs-dist above, medians of five). The
 * same count of 30,000 in paths whose segments were a seventh of the box
 * long took 184-295 ms, and spanning the box 1.15 to 1.84 s. A logo whose
 * curves are short costs far less than its count says, and one of more
 * than this is refused, to be simplified in the drawing program.
 */
export const MAX_SVG_SEGMENTS = 10_000

/**
 * Transparency groups in one drawing, in units: a clip-path reference 1, a
 * group with an opacity under 1 1, and a shape painted with a gradient
 * whose stops come out translucent 2. svg-to-pdfkit makes every one a
 * group the size of the whole page, whatever the size of the logo, and a
 * translucent gradient two page-sized objects, so the cost is the page's
 * pixels: about 15 ms a clip at DPR 1 and 59 ms at DPR 2, 30 ms and 117 ms
 * a translucent gradient, 1.4 ms and 5.2 ms a group opacity. Four units keep
 * the worst accepted at about 60 ms more than a starter page at DPR 1 and
 * 240 ms at DPR 2, and admit every exporter sample: Figma's clipped frame is
 * 1, Figma's fade with a layer at 80 % is 3, Canva's two shapes 2. A
 * translucent stop is kept because a bound this small admits them; a Canva
 * logo of five shapes or more, each clipped, is refused.
 */
export const MAX_SVG_GROUPS = 4

/**
 * Stops in one gradient. Each use of a 64-stop gradient writes 10.9 kB into
 * the PDF and costs a reader about half a millisecond; `MAX_SVG_SEGMENTS`
 * bounds the uses, counting a gradient's stops once each. A logo's
 * gradients have two to five.
 */
export const MAX_SVG_STOPS = 64

/**
 * Entries in a stroke's dash array, after an odd list is doubled as SVG
 * doubles it. Every dash it draws counts against `MAX_SVG_SEGMENTS` too: a
 * spiral of 4,096 segments dashed at a period of 0.01 units, about 900,000
 * dashes, cost 219-265 ms to pixels against 70-102 ms dashed at a period of
 * one unit. Skia gives up at a count of its own; another reader may not.
 */
export const MAX_SVG_DASHES = 32

/**
 * The largest magnitude of any number in a drawing; of every entry of the
 * transform composed from the root down to each element, and of its
 * inverse, which svg-to-pdfkit computes for every clip and group opacity;
 * and of the matrix a gradient is drawn under, its shape's and its box's
 * composed with its own. With a point and a matrix both at it in a viewBox
 * one unit wide, the renderer drew in 115 ms with no warning, and the
 * device coordinates stayed near 10^13 points, far below the 10^21 at
 * which PDFKit throws; past it, two groups shrinking a millionfold each
 * under a clip, or a gradient composed to a million cubed, threw from
 * inside PDFKit. An e-invoice's PDF/A-3 keeps none of PDF/A-1's 32,767 for
 * a real: veraPDF 1.30.3's PDF/A-3b profile holds a real to 3.403 × 10^38
 * (its rule 6.1.13-2), past PDFKit's 10^21, and an integer to 2,147,483,647
 * (6.1.13-1), which the numbers the converter computes from these bounds can
 * pass -- a group's box under a shrink of 10^6 in a box of a point reached
 * 7.85 × 10^10 -- so the renderer holds an SVG in an e-invoice to that by
 * the extent `cleanSvg` measures (`svg-extent.ts`; report-render-pdf's
 * `svg-pdfa.ts`), and no bound here is lowered for it.
 */
export const MAX_SVG_COORDINATE = 1_000_000

/**
 * Simple selectors -- a type, a class or an id -- in all of a drawing's
 * stylesheets together, after comma lists are split. Indexing the rules by
 * id, class and type makes matching linear in the rules that could match,
 * but rules that all match every element cannot be shortened that way, so
 * the work is this bound times the combinations of classes elements hold.
 * The rules one combination matches are merged once: 256 one-class rules,
 * each declaring every kept property, all matching 10,000 elements, took
 * the cleaner 85-102 ms in Node and 63-81 ms in Chromium, against 1.9 s
 * when every element read every rule. Elements of combinations of their
 * own are bounded by `MAX_SVG_CASCADE`. Illustrator's samples hold three.
 */
export const MAX_SVG_RULES = 256

/**
 * The cascade's work, in all: each rule compared with a combination of
 * type, id and classes an element holds, and each declaration merged for it.
 * Merging once per combination makes ten thousand elements of one class one
 * merge, but elements that each hold a combination of their own are one
 * merge each: 9,990 elements, each of its own set of fourteen classes, under
 * 242 type rules declaring every kept property took the cleaner 1.8 s in
 * Node. At this bound the costliest shape measured -- 5,000 elements each
 * of its own pair of 101 classes, under 98 type rules of one declaration --
 * took 179 ms (158-271), within what the worst file `MAX_SVG_BYTES` admits
 * costs, and that shape of 9,990 elements is refused in 136 ms. An
 * Illustrator export, one class an element from a few dozen, merges a few
 * hundred times. Measured on 2026-10-18 under Node 24.21.0, medians of five,
 * on the machine and the terms above.
 */
export const MAX_SVG_CASCADE = 1_000_000

/**
 * Distinct names `cleanSvg` lists among what it removed; removals of every
 * further name are counted, not named, so that the list a person is shown
 * does not grow with what a file holds. Chosen, not measured: the Inkscape
 * sample, the most any exporter's sample removes, lists 26 names -- its
 * editor's attributes, namespaces, layers and text properties -- and a
 * bound of 16 would have cut it short.
 */
export const MAX_SVG_REMOVED_NAMES = 32

/**
 * The bounds of a font asset (0040), each measured on 21 October 2026 on
 * an Intel i9-10900K under Windows 11 and Node 24.21.0, shared with another
 * workflow's builds (8 to 11 % load), medians of seven reads: on the
 * costliest font these three admit, made in code; on the 447 `.ttf` and
 * `.ttc` files of the machine's Windows fonts directory, never copied into
 * the repository; and on the faces the renderer ships. The reads, and the
 * tally of the machine's fonts, were measured again on 22 October 2026, on
 * the reader as review left it, at 1 to 12 % load.
 */

/**
 * Bytes in a font: an image asset's 20 MB (`MAX_ASSET_BYTES`), which a
 * builder, the runtime and the renderer already hold an asset to. The
 * costliest font it admits -- 65,534 glyphs each walked flag by flag, a
 * format 12 map of 131,066 characters -- read in 60 ms (57-65); Malgun
 * Gothic, 13.5 MB and 28,215 glyphs, in 16 to 17 ms, Liberation Sans in
 * 0.8.
 * What subsetting a large font costs a render is the renderer's to measure
 * where it embeds a host's font; of the machine's fonts, two collections and
 * SimSun-ExtB, 21.9 MB, are past it.
 */
export const MAX_FONT_BYTES = MAX_ASSET_BYTES

/**
 * Characters one font may map: 131,072, twice the BMP. A kilobyte of
 * format 12 can map every code point there is, a Set of 1,114,112 entries
 * that took 150 ms and 60 to 80 MiB of heap to build; at this bound the Set
 * takes 8 ms and 5 MiB. Of the 412 fonts on the machine the reader
 * accepts, the most a font maps is 28,530 (HP Simplified Hans); Roboto maps
 * 927, Liberation Sans 2,327. Chosen, at more than four times the most
 * measured.
 */
export const MAX_FONT_CHARACTERS = 0x20000

/**
 * A simple glyph's points times its contours. fontkit, through which
 * PDFKit subsets a font, looks every point up among the glyph's contour
 * ends: one glyph of 32,767 contours and 65,534 points, 66 KB of a font
 * the reader otherwise accepts, took PDFKit 1.6 s to embed, and 16,000
 * contours of 32,000 points 0.4 s, four times as long for each doubling.
 * At this bound a glyph costs it under a millisecond: 200 such glyphs
 * embedded in 168 ms. The most of any glyph in the machine's fonts is
 * 160,000 (200 contours of 800 points, Lucida Sans Unicode); Liberation
 * Sans's is 28,224, Roboto's 3,549.
 */
export const MAX_FONT_GLYPH_WORK = 1_048_576
