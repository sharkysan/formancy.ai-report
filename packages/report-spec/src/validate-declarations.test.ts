import { describe, expect, test } from 'vitest'
import { MAX_AGGREGATES, MAX_DATASET_FIELDS, MAX_FOOTER_ROWS, MAX_STYLE_RULES, MAX_STYLES } from './limits.js'
import { edited, getAt, refusals, removeAt, setAt } from './test-support.js'

describe('parameters', () => {
  // Defaults are exact values as strings, typed by the parameter: a default
  // that its own type would refuse would fail on first use, in front of a
  // customer, instead of here. Zero has one spelling, so it has one hash.
  // The year 0000 is refused: Intl shows it as the year 1, without its era.
  test('a parameter default is read only when its type reads it', () => {
    const samples: Record<string, { valid: unknown[]; invalid: unknown[] }> = {
      string: { valid: ['', 'Zürich'], invalid: [true] },
      integer: { valid: ['0', '-12', '9007199254740993'], invalid: ['1.0', '01', '+1', '', '-0', 1] },
      decimal: { valid: ['0', '0.0', '-0.5', '-0.05', '1.50', '99999999999999.9999'], invalid: ['1e3', '.5', '1.', '1,5', '-0', '-0.0', '-0.00', '-00.5', 1.5] },
      boolean: { valid: [true, false], invalid: ['true', 0] },
      date: {
        valid: ['2024-02-29', '2000-02-29', '1999-12-31', '2026-04-30', '0001-01-01'],
        invalid: ['2023-02-29', '1900-02-29', '2026-13-01', '2026-04-31', '2026-1-1', '2026-00-10', '2026-01-00', '0000-01-01'],
      },
    }
    for (const [type, { valid, invalid }] of Object.entries(samples)) {
      for (const value of valid) {
        const report = edited((r) => setAt(r, '/parameters/6', { id: 'probe', type, label: 'Probe', required: false, default: value }))
        expect(refusals(report), `${type} ${JSON.stringify(value)}`).toEqual([])
      }
      for (const value of invalid) {
        const report = edited((r) => setAt(r, '/parameters/6', { id: 'probe', type, label: 'Probe', required: false, default: value }))
        expect(refusals(report), `${type} ${JSON.stringify(value)}`).toEqual(['invalid-default /parameters/6/default'])
      }
    }
  })
})

describe('ids and keys', () => {
  // The names an expression reads -- dataset fields, parameters, aggregates
  // -- are field keys as a formancy form writes them, so a form's or a
  // dataset's key is the report's unrenamed, and CEL reads it with a dot.
  // A hyphen would read as a subtraction.
  test('fields, parameters and aggregates have field keys', () => {
    const positions = ['/datasets/detail/fields/0/id', '/parameters/1/id', '/aggregates/5/id']
    for (const pointer of positions) {
      // The fixture's own `unit_price`, `shippedAt` and `min_quantity` are field keys too.
      for (const key of ['unitPrice', 'net_amount', '_hidden', 'Total2', `a${'b'.repeat(63)}`]) {
        expect(refusals(edited((r) => setAt(r, pointer, key))).filter((error) => !error.startsWith('unknown-')), `${pointer} ${key}`).toEqual([])
      }
      for (const key of ['unit-price', '2nd', '', 'a b', `a${'b'.repeat(64)}`]) {
        expect(refusals(edited((r) => setAt(r, pointer, key))), `${pointer} ${key}`).toEqual([`invalid-id ${pointer}`])
      }
    }
  })

  // Every other id is an identifier -- lower case, hyphens -- as the names
  // a deployment resolves are in formancy (formancy.ai 0077).
  test('components, styles, datasets, assets and table columns have identifiers', () => {
    for (const pointer of ['/regions/body/1/id', '/styles/3/id', '/datasets/detail/id', '/assets/1/id', '/regions/body/2/columns/4/id']) {
      expect(refusals(edited((r) => setAt(r, pointer, 'unit_price'))), pointer).toEqual([`invalid-id ${pointer}`])
    }
  })

  // An id names one declaration in its list: two would let a reference
  // land on either. The header and the detail dataset are bound to two
  // provider datasets by id, so they differ too; a field id is unique in
  // its dataset, and the same id in both datasets is two fields.
  test('ids are unique in their list', () => {
    const duplicates: [string, string, string][] = [
      ['/styles/1/id', 'title', 'duplicate-id /styles/1/id'],
      ['/datasets/detail/fields/1/id', 'site', 'duplicate-id /datasets/detail/fields/1/id'],
      ['/assets/1/id', 'logo', 'duplicate-id /assets/1/id'],
      ['/aggregates/1/id', 'subtotal', 'duplicate-id /aggregates/1/id'],
      ['/datasets/detail/id', 'order-header', 'duplicate-id /datasets/detail/id'],
    ]
    for (const [pointer, id, error] of duplicates) {
      expect(refusals(edited((r) => setAt(r, pointer, id))), pointer).toContain(error)
    }
    expect(refusals(edited((r) => setAt(r, '/datasets/detail/fields/0/id', 'customer'))).filter((error) => error.startsWith('duplicate'))).toEqual([])
  })

  // A sample of BCP 47 tags the format reads -- language, optional script,
  // optional region -- and spellings it refuses, so one locale has one
  // spelling.
  test('locales are BCP 47 language tags in their canonical case', () => {
    for (const locale of ['en', 'de-CH', 'fr-CH', 'zh-Hans-CN', 'es-419', 'gsw']) {
      expect(refusals(edited((r) => setAt(r, '/locale', locale))), locale).toEqual([])
    }
    for (const locale of ['', 'EN', 'de-ch', 'de_CH', 'de-CH-', 'english', 'de-CH-1996', 'x-private']) {
      expect(refusals(edited((r) => setAt(r, '/locale', locale))), locale).toEqual(['invalid-locale /locale'])
    }
  })
})

