import { SITE_VISIT_REPORT, SITE_VISIT_SUBMISSION_V1, SITE_VISIT_V1 } from '@formancy/report-corpus'
import { MAX_DETAIL_ROWS, MAX_STRING_LENGTH } from '@formancy/report-runtime'
import { MAX_FORM_PATH_KEYS } from '@formancy/report-spec'
import { describe, expect, test, vi } from 'vitest'
import { MAX_FORMS_ERRORS } from './errors.js'
import { MAX_DOCUMENT_DEPTH } from './json.js'
import { answers, field, formOf, headerOf, read, readOne, refusals, reportOf, rowsOf, SUBMISSION } from './test-support.js'

/** How often formancy's rich text parser ran: the bridge's own call to it, counted, and otherwise formancy's. */
const plain = vi.hoisted(() => ({ calls: 0 }))
vi.mock('@formancy/spec', async (original) => {
  const spec = await original<typeof import('@formancy/spec')>()
  return {
    ...spec,
    richTextToPlain: (source: string): string => {
      plain.calls += 1
      return spec.richTextToPlain(source)
    },
  }
})

/**
 * A form and a submission are untrusted, even from the host's own store
 * (CLAUDE.md, 0042): read once, through property descriptors, own members
 * only, a getter refused and never run, bounded and refused rather than cut
 * short, and walked by the form's model, never by the data's keys. No
 * message and no path holds a value.
 */

const report = reportOf({ header: answers(field('site', 'string', 'site'), field('notes', 'string', 'notes')) })
const form = formOf([
  { key: 'site', type: 'text', label: 'Site' },
  { key: 'notes', type: 'textarea' },
])

/** `target` with a getter at `key` that counts its calls and answers `value`. */
function withGetter(target: Record<string, unknown>, key: string, value: unknown): { readonly object: Record<string, unknown>; readonly calls: () => number } {
  let calls = 0
  Object.defineProperty(target, key, {
    enumerable: true,
    get: () => {
      calls += 1
      return value
    },
  })
  return { object: target, calls: () => calls }
}

