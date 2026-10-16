import { STARTER_IMAGES, STARTERS } from '@formancy/report-corpus'
import { resolveReport } from '@formancy/report-runtime'
import { describe, expect, test } from 'vitest'
import { encodeStarters, decodeStarters } from './codec.js'
import { BLANK, imagesOf, starterLabel, studioStarters } from './starters.js'

const decoded = decodeStarters(encodeStarters(STARTERS, STARTER_IMAGES))

describe("the Studio's starters", () => {
  // The picker offers the corpus's starters in the corpus's order, then a
  // blank report. A list written out here would keep offering a starter the
  // corpus dropped, or never offer one it added; the names are derived from
  // the ids for the same reason.
  test('are the corpus’s, in its order, and a blank report last', () => {
    const listed = studioStarters(decoded.starters)
    expect(listed.map((starter) => starter.id)).toEqual([...STARTERS.map((starter) => starter.id), 'blank'])
    expect(listed.map(starterLabel)).toEqual(['Service inspection', 'Quotation', 'Grouped equipment', 'Blank'])
  })

  // A blank report with no datasets still previews: an empty A4 page, not a
  // refusal for data it never asked for, which would greet the person who
  // picked Blank with an error.
  test('include a blank report that resolves against its data', () => {
    const resolved = resolveReport(BLANK.report, BLANK.data, { mode: 'final', parameters: BLANK.parameters, creationDate: '2026-10-16T08:00:00Z' })
    expect(resolved.ok).toBe(true)
  })

  // The host's lookup gives bytes only for the asset and the digest the data
  // names together (0010): an asset asked for by its id with another digest
  // is not the approved one, and is not handed over.
  test('hand over an image only for its id and its digest', () => {
    const images = imagesOf(decoded.images)
    const [photo] = decoded.images
    if (photo === undefined) throw new Error('the corpus has no starter image')
    expect(images({ asset: photo.asset, digest: photo.digest })?.bytes).toEqual(photo.bytes)
    expect(images({ asset: photo.asset, digest: 'sha256:00' })).toBeUndefined()
    expect(images({ asset: 'another', digest: photo.digest })).toBeUndefined()
  })
})
