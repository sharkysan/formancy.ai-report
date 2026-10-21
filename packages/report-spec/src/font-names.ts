/**
 * A font's names, from its naming table (0040): what an approver reads and
 * a builder shows, and the PostScript name the PDF names the font by.
 *
 * - **Returned, never judged.** The family and subfamily -- the
 *   typographic names, IDs 16 and 17, before IDs 1 and 2 -- the full name,
 *   the version, the copyright and the licence description and its
 *   address are handed back for a person to read. A customer's font licence
 *   is the customer's; nothing here decides what one says.
 * - **The PostScript name cannot write PDF syntax.** PDFKit writes it into
 *   the PDF as a name object as it stands, each space replaced by an
 *   underscore and nothing else escaped (`EmbeddedFont.embed`, pdfkit.js
 *   2670; `PDFObject.convert`, 120-122), so a slash, a bracket or a
 *   percent sign in it would write PDF syntax the font chose, and a number
 *   sign would start an escape. Which record fontkit returns depends on
 *   their order and languages, so every record of name ID 6 is held to the
 *   specification's rule -- at most 63 characters of printable ASCII, none
 *   of `[ ] ( ) { } < > / %` -- with a number sign refused besides and a
 *   space admitted, since PDFKit replaces it: Microsoft Himalaya's Windows
 *   record is `Microsoft Himalaya`. Each is held as fontkit decodes it, so
 *   each must be in an encoding fontkit and this decode alike: UTF-16 on
 *   the Unicode platform's encodings 0 to 6 and Windows' 1 and 10, or Mac
 *   Roman in English. fontkit reads any other encoding a byte at a time,
 *   or not as a string at all: a name of UTF-16 read so is a NUL before
 *   every letter in the PDF, and one it cannot decode throws inside PDFKit.
 *   The name returned is the best record's, as for every other name:
 *   Corbel Light's Unicode record says `Corbel-Light` where its Windows
 *   record, which fontkit returns, says `CorbelLight`.
 * - **The table is one fontkit decodes.** fontkit loses the whole table,
 *   and PDFKit names the font `undefined`, where a record is of a platform
 *   past the four the specification names for names, or a version 1
 *   table's record names a language tag the table does not hold; both are
 *   refused.
 * - **Every string fontkit decodes is bounded.** fontkit decodes every
 *   record of the table when PDFKit asks for the PostScript name, so records
 *   that point many times at one long string would cost it far more than
 *   the file: their lengths, with a version 1 table's language tags, may
 *   add up to no more than the font's own size.
 *
 * One record is decoded for each name returned, the best of its ID: a
 * Windows Unicode record in English (United States), then any Windows
 * Unicode record, then a Unicode one, then a Macintosh Roman one in
 * English. UTF-16 is decoded here, a lone surrogate as U+FFFD, and Mac
 * Roman from its table below, with no `TextDecoder`, which report-spec's
 * library does not have.
 */
import type { FontFile, TableRecord } from './font-file.js'
import { refuse } from './font-refusal.js'

/** What a font says it is called, and what it says of its licence, as it says it. */
export interface FontNames {
  /** The typographic family (name ID 16), or the family (1). */
  readonly family: string
  /** The typographic subfamily (17), or the subfamily (2). */
  readonly subfamily: string
  /** The PostScript name (6), which the PDF names the font by: PDFKit writes it after a subset tag, each space as an underscore. */
  readonly postScriptName: string
  /** The full name (4). */
  readonly fullName?: string
  /** The version string (5). */
  readonly version?: string
  /** The copyright notice (0). */
  readonly copyright?: string
  /** The licence description (13), as the font states it. */
  readonly licence?: string
  /** The licence information address (14), as the font states it, never opened. */
  readonly licenceUrl?: string
}

/** A name record, as the table lists it. */
interface NameRecord {
  readonly platform: number
  readonly encoding: number
  readonly language: number
  readonly id: number
  readonly at: number
  readonly length: number
}

