import { MAX_ASSET_BYTES, MAX_ASSET_SIDE } from '@formancy/report-runtime'

/**
 * What one Word file may hold (0068). The writer builds a file in one
 * synchronous step, in memory, on whatever thread calls it, and counts no
 * page, so it has no page limit to stop at as the PDF renderer has: these
 * bound the work before any of it is done, counted in the walk that
 * checks the document and, for its pictures, as each asset is first read
 * (`check.ts`). Past one, the document is refused as `content-too-large`,
 * never cut to fit; a font whose family is past `MAX_DOCX_FAMILY_LENGTH`
 * is refused as `invalid-asset`, as a font the writer cannot name.
 *
 * Measured on 17 November 2026, on an Intel Core i9-10900K shared with
 * other work, under Node 24.21.0 with fflate 0.8.3, a process a
 * measurement: a table of `MAX_DOCX_PARAGRAPHS` cells holding
 * `MAX_DOCX_CHARACTERS` characters between them, every one an ampersand,
 * which is written five characters long, was written in 1.9 seconds, the
 * process's resident memory 657 MB at its most, in one column, and in
 * 1.9 seconds and 609 MB in four; the same cells holding a character
 * each took 1.4 seconds and 555 MB. So it is the paragraphs that cost,
 * some 5 KB each while the file is built, and the text little. At two
 * and a half times the paragraphs and twice the characters it took 4.6
 * seconds and 1,319 MB, which is past what a page's thread should hold.
 *
 * A count bounds the work only where the work is the count's, and three
 * shapes inside the bounds cost its square until each was written in one
 * pass: paragraphs each kept with the next, a table that closes with
 * total after total, and a part's relationships, looked up once for
 * every picture drawn. Measured again on 18 November 2026, the same way
 * on the same machine, busier that day -- the table of cells above took
 * 2.1 to 2.5 seconds and 720 MB at the most: 100,000 paragraphs each kept
 * with the next, 1.1 seconds and 497 MB, where they had taken 163
 * seconds; a table of a detail row and 99,998 totals, 1.4 seconds and 605
 * MB, where 40,000 had taken 3.8; 100,000 pictures of one asset, 1.9
 * seconds and 671 MB; `MAX_DOCX_PICTURES` pictures of an asset each, 0.2
 * to 0.3 seconds. `bounds.test.ts` writes the first at its bound and
 * counts what the second reads; the relationships are held only by a
 * file of `MAX_DOCX_PICTURES` pictures being written.
 *
 * And a count bounds the work only where each thing counted costs what
 * the count takes it for. A second review, that day, found three that
 * did not, each inside every bound, and measuring them found a fourth: a
 * font's family, which every run and every paragraph mark states four
 * times, as long as its font made it (`MAX_DOCX_FAMILY_LENGTH`); a line
 * ending, a break and a `w:t` of its own for the one character it was
 * counted as (`MAX_DOCX_RUNS`); a PNG, inflated in full however many a
 * file held (`MAX_DOCX_IMAGE_DATA`); and a rectangle and a section's
 * frame, a whole table for the one paragraph each was counted as
 * (`ONE_CELL_TABLE`). Measured once each is counted for what it is, the
 * same way on the same machine, with fflate 0.8.3 and pako 3.0.2, every
 * text of ampersands, the memory with the document the writer was handed
 * in it, four to twelve processes a shape: the table of cells above, 2.0
 * to 2.5 seconds, and 724 MB in seven processes of ten and 993 MB in
 * three; in a mapped family of 31 letters, the longest, 2.5 to 2.9
 * seconds, and 838 MB in three of four and 1,095 MB in one.
 * `MAX_DOCX_PARAGRAPHS` paragraphs of two runs each holding
 * `MAX_DOCX_CHARACTERS` characters, the three bounds at once, 2.3 to 2.5
 * seconds and 734 MB, in that family 2.8 to 3.1 seconds and 877 MB, and
 * with every paragraph kept with the next in one kept block and centred
 * and every run set off the line besides, 3.2 to 3.3 seconds and 946 MB:
 * the longest that was found. One paragraph of one run at the
 * characters' bound with every line ending the runs' bound allows, 1.1
 * seconds and 489 MB; the table of cells with a line ending in each, 2.3
 * to 2.5 seconds, and 743 MB in four processes of five and 1,010 MB in
 * one, and in that family 2.6 to 2.9 seconds, and 857 MB in two of four
 * and 1,112 MB in two: the most memory that was found. A table of cells
 * took the less or the more from one process to the next, some 265 MB
 * apart for the same document, and why was not looked for. Half the
 * paragraphs' bound of filled and outlined rectangles, 1.4 to 1.5
 * seconds and 570 MB, of framed sections, 1.4 and 567, and of tables of
 * a header alone, 2.2 to 2.3 and 734; `MAX_DOCX_PARAGRAPHS` columns
 * blocks of one column, 1.8 to 1.9 seconds and 699 MB. And the pictures'
 * bytes, which are read before any of it: the largest PNG an asset may
 * be, 4,096 pixels a side of 16-bit RGBA, 134 MB of scanlines, was
 * inflated in 0.5 to 0.6 seconds, and two of them, which is all a file
 * may hold, in 1.0; a PNG with 20 MB after the end of its image data was
 * refused in 0.1 (`assets.ts`).
 *
 * These are the shapes that were looked for, and no more is claimed.
 */

