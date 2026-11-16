/**
 * The walk of a report's words (0063): which strings are the report's own
 * words, at which places, and that every other string the format holds is
 * named, by a decision, as no word.
 *
 * The guard reads the validator's shapes to know that its fixtures are
 * whole: `check.js` is wrapped so that each shape the validator accepts --
 * its required and optional keys, read where it reads them -- is recorded
 * with the keys each object of it held. A key no fixture holds is a string
 * the guard could not see, so the guard fails on it before it judges what
 * the fixtures hold. That is why this file reads the module graph rather
 * than only the fixtures: a property added to the format, optional and
 * held by no fixture, would otherwise pass unseen. What it cannot see is a
 * string held only in one branch of a union the fixtures write the other
 * way -- a width that is "fill", a default that is text -- which the
 * fixtures hold where it matters and review holds otherwise.
 */
import { describe, expect, test, vi } from 'vitest'
import type { ReportDefinition } from './definition.js'
import { eInvoiceReport, editable, getAt, readFromForm, richReport, setAt, xrechnungReport } from './test-support.js'
import { isWord, NOT_WORDS, reportWords, wordExpressionSites, wordPlaces } from './translation.js'
import { validateReport } from './validate.js'
import { walkComponents } from './walk.js'

interface ShapeSeen {
  /** Where an object of this shape was first read, for a message. */
  readonly at: string
  readonly keys: readonly string[]
  readonly held: Set<string>
}

const shapes = vi.hoisted(() => new Map<string, ShapeSeen>())

vi.mock('./check.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('./check.js')>()
  const strictKeys: typeof original.strictKeys = (f, o, path, required, optional = []) => {
    const keys = [...required, ...optional]
    const signature = [...keys].sort().join(' ')
    const seen = shapes.get(signature) ?? { at: path, keys, held: new Set<string>() }
    for (const key of Object.keys(o)) seen.held.add(key)
    shapes.set(signature, seen)
    original.strictKeys(f, o, path, required, optional)
  }
  const shape: typeof original.shape = (f, value, path, required, optional = []) => {
    const o = original.readObject(f, value, path)
    if (o !== undefined) strictKeys(f, o, path, required, optional)
    return o
  }
  return { ...original, strictKeys, shape }
})

