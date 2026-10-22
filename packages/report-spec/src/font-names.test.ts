import { describe, expect, test } from 'vitest'
import { readFont } from './font.js'
import type { FontRefusal } from './font-refusal.js'
import { font, macintosh, name, nameBytes, tableAt, u16, windows, type NameEntry } from './font-test-support.js'

/**
 * A font's names (0040): what an approver reads and a builder shows,
 * handed back as the font states them and never judged, and the PostScript
 * name PDFKit writes into the PDF as a name object, which must not write
 * PDF syntax the font chose.
 */

const named = (entries: readonly NameEntry[], storage?: readonly number[]): ReturnType<typeof readFont> => readFont(font({ name: name(entries, storage === undefined ? {} : { storage }) }))

function refused(entries: readonly NameEntry[]): FontRefusal {
  const read = named(entries)
  if (read.ok) throw new Error(`read as ${read.names.postScriptName}`)
  return read
}

/** The least a font's names may be: a family, a subfamily and a PostScript name. */
const LEAST: readonly NameEntry[] = [windows(1, 'Probe'), windows(2, 'Bold'), windows(6, 'Probe-Bold')]

describe('the names returned', () => {
  // A family with more than four faces names them by its typographic names;
  // a builder that showed "Probe Sans Light" as the family would list each
  // weight as a family of its own.
  test('are the typographic family and subfamily before the family and subfamily', () => {
    expect(named([...LEAST, windows(16, 'Probe Sans'), windows(17, 'Light')])).toMatchObject({ ok: true, names: { family: 'Probe Sans', subfamily: 'Light' } })
  })

  // A font holds a name in several languages and platforms; the one shown
  // is the Windows English record, then any Windows Unicode one, then the
  // Unicode platform's, then the Macintosh's.
  test.each([
    ['Windows English over another Windows language', [{ ...windows(1, 'Sonde'), language: 0x407 }, windows(1, 'Probe')], 'Probe'],
    ['any Windows Unicode over the Unicode platform', [{ platform: 0, encoding: 3, language: 0, id: 1, text: 'Unicode' }, { ...windows(1, 'Windows'), language: 0x407 }], 'Windows'],
    ['the Unicode platform over the Macintosh', [macintosh(1, 'Mac'), { platform: 0, encoding: 4, language: 0, id: 1, text: 'Unicode' }], 'Unicode'],
    ['the Macintosh when nothing else names it', [macintosh(1, 'Mac')], 'Mac'],
    ['Windows full repertoire as Windows', [{ platform: 3, encoding: 10, language: 0x409, id: 1, text: 'Full' }], 'Full'],
  ] as const)('%s', (_, families, family) => {
    expect(named([...families, windows(2, 'Regular'), windows(6, 'Probe')])).toMatchObject({ ok: true, names: { family } })
  })

  // UTF-16 beyond the BMP is a pair of code units; a lone one is no character, and is said as U+FFFD rather than handed on to break a page.
  test('decode UTF-16 surrogate pairs, and a lone surrogate as U+FFFD', () => {
    const lone = name([{ ...windows(1, 'x'), text: 'x' }, windows(2, 'Regular'), windows(6, 'Probe')], { storage: [...u16(0xd83d), ...nameBytes(windows(2, 'Regular')), ...nameBytes(windows(6, 'Probe'))] })
    expect(readFont(font({ name: lone }))).toMatchObject({ ok: true, names: { family: '�' } })
    expect(named([windows(1, 'Probe 😀'), windows(2, 'Regular'), windows(6, 'Probe')])).toMatchObject({ ok: true, names: { family: 'Probe 😀' } })
  })

  // Mac Roman's upper half is not Latin-1: 0x8A is ä, 0xA5 is •.
  test('decode Mac Roman by its own table', () => {
    const entries = [macintosh(1, 'x'), windows(2, 'Regular'), windows(6, 'Probe')]
    const storage = [0x50, 0x8a, 0xa5, ...nameBytes(windows(2, 'Regular')), ...nameBytes(windows(6, 'Probe'))]
    const table = name(entries, { storage })
    // The record says one byte; the table builder measured 'x'. Each length is set by hand.
    const view = new DataView(table.buffer)
    view.setUint16(6 + 8, 3)
    view.setUint16(6 + 12 + 10, 3)
    view.setUint16(6 + 24 + 10, 3 + nameBytes(windows(2, 'Regular')).length)
    expect(readFont(font({ name: table }))).toMatchObject({ ok: true, names: { family: 'Pä•' } })
  })

  // The licence is the customer's to read, quoted from the font whatever it says.
  test('hand back the licence description and its address as the font states them, judging neither', () => {
    expect(named([...LEAST, windows(13, 'All rights reserved. No embedding.'), windows(14, 'javascript:alert(1)')])).toMatchObject({ ok: true, names: { licence: 'All rights reserved. No embedding.', licenceUrl: 'javascript:alert(1)' } })
  })

  // A name the font does not hold is not there, never an empty string a builder would show as one.
  test('leave out the names a font does not hold', () => {
    const read = named(LEAST)
    expect(read.ok && Object.keys(read.names).sort()).toEqual(['family', 'postScriptName', 'postScriptNames', 'subfamily'])
  })
})

