import { readFileSync } from 'node:fs'
import { INVOICE, SALES_REPORT, SERVICE_INSPECTION } from '@formancy/report-corpus'
import {
  insertComponent,
  languageDiagnostics,
  openReportSession,
  removeLanguage,
  setTitle,
  translateExpression,
  translateWord,
  updateColumn,
  updateComponent,
  updatePaymentPart,
} from '@formancy/report-core'
import type { CommandDescriptor, ReportSession } from '@formancy/report-core'
import { MAX_TEXT_LENGTH, MAX_WORDS, reportHash, reportWords } from '@formancy/report-spec'
import type { ReportDefinition, Translation } from '@formancy/report-spec'
import { describe, expect, test } from 'vitest'
import { hold, proposeTranslation } from './proposal.js'
import type { Held, TranslationProposal } from './proposal.js'
import { checkTranslation } from './reader.js'
import type { TranslationAnswer } from './reader.js'
import { translationRequest } from './request.js'
import type { TranslationRequest } from './request.js'
import { checkable, numbered, withLanguage, withWords, writtenAsThemselves } from './test-support.js'

/**
 * A model's translation held to the format and the compiler before a
 * person sees it, and applied as one step against the report's hash
 * (0085): the recorded answers of `fixtures/answers/`, read against the
 * monthly sales report's request into French, proposed against that
 * report as it stands, and as a person left it while the model answered.
 */

const answerText = (name: string): string => readFileSync(new URL(`../../fixtures/answers/${name}.txt`, import.meta.url), 'utf8')

const { report, locale } = withLanguage(SALES_REPORT.report)

function requestOf(of: ReportDefinition, into: string): TranslationRequest {
  const made = translationRequest(of, into)
  if (!made.ok) throw new Error('refused')
  return made.request
}

/** `text` read as an answer to `request`, as the run reads one. */
function read(text: string, request: TranslationRequest = requestOf(report, locale)): TranslationAnswer {
  const verdict = checkTranslation(checkable(text), request)
  if (!verdict.ok) throw new Error(verdict.problem.detail)
  return verdict.value
}

const answer = (name: string): TranslationAnswer => read(answerText(name))

/** The report `outcome` gives, or what refused it. */
function edited(outcome: ReturnType<typeof setTitle>): ReportDefinition {
  if (!outcome.ok) throw new Error(outcome.message)
  return outcome.report
}

/** The batch of a proposal's rows, as a session applies it. */
const batchOf = (proposal: TranslationProposal, rows = proposal.rows): CommandDescriptor => ({ command: 'batch', args: [rows.map(({ step }) => step)] })

function sessionOn(document: ReportDefinition): ReportSession {
  const opened = openReportSession(document)
  if (!opened.ok) throw new Error('not a report')
  return opened.session
}

/** The diagnostic report-core gives of `source` written alone as `text` in the sales report's French: the sentence a refusal of it must carry. */
function diagnosticOf(source: string, text: string): string | undefined {
  const alone = edited(translateExpression(report, locale, source, { cel: text }))
  return languageDiagnostics(alone, locale).find(
    ({ severity, code, path }) => severity === 'error' && code !== 'word-missing' && path.startsWith('/translations/0/expressions/0'),
  )?.message
}