/** `richReport` with a translation, a debtor's whole address, a chart's null label, a parameter's text default and a form's binding whole. */
function wholeReport(): ReportDefinition {
  const report = editable(richReport())
  readFromForm(report)
  setAt(report, '/datasets/detail/fields/0/form', { path: 'site', member: 'name', read: 'value', overrides: { ['c'.repeat(64)]: { path: 'place' } } })
  setAt(report, '/datasets/detail/form/overrides', { ['c'.repeat(64)]: { repeater: 'items' } })
  setAt(report, '/datasets/detail/fields/5/form/overrides', { ['d'.repeat(64)]: { omit: true } })
  setAt(report, '/paymentPart/debtor/street', [{ kind: 'text', text: 'Mustergasse' }])
  setAt(report, '/paymentPart/debtor/buildingNumber', [{ kind: 'text', text: '7' }])
  setAt(report, '/datasets/detail/fields/0/nullable', true)
  setAt(report, '/regions/summary/4/category/nullLabel', 'No site')
  setAt(report, '/regions/summary/4/category/format', { kind: 'text', transform: 'upper' })
  setAt(report, '/regions/summary/4/series/0/rounding', { scale: 1, mode: 'half-even', increment: '0.5' })
  setAt(report, '/fonts', {
    sans: { normal: 'brand', bold: 'brand-bold', italic: 'brand', boldItalic: 'brand-bold' },
    serif: { normal: 'brand', bold: 'brand-bold' },
    mono: { normal: 'brand' },
  })
  // An EPC QR code holds a text or a reference, never both.
  setAt(report, '/regions/summary/5', {
    id: 'payment-text',
    kind: 'epcQrCode',
    size: 85.04,
    beneficiary: [{ kind: 'text', text: 'Franz Mustermänn' }],
    iban: [{ kind: 'text', text: 'DE71 1102 2033 0123 4567 89' }],
    text: [{ kind: 'text', text: 'Orders' }],
  })
  // Page 1's own header, which `richReport` leaves out (0060): a region no
  // fixture holds is one whose strings the guard below never reads.
  setAt(report, '/regions/firstPageHeader', [{ id: 'letterhead', kind: 'text', content: [{ kind: 'text', text: 'Orders, by site' }] }])
  // A baseline on each kind of run that takes one, in a paragraph, where
  // alone the format admits one (0061): a key no fixture holds is one
  // whose string the guard below never judges.
  setAt(report, '/regions/body/0/content/0/baseline', 'superscript')
  setAt(report, '/regions/body/0/content/1/baseline', 'subscript')
  setAt(report, '/regions/body/0/content/2/baseline', 'superscript')
  setAt(report, '/regions/pageHeader/0/content/0/baseline', 'subscript')
  setAt(report, '/regions/summary/0/components/1/content/0/baseline', 'superscript')
  // Every component conditioned and styled, as only some of the fixture's are.
  for (const { path } of walkComponents(report as unknown as ReportDefinition)) {
    const component = getAt(report, path) as Record<string, unknown>
    component.visibleWhen ??= { cel: 'params.draft == false' }
    component.style ??= 'body'
    component.styleWhen ??= [{ when: { cel: 'params.draft' }, style: 'small' }]
  }
  setAt(report, '/translations', [
    {
      locale: 'fr-CH',
      words: [{ word: 'Orders by site', text: 'Commandes par site' }],
      expressions: [{ cel: 'header.customer', expression: { cel: 'header.customer' } }],
    },
  ])
  return report as unknown as ReportDefinition
}

/** The fixtures the guard reads: together, every shape the validator accepts, each of its keys held at least once. */
function fixtures(): readonly ReportDefinition[] {
  return [richReport(), eInvoiceReport(), xrechnungReport(), wholeReport()]
}

/** Every string a JSON value holds, by its JSON Pointer. */
function strings(value: unknown, path = '', into: string[] = []): string[] {
  if (typeof value === 'string') into.push(path)
  else if (typeof value === 'object' && value !== null) {
    for (const [key, child] of Object.entries(value)) strings(child, `${path}/${key.replaceAll('~', '~0').replaceAll('/', '~1')}`, into)
  }
  return into
}

/** A JSON Pointer's segments, or a pattern's: what follows each `/`, a pattern's leading `**` among them. */
const segmentsOf = (pointer: string): string[] => (pointer.startsWith('/') ? pointer.slice(1) : pointer).split('/')

/** Whether `segments` match `pattern`'s, `*` one segment and `**` any number of them. */
function matchSegments(pattern: readonly string[], segments: readonly string[]): boolean {
  if (pattern.length === 0) return segments.length === 0
  const [head, ...rest] = pattern
  if (head === '**') return segments.some((_, index) => matchSegments(rest, segments.slice(index))) || matchSegments(rest, [])
  return segments.length > 0 && (head === '*' || head === segments[0]) && matchSegments(rest, segments.slice(1))
}

/** The `NOT_WORDS` pattern `path` matches in `report`, or undefined: an absolute one, or one relative to the innermost component around it. */
function notAWord(report: ReportDefinition, path: string): string | undefined {
  const owner = walkComponents(report)
    .filter((location) => path.startsWith(`${location.path}/`))
    .at(-1)
  for (const { at } of NOT_WORDS) {
    for (const pattern of at) {
      const colon = pattern.indexOf(':')
      if (colon === -1) {
        if (matchSegments(segmentsOf(pattern), segmentsOf(path))) return pattern
        continue
      }
      const kind = pattern.slice(0, colon)
      if (owner === undefined || (kind !== '*' && kind !== owner.component.kind)) continue
      if (matchSegments(segmentsOf(pattern.slice(colon + 1)), segmentsOf(path.slice(owner.path.length)))) return pattern
    }
  }
  return undefined
}

