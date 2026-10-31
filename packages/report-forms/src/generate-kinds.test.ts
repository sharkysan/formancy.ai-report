import {
  MAX_DATASET_FIELDS,
  MAX_FORM_PATH_KEYS,
  MAX_LABEL_LENGTH,
  MAX_NESTING_DEPTH,
  MAX_REGION_COMPONENTS,
  MAX_TEXT_LENGTH,
  walkComponents,
} from '@formancy/report-spec'
import type { FieldContract, ReportDefinition } from '@formancy/report-spec'
import { datagridColumns, FIELD_TYPES as FORM_KINDS } from '@formancy/spec'
import type { FieldDef } from '@formancy/spec'
import fc from 'fast-check'
import { describe, expect, test } from 'vitest'
import { gridOrder } from './generate-walk.js'
import { formOf, generate, generatedFrom, generationRefusals, notesOf } from './test-support.js'

/**
 * What each part of a form becomes in the report generated from it (0045):
 * every kind formancy has either declared and printed or listed as left
 * out; a group a section, a page nothing, one repeater the table and the
 * others listed; each field nullable unless the version proves it always
 * there; and a form the format cannot hold refused, never cut short or
 * renamed to fit.
 */

const option = (value: string, label = value) => ({ value, label })

/** The fields `report` declares, as id, type, nullability and where each is read. */
const declared = (fields: readonly FieldContract[] | undefined): string[] =>
  (fields ?? []).map(
    (field) =>
      `${field.id} ${field.type}${field.scale === undefined ? '' : `(${field.scale})`}${field.nullable ? '?' : ''} ${field.form?.path ?? ''}${field.form?.member === undefined ? '' : `#${field.form.member}`}${field.form?.read === undefined ? '' : ` ${field.form.read}`}`,
  )

/** The notes as their codes and places, but that a field is labelled by its key, which most of these forms' fields are. */
const said = (notes: Parameters<typeof notesOf>[0]): string[] => notesOf(notes).filter((note) => !note.startsWith('unlabelled '))

/** Every component of `report`'s regions, as its kind. */
const kinds = (report: ReportDefinition): string[] => walkComponents(report).map(({ component }) => component.kind)

/** What each text component of `report`'s body prints, anywhere in it: its literal runs, a field's value as `{field}`. */
const lines = (report: ReportDefinition): string[] =>
  walkComponents(report)
    .filter(({ region }) => region === 'body')
    .flatMap(({ component }) =>
      component.kind === 'text' ? [component.content.map((run) => (run.kind === 'text' ? run.text : `{${run.kind}}`)).join('')] : [],
    )

/** One field of each kind formancy has, a container holding a text, at spec 4; and ticked boxes that offer nothing, which formancy accepts. */
function everyKind(): unknown[] {
  const each = FORM_KINDS.map((kind) => {
    const key = `k_${kind}`
    switch (kind) {
      case 'group':
      case 'page':
      case 'repeater':
        return { key, type: kind, fields: [{ key: `${key}_text`, type: 'text' }] }
      case 'select':
      case 'radio':
      case 'selectboxes':
      case 'ranking':
        return { key, type: kind, options: [option('a'), option('b')] }
      case 'matrix':
        return { key, type: kind, rows: [option('r')], options: [option('a'), option('b')] }
      case 'static':
        return { key, type: kind, label: 'Read me' }
      default:
        return { key, type: kind }
    }
  })
  return [...each, { key: 'k_selectboxes_empty', type: 'selectboxes' }]
}

describe('every kind of the mapping', () => {
  // A kind the generator neither declared nor listed would vanish from the
  // draft unsaid. Each kind the pinned formancy has, standing in a page, is
  // either read by a field the report declares -- at its path, a group's
  // through its child, a repeater as the table's rows -- or listed as left
  // out at its place in the form; the kinds are formancy's own list, so a
  // kind added upstream fails here until it is placed or listed. Ticked
  // boxes that offer no option, which formancy accepts, declare nothing,
  // and would vanish with a note that they print as boxes.
  test('is declared at its path or listed as left out, whatever formancy adds', () => {
    const fields = everyKind()
    const page = fields.find((field) => (field as { type: string }).type === 'page') as { key: string; fields: unknown[] }
    const others = fields.filter((field) => field !== page) as { key: string; type: string }[]
    const form = formOf([{ ...page, fields: [...page.fields, ...others] }])
    const { report, notes } = generatedFrom(generate(form, { id: 'every', locale: 'en', detail: { kind: 'repeater', repeater: 'k_repeater' } }))
    const read = new Set([...(report.datasets.header?.fields ?? []), ...(report.datasets.detail?.fields ?? [])].map((field) => field.form?.path.split('.')[0]))
    const left = new Set(notes.filter((note) => note.code.endsWith('-excluded')).map((note) => note.path))
    const placed = others.map(({ key, type }, index) => {
      const what = key === 'k_selectboxes_empty' ? 'selectboxes of nothing' : type
      if (type === 'repeater')
        return `${what}: ${report.datasets.detail?.form?.kind === 'repeater' && report.datasets.detail.form.repeater === key ? 'the table' : 'lost'}`
      if (read.has(key)) return `${what}: read`
      return `${what}: ${left.has(`/form/model/fields/0/fields/${index + 1}`) ? 'left out' : 'lost'}`
    })
    expect(placed.filter((each) => each.endsWith('lost'))).toEqual([])
    expect(placed.filter((each) => each.endsWith('left out')).sort()).toEqual([
      'file: left out',
      'ranking: left out',
      'selectboxes of nothing: left out',
      'signature: left out',
      'static: left out',
    ])
    // The page's own field is read, and the page made nothing but a note.
    expect(read.has(`${page.key}_text`)).toBe(true)
    expect(said(notes).filter((note) => note.startsWith('pages'))).toEqual(['pages-not-breaks /form/model/fields/0'])
    // Ticked boxes of nothing are said to be left out, and nothing says they print as boxes.
    const empty = `/form/model/fields/0/fields/${others.findIndex(({ key }) => key === 'k_selectboxes_empty') + 1}`
    expect(notesOf(notes).filter((note) => note.endsWith(` ${empty}`))).toEqual([`unsupported-excluded ${empty}`])
  })

  // What the mapping does not print in this release is listed with why,
  // and so is what holds no answer: a draft that dropped them unsaid would
  // look like the whole form.
  test('lists a static text, a file, a signature, a ranking and ticked boxes of a resolved source or of none as left out', () => {
    const form = formOf([
      { key: 'intro', type: 'static', label: 'Read me' },
      { key: 'photo', type: 'file' },
      { key: 'sign', type: 'signature' },
      { key: 'order', type: 'ranking', options: [option('a'), option('b')] },
      { key: 'tags', type: 'selectboxes', optionsSource: 'tags' },
      { key: 'none', type: 'selectboxes' },
      { key: 'site', type: 'text' },
    ])
    const { report, notes } = generatedFrom(generate(form, { id: 'r', locale: 'en' }))
    expect(declared(report.datasets.header?.fields)).toEqual(['site string? site'])
    expect(said(notes)).toEqual([0, 1, 2, 3, 4, 5].map((index) => `${index === 0 ? 'static' : 'unsupported'}-excluded /form/model/fields/${index}`))
  })

  // A hidden field holds what the host or a rule set, which the person
  // filling in the form never saw: printed as an answer unsaid, a reader
  // would take it for one the person gave.
  test('prints a hidden field, and says the person filling in the form never saw it', () => {
    const { report, notes } = generatedFrom(generate(formOf([{ key: 'source', type: 'hidden' }]), { id: 'r', locale: 'en' }))
    expect(declared(report.datasets.header?.fields)).toEqual(['source string? source'])
    expect(said(notes)).toEqual(['hidden-printed /form/model/fields/0'])
  })
})

