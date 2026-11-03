/**
 * The bounds a PDF is held to, and why each exists.
 *
 * A PDF is untrusted input. Every bound is checked before the work it
 * bounds: the bytes before one is parsed, a cross-reference's claim before
 * its entries are read, a token's length before it is copied, a stream's
 * output chunk by chunk as it is inflated. What passes one is refused,
 * never read in part.
 *
 * Each value is the one the parser spike proposed, measured at the bound
 * and one past it on 3 November 2026 in Node 22.23.3 on an Apple M2 (8
 * cores, 16 GiB) under a load of 6 to 30, five runs each, the median time
 * and the largest heap, against the strict loop this package's `parse.ts`
 * writes again; none was measured in a browser. Those that say "chosen"
 * are not set by a measurement, and say why they are what they are.
 */

const MIB = 1024 * 1024

/**
 * Bytes in a PDF, refused before a byte is parsed: 20 MiB, chosen to be
 * report-spec's `MAX_ASSET_BYTES`, which a host already holds an asset to.
 * A file of 20 MiB was read in 73 ms; one byte more refused in 0.4 ms.
 */
export const MAX_DOCUMENT_BYTES = 20 * MIB

/**
 * Objects a PDF defines, at the top level and in object streams, and what
 * a cross-reference may claim (its `/Size`, a section's count, an xref
 * stream's `/Index`) besides the free head of the list. Chosen: a
 * 1,000-page tagged report of 97,020 objects comes within 3 % of it; what a
 * definition costs is held by `MAX_DOCUMENT_VALUES`. At it, 238 ms and
 * 42 MiB; one past it refused in 124 ms.
 */
export const MAX_DOCUMENT_OBJECTS = 100_000

/**
 * Values the parse makes -- each number, string, name, array, dictionary,
 * reference and keyword, and each dictionary key, a name that is a value
 * counted twice -- which is what its time and heap grow with. Set by a
 * 1,000-page tagged report, which holds 1,468,102; at the bound a file of
 * small values read in 618 ms with 115 MiB; past it, files of nothing but
 * numbers, arrays, strings, references or names are refused in 195-607 ms
 * within 42-173 MiB, where without it one of empty arrays filled a 512 MiB
 * heap.
 */
export const MAX_DOCUMENT_VALUES = 2_000_000

/**
 * The bytes of a PDF's distinct names, decoded, together. Chosen: 78 times
 * the most a sample of 1,484 PDFs held (3,351 bytes), and it keeps a file
 * of hundreds of thousands of long distinct names, which every other bound
 * admits, from holding hundreds of megabytes of them: refused at it in
 * 20-24 ms within 8 MiB.
 */
export const MAX_DOCUMENT_NAME_BYTES = 256 * 1024

/**
 * Pages in a PDF. Chosen: the parse's cost per page is in its values; a
 * tree of 1,000 pages was walked in 20 ms.
 */
export const MAX_DOCUMENT_PAGES = 1_000

/**
 * Bytes the streams the reader decodes may decode to, every stage of every
 * stream together. Set by a 1,000-page tagged report whose object streams
 * and content inflate to 24.5 MiB; at the bound, 78 ms with 32 MiB outside
 * the heap, one byte past it refused in 84 ms. A stream of nothing that
 * inflates within it is read, as a file of 20 MiB of zeros was in 45-103
 * ms.
 */
export const MAX_DOCUMENT_INFLATED = 32 * MIB

/**
 * Arrays and dictionaries nested in one object. Chosen: four times the
 * deepest of the sample (8); nesting costs nothing until the stack runs
 * out, near 10,000 arrays in pdf-lib's own grammar. Refused past it in
 * 1.5 ms however deep the file goes.
 */
export const MAX_DOCUMENT_DEPTH = 32

/** A name's bytes as written: ISO 32000-1's Annex C limit, 127; the sample's longest was 115. */
export const MAX_DOCUMENT_NAME_LENGTH = 127

/** A string's bytes, escapes decoded. Chosen: twice Annex C's 32,767, room for a signature's /Contents; the sample's longest was 1,566. */
export const MAX_DOCUMENT_STRING_LENGTH = 65_535

/** A number's characters. Chosen; the sample's longest was 20. */
export const MAX_DOCUMENT_NUMBER_LENGTH = 32
