import { STARTER_IMAGES, STARTERS } from '@formancy/report-corpus'
import { describe, expect, test } from 'vitest'
import { decodeStarters, encodeStarters, fromBase64, toBase64 } from './codec.js'
import { starters, STARTERS_IMPORT, STARTERS_MODULE, startersSource } from './plugin.js'

/** The module the plugin writes, as the page receives it: parsed from its source text. */
function received(): ReturnType<typeof decodeStarters> {
  const source = startersSource()
  const json = source.slice('export default '.length).trimEnd()
  return decodeStarters(JSON.parse(json) as Parameters<typeof decodeStarters>[0])
}

describe('the starters, from the corpus to the page', () => {
  // The page never imports the corpus; it gets the plugin's JSON. A value
  // JSON cannot carry -- a BigInt, undefined, a byte array in the data --
  // would arrive changed or not at all, and the Studio would edit and print
  // a starter that is not the corpus's, while the PDF tests in
  // report-render-pdf proved the corpus's. Compared whole, as parsed.
  test('arrive as the corpus has them', () => {
    const { starters } = received()
    expect(starters.map((starter) => starter.id)).toEqual(STARTERS.map((starter) => starter.id))
    for (const [index, starter] of starters.entries()) {
      const original = STARTERS[index]
      expect(starter).toEqual({ id: original?.id, title: original?.title, proves: original?.proves, report: original?.report, data: original?.data, parameters: original?.parameters })
    }
  })

  // An image travels as base64. A byte lost or changed on the way would no
  // longer be what its digest pins, and the photo the inspection prints is
  // the host's bytes by id and digest (0010): the Studio would show a
  // picture the starter does not have, or none.
  test("carry each image's bytes exactly", () => {
    const { images } = received()
    expect(images.map(({ asset, digest, mediaType }) => ({ asset, digest, mediaType }))).toEqual(STARTER_IMAGES.map(({ asset, digest, mediaType }) => ({ asset, digest, mediaType })))
    for (const [index, image] of images.entries()) expect(image.bytes).toEqual(new Uint8Array(STARTER_IMAGES[index]?.bytes ?? []))
  })

  // Every byte value, across a boundary of the base64 alphabet's groups:
  // `String.fromCharCode` and `btoa` fail on code units past 255, and a
  // decoder that read the text as UTF-8 would change every byte past 127.
  test('round-trips every byte value through base64', () => {
    const bytes = Uint8Array.from({ length: 256 * 3 + 1 }, (_, index) => index % 256)
    expect(fromBase64(toBase64(bytes))).toEqual(bytes)
    expect(toBase64(new Uint8Array([0xff, 0xfe, 0x00]))).toBe('//4A')
  })

  // The id is what the notices plugin is told is this repository's own; a
  // module id without the bundler's mark could be a file's, and another
  // plugin would transform it. The plugin answers for that module and no
  // other, so it cannot shadow a file of the same name.
  test('are one module the bundler marks as no file', () => {
    expect(STARTERS_MODULE.startsWith('\0')).toBe(true)
    const plugin = starters()
    const resolveId = plugin.resolveId as (id: string) => string | undefined
    const load = plugin.load as (id: string) => string | undefined
    expect(resolveId(STARTERS_IMPORT)).toBe(STARTERS_MODULE)
    expect(resolveId('./starters.js')).toBeUndefined()
    expect(load(STARTERS_MODULE)).toBe(startersSource())
    expect(load(STARTERS_IMPORT)).toBeUndefined()
    expect(encodeStarters([], [])).toEqual({ starters: [], images: [] })
  })
})