describe('bounds on lists', () => {
  // Every list is bounded, and refused past its bound before its entries
  // are read; the bound itself is allowed.
  test('styles, fields, aggregates, style rules and footer rows are bounded', () => {
    const lists: [string, number, (index: number) => unknown][] = [
      ['/styles', MAX_STYLES, (index) => ({ id: `style-${index}` })],
      ['/datasets/header/fields', MAX_DATASET_FIELDS, (index) => ({ id: `extra${index}`, type: 'string', label: 'Extra', nullable: true })],
      ['/aggregates', MAX_AGGREGATES, (index) => ({ id: `count${index}`, fn: 'count' })],
      ['/regions/body/0/styleWhen', MAX_STYLE_RULES, () => ({ when: { cel: 'true' }, style: 'small' })],
      ['/regions/body/2/totals', MAX_FOOTER_ROWS, () => ({ cells: [] })],
    ]
    for (const [pointer, bound, entry] of lists) {
      const fill = (count: number) =>
        edited((r) => {
          const list = getAt(r, pointer) as unknown[]
          for (let index = list.length; index < count; index += 1) list.push(entry(index))
        })
      expect(refusals(fill(bound)), pointer).toEqual([])
      expect(refusals(fill(bound + 1)), pointer).toEqual([`too-many ${pointer}`])
    }
  })
})