/**
 * The paragraphs a file may hold, a table's cell being one, with each
 * picture, rule, spacer, page break and column, and each rectangle and
 * frame as two (`ONE_CELL_TABLE`). Each states its own properties, some
 * 470 characters of XML a cell. A report of the runtime's most detail
 * rows, 100,000, is past it in a table of one column: such a report
 * prints as a PDF where its host allows the pages, and is refused as a
 * Word file.
 */
export const MAX_DOCX_PARAGRAPHS = 100_000

/**
 * What a rectangle and a section's frame are each counted as, with the
 * paragraphs: two, the paragraph its cell ends with and the table around
 * it. Each is written as a table of one cell, with that table's own
 * properties, its grid, its row and its cell's borders and fill, where a
 * cell of a report's table shares all but the last with its neighbours.
 * Measured on 18 November 2026 as the length of `word/document.xml` for a
 * thousand of each, less an empty document's, by the thousand: a
 * rectangle filled and outlined 993 characters and 663 bare, a framed
 * section 942 before its blocks, a cell of a table of one column 466, a
 * picture 744 to 788, a columns block of one column 608, a paragraph of
 * one run 359 and of two 560. Counted as one, 100,000 filled rectangles
 * were inside every bound and cost more than any text the bounds allow:
 * 3.3 to 3.6 seconds and 1,250 MB, four processes, on the machine above.
 */
export const ONE_CELL_TABLE = 2

/**
 * The characters a file's text may hold, as UTF-16 code units, counted
 * where the paragraphs are: the bound on what is written, where the
 * paragraphs bound how often. A cell may be 16,384 of them
 * (`MAX_STRING_LENGTH`), so the paragraphs alone would let a document ask
 * for more than a billion and a half.
 *
 * Counted with them, for every run and every paragraph mark: what the
 * family it names is written longer than `MAX_DOCX_FAMILY_LENGTH`
 * characters in each of its four font slots (`fonts.ts`). A family of
 * letters costs none; one of 31 quotation marks, each six characters in
 * an attribute, 620 a run and 620 a mark, which a file's text may then
 * not be.
 */
export const MAX_DOCX_CHARACTERS = 4_000_000

/**
 * The characters a mapped font's family may be named in, as UTF-16 code
 * units: what Word reads of one. Looked up on 18 November 2026, not
 * measured: Microsoft's notes on how Office implements the standard say
 * of `w:rFonts`' four slots that "Word restricts the value of these
 * attributes to be less than 32 characters" ([MS-OI29500], Part 1
 * Section 17.3.2.26), and of the font table's `w:font` that "Word limits
 * font name length to between 1 and 31 characters" (17.8.3.10); it is
 * the face name of Windows, `LOGFONT`'s `lfFaceName`, 32 characters with
 * its terminator. What Word does with a longer one nobody here has seen.
 *
 * It bounds the work too. Every run and every paragraph mark states its
 * family four times, and report-spec's `readFont` holds a font's
 * PostScript name to 63 characters and its family to none: a font of 66
 * KB whose family was 32,767 quotation marks made 350 paragraphs of a
 * letter each a string of 663 MB, a RangeError and no refusal. A family
 * of this length is what the bounds are measured with; what escaping
 * writes one longer is counted with `MAX_DOCX_CHARACTERS`.
 */
export const MAX_DOCX_FAMILY_LENGTH = 31

