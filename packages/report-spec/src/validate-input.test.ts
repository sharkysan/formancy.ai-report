import { describe, expect, test } from 'vitest'
import { REPORT_ERROR_CODES } from './errors.js'
import { reportHash } from './hash.js'
import { MAX_INLINES, MAX_KEY_LENGTH, MAX_PARAMETERS } from './limits.js'
import { editable, getAt, objectsIn, pointers, refusals, richReport, setAt } from './test-support.js'
import { validateReport } from './validate.js'

/** An object every one of whose proxy traps throws. */
function throwingProxy(): object {
  const handler = new Proxy(
    {},
    {
      get: () => () => {
        throw new Error('trap')
      },
    },
  )
  return new Proxy({}, handler)
}

function revokedProxy(): object {
  const { proxy, revoke } = Proxy.revocable({}, {})
  revoke()
  return proxy
}

class Box {
  readonly width = 10
}

/**
 * An array proxy whose `length` is `length()` each time it is asked, and
 * which counts every element read through it.
 */
function lyingArray(length: () => unknown, element: (index: number) => unknown): { array: unknown[]; reads: () => number } {
  let reads = 0
  const array = new Proxy([], {
    get: (target, key) => (key === 'length' ? length() : Reflect.get(target, key)),
    getOwnPropertyDescriptor: (target, key) => {
      if (typeof key === 'string' && /^\d+$/.test(key)) {
        reads += 1
        return { value: element(Number(key)), enumerable: true, configurable: true, writable: true }
      }
      return Reflect.getOwnPropertyDescriptor(target, key)
    },
  }) as unknown[]
  return { array, reads: () => reads }
}

/**
 * The fuzz below validates the fixture once per odd value per position.
 * Measured at 8.9-9.0 s over three runs, and 15.8 s with coverage, which CI
 * runs, on the maintainer's Windows 11 machine on 15 October 2026; vitest's
 * default of 5 s fails it. Nearly four times the coverage time leaves room
 * for a slower CI runner without letting a validator that has started to
 * hang pass.
 */
const FUZZ_TIMEOUT_MS = 60_000

/**
 * The longest message and path validation may return, whatever the input
 * holds. The longest the format writes are a list of every kind and a path
 * five containers deep; a message or path past these has echoed the input.
 */
const MAX_MESSAGE = 400
const MAX_PATH = 400

/**
 * Values that are not JSON data, or are JSON nobody should send: what a
 * caller in the same process can hand over, as distinct from what
 * JSON.parse can produce.
 */
function oddValues(): unknown[] {
  const getter = {}
  Object.defineProperty(getter, 'id', { get: () => 'x', enumerable: true })
  return [
    undefined,
    null,
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
    -0,
    Number.MAX_VALUE,
    1e-9,
    -1,
    '',
    'x'.repeat(20_000),
    true,
    [],
    {},
    [[[]]],
    Symbol('odd'),
    10n,
    () => 0,
    new Date(0),
    new Map([['a', 1]]),
    new Box(),
    Object.create(null),
    getter,
    throwingProxy(),
    revokedProxy(),
    JSON.parse('{"__proto__": {"polluted": true}}'),
    'constructor',
    '__proto__',
  ]
}

describe('validateReport on input that is not a report at all', () => {
  // The validator is the boundary untrusted templates cross. A throw from it
  // is a crash in whatever called it -- a server request, an editor session
  // -- so every odd value is refused with an error, never with an exception.
  test('refuses every odd value as a whole document, and never throws', () => {
    for (const value of oddValues()) {
      const outcome = validateReport(value)
      expect(outcome.valid).toBe(false)
    }
  })

  // The same, at every position inside a valid report: each odd value is
  // put at every pointer the fixture has. Whatever comes back is a valid
  // report that hashes, or errors that each carry a known code, a JSON
  // Pointer and a message -- none of them longer than the format's own, so
  // none echoes the 20,000-character string back.
  test('never throws on an odd value at any position, and what it returns is usable', { timeout: FUZZ_TIMEOUT_MS }, () => {
    const codes = new Set<string>(REPORT_ERROR_CODES)
    for (const pointer of pointers(richReport()).slice(1)) {
      const report = editable(richReport())
      const original = getAt(report, pointer)
      for (const value of oddValues()) {
        setAt(report, pointer, value)
        const outcome = validateReport(report)
        setAt(report, pointer, original)
        if (outcome.valid) {
          expect(reportHash(outcome.report)).toMatch(/^[0-9a-f]{64}$/)
          continue
        }
        expect(outcome.errors.length, pointer).toBeGreaterThan(0)
        for (const error of outcome.errors) {
          expect(codes.has(error.code), `${pointer} ${error.code}`).toBe(true)
          expect(error.path, pointer).toMatch(/^(\/[^/]*)*$/)
          expect(error.message.length, pointer).toBeGreaterThan(0)
          expect(error.message.length, `${pointer} ${error.code}`).toBeLessThanOrEqual(MAX_MESSAGE)
          expect(error.path.length, pointer).toBeLessThanOrEqual(MAX_PATH)
        }
      }
    }
    expect(({} as Record<string, unknown>).polluted).toBeUndefined()
  })
})