describe('a proposal of what an answer wrote', () => {
  // The whole answer is every word the language lacks, each a row a person
  // reviews and a step of one batch; the candidate is the report every row
  // leaves, which a preview renders.
  test('makes one row of each entry, a batch the candidate is the report of', () => {
    const proposal = proposeTranslation(report, answer('whole'))
    expect(proposal.rows).toHaveLength(29)
    expect([proposal.refused, proposal.dropped, proposal.stillMissing, proposal.forPerson]).toEqual([[], [], [], []])
    expect(proposal.expectedHash).toBe(reportHash(report))
    expect(proposal.rows.find(({ key }) => key === 'w17')).toMatchObject({
      kind: 'word',
      source: 'Beleg',
      text: 'Pièce',
      places: ["the header of column 'number' in table 'lines', in the body"],
      step: { command: 'translateWord', args: [locale, 'Beleg', 'Pièce'] },
    })
    expect(proposal.rows.find(({ key }) => key === 'e2')?.step).toEqual({
      command: 'translateExpression',
      args: [locale, '"Total " + group.key', { cel: '"Total " + group.key' }],
    })
    expect(languageDiagnostics(proposal.candidate, locale).filter(({ severity }) => severity === 'error')).toEqual([])
  })

  // A person who translated a word while the model answered did the work
  // the model was asked for; overwriting it would undo a person's word
  // with nobody asking (formancy.ai 0161).
  test('never overwrites a word a person translated while the model answered', () => {
    const meanwhile = edited(translateWord(report, locale, 'Beleg', 'Justificatif'))
    const proposal = proposeTranslation(meanwhile, answer('whole'))
    expect(proposal.rows.map(({ key }) => key)).not.toContain('w17')
    expect(proposal.dropped).toEqual([{ key: 'w17', why: 'written-meanwhile' }])
    expect(proposal.candidate.translations?.[0]?.words.find(({ word }) => word === 'Beleg')?.text).toBe('Justificatif')
  })

  // Under 0063 a word is its text: a header changed while the model
  // answered is another word, and the model's text for the old one would
  // land on nothing, or on a word it was never asked about.
  test('drops an entry whose source changed while the model answered', () => {
    const meanwhile = edited(updateColumn(report, 'lines', 'date', { header: 'Belegdatum' }))
    const proposal = proposeTranslation(meanwhile, answer('whole'))
    expect(proposal.dropped).toEqual([{ key: 'w18', why: 'no-longer-in-report' }])
    expect(proposal.rows.some(({ source }) => source === 'Datum')).toBe(false)
    expect(proposal.stillMissing.map(({ message }) => message.slice(0, 12))).toEqual(['"Belegdatum"'])
  })

  // A key nobody asked names no word; one a language no longer declares
  // has nowhere to land.
  test('drops the keys not asked, and every entry of a language removed meanwhile', () => {
    expect(proposeTranslation(report, answer('keys-not-asked')).dropped.map(({ key, why }) => `${key} ${why}`)).toEqual([
      'w99 not-asked',
      'e1 not-asked',
      'w3 not-asked',
      'e9 not-asked',
    ])
    const gone = proposeTranslation(edited(removeLanguage(report, locale)), answer('partial'))
    expect([gone.rows, gone.dropped.map(({ why }) => why)]).toEqual([[], ['language-removed', 'language-removed', 'language-removed', 'language-removed']])
  })

  // A partial answer lands what it wrote, and says what is still missing,
  // in report-core's sentences, for another turn or a person.
  test("keeps a partial answer's rows, and says what the candidate still lacks", () => {
    const proposal = proposeTranslation(report, answer('partial'))
    expect(proposal.rows.map(({ key }) => key)).toEqual(['w1', 'w17', 'w18', 'w19'])
    expect(proposal.stillMissing).toHaveLength(25)
    expect(proposal.stillMissing.every(({ code }) => code === 'word-missing')).toBe(true)
  })
})

