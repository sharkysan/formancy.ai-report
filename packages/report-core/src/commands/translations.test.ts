/**
 * The commands that add and remove a report's languages and write its
 * words in them (0063): each one undo step, a refusal changing nothing,
 * and what the session's validator judges left to it.
 */
import type { ReportDefinition, Translation } from '@formancy/report-spec'
import { describe, expect, test } from 'vitest'
import { openReportSession } from '../session.js'
import type { ReportSession } from '../session.js'
import { accepted, frozen, refused, sampleReport } from '../test-support.js'
import { ARGUMENTS, describedCommand } from './registry.js'
import { addLanguage, removeLanguage, translateExpression, translateWord } from './translations.js'

const INTRO = 'header.customer + " x" + string(params.copies)'

/** The sample with `translations`, frozen as a session's document is. */
const translated = (...translations: Translation[]): ReportDefinition => frozen({ ...sampleReport(), translations })

/** A French translation of two of the sample's words. */
const french = (): Translation => ({
  locale: 'fr-CH',
  words: [
    { word: 'Qty', text: 'Qté' },
    { word: 'Total', text: 'Total' },
  ],
  expressions: [],
})

/** A session over `report`. */
function sessionOver(report: ReportDefinition): ReportSession {
  const opening = openReportSession(report)
  if (!opening.ok) throw new Error('the report did not open')
  return opening.session
}

describe('addLanguage', () => {
  // A language just added holds no words: every word is then missing in
  // it, which the diagnostics say, and the report stays one a session
  // holds while it is translated.
  test('adds a language with no words, after those the report has', () => {
    expect(accepted(addLanguage(frozen(sampleReport()), 'fr-CH')).translations).toEqual([{ locale: 'fr-CH', words: [], expressions: [] }])
    expect(accepted(addLanguage(translated(french()), 'it-CH')).translations?.map(({ locale }) => locale)).toEqual(['fr-CH', 'it-CH'])
  })

  // An add never replaces, as every add here does not: a second French
  // would drop the words the first holds, and the report's own language
  // is written where its words stand.
  test("refuses the report's own language and one it has, as already declared", () => {
    expect(refused(addLanguage(frozen(sampleReport()), 'de-CH')).code).toBe('already-declared')
    expect(refused(addLanguage(translated(french()), 'fr-CH')).code).toBe('already-declared')
  })

  // How a locale is written is the validator's, which the session asks, as
  // it asks for every command's result.
  test('leaves a locale written otherwise to the validator, which the session asks', () => {
    const session = sessionOver(sampleReport())
    const before = session.document()
    const outcome = refused(session.apply((report) => addLanguage(report, 'fr_CH')))
    expect(outcome.code).toBe('invalid-document')
    expect(outcome.errors?.map(({ code, path }) => `${code} ${path}`)).toEqual(['invalid-locale /translations/0/locale'])
    expect(session.document()).toBe(before)
  })
})

describe('removeLanguage', () => {
  // A language removed takes its words with it; the last one leaves a
  // report with no translations, never an empty list, so that it is the
  // report it was before one was added, and hashes as it did.
  test('removes a language and its words, and the last leaves the report without translations', () => {
    const italian: Translation = { locale: 'it-CH', words: [], expressions: [] }
    expect(accepted(removeLanguage(translated(french(), italian), 'fr-CH')).translations).toEqual([italian])
    const removed = accepted(removeLanguage(translated(french()), 'fr-CH'))
    expect(removed).not.toHaveProperty('translations')
    expect(removed).toEqual(sampleReport())
  })

  // A removal of what is not there would report success for nothing; the
  // report's own language is the one its words are written in.
  test('refuses a language the report has no translation in, its own among them, as not found', () => {
    expect(refused(removeLanguage(translated(french()), 'it-CH')).code).toBe('not-found')
    expect(refused(removeLanguage(translated(french()), 'de-CH')).code).toBe('not-found')
    expect(refused(removeLanguage(frozen(sampleReport()), 'fr-CH')).code).toBe('not-found')
  })
})

describe('translateWord', () => {
  // A person types a word in the language the builder shows, and that is
  // its translation there, in the place it already had, or after the rest.
  test('writes a translation of a word, in place of the one it had or after the rest', () => {
    const changed = accepted(translateWord(translated(french()), 'fr-CH', 'Qty', 'Quantité'))
    expect(changed.translations?.[0]?.words).toEqual([
      { word: 'Qty', text: 'Quantité' },
      { word: 'Total', text: 'Total' },
    ])
    const report = translated(french())
    const added = accepted(translateWord(report, 'fr-CH', 'Orders by site', 'Commandes par site'))
    expect(added.translations?.[0]?.words.at(-1)).toEqual({ word: 'Orders by site', text: 'Commandes par site' })
    expect(added.regions).toBe(report.regions)
    const italian: Translation = { locale: 'it-CH', words: [{ word: 'Qty', text: 'Qtà' }], expressions: [] }
    const both = translated(french(), italian)
    expect(accepted(translateWord(both, 'fr-CH', 'Qty', 'Quantité')).translations?.[1]).toBe(both.translations?.[1])
  })

  // An empty field is a word not yet written, never a blank one: null
  // removes the translation, which a language then says is missing.
  test('removes a translation for null, and a translation of a word the report no longer prints', () => {
    expect(accepted(translateWord(translated(french()), 'fr-CH', 'Qty', null)).translations?.[0]?.words).toEqual([{ word: 'Total', text: 'Total' }])
    const stale = translated({ ...french(), words: [{ word: 'Nowhere', text: 'Nulle part' }] })
    expect(accepted(translateWord(stale, 'fr-CH', 'Nowhere', null)).translations?.[0]?.words).toEqual([])
  })

  // A translation of a word the report does not print is kept for nothing;
  // a word is translated in a language the report has, and the report's
  // own words are written where they stand.
  test('refuses a word the report does not print, a language it has no translation in, and a removal of nothing, as not found', () => {
    expect(refused(translateWord(translated(french()), 'fr-CH', 'Nowhere', 'Nulle part')).code).toBe('not-found')
    expect(refused(translateWord(translated(french()), 'it-CH', 'Qty', 'Qtà')).code).toBe('not-found')
    expect(refused(translateWord(translated(french()), 'de-CH', 'Qty', 'Menge')).code).toBe('not-found')
    expect(refused(translateWord(translated(french()), 'fr-CH', 'Price', null)).code).toBe('not-found')
  })

  // A blank translation prints nothing in its word's place: the validator
  // refuses it, and the session keeps the report it had.
  test('leaves a blank translation to the validator, which the session asks', () => {
    const session = sessionOver(translated(french()))
    const before = session.document()
    const outcome = refused(session.apply((report) => translateWord(report, 'fr-CH', 'Qty', ' ')))
    expect(outcome.errors?.map(({ code, path }) => `${code} ${path}`)).toEqual(['blank-translation /translations/0/words/0/text'])
    expect(session.document()).toBe(before)
  })
})

