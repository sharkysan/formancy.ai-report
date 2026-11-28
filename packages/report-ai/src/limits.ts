import { utf8ToBytes } from '@noble/hashes/utils.js'
import type { ModelRequest } from './ask-through.js'

/**
 * The most bytes one turn's body may have, as `askThrough` hands it to a
 * host's `complete`: the UTF-8 of `{ kind, user, briefing }` as JSON
 * (`requestBytes`), its user part the request and, from the second turn,
 * the complaint after it. A host that sends that object as JSON, as it is,
 * sends a body no longer than this, so a host's server can read a request's
 * body under this one number; a host that wraps it or adds to it bounds its
 * body by what it adds. Read by the request builder, which refuses a
 * request whose longest turn is past it before anything is asked, and by
 * `askThrough`, which refuses such a body before `complete` is called
 * ([0085](../../../docs/decisions/0085-a-model-is-asked-only-for-the-words-a-language-lacks-and-its-answer-is-one-batch-held-to-the-format-and-the-compiler-before-a-person-sees-it.md)).
 *
 * 256 KiB, the least power of two that holds a turn of
 * `MAX_BATCH_COMMANDS` entries at the most bytes an entry adds to any
 * request the corpus makes: the payment reminder's, 216.1 an entry, its
 * body 5,473 bytes for 23 entries and 503 for none. The bytes a body has
 * with no entry -- its own members, the digest and the longest complaint
 * -- are left out of each entry's, so that a starter with few words does
 * not count them many times. Sixteen times the largest body the corpus
 * makes, the XRechnung sample's, 7,746 bytes for 36 entries, is less. Each
 * measured on 2026-11-28 on an Intel i9-10900K under Windows 11 and Node
 * 24.21.0, of every report `report-size.test.ts` holds, each with a
 * language it does not declare added and nothing written in it, as
 * `longestBody` counts its request. So a turn of entries like the corpus's
 * is bounded by its count, not by its bytes, and a request is refused here
 * where its words are long or their places are: the format lets a word be
 * `MAX_TEXT_LENGTH` characters, and an id 64, which three places of a word
 * quote. It is the bound a draft's body is held to, `MAX_REPORT_BYTES`,
 * too. `translation/bounds.test.ts` holds it to both measures.
 */
export const MAX_MODEL_REQUEST_BYTES = 262_144

/** The UTF-8 length of `request` as JSON, its members in their order: the body `MAX_MODEL_REQUEST_BYTES` bounds. */
export function requestBytes({ kind, user, briefing }: ModelRequest): number {
  return utf8ToBytes(JSON.stringify({ kind, user, briefing })).byteLength
}