describe('groups, pages and repeaters', () => {
  // A group nested past the format's depth that was refused would cost the
  // person the draft, and one dropped would lose its fields unsaid: it
  // prints its heading and lines in the section around it, said, and a
  // shallower one is a section of its own, so the draft keeps the form's
  // grouping where the format can hold it.
  test('makes a group a section, nested as deep as the format nests, and flattens a deeper one, said', () => {
    const depth = MAX_NESTING_DEPTH + 2
    let fields: unknown[] = [{ key: 'leaf', type: 'text' }]
    for (let level = depth; level >= 1; level -= 1)
      fields = [{ key: `g${level}`, type: 'group', label: `G${level}`, fields: [{ key: `t${level}`, type: 'text' }, ...fields] }]
    const { report, notes } = generatedFrom(generate(formOf(fields), { id: 'r', locale: 'en' }))
    const sections = walkComponents(report).filter(({ component }) => component.kind === 'section')
    expect(sections.map(({ depth: d }) => d)).toEqual([0, 1, 2, 3])
    expect(
      walkComponents(report)
        .filter(({ component }) => component.kind === 'text' && component.style === 'heading')
        .map(({ depth: d }) => d),
    ).toEqual([1, 2, 3, 4, 4, 4])
    expect(said(notes)).toEqual([
      'group-flattened /form/model/fields/0/fields/1/fields/1/fields/1/fields/1',
      'group-flattened /form/model/fields/0/fields/1/fields/1/fields/1/fields/1/fields/1',
    ])
    expect(declared(report.datasets.header?.fields).at(-1)).toBe(`leaf string? ${Array.from({ length: depth }, (_, index) => `g${index + 1}`).join('.')}.leaf`)
  })

  // A page made a page break would leave each printed page half empty
  // (plan 12.2), and a page made a section would group what the form
  // only steps through: its fields print where they stand, said once.
  test('looks through pages, and makes no page break of one', () => {
    const form = formOf([
      { key: 'p1', type: 'page', fields: [{ key: 'a', type: 'text' }] },
      { key: 'p2', type: 'page', fields: [{ key: 'b', type: 'text' }] },
    ])
    const { report, notes } = generatedFrom(generate(form, { id: 'r', locale: 'en' }))
    expect(declared(report.datasets.header?.fields)).toEqual(['a string? a', 'b string? b'])
    expect(kinds(report)).not.toContain('pageBreak')
    expect(said(notes)).toEqual(['pages-not-breaks /form/model/fields/0'])
  })

  // A report of version 0 has one detail table: a draft that read a
  // second repeater would be refused, and one that dropped it unsaid would
  // lose its rows. The table stands where the repeater does, in its
  // group's section; its rows' groups are looked through for columns and
  // a row's matrix is a column a row, so no answer of a row is lost.
  test('makes the repeater asked for the table, where it stands, and lists the others', () => {
    const form = formOf([
      { key: 'site', type: 'text' },
      { key: 'parts', type: 'repeater', fields: [{ key: 'part', type: 'text' }] },
      {
        key: 'work',
        type: 'group',
        fields: [
          {
            key: 'items',
            type: 'repeater',
            fields: [
              { key: 'ref', type: 'text' },
              { key: 'at', type: 'group', fields: [{ key: 'room', type: 'text' }] },
              { key: 'state', type: 'matrix', rows: [option('wall', 'Wall')], options: [option('ok', 'OK'), option('bad', 'Bad')] },
            ],
          },
        ],
      },
      { key: 'photos', type: 'repeater', fields: [{ key: 'caption', type: 'text' }] },
    ])
    const { report, notes } = generatedFrom(generate(form, { id: 'r', locale: 'en', detail: { kind: 'repeater', repeater: 'work.items' } }))
    expect(report.datasets.detail?.form).toEqual({ kind: 'repeater', repeater: 'work.items' })
    expect(declared(report.datasets.detail?.fields)).toEqual(['ref string? ref', 'room string? at.room', 'state_wall string? state#wall'])
    const table = walkComponents(report).find(({ component }) => component.kind === 'table')
    expect([table?.depth, table?.component.kind === 'table' ? table.component.columns.map((column) => column.header) : []]).toEqual([
      1,
      ['ref', 'room', 'state: Wall'],
    ])
    expect(said(notes)).toEqual(['repeater-excluded /form/model/fields/1', 'repeater-excluded /form/model/fields/3'])
  })

  // A grid's columns in model order would print a table its form never
  // showed, and its own shorter headings lost: configured first, the rest
  // after, as formancy's datagridColumns orders them, under the grid's
  // heading where it gives one; and under the field's own label, not its
  // key, where the grid's heading is a message no catalogue holds, said of
  // nothing, since the field is labelled.
  test('orders a grid’s columns as formancy does, under the grid’s headings or the field’s own label', () => {
    const form = formOf(
      [
        {
          key: 'items',
          type: 'repeater',
          widget: 'datagrid',
          columns: [
            { field: 'qty', header: 'Qty' },
            { field: 'ref', header: { $t: 'nowhere' } },
          ],
          fields: [
            { key: 'ref', type: 'text', label: 'Reference' },
            { key: 'note', type: 'text', label: 'Note' },
            { key: 'qty', type: 'number', label: 'Quantity', step: 1 },
          ],
        },
      ],
      { i18n: { defaultLocale: 'en', messages: { en: {} } } },
    )
    const { report, notes } = generatedFrom(generate(form, { id: 'r', locale: 'en', detail: { kind: 'repeater', repeater: 'items' } }))
    const table = walkComponents(report).find(({ component }) => component.kind === 'table')?.component
    expect(table?.kind === 'table' ? table.columns.map((column) => column.header) : []).toEqual(['Qty', 'Reference', 'Note'])
    expect(declared(report.datasets.detail?.fields)).toEqual(['qty integer? qty', 'ref string? ref', 'note string? note'])
    expect(notesOf(notes).filter((note) => note.startsWith('unlabelled'))).toEqual(['unlabelled /form/model/fields/0'])
  })

  // The generator orders a grid's columns itself, in time linear in the
  // grid, where formancy's datagridColumns finds each column's field by a
  // scan (`generate-untrusted.test.ts`): were the two orders ever to
  // differ, a draft's table would not be the grid its form shows. So over
  // grids of every shape formancy accepts -- any of their fields
  // configured, in any order, a heading or not -- the two give the same
  // columns; and a column that names no field, which formancy's validator
  // refuses and datagridColumns gives without one, is passed over by both.
  test('orders a grid as formancy’s own datagridColumns does, for any grid formancy accepts', () => {
    const grids = fc.integer({ min: 0, max: 8 }).chain((count) => {
      const keys = Array.from({ length: count }, (_, index) => `c${index}`)
      const named = fc.subarray([...keys, 'missing']).chain((chosen) => fc.shuffledSubarray(chosen, { minLength: chosen.length }))
      return fc.record({ keys: fc.constant(keys), columns: named, headed: fc.array(fc.boolean(), { minLength: count + 1, maxLength: count + 1 }) })
    })
    fc.assert(
      fc.property(grids, ({ keys, columns, headed }) => {
        const repeater = {
          key: 'rows',
          type: 'repeater',
          fields: keys.map((key) => ({ key, type: 'text' })),
          columns: columns.map((field, index) => (headed[index] === true ? { field, header: `H${index}` } : { field })),
        } as unknown as FieldDef
        const theirs = datagridColumns(repeater, repeater.columns ?? [])
          .filter(({ child }) => child !== undefined)
          .map(({ child, column }) => [child?.key, column?.header])
        expect(gridOrder(repeater).map(({ child, column }) => [child.key, column?.header])).toEqual(theirs)
        expect(gridOrder(repeater).map(({ child, index }) => repeater.fields?.[index] === child)).not.toContain(false)
      }),
    )
  })

  // One row per submission has no header to head it (0042): a draft that
  // printed the answers as lines too would print each twice, and one that
  // read a repeater as a column would hold a list in a cell. So the
  // answers, a group's among them, are the table's columns, and every
  // repeater is left out, said.
  test('makes one row per submission a table of the answers, with no header, every repeater listed', () => {
    const form = formOf([
      { key: 'site', type: 'text', label: 'Site', required: true },
      { key: 'by', type: 'group', fields: [{ key: 'name', type: 'text', label: 'Name' }] },
      { key: 'items', type: 'repeater', fields: [{ key: 'ref', type: 'text' }] },
    ])
    const { report, notes } = generatedFrom(generate(form, { id: 'r', locale: 'en', detail: { kind: 'submissions' } }))
    expect(report.datasets.header).toBeUndefined()
    expect(report.datasets.detail?.form).toEqual({ kind: 'submissions' })
    expect(declared(report.datasets.detail?.fields)).toEqual(['site string site', 'name string? by.name'])
    expect(kinds(report)).toEqual(['text', 'table', 'text'])
    expect(said(notes)).toEqual(['present-always /form/model/fields/0', 'repeater-excluded /form/model/fields/2'])
  })

  // Without a detail, every repeater is listed: which one is the table is
  // the person's to say, never the generator's guess.
  test('makes no table without a detail, and lists every repeater', () => {
    const form = formOf([
      { key: 'site', type: 'text' },
      { key: 'items', type: 'repeater', fields: [{ key: 'ref', type: 'text' }] },
    ])
    const { report, notes } = generatedFrom(generate(form, { id: 'r', locale: 'en' }))
    expect([report.datasets.detail, kinds(report)]).toEqual([undefined, ['text', 'text', 'text']])
    expect(said(notes)).toEqual(['repeater-excluded /form/model/fields/1'])
  })
})

