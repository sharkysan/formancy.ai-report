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
 * Every figure here is of a process a measurement, one at a time, on an
 * Intel Core i9-10900K shared with other work, under Node 24.21.0, whose
 * V8 is 13.6, with fflate 0.8.3 and, from the second review on, pako
 * 3.0.2: the seconds `renderDocx` held the thread, and the process's
 * resident memory at its most (`process.resourceUsage().maxRSS`, which
 * counts in units of 1,024 bytes, over 1,024, written MB), the document
 * the writer was handed in it.
 *
 * **What the bounds stay under.** Measured on 17 November 2026: a table
 * of 100,000 cells holding 4,000,000 characters between them, every one
 * an ampersand, which is written five characters long, was written in
 * 1.9 seconds and 657 MB in one column, and in 1.9 seconds and 609 MB in
 * four; the same cells holding a character each took 1.4 seconds and 555
 * MB. So it is the paragraphs that cost, some 5 KB each while the file is
 * built, and the text little. At two and a half times the paragraphs and
 * twice the characters it took 4.6 seconds and 1,319 MB, which is past
 * what a page's thread should hold: the bounds are set so that no file
 * that was looked for costs as much.
 *
 * **A count bounds the work only where the work is the count's.** Three
 * shapes inside the bounds cost its square until each was written in one
 * pass: paragraphs each kept with the next, a table that closes with
 * total after total, and a part's relationships, looked up once for
 * every picture drawn. Measured on 18 November 2026: 100,000 paragraphs
 * each kept with the next, 1.1 seconds, where they had taken 163; a
 * table of a detail row and 99,998 totals, 1.4 seconds, where 40,000 had
 * taken 3.8. `bounds.test.ts` writes the first at its bound and counts
 * what the second reads; the relationships are held only by a file of
 * `MAX_DOCX_PICTURES` pictures being written.
 *
 * **And only where each thing counted costs what the count takes it
 * for.** A second review, that day, found three that did not, each
 * inside every bound, and measuring them found a fourth: a font's
 * family, which every run and every paragraph mark states four times, as
 * long as its font made it (`MAX_DOCX_FAMILY_LENGTH`); a line ending, a
 * break and a `w:t` of its own for the one character it was counted as
 * (`MAX_DOCX_RUNS`); a PNG, inflated in full however many a file held
 * (`MAX_DOCX_IMAGE_DATA`); and a rectangle and a section's frame, a whole
 * table for the one paragraph each was counted as (`ONE_CELL_TABLE`).
 * What each cost uncounted is said at its bound.
 *
 * **And a figure holds for what was measured.** A third review, that
 * day, found that every figure of memory until then was of text V8 holds
 * a byte a character -- the text was ampersands throughout -- and that
 * the two amounts a table of cells had been seen to take from one
 * process to the next, some 265 MB apart for one document, had no
 * reason given. Measured again that day, each shape as it was and with
 * one euro sign in its text, the paragraphs' bound still 100,000:
 *
 * - **The text.** One character past U+00FF in a part's text, and V8
 *   holds the string the part is built in, and each copy made of it on
 *   the way, two bytes a character. The table of 100,000 cells took 732
 *   to 734 MB as it was and 983 to 985 MB with a euro sign in its
 *   header's cell, the less of its two amounts each time.
 * - **The two amounts.** They are V8's, not the text's. They stand some
 *   285 MB apart with the euro sign and without it: that table took
 *   1,016 to 1,019 MB in four processes of six, and 1,270 to 1,272 MB
 *   with the euro sign in four of six. With V8's allocation-site
 *   pretenuring turned off (`--no-allocation-site-pretenuring`), eight
 *   processes of eight took the less, 734 to 735 MB. V8 decides while a
 *   program runs,
 *   from what survived its young collections, which sites allocate in
 *   its old generation from the start, and what dies there waits for a
 *   full collection. Its own traces (`--trace-pretenuring-statistics`,
 *   `--trace-gc`) show a process that takes the more deciding so of six
 *   sites more, and its heap growing by some 19 MB at each young
 *   collection of the write where the other's grows by 5: 654 MB before
 *   the full collection that follows, against 436.
 * - **What decides it.** What the process did before the write. A table
 *   made alone, as the measurement makes one, took the more in 33
 *   processes of 107 at 88,000 cells and more, and in none of 241 under
 *   that. Under it, it took the more once a string of some characters
 *   was held beside each of its rows, which the writer never reads, as
 *   a host holds its data's rows beside the document it resolved. And
 *   how much more hangs on the file: some 285 MB for the table of
 *   cells, and 468 MB for the one with a line ending in each cell, in
 *   the one process that took the more of it made alone.
 * - **So the most was not the 1,112 MB that had been found.** With a
 *   euro sign, in a mapped family of 31 letters, the table of 100,000
 *   cells took 1,454 to 1,478 MB in six processes of eight, and 1,509
 *   to 1,514 MB in four of six with a string of 160 characters held
 *   beside each row; the one with a line ending in each cell took 1,511
 *   MB in one of eight. All are past the 1,319 MB the bounds are set to
 *   stay under.
 *
 * The paragraphs drive it, and the characters do not: at half the
 * characters those two tables still took 1,366 MB and 1,384 to 1,406
 * MB. So `MAX_DOCX_PARAGRAPHS` is 70,000, where it was 100,000, and the
 * runs' bound, twice it, moved with it. Not 80,000 and not 75,000: with
 * a string of 160 characters beside each row, the table in that family
 * took 1,310 to 1,314 MB at 80,000 cells in five processes of eight, and
 * the one with line endings 1,290 to 1,321 MB at 75,000 in seven of
 * sixteen, with one of 24 or of 160.
 *
 * **At the bounds as they are**, measured on 18 November 2026, every
 * text of ampersands, as it is and with one euro sign in it, in place of
 * its first ampersand or, where a shape has no text, of its last block:
 *
 *     the file                                  as it is            with a euro sign        processes
 *     a table of `MAX_DOCX_PARAGRAPHS` cells
 *       holding `MAX_DOCX_CHARACTERS`
 *       ampersands                              1.8-2.2 s, 626-629  1.9-2.3 s, 827-829      8
 *     that table in four columns                1.6 s, 594-595      1.7-1.8 s, 786-788      4
 *     its cells holding a character each        1.0-1.1 s, 503-507  1.1 s, 628-632          4
 *     that table in a mapped family of 31
 *       letters, the longest Word reads         2.1-2.3 s, 708-710  2.3-2.4 s, 959-962      8
 *     as many paragraphs of two runs, holding
 *       as many ampersands: the paragraphs,
 *       the characters and the runs at once     1.9-2.3 s, 620      2.0-2.6 s, 789-791      5
 *     those paragraphs in that family           2.4-2.7 s, 722-724  2.4-2.9 s, 950-953      5
 *     and each kept with the next in one kept
 *       block, centred, its runs off the line   2.5-3.1 s, 765-767  2.6-3.0 s, 1,018-1,019  5
 *     one paragraph of one run, as many
 *       ampersands and every line ending the
 *       runs' bound allows                      1.0 s, 423-448      1.1 s, 571              4
 *     the table of cells, a line ending in
 *       each                                    1.9-2.2 s, 641-642  2.1-2.2 s, 849-851      8
 *     that table in that family                 2.2-2.5 s, 721-723  2.3-3.3 s, 981-985      8, 32
 *     half the paragraphs' bound of filled
 *       and outlined rectangles                 1.0 s, 473          1.1 s, 572-573          4
 *     as many framed sections                   0.9-1.0 s, 470      1.0-1.1 s, 565          4
 *     as many tables of a header alone          1.6-1.7 s, 591-592  1.7 s, 743-745          4
 *     `MAX_DOCX_PARAGRAPHS` columns blocks
 *       of one column                           1.3-1.5 s, 566-568  1.4 s, 689-690          4
 *     as many paragraphs of a letter, each
 *       kept with the next                      0.8 s, 436-437      0.8 s, 509-510          4
 *     a table of a detail row and totals to
 *       the paragraphs' bound                   1.1 s, 512-513      1.1-1.2 s, 642-643      4
 *     one paragraph of `MAX_DOCX_RUNS` runs of
 *       a letter                                0.8-0.9 s, 443-445  0.9 s, 522-523          4
 *     a page header of a third as many page
 *       fields                                  0.6 s, 346-351      0.7 s, 433-437          4
 *     `MAX_DOCX_PARAGRAPHS` pictures of one
 *       asset                                   1.4-1.5 s, 551-553  1.5-1.6 s, 701-704      4
 *     `MAX_DOCX_PICTURES` pictures of an asset
 *       each                                    0.1 s, 190-192      0.1 s, 193-194          4
 *
 * In seconds and MB, from the least to the most of that many processes
 * each way; the 32 are eight and 24 more, taken to look for the more in
 * the heaviest file. None of these processes took the more of V8's two
 * amounts, so the five heaviest were measured again with a euro sign
 * and with a string held beside each row or paragraph, eight processes
 * each. Of 24 characters: none took the more. Of 160: the table of
 * cells with a line ending in each took 1,113 to 1,115 MB in every
 * process, and that table in the longest family 1,267 to 1,268 MB in
 * every process, in 2.5 to 2.6 seconds; the table of cells without line
 * endings took 845 to 848 MB, in that family 978 to 979, and the kept
 * and centred paragraphs 1,043 to 1,044, none of them the more. Of 320,
 * six processes: the table with line endings in that family took 1,271
 * to 1,272 MB in five. That is the most that was found: 47 MB under what
 * the bounds stay under, some 26 MB of it the strings held. With
 * pretenuring turned off, the same file with 160 characters beside each
 * row took 898 to 899 MB in seven processes of eight and 998 in one. The
 * longest a file took is 3.3 seconds.
 *
 * And the pictures' bytes, which are read before any of it, four
 * processes each: the largest PNG an asset may be, 4,096 pixels a side
 * of 16-bit RGBA, 134 MB of scanlines, was inflated in 0.5 to 0.6
 * seconds, and two of them, which is all a file may hold, in 0.9 to 1.0;
 * a PNG with 20 MB after the end of its image data was refused in 0.1
 * (`assets.ts`).
 *
 * These are the shapes that were looked for, and no more is claimed.
 */

