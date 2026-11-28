import { readFileSync } from 'node:fs'
import { SALES_REPORT } from '@formancy/report-corpus'
import { describe, expect, test } from 'vitest'
import { createStop } from '../turn/ask.js'
import type { AskModel, ModelPrompt } from '../turn/ask.js'
import { TRANSLATION_COMPLAINTS, translationBriefing, translationComplaint } from './briefing.js'
import { translateMissing } from './reader.js'
import { translationRequest } from './request.js'
import { allWritten, withLanguage } from './test-support.js'

/**
 * The reader of a translation's answer (0085), over the answers recorded
 * in `fixtures/answers/` in the shapes models write them: in a fence after
 * a sentence, between other text, for another language, with members that
 * are no object of strings, declined, partial, with keys nobody asked for
 * and texts left blank. Each was written against the monthly sales
 * report's request into French with nothing written, whose keys the first
 * case holds; a scripted host answers them turn by turn, as formancy's
 * suites script theirs, and no model is asked.
 */

/** A recorded answer, as a host's model handed it over. */
const answer = (name: string): string => readFileSync(new URL(`../../fixtures/answers/${name}.txt`, import.meta.url), 'utf8')

const { report, locale } = withLanguage(SALES_REPORT.report)

const made = translationRequest(report, locale)
const request = made.ok ? made.request : (undefined as never)

/** A host that answers with each recorded answer in turn, keeping every prompt it was asked. */
function scripted(...names: readonly string[]): { readonly ask: AskModel<'translation'>; readonly prompts: ModelPrompt<'translation'>[] } {
  const prompts: ModelPrompt<'translation'>[] = []
  const ask: AskModel<'translation'> = (prompt) => {
    prompts.push(prompt)
    return Promise.resolve(answer(names[prompts.length - 1] ?? 'prose'))
  }
  return { ask, prompts }
}

describe('the request the recorded answers answer', () => {
  // Every recorded answer names keys of this request: a request keyed
  // otherwise would have each answer read back to other words, and every
  // case below hold something it was not written for.
  test("is the sales report's into French, keyed as the answers were written", () => {
    expect(locale).toBe('fr-CH')
    const keyed = new Map(request.asked.map(({ key, source }) => [key, source]))
    expect([keyed.get('w1'), keyed.get('w17'), keyed.get('w18'), keyed.get('w19'), keyed.get('w27')?.slice(0, 7), keyed.get('e2')]).toEqual([
      'Umsatzbericht',
      'Beleg',
      'Datum',
      'Region',
      'Beträge',
      '"Total " + group.key',
    ])
    expect(request.asked).toHaveLength(29)
  })
})