describe('the PostScript name', () => {
  // PDFKit writes the PostScript name into the PDF as a name object, spaces
  // replaced and nothing else escaped: a delimiter in it writes PDF syntax
  // the font chose, a number sign starts an escape.
  test.each([...'[](){}<>/%#', '\u0000', '\t', 'é', '😀'])('refuses %j', (character) => {
    expect(refused([windows(1, 'Probe'), windows(2, 'Bold'), windows(6, `Probe${character}Bold`)])).toMatchObject({
      code: 'malformed',
      message: expect.stringContaining('has a PostScript name with a character PDFKit would write into the PDF as syntax') as string,
    })
  })

  // Which record fontkit returns depends on their order and languages, so a
  // sound Windows record does not excuse a Macintosh one that is not.
  test.each([...'[](){}<>/%#'])('refuses %j in any record, the Macintosh one too', (character) => {
    expect(refused([...LEAST, macintosh(6, `Probe${character}Bold`)]).code).toBe('malformed')
  })

  // Microsoft Himalaya's Windows record is "Microsoft Himalaya": PDFKit
  // writes it as Microsoft_Himalaya, a sound name, and refusing it would
  // refuse a font Windows ships.
  test('admits a space, which PDFKit writes as an underscore', () => {
    expect(named([windows(1, 'Probe'), windows(2, 'Bold'), windows(6, 'Probe Bold')])).toMatchObject({ ok: true, names: { postScriptName: 'Probe Bold' } })
  })

  // A name past the specification's 63 characters is past what a PDF
  // reader is asked to take, and one of 65,535 bytes would be decoded for
  // nothing: refused before it is read.
  test('is at most 63 characters, the specification says, and one longer is refused unread', () => {
    expect(named([windows(1, 'Probe'), windows(2, 'Bold'), windows(6, 'P'.repeat(63))])).toMatchObject({ ok: true })
    expect(refused([windows(1, 'Probe'), windows(2, 'Bold'), windows(6, 'P'.repeat(64))])).toMatchObject({ message: expect.stringContaining('has a PostScript name longer than 63 characters') as string })
    expect(refused([windows(1, 'Probe'), windows(2, 'Bold'), macintosh(6, 'P'.repeat(64))]).code).toBe('malformed')
  })

  // Corbel Light's Unicode record says Corbel-Light and its Windows one
  // CorbelLight, which fontkit returns: the records may differ, and the one
  // returned is the best, as every name's is.
  test("is the best record's where records differ", () => {
    expect(named([{ platform: 0, encoding: 3, language: 0, id: 6, text: 'Probe-Light' }, windows(1, 'Probe'), windows(2, 'Light'), windows(6, 'ProbeLight')])).toMatchObject({ ok: true, names: { postScriptName: 'ProbeLight' } })
  })

  // PDFKit keeps a document's faces by the PostScript name fontkit returns
  // and draws a face as another of that name (0043), and which record
  // fontkit returns depends on their order and languages: the last English
  // one, so a Macintosh record after the Windows one the reader returns.
  // A renderer that tells its faces apart by the best name alone would
  // miss a face whose later record is another face's name. Every name a
  // record of ID 6 holds is handed back, once, in table order.
  test('is one of the names its records hold, each handed back once, in table order', () => {
    const records = [{ platform: 0, encoding: 3, language: 0, id: 6, text: 'Probe-Light' }, windows(1, 'Probe'), windows(2, 'Light'), windows(6, 'ProbeLight'), macintosh(6, 'Probe-Light')] as const
    expect(named(records)).toMatchObject({ ok: true, names: { postScriptName: 'ProbeLight', postScriptNames: ['Probe-Light', 'ProbeLight'] } })
    expect(named(LEAST)).toMatchObject({ ok: true, names: { postScriptName: 'Probe-Bold', postScriptNames: ['Probe-Bold'] } })
  })

  // A font with no name PDFKit can write is named `undefined` in the PDF,
  // or throws inside it. Each record is held as fontkit decodes it: a
  // record fontkit reads a byte at a time -- the Unicode platform past its
  // encoding 6 -- writes a NUL before every letter of a UTF-16 name, one it
  // cannot decode as text -- Windows symbol, a Macintosh language of its
  // own encoding -- throws inside PDFKit where fontkit picks it, so neither
  // is admitted beside a sound record.
  test.each([
    ['no PostScript name', [windows(1, 'Probe'), windows(2, 'Bold')], 'has no PostScript name (name ID 6)'],
    ['an empty one', [windows(1, 'Probe'), windows(2, 'Bold'), windows(6, '')], 'has an empty PostScript name'],
    ['one in an encoding this does not read', [windows(1, 'Probe'), windows(2, 'Bold'), { platform: 3, encoding: 2, language: 0x411, id: 6, text: 'Probe' }], 'has a PostScript name in an encoding this does not read'],
    ['one in the symbol encoding, beside a Windows one', [windows(1, 'Probe'), windows(2, 'Bold'), windows(6, 'Probe'), { platform: 3, encoding: 0, language: 0x407, id: 6, text: 'Probe' }], 'has a PostScript name in an encoding this does not read'],
    ['one of the Unicode platform past its encoding 6, which fontkit reads a byte at a time', [windows(1, 'Probe'), windows(2, 'Bold'), { platform: 0, encoding: 7, language: 0, id: 6, text: 'AxByCz' }], 'has a PostScript name in an encoding this does not read'],
    ['one in Mac Roman in Icelandic, which fontkit decodes as Mac Icelandic, beside a Windows one', [windows(1, 'Probe'), windows(2, 'Bold'), { ...macintosh(6, 'Probe'), language: 15 }, windows(6, 'Probe')], 'has a PostScript name in an encoding this does not read'],
  ] as const)('refuses %s', (_, entries, said) => {
    expect(refused(entries)).toMatchObject({ code: 'malformed', message: expect.stringContaining(said) as string })
  })
})

