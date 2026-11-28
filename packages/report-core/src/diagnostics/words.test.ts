/**
 * What the diagnostics say of a report in each language it declares
 * (0063): a word missing, a translated expression that would print
 * another thing than its source, a translation kept for nothing, and every
 * diagnostic the report written in that language gives that its own does
 * not, each naming its language.
 */
import { componentAt, reportWords, validateReport, wordExpressionSites } from '@formancy/report-spec'
import type { ReportDefinition, Translation } from '@formancy/report-spec'
import { describe, expect, test } from 'vitest'
import { thawed } from '../snapshot.js'
import type { Mutable } from '../snapshot.js'
import { eInvoiceSample, sampleReport, setAt } from '../test-support.js'
import { diagnose } from './diagnose.js'
import { inPaymentPart, languageDiagnostics, missingWords, wordExpressions } from './words.js'

const INTRO = 'header.customer + " x" + string(params.copies)'
const GROUP = '" (" + string(group.lines) + ")"'
const MESSAGE = '" for " + header.customer'

/** The sample's word expressions: the runs that print text and hold a quote, where words stand. */
const WORD_EXPRESSIONS = [INTRO, GROUP, MESSAGE]

/** `report`'s every word in French, each `fr:` and the word, and each of its word expressions written again as itself: a whole translation. */
function french(report: ReportDefinition, expressions: readonly string[] = WORD_EXPRESSIONS): Translation {
  return {
    locale: 'fr-CH',
    words: [...new Set(reportWords(report).map(({ text }) => text))].map((word) => ({ word, text: `fr:${word}` })),
    expressions: expressions.map((cel) => ({ cel, expression: { cel } })),
  }
}

/** `report` edited and checked valid: the diagnostics are about valid reports. */
function valid(report: ReportDefinition, edit: (report: Mutable<ReportDefinition>) => void = () => undefined): ReportDefinition {
  const draft = thawed(report)
  edit(draft)
  const outcome = validateReport(draft)
  if (!outcome.valid) throw new Error(`the edit made the report invalid: ${outcome.errors.map(({ code, path }) => `${code} ${path}`).join(', ')}`)
  return outcome.report
}

/** The sample with `translation`, its words those of the sample as `edit` leaves it. */
function translated(
  translation: (report: ReportDefinition) => Translation,
  edit?: (report: Mutable<ReportDefinition>) => void,
  base = sampleReport(),
): ReportDefinition {
  const edited = valid(base, edit)
  return valid(edited, (report) => setAt(report, '/translations', [translation(edited)]))
}

/** `translation` with the entry for `cel` written as `written`. */
function writing(translation: Translation, cel: string, written: string): Translation {
  return { ...translation, expressions: translation.expressions.map((entry) => (entry.cel === cel ? { cel, expression: { cel: written } } : entry)) }
}

/** The index of `cel`'s entry in the sample's whole French. */
const entryOf = (cel: string): number => WORD_EXPRESSIONS.indexOf(cel)

