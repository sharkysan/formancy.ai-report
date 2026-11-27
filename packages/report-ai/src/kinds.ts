import { assetDigest } from '@formancy/report-spec'
import { utf8ToBytes } from '@noble/hashes/utils.js'
import { translationBriefing } from './translation/briefing.js'

/**
 * The requests Formancy Report makes of a model, by name, and the briefing
 * each is asked under.
 *
 * The turn in `turn/` is generic over a kind and knows none of these
 * ([0083](../../../docs/decisions/0083-the-models-turn-is-held-in-report-ai-in-formancys-shapes-until-formancy-releases-one-other-products-may-brief.md));
 * this list is what makes it Report's. A kind arrives with its briefing and
 * the reader of its answer, in the change that asks for it, so that what a
 * model is asked, how it is briefed and what is held to the format before a
 * person sees it are decided together. `translation` is a language's
 * missing words
 * ([0085](../../../docs/decisions/0085-a-model-is-asked-only-for-the-words-a-language-lacks-and-its-answer-is-one-batch-held-to-the-format-and-the-compiler-before-a-person-sees-it.md)),
 * and nothing else is asked: no change described in words, which the start
 * page says and `apps/pages/src/limits.test.ts` holds by this list's built
 * value.
 *
 * **For a host whose server asks the model**, with the key kept there: the
 * server answers Report's requests and is not a way to ask the operator's
 * paid model anything at all, so it takes a request's kind and its user
 * part from the page, and writes the system part itself, from this table,
 * by the kind (formancy.ai 0165). One table read by both ends, so the
 * briefing a server holds cannot drift from the one the run sends without
 * `briefingDigest` saying so.
 */
export const REQUEST_KINDS = ['translation'] as const satisfies readonly string[]

/** A request Report makes of a model, one of `REQUEST_KINDS`. */
export type RequestKind = (typeof REQUEST_KINDS)[number]

const BRIEFINGS: { readonly [K in RequestKind]: () => string } = {
  translation: translationBriefing,
}

/**
 * Whether a value read from a request names one of Report's kinds: by the
 * list rather than by a lookup in the table, which would also find
 * `constructor` and `__proto__` on any object.
 */
export function isRequestKind(value: unknown): value is RequestKind {
  return (REQUEST_KINDS as readonly unknown[]).includes(value)
}

/** The system part a request of `kind` is asked with. */
export function modelBriefing(kind: RequestKind): string {
  return BRIEFINGS[kind]()
}

/**
 * The SHA-256 of the UTF-8 of `kind`'s briefing, written as report-spec
 * writes every digest, `sha256:` and 64 lower-case hex digits: what a page
 * sends beside a request and a server compares with its own, so that a page
 * and a server built from different versions refuse rather than brief a
 * model one way and read its answer another (formancy's SAFETY-ANALYSIS
 * D17, which its 0165 left open).
 */
export function briefingDigest(kind: RequestKind): string {
  return assetDigest(utf8ToBytes(modelBriefing(kind)))
}