describe('reportWords', () => {
  // Each place is a decision the record lists; a place dropped from the
  // walk would print the report's own word in every language, and one
  // added would ask a translator for what is not the report's word.
  test("yields every literal word of a report, at its place, in document order, and the payment part's message last", () => {
    expect(reportWords(richReport()).map(({ path, text }) => `${path} ${text}`)).toEqual([
      '/title Orders by site',
      '/regions/reportHeader/0/columns/1/components/0/content/0/text Orders for ',
      '/regions/body/0/content/0/text Ordered on ',
      '/regions/body/2/columns/0/header SKU',
      '/regions/body/2/columns/1/header Qty',
      '/regions/body/2/columns/2/header Price',
      '/regions/body/2/columns/3/header Amount',
      '/regions/body/2/columns/4/header Shipped',
      '/regions/body/2/group/header/0/text Site ',
      '/regions/body/2/group/footer/0/cells/0/value/text Subtotal',
      '/regions/body/2/totals/0/cells/0/value/text Total',
      '/regions/body/2/totals/1/cells/0/value/text Total incl. VAT',
      '/regions/body/2/emptyText No order lines.',
      '/regions/body/3/components/1/content/0/text Thank you.',
      '/regions/pageFooter/0/content/0/text Page ',
      '/regions/pageFooter/0/content/2/text  of ',
      '/regions/summary/0/components/1/content/1/text  per line, due from ',
      '/regions/summary/0/components/1/content/3/text , last shipped ',
      '/regions/summary/4/series/0/label Amount',
      '/regions/summary/4/series/1/label Lines',
      '/regions/summary/4/emptyText No order lines.',
      '/regions/summary/4/title Amount by site',
      '/regions/summary/4/categoryTitle Site',
      '/regions/summary/4/valueTitle CHF',
      '/paymentPart/message/0/text Order from ',
    ])
  })

  // Page 1's own header prints in the page header's place (0060), so its
  // words are the report's own: a walk that skipped it would print page
  // 1's letterhead in the report's own language in every other.
  test("yields the words of page 1's own header, between the report header's and the body's", () => {
    const report = editable(richReport())
    setAt(report, '/regions/firstPageHeader', [{ id: 'letterhead', kind: 'text', content: [{ kind: 'text', text: 'Orders, by site' }] }])
    expect(
      reportWords(report as unknown as ReportDefinition)
        .slice(1, 4)
        .map(({ path, text, componentId }) => `${path} ${text} ${componentId}`),
    ).toEqual([
      '/regions/reportHeader/0/columns/1/components/0/content/0/text Orders for  title',
      '/regions/firstPageHeader/0/content/0/text Orders, by site letterhead',
      '/regions/body/0/content/0/text Ordered on  intro',
    ])
  })

  // A word is found again by its component and its column: what the
  // editor marks missing, and where.
  test('names the component and the column each word stands in', () => {
    const words = reportWords(richReport())
    expect(words.find(({ path }) => path === '/regions/body/2/columns/1/header')).toEqual({
      path: '/regions/body/2/columns/1/header',
      text: 'Qty',
      componentId: 'lines',
      columnId: 'qty',
    })
    expect(words.find(({ path }) => path === '/title')).toEqual({ path: '/title', text: 'Orders by site' })
    expect(words.find(({ path }) => path === '/regions/summary/4/emptyText')?.componentId).toBe('site-chart')
  })

  // A table without a group or totals rows has no words there: the walk
  // reads what a table holds, and asks nothing of what it does not.
  test("finds a table's words where it has them, and none of a group or totals it lacks", () => {
    const report = editable(richReport())
    const table = getAt(report, '/regions/body/2') as Record<string, unknown>
    delete table.group
    delete table.totals
    const words = reportWords(report as unknown as ReportDefinition).map(({ path }) => path)
    expect(words.filter((path) => path.startsWith('/regions/body/2/'))).toEqual([
      '/regions/body/2/columns/0/header',
      '/regions/body/2/columns/1/header',
      '/regions/body/2/columns/2/header',
      '/regions/body/2/columns/3/header',
      '/regions/body/2/columns/4/header',
      '/regions/body/2/emptyText',
    ])
  })

  // A separator, a number or a sign prints as written in every language;
  // asking for its translation would ask a translator to copy it.
  test('passes a literal with no letter by, which prints as written in every language', () => {
    const report = editable(richReport())
    setAt(report, '/regions/pageFooter/0/content/2/text', ' / ')
    setAt(report, '/regions/body/2/columns/1/header', '#')
    const words = reportWords(report as unknown as ReportDefinition).map(({ path }) => path)
    expect(words).not.toContain('/regions/pageFooter/0/content/2/text')
    expect(words).not.toContain('/regions/body/2/columns/1/header')
    expect(wordPlaces(report as unknown as ReportDefinition).literals.map(({ path }) => path)).toContain('/regions/pageFooter/0/content/2/text')
  })
})