describe('languageDiagnostics', () => {
  // A whole translation is a language that prints: a false alarm on it
  // would refuse a render nothing is missing from.
  test('finds nothing in a whole translation', () => {
    const report = translated(french)
    expect(languageDiagnostics(report, 'fr-CH')).toEqual([])
    expect(diagnose(report)).toEqual([])
  })

  // The report's own language is diagnosed as it always was; a language
  // the report does not declare has nothing to say of it.
  test("says nothing of the report's own language, or of one it does not declare", () => {
    const report = translated((edited) => ({ ...french(edited), words: [] }))
    expect(languageDiagnostics(report, 'de-CH')).toEqual([])
    expect(languageDiagnostics(report, 'it-CH')).toEqual([])
    expect(languageDiagnostics(sampleReport(), 'fr-CH')).toEqual([])
  })

  // A word missing is said once, where it first stands, naming its
  // language: the render in that language is refused for it, and the
  // editor shows where.
  test('says each word missing once, an error at its first place, naming its language, its component and its column', () => {
    const report = translated((edited) => ({
      ...french(edited),
      words: french(edited).words.filter(({ word }) => word !== 'Qty' && word !== 'Orders by site'),
    }))
    expect(languageDiagnostics(report, 'fr-CH')).toEqual([
      { severity: 'error', code: 'word-missing', path: '/title', language: 'fr-CH', message: expect.stringContaining('"Orders by site"') as string },
      {
        severity: 'error',
        code: 'word-missing',
        path: '/regions/body/2/columns/1/header',
        componentId: 'lines',
        columnId: 'qty',
        language: 'fr-CH',
        message: expect.stringContaining('fr-CH') as string,
      },
    ])
  })

  // A word in two places is one translation: it is said missing once, at
  // the first of them, not once for each.
  test('says a word that stands in two places once', () => {
    const report = translated(
      (edited) => ({ ...french(edited), words: french(edited).words.filter(({ word }) => word !== 'Total') }),
      (draft) => setAt(draft, '/regions/body/3/components/1/content/0/text', 'Total'),
    )
    expect(languageDiagnostics(report, 'fr-CH').map(({ code, path }) => `${code} ${path}`)).toEqual([
      'word-missing /regions/body/2/totals/0/cells/0/value/text',
    ])
  })

  // An expression that prints text and holds a quote prints words, which a
  // language must write: one left untranslated would print German in a
  // French render.
  test('says an expression that prints text and holds a quote missing, where it stands', () => {
    const report = translated((edited) => french(edited, [GROUP, MESSAGE]))
    expect(languageDiagnostics(report, 'fr-CH')).toEqual([
      {
        severity: 'error',
        code: 'word-missing',
        path: '/regions/body/0/content/2/expression/cel',
        componentId: 'intro',
        language: 'fr-CH',
        message: expect.any(String) as string,
      },
    ])
  })

  // A number prints as its locale writes it, never as a translator does:
  // dec("1.081") holds a quote and prints a decimal, and a text that holds
  // no quote prints only what the data says.
  test('asks no translation of an expression that prints a number, or of one without a quote', () => {
    const report = translated(french, (draft) => {
      const content = draft.regions.body[0] as Mutable<{ content: unknown[] }>
      content.content.push({ kind: 'expression', expression: { cel: 'totals.subtotal * dec("1.081")' } })
      content.content.push({ kind: 'expression', expression: { cel: 'header.customer + header.currency' } })
    })
    expect(languageDiagnostics(report, 'fr-CH')).toEqual([])
  })

  // A value that may be null is read as one the compiler cannot tell, and
  // may print text: never too few words, so it is asked for.
  test('says an expression the compiler cannot type, that holds a quote and prints as text, missing', () => {
    const cel = 'params.threshold == null ? "none" : params.threshold'
    const report = translated(french, (draft) => {
      ;(draft.regions.body[0] as Mutable<{ content: unknown[] }>).content.push({ kind: 'expression', expression: { cel } })
    })
    expect(languageDiagnostics(report, 'fr-CH').map(({ code, path }) => `${code} ${path}`)).toEqual(['word-missing /regions/body/0/content/3/expression/cel'])
  })

  // A run whose format prints a number or a date prints no words, whatever
  // type the compiler could tell its expression gives.
  test('asks no translation of an expression whose run prints it as a number', () => {
    const cel = 'params.threshold == null ? dec("0") : params.threshold'
    const report = translated(french, (draft) => {
      const content = draft.regions.body[0] as Mutable<{ content: unknown[] }>
      content.content.push({ kind: 'expression', expression: { cel }, format: { kind: 'number', scale: 2, grouping: true } })
    })
    expect(languageDiagnostics(report, 'fr-CH')).toEqual([])
  })

  // A translated expression is compiled where its source stands, by the
  // same compilation: its errors are the compiler's, at the translation,
  // naming the language and where the source stands.
  test("gives a translated expression's errors at the translation, naming its language and the component its source stands in", () => {
    const report = translated((edited) => writing(french(edited), INTRO, 'header.customer + " x" + params.copies'))
    expect(languageDiagnostics(report, 'fr-CH')).toEqual([
      {
        severity: 'error',
        code: 'expression-type',
        path: `/translations/0/expressions/${entryOf(INTRO)}/expression/cel`,
        componentId: 'intro',
        language: 'fr-CH',
        position: expect.any(Object) as object,
        message: expect.stringMatching(/^in fr-CH, /) as string,
      },
    ])
  })

  // One source in two places is compiled in each: a translation refused in
  // one of them is refused there, by component.
  test('compiles a translated expression at every place its source stands', () => {
    const cel = '"(" + string(totals.lines) + ")"'
    const report = translated(
      (edited) => writing(french(edited, [...WORD_EXPRESSIONS, cel]), cel, '"(" + string(totals.lines) + ") " + string(now())'),
      (draft) => {
        ;(draft.regions.body[0] as Mutable<{ content: unknown[] }>).content.push({ kind: 'expression', expression: { cel } })
        ;(draft.regions.body[3] as Mutable<{ components: { content: unknown[] }[] }>).components[1]?.content.push({ kind: 'expression', expression: { cel } })
      },
    )
    expect(languageDiagnostics(report, 'fr-CH').map(({ code, path, componentId }) => `${code} ${path} ${componentId}`)).toEqual([
      'expression-not-reproducible /translations/0/expressions/3/expression/cel intro',
      'expression-not-reproducible /translations/0/expressions/3/expression/cel note',
    ])
  })

  // A source the compiler refuses refuses every render with its own error;
  // whether it prints words is not known, so a language is asked nothing
  // of it, and its translation is judged by the compiler alone.
  test('asks nothing of an expression the compiler refuses in the report its own language, and judges its translation by the compiler', () => {
    const cel = 'header.customer + " x" + params.copies'
    const edit = (draft: Mutable<ReportDefinition>): void => setAt(draft, '/regions/body/0/content/2/expression/cel', cel)
    const without = translated((edited) => french(edited, [GROUP, MESSAGE]), edit)
    expect(languageDiagnostics(without, 'fr-CH')).toEqual([])
    const written = 'header.customer + " fois " + params.copies'
    const translation = translated(
      (edited) => ({
        ...french(edited, [GROUP, MESSAGE]),
        expressions: [...french(edited, [GROUP, MESSAGE]).expressions, { cel, expression: { cel: written } }],
      }),
      edit,
    )
    expect(diagnose(translation).map(({ code, path, language }) => `${code} ${path} ${language}`)).toEqual([
      'expression-type /regions/body/0/content/2/expression/cel undefined',
      'expression-type /translations/0/expressions/2/expression/cel fr-CH',
    ])
  })

  // What reads a field is the source's alone -- a form review, a removal,
  // the unused field's warning -- so a translation reads exactly what its
  // source reads, no member more and none fewer.
  test('refuses a translation that reads another member than its source, or fewer, as translation-differs', () => {
    const more = translated((edited) => writing(french(edited), MESSAGE, '" pour " + header.customer + header.currency'))
    expect(languageDiagnostics(more, 'fr-CH')).toEqual([
      {
        severity: 'error',
        code: 'translation-differs',
        path: `/translations/0/expressions/${entryOf(MESSAGE)}/expression/cel`,
        language: 'fr-CH',
        message: expect.stringContaining('header.currency') as string,
      },
    ])
    // The French report would then ask for copies and print them nowhere,
    // which the report written in French says too.
    const none = translated(
      (edited) => writing(french(edited, [...WORD_EXPRESSIONS, '"a" + "b"']), '"a" + "b"', '"a" + string(params.copies)'),
      (draft) => (draft.regions.body[0] as Mutable<{ content: unknown[] }>).content.push({ kind: 'expression', expression: { cel: '"a" + "b"' } }),
    )
    expect(languageDiagnostics(none, 'fr-CH').map(({ message }) => message)).toEqual([
      expect.stringContaining('reads params.copies, and the expression it translates reads nothing'),
    ])
    const fewer = translated((edited) => writing(french(edited), INTRO, 'header.customer + " fois"'))
    expect(languageDiagnostics(fewer, 'fr-CH').map(({ code, path, language }) => `${code} ${path} ${language}`)).toEqual([
      `translation-differs /translations/0/expressions/${entryOf(INTRO)}/expression/cel fr-CH`,
      'unused-parameter /parameters/4 fr-CH',
    ])
  })

  // A translation prints what its source prints, in other words: one that
  // gives a number where its source gives text prints another column.
  test('refuses a translation of another type as translation-differs', () => {
    const report = translated((edited) => writing(french(edited), INTRO, 'size(header.customer + " fois") + params.copies'))
    expect(languageDiagnostics(report, 'fr-CH').map(({ code, message }) => `${code} ${message.includes('int') && message.includes('string')}`)).toEqual([
      'translation-differs true',
    ])
  })

  // A number is never a language's: a translation of the VAT a table
  // prints would print another VAT in French than in German. It is an
  // error, never a warning that renders.
  test('refuses a translation of an expression that prints no words, as translation-differs', () => {
    const cel = 'round(dec(row.quantity) * row.unit_price, 2)'
    const report = translated((edited) => ({
      ...french(edited),
      expressions: [...french(edited).expressions, { cel, expression: { cel: 'round(dec(row.quantity) * row.unit_price, 0)' } }],
    }))
    expect(languageDiagnostics(report, 'fr-CH')).toEqual([
      {
        severity: 'error',
        code: 'translation-differs',
        path: '/translations/0/expressions/3/expression/cel',
        componentId: 'lines',
        columnId: 'amount',
        language: 'fr-CH',
        message: expect.stringContaining('decimal') as string,
      },
    ])
  })

  // The page shows the invoice it carries in every language: a
  // translation that left out the total its source printed would print a
  // French page without the total the XML holds.
  test('gives what the report written in a language gives that its own does not, naming the language', () => {
    const run = '"brutto " + string(invoice.grandTotal)'
    const totals = componentAt(eInvoiceSample(), 'invoice-totals')?.path
    const edit = (draft: Mutable<ReportDefinition>): void => setAt(draft, `${totals}/content/9`, { kind: 'expression', expression: { cel: run } })
    const report = translated((edited) => writing(french(edited, [...WORD_EXPRESSIONS.slice(0, 2), run]), run, '"brut"'), edit, eInvoiceSample())
    expect(diagnose(valid(eInvoiceSample(), edit))).toEqual([])
    expect(languageDiagnostics(report, 'fr-CH').map(({ code, path, language }) => `${code} ${path} ${language}`)).toEqual([
      'translation-differs /translations/0/expressions/2/expression/cel fr-CH',
      'e-invoice-total-unprinted /eInvoice fr-CH',
    ])
  })

  // A translation of a word the report no longer prints is kept for
  // nothing: said, as a warning, and never printed.
  test('warns of a translation of a word or an expression the report does not print', () => {
    const report = translated((edited) => ({
      ...french(edited),
      words: [...french(edited).words, { word: 'Nowhere', text: 'Nulle part' }],
      expressions: [...french(edited).expressions, { cel: '"gone"', expression: { cel: '"parti"' } }],
    }))
    expect(languageDiagnostics(report, 'fr-CH').map(({ severity, code, path }) => `${severity} ${code} ${path}`)).toEqual([
      `warning unused-translation /translations/0/words/${french(report).words.length}`,
      'warning unused-translation /translations/0/expressions/3',
    ])
  })
})