/**
 * The paragraphs a file may hold, a table's cell being one, with each
 * picture, rule, spacer, page break and column, and each rectangle and
 * frame as two (`ONE_CELL_TABLE`). Each states its own properties, some
 * 470 characters of XML a cell. It is the bound that drives what a file
 * costs, and was 100,000 until what the header says of 18 November 2026.
 * The runtime reads up to 100,000 detail rows: a report of 70,000 of
 * them in a table of one column, or of 10,000 in one of seven, is past
 * it, prints as a PDF where its host allows the pages, and is refused as
 * a Word file.
 */
export const MAX_DOCX_PARAGRAPHS = 70_000

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
 * were inside every bound as the bounds then were, and took 3.3 to 3.6
 * seconds and 1,250 MB, four processes, on the machine above, where a
 * table of as many cells of ampersands took 2.0 to 2.5 seconds and 724
 * to 993 MB.
 */
export const ONE_CELL_TABLE = 2

/**
 * The characters a file's text may hold, as UTF-16 code units, counted
 * where the paragraphs are: the bound on what is written, where the
 * paragraphs bound how often. A cell may be 16,384 of them
 * (`MAX_STRING_LENGTH`), so the paragraphs alone would let a document ask
 * for more than a billion.
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
 * PostScript name to 63 characters and its family to none. A font of 66
 * KB may name its family in 32,767 quotation marks, as many as a name
 * record holds, each six characters in an attribute: a paragraph of one
 * run states it in eight slots, its run's four and its mark's, so 350
 * paragraphs of a letter each would write 550,485,600 characters of that
 * name alone, and a string of V8's holds 536,870,888. Measured on 18
 * November 2026 on a copy of the built writer with this bound and the
 * count below taken out, three processes: a RangeError, "Invalid string
 * length", after 0.2 to 0.3 seconds and 712 to 714 MB, and no refusal.
 * A family of this length is what the bounds are measured with; what
 * escaping writes one longer is counted with `MAX_DOCX_CHARACTERS`.
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
 * bound is within it, and 200,000 until the paragraphs' bound moved.
 * What a file at it costs is in the header's table: one paragraph of
 * `MAX_DOCX_RUNS` runs of a letter each, a page header of a third as many
 * page fields, and `MAX_DOCX_PARAGRAPHS` paragraphs of two runs each
 * holding `MAX_DOCX_CHARACTERS` ampersands between them, all three bounds
 * at once. The three were first said here to take 484, 344 and 559 MB
 * at the bound of 200,000: that was the process's resident memory once
 * the file was written, read after the write and by a million bytes,
 * not at its most, which is why the last stood 175 MB under what the
 * header then gave the same file.
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
 *
 * Counted from an asset's length, before a byte of it is read
 * (`assets.ts`): counted once the picture had been read, a third asset
 * of the largest size was sniffed, walked chunk by chunk and, a PNG,
 * inflated in full, to be refused for its size. The PDF renderer holds
 * a render's pictures to no such bound.
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
 * in full, where the renderer refuses the third: eight took 3.7 seconds,
 * measured on 18 November 2026 on the machine above, four processes, on
 * a copy of the built writer with this bound taken out, pako inflating
 * as it does now. So a picture's image data is counted from its header,
 * before a PNG's is inflated, and a PNG that takes a file past the bound
 * is never inflated. One within it is inflated to what its header
 * promises and, where its data holds more, no further than the chunk
 * that passes that: 64 KiB at the most, the chunk the writer asks pako
 * for (`CHUNK` in `assets.ts`, pako 3.0.2's own default, `chunkSize:
 * 1024 * 64`), which pako fills before it hands it on. So what the
 * writer inflates of a file's pictures is this bound and a chunk at the
 * most, never this bound alone; `pictures.test.ts` holds the chunk.
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