/** Mac Roman's upper half, 0x80 to 0xFF, as Apple's mapping to Unicode gives it; the lower half is ASCII. */
const MAC_ROMAN =
  'ÄÅÇÉÑÖÜáàâäãåçéèêëíìîïñóòôöõúùûü†°¢£§•¶ß®©™´¨≠ÆØ∞±≤≥¥µ∂∑∏π∫ªºΩæø¿¡¬√ƒ≈∆«»… ÀÃÕŒœ–—“”‘’÷◊ÿŸ⁄€‹›ﬁﬂ‡·‚„‰ÂÊÁËÈÍÎÏÌÓÔÒÚÛÙıˆ˜¯˘˙˚¸˝˛ˇ'

/** The characters a PostScript name may not hold among printable ASCII: the specification's ten, and the number sign, which starts an escape in a PDF name. */
const NOT_IN_POSTSCRIPT_NAMES = new Set([...'[](){}<>/%#'].map((character) => character.charCodeAt(0)))

/** The longest PostScript name the specification allows. */
const POSTSCRIPT_NAME_LENGTH = 63

/** The last of the Unicode platform's encodings the specification defines, 0 to 6, the ones fontkit decodes as UTF-16. */
const LAST_UNICODE_ENCODING = 6

/** How a record `rank` ranks is encoded: Mac Roman on the Macintosh platform, UTF-16 on Unicode's and Windows'. */
function encodingOf(record: NameRecord): 'utf-16' | 'mac-roman' {
  return record.platform === 1 ? 'mac-roman' : 'utf-16'
}

/**
 * How good a record is as the one name of its ID a person reads, lower
 * better; undefined for one never read. A ranked record is one fontkit
 * decodes as this does: Windows symbol (3, 0) is UTF-16 to the
 * specification and no string to fontkit, and Mac Roman in another
 * language than English is, for fontkit, another Macintosh encoding.
 */
function rank(record: NameRecord): number | undefined {
  if (record.platform === 3 && (record.encoding === 1 || record.encoding === 10)) return record.language === 0x409 ? 0 : 1
  if (record.platform === 0 && record.encoding <= LAST_UNICODE_ENCODING) return 2
  if (record.platform === 1 && record.encoding === 0 && record.language === 0) return 3
  return undefined
}

/** The last platform fontkit decodes a name of: Unicode, Macintosh, ISO and Windows, 0 to 3. */
const LAST_NAME_PLATFORM = 3

/** The first language ID that names a version 1 table's language tag, by its index from here. */
const FIRST_LANGUAGE_TAG = 0x8000

/** The naming table's records, each string held inside the file, and their lengths held to the font's size. */
function records(file: FontFile, table: TableRecord): NameRecord[] {
  const version = file.u16(table.offset, table)
  if (version > 1) refuse('malformed', 'has a naming table of a version the specification does not define')
  const count = file.u16(table.offset + 2, table)
  const storage = table.offset + file.u16(table.offset + 4, table)
  file.need(table.offset + 6, 12 * count, table)
  const found: NameRecord[] = []
  let decoded = 0
  for (let index = 0; index < count; index++) {
    const record = table.offset + 6 + 12 * index
    const platform = file.u16(record, table)
    if (platform > LAST_NAME_PLATFORM) refuse('malformed', 'has a name record of a platform other than Unicode, Macintosh, ISO and Windows')
    const length = file.u16(record + 8, table)
    const at = storage + file.u16(record + 10, table)
    file.need(at, length, table)
    decoded += length
    found.push({ platform, encoding: file.u16(record + 2, table), language: file.u16(record + 4, table), id: file.u16(record + 6, table), at, length })
  }
  if (version === 1) {
    const tags = table.offset + 6 + 12 * count
    const tagCount = file.u16(tags, table)
    file.need(tags + 2, 4 * tagCount, table)
    for (let index = 0; index < tagCount; index++) {
      const length = file.u16(tags + 2 + 4 * index, table)
      file.need(storage + file.u16(tags + 4 + 4 * index, table), length, table)
      decoded += length
    }
    // fontkit looks a language from 0x8000 up among the tags, and loses the table where it is not there.
    if (found.some((record) => record.language >= FIRST_LANGUAGE_TAG && record.language - FIRST_LANGUAGE_TAG >= tagCount)) refuse('malformed', 'has a name record whose language tag the naming table does not hold')
  }
  if (decoded > file.length) refuse('malformed', 'has name strings that add up to more bytes than the font holds')
  return found
}