describe('provenance', () => {
  // A report generated from a form names the form and pins its exact
  // version by hash, so a reviewer can find what it was generated from and
  // a reprint can render against the form that collected the answers
  // (plan 12.2). One from a dataset names the dataset. A blank report has
  // nothing to name.
  test('each kind names what it came from, and nothing else', () => {
    const form = { kind: 'form', form: 'site-visit.v2', formHash: 'a'.repeat(64) }
    expect(refusals(edited((r) => setAt(r, '/provenance', form)))).toEqual([])
    expect(refusals(edited((r) => setAt(r, '/provenance', { kind: 'blank' })))).toEqual([])
    expect(refusals(edited((r) => removeAt(r, '/provenance')))).toEqual([])
    expect(refusals(edited((r) => setAt(r, '/provenance', { kind: 'form', form: 'site-visit' })))).toEqual(['missing-property /provenance/formHash'])
    expect(refusals(edited((r) => setAt(r, '/provenance', { kind: 'dataset' })))).toEqual(['missing-property /provenance/dataset'])
    expect(refusals(edited((r) => setAt(r, '/provenance', { kind: 'blank', dataset: 'order-lines' })))).toEqual(['unknown-property /provenance/dataset'])
    expect(refusals(edited((r) => setAt(r, '/provenance', { kind: 'submission' })))).toEqual(['unknown-kind /provenance/kind'])
  })

  // The form's id is written as formancy writes one, and its hash as
  // schemaHash writes one: a hash in capitals, or one with a prefix, would
  // match no form version.
  test('a form is named by its id and pinned by its schema hash', () => {
    const provenance = (form: string, formHash: string) => edited((r) => setAt(r, '/provenance', { kind: 'form', form, formHash }))
    expect(refusals(provenance('-visit', 'a'.repeat(64)))).toEqual(['invalid-id /provenance/form'])
    expect(refusals(provenance('visit', 'A'.repeat(64)))).toEqual(['invalid-digest /provenance/formHash'])
    expect(refusals(provenance('visit', `sha256:${'a'.repeat(64)}`))).toEqual(['invalid-digest /provenance/formHash'])
  })
})

describe('the page and its lengths', () => {
  // Landscape swaps the page's sides before the margins are taken off: the
  // same margins can fit one way and not the other. These leave 81.89
  // points of height, less than the seal's 150 and the two QR codes' 85.04.
  // A QR-bill is printed on A4 in portrait only, so the landscape page is
  // measured without the fixture's.
  test('the printable area is measured on the page as oriented', () => {
    const tall = edited((r) => {
      setAt(r, '/page/margins/top', 380)
      setAt(r, '/page/margins/bottom', 380)
    })
    expect(refusals(tall)).toEqual(['exceeds-printable-area /regions/summary/1/height', 'exceeds-printable-area /regions/summary/2/size', 'exceeds-printable-area /regions/summary/3/size'])
    const wide = edited((r) => {
      removeAt(r, '/paymentPart')
      setAt(r, '/page/orientation', 'landscape')
      setAt(r, '/page/margins/top', 380)
      setAt(r, '/page/margins/bottom', 380)
    })
    expect(refusals(wide)).toEqual(['printable-area-too-small /page/margins'])
  })

  // Lengths are stored to the hundredth of a point. A length that rounds to
  // 0 is not "more than 0", a line that thin draws nothing, and two
  // spellings of one stored length cannot both be valid, or one layout would
  // have two hashes.
  test('every length and font size is on the hundredth of a point', () => {
    for (const pointer of ['/regions/reportHeader/1/thickness', '/regions/body/1/height', '/regions/body/2/columns/0/width', '/regions/summary/0/padding']) {
      expect(refusals(edited((r) => setAt(r, pointer, 1e-9))), pointer).toEqual([`too-precise ${pointer}`])
    }
    expect(refusals(edited((r) => setAt(r, '/page/margins/top', 56.690000001)))).toEqual(['too-precise /page/margins/top'])
    expect(refusals(edited((r) => setAt(r, '/styles/1/size', 10.25)))).toEqual([])
    expect(refusals(edited((r) => setAt(r, '/styles/1/size', 10.125)))).toEqual(['too-precise /styles/1/size'])
  })
})

describe('assets', () => {
  // An image asset may be an SVG (0030): a report that declares one is
  // valid, and its bytes are held to cleanSvg's form where they are drawn.
  // A media type nothing reads is refused, as before, so a GIF is never
  // passed to a renderer that would guess at it.
  test('an asset may be a PNG, a JPEG or an SVG, and nothing else', () => {
    for (const mediaType of ['image/png', 'image/jpeg', 'image/svg+xml']) {
      expect(refusals(edited((r) => setAt(r, '/assets/0/mediaType', mediaType))), mediaType).toEqual([])
    }
    for (const mediaType of ['image/gif', 'image/svg', 'image/svg+xml; charset=utf-8', 'IMAGE/SVG+XML']) {
      expect(refusals(edited((r) => setAt(r, '/assets/0/mediaType', mediaType))), mediaType).toEqual(['not-one-of /assets/0/mediaType'])
    }
  })
})
