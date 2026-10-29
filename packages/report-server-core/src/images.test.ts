import { assetDigest, checkSvg, cleanSvg, isDigest, MAX_ASSET_BYTES, MAX_ASSET_SIDE, MAX_SVG_BYTES } from '@formancy/report-spec'
import { describe, expect, test } from 'vitest'
import type { RolePolicy } from './actions.js'
import type { Asking } from './drafts.js'
import { keepImage, readImage } from './images.js'
import type { ReportIdentity } from './identity.js'
import type { StoredImage, TemplateStore } from './store.js'
import { REFUSALS } from './wire.js'

/**
 * The image use cases (0049): who may keep and read an image, and what a
 * keep checks of the bytes before a store sees them, in the order it checks
 * it. They run here against a store in memory, enough to hold what they ask
 * of the port; the file store has its own suite, in report-server, and that
 * is the one a deployment runs.
 */
function memoryStore() {
  const images = new Map<string, StoredImage>()
  /** Every call the use cases made on the port, in order: a refusal that comes before the store is asked leaves this empty. */
  const asked: string[] = []
  const key = (tenant: string, digest: string): string => JSON.stringify([tenant, digest])
  const refused = (): never => {
    throw new Error('the image use cases do not touch drafts')
  }
  const store: TemplateStore = {
    list: refused,
    newest: refused,
    save: refused,
    async keepImage(tenant, digest, image) {
      asked.push('keepImage')
      images.set(key(tenant, digest), image)
    },
    async readImage(tenant, digest) {
      asked.push('readImage')
      return images.get(key(tenant, digest))
    },
    async imageKind(tenant, digest) {
      asked.push('imageKind')
      return images.get(key(tenant, digest))?.mediaType
    },
  }
  /** Everything the store holds, as text: equal before and after a request that must keep nothing. */
  const snapshot = (): string => JSON.stringify([...images].map(([name, image]) => [name, image.mediaType, [...image.bytes]]))
  return { store, asked, snapshot }
}

const policy: RolePolicy = { author: ['report-authors'], publisher: ['report-publishers'], admin: ['report-admins'] }
const AUTHOR = 'report-authors'
const PUBLISHER = 'report-publishers'
const ADMIN = 'report-admins'

/** Who asks: a subject of a tenant holding `role`, or none. */
const asking = (store: TemplateStore, role?: string, who: Partial<ReportIdentity> = {}): Asking => ({
  identity: { subject: 'u-1', tenant: 'acme', roles: role === undefined ? [] : [role], ...who },
  roles: policy,
  store,
})

// Images made in code from their parts, so that no test carries a binary
// file a reviewer cannot read. The library has no Buffer and no zlib, and
// the header reader inflates nothing, so a PNG's image data is any bytes.

