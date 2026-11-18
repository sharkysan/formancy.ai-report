import { RenderRefusal } from '@formancy/report-runtime'

/**
 * A document's creation date as a Word file's core properties state it
 * (0068), or its refusal: the one place a clock or a time zone could
 * reach a file's bytes through the document, and so rules of its own.
 */

/**
 * The forms of a date ECMAScript reads the same on every machine: a date
 * and time that states its zone, `Z` or an offset, and a date alone,
 * which is its first moment in UTC. A date and time without a zone is
 * read in the machine's own, and anything else in a way the platform
 * chooses.
 */
const INSTANT = /^(\d{4}|[+-]\d{6})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?(?:Z|([+-])(\d{2}):(\d{2})))?$/

/**
 * The creation date as the core properties state it: the document's
 * instant in UTC, to the second, written out here and never copied. The
 * runtime writes an instant with its zone (`canonicalInstant`); a
 * document made otherwise may state a date that is another moment in
 * another time zone, and the same document would then be another file
 * there, so one that states no instant is refused. So is one that states
 * a day or a time no calendar has: the platform reads on past it -- 30
 * February as 2 March, an hour 24 as the first of the next day -- and the
 * instant written would be a date the document does not state. The PDF
 * renderer reads the date as the platform does, and draws each of these.
 */
export function createdOf(stated: string): string {
  const instant = new Date(stated)
  if (Number.isNaN(instant.getTime())) throw new RenderRefusal('unsupported', `the creation date '${stated}' is not a date`, 'info.creationDate')
  const fields = INSTANT.exec(stated)
  if (fields === null)
    throw new RenderRefusal(
      'unsupported',
      `the creation date '${stated}' states no instant: a Word file is dated by an ISO 8601 date and time with its zone, Z or an offset, and a date without one is another moment on another machine`,
      'info.creationDate',
    )
  // The instant's own fields where the date was stated, at its offset from UTC: those it states, or the platform read another date of it.
  const [year, month, day, hour = 0, minute = 0, second = 0] = fields.slice(1, 7).map((field) => (field === undefined ? undefined : Number(field)))
  const offset = fields[7] === undefined ? 0 : (fields[7] === '-' ? -1 : 1) * (Number(fields[8]) * 60 + Number(fields[9]))
  const there = new Date(instant.getTime() + offset * 60_000)
  const read = [there.getUTCFullYear(), there.getUTCMonth() + 1, there.getUTCDate(), there.getUTCHours(), there.getUTCMinutes(), there.getUTCSeconds()]
  if ([year, month, day, hour, minute, second].some((field, index) => field !== read[index]))
    throw new RenderRefusal(
      'unsupported',
      `the creation date '${stated}' states a day or a time no calendar has: read on to the date after it, as the platform reads it, a Word file would be dated otherwise than the document`,
      'info.creationDate',
    )
  const created = `${instant.toISOString().slice(0, 19)}Z`
  // A core property's date is XML Schema's, of four digits a year from 0001: the year 0000, one before it and one past 9999 are no such date.
  if (!/^\d{4}-/.test(created) || created.startsWith('0000-'))
    throw new RenderRefusal('unsupported', 'the creation date is of a year a Word file cannot state', 'info.creationDate')
  return created
}