describe('what is assumed of each field', () => {
  // Not nullable only where the version proves the answer is always
  // there: required, and no visible rule on it, its group or its
  // repeater, and no skip rule on its page, can hide it -- formancy prunes
  // a hidden answer. A requirement by rule proves nothing either: its
  // expression may be false. Declared otherwise, a final render of a
  // submission that left it out would be refused for a field the form let
  // go unanswered.
  test('declares a field not nullable only where the version proves it always there', () => {
    const form = formOf(
      [
        {
          key: 'p',
          type: 'page',
          fields: [
            { key: 'a', type: 'text', required: true },
            { key: 'b', type: 'text', required: true },
            { key: 'c', type: 'text' },
            { key: 'd', type: 'text', required: true },
            { key: 'g', type: 'group', fields: [{ key: 'e', type: 'checkbox', required: true }] },
          ],
        },
        {
          key: 'q',
          type: 'page',
          fields: [
            { key: 'f', type: 'text', required: true },
            {
              key: 'rows',
              type: 'repeater',
              fields: [
                { key: 'h', type: 'text', required: true },
                { key: 'i', type: 'text', required: true },
              ],
            },
          ],
        },
      ],
      {
        logic: {
          rules: [
            { target: 'b', kind: 'visible', cel: 'a == "x"' },
            { target: 'd', kind: 'required', cel: 'a == "x"' },
            { target: 'c', kind: 'required', cel: 'true' },
            { target: 'g', kind: 'visible', cel: 'a == "x"' },
            { target: 'q', kind: 'skip', cel: 'a == "x"' },
            { target: 'rows[].i', kind: 'visible', cel: 'a == "x"' },
          ],
        },
      },
    )
    const { report } = generatedFrom(generate(form, { id: 'r', locale: 'en', detail: { kind: 'repeater', repeater: 'rows' } }))
    expect(declared(report.datasets.header?.fields)).toEqual(['a string a', 'b string? b', 'c string? c', 'd string d', 'e boolean? g.e', 'f string? f'])
    expect(declared(report.datasets.detail?.fields)).toEqual(['h string? h', 'i string? i'])
    const shown = formOf(
      [
        {
          key: 'rows',
          type: 'repeater',
          fields: [
            { key: 'h', type: 'text', required: true },
            { key: 'i', type: 'text', required: true },
          ],
        },
      ],
      { logic: { rules: [{ target: 'rows[].i', kind: 'visible', cel: 'true' }] } },
    )
    expect(
      declared(generatedFrom(generate(shown, { id: 'r', locale: 'en', detail: { kind: 'repeater', repeater: 'rows' } })).report.datasets.detail?.fields),
    ).toEqual(['h string h', 'i string? i'])
    // A visible rule on the repeater hides its rows whole, each field of them with it.
    const rowsHidden = formOf(
      [
        { key: 'rows', type: 'repeater', fields: [{ key: 'h', type: 'text', required: true }] },
        { key: 'a', type: 'text' },
      ],
      { logic: { rules: [{ target: 'rows', kind: 'visible', cel: 'a == "x"' }] } },
    )
    expect(
      declared(generatedFrom(generate(rowsHidden, { id: 'r', locale: 'en', detail: { kind: 'repeater', repeater: 'rows' } })).report.datasets.detail?.fields),
    ).toEqual(['h string? h'])
  })

  // What hides a container hides all it holds, however deep, and one row
  // per submission walks the form apart from its lines: a required field
  // in a group in a hidden group, in a group on a skipped page, or on a
  // skipped page read one row per submission, declared never null, would
  // refuse the final render of a valid submission that skipped it.
  test('declares a field nullable wherever what holds it can be hidden, one row per submission too', () => {
    const fields = [
      { key: 'a', type: 'text' },
      { key: 'outer', type: 'group', fields: [{ key: 'inner', type: 'group', fields: [{ key: 'b', type: 'text', required: true }] }] },
      {
        key: 'p',
        type: 'page',
        fields: [
          { key: 'g', type: 'group', fields: [{ key: 'c', type: 'text', required: true }] },
          { key: 'd', type: 'text', required: true },
        ],
      },
      { key: 'kept', type: 'text', required: true },
    ]
    const form = formOf(fields, {
      logic: {
        rules: [
          { target: 'outer', kind: 'visible', cel: 'a == "x"' },
          { target: 'p', kind: 'skip', cel: 'a == "x"' },
        ],
      },
    })
    const header = generatedFrom(generate(form, { id: 'r', locale: 'en' })).report.datasets.header?.fields
    expect(declared(header)).toEqual(['a string? a', 'b string? outer.inner.b', 'c string? g.c', 'd string? d', 'kept string kept'])
    const rows = generatedFrom(generate(form, { id: 'r', locale: 'en', detail: { kind: 'submissions' } })).report.datasets.detail?.fields
    expect(declared(rows)).toEqual(['a string? a', 'b string? outer.inner.b', 'c string? g.c', 'd string? d', 'kept string kept'])
  })

  // A required matrix answers every row and required ticked boxes tick
  // one at least, so each row's and each option's field is always there:
  // declared nullable, a required matrix's rows would carry 0009's `dyn`
  // cost for nothing; declared otherwise, an unanswered row would refuse
  // its final render.
  test('declares a required matrix’s rows and required ticked boxes’ options not nullable', () => {
    const form = formOf([
      { key: 'm', type: 'matrix', required: true, rows: [option('x'), option('y')], options: [option('a'), option('b')] },
      { key: 'n', type: 'matrix', rows: [option('x')], options: [option('a'), option('b')] },
      { key: 't', type: 'selectboxes', required: true, options: [option('a')] },
    ])
    expect(declared(generatedFrom(generate(form, { id: 'r', locale: 'en' })).report.datasets.header?.fields)).toEqual([
      'm_x string m#x',
      'm_y string m#y',
      'n_x string? n#x',
      't_a boolean t#a',
    ])
  })

  // A number is a double in a submission and digits in a report (0042): a
  // count read as a decimal would print `3.00`, hours read as an integer
  // would be refused, and a scale guessed past the step would print
  // places the form never asked for. So a count by whole steps from a
  // whole least value is an integer; a step through fractions, or a least
  // value with one, a decimal of the places they have; no step a decimal
  // printed as its digits; each reading said.
  test('reads a number as an integer by whole steps, else as a decimal of its step’s places, each said', () => {
    // A step past the places the format holds, and one whose double says no decimal of 15 digits, say no places: printed as their digits.
    const form = formOf([
      { key: 'n1', type: 'number', step: 1, min: 0 },
      { key: 'n2', type: 'number', step: 0.05 },
      { key: 'n3', type: 'number', step: 1, min: 0.5 },
      { key: 'n4', type: 'number' },
      { key: 'n5', type: 'number', step: 0.25, min: 0.125 },
      { key: 'n6', type: 'number', step: 1e-21 },
      { key: 'n7', type: 'number', step: 0.1 + 0.2 },
    ])
    const { report, notes } = generatedFrom(generate(form, { id: 'r', locale: 'en' }))
    expect(declared(report.datasets.header?.fields)).toEqual([
      'n1 integer? n1',
      'n2 decimal(2)? n2',
      'n3 decimal(1)? n3',
      'n4 decimal? n4',
      'n5 decimal(3)? n5',
      'n6 decimal? n6',
      'n7 decimal? n7',
    ])
    expect(said(notes)).toEqual(['number-integer /form/model/fields/0', ...[1, 2, 3, 4, 5, 6].map((index) => `number-decimal /form/model/fields/${index}`)])
    const values = report.regions.body.map((component) => (component.kind === 'text' ? component.content[1] : undefined))
    expect(values.map((run) => (run?.kind === 'field' ? (run.format?.kind === 'number' ? run.format.scale : 'plain') : run?.kind))).toEqual([
      'plain',
      2,
      1,
      'plain',
      3,
      'plain',
      'plain',
    ])
  })

  // A choice read by its label where it offers none would be refused at
  // every read, and one read by value where it offers options would print
  // `fail` for "Nicht bestanden". So it prints its option's label where
  // the version lists options, the host's label where a deployment
  // resolves them, and its stored value where it offers neither (0042);
  // the last two said.
  test('prints a choice’s label, the host’s label of a resolved one, and the value of one that offers nothing', () => {
    const form = formOf([
      { key: 'a', type: 'select', options: [option('x', 'X')] },
      { key: 'b', type: 'select', optionsSource: 'regions' },
      { key: 'c', type: 'radio' },
    ])
    const { report, notes } = generatedFrom(generate(form, { id: 'r', locale: 'en' }))
    expect(declared(report.datasets.header?.fields)).toEqual(['a string? a', 'b string? b', 'c string? c value'])
    expect(said(notes)).toEqual(['choice-host-labels /form/model/fields/1', 'choice-value /form/model/fields/2'])
  })

  // A yes or a no printed plainly is `true` under a German label, and an
  // expression that read a field by a dot would not compile for a key CEL
  // keeps for itself, `in` or `true`. So a box, [x] or [ ], nothing where
  // the form holds no answer, read in brackets.
  test('prints a yes or a no as a box, for any key formancy allows', () => {
    const form = formOf([
      { key: 'in', type: 'checkbox', label: 'In' },
      { key: 'true', type: 'checkbox' },
      { key: 'constructor', type: 'selectboxes', options: [option('x')] },
    ])
    const { report, notes } = generatedFrom(generate(form, { id: 'r', locale: 'en' }))
    const runs = walkComponents(report)
      .flatMap(({ component }) => (component.kind === 'text' ? component.content : []))
      .filter((run) => run.kind === 'expression')
    expect(runs.map((run) => (run.kind === 'expression' ? run.expression.cel : ''))).toEqual([
      'header["in"] == true ? "[x]" : header["in"] == false ? "[ ]" : ""',
      'header["true"] == true ? "[x]" : header["true"] == false ? "[ ]" : ""',
      'header["constructor_x"] == true ? "[x]" : header["constructor_x"] == false ? "[ ]" : ""',
    ])
    expect(notesOf(notes)).toEqual([
      'yes-no-box /form/model/fields/0',
      'yes-no-box /form/model/fields/1',
      'unlabelled /form/model/fields/1',
      'yes-no-box /form/model/fields/2',
      'unlabelled /form/model/fields/2',
    ])
  })

  // A rich text prints its words and loses its formatting (0042), and a
  // time of day prints as formancy stores it, `14:05`, in no locale's
  // style: a reader who expected either otherwise would find out only on
  // paper, so both are said.
  test('says that a rich text prints as plain text and a time of day as stored', () => {
    const { notes } = generatedFrom(
      generate(
        formOf([
          { key: 'notes', type: 'richtext' },
          { key: 'at', type: 'time' },
        ]),
        { id: 'r', locale: 'en' },
      ),
    )
    expect(said(notes)).toEqual(['rich-text-plain /form/model/fields/0', 'time-as-text /form/model/fields/1'])
  })
})

