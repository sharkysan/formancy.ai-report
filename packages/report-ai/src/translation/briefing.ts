import { DECLINE_KEY } from '@formancy/spec'

/**
 * What a model is told when it is asked for the words a report's language
 * lacks, and what it is told was wrong with an answer
 * ([0085](../../../../docs/decisions/0085-a-model-is-asked-only-for-the-words-a-language-lacks-and-its-answer-is-one-batch-held-to-the-format-and-the-compiler-before-a-person-sees-it.md)).
 *
 * Model-facing English, as formancy's translation briefing is
 * (formancy.ai 0161), and for the same reason: the answer is read against
 * this wording, and what was wrong with it is told the model in it. The
 * request (`request.ts`) and the reader (`reader.ts`) say nothing in
 * words of their own; a person is told what happened in a builder's
 * catalogue, never in these sentences.
 *
 * The briefing is the same for every report and every language, so that
 * a host's server can hold it by its kind and pin it by its digest
 * (`kinds.ts`'s `briefingDigest`), and `briefing.test.ts` pins its text
 * beside that digest.
 */

/** The answer's example, built rather than typed, so that the shape a model copies is the shape `reader.ts` reads. */
export const EXAMPLE_ANSWER = {
  into: 'fr-CH',
  words: { w1: 'Facture', w2: '' },
  expressions: { e1: "header.paid ? 'Payée' : 'Ouverte'" },
} as const

/** The decline's example, by `@formancy/spec`'s key, as formancy's briefings build theirs. */
export const EXAMPLE_DECLINE = { [DECLINE_KEY]: '<why, for the person who asked>' } as const

/** The briefing a translation is asked under: what the request holds, the rules, and the one shape to answer in. */
export function translationBriefing(): string {
  return [
    'You translate the words of a report for a report designer, which checks your answer and shows it to a person before anything is used.',
    '',
    'You are given a request: JSON with "from", the language the report is written in; "into", the language to write; "words", each with "key", "source" and "places"; "expressions", each with "key", "source", "gives", "reads" and "places"; and "translated", what this report already says in that language, each "source" beside its "text". Nobody has written any word or expression listed in that language yet. "places" says where each stands in the report; "otherPlaces", where present, how many more places it stands in.',
    '',
    'Rules:',
    '- Keep every "key" exactly as given, and write only the text for it. Never write a source in place of a key.',
    '- A word: write what its "source" says, in that language, for the places it stands in: a column header stays a header, a sentence a sentence. Add nothing and leave nothing out. Keep its spaces at either end, its line breaks, and any number or sign in it as written.',
    '- An expression is a CEL expression that prints words. Translate only the text between its quotes, and keep everything else exactly as written: every member it reads, every operator, number and function, and each quote of the kind it is written with. It must still give what "gives" names and read exactly what "reads" lists.',
    '- Match the register of "translated", when it holds anything.',
    '- When you are unsure of a word or an expression, give it "". An empty text writes nothing: it leaves the word for a person.',
    `- Answer with one JSON object and nothing else, no commentary and no code fence: "into" as given, "words" from each word's key to its text, and "expressions" from each expression's key to its translated source. For example: ${JSON.stringify(EXAMPLE_ANSWER)}`,
    `- If you cannot translate into that language at all, answer ${JSON.stringify(EXAMPLE_DECLINE)} instead.`,
  ].join('\n')
}

/** What was wrong with an answer, by kind. */
export type TranslationProblemKind = 'not-json' | 'no-locale' | 'wrong-locale' | 'not-strings' | 'unexplained-decline'

/**
 * What was wrong with an answer, as the model is told it. Every one is
 * worded from the request alone -- the language asked, a member's name --
 * and never quotes what the model wrote: a complaint that quoted it would
 * grow with the answer, and a turn's request is bounded
 * (`MAX_MODEL_REQUEST_BYTES`) before the first is asked.
 */
export const TRANSLATION_COMPLAINTS = {
  notJson: 'That was not a JSON object. Answer with the object alone: no commentary, no code fence.',
  noLocale: (into: string): string =>
    `That object does not say which language it is written in. Answer with "into": ${JSON.stringify(into)}, "words" and "expressions".`,
  wrongLocale: (into: string): string =>
    `That answer is written for another language than this request's. Answer with "into": ${JSON.stringify(into)}, every text written in that language.`,
  notStrings: (member: 'words' | 'expressions'): string =>
    `"${member}" is not an object of strings. Answer with "${member}" as an object from each key you were given to its text, every text a string.`,
  unexplainedDecline: `A decline needs a reason, written for the person who asked. If you cannot translate into this language, answer ${JSON.stringify(EXAMPLE_DECLINE)}; if you can, answer with the object.`,
} as const

/** What was wrong with an answer, and what the model is told of it. */
export interface TranslationProblem {
  readonly kind: TranslationProblemKind
  readonly detail: string
}

/** Every problem an answer to a request into `into` can have, each with what the model is told: the closed set a turn's request is measured with. */
export function translationProblems(into: string): readonly TranslationProblem[] {
  return [
    { kind: 'not-json', detail: TRANSLATION_COMPLAINTS.notJson },
    { kind: 'no-locale', detail: TRANSLATION_COMPLAINTS.noLocale(into) },
    { kind: 'wrong-locale', detail: TRANSLATION_COMPLAINTS.wrongLocale(into) },
    { kind: 'not-strings', detail: TRANSLATION_COMPLAINTS.notStrings('words') },
    { kind: 'not-strings', detail: TRANSLATION_COMPLAINTS.notStrings('expressions') },
    { kind: 'unexplained-decline', detail: TRANSLATION_COMPLAINTS.unexplainedDecline },
  ]
}

/** The complaint about `problem`, as the follow-up says it alone and a turn's user part says it after the request. */
export function translationComplaint(problem: TranslationProblem): string {
  return `Your previous answer was rejected. Fix exactly this and answer again:\n${problem.detail}`
}

/**
 * What one turn sends besides the briefing: the request, and from the
 * second turn the complaint about the last answer after it, for a host
 * that keeps no conversation, and alone as the follow-up, for one that
 * does (formancy.ai 0056). The run builds every turn with this, and the
 * request is measured with it.
 */
export function translationTurn(user: string, latest: TranslationProblem | undefined): { readonly user: string; readonly followUp?: string } {
  if (latest === undefined) return { user }
  const complaint = translationComplaint(latest)
  return { user: `${user}\n\n${complaint}`, followUp: complaint }
}
