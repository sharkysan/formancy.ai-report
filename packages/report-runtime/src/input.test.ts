import { describe, expect, test } from 'vitest'
import { readList, readRecord, UNREADABLE } from './input.js'

describe('readRecord', () => {
  // The data is the host's object; reading it twice could see two different
  // values, so a record is read once into a map that later reads use.
  test('reads each own enumerable property once, into a map', () => {
    const read = readRecord({ sku: 'A-1', quantity: '3' })
    expect(read.ok).toBe(true)
    if (!read.ok) return
    expect([...read.entries]).toEqual([
      ['sku', 'A-1'],
      ['quantity', '3'],
    ])
    expect(read.problems).toEqual([])
  })

  // A record built with no prototype -- JSON.parse with a reviver, or a
  // defensive host -- is still plain data.
  test('reads an object with no prototype', () => {
    const record = Object.create(null) as Record<string, unknown>
    record.sku = 'A-1'
    const read = readRecord(record)
    expect(read.ok && [...read.entries]).toEqual([['sku', 'A-1']])
  })

  // A field named like a property of Object.prototype must be read as the
  // record's own value or found missing, never inherited: a missing
  // `constructor` field would otherwise read as a function.
  test('reads own properties only, never inherited ones', () => {
    const read = readRecord({ toString: 'mine' })
    expect(read.ok && read.entries.get('toString')).toBe('mine')
    expect(read.ok && read.entries.has('constructor')).toBe(false)
  })

  // An own `__proto__` key in data parsed from JSON is a key like any other;
  // read by assignment it would vanish or replace the prototype.
  test('keeps an own __proto__ key as an entry', () => {
    const read = readRecord(JSON.parse('{"__proto__": "x"}'))
    expect(read.ok && read.entries.get('__proto__')).toBe('x')
  })

  // A getter is code, not data: running it could return a different value
  // each time or do anything at all, so it is refused unrun.
  test('refuses a getter without running it', () => {
    let ran = false
    const record = {
      sku: 'A-1',
      get amount(): string {
        ran = true
        return '1.00'
      },
    }
    const read = readRecord(record)
    expect(ran).toBe(false)
    expect(read.ok && read.entries.has('amount')).toBe(false)
    expect(read.ok && read.problems).toEqual([{ key: 'amount', message: 'a getter or setter is not data, and is not run' }])
  })

  // What JSON cannot carry is not data a report prints: a symbol key or a
  // hidden property would otherwise be read past silently.
  test('refuses a symbol key and a non-enumerable property', () => {
    const record: Record<string | symbol, unknown> = { sku: 'A-1', [Symbol('hidden')]: 1 }
    Object.defineProperty(record, 'secret', { value: 'x', enumerable: false })
    const read = readRecord(record)
    expect(read.ok && [...read.entries.keys()]).toEqual(['sku'])
    expect(read.ok && read.problems).toEqual([
      { key: 'secret', message: 'a property that is not enumerable is not data' },
      { message: 'a property named by a symbol is not data' },
    ])
  })

  // A class instance, an array, a Map or a primitive where a record belongs
  // is the wrong shape, and a record that is half read is never used.
  test.each([
    ['an array', []],
    ['a Map', new Map()],
    ['a Date', new Date(0)],
    ['a string', 'sku'],
    ['null', null],
    ['undefined', undefined],
  ])('refuses %s', (_name, value) => {
    expect(readRecord(value)).toEqual({ ok: false, code: 'wrong-type', message: expect.stringContaining('an object') })
  })

  // A proxy can throw from any trap. The read must turn that into a refusal
  // rather than let the host's exception escape a check that never throws.
  test('refuses a proxy whose traps throw', () => {
    const hostile = new Proxy(
      {},
      {
        ownKeys: () => {
          throw new Error('trap')
        },
      },
    )
    expect(readRecord(hostile)).toEqual({ ok: false, code: 'not-data', message: 'an object that throws when read is not data' })
  })
})

describe('readList', () => {
  // A list is read once, item by item, after its length is checked against
  // the bound, so a list of a billion items costs one comparison.
  test('reads each item once, after checking the length', () => {
    expect(readList(['a', 'b'], 2)).toEqual({ ok: true, items: ['a', 'b'], problems: [] })
    expect(readList(['a', 'b', 'c'], 2)).toEqual({ ok: false, code: 'too-many', message: 'a list of 3 items, more than the 2 allowed' })
  })

  // A sparse array has holes JSON cannot hold, and a getter on an index is
  // code: each is refused where it is, the rest still read.
  test('refuses holes and getters by index', () => {
    // eslint-disable-next-line no-sparse-arrays -- a hole in the array is the input under test
    const list: unknown[] = ['a', , 'c']
    Object.defineProperty(list, 2, { get: () => 'c', enumerable: true })
    const read = readList(list, 10)
    expect(read.ok && read.items).toEqual(['a', UNREADABLE, UNREADABLE])
    expect(read.ok && read.problems).toEqual([
      { index: 1, message: 'a hole in a list is not data' },
      { index: 2, message: 'a getter or setter is not data, and is not run' },
    ])
  })

  // Rows come as a list; an object or a string where they belong is the
  // wrong shape, and is never read as one.
  test.each([
    ['an object', {}],
    ['a string', 'abc'],
  ])('refuses %s', (_name, value) => {
    expect(readList(value, 10)).toEqual({ ok: false, code: 'wrong-type', message: expect.stringContaining('a list') })
  })

  // A length that answers once is read once: a proxy that throws from it is
  // refused rather than allowed to escape.
  test('refuses a list that throws when read', () => {
    const hostile = new Proxy([], {
      getOwnPropertyDescriptor: () => {
        throw new Error('trap')
      },
    })
    expect(readList(hostile, 10)).toEqual({ ok: false, code: 'not-data', message: 'a list that throws when read is not data' })
  })

  // A proxy can describe its length as anything: an object that answers 0
  // to the bound's check and 300,000 to the loop read three times
  // MAX_DETAIL_ROWS, running host code on every item, and one that answers
  // Infinity never stopped. Only a whole number is a length.
  test('refuses a length that is not a whole number, before reading anything', () => {
    let asked = 0
    let read = 0
    const length = {
      valueOf: () => (asked++ === 0 ? 0 : 300_000),
    }
    const hostile = new Proxy([], {
      getOwnPropertyDescriptor: (_target, key) => {
        if (key === 'length') return { value: length, writable: true, enumerable: false, configurable: false }
        read++
        return { value: 'row', writable: true, enumerable: true, configurable: true }
      },
    })
    expect(readList(hostile, 10)).toEqual({ ok: false, code: 'not-data', message: 'a list whose length is not a whole number is not data' })
    expect([asked, read]).toEqual([0, 0])
    for (const told of [Infinity, -1, 2.5]) {
      const lying = new Proxy([], { getOwnPropertyDescriptor: () => ({ value: told, writable: true, enumerable: false, configurable: false }) })
      expect(readList(lying, 10)).toMatchObject({ ok: false, code: 'not-data' })
    }
  })
})