describe('a form and a submission are read as data', () => {
  // A getter could answer one thing to the validator and another to the
  // reader, or do anything at all when it runs: it is refused where it
  // stands, in the form or in the submission, and never called.
  test('refuses a getter in a form or a submission, and never runs it', () => {
    const label = withGetter({ key: 'site', type: 'text' }, 'label', 'Site')
    expect(refusals(read(report, formOf([label.object, { key: 'notes', type: 'textarea' }]), {}))).toEqual(['not-data /form/model/fields/0/label'])
    const answer = withGetter({}, 'site', 'Bern')
    expect(refusals(read(report, form, answer.object))).toEqual(['not-data /submission/data/site'])
    const row = withGetter({ _id: 'r1' }, 'ref', 'F-01')
    const rows = reportOf({ detail: rowsOf('findings', field('ref', 'string', 'ref')) })
    expect(refusals(read(rows, formOf([{ key: 'findings', type: 'repeater', fields: [{ key: 'ref', type: 'text' }] }]), { findings: [row.object] }))).toEqual([
      'not-data /submission/data/findings/0/ref',
    ])
    const input = withGetter({ submission: { id: SUBMISSION, data: {} } }, 'form', form)
    expect(refusals(readOne(report, input.object))).toEqual(['not-data /form'])
    expect([label.calls(), answer.calls(), row.calls(), input.calls()]).toEqual([0, 0, 0, 0])
  })

  // JSON holds none of these, and each would be read as something it is
  // not: a Date where a date's string belongs, a symbol-keyed or hidden
  // property, a hole, a number that is not finite, a proxy that throws.
  test('refuses what JSON cannot hold, where it stands', () => {
    const hidden = Object.defineProperty({ key: 'site', type: 'text' }, 'label', { value: 'Site', enumerable: false })
    const throwing = new Proxy(
      {},
      {
        ownKeys: () => {
          throw new Error('no')
        },
      },
    )
    const cases: [unknown, unknown, string][] = [
      [formOf([hidden, { key: 'notes', type: 'textarea' }]), {}, 'not-data /form/model/fields/0/label'],
      [
        formOf([
          { key: 'site', type: 'text', label: () => 'Site' },
          { key: 'notes', type: 'textarea' },
        ]),
        {},
        'not-data /form/model/fields/0/label',
      ],
      [
        formOf([
          { key: 'site', type: 'text', [Symbol('x')]: 1 },
          { key: 'notes', type: 'textarea' },
        ]),
        {},
        'not-data /form/model/fields/0',
      ],
      // eslint-disable-next-line no-sparse-arrays
      [formOf([, { key: 'notes', type: 'textarea' }]), {}, 'not-data /form/model/fields/0'],
      [
        formOf([
          { key: 'site', type: 'text', minLength: Number.NaN },
          { key: 'notes', type: 'textarea' },
        ]),
        {},
        'not-data /form/model/fields/0/minLength',
      ],
      [throwing, {}, 'not-data /form'],
      [
        formOf(
          new Proxy([], {
            getOwnPropertyDescriptor: () => {
              throw new Error('no')
            },
          }),
        ),
        {},
        'not-data /form/model/fields',
      ],
      [form, { site: new Date(0) }, 'not-data /submission/data/site'],
      [form, throwing, 'not-data /submission/data'],
      [form, { site: 'Bern', notes: Number.POSITIVE_INFINITY }, 'not-data /submission/data/notes'],
    ]
    for (const [given, data, refusal] of cases) expect(refusals(read(report, given, data)), refusal).toEqual([refusal])
  })

  // An own __proto__, which JSON.parse makes, replaces an object's
  // prototype when it is assigned: formancy refuses it as a key and stores
  // nothing under it (formancy.ai 0185). In a form it is no data; in a
  // submission it is an answer under a key the version has no field for.
  // Neither ever reaches Object.prototype.
  test('refuses an own __proto__, and pollutes nothing', () => {
    const polluted = JSON.parse(
      '{"specVersion":"4","id":"site-visit","title":"Site visit","model":{"fields":[{"key":"site","type":"text","__proto__":{"polluted":true}},{"key":"notes","type":"textarea"}]}}',
    ) as unknown
    expect(refusals(read(report, polluted, {}))).toEqual(['not-data /form/model/fields/0'])
    const answer = JSON.parse('{"site":"Bern","__proto__":{"polluted":true}}') as unknown
    expect(refusals(read(report, form, answer))).toEqual(['unknown-answer /submission/data/__proto__'])
    expect(({} as Record<string, unknown>)['polluted']).toBeUndefined()
  })

  // `constructor` and `toString` are keys an author may choose, and every
  // object inherits a value under them: read through inheritance, an
  // unanswered one would print `function Object` (formancy.ai 0185). An
  // answer is the submission's own member, or null.
  test('reads an answer as the submission’s own member, so a field keyed constructor is null when unanswered', () => {
    const inherited = formOf([
      { key: 'constructor', type: 'text' },
      { key: 'toString', type: 'number' },
      { key: 'valueOf', type: 'select', options: [{ value: 'a', label: 'A' }] },
    ])
    const keyed = reportOf({
      header: answers(field('constructor', 'string', 'constructor'), field('toString', 'integer', 'toString'), field('valueOf', 'string', 'valueOf')),
    })
    expect(headerOf(read(keyed, inherited, {}))).toEqual({ constructor: null, toString: null, valueOf: null })
    const read2 = headerOf(read(keyed, inherited, { constructor: 'Bern', toString: 3, valueOf: 'a' }))
    expect([read2['constructor'], read2['toString'], read2['valueOf']]).toEqual(['Bern', '3', 'A'])
    expect(Object.getPrototypeOf(read2)).toBe(Object.prototype)
    // A matrix's answer is a map from row to column, and a row may be called constructor too.
    const matrix = formOf([
      {
        key: 'rating',
        type: 'matrix',
        rows: [
          { value: 'constructor', label: 'Build' },
          { value: 'toString', label: 'Text' },
        ],
        options: [
          { value: 'good', label: 'Good' },
          { value: 'poor', label: 'Poor' },
        ],
      },
    ])
    const rows = reportOf({
      header: answers(field('built', 'string', 'rating', { member: 'constructor' }), field('text', 'string', 'rating', { member: 'toString' })),
    })
    expect(headerOf(read(rows, matrix, { rating: {} }))).toEqual({ built: null, text: null })
    expect(headerOf(read(rows, matrix, { rating: { constructor: 'good' } }))).toEqual({ built: 'Good', text: null })
  })

  // A repeater's rows are bounded by the most a render reads, and a list
  // past it is refused before any row is read -- by its length, read once,
  // so a list that answers one length to the bound and another to the loop
  // cannot pass.
  test('refuses a repeater of more rows than a render reads, before reading a row', () => {
    const rows = reportOf({ detail: rowsOf('findings', field('ref', 'string', 'ref')) })
    const repeater = formOf([{ key: 'findings', type: 'repeater', fields: [{ key: 'ref', type: 'text' }] }])
    let touched = 0
    const many = new Proxy([] as unknown[], {
      getOwnPropertyDescriptor: (target, key) => {
        if (key === 'length') return { value: MAX_DETAIL_ROWS + 1, writable: true, enumerable: false, configurable: false }
        touched += 1
        return Reflect.getOwnPropertyDescriptor(target, key)
      },
    })
    expect(refusals(read(rows, repeater, { findings: many }))).toEqual(['too-many-rows /submission/data/findings'])
    expect(touched).toBe(0)
    const lying = new Proxy([] as unknown[], {
      getOwnPropertyDescriptor: (target, key) =>
        key === 'length'
          ? { value: Number.POSITIVE_INFINITY, writable: true, enumerable: false, configurable: false }
          : Reflect.getOwnPropertyDescriptor(target, key),
    })
    expect(refusals(read(rows, repeater, { findings: lying }))).toEqual(['not-data /submission/data/findings'])
    expect(refusals(read(rows, repeater, { findings: [null] }))).toEqual(['invalid-answer /submission/data/findings/0'])
    // In a repeater the report does not read too: the submission is walked whole, and a row is refused where it stands.
    const header = reportOf({ header: answers(field('site', 'string', 'site')) })
    const both = formOf([
      { key: 'site', type: 'text' },
      { key: 'findings', type: 'repeater', fields: [{ key: 'ref', type: 'text' }] },
    ])
    expect(refusals(read(header, both, { site: 'Bern', findings: [{ _id: 'r1', ref: 'F-01' }, null] }))).toEqual(['invalid-answer /submission/data/findings/1'])
  })

  // A row is read as a list item JSON could hold, where it stands: a hole
  // would otherwise be read as a row that is missing, and a getter in a
  // row's place run to find out what the row is.
  test('refuses a hole or a getter in a repeater’s rows where it stands, and never runs the getter', () => {
    const rows = reportOf({ detail: rowsOf('findings', field('ref', 'string', 'ref')) })
    const repeater = formOf([{ key: 'findings', type: 'repeater', fields: [{ key: 'ref', type: 'text' }] }])
    // eslint-disable-next-line no-sparse-arrays
    expect(refusals(read(rows, repeater, { findings: [, { _id: 'r2', ref: 'F-02' }] }))).toEqual(['not-data /submission/data/findings/0'])
    let calls = 0
    const getter = Object.defineProperty([] as unknown[], 0, {
      enumerable: true,
      get: () => {
        calls += 1
        return { _id: 'r1', ref: 'F-01' }
      },
    })
    expect(refusals(read(rows, repeater, { findings: getter }))).toEqual(['not-data /submission/data/findings/0'])
    expect(calls).toBe(0)
  })

  // Nested past any form a person fills in, a document would be walked
  // as deep as it goes: refused at the bound instead, so no stack is
  // spent on it.
  test('refuses a form nested deeper than MAX_DOCUMENT_DEPTH', () => {
    let deep: unknown = 'Site'
    for (let level = 0; level < MAX_DOCUMENT_DEPTH + 1; level += 1) deep = { x: deep }
    const outcome = read(
      report,
      formOf([
        { key: 'site', type: 'text', label: deep },
        { key: 'notes', type: 'textarea' },
      ]),
      {},
    )
    expect(refusals(outcome).map((refusal) => refusal.split(' ')[0])).toEqual(['not-data'])
  })

  // A report reads a path of up to MAX_FORM_PATH_KEYS keys, so a form of
  // that many fields in groups in groups is one the bridge reads whole: a
  // depth bound below what that form's JSON nests would refuse every form
  // whose deepest field a report can bind.
  test('reads a field MAX_FORM_PATH_KEYS keys deep, at a path of that many keys', () => {
    const keys = Array.from({ length: MAX_FORM_PATH_KEYS - 1 }, (_, index) => `g${index + 1}`)
    let fields: unknown[] = [{ key: 'leaf', type: 'text', label: 'Leaf' }]
    let answer: unknown = { leaf: 'Bern' }
    for (const key of [...keys].reverse()) {
      fields = [{ key, type: 'group', label: key, fields }]
      answer = { [key]: answer }
    }
    const deepest = reportOf({ header: answers(field('leaf', 'string', [...keys, 'leaf'].join('.'))) })
    expect(headerOf(read(deepest, formOf(fields), answer))).toEqual({ leaf: 'Bern' })
  })

  // Errors are bounded as report-spec bounds a report's, and a list cut
  // short says so: a host that saw exactly MAX_FORMS_ERRORS could not
  // otherwise tell it had them all. Once it is full, nothing more is read.
  test('lists at most MAX_FORMS_ERRORS errors, and says when there were more', () => {
    const unknown = Object.fromEntries(Array.from({ length: MAX_FORMS_ERRORS + 5 }, (_, index) => [`k${index}`, 'x']))
    const found = refusals(read(report, form, unknown))
    expect(found).toHaveLength(MAX_FORMS_ERRORS + 1)
    expect([found[0], found.at(-1)]).toEqual(['unknown-answer /submission/data/k0', 'too-many-errors '])
  })

  // An answer is the customer's: no refusal says one, in its message or
  // its path, nor a key that is no field key, which may be the answer
  // itself. What is said is the field, the path the version gives it, and
  // why.
  test('never says an answer, in a message or a path', () => {
    const name = 'Erika Mustermann'
    const findings = (SITE_VISIT_SUBMISSION_V1.data['findings'] as readonly Record<string, unknown>[]).map((row) => ({
      ...row,
      area: 7,
      hours: name,
      parts: 2.5,
      severity: name,
    }))
    const data = {
      ...SITE_VISIT_SUBMISSION_V1.data,
      site: { name },
      visitedOn: name,
      outcome: name,
      checks: [name],
      condition: { safety: name },
      findings,
      [name]: name,
      inspector: { name, [name]: 1 },
    }
    const outcome = readOne(SITE_VISIT_REPORT, { form: SITE_VISIT_V1, submission: { id: SUBMISSION, data } })
    if (outcome.ok) throw new Error('read')
    expect(outcome.errors.length).toBeGreaterThan(10)
    expect(JSON.stringify(outcome.errors)).not.toMatch(/Erika|Mustermann|2\.5/)
  })

  // A key inside an answer is the answer's, as its value is: a matrix's
  // row past the version's, the keys of an object a text holds. A refusal
  // of what an answer holds stands at the field's own path and names none
  // of it, however deep or however long what it holds.
  test('refuses what an answer holds at the field’s own path, naming nothing in it', () => {
    const matrix = formOf([
      {
        key: 'm',
        type: 'matrix',
        rows: [{ value: 'x', label: 'X' }],
        options: [
          { value: 'a', label: 'A' },
          { value: 'b', label: 'B' },
        ],
      },
    ])
    const listed = read(reportOf({ header: answers(field('m', 'string', 'm', { member: 'x' })) }), matrix, {
      m: { x: 'a', anna_schaer_756_1234: Array.from({ length: MAX_DETAIL_ROWS + 1 }, () => 0) },
    })
    expect(refusals(listed)).toEqual(['not-data /submission/data/m'])
    let deep: unknown = 'leaf'
    for (let level = 0; level < MAX_DOCUMENT_DEPTH + 6; level += 1) deep = { [`born_1970_${level}`]: deep }
    const nested = read(report, form, { site: deep })
    expect(refusals(nested)).toEqual(['not-data /submission/data/site'])
    const got = read(report, form, { site: { anna_schaer: withGetter({}, 'born_1970', 'x').object } })
    expect(refusals(got)).toEqual(['not-data /submission/data/site'])
    // eslint-disable-next-line no-sparse-arrays
    expect(refusals(read(report, form, { site: ['Bern', , 'Thun'] }))).toEqual(['not-data /submission/data/site'])
    for (const outcome of [listed, nested, got]) if (!outcome.ok) expect(JSON.stringify(outcome.errors)).not.toMatch(/anna|born/)
  })

  // formancy's rich text parser takes time that grows faster than its
  // input, so a hostile answer of brackets would stall a read before the
  // length bound was reached. Every string answer is held to the most a
  // value may have before it is turned into one, and a rich text before it
  // is parsed: refused, never parsed and then cut short.
  test('refuses a string answer longer than a value may be before it is read, a rich text before it is parsed', () => {
    const rich = formOf([
      { key: 'notes', type: 'richtext' },
      { key: 'site', type: 'text' },
    ])
    const both = reportOf({ header: answers(field('notes', 'string', 'notes'), field('site', 'string', 'site')) })
    plain.calls = 0
    expect(refusals(read(both, rich, { notes: '['.repeat(MAX_STRING_LENGTH + 1), site: 'x'.repeat(MAX_STRING_LENGTH + 1) }))).toEqual([
      'invalid-answer /submission/data/notes',
      'invalid-answer /submission/data/site',
    ])
    expect(plain.calls).toBe(0)
    expect(headerOf(read(both, rich, { notes: 'a'.repeat(MAX_STRING_LENGTH) }))['notes']).toHaveLength(MAX_STRING_LENGTH)
    expect(plain.calls).toBe(1)
  })

  // A report may call a field `__proto__`. Assigned into the record, it
  // would set the record's prototype and the field would vanish from the
  // data; defined, it is the record's own member and is handed over.
  test('hands a field called __proto__ over as the record’s own member', () => {
    const keyed = reportOf({ header: answers(field('__proto__', 'string', 'site')) })
    const header = headerOf(read(keyed, form, { site: 'Bern' }))
    expect(Object.getOwnPropertyDescriptor(header, '__proto__')?.value).toBe('Bern')
    expect(Object.getPrototypeOf(header)).toBe(Object.prototype)
  })
})