describe('isWord', () => {
  // A letter of any script makes a word; a sign, a digit or a space alone
  // does not, so "12.50 –" is never sent to a translator.
  test('is a text that holds a letter, of any script', () => {
    expect(['Total', 'Σ', 'Итого', '°C', 'x'].map(isWord)).toEqual([true, true, true, true, true])
    expect(['', ' ', '12.50', ' – ', '/', '%', '€'].map(isWord)).toEqual([false, false, false, false, false, false, false])
  })
})

describe('wordExpressionSites', () => {
  // An expression run where a word stands is what the core judges to be a
  // word or not; one outside those places -- a condition, a QR code's
  // content, an aggregate's -- is never a word, whatever it prints.
  test('yields the expression runs that stand where words do, and none elsewhere', () => {
    expect(wordExpressionSites(richReport()).map(({ path, cel }) => `${path} ${cel}`)).toEqual([
      '/regions/body/0/content/2/expression/cel header.customer',
      '/regions/body/2/columns/3/value/expression/cel round(dec(row.quantity) * dec(row.unit_price), 2)',
      '/regions/body/2/totals/1/cells/1/value/expression/cel totals.gross',
    ])
    expect(wordExpressionSites(richReport())[1]).toMatchObject({ componentId: 'lines', columnId: 'amount' })
  })
})

describe('the guard: every string is a word or named as none', () => {
  // The guard reads only what its fixtures hold; a fixture that was not a
  // valid report would hold strings no report could.
  test('reads fixtures the validator accepts', () => {
    for (const report of fixtures()) expect(validateReport(report).valid ? [] : (validateReport(report) as { errors: unknown }).errors).toEqual([])
  })

  // An optional key no fixture holds is a string the guard below could not
  // see: a property added to the format without a decision would pass.
  test('reads fixtures that hold every key of every shape the validator accepts', () => {
    shapes.clear()
    for (const report of fixtures()) validateReport(report)
    const unheld = [...shapes.values()].flatMap(({ at, keys, held }) => keys.filter((key) => !held.has(key)).map((key) => `${at}: ${key}`))
    expect(unheld).toEqual([])
  })

  // The decision for each string is one of two: a word, translated in each
  // language, or named in NOT_WORDS, printed as written in every language.
  // Neither is a string no one decided about; both is a contradiction.
  test('finds each string a word place or named in NOT_WORDS, and never both', () => {
    const undecided: string[] = []
    const both: string[] = []
    for (const report of fixtures()) {
      const places = wordPlaces(report)
      const words = new Set([...places.literals.map(({ path }) => path), ...places.expressions.map(({ path }) => path)])
      for (const path of strings(report)) {
        const named = notAWord(report, path)
        if (words.has(path) && named !== undefined) both.push(`${path} (${named})`)
        if (!words.has(path) && named === undefined) undecided.push(`${path} ${JSON.stringify(getAt(report, path))}`)
      }
    }
    expect({ undecided, both }).toEqual({ undecided: [], both: [] })
  })
})
