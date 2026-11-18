import { MAX_ASSET_BYTES } from '@formancy/report-runtime'

/**
 * What one Word file may hold (0068). The writer builds a file in one
 * synchronous step, in memory, on whatever thread calls it, and counts no
 * page, so it has no page limit to stop at as the PDF renderer has: these
 * bound the work before any of it is done, counted in the walk that
 * checks the document and, for its pictures, as each asset is first read
 * (`check.ts`). Past one, the document is refused as `content-too-large`,
 * never cut to fit.
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
 * to 0.3 seconds. And the pictures' bytes, which are read before any of
 * it: the largest PNG an asset may be, 4,096 pixels a side of 16-bit
 * RGBA, 134 MB of scanlines, was inflated and summed in 0.8 seconds; a
 * PNG with 20 MB after the end of its image data was refused in 0.1,
 * where 16 MB had taken 4.2 before the writer stopped at that end
 * (`assets.ts`). These are the shapes that were looked for, and no more
 * is claimed. `bounds.test.ts` writes the first at its bound and counts
 * what the second reads, and `pictures.test.ts` the slices read of the
 * last; the relationships are held only by a file of `MAX_DOCX_PICTURES`
 * pictures being written.
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