describe('labels', () => {
  // A row whose label is a message no catalogue holds, which formancy's
  // validator lets through, prints its stored value: unsaid, a reader
  // would take `n_a` for a word the form chose. Said at the row's place;
  // and a row whose value is white space alone, which would print as no
  // label at all, is labelled by its id.
  test('labels a row that resolves nowhere by its value, or its id, said at its place', () => {
    const rows = [{ value: 'wall', label: { $t: 'nowhere' } }, option('roof', 'Roof')]
    const form = formOf([{ key: 'm', type: 'matrix', label: 'State', rows, options: [option('a'), option('b')] }], {
      i18n: { defaultLocale: 'en', messages: { en: {} } },
    })
    const { report, notes } = generatedFrom(generate(form, { id: 'r', locale: 'en' }))
    expect(lines(report)).toEqual(['State', 'wall: {field}', 'Roof: {field}'])
    expect(notesOf(notes)).toEqual(['unlabelled /form/model/fields/0/rows/0'])
    const blank = formOf(
      [{ key: 'm', type: 'matrix', label: 'State', rows: [...rows, { value: ' ', label: { $t: 'nowhere' } }], options: [option('a'), option('b')] }],
      { i18n: { defaultLocale: 'en', messages: { en: {} } } },
    )
    const spaced = generatedFrom(generate(blank, { id: 'r', locale: 'en' }))
    expect(lines(spaced.report)).toEqual(['State', 'wall: {field}', 'Roof: {field}', 'm_3: {field}'])
    expect(spaced.notes.map((note) => `${note.code} ${note.path} ${note.message.split(' ').at(-1)}`)).toEqual([
      'unlabelled /form/model/fields/0/rows/0 value',
      'unlabelled /form/model/fields/0/rows/2 id',
    ])
  })

  // A catalogue in the report's language that lacks a message gives that
  // label in the form's default language, as formancy shows it: unsaid, a
  // German report would carry an English label nobody announced.
  test('says of each label it reads in the default language where the report’s catalogue lacks it', () => {
    const fields = [
      { key: 'a', type: 'text', label: { $t: 'a' } },
      { key: 'b', type: 'text', label: { $t: 'b' } },
      { key: 'g', type: 'group', label: { $t: 'g' }, fields: [{ key: 'c', type: 'text', label: { $t: 'a' } }] },
      { key: 'items', type: 'repeater', label: { $t: 'g' }, fields: [{ key: 'd', type: 'text', label: { $t: 'a' } }] },
    ]
    const form = formOf(fields, { i18n: { defaultLocale: 'en', messages: { en: { a: 'Site', b: 'Area', g: 'Group' }, 'de-CH': { a: 'Objekt' } } } })
    const { report, notes } = generatedFrom(generate(form, { id: 'r', locale: 'de-CH', detail: { kind: 'repeater', repeater: 'items' } }))
    expect(lines(report)).toEqual(['Objekt: {field}', 'Area: {field}', 'Group', 'Objekt: {field}', 'Group'])
    expect(notesOf(notes)).toEqual([
      'label-default-locale /form/model/fields/1',
      'label-default-locale /form/model/fields/2',
      'label-default-locale /form/model/fields/3',
    ])
  })

  // A line of a report is one line: a tab is a character no font draws,
  // so a label holding one, printed as it is, would be refused when it
  // prints, and a line break would split a label from its value. White
  // space is one space, as HTML lays a line of text out.
  test('prints a label’s white space, a tab and a line break among it, as one space', () => {
    const form = formOf([{ key: 'a', type: 'text', label: 'Site\tof\nthe  visit ' }])
    const { report } = generatedFrom(generate(form, { id: 'r', locale: 'en' }))
    expect(lines(report)).toEqual(['Site of the visit: {field}'])
    expect(report.datasets.header?.fields[0]?.label).toBe('Site of the visit')
  })

  // A control character or half of a surrogate pair is drawn by no font:
  // a draft holding one in a label would pass every check and be refused
  // when it prints, after the person had worked on it. Refused here, by
  // the field's place, and never dropped, which would change the label
  // unsaid.
  test('refuses a label holding a character no font draws, by its place', () => {
    expect(generationRefusals(generate(formOf([{ key: 'a', type: 'text', label: 'Bell\u0007' }]), { id: 'r', locale: 'en' }))).toEqual([
      'label-unprintable /form/model/fields/0',
    ])
    expect(
      generationRefusals(
        generate(formOf([{ key: 'g', type: 'group', label: 'Half \ud800', fields: [{ key: 'a', type: 'text' }] }]), { id: 'r', locale: 'en' }),
      ),
    ).toEqual(['label-unprintable /form/model/fields/0'])
    const row = formOf([{ key: 'm', type: 'matrix', rows: [option('r', 'Row\u0085')], options: [option('a'), option('b')] }])
    expect(generationRefusals(generate(row, { id: 'r', locale: 'en' }))).toEqual(['label-unprintable /form/model/fields/0/rows/0'])
    // Nor a direction override, or isolate, which no font draws and which
    // shows a builder's label in another order than it prints (0048); nor a
    // line or paragraph separator, which no font draws either. A soft
    // hyphen or a joiner, which scripts need, is the renderer's to judge.
    for (const label of ['Ort\u202Elinks', 'Ort\u2067links\u2069', 'Zeile\u2028Zeile', 'Absatz\u2029Absatz']) {
      expect(generationRefusals(generate(formOf([{ key: 'a', type: 'text', label }]), { id: 'r', locale: 'en' })), JSON.stringify(label)).toEqual([
        'label-unprintable /form/model/fields/0',
      ])
    }
    expect(generate(formOf([{ key: 'a', type: 'text', label: 'Kontroll\u00ADpunkt' }]), { id: 'r', locale: 'en' }).ok).toBe(true)
  })

  // A label longer than a field's label holds still prints whole on its
  // line, which holds 10,000 characters: refusing the form for a long
  // consent question would cost the person the whole draft for one line.
  // The field is labelled by its row's label or its key, said; only a
  // column's heading, which prints in a field's label's room, is refused.
  test('prints a long label whole on its line, labels its field shorter, said, and refuses only a column’s', () => {
    const consent = `I agree ${'that my answers may be kept '.repeat(9)}`.trim()
    expect(consent.length).toBeGreaterThan(MAX_LABEL_LENGTH)
    const question = 'q'.repeat(150)
    const form = formOf([
      { key: 'consent', type: 'checkbox', label: consent },
      { key: 'm', type: 'matrix', label: question, rows: [option('r', 'r'.repeat(60))], options: [option('a'), option('b')] },
    ])
    const { report, notes } = generatedFrom(generate(form, { id: 'r', locale: 'en' }))
    expect(lines(report)).toEqual([`${consent}: {expression}`, question, `${'r'.repeat(60)}: {field}`])
    expect(report.datasets.header?.fields.map((field) => field.label)).toEqual(['consent', 'r'.repeat(60)])
    expect(said(notes)).toEqual(['yes-no-box /form/model/fields/0', 'long-label /form/model/fields/0', 'long-label /form/model/fields/1'])
    const column = formOf([{ key: 'items', type: 'repeater', fields: [{ key: 'a', type: 'text', label: 'x'.repeat(MAX_LABEL_LENGTH + 1) }] }])
    expect(generationRefusals(generate(column, { id: 'r', locale: 'en', detail: { kind: 'repeater', repeater: 'items' } }))).toEqual([
      'label-too-long /form/model/fields/0/fields/0',
    ])
  })
})

