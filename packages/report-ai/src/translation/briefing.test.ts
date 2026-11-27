import { createHash } from 'node:crypto'
import { describe, expect, test } from 'vitest'
import { briefingDigest, isRequestKind, modelBriefing, REQUEST_KINDS } from '../kinds.js'
import { readAnswer } from '../turn/ask.js'
import { translationBriefing } from './briefing.js'
import { checkTranslation } from './reader.js'
import type { TranslationRequest } from './request.js'
import { checkable } from './test-support.js'

/**
 * The briefing a translation is asked under (0085), pinned beside its
 * digest: a change to what a model is told changes two lines a reviewer
 * reads, and the digest a host's server compares changes with it.
 */
const BRIEFING = [
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
  '- Answer with one JSON object and nothing else, no commentary and no code fence: "into" as given, "words" from each word\'s key to its text, and "expressions" from each expression\'s key to its translated source. For example: {"into":"fr-CH","words":{"w1":"Facture","w2":""},"expressions":{"e1":"header.paid ? \'Payée\' : \'Ouverte\'"}}',
  '- If you cannot translate into that language at all, answer {"declined":"<why, for the person who asked>"} instead.',
].join('\n')

const DIGEST = 'sha256:583998aca6eebe8b5c359fc19cd557a5e2551e3c4b035ddaf5abff456dc7d714'

/** A request asking what the briefing's example answers, into French: two words and an expression. */
const EXAMPLE_REQUEST: TranslationRequest = {
  from: 'de-CH',
  locale: 'fr-CH',
  asked: [
    { key: 'w1', kind: 'word', source: 'Rechnung', places: ["the report's title, which the PDF's properties show"], otherPlaces: 0 },
    { key: 'w2', kind: 'word', source: 'Datum', places: ["the header of column 'date' in table 'lines', in the body"], otherPlaces: 0 },
    {
      key: 'e1',
      kind: 'expression',
      source: "header.paid ? 'Bezahlt' : 'Offen'",
      places: ["a run of text in paragraph 'status', in the body"],
      otherPlaces: 0,
    },
  ],
  later: 0,
  forPerson: [],
  system: translationBriefing(),
  user: '{}',
  bytes: 2,
}

describe('the briefing a translation is asked under', () => {
  // A briefing reworded without a reviewer seeing it would brief a model
  // otherwise than the reader reads its answer.
  test('is the text pinned here', () => {
    expect(translationBriefing()).toBe(BRIEFING)
  })

  // A host's server compares the digest a page sends with its own; one
  // computed otherwise than as the SHA-256 of the briefing's UTF-8 would
  // be refused by a server that computed it the plain way.
  test("is pinned by the SHA-256 of its UTF-8, beside its text, and Report's table gives it for its kind", () => {
    expect(briefingDigest('translation')).toBe(`sha256:${createHash('sha256').update(BRIEFING, 'utf8').digest('hex')}`)
    expect(briefingDigest('translation')).toBe(DIGEST)
    expect(modelBriefing('translation')).toBe(BRIEFING)
  })

  // The example a model copies is the shape the answer is read in: an
  // example the reader refused would brief every model into a wrong
  // answer (formancy.ai 0158's "shows how to decline").
  test('shows an answer and a decline the reader reads as one', () => {
    const example =
      BRIEFING.split('\n')
        .find((line) => line.includes('For example: '))
        ?.split('For example: ')[1] ?? ''
    const read = checkTranslation(checkable(example), EXAMPLE_REQUEST)
    expect(read.ok && read.value.written.map(({ key, text }) => [key, text])).toEqual([
      ['w1', 'Facture'],
      ['e1', "header.paid ? 'Payée' : 'Ouverte'"],
    ])
    expect(read.ok && read.value.leftEmpty).toEqual(['w2'])
    const decline = /answer (\{.*\}) instead\.$/.exec(BRIEFING.split('\n').at(-1) ?? '')?.[1] ?? ''
    expect(readAnswer(decline)).toEqual({ kind: 'declined', reason: '<why, for the person who asked>' })
  })
})

describe('the requests Report makes of a model', () => {
  // A kind is read from a request by a server; one looked up in the table
  // by name would find `constructor` on every object.
  test('are the translation alone, read by the list', () => {
    expect(REQUEST_KINDS).toEqual(['translation'])
    expect(['translation', 'constructor', '__proto__', 'edit', undefined].map(isRequestKind)).toEqual([true, false, false, false, false])
  })
})