describe('what a document chooses does not grow what validation says', () => {
  // A property name is the document's to choose. A long one is refused
  // where its object is, before any path is built from it, so no path and
  // no message grows with it -- at every object in the report.
  test('refuses a property name past MAX_KEY_LENGTH at every object, with a short path and message', () => {
    const long = 'k'.repeat(1_000_000)
    const report = richReport()
    const objects = pointers(report).filter((pointer) => {
      const value = getAt(report, pointer)
      return typeof value === 'object' && value !== null && !Array.isArray(value)
    })
    for (const pointer of objects) {
      const document = editable(richReport())
      setAt(document, `${pointer}/${long}`, 1)
      const errors = validateReport(document)
      expect(errors.valid, pointer).toBe(false)
      for (const error of errors.valid ? [] : errors.errors) {
        expect(error.path.length, pointer).toBeLessThanOrEqual(MAX_PATH)
        expect(error.message.length, pointer).toBeLessThanOrEqual(MAX_MESSAGE)
      }
      expect(refusals(document), pointer).toContain(`too-long ${pointer}`)
    }
    const boundary = editable(richReport())
    setAt(boundary, `/regions/body/1/${'k'.repeat(MAX_KEY_LENGTH)}`, 1)
    expect(refusals(boundary)).toEqual([`unknown-property /regions/body/1/${'k'.repeat(MAX_KEY_LENGTH)}`])
  })

  // A string at the longest V8 allows (2^29 - 24 characters, Node 24) made
  // the version message's concatenation throw "Invalid string length" out
  // of validateReport, on 14 October 2026. 'x'.repeat builds it without
  // copying; quoting it costs one copy of half a gigabyte, so one string
  // serves every case here.
  test('never throws on a string at the longest the engine allows', () => {
    const longest = 'x'.repeat(2 ** 29 - 24)
    expect(validateReport({ reportSpecVersion: longest })).toMatchObject({ valid: false, errors: [{ code: 'unsupported-version' }] })
    expect(validateReport({ specVersion: longest })).toMatchObject({ valid: false, errors: [{ code: 'not-a-report' }] })
    const footer = editable(richReport())
    setAt(footer, '/regions/body/2/totals/0/cells/0/column', longest)
    expect(refusals(footer)).toEqual(['unknown-column /regions/body/2/totals/0/cells/0/column'])
  })
})