/**
 * The runs a file's text may hold, counted where the paragraphs are: a
 * run of text one, empty or not, a page field three, as Word writes it,
 * a table's cell one, and each line ending in a text one more. A run
 * states its own properties, some two hundred characters of XML for one
 * of text, so the paragraphs and the characters alone would let one
 * paragraph of four million runs of a letter each through, which held
 * the thread nine seconds before the string the file is built in grew
 * past what V8 allows. Twice the paragraphs, so that a table at their
 * bound is within it. Measured on 18 November 2026, the same way on the
 * same machine: one paragraph of `MAX_DOCX_RUNS` runs of a letter each,
 * 1.2 seconds and 484 MB; a page header of a third as many page fields,
 * 0.8 seconds and 344 MB; and `MAX_DOCX_PARAGRAPHS` paragraphs of two
 * runs each, holding `MAX_DOCX_CHARACTERS` ampersands between them, all
 * three bounds at once, 2.4 seconds and 559 MB.
 *
 * A line ending states no properties, and is no character of the page
 * either: it is written as a break, and what follows it as a `w:t` of
 * its own, some forty characters of XML. Counted as the one character it
 * is in the text, one paragraph of one run of four million characters,
 * every other a line feed, was inside every bound and written in 4.6
 * seconds and 1,440 MB, and 100,000 cells of forty such characters in
 * 4.6 seconds and 979 MB. Counted as a run each, every one a text holds
 * -- the one that ends a paragraph's or a cell's text among them, which
 * is written as nothing, as an empty run is counted -- the bound on runs
 * is the bound on breaks.
 */
export const MAX_DOCX_RUNS = 2 * MAX_DOCX_PARAGRAPHS

/**
 * The bytes a file's pictures may hold together as they are stored, each
 * asset counted once however often it is drawn: two of the largest an
 * asset may be. A PNG's and a JPEG's bytes are stored in the file as they
 * are, so this is the bound on the file. It says nothing of what a PNG
 * inflates to, which `MAX_DOCX_IMAGE_DATA` bounds: the PDF renderer's
 * `MAX_IMAGE_DATA` is that bound's number, and none of this one's.
 */
export const MAX_DOCX_MEDIA_BYTES = 2 * MAX_ASSET_BYTES

/**
 * The image data a file's pictures may hold together, each asset counted
 * once however often it is drawn, and counted as the PDF renderer counts
 * its `MAX_IMAGE_DATA`: a PNG's scanlines as its header promises them, a
 * JPEG's bytes as they are, an SVG none. Two of the largest PNG an asset
 * may be, `MAX_ASSET_SIDE` pixels a side of 16-bit RGBA, 134,221,824
 * bytes of scanlines each, which is the renderer's number.
 *
 * The writer embeds a PNG's bytes as they are and inflates them all the
 * same, to refuse what is no picture (`assets.ts`), and a PNG's bytes
 * say little of what they inflate to: the largest, every pixel alike, is
 * a file of 130,527 bytes, so 321 of them were within
 * `MAX_DOCX_MEDIA_BYTES` and `MAX_DOCX_PICTURES`, and each was inflated
 * in full -- eight in 6.1 seconds, on 18 November 2026, on the machine
 * above -- where the renderer refuses the third. So a picture's image
 * data is counted from its header, before a PNG's is inflated, and the
 * writer inflates no more than this bound.
 *
 * Stated here and in the renderer, which the writer does not depend on,
 * and chosen equal so that the two refuse the same documents: no package
 * below both holds what an engine's pictures may cost it, and
 * `against-pdf.test.ts` holds the two to each other by the picture each
 * refuses at, a byte past the bound and not at it.
 */
export const MAX_DOCX_IMAGE_DATA = 2 * MAX_ASSET_SIDE * (1 + MAX_ASSET_SIDE * 8)

/**
 * The pictures a file may hold, each asset counted once however often it
 * is drawn. Each is a part of the file, an entry of its zip, and a zip's
 * directory counts its entries in sixteen bits: fflate 0.8.3 writes a
 * count past them modulo 65,536 and says nothing, so a document of 65,600
 * pictures, inside every other bound, was written as a file whose
 * directory stated 72 entries, which no reader opens. Chosen, not
 * measured, and far under that count: a report declares at most 64 assets
 * and reads at most 64 more from its header's fields (report-spec's
 * `MAX_ASSETS` and `MAX_DATASET_FIELDS`), and the runtime shares one asset
 * among the images that draw it, so no document it resolved holds more
 * than 128. A document made otherwise that holds more than this prints as
 * a PDF, and is refused as a Word file.
 */
export const MAX_DOCX_PICTURES = 1024
