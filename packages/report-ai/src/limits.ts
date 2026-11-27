import { utf8ToBytes } from '@noble/hashes/utils.js'

/**
 * The most bytes one turn's user part may have: the UTF-8 of the request,
 * and from the second turn the complaint after it. One constant, read by
 * the request builder, which refuses a request whose longest turn is past
 * it before anything is asked, and by `askThrough`, which refuses such a
 * prompt before a host's `complete` is called, so that a host's server can
 * bound a request's body by the same number
 * ([0085](../../../docs/decisions/0085-a-model-is-asked-only-for-the-words-a-language-lacks-and-its-answer-is-one-batch-held-to-the-format-and-the-compiler-before-a-person-sees-it.md)).
 *
 * 256 KiB, the least power of two that holds a turn of
 * `MAX_BATCH_COMMANDS` entries at the most bytes an entry costs in any
 * request the corpus makes: the grouped equipment list's, 3,031 bytes for
 * 14 entries, 216.5 an entry with the request's own members and the
 * longest complaint shared among them. Sixteen times the largest request
 * the corpus makes, the XRechnung sample's, 6,917 bytes for 36 entries, is
 * less. Each measured on 2026-11-27 on an Intel i9-10900K under Windows 11
 * and Node 24.21.0, of every report `report-size.test.ts` holds, each with
 * a language it does not declare added and nothing written in it, as
 * `requestBytes` counts the longest turn of its request. So a turn of
 * entries like the corpus's is bounded by its count, not by its bytes,
 * and a request is refused here only where its words are long: the format
 * lets a word be `MAX_TEXT_LENGTH` characters, and a turn of such words
 * would be past any bound a body is read under. It is the bound a draft's
 * body is held to, `MAX_REPORT_BYTES`, too. `translation/bounds.test.ts`
 * holds it to both measures.
 */
export const MAX_MODEL_REQUEST_BYTES = 262_144

/** The UTF-8 length of `text`: what `MAX_MODEL_REQUEST_BYTES` counts, and what a server counts of a body before it parses it. */
export function requestBytes(text: string): number {
  return utf8ToBytes(text).byteLength
}