describe('what a proposal refuses, entry by entry', () => {
  // An expression is code a model wrote. One that does not compile, gives
  // another type or reads another member would be a row the report then
  // refuses to print in that language (0063); each is refused with
  // report-core's own sentence, and costs its row alone.
  test.each([
    ['expression-does-not-compile', 'e1'],
    ['expression-reads-another-member', 'e2'],
    ['expression-gives-a-number', 'e2'],
  ])('refuses an expression of %s with the diagnostic it gives, and keeps the rest', (name, key) => {
    const proposal = proposeTranslation(report, answer(name))
    const entry = answer(name).written.find((each) => each.key === key)
    expect(proposal.refused).toEqual([
      {
        key,
        kind: 'expression',
        source: entry?.source,
        text: entry?.text,
        reason: 'diagnostic',
        message: diagnosticOf(entry?.source ?? '', entry?.text ?? ''),
      },
    ])
    expect(proposal.refused[0]?.message).toMatch(/fr-CH/)
    expect(proposal.rows).toHaveLength(28)
    expect(languageDiagnostics(proposal.candidate, locale).filter(({ severity, code }) => severity === 'error' && code !== 'word-missing')).toEqual([])
  })

  // The renderers refuse a character no report prints (0043); a row
  // holding one would be applied and then refused at the first render in
  // that language. The same function decides here, before the review.
  test('refuses a word holding a character no report prints, at its own entry, and keeps the rest', () => {
    const proposal = proposeTranslation(report, answer('characters-not-printed'))
    expect(proposal.refused.map(({ key, reason, message }) => [key, reason, message])).toEqual([
      ['w18', 'character', expect.stringMatching(/^it holds U\+05EA, of a script a report does not print/)],
      ['w19', 'character', expect.stringMatching(/^it holds U\+202E, a bidirectional control/)],
    ])
    expect(proposal.rows).toHaveLength(27)
  })

  // A word that stands as a column header is held to the header's bound,
  // which the validator reports at the translation's entry; validated and
  // refused whole, one long header would cost every row.
  test("refuses a word past a column header's bound with the validator's sentence, and keeps the rest", () => {
    const proposal = proposeTranslation(report, answer('header-past-its-bound'))
    expect(proposal.refused.map(({ key, reason }) => [key, reason])).toEqual([['w17', 'invalid']])
    expect(proposal.refused[0]?.message).toMatch(/^written in fr-CH, where it stands at \/regions\/body\/\d+\/columns\/0\/header, /)
    expect(proposal.rows).toHaveLength(28)
  })

  // A word a person put into the payment part's message while the model
  // answered is the person's now: written by the proposal, it would change
  // what the slip prints and its code encodes (0039, 0048).
  test('drops an entry whose word a person put into the payment part meanwhile, and lists that part for a person', () => {
    const invoice = withLanguage(INVOICE.report)
    const request = requestOf(invoice.report, invoice.locale)
    const number = request.asked.find(({ source }) => source === 'Nummer: ')
    expect(request.forPerson.map(({ source }) => source)).toEqual(['Rechnung '])
    const read = checkTranslation({ kind: 'object', value: { into: invoice.locale, words: { [number?.key ?? '']: 'Numéro : ' } } }, request)
    const meanwhile = edited(updatePaymentPart(invoice.report, { message: [{ kind: 'text', text: 'Nummer: ' }] }))
    const proposal = proposeTranslation(meanwhile, read.ok ? read.value : (undefined as never))
    expect(proposal.dropped).toEqual([{ key: number?.key, why: 'for-person' }])
    expect(proposal.forPerson.map(({ source }) => source)).toEqual(['Nummer: '])
    expect(
      reportWords(meanwhile)
        .filter(({ path }) => path.startsWith('/paymentPart/'))
        .map(({ text }) => text),
    ).toEqual(['Nummer: '])
  })
})