describe('values JSON cannot hold', () => {
  // A getter is code the caller's object runs on every read; read twice it
  // can answer twice, differently, after validation has looked. It is
  // refused where it is, and never run.
  test('refuses accessor properties without running them', () => {
    let calls = 0
    const report = editable(richReport())
    Object.defineProperty(report, 'title', { get: () => (calls += 1) && 'Orders', enumerable: true })
    Object.defineProperty(getAt(report, '/styles/1'), 'size', { get: () => (calls += 1) && 10, enumerable: true })
    Object.defineProperty(getAt(report, '/regions/body'), 1, { get: () => (calls += 1) && {}, enumerable: true })
    const outcome = validateReport(report)
    expect(outcome.valid ? [] : outcome.errors.map(({ code, path }) => `${code} ${path}`)).toEqual([
      'not-json /title',
      'not-json /styles/1/size',
      'not-json /regions/body/1',
    ])
    for (const error of outcome.valid ? [] : outcome.errors) expect(error.message).toMatch(/getter or setter/)
    expect(calls).toBe(0)
  })

  // A proxy whose traps throw, or one that has been revoked, cannot be read
  // at all. That is an error at its position, not an exception.
  test('refuses an object that throws when it is read, where it is', () => {
    const throwing = editable(richReport())
    setAt(throwing, '/page/margins', throwingProxy())
    expect(refusals(throwing)).toEqual(['not-json /page/margins'])
    const revoked = editable(richReport())
    setAt(revoked, '/regions/summary', revokedProxy())
    expect(refusals(revoked)).toEqual(['not-json /regions/summary'])
  })

  // An array's length is read once. A proxy whose length is an object
  // answering 0 to the bound check and more afterwards would pass the bound
  // and then be read past it -- a hundred parameters where 32 are allowed,
  // or a loop without end. A length that is not a number is refused, and
  // not one element is read.
  test('reads an array length once, and refuses one that is not a whole number', () => {
    let asked = 0
    const parameter = (index: number) => ({ id: `p${index}`, type: 'string', label: 'P', required: false })
    const lying = lyingArray(() => ({ valueOf: () => (asked++ === 0 ? 0 : 100) }), parameter)
    const report = editable(richReport())
    setAt(report, '/parameters', lying.array)
    expect(refusals(report)).toEqual(['not-json /parameters'])
    expect(lying.reads()).toBe(0)

    const endless = lyingArray(() => Number.POSITIVE_INFINITY, () => ({ kind: 'text', text: 'x' }))
    const inlines = editable(richReport())
    setAt(inlines, '/regions/body/0/content', endless.array)
    expect(refusals(inlines)).toEqual(['not-json /regions/body/0/content'])
    expect(endless.reads()).toBe(0)
  })

  // A length that is a number past the bound is refused before an element
  // is read, in a list of declarations and in a list of inlines alike.
  test('refuses a proxy whose numeric length is past the bound without reading an element', () => {
    const parameters = lyingArray(() => MAX_PARAMETERS + 1, () => ({}))
    const report = editable(richReport())
    setAt(report, '/parameters', parameters.array)
    const inlines = lyingArray(() => MAX_INLINES + 1, () => ({}))
    setAt(report, '/regions/body/0/content', inlines.array)
    expect(refusals(report)).toEqual(['too-many /parameters', 'too-many /regions/body/0/content'])
    expect(parameters.reads() + inlines.reads()).toBe(0)
  })

  // A Map of styles has no own properties; read as a plain object it would
  // be an empty style sheet, and every reference to a style would be
  // reported missing for the wrong reason. Instances are refused as what
  // they are.
  test('refuses instances of classes, Maps and Dates where a plain object belongs', () => {
    const report = editable(richReport())
    setAt(report, '/styles/0', new Map())
    setAt(report, '/page/margins', new Box())
    setAt(report, '/provenance', new Date(0))
    expect(refusals(report)).toEqual(['wrong-type /page/margins', 'wrong-type /styles/0', 'wrong-type /provenance'])
  })

  // An array hole is not JSON. Read as undefined it would shift what every
  // later index means.
  test('refuses a hole in an array where it is', () => {
    const report = editable(richReport())
    const body = getAt(report, '/regions/body') as unknown[]
    body.length = 6
    expect(refusals(report)).toEqual(['not-json /regions/body/5'])
  })

  // An own property set to undefined is present to Object.keys and absent
  // to JSON.stringify; it is reported once, as not JSON, and not again as
  // missing.
  test('refuses an explicit undefined once, as not JSON', () => {
    const report = editable(richReport())
    setAt(report, '/title', undefined)
    expect(refusals(report)).toEqual(['not-json /title'])
  })

  // -0 is equal to 0 for every comparison but Object.is, and JSON writes it
  // as 0. Read as 0, so the report returned and its hash agree with what a
  // JSON round trip of it would give.
  test('reads -0 as 0', () => {
    const report = editable(richReport())
    setAt(report, '/page/margins/top', -0)
    const outcome = validateReport(report)
    expect(outcome.valid).toBe(true)
    expect(Object.is(outcome.valid && outcome.report.page.margins.top, 0)).toBe(true)
  })

  // Symbol keys and non-enumerable properties are invisible to JSON, and to
  // this reader: what JSON.stringify would write is what is read.
  test('reads what JSON.stringify would write, and nothing more', () => {
    const report = editable(richReport())
    Object.defineProperty(report, Symbol('meta'), { value: 1, enumerable: true })
    Object.defineProperty(report, 'hidden', { value: 1, enumerable: false })
    const outcome = validateReport(report)
    expect(outcome).toEqual({ valid: true, report: richReport() })
    expect(Object.getOwnPropertySymbols(outcome.valid ? outcome.report : {})).toEqual([])
  })
})