describe("diagnose, in each language's", () => {
  // The editor shows every language's problems, each by its language, in
  // the order the report declares them, after the report's own.
  test("lists each language's after the report's own, in the order declared", () => {
    const report = valid(sampleReport(), (draft) =>
      setAt(draft, '/translations', [
        { locale: 'fr-CH', words: [], expressions: [] },
        { ...french(sampleReport()), locale: 'it-CH', words: french(sampleReport()).words.filter(({ word }) => word !== 'Qty') },
      ]),
    )
    const said = diagnose(report)
    expect(said.filter(({ language }) => language === 'it-CH').map(({ code, path }) => `${code} ${path}`)).toEqual([
      'word-missing /regions/body/2/columns/1/header',
    ])
    expect(said.filter(({ language }) => language === 'fr-CH')).toHaveLength(
      new Set(reportWords(report).map(({ text }) => text)).size + WORD_EXPRESSIONS.length,
    )
    expect(said.findIndex(({ language }) => language === 'it-CH')).toBeGreaterThan(said.findLastIndex(({ language }) => language === 'fr-CH'))
    expect(said.every(({ language }) => language !== undefined)).toBe(true)
  })
})

describe('missingWords', () => {
  // The words a language lacks are read back to their sources from
  // word-missing alone: a list of its own would ask for a word the
  // diagnostics do not miss, or leave out one a render in that language is
  // refused for.
  test('gives each word and expression word-missing names, by its source, with every place it stands and the one the diagnostic stands at', () => {
    const report = translated((edited) => ({ ...french(edited, [GROUP, MESSAGE]), words: french(edited).words.filter(({ word }) => word !== 'Qty') }))
    const said = languageDiagnostics(report, 'fr-CH').flatMap(({ code, path }) => (code === 'word-missing' ? [path] : []))
    const { paymentPart, rest } = missingWords(report, 'fr-CH')
    expect(paymentPart).toEqual([])
    expect(rest).toEqual([
      { kind: 'word', source: 'Qty', paths: ['/regions/body/2/columns/1/header'], at: '/regions/body/2/columns/1/header' },
      { kind: 'expression', source: INTRO, paths: ['/regions/body/0/content/2/expression/cel'], at: '/regions/body/0/content/2/expression/cel' },
    ])
    expect(rest.map(({ at }) => at)).toEqual(said)
  })

  // The QR-bill's message prints on the slip and is encoded in the code a
  // bank reads, which no proposal changes (0039, 0048): a word standing
  // there in any place is a person's to write, though it stands first
  // elsewhere, since a word is translated once wherever it stands (0085,
  // 0088).
  test('gives what stands anywhere in the payment part apart, a word that stands first elsewhere among it', () => {
    const report = translated(
      (edited) => ({ ...french(edited, [INTRO, GROUP]), words: french(edited).words.filter(({ word }) => word !== 'Total') }),
      (draft) => setAt(draft, '/paymentPart/message/0/text', 'Total'),
    )
    const { paymentPart, rest } = missingWords(report, 'fr-CH')
    expect(paymentPart.map(({ kind, source, at }) => `${kind} ${source} ${at}`)).toEqual([
      'word Total /regions/body/2/totals/0/cells/0/value/text',
      `expression ${MESSAGE} /paymentPart/message/1/expression/cel`,
    ])
    expect(paymentPart[0]?.paths.at(-1)).toBe('/paymentPart/message/0/text')
    expect(rest).toEqual([])
  })

  // word-missing names an expression at its first site that prints words,
  // which need not be its first: one printed as a number in the report's
  // body and as words in the slip's message is the payment part's all the
  // same. Matched at its first site alone, it would be left out of both
  // lists, and an agent would translate the slip's words.
  test("gives an expression of the payment part's whose first site prints no words", () => {
    const report = translated(
      (edited) => french(edited, [INTRO, GROUP]),
      (draft) => {
        const content = draft.regions.body[0] as Mutable<{ content: unknown[] }>
        content.content.push({ kind: 'expression', expression: { cel: MESSAGE }, format: { kind: 'number', scale: 2, grouping: true } })
      },
    )
    const { paymentPart, rest } = missingWords(report, 'fr-CH')
    expect(paymentPart).toEqual([
      {
        kind: 'expression',
        source: MESSAGE,
        paths: ['/regions/body/0/content/3/expression/cel', '/paymentPart/message/1/expression/cel'],
        at: '/paymentPart/message/1/expression/cel',
      },
    ])
    expect(rest).toEqual([])
  })

  // As languageDiagnostics: nothing of the report's own language, or of one
  // it does not declare.
  test("gives nothing of the report's own language, or of one it does not declare", () => {
    const report = translated((edited) => ({ ...french(edited), words: [] }))
    expect([missingWords(report, 'de-CH'), missingWords(report, 'it-CH')]).toEqual([
      { paymentPart: [], rest: [] },
      { paymentPart: [], rest: [] },
    ])
  })
})