describe('applying a proposal', () => {
  // One undo step, validated once at its end (0008, 0048), so that a
  // person's Undo takes back the whole review and not one word of it.
  test('applies its rows as one step against its hash', () => {
    const session = sessionOn(report)
    const proposal = proposeTranslation(session.document(), answer('whole'))
    const applied = session.apply(batchOf(proposal), { expectedHash: proposal.expectedHash, label: 'Translate into French' })
    expect(applied.ok).toBe(true)
    expect(reportHash(session.document())).toBe(reportHash(proposal.candidate))
    expect(session.undoLabel()).toBe('Translate into French')
    expect(session.undo()).toBe(true)
    expect(session.document()).toEqual(report)
    expect(session.canUndo()).toBe(false)
  })

  // A subset of a valid batch is valid: taking a row out leaves its word
  // missing, which a report may be, so a person may accept some rows.
  test('applies any subset of its rows', () => {
    const session = sessionOn(report)
    const proposal = proposeTranslation(session.document(), answer('whole'))
    const some = proposal.rows.filter((_, index) => index % 3 === 0)
    expect(session.apply(batchOf(proposal, some), { expectedHash: proposal.expectedHash }).ok).toBe(true)
    expect(languageDiagnostics(session.document(), locale).filter(({ code }) => code === 'word-missing')).toHaveLength(proposal.rows.length - some.length)
  })

  // A proposal is made against one version of the report; applied over a
  // person's later edit it could write over it, so the session refuses it
  // by its own rule and changes nothing. Read again on the report as it
  // stands, the held answer is a proposal again, with no new turn.
  test('is refused stale once the report moved, and read again on the report as it stands', () => {
    const session = sessionOn(report)
    const held = answer('whole')
    const proposal = proposeTranslation(session.document(), held)
    expect(session.apply({ command: 'translateWord', args: [locale, 'Beleg', 'Justificatif'] }).ok).toBe(true)
    const before = session.document()
    const stale = session.apply(batchOf(proposal), { expectedHash: proposal.expectedHash })
    expect(stale).toMatchObject({ ok: false, code: 'stale-document' })
    expect(session.document()).toBe(before)
    const again = proposeTranslation(session.document(), held)
    expect(again.dropped).toEqual([{ key: 'w17', why: 'written-meanwhile' }])
    expect(session.apply(batchOf(again), { expectedHash: again.expectedHash }).ok).toBe(true)
    expect(session.document().translations?.[0]?.words.find(({ word }) => word === 'Beleg')?.text).toBe('Justificatif')
  })

  // The title is the report's own word, and a person's later edit of it
  // is the move a stale proposal must not cross.
  test('is refused stale after any edit of the report, not only of its words', () => {
    const session = sessionOn(report)
    const proposal = proposeTranslation(session.document(), answer('partial'))
    expect(session.apply({ command: 'setTitle', args: ['Umsatzbericht Oktober'] }).ok).toBe(true)
    expect(session.apply(batchOf(proposal), { expectedHash: proposal.expectedHash })).toMatchObject({ ok: false, code: 'stale-document' })
  })
})

describe('what a proposal holds a text to besides the format', () => {
  // A run's text prints between the runs beside it: " bis " written "au"
  // prints "1. Oktoberau31. Oktober", which no reviewer sees in a row of
  // its own. The format holds no space, so the proposal does.
  test("refuses a word that does not keep its source's spaces at either end, at its own entry, and keeps the rest", () => {
    const proposal = proposeTranslation(report, answer('spaces-not-kept'))
    expect(proposal.refused.map(({ key, reason, message }) => [key, reason, message])).toEqual([
      [
        'w4',
        'spaces',
        `it begins with "" and ends with "", where its source begins with " " and ends with " ": a word's spaces at either end part it from the words beside it`,
      ],
      [
        'w5',
        'spaces',
        `it begins with "" and ends with "", where its source begins with "" and ends with " ": a word's spaces at either end part it from the words beside it`,
      ],
    ])
    expect(proposal.rows).toHaveLength(27)
  })

  // CEL decodes a string literal's escapes, so an expression of plain
  // ASCII can print a control the renderers refuse at the first render in
  // that language: held as the characters a word is.
  test('refuses an expression whose escape writes a character no report prints, and keeps the rest', () => {
    const proposal = proposeTranslation(report, answer('expression-escapes-a-control'))
    expect(proposal.refused.map(({ key, reason, message }) => [key, reason, message])).toEqual([
      ['e2', 'character', expect.stringMatching(/^it writes U\+202E by an escape, a bidirectional control/)],
    ])
    expect(proposal.rows).toHaveLength(28)
  })

  // A text past the format's bound on a run is the validator's to refuse,
  // and it stands at that entry alone.
  test("refuses a text past MAX_TEXT_LENGTH at its own entry with the validator's sentence, and keeps the rest", () => {
    const request = requestOf(report, locale)
    const long = checkTranslation(
      { kind: 'object', value: { into: locale, words: { w1: 'Rapport des ventes', w27: `Montants ${'a'.repeat(MAX_TEXT_LENGTH)}` } } },
      request,
    )
    const proposal = proposeTranslation(report, long.ok ? long.value : (undefined as never))
    expect(proposal.refused.map(({ key, reason }) => [key, reason])).toEqual([['w27', 'invalid']])
    expect(proposal.refused[0]?.message).toBe(`is ${String(MAX_TEXT_LENGTH + 9)} characters long; at most ${String(MAX_TEXT_LENGTH)} are allowed`)
    expect(proposal.rows.map(({ key }) => key)).toEqual(['w1'])
  })

  // A person who changed what an expression prints while the model
  // answered -- a number format on it -- made it no word, and saying it was
  // written meanwhile would send a reviewer to look for a translation that
  // is not there.
  test('drops an expression that no longer prints words as one, not as one written meanwhile', () => {
    const cel = "'Gesamt'"
    const inserted = edited(
      insertComponent(report, { region: 'body', index: 0 }, { id: 'say', kind: 'text', content: [{ kind: 'expression', expression: { cel } }] }),
    )
    const request = requestOf(inserted, locale)
    const key = request.asked.find(({ source }) => source === cel)?.key ?? ''
    const read = checkTranslation({ kind: 'object', value: { into: locale, expressions: { [key]: "'Total'" } } }, request)
    const asNumber = [{ kind: 'expression' as const, expression: { cel }, format: { kind: 'number' as const, scale: 2, grouping: true } }]
    const meanwhile = edited(updateComponent(inserted, 'say', 'text', { content: asNumber }))
    const proposal = proposeTranslation(meanwhile, read.ok ? read.value : (undefined as never))
    expect([proposal.rows, proposal.dropped]).toEqual([[], [{ key, why: 'prints-no-words' }]])
  })
})