/** CRC-32 one bit at a time, as PNG's annex D defines it. */
function crc32(bytes: readonly number[]): number {
  let crc = 0xffffffff
  for (const byte of bytes) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit++) crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1
  }
  return (crc ^ 0xffffffff) >>> 0
}
const u32 = (value: number): number[] => [(value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff]
const chunk = (type: string, data: readonly number[]): number[] => {
  const typed = [...[...type].map((character) => character.charCodeAt(0)), ...data]
  return [...u32(data.length), ...typed, ...u32(crc32(typed))]
}

/** A truecolour PNG of this size; two sizes are two images, with two digests. */
function png(width = 8, height = 8): Uint8Array {
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
  return Uint8Array.from([...signature, ...chunk('IHDR', [...u32(width), ...u32(height), 8, 2, 0, 0, 0]), ...chunk('IDAT', [0x78, 0x9c, 1, 2, 3, 4]), ...chunk('IEND', [])])
}

const segment = (marker: number, body: readonly number[]): number[] => [0xff, marker, (body.length + 2) >> 8, (body.length + 2) & 0xff, ...body]

/** A greyscale JPEG of this size up to its scan header and, unless `cutOff`, its end marker. */
function jpeg(width = 8, height = 8, cutOff = false): Uint8Array {
  const frame = [8, height >> 8, height & 0xff, width >> 8, width & 0xff, 1, 1, 0x11, 0]
  return Uint8Array.from([0xff, 0xd8, ...segment(0xc0, frame), ...segment(0xda, [1, 1, 0, 0, 63, 0]), ...(cutOff ? [] : [0xff, 0xd9])])
}

const ascii = (text: string): Uint8Array => Uint8Array.from(text, (character) => character.charCodeAt(0))
const SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10" fill="#c00"/></svg>'

/** An SVG in the one form `cleanSvg` writes, which is what a builder keeps. */
function svg(): Uint8Array {
  const cleaned = cleanSvg(ascii(SVG))
  if (!cleaned.ok) throw new Error(`the fixture is refused: ${cleaned.code}`)
  return cleaned.bytes
}

/** The 64 hexadecimal digits of the SHA-256 of `bytes`, as a path carries them. */
const hexOf = (bytes: Uint8Array): string => assetDigest(bytes).slice('sha256:'.length)

describe('keepImage', () => {
  // The PNG is the plain case: kept under the token's tenant by the digest
  // with its prefix, as the report names it, and answered with that digest.
  // The type kept is the bytes', so a report can never say the bytes are
  // another kind than they are.
  test('keeps a PNG under the asking tenant and its digest, answering the digest', async () => {
    const { store } = memoryStore()
    const bytes = png()
    const kept = await keepImage(asking(store, AUTHOR), hexOf(bytes), 'image/png', bytes)
    expect(kept).toEqual({ ok: true, status: 200, body: { digest: assetDigest(bytes) } })
    expect(await store.readImage('acme', assetDigest(bytes))).toEqual({ mediaType: 'image/png', bytes })
    expect(await store.imageKind('other', assetDigest(bytes))).toBeUndefined()
  })

  // A JPEG and an SVG go the same way under their own types; the SVG's
  // bytes are the cleaned drawing, which is the form a builder keeps.
  test('keeps a JPEG and a cleaned SVG under their own media types', async () => {
    const { store } = memoryStore()
    for (const [bytes, mediaType] of [[jpeg(), 'image/jpeg'], [svg(), 'image/svg+xml']] as const) {
      expect((await keepImage(asking(store, AUTHOR), hexOf(bytes), mediaType, bytes)).status, mediaType).toBe(200)
      expect(await store.readImage('acme', assetDigest(bytes)), mediaType).toEqual({ mediaType, bytes })
    }
  })

  // A builder that did not hear the answer sends the same image again. The
  // second keep is the first's answer, not a refusal for a digest already
  // held.
  test('answers a second keep of the same image as the first', async () => {
    const { store } = memoryStore()
    const bytes = png()
    const first = await keepImage(asking(store, AUTHOR), hexOf(bytes), 'image/png', bytes)
    const second = await keepImage(asking(store, AUTHOR), hexOf(bytes), 'image/png', bytes)
    expect(second).toEqual(first)
    expect(second.ok).toBe(true)
  })

  // Only an author keeps an image (the actions table). The refusal comes
  // before the digest, the type or the bytes are looked at, and before the
  // store is asked.
  test('refuses a publisher, an administrator and a token with no capacity as forbidden, before looking at anything else', async () => {
    const { store, asked } = memoryStore()
    for (const role of [PUBLISHER, ADMIN, undefined]) {
      expect(await keepImage(asking(store, role), 'not a digest', 'text/plain', Uint8Array.of(0)), String(role)).toEqual({ ok: false, status: 403, body: REFUSALS.forbidden })
    }
    expect(asked).toEqual([])
  })

  // The digest is a path segment the store turns into a name: only 64
  // lower-case hexadecimal digits are one. Anything else -- upper case, a
  // prefix, the wrong length, a path -- is refused before the bytes are read.
  test('refuses a digest that is not 64 lower-case hexadecimal digits as digest-invalid, before the bytes', async () => {
    const { store, asked } = memoryStore()
    const bytes = png()
    const hex = hexOf(bytes)
    for (const digest of [hex.toUpperCase(), `sha256:${hex}`, hex.slice(1), `${hex}0`, '', '../'.repeat(22).slice(0, 64), `${hex.slice(0, 63)}g`]) {
      expect(await keepImage(asking(store, AUTHOR), digest, 'not a type', Uint8Array.of(0)), digest).toEqual({ ok: false, status: 400, body: REFUSALS['digest-invalid'] })
    }
    expect(asked).toEqual([])
  })

  // The body's size is bounded before it is read: a megabyte past the
  // limit would be hashed, sniffed and walked for nothing. The limit itself
  // is the largest an image may be, so one of exactly that size is judged
  // by what it is.
  test('refuses bytes past MAX_ASSET_BYTES as image-too-large, and judges bytes of exactly that size by what they are', async () => {
    const { store, asked } = memoryStore()
    const digest = '0'.repeat(64)
    expect(await keepImage(asking(store, AUTHOR), digest, 'image/png', new Uint8Array(MAX_ASSET_BYTES + 1))).toEqual({ ok: false, status: 413, body: REFUSALS['image-too-large'] })
    expect(await keepImage(asking(store, AUTHOR), digest, 'image/png', new Uint8Array(MAX_ASSET_BYTES))).toEqual({
      ok: false,
      status: 422,
      body: { ...REFUSALS['image-refused'], reason: 'not-an-image' },
    })
    expect(asked).toEqual([])
  })

  // Bytes that are none of the kinds kept are refused as what they are, by
  // their first bytes and never by a name or a type the request claims:
  // otherwise a kept "image" could be any file a tenant chose to park.
  test('refuses bytes that are no image as image-refused with the reason not-an-image, whatever type they claim', async () => {
    const { store, snapshot } = memoryStore()
    const before = snapshot()
    for (const bytes of [new Uint8Array(0), ascii('plain text'), Uint8Array.of(0x25, 0x50, 0x44, 0x46), ascii('GIF89a')]) {
      expect(await keepImage(asking(store, AUTHOR), hexOf(bytes), 'image/png', bytes)).toEqual({
        ok: false,
        status: 422,
        body: { ...REFUSALS['image-refused'], reason: 'not-an-image' },
      })
    }
    expect(snapshot()).toBe(before)
  })

  // The request says what it sends and the bytes say what they are; a
  // disagreement is a client that is wrong about one of them, and a store
  // that kept it would serve PNG bytes as a JPEG.
  test('refuses a type that is not the bytes\' own as unsupported-media-type', async () => {
    const { store, snapshot } = memoryStore()
    const before = snapshot()
    const bytes = png()
    for (const contentType of ['image/jpeg', 'image/svg+xml', 'text/plain', 'application/octet-stream', 'image/png-ish', '']) {
      expect(await keepImage(asking(store, AUTHOR), hexOf(bytes), contentType, bytes), contentType).toEqual({ ok: false, status: 415, body: REFUSALS['unsupported-media-type'] })
    }
    const drawing = svg()
    expect((await keepImage(asking(store, AUTHOR), hexOf(drawing), 'image/png', drawing)).status).toBe(415)
    expect(snapshot()).toBe(before)
  })

  // A client states a type with parameters, in any case and with spaces;
  // only the media type before the first semicolon is compared. Refusing
  // `image/png; charset=binary` would fail a client for a header the HTTP
  // stack added.
  test('reads the media type before any parameter, in any case', async () => {
    const { store } = memoryStore()
    const bytes = png()
    for (const contentType of ['image/png; charset=binary', 'image/png;charset=binary', ' IMAGE/PNG ', 'image/png ; q=1']) {
      expect((await keepImage(asking(store, AUTHOR), hexOf(bytes), contentType, bytes)).status, contentType).toBe(200)
    }
  })

  // A PNG or JPEG is read as the renderer reads it, so that nothing is kept
  // that no report could print; the reason is report-spec's code for the
  // first thing wrong.
  test('refuses a PNG or JPEG the header reader refuses as image-refused with its code', async () => {
    const { store, snapshot } = memoryStore()
    const before = snapshot()
    const corrupt = png()
    corrupt[corrupt.length - 17] = corrupt[corrupt.length - 17]! ^ 1
    const cases: readonly [string, Uint8Array, string, string][] = [
      ['a PNG with a wrong checksum', corrupt, 'image/png', 'malformed'],
      ['a PNG with no pixels', png(0, 8), 'image/png', 'no-pixels'],
      ['a PNG past the side limit', png(MAX_ASSET_SIDE + 1, 8), 'image/png', 'too-large'],
      ['a JPEG cut off', jpeg(8, 8, true), 'image/jpeg', 'malformed'],
      ['a JPEG with no pixels', jpeg(8, 0), 'image/jpeg', 'no-pixels'],
    ]
    for (const [name, bytes, contentType, reason] of cases) {
      expect(await keepImage(asking(store, AUTHOR), hexOf(bytes), contentType, bytes), name).toEqual({ ok: false, status: 422, body: { ...REFUSALS['image-refused'], reason } })
    }
    expect(snapshot()).toBe(before)
  })

  // An SVG is kept only as the drawing `cleanSvg` writes. The file as a
  // person chose it still carries what cleaning removes, and a store that
  // kept it would hand the renderer a form it refuses at every print.
  test('refuses an SVG that is not in the form cleanSvg writes as image-refused with its code', async () => {
    const { store, snapshot } = memoryStore()
    const before = snapshot()
    const uncleaned = ascii(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><title>Mark</title><rect width="10" height="10" fill="#c00"/></svg>`)
    const refusal = checkSvg(uncleaned)
    if (refusal.ok) throw new Error('the fixture is meant to be refused')
    expect(await keepImage(asking(store, AUTHOR), hexOf(uncleaned), 'image/svg+xml', uncleaned)).toEqual({
      ok: false,
      status: 422,
      body: { ...REFUSALS['image-refused'], reason: refusal.code },
    })
    expect(snapshot()).toBe(before)
  })

  // Bytes that start like an SVG and are not a drawing are refused by the
  // same reader, with the code it gives.
  test('refuses markup that is no SVG as image-refused with the reader\'s code', async () => {
    const { store } = memoryStore()
    const markup = ascii('<html><body>not a drawing</body></html>')
    const refusal = checkSvg(markup)
    if (refusal.ok) throw new Error('the fixture is meant to be refused')
    expect(await keepImage(asking(store, AUTHOR), hexOf(markup), 'image/svg+xml', markup)).toEqual({
      ok: false,
      status: 422,
      body: { ...REFUSALS['image-refused'], reason: refusal.code },
    })
  })

  // An SVG has its own, smaller bound than a picture: the cleaner reads it
  // as text. Past it the answer is the size's, 413, and not a parse's; at
  // it, the bytes are judged as the drawing they are.
  test('refuses an SVG past MAX_SVG_BYTES as image-too-large, and judges one of exactly that size as a drawing', async () => {
    const { store, asked } = memoryStore()
    const padded = (length: number): Uint8Array => Uint8Array.from({ length }, (_, at) => (at === 0 ? 0x3c : 0x20))
    const digest = '0'.repeat(64)
    expect(await keepImage(asking(store, AUTHOR), digest, 'image/svg+xml', padded(MAX_SVG_BYTES + 1))).toEqual({ ok: false, status: 413, body: REFUSALS['image-too-large'] })
    const atTheLimit = await keepImage(asking(store, AUTHOR), digest, 'image/svg+xml', padded(MAX_SVG_BYTES))
    expect(atTheLimit.ok).toBe(false)
    expect(atTheLimit.status).toBe(422)
    expect(asked).toEqual([])
  })

  // The path names the bytes by their digest; bytes of another digest are
  // refused, so that a name in a report can never be given other bytes
  // than those it pinned.
  test('refuses bytes whose digest is not the path\'s as digest-mismatch, keeping nothing', async () => {
    const { store, snapshot } = memoryStore()
    const before = snapshot()
    const sent = png(8, 8)
    expect(await keepImage(asking(store, AUTHOR), hexOf(png(9, 9)), 'image/png', sent)).toEqual({ ok: false, status: 422, body: REFUSALS['digest-mismatch'] })
    expect(snapshot()).toBe(before)
  })

  // The checks run in one order, so that a client is told one thing at a
  // time. Each request below fails its own check and every check after it.
  test('judges a request in the order authority, digest, size, kind, type, bytes, then digest match', async () => {
    const { store } = memoryStore()
    const pngBytes = png()
    const steps: readonly [string, Asking, string, string, Uint8Array, number, string][] = [
      ['authority', asking(store, PUBLISHER), 'x', 'text/plain', Uint8Array.of(0), 403, 'forbidden'],
      ['digest', asking(store, AUTHOR), 'x', 'text/plain', Uint8Array.of(0), 400, 'digest-invalid'],
      ['size', asking(store, AUTHOR), hexOf(pngBytes), 'text/plain', new Uint8Array(MAX_ASSET_BYTES + 1), 413, 'image-too-large'],
      ['kind', asking(store, AUTHOR), hexOf(pngBytes), 'text/plain', Uint8Array.of(0), 422, 'image-refused'],
      ['type', asking(store, AUTHOR), hexOf(png(9, 9)), 'text/plain', pngBytes, 415, 'unsupported-media-type'],
      ['bytes', asking(store, AUTHOR), hexOf(png(9, 9)), 'image/png', png(0, 0), 422, 'image-refused'],
      ['digest match', asking(store, AUTHOR), hexOf(png(9, 9)), 'image/png', pngBytes, 422, 'digest-mismatch'],
    ]
    for (const [name, who, digest, contentType, bytes, status, code] of steps) {
      const answered = await keepImage(who, digest, contentType, bytes)
      expect({ name, ok: answered.ok, status: answered.status, code: answered.ok ? undefined : answered.body.code }, name).toEqual({ name, ok: false, status, code })
    }
  })
})

describe('readImage', () => {
  // What was kept is what is read: the bytes and the type they were kept
  // as, 200, for an author, who builds with them, and a publisher, who
  // reads what authors wrote.
  test('serves a kept image\'s bytes and media type to an author and a publisher', async () => {
    const { store } = memoryStore()
    const bytes = png()
    await keepImage(asking(store, AUTHOR), hexOf(bytes), 'image/png', bytes)
    for (const role of [AUTHOR, PUBLISHER]) {
      expect(await readImage(asking(store, role), hexOf(bytes)), role).toEqual({ ok: true, status: 200, body: { mediaType: 'image/png', bytes } })
    }
  })

  // An administrator and a token with no capacity may not read an image;
  // the refusal comes before the store is asked, so it cannot say whether
  // the image exists.
  test('refuses an administrator and a token with no capacity as forbidden, without asking the store', async () => {
    const { store, asked } = memoryStore()
    for (const role of [ADMIN, undefined]) {
      expect(await readImage(asking(store, role), '0'.repeat(64)), String(role)).toEqual({ ok: false, status: 403, body: REFUSALS.forbidden })
    }
    expect(asked).toEqual([])
  })

  // A digest that is no digest never reaches the store that would name a
  // file by it.
  test('refuses a digest that is not 64 lower-case hexadecimal digits as digest-invalid, without asking the store', async () => {
    const { store, asked } = memoryStore()
    for (const digest of ['', 'ABC', 'sha256:'.concat('0'.repeat(64)), '0'.repeat(63), '0'.repeat(65), '../'.repeat(22).slice(0, 64)]) {
      expect(await readImage(asking(store, AUTHOR), digest), digest).toEqual({ ok: false, status: 400, body: REFUSALS['digest-invalid'] })
    }
    expect(asked).toEqual([])
  })

  // An image nobody kept, and one only another tenant kept, are both not
  // found: a 403 for the second would say it exists.
  test('answers 404 no-asset for an image the asking tenant has not kept, another tenant\'s included', async () => {
    const { store } = memoryStore()
    const bytes = png()
    await keepImage(asking(store, AUTHOR, { tenant: 'other' }), hexOf(bytes), 'image/png', bytes)
    expect(await readImage(asking(store, AUTHOR), hexOf(bytes))).toEqual({ ok: false, status: 404, body: REFUSALS['no-asset'] })
    expect(await readImage(asking(store, AUTHOR), '0'.repeat(64))).toEqual({ ok: false, status: 404, body: REFUSALS['no-asset'] })
    // The tenant that kept it reads it, so the question is asked of the token's tenant and not of a fixed one.
    expect((await readImage(asking(store, AUTHOR, { tenant: 'other' }), hexOf(bytes))).ok).toBe(true)
  })
})

describe('the digest a path carries', () => {
  // A path carries a digest's 64 digits without `sha256:`, and the store
  // names a file by the digest with it, by report-spec's rule. Judged here
  // by a pattern of its own, a digest this use case let through could be
  // one the store's assertion throws on, answered 500 rather than
  // refused; so a keep and a read refuse exactly what `isDigest` refuses
  // once `sha256:` is put before it, and nothing else.
  test('a keep and a read refuse a digest as digest-invalid exactly where report-spec’s isDigest refuses it with sha256: before it', async () => {
    const bytes = png()
    const hex = hexOf(bytes)
    const refusedAsInvalid = (answered: { readonly ok: boolean; readonly body: unknown }): boolean => !answered.ok && (answered.body as { code?: unknown }).code === 'digest-invalid'
    for (const digest of [hex, '0'.repeat(64), hex.toUpperCase(), `sha256:${hex}`, hex.slice(1), `${hex}0`, `${hex}\n`, `${hex.slice(0, 63)}g`, '../'.repeat(22).slice(0, 64), '']) {
      const { store } = memoryStore()
      const invalid = !isDigest(`sha256:${digest}`)
      const kept = await keepImage(asking(store, AUTHOR), digest, 'image/png', bytes)
      const read = await readImage(asking(store, AUTHOR), digest)
      expect([refusedAsInvalid(kept), refusedAsInvalid(read)], JSON.stringify(digest)).toEqual([invalid, invalid])
    }
  })
})