describe('inPaymentPart', () => {
  // The payment part is named by the definition's own key: a place under
  // another key whose name begins the same is no part of it.
  test('says a place under the payment part is in it, and no other', () => {
    expect(['/paymentPart/message/0/text', '/paymentPartner/0', '/paymentPart', '/regions/body/0'].map(inPaymentPart)).toEqual([true, false, false, false])
  })
})

describe('wordExpressions', () => {
  // The builders mark and edit an expression as a word where the
  // diagnostics ask its translation: a list of their own would show an
  // expression to translate that no problem asks for, or hide one that a
  // render in that language is refused for (0063).
  test('gives the expression runs where words stand that print words, and none that prints a number or a text without a quote', () => {
    const report = valid(sampleReport(), (draft) => {
      const content = draft.regions.body[0] as Mutable<{ content: unknown[] }>
      content.content.push({ kind: 'expression', expression: { cel: 'totals.subtotal * dec("1.081")' } })
      content.content.push({ kind: 'expression', expression: { cel: 'header.customer + header.currency' } })
    })
    const sites = wordExpressions(report)
    expect([...new Set(sites.map(({ cel }) => cel))].sort()).toEqual([...WORD_EXPRESSIONS].sort())
    expect(sites.every((site) => wordExpressionSites(report).some(({ path }) => path === site.path))).toBe(true)
    expect(wordExpressionSites(report).length - sites.length).toBeGreaterThanOrEqual(2)
  })
})