describe('translateExpression', () => {
  // An expression that prints words is written again in the language, by
  // its source; null takes the translation back.
  test('writes and removes the translation of an expression that stands where words do', () => {
    const written = accepted(translateExpression(translated(french()), 'fr-CH', INTRO, { cel: 'header.customer + " fois " + string(params.copies)' }))
    expect(written.translations?.[0]?.expressions).toEqual([{ cel: INTRO, expression: { cel: 'header.customer + " fois " + string(params.copies)' } }])
    const again = accepted(translateExpression(written, 'fr-CH', INTRO, { cel: 'header.customer + " x" + string(params.copies)' }))
    expect(again.translations?.[0]?.expressions).toEqual([{ cel: INTRO, expression: { cel: 'header.customer + " x" + string(params.copies)' } }])
    expect(accepted(translateExpression(written, 'fr-CH', INTRO, null)).translations?.[0]?.expressions).toEqual([])
  })

  // A condition, a QR code's content and an aggregate's expression print
  // no words; a source the report holds nowhere a word stands is refused.
  test('refuses a source that stands nowhere a word does, a language the report has none in, and a removal of nothing', () => {
    expect(refused(translateExpression(translated(french()), 'fr-CH', 'params.draft == false', { cel: 'true' })).code).toBe('not-found')
    expect(refused(translateExpression(translated(french()), 'it-CH', INTRO, { cel: '"x"' })).code).toBe('not-found')
    expect(refused(translateExpression(translated(french()), 'fr-CH', INTRO, null)).code).toBe('not-found')
  })
})

describe('setLocale, with translations', () => {
  // The report's own locale names the language its words are written in;
  // set to a language a translation declares, the report would be written
  // in it twice, and the validator the session asks refuses that.
  test("relabels the report's own language, and is refused for one a translation declares", () => {
    const session = sessionOver(translated(french()))
    expect(session.apply({ command: 'setLocale', args: ['de-DE'] }).ok).toBe(true)
    expect(session.document().translations).toEqual([french()])
    const before = session.document()
    const outcome = refused(session.apply({ command: 'setLocale', args: ['fr-CH'] }))
    expect(outcome.errors?.map(({ code, path }) => `${code} ${path}`)).toEqual(['duplicate-language /translations/0/locale'])
    expect(session.document()).toBe(before)
  })
})

describe('the commands as data', () => {
  // A proposal and a batch name a command and its arguments; each edit
  // here is one undo step, as every edit is, and the very report comes
  // back.
  test('run from their descriptors, each one undo step', () => {
    const session = sessionOver(sampleReport())
    const before = session.document()
    expect(session.apply({ command: 'addLanguage', args: ['fr-CH'] }).ok).toBe(true)
    expect(session.apply({ command: 'translateWord', args: ['fr-CH', 'Qty', 'Qté'] }).ok).toBe(true)
    expect(session.apply({ command: 'translateExpression', args: ['fr-CH', INTRO, { cel: INTRO }] }).ok).toBe(true)
    expect(session.apply({ command: 'removeLanguage', args: ['fr-CH'] }).ok).toBe(true)
    for (let step = 0; step < 4; step += 1) expect(session.undo()).toBe(true)
    expect(session.document()).toBe(before)
  })

  // Arguments read from JSON were never type-checked: a word's text that
  // is neither a string nor null, or an expression that is no object, is
  // refused before the command runs.
  test('refuse arguments of another shape before they run', () => {
    expect(ARGUMENTS.translateWord).toEqual(['text', 'text', 'textOrNull'])
    expect(ARGUMENTS.translateExpression).toEqual(['text', 'text', 'objectOrNull'])
    const report = translated(french())
    expect(refused(describedCommand({ command: 'translateWord', args: ['fr-CH', 'Qty', 7 as unknown as string] })(report)).code).toBe('invalid-arguments')
    expect(refused(describedCommand({ command: 'translateExpression', args: ['fr-CH', INTRO, 'header.customer' as unknown as null] })(report)).code).toBe(
      'invalid-arguments',
    )
    expect(refused(describedCommand({ command: 'addLanguage', args: [] as unknown as [string] })(report)).code).toBe('invalid-arguments')
  })
})
