/**
 * The bounds a PDF is held to, and why each exists.
 *
 * A PDF is untrusted input. Every bound is checked before the work it
 * bounds: the bytes before one is parsed, a cross-reference's claim before
 * its entries are read, a token's length before it is copied, a stream's
 * output chunk by chunk as it is inflated. What passes one is refused,
 * never read in part.
 *
 * Each was measured through `readDocument`, at the bound and one past it,
 * from 6 to 8 November 2026 in Node 22.23.3 on an Apple M2 (8 cores,
 * 16 GiB) on battery, under a load average of 2 to 10 while other work
 * ran, each comment saying when where it matters: each run in a fresh
 * worker, the median time of five runs and the largest heap of them, the
 * memory outside the heap -- buffers: the reader's copy of the file, what
 * it inflates -- said beside it. The costliest legitimate files and shapes
 * were also read in Chromium (Headless Shell 156), as each says; the
 * others were not. Those that say "chosen" are not set by a measurement,
 * and say why they are what they are.
 */

const MIB = 1024 * 1024

/**
 * Bytes in a PDF, refused before a byte is parsed or copied: 20 MiB,
 * chosen to be report-spec's `MAX_ASSET_BYTES`, which a host already holds
 * an asset to. This package depends on neither report-spec nor anything
 * that does, so nothing here holds the two equal: the test that does
 * belongs to a package that depends on both, and is not written yet. A
 * file of exactly 20 MiB read in 74 ms, with 20 MiB outside the heap, the
 * reader's own copy; one byte more was refused in 0.2 ms.
 */
export const MAX_DOCUMENT_BYTES = 20 * MIB

/**
 * Objects a PDF defines, at the top level and in object streams, and what
 * a cross-reference may claim (its `/Size`, a section's count, an xref
 * stream's `/Index`) besides the free head of the list. Chosen: a
 * 1,000-page tagged report of 97,020 objects comes within 3 % of it, and
 * one shaped as the median of the tagged documents in the spike's sample
 * of 1,484 PDFs (81 structure elements a page) holds 84,022. What a
 * definition costs is held by `MAX_DOCUMENT_VALUES`. At it, 188 ms and
 * 52 MiB; one past it, refused in 93 ms. A report shaped as the sample's
 * densest tagged document (138 structure elements a page) fits it to 709
 * pages, which read in 579 ms with 93 MiB (389 ms in Chromium), one object
 * more refused in 368 ms; its 1,000 pages hold 141,022 objects, refused in
 * 362 ms. So a tagged report that dense, past about 700 pages, is refused
 * and is to be added in parts: a ruling, which a raise would have had to
 * rest on an estimate at the edge of the second a read may take.
 */
export const MAX_DOCUMENT_OBJECTS = 100_000

/**
 * Entries every cross-reference section the file holds may claim together,
 * chained or not, each section's claim held to it before a row is read: a
 * section is read and kept as the loop meets it, so without a bound across
 * them a file of sections nothing chains -- twenty cross-reference streams
 * whose rows take no byte, or tables of four-byte entries -- held hundreds of
 * mebibytes (the parse's review measured 187 MiB and 436 MiB). Twice
 * `MAX_DOCUMENT_OBJECTS` and the free head of each list, a ruling: a
 * hybrid file lists every object twice, in its table and in the stream its
 * /XRefStm names, each from object 0, so that a hybrid file of
 * `MAX_DOCUMENT_OBJECTS` objects reads, in 287 ms with 64 MiB; one entry
 * more, in a section nothing chains, was refused in 154 ms.
 */
export const MAX_DOCUMENT_XREF_ENTRIES = 2 * (MAX_DOCUMENT_OBJECTS + 1)

/**
 * Cross-reference sections a file may hold, chained or not, each counted as
 * the loop meets it, before it is read or kept: a section that claims no
 * entry still costs what it is held as, and a file of twenty megabytes of
 * `xref trailer<</Size 0>>` held 427 MiB (the parse's re-review). A file's
 * revisions each add one, a hybrid two; the spike's sample held at most
 * three. A thousand, a ruling: a file of as many read in 13 ms, one more
 * was refused in 11 ms.
 */
export const MAX_DOCUMENT_XREF_SECTIONS = 1_000