describe('what a proposal holds to the room its language has', () => {
  // A translation past MAX_WORDS is refused by the format at the list,
  // which no entry stands at, so every row would go. The turn was sized to
  // the room when it was asked; a person who writes a word while the model
  // answers takes some of it, and what no longer fits is dropped at its own
  // entry, by the rule the turn was sized by.
  test('drops what the language has no room left for as it stands, at its own entries, and keeps what fits', () => {
    const base = withLanguage(SERVICE_INSPECTION.report)
    const words = numbered(MAX_WORDS + 10)
    const asked = writtenAsThemselves(withWords(base.report, words), base.locale, words.slice(0, MAX_WORDS - 4))
    const request = requestOf(asked, base.locale)
    expect([request.asked.length, request.noRoom]).toEqual([4, ['word']])
    const read = checkTranslation(
      { kind: 'object', value: { into: base.locale, words: Object.fromEntries(request.asked.map(({ key, source }) => [key, source])) } },
      request,
    )
    const askedFor = new Set(request.asked.map(({ source }) => source))
    const other = words.slice(MAX_WORDS - 4).find((word) => !askedFor.has(word)) as string
    const meanwhile = writtenAsThemselves(asked, base.locale, [other])
    const proposal = proposeTranslation(meanwhile, read.ok ? read.value : (undefined as never))
    expect(proposal.rows.map(({ key }) => key)).toEqual(request.asked.slice(0, 3).map(({ key }) => key))
    expect([proposal.dropped, proposal.refused]).toEqual([[{ key: request.asked[3]?.key, why: 'no-room' }], []])
  })

  // The guard under every rule above: a finding that stands at no entry
  // left -- here a step its command refuses, which stands at none --
  // refuses every entry left with its sentence, since none of them can be
  // shown to leave a report the format and the compiler accept.
  test('refuses every entry left where a finding stands at none of them', () => {
    const translation = report.translations?.[0] as Translation
    const entry = (key: string, source: string, text: string): Held['entry'] => ({ key, kind: 'word', source, text, places: [] })
    const held: Held[] = [
      {
        entry: entry('w1', 'Umsatzbericht', 'Rapport des ventes'),
        paths: ['/title'],
        step: { command: 'translateWord', args: [locale, 'Umsatzbericht', 'Rapport des ventes'] },
      },
      { entry: entry('w2', 'Kein Wort', 'Aucun mot'), paths: [], step: { command: 'translateWord', args: [locale, 'Kein Wort', 'Aucun mot'] } },
    ]
    const outcome = hold(report, { locale, index: 0, translation }, held)
    expect(outcome.standing).toEqual([])
    expect(outcome.refused.map(({ key, reason, message }) => [key, reason, message])).toEqual([
      ['w1', 'invalid', 'the report prints no word "Kein Wort" to translate'],
      ['w2', 'invalid', 'the report prints no word "Kein Wort" to translate'],
    ])
    expect(outcome.candidate).toBe(report)
  })
})