describe('the naming table', () => {
  // A family or subfamily a builder cannot show leaves a person choosing a
  // face by nothing; a UTF-16 string of an odd length is no UTF-16.
  test.each([
    ['no family', [windows(2, 'Bold'), windows(6, 'Probe')], 'has no family and subfamily name'],
    ['no subfamily', [windows(1, 'Probe'), windows(6, 'Probe')], 'has no family and subfamily name'],
    ['a name in UTF-16 of an odd number of bytes', [{ ...windows(1, 'Probe') }, windows(2, 'Bold'), windows(6, 'Probe')], 'has a name in UTF-16 of an odd number of bytes'],
  ] as const)('refuses %s', (_, entries, said) => {
    const table = name(entries)
    // The first record's length, made odd where the case says so.
    if (said.includes('odd')) new DataView(table.buffer).setUint16(6 + 8, 9)
    const read = readFont(font({ name: table }))
    expect(read).toMatchObject({ ok: false, code: 'malformed', message: expect.stringContaining(said) as string })
  })

  // A version the specification does not define is not read as another,
  // and a string fontkit would read past the file throws inside pdfmake.
  test('refuses a version past 1, and a string past the end of the file', () => {
    const later = name(LEAST)
    new DataView(later.buffer).setUint16(0, 2)
    expect(readFont(font({ name: later }))).toMatchObject({ code: 'malformed', message: expect.stringContaining('has a naming table of a version the specification does not define') as string })
    const far = name(LEAST)
    new DataView(far.buffer).setUint16(6 + 10, 0xff00)
    expect(readFont(font({ name: far }))).toMatchObject({ code: 'malformed', message: expect.stringContaining('has its naming table (name) cut off') as string })
  })

  // fontkit decodes every record when PDFKit asks for the PostScript name.
  // Records that point many times at one long string -- 65,535 of them at a
  // string of 65,535 bytes is four gigabytes from a font of a megabyte --
  // would stall the render inside pdfmake; their lengths may add up to no
  // more than the font holds.
  test("refuses records whose strings add up to more than the font's bytes", () => {
    const repeated = Array.from({ length: 40 }, () => windows(19, 'A sample text that every record points at.'.repeat(20)))
    const table = name([...LEAST, ...repeated], { storage: [...LEAST, repeated[0]!].flatMap(nameBytes) })
    const view = new DataView(table.buffer)
    // Every repeated record points at the one sample string, after the three least names.
    const at = LEAST.flatMap(nameBytes).length
    for (let index = 0; index < repeated.length; index++) view.setUint16(6 + 12 * (LEAST.length + index) + 10, at)
    expect(readFont(font({ name: table }))).toMatchObject({ code: 'malformed', message: expect.stringContaining('has name strings that add up to more bytes than the font holds') as string })
  })

  // fontkit decodes the four platforms the specification names for names,
  // and a record of any other -- 4 is custom, a character map's alone --
  // loses it the whole table: PDFKit names the font `undefined`.
  test.each([4, 7])('refuses a record of platform %i, whatever name it holds', (platform) => {
    expect(named([...LEAST, { platform, encoding: 0, language: 0, id: 19, text: 'Sample' }])).toMatchObject({ ok: false, code: 'malformed', message: expect.stringContaining('has a name record of a platform other than Unicode, Macintosh, ISO and Windows') as string })
  })

  // The first record of the version 1 table below, the family, and where its language tag's record and string are.
  const TAGGED: readonly NameEntry[] = [{ ...windows(1, 'Probe'), language: 0x8000 }, windows(2, 'Bold'), windows(6, 'Probe-Bold')]
  const tagRecord = 6 + 12 * TAGGED.length + 2

  // A version 1 table's language tags are decoded too, and count: a
  // record's language from 0x8000 up names one by its index.
  test('reads a version 1 table, its language tags held inside the file', () => {
    expect(readFont(font({ name: name(TAGGED, { tags: ['en-US'] }) }))).toMatchObject({ ok: true, names: { family: 'Probe' } })
  })

  // fontkit decodes every language tag when it decodes the table, and looks
  // a record's tag up by its index: one past the file throws, one past the
  // tags loses it the table, and many tag records at one long string cost
  // it far more than the file, as the name strings would.
  test('refuses a language tag past the end of the file', () => {
    const table = name(TAGGED, { tags: ['en-US'] })
    new DataView(table.buffer).setUint16(tagRecord + 2, 0xff00)
    expect(readFont(font({ name: table }))).toMatchObject({ ok: false, code: 'malformed', message: expect.stringContaining('has its naming table (name) cut off') as string })
  })

  // A count of tags is held to the bytes it counts before one tag is read
  // by it: a reader that read them one by one would read 65,535 records of
  // whatever follows before it found the end, and say it ran out elsewhere.
  test('refuses a count of language tags past the end of the file where the count is', () => {
    const table = name(TAGGED, { tags: ['en-US'] })
    new DataView(table.buffer).setUint16(tagRecord - 2, 0xffff)
    const bytes = font({ name: table, last: 'name' })
    expect(readFont(bytes)).toMatchObject({ ok: false, code: 'malformed', message: expect.stringContaining(`has its naming table (name) cut off at byte ${tableAt(bytes, 'name').offset + tagRecord}`) as string })
  })

  test('refuses a record that names a language tag the table does not hold', () => {
    expect(readFont(font({ name: name([{ ...TAGGED[0]!, language: 0x8001 }, ...TAGGED.slice(1)], { tags: ['en-US'] }) }))).toMatchObject({ ok: false, code: 'malformed', message: expect.stringContaining('has a name record whose language tag the naming table does not hold') as string })
  })

  test("refuses language tags whose strings add up to more than the font's bytes", () => {
    const long = 'en-x-'.padEnd(400, 'a')
    // One string stored, at the first tag's offset, after the names.
    const table = name(TAGGED, { tags: Array.from({ length: 40 }, () => long), storage: [...TAGGED.flatMap(nameBytes), ...nameBytes(windows(0, long))] })
    const view = new DataView(table.buffer)
    // Every tag record points at the first tag's string.
    for (let index = 1; index < 40; index++) view.setUint16(tagRecord + 4 * index + 2, view.getUint16(tagRecord + 2))
    expect(readFont(font({ name: table }))).toMatchObject({ ok: false, code: 'malformed', message: expect.stringContaining('has name strings that add up to more bytes than the font holds') as string })
  })

  // A version 0 table has no tags, and fontkit looks none up there: a language past 0x8000 is a language it has no name for, and refusing it would refuse a font PDFKit prints.
  test('reads a version 0 record of a language from 0x8000 up', () => {
    expect(named(TAGGED)).toMatchObject({ ok: true, names: { family: 'Probe' } })
  })
})