/**
 * Values the reader makes -- each number, name, array, dictionary,
 * reference and keyword, the file's and its inline images' dictionaries';
 * each dictionary key, a name that is a value, counted twice; each string
 * counted twice, for the view its bytes are held in, which costs what
 * several values do; each decoder a stage of a stream builds, as
 * `INFLATER_VALUES` or `DECODER_VALUES` -- on one count a document, which
 * is what its time and heap grow with. Set by a 1,000-page tagged report,
 * which holds 1,468,102; the spike's sample held at most 298 strings a
 * file. Measured on 731bd93, before the inline images' dictionaries and
 * the decoders were counted with the file's own values: at it, a file of
 * numbers read in 306 ms with 53 MiB, one past it refused in 286 ms; ten
 * million empty arrays (X3) refused in 456 ms within 107 MiB; one-byte
 * strings, literal, escaped or hexadecimal, in 284-382 ms within 142 MiB;
 * 2,000,000 listings of one annotation, which the pages are held to as
 * well, read in 607 ms with 138 MiB (358 ms in Chromium); 153,846 inline
 * images' dictionaries in 378 ms, a file the one count now refuses, its
 * dictionaries alone counting 1,999,998 beside the file's own values;
 * every bound at once -- the values in dictionaries shaped as a page's,
 * beside content that inflates to `MAX_DOCUMENT_INFLATED` -- in 548 ms
 * with 75 MiB (385 ms in Chromium), a file the one count still reads, at
 * 1,999,895 (each checked by a read on 11 November 2026, not timed). On
 * the build that holds the one count, the decoders' shapes, each at its
 * bound and one past it, in 486-808 ms (369-657 ms in Chromium), as
 * `INFLATER_VALUES` and `DECODER_VALUES` say.
 */
export const MAX_DOCUMENT_VALUES = 2_000_000

/**
 * What one pako inflater is counted as against `MAX_DOCUMENT_VALUES`,
 * where it is built: every Flate stage of every stream, and every inline
 * image compressed by Flate, is inflated by one of its own, which costs
 * what a stream's dictionary does several times over. Chosen by
 * measurement, the smaller of the two charges measured, 16 and 24 -- none
 * between them was -- at which each of these shapes, at the bound the
 * charge gives it, read within a second and one past it was refused within
 * a second, in Node and in Chromium: streams of one, four, five and six
 * Flate stages of one byte, and one-pixel Flate inline images. Median of
 * five cold runs, a fresh worker or browser context a run, Node 22.23.3
 * and Chrome Headless Shell 156 on an Apple M2 on battery, 6 November
 * 2026. At 16, one series of two failed: at loads of 5.5 to 12.5, four
 * stages one past their bound were refused in 1,145 ms in Node, and one
 * stage read at its bound in 1,053 ms in Chromium; the other, at loads of
 * 4.2 to 16.6 across the laptop's sleeps, held, at worst 933 ms at a bound
 * and 926 ms one past it in Node, 629 and 685 ms in Chromium. At 24, at
 * loads of 4.1 to 5.6, every row held, the dearest 632 ms in Node and
 * 588 ms in Chromium. On the build that holds it, 8 November 2026, loads
 * 2.5 to 3.0: the inline images, 48,778 at the bound, read in 486 ms and
 * one more refused in 514 ms (434 and 446 ms in Chromium); streams of one
 * stage, 64,514 at the bound, in 578 and 573 ms (461 and 460 ms); of four,
 * five and six stages, in 505-572 ms (369-417 ms). An inline image
 * unfiltered, or ending at an ASCII filter's marker, takes no inflater.
 */
export const INFLATER_VALUES = 24

/**
 * What one of pdf-lib's decoders of a fixed ratio -- RunLength, ASCIIHex,
 * ASCII85 -- is counted as against `MAX_DOCUMENT_VALUES`, where a stage of
 * a stream builds one. Chosen as `INFLATER_VALUES` is, the smallest of the
 * three charges measured, 4, 8 and 16, that held, on streams of eight
 * RunLength stages of one byte, 6 November 2026: at 4 (a load of 3.9),
 * their bound's read took 1,252 ms in Node and 1,020 ms in Chromium, the
 * refusal one past it 1,259 ms and 1,149 ms (that last at a load of 20);
 * at 8 (a load of 4.4), 815 ms and 805 ms in Node, 653 ms and 651 ms in
 * Chromium.
 * On the build that holds it, 8 November 2026, a load of 2.5 to 2.9:
 * 23,255 streams at the bound read in 808 ms, one more refused in 801 ms
 * (657 and 655 ms in Chromium).
 */
