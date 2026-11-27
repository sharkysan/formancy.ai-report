/**
 * The requests Formancy Report makes of a model, by name: none yet.
 *
 * The turn in `turn/` is generic over a kind and knows none of these
 * ([0083](../../../docs/decisions/0083-the-models-turn-is-held-in-report-ai-in-formancys-shapes-until-formancy-releases-one-other-products-may-brief.md));
 * this list is what makes it Report's. A kind arrives with its briefing and
 * the reader of its answer, in the change that asks for it, so that what a
 * model is asked, how it is briefed and what is held to the format before a
 * person sees it are decided together. While the list is empty, nothing
 * published asks a model to propose anything, which the start page says and
 * `apps/pages/src/limits.test.ts` holds by this list's built value.
 */
export const REQUEST_KINDS = [] as const satisfies readonly string[]

/** A request Report makes of a model, one of `REQUEST_KINDS`: none, while the list is empty. */
export type RequestKind = (typeof REQUEST_KINDS)[number]