/** A record's string, decoded. */
function decode(file: FontFile, record: NameRecord): string {
  const bytes = file.bytes.subarray(record.at, record.at + record.length)
  if (encodingOf(record) === 'mac-roman') {
    let text = ''
    for (const byte of bytes) text += byte < 0x80 ? String.fromCharCode(byte) : MAC_ROMAN[byte - 0x80]!
    return text
  }
  if (bytes.length % 2 !== 0) refuse('malformed', 'has a name in UTF-16 of an odd number of bytes')
  let text = ''
  for (let at = 0; at < bytes.length; at += 2) {
    const unit = (bytes[at]! << 8) | bytes[at + 1]!
    const next = at + 3 < bytes.length ? (bytes[at + 2]! << 8) | bytes[at + 3]! : -1
    if (unit >= 0xd800 && unit <= 0xdbff && next >= 0xdc00 && next <= 0xdfff) {
      text += String.fromCharCode(unit, next)
      at += 2
    } else text += unit >= 0xd800 && unit <= 0xdfff ? '�' : String.fromCharCode(unit)
  }
  return text
}

/** The PostScript name, the best record's, once every record of name ID 6 is one fontkit decodes alike and holds a name PDFKit writes as one PDF name. */
function postScriptName(file: FontFile, all: readonly NameRecord[]): string {
  for (const record of all) {
    if (record.id !== 6) continue
    if (rank(record) === undefined) refuse('malformed', 'has a PostScript name in an encoding this does not read')
    // Read no further than the longest name allowed: a record of 65,535 bytes is refused unread.
    if (record.length > (encodingOf(record) === 'utf-16' ? 2 : 1) * POSTSCRIPT_NAME_LENGTH) refuse('malformed', `has a PostScript name longer than ${POSTSCRIPT_NAME_LENGTH} characters`)
    const text = decode(file, record)
    for (const character of text) {
      const point = character.codePointAt(0)!
      if (point !== 0x20 && (point < 33 || point > 126 || NOT_IN_POSTSCRIPT_NAMES.has(point))) refuse('malformed', 'has a PostScript name with a character PDFKit would write into the PDF as syntax: a delimiter, a number sign, or one outside printable ASCII')
    }
    if (text.trim().length === 0) refuse('malformed', 'has an empty PostScript name')
  }
  // Every record of name ID 6 is ranked by now, so there is a best one wherever there is one.
  const name = best(file, all, 6)
  if (name === undefined) refuse('malformed', 'has no PostScript name (name ID 6)')
  return name
}

/** The best record of name ID `id`, decoded; undefined when none is one this reads. */
function best(file: FontFile, all: readonly NameRecord[], id: number): string | undefined {
  let chosen: NameRecord | undefined
  let chosenRank = Number.POSITIVE_INFINITY
  for (const record of all) {
    const ranked = record.id === id ? rank(record) : undefined
    if (ranked !== undefined && ranked < chosenRank) {
      chosen = record
      chosenRank = ranked
    }
  }
  return chosen === undefined ? undefined : decode(file, chosen)
}

/** A font's names, read from its naming table. */
export function readNames(file: FontFile): FontNames {
  const all = records(file, file.table('name'))
  const postScript = postScriptName(file, all)
  const family = best(file, all, 16) ?? best(file, all, 1)
  const subfamily = best(file, all, 17) ?? best(file, all, 2)
  if (family === undefined || subfamily === undefined) refuse('malformed', 'has no family and subfamily name (name IDs 1 and 2)')
  const optional = { fullName: 4, version: 5, copyright: 0, licence: 13, licenceUrl: 14 } as const
  const names: { -readonly [K in keyof FontNames]: FontNames[K] } = { family, subfamily, postScriptName: postScript }
  for (const [key, id] of Object.entries(optional) as [keyof typeof optional, number][]) {
    const text = best(file, all, id)
    if (text !== undefined) names[key] = text
  }
  return names
}