export const DECODER_VALUES = 8

/**
 * The bytes of a PDF's distinct names, decoded, together. Chosen: 78 times
 * the most a sample of 1,484 PDFs held (3,351 bytes), and it keeps a file
 * of hundreds of thousands of long distinct names, which every other bound
 * admits, from holding hundreds of megabytes of them. At it, distinct
 * 37-byte keys read in 43 ms and 29-byte keys each valued by a distinct
 * name in 155 ms, within 7 MiB; one byte past it, each was refused in
 * 59-61 ms.
 */
export const MAX_DOCUMENT_NAME_BYTES = 256 * 1024

/**
 * Pages in a PDF. Chosen: the parse's cost per page is in its values. A
 * tree of 1,000 pages read in 66 ms, one more refused in 36 ms; a
 * 1,000-page tagged report read in 619 ms with 95 MiB, and written in
 * object streams in 658 ms (432 ms and 455 ms in Chromium; 8 November
 * 2026, a load of 2.1 to 2.6).
 */
export const MAX_DOCUMENT_PAGES = 1_000

/**
 * Bytes the streams the reader decodes may decode to, every stage of every
 * stream together. Set by a 1,000-page tagged report whose object streams
 * and content inflate to 24.5 MiB. At it, 120 ms with 64 MiB outside the
 * heap; one byte past it, refused in 103 ms. A stream of nothing that
 * inflates within it is read, as a file of 20 MiB of zeros was in 97-154
 * ms, and one of a gibibyte is refused in 121 ms. Streams of one byte
 * compressed by Flate, every one reached, each written into a chunk sized
 * to its input (inflate.ts) and counted for its inflater
 * (`INFLATER_VALUES`): 64,514 at the values bound read in 578 ms with
 * 72 MiB (461 ms in Chromium), one more refused in 573 ms (460 ms).
 */
export const MAX_DOCUMENT_INFLATED = 32 * MIB

/**
 * Arrays and dictionaries nested in one object. Chosen: four times the
 * deepest of the sample (8); nesting costs nothing until the stack runs
 * out, near 10,000 arrays in pdf-lib's own grammar. At it, 4.2 ms; refused
 * past it in 2.2-2.6 ms, however deep the file goes, a million levels
 * among them.
 */
export const MAX_DOCUMENT_DEPTH = 32

/** A name's bytes as written: ISO 32000-1's Annex C limit, 127; the sample's longest was 115. At it 3.8 ms, refused past it in 2.1 ms. */
export const MAX_DOCUMENT_NAME_LENGTH = 127

/**
 * A string's bytes, escapes decoded. Chosen: twice Annex C's 32,767, room
 * for a signature's /Contents; the sample's longest was 1,566. At it
 * 6.3 ms, refused past it in 4.6 ms.
 */
export const MAX_DOCUMENT_STRING_LENGTH = 65_535

/** A number's characters. Chosen; the sample's longest was 20. At it 4.3 ms, refused past it in 2.2 ms. */
export const MAX_DOCUMENT_NUMBER_LENGTH = 32

/**
 * Pixels one image declares -- its width times its height -- which is what
 * a viewer of the report decodes it to: an image is never decoded by the
 * reader and never taken from `MAX_DOCUMENT_INFLATED`, so that a lossless
 * scan is held to its size and not to what its data inflates to. Each
 * image alone: an XObject, its masks, or one inline in a content stream.
 * Chosen, a ruling: the parser spike's value and its meaning, so that a
 * 48-megapixel photograph (8,000 by 6,000), which a site visit's uploads
 * hold, passes; the largest image of the spike's sample of 1,484 PDFs was
 * 4,665,600 pixels. Pixels, not samples: a viewer may decode an image at
 * the bound to 200,000,000 bytes of CMYK, twice that at 16 bits a sample.
 * A file of one image at it read in 4.8 ms, one a pixel past it refused in
 * 3.9 ms, neither decoded.
 */
export const MAX_DOCUMENT_IMAGE_PIXELS = 50_000_000
