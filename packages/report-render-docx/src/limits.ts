import { MAX_ASSET_BYTES } from '@formancy/report-runtime'

/**
 * What one Word file may hold (0068). The writer builds a file in one
 * synchronous step, in memory, on whatever thread calls it, and counts no
 * page, so it has no page limit to stop at as the PDF renderer has: these
 * bound the work before any of it is done, counted in the walk that
 * checks the document (`check.ts`). Past one, the document is refused as
 * `content-too-large`, never cut to fit.
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
 */

/**
 * The paragraphs a file may hold, a table's cell being one, with each
 * picture, rule, spacer, page break, rectangle, column and frame. Each
 * states its own properties, some 480 characters of XML. A report of the
 * runtime's most detail rows, 100,000, is past it in a table of one
 * column: such a report prints as a PDF where its host allows the pages,
 * and is refused as a Word file.
 */
export const MAX_DOCX_PARAGRAPHS = 100_000

/**
 * The characters a file's text may hold, as UTF-16 code units, counted
 * where the paragraphs are: the bound on what is written, where the
 * paragraphs bound how often. A cell may be 16,384 of them
 * (`MAX_STRING_LENGTH`), so the paragraphs alone would let a document ask
 * for more than a billion and a half.
 */
export const MAX_DOCX_CHARACTERS = 4_000_000

/**
 * The bytes a file's pictures may hold together, each asset counted once
 * however often it is drawn: two of the largest an asset may be, as the
 * PDF renderer's `MAX_IMAGE_DATA` counts two images of the largest kind.
 * A PNG's and a JPEG's bytes are stored in the file as they are.
 */
export const MAX_DOCX_MEDIA_BYTES = 2 * MAX_ASSET_BYTES