describe('prototype keys and odd identifiers', () => {
  // JSON.parse makes "__proto__" an own property. It is refused as a
  // property this version does not know, and nothing reaches
  // Object.prototype.
  test('refuses a __proto__ key from JSON.parse without polluting anything', () => {
    const top = JSON.stringify(richReport()).replace('{', '{"__proto__":{"polluted":true},')
    expect(refusals(JSON.parse(top))).toEqual(['unknown-property /__proto__'])
    const style = JSON.stringify(richReport()).replace('"styles":[{', '"styles":[{"__proto__":{"bold":true},')
    expect(refusals(JSON.parse(style))).toEqual(['unknown-property /styles/0/__proto__'])
    expect(({} as Record<string, unknown>).polluted).toBeUndefined()
  })

  // A path is a JSON Pointer, so a key holding "/" or "~" is escaped as RFC
  // 6901 says; unescaped, "a/b" would point at a property b inside a.
  test('escapes "/" and "~" in the paths it reports', () => {
    const report = editable(richReport())
    setAt(report, '/regions/body/1/a~1b~0c', true)
    expect(refusals(report)).toEqual(['unknown-property /regions/body/1/a~1b~0c'])
    expect(getAt(report, '/regions/body/1/a~1b~0c')).toBe(true)
  })

  // "constructor" and "__proto__" are names every plain object answers to.
  // As ids in a list they are compared, never looked up, so a declared one
  // is an id like any other and an undeclared one is unknown, not answered
  // by Object.prototype.
  test('treats constructor as an id, not as something every object has', () => {
    const declared = editable(richReport())
    setAt(declared, '/styles/6', { id: 'constructor', bold: true })
    setAt(declared, '/regions/body/1/style', 'constructor')
    setAt(declared, '/parameters/6', { id: 'constructor', type: 'string', label: 'C', required: false })
    setAt(declared, '/regions/body/0/content/3', { kind: 'parameter', parameter: 'constructor' })
    expect(refusals(declared)).toEqual([])
    const undeclared = editable(richReport())
    setAt(undeclared, '/regions/body/1/style', 'constructor')
    setAt(undeclared, '/regions/body/0/content/3', { kind: 'parameter', parameter: '__proto__' })
    setAt(undeclared, '/regions/body/0/content/4', { kind: 'field', field: { dataset: 'header', field: 'constructor' } })
    setAt(undeclared, '/regions/summary/1/source/asset', 'constructor')
    setAt(undeclared, '/aggregates/0/of/field/field', '__proto__')
    expect(refusals(undeclared)).toEqual([
      'unknown-field /aggregates/0/of/field/field',
      'unknown-parameter /regions/body/0/content/3/parameter',
      'unknown-field /regions/body/0/content/4/field/field',
      'unknown-style /regions/body/1/style',
      'unknown-asset /regions/summary/1/source/asset',
    ])
  })
})

describe('size and shape the format never allows', () => {
  // JSON cannot be cyclic, but an object in memory can. A container that
  // holds itself is walked only to the nesting bound, so validation ends.
  test('ends on a container that contains itself', () => {
    const report = editable(richReport())
    const loop: Record<string, unknown> = { id: 'loop', kind: 'section' }
    loop.components = [loop]
    setAt(report, '/regions/body/5', loop)
    const errors = refusals(report)
    expect(errors).toContain('nesting-too-deep /regions/body/5/components/0/components/0/components/0/components/0')
    expect(errors.filter((error) => error.startsWith('duplicate-component-id'))).toHaveLength(4)
  })

  // An array is measured before it is read: a sparse array that claims four
  // billion elements is refused in the time it takes to read its length.
  test('refuses an array past its bound without reading its elements', () => {
    const report = editable(richReport())
    setAt(report, '/regions/body', new Array(2 ** 32 - 1))
    setAt(report, '/parameters', new Array(2 ** 32 - 1))
    expect(refusals(report)).toEqual(['too-many /parameters', 'too-many /regions/body'])
  })

  // Numbers far past every bound are out of range, not a layout problem
  // left for the renderer.
  test('refuses numbers past their bounds', () => {
    const report = editable(richReport())
    setAt(report, '/regions/summary/1/width', Number.MAX_VALUE)
    setAt(report, '/styles/0/size', 1e9)
    setAt(report, '/regions/body/1/height', -5)
    expect(refusals(report)).toEqual(['out-of-range /styles/0/size', 'out-of-range /regions/body/1/height', 'out-of-range /regions/summary/1/width'])
  })
})

describe('what validateReport returns', () => {
  // The report returned is built from what was read, not the object passed
  // in: a caller that changes its input afterwards -- or an object that
  // would answer differently the second time -- cannot change a report
  // that has already been validated.
  test('shares no object with its input', () => {
    const input = richReport()
    const outcome = validateReport(input)
    expect(outcome.valid).toBe(true)
    if (!outcome.valid) return
    const inputs = objectsIn(input)
    for (const object of objectsIn(outcome.report)) expect(inputs.has(object)).toBe(false)
    ;(input.regions.body as unknown as unknown[]).length = 0
    expect(outcome.report.regions.body).toHaveLength(5)
  })

  // Objects in the report are plain: a consumer that spreads them, or calls
  // hasOwnProperty, gets what it would from JSON.parse.
  test('returns plain objects', () => {
    const outcome = validateReport(richReport())
    if (!outcome.valid) throw new Error('fixture refused')
    for (const object of objectsIn(outcome.report)) {
      expect([Object.prototype, Array.prototype]).toContain(Object.getPrototypeOf(object))
    }
  })
})