describe('what the format cannot hold is refused', () => {
  // A member's field is its field's key and its value where every value
  // of the field gives a field key, and its place where one does not: an
  // id of a value and an id of a place could meet in one field -- `n/a`
  // the first row's place and `1` a value -- and refuse a form the format
  // holds. Two options of one value are one answer, as the reader reads
  // them. Two fields that would take one id are refused, naming both
  // paths and never a member's value, never renamed by likeness to fit.
  test('names a member’s field by its value or by its place, never mixing them, and refuses two fields that would share an id', () => {
    const named = formOf([{ key: 'm', type: 'matrix', rows: [option('safe'), option('Very good'), option('a-b')], options: [option('a'), option('b')] }])
    expect(declared(generatedFrom(generate(named, { id: 'r', locale: 'en' })).report.datasets.header?.fields)).toEqual([
      'm_1 string? m#safe',
      'm_2 string? m#Very good',
      'm_3 string? m#a-b',
    ])
    const mixed = formOf([{ key: 'checks', type: 'selectboxes', options: [option('n/a'), option('1'), option('1', 'Again')] }])
    const { report } = generatedFrom(generate(mixed, { id: 'r', locale: 'en' }))
    expect(declared(report.datasets.header?.fields)).toEqual(['checks_1 boolean? checks#n/a', 'checks_2 boolean? checks#1'])
    expect(lines(report)).toEqual(['checks', 'n/a: {expression}', '1: {expression}'])
    const colliding = formOf([
      { key: 'm', type: 'matrix', rows: [option('ErikaMustermann')], options: [option('a'), option('b')] },
      { key: 'm_ErikaMustermann', type: 'text' },
    ])
    const outcome = generate(colliding, { id: 'r', locale: 'en' })
    expect(generationRefusals(outcome)).toEqual(['colliding-ids /form/model/fields/1'])
    if (!outcome.ok)
      expect(outcome.errors[0]?.message).toBe(
        '"m_ErikaMustermann" and "m", its row 1, would both be one field of the report; a report\'s field ids are unique, and neither is renamed by likeness to tell them apart',
      )
    if (!outcome.ok) expect(outcome.errors[0]?.message.replace('"m_ErikaMustermann"', '')).not.toContain('Erika')
  })

  // The header's ids and the table's are read in scopes of their own --
  // `header.m_x` and `row.m_x` -- so a matrix's row of the submission and
  // a row field of the same id are no clash: refused as one, a form the
  // format holds would give no draft.
  test('gives the header and the table ids of their own', () => {
    const form = formOf([
      { key: 'm', type: 'matrix', rows: [option('x')], options: [option('a'), option('b')] },
      { key: 'items', type: 'repeater', fields: [{ key: 'm_x', type: 'text' }] },
    ])
    const { report } = generatedFrom(generate(form, { id: 'r', locale: 'en', detail: { kind: 'repeater', repeater: 'items' } }))
    expect([declared(report.datasets.header?.fields), declared(report.datasets.detail?.fields)]).toEqual([['m_x string? m#x'], ['m_x string? m_x']])
  })

  // A field key holds 64 characters: a member of a field whose key leaves
  // no room for `_` and the member's value or place has no id the format
  // takes, and is refused rather than named by a key cut short. A key of
  // 62 has room for one character: an option `a`, and the first nine
  // places, but not the tenth.
  test('refuses a member whose field’s key leaves no room for an id', () => {
    const key = `m${'x'.repeat(63)}`
    const outcome = generate(formOf([{ key, type: 'matrix', rows: [option('r')], options: [option('a'), option('b')] }]), { id: 'r', locale: 'en' })
    expect(generationRefusals(outcome)).toEqual(['id-too-long /form/model/fields/0'])
    const room = key.slice(0, 62)
    expect(
      declared(
        generatedFrom(generate(formOf([{ key: room, type: 'selectboxes', options: [option('a'), option('b')] }]), { id: 'r', locale: 'en' })).report.datasets
          .header?.fields,
      ).map((field) => field.split(' ')[0]),
    ).toEqual([`${room}_a`, `${room}_b`])
    const places = (count: number) =>
      formOf([{ key: room, type: 'selectboxes', options: Array.from({ length: count }, (_, index) => option(`option ${index}`)) }])
    expect(generatedFrom(generate(places(9), { id: 'r', locale: 'en' })).report.datasets.header?.fields.at(-1)?.id).toBe(`${room}_9`)
    expect(generationRefusals(generate(places(10), { id: 'r', locale: 'en' }))).toEqual(['id-too-long /form/model/fields/0'])
  })

  // A dataset holds MAX_DATASET_FIELDS fields: a form of more is refused,
  // never cut to the first of them; a form of exactly that many is a
  // draft, so the bound refuses nothing the format holds.
  test('refuses more fields than a dataset holds, and no fewer', () => {
    const many = (count: number, prefix: string) => Array.from({ length: count }, (_, index) => ({ key: `${prefix}${index}`, type: 'text' }))
    expect(generationRefusals(generate(formOf(many(MAX_DATASET_FIELDS + 1, 'f')), { id: 'r', locale: 'en' }))).toEqual(['too-many-fields /form/model/fields'])
    expect(generatedFrom(generate(formOf(many(MAX_DATASET_FIELDS, 'f')), { id: 'r', locale: 'en' })).report.datasets.header?.fields).toHaveLength(
      MAX_DATASET_FIELDS,
    )
  })

  // A heading is a text, at most MAX_TEXT_LENGTH: a group or a repeater
  // labelled longer is refused, never cut short; one of exactly that
  // length is a heading the format holds, and prints.
  test('refuses a group or a repeater labelled longer than a heading holds, and no shorter', () => {
    const catalogue = (length: number) => ({ i18n: { defaultLocale: 'en', messages: { en: { long: 'x'.repeat(length) } } } })
    const group = (length: number) => formOf([{ key: 'g', type: 'group', label: { $t: 'long' }, fields: [{ key: 'a', type: 'text' }] }], catalogue(length))
    expect(generationRefusals(generate(group(MAX_TEXT_LENGTH + 1), { id: 'r', locale: 'en' }))).toEqual(['label-too-long /form/model/fields/0'])
    expect(lines(generatedFrom(generate(group(MAX_TEXT_LENGTH), { id: 'r', locale: 'en' })).report)[0]).toHaveLength(MAX_TEXT_LENGTH)
    const rows = formOf([{ key: 'items', type: 'repeater', label: { $t: 'long' }, fields: [{ key: 'a', type: 'text' }] }], catalogue(MAX_TEXT_LENGTH + 1))
    expect(generationRefusals(generate(rows, { id: 'r', locale: 'en', detail: { kind: 'repeater', repeater: 'items' } }))).toEqual([
      'label-too-long /form/model/fields/0',
    ])
  })

  // A column's heading is one line of a field's label, at most
  // MAX_LABEL_LENGTH: one labelled longer is refused, never cut short,
  // and its label never repeated, since it is the form's; one of exactly
  // that length is a heading the format holds.
  test('refuses a column labelled longer than a field’s label holds, never repeating it, and no shorter', () => {
    const long = 'Wurde das Dach geprüft? '.repeat(10)
    expect(long.trim().length).toBeGreaterThan(MAX_LABEL_LENGTH)
    const items = (label: unknown, more = {}) => formOf([{ key: 'items', type: 'repeater', fields: [{ key: 'roof', type: 'checkbox', label }] }], more)
    const outcome = generate(items({ $t: 'roof' }, { i18n: { defaultLocale: 'de-CH', messages: { 'de-CH': { roof: long } } } }), {
      id: 'r',
      locale: 'de-CH',
      detail: { kind: 'repeater', repeater: 'items' },
    })
    expect(generationRefusals(outcome)).toEqual(['label-too-long /form/model/fields/0/fields/0'])
    if (!outcome.ok) expect(JSON.stringify(outcome.errors)).not.toContain('Dach')
    const exactly = generatedFrom(generate(items('y'.repeat(MAX_LABEL_LENGTH)), { id: 'r', locale: 'en', detail: { kind: 'repeater', repeater: 'items' } }))
    expect(exactly.report.datasets.detail?.fields[0]?.label).toHaveLength(MAX_LABEL_LENGTH)
    const member = formOf([
      {
        key: 'items',
        type: 'repeater',
        fields: [{ key: 'm', type: 'matrix', label: 'x'.repeat(150), rows: [option('r', 'y'.repeat(60))], options: [option('a'), option('b')] }],
      },
    ])
    expect(generationRefusals(generate(member, { id: 'r', locale: 'en', detail: { kind: 'repeater', repeater: 'items' } }))).toEqual([
      'label-too-long /form/model/fields/0/fields/0',
    ])
  })

  // A binding's path holds MAX_FORM_PATH_KEYS keys: a field deeper in
  // groups than that has no path a report can name, refused; one exactly
  // that deep is a path the format holds.
  test('refuses a field deeper than a binding’s path reaches, and no shallower', () => {
    const nested = (levels: number): unknown[] => {
      let fields: unknown[] = [{ key: 'leaf', type: 'text' }]
      for (let level = levels; level >= 1; level -= 1) fields = [{ key: `g${level}`, type: 'group', fields }]
      return fields
    }
    expect(generationRefusals(generate(formOf(nested(MAX_FORM_PATH_KEYS)), { id: 'r', locale: 'en' }))).toEqual([
      `path-too-long /form/model/fields/0${'/fields/0'.repeat(MAX_FORM_PATH_KEYS)}`,
    ])
    expect(
      generatedFrom(generate(formOf(nested(MAX_FORM_PATH_KEYS - 1)), { id: 'r', locale: 'en' })).report.datasets.header?.fields[0]?.form?.path.split('.'),
    ).toHaveLength(MAX_FORM_PATH_KEYS)
  })

  // A form of nothing a report prints -- static text, files -- is refused:
  // a report of an empty body is one an editor warns of, and a starter
  // opens with nothing in the problems pane. So is a repeater asked for
  // whose rows hold nothing printable.
  test('refuses a form with nothing to print, and a table of nothing', () => {
    expect(
      generationRefusals(
        generate(
          formOf([
            { key: 'intro', type: 'static', label: 'Hi' },
            { key: 'photo', type: 'file' },
          ]),
          { id: 'r', locale: 'en' },
        ),
      ),
    ).toEqual(['nothing-to-print /form/model/fields'])
    expect(
      generationRefusals(
        generate(
          formOf([
            { key: 'site', type: 'text' },
            { key: 'photos', type: 'repeater', fields: [{ key: 'photo', type: 'file' }] },
          ]),
          { id: 'r', locale: 'en', detail: { kind: 'repeater', repeater: 'photos' } },
        ),
      ),
    ).toEqual(['nothing-to-print /form/model/fields/1/fields'])
  })

  // A region holds at most MAX_REGION_COMPONENTS components: fields each
  // in groups of their own, four deep, take a section and a heading a
  // group, nine components a field. A form of exactly the bound is a
  // draft, and one component more is refused, not cut short.
  test('refuses a form whose sections would hold more components than a region does, and no fewer', () => {
    const chain = (index: number): unknown => {
      let fields: unknown[] = [{ key: `f${index}`, type: 'text' }]
      for (let level = 4; level >= 1; level -= 1) fields = [{ key: `g${index}_${level}`, type: 'group', fields }]
      return fields[0]
    }
    // 55 chains of nine components and five lines: 500, in 60 fields.
    const form = (lines: number) =>
      formOf([...Array.from({ length: 55 }, (_, index) => chain(index)), ...Array.from({ length: lines }, (_, index) => ({ key: `l${index}`, type: 'text' }))])
    expect(walkComponents(generatedFrom(generate(form(5), { id: 'r', locale: 'en' })).report).filter(({ region }) => region === 'body')).toHaveLength(
      MAX_REGION_COMPONENTS,
    )
    expect(generationRefusals(generate(form(6), { id: 'r', locale: 'en' }))).toEqual(['too-many-components /form/model/fields'])
  })
})