describe('reading an answer', () => {
  // Models put the object in a fence after a sentence however firmly they
  // are told not to; refusing those would spend a turn on formatting.
  test.each(['fenced-after-sentence', 'between-other-text', 'whole'])('reads every text of an answer %s, each by the source the request held', async (name) => {
    const { ask, prompts } = scripted(name)
    const run = await translateMissing(ask, report, locale)
    expect(run.ok && run.attempts).toBe(1)
    const written = run.ok ? run.answer.written : []
    expect(written.map(({ key }) => key)).toEqual(request.asked.map(({ key }) => key))
    expect(written.map(({ key, source }) => [key, source])).toEqual(request.asked.map(({ key, source }) => [key, source]))
    expect(written.find(({ key }) => key === 'w17')?.text).toBe('Pièce')
    expect(prompts.map(({ kind, system, user, followUp }) => [kind, system, user, followUp])).toEqual([
      ['translation', translationBriefing(), request.user, undefined],
    ])
  })

  // An answer for another language, or one that does not say, would write
  // French where Italian was asked; a member that is no object of strings
  // cannot be read key by key. Each is asked again with that problem alone,
  // the follow-up its complaint.
  test.each([
    ['other-locale', 'wrong-locale', TRANSLATION_COMPLAINTS.wrongLocale('fr-CH')],
    ['no-locale', 'no-locale', TRANSLATION_COMPLAINTS.noLocale('fr-CH')],
    ['locale-a-number', 'no-locale', TRANSLATION_COMPLAINTS.noLocale('fr-CH')],
    ['words-not-an-object', 'not-strings', TRANSLATION_COMPLAINTS.notStrings('words')],
    ['words-not-strings', 'not-strings', TRANSLATION_COMPLAINTS.notStrings('words')],
    ['expressions-not-strings', 'not-strings', TRANSLATION_COMPLAINTS.notStrings('expressions')],
    ['prose', 'not-json', TRANSLATION_COMPLAINTS.notJson],
    ['decline-without-reason', 'unexplained-decline', TRANSLATION_COMPLAINTS.unexplainedDecline],
  ])('asks again, with that problem alone, after an answer %s', async (name, kind, detail) => {
    const { ask, prompts } = scripted(name, 'whole')
    const run = await translateMissing(ask, report, locale)
    expect(run.ok && run.attempts).toBe(2)
    const complaint = translationComplaint({ kind: kind as 'not-json', detail })
    expect(prompts[1]?.followUp).toBe(complaint)
    expect(prompts[1]?.user).toBe(`${request.user}\n\n${complaint}`)
    expect(prompts.map(({ attempt, limit }) => [attempt, limit])).toEqual([
      [1, 3],
      [2, 3],
    ])
  })

  // Another turn would be one more paid for -- through a relay, two pastes
  // by hand -- to hear the same decline (formancy.ai 0158).
  test('ends the run on a decline, with its reason', async () => {
    const { ask, prompts } = scripted('decline', 'whole')
    const run = await translateMissing(ask, report, locale)
    expect(run).toMatchObject({ ok: false, ended: 'declined', attempts: 1, reason: 'I do not write French well enough for a document a customer reads.' })
    expect(prompts).toHaveLength(1)
  })

  // Three answers that are none end the run, with each problem in order,
  // rather than asking forever.
  test('gives up after three answers that are none', async () => {
    const { ask } = scripted('prose', 'other-locale', 'words-not-strings')
    const run = await translateMissing(ask, report, locale)
    expect(!run.ok && run.ended === 'gave-up' && run.problems.map(({ kind }) => kind)).toEqual(['not-json', 'wrong-locale', 'not-strings'])
  })

  // A key the request did not ask names no source the request held, and
  // one under the other member names another kind of thing: written, it
  // would land on a word nobody asked about, or none.
  test('drops and lists a key the request did not ask, in either member, and keeps the rest', async () => {
    const run = await translateMissing(scripted('keys-not-asked').ask, report, locale)
    const read = run.ok ? run.answer : undefined
    expect(read?.written.map(({ key, kind }) => [key, kind])).toEqual([
      ['w1', 'word'],
      ['e2', 'expression'],
    ])
    expect(read?.dropped).toEqual([
      { member: 'words', key: 'w99' },
      { member: 'words', key: 'e1' },
      { member: 'expressions', key: 'w3' },
      { member: 'expressions', key: 'e9' },
    ])
  })

  // A model may write a key an object holds by its prototype, or one key
  // twice. A prototype's key never lands on anything: its names are keys
  // nobody asked, dropped as any other. A key written twice lands as JSON
  // keeps it, the last, which is the one read: that half holds
  // `JSON.parse`'s own rule, which no fault of the reader's can change.
  test("drops a prototype's keys as keys not asked, and reads the last of a key written twice", async () => {
    const proto = await translateMissing(scripted('keys-of-the-prototype').ask, report, locale)
    expect(proto.ok && proto.answer.written.map(({ key, text }) => [key, text])).toEqual([['w1', 'Rapport des ventes']])
    expect(proto.ok && proto.answer.dropped).toEqual([
      { member: 'words', key: '__proto__' },
      { member: 'words', key: 'constructor' },
    ])
    const twice = await translateMissing(scripted('duplicate-keys').ask, report, locale)
    expect(twice.ok && twice.answer.written.map(({ key, text }) => [key, text])).toEqual([['w1', 'Rapport des ventes']])
  })

  // A partial answer is work done, and refusing it would ask a model told
  // to leave what it is unsure of empty to guess instead (formancy.ai
  // 0161); a text of nothing but white space is one left empty, which the
  // format would refuse as blank anyway.
  test('keeps a partial answer, and takes a text left blank as still missing', async () => {
    const partial = await translateMissing(scripted('partial').ask, report, locale)
    expect(partial.ok && partial.answer.written.map(({ key, source }) => [key, source])).toEqual([
      ['w1', 'Umsatzbericht'],
      ['w17', 'Beleg'],
      ['w18', 'Datum'],
      ['w19', 'Region'],
    ])
    expect(partial.ok && partial.answer.leftEmpty).toHaveLength(request.asked.length - 4)
    const blank = await translateMissing(scripted('blank-texts').ask, report, locale)
    expect(blank.ok && blank.answer.leftEmpty).toEqual(['w12', 'w13', 'w20', 'e1'])
    expect(blank.ok && blank.answer.dropped).toEqual([])
  })
})

describe('a run with nothing to ask, or stopped', () => {
  // A turn paid for -- through a relay, two pastes by hand -- to translate
  // nothing.
  test('asks nothing when the language lacks nothing', async () => {
    const { ask, prompts } = scripted('whole')
    const run = await translateMissing(ask, allWritten(report, locale), locale)
    expect(run).toEqual({ ok: true, attempts: 0, answer: { locale, asked: [], forPerson: [], written: [], dropped: [], leftEmpty: [], later: 0, noRoom: [] } })
    expect(prompts).toEqual([])
  })

  // A stop pressed while the model answers ends the run at once, and what
  // the model says later is never read as an answer (formancy.ai 0157).
  test('ends at once on a stop, and keeps nothing the model says after it', async () => {
    const stop = createStop()
    const ask: AskModel<'translation'> = () => new Promise((resolve) => setTimeout(() => resolve(answer('whole')), 10))
    const run = translateMissing(ask, report, locale, { stop })
    stop.stop()
    expect(await run).toMatchObject({ ok: false, ended: 'stopped', attempts: 1 })
  })
})
