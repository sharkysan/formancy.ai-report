import { assetDigest, MAX_FONT_BYTES } from '@formancy/report-spec'
import type { ReportDefinition } from '@formancy/report-spec'
import { describe, expect, test } from 'vitest'
import type { ResolvedDocument } from './document.js'
import { MINIMAL_FONT } from './font-test-bytes.js'
import type { ImageBytes, ImageRef } from './render-context.js'
import { resolveReport } from './resolve.js'
import type { ResolveOptions } from './resolve.js'
import { sampleData, sampleReport } from './test-support.js'

/**
 * A report's font map resolved to the bytes the renderer embeds (0043): the
 * host's lookup hands over each face, report-spec's `readFont` reads it, and
 * the document carries the bytes under each token. A face the host cannot
 * hand over, or that `readFont` refuses, refuses the render, in a preview
 * too, since a dropped face would print its text in a font nobody chose.
 *
 * The bytes a face resolves from are a minimal TrueType font `readFont`
 * accepts (`font-test-bytes.ts`); what it accepts of a real font the
 * renderer and the corpus prove on the PDF (0040, 0003).
 */
const FONT = MINIMAL_FONT
/** An OpenType font with CFF outlines, which `readFont` refuses (FT-Q15): the four bytes that make it `OTTO`. */
const CFF = Uint8Array.from([0x4f, 0x54, 0x54, 0x4f, 0, 0, 0, 0])

const CREATED = '2026-10-15T08:00:00Z'
const FINAL: ResolveOptions = { mode: 'final', parameters: { from: '2026-01-01' }, creationDate: CREATED }

/** Every asset id a font map names, so the report declares each face it maps (the validator refuses a map that names an undeclared asset). */
function facesOf(fonts: NonNullable<ReportDefinition['fonts']>): string[] {
  const ids = new Set<string>()
  for (const family of Object.values(fonts)) for (const id of Object.values(family)) ids.add(id)
  return [...ids]
}

/**
 * The sample report mapping `faces`, declaring every asset the map names,
 * and the resolver that hands over the bytes in `bytes`. `bytes` controls
 * what the host has; a declared face with no bytes is one the host cannot
 * hand over, which the resolution refuses.
 */
function mapped(
  faces: NonNullable<ReportDefinition['fonts']> = { sans: { normal: 'brand', bold: 'brand-bold' } },
  bytes: Readonly<Record<string, Uint8Array>> = { brand: FONT, 'brand-bold': FONT },
): { report: ReportDefinition; images: (ref: ImageRef) => ImageBytes | undefined } {
  const base = sampleReport()
  const assets = facesOf(faces).map((id) => ({ id, mediaType: 'font/ttf' as const, digest: assetDigest(bytes[id] ?? FONT) }))
  const report: ReportDefinition = { ...base, assets: [...base.assets, ...assets], fonts: faces }
  const images = (ref: ImageRef): ImageBytes | undefined => {
    const found = bytes[ref.asset]
    return found === undefined ? undefined : { mediaType: 'font/ttf', bytes: found }
  }
  return { report, images }
}

/** `report` resolved with `options`, failing the test with its errors when it is refused. */
function resolved(report: ReportDefinition, options: ResolveOptions): ResolvedDocument {
  const outcome = resolveReport(report, sampleData(), options)
  if (!outcome.ok) throw new Error(`refused: ${outcome.errors.map((error) => `${error.stage} ${error.code} ${error.path}`).join('; ')}`)
  return outcome.document
}

/** The resolve errors of `report` with `options`, as stage, code and path. */
function refusals(report: ReportDefinition, options: ResolveOptions): string[] {
  const outcome = resolveReport(report, sampleData(), options)
  return outcome.ok ? [] : outcome.errors.map((error) => `${error.stage} ${error.code} ${error.path}`)
}

describe('resolveFonts', () => {
  // A token a report maps carries its faces' bytes to the renderer; a face
  // left unmapped is absent, printed in the renderer's own.
  test('resolves each mapped face to the bytes the host handed over', () => {
    const { report, images } = mapped()
    const document = resolved(report, { ...FINAL, images })
    expect(document.fonts?.sans?.normal.id).toBe('brand')
    expect(document.fonts?.sans?.normal.digest).toBe(assetDigest(FONT))
    expect(document.fonts?.sans?.normal.bytes).toEqual(FONT)
    expect(document.fonts?.sans?.bold?.id).toBe('brand-bold')
    expect(document.fonts?.sans?.italic).toBeUndefined()
  })

  // Bytes the host changes after it answers must not reach the document: the
  // runtime copies them, as it copies an image's.
  test('copies the bytes the host handed over', () => {
    const brand = Uint8Array.from(FONT)
    const { report, images } = mapped({ sans: { normal: 'brand' } }, { brand })
    const document = resolved(report, { ...FINAL, images })
    expect(document.fonts?.sans?.normal.bytes).not.toBe(brand)
    expect(document.fonts?.sans?.normal.bytes).toEqual(FONT)
  })

  // A report that maps nothing carries no fonts: it prints exactly as it did
  // before a report could name a host's font.
  test('carries no fonts for a report that maps none', () => {
    expect(resolved(sampleReport(), FINAL).fonts).toBeUndefined()
  })

  // A face asset the host cannot hand over refuses the render: the text that
  // token prints has no font, and a render that dropped it would show
  // another (fail closed).
  test('refuses a render whose mapped face the host has no bytes for', () => {
    const { report, images } = mapped({ sans: { normal: 'brand' } }, {})
    expect(refusals(report, { ...FINAL, images })).toEqual(['resolve missing-asset /fonts/sans/normal'])
  })

  // No resolver at all, with a report that maps a font, is refused where a
  // report that maps none renders.
  test('refuses a mapping with no way to fetch approved assets', () => {
    const { report } = mapped({ sans: { normal: 'brand' } })
    expect(refusals(report, FINAL)).toEqual(['resolve missing-asset /fonts/sans/normal'])
  })

  // A face whose bytes readFont refuses -- a CFF font, which no PDF/A has
  // proved (FT-Q15) -- is refused as invalid-asset, naming the face and what
  // the reader found, never a byte of the font.
  test('refuses a face whose bytes readFont refuses', () => {
    const { report, images } = mapped({ sans: { normal: 'brand' } }, { brand: CFF })
    const outcome = resolveReport(report, sampleData(), { ...FINAL, images })
    expect(outcome.ok).toBe(false)
    const error = outcome.ok ? undefined : outcome.errors[0]
    expect(error).toMatchObject({ stage: 'resolve', code: 'invalid-asset', path: '/fonts/sans/normal' })
    expect(error?.message).toContain('the approved font brand')
    expect(error?.message).toContain('CFF')
  })

  // A font past the size a font may have is refused before it is copied or
  // read, so a host that hands over a gigabyte under a font's id costs the
  // runtime no gigabyte; the refusal says the size, never a byte.
  test('refuses a face past MAX_FONT_BYTES before it copies or reads it', () => {
    const { report } = mapped({ sans: { normal: 'brand' } })
    const images = (): ImageBytes => ({ mediaType: 'font/ttf', bytes: new Uint8Array(MAX_FONT_BYTES + 1) })
    const outcome = resolveReport(report, sampleData(), { ...FINAL, images })
    expect(outcome.ok ? [] : outcome.errors).toEqual([
      {
        stage: 'resolve',
        code: 'invalid-asset',
        path: '/fonts/sans/normal',
        message: `the approved font brand is ${MAX_FONT_BYTES + 1} bytes; a font may have ${MAX_FONT_BYTES}`,
      },
    ])
  })

  // fsType is the font vendor's word on embedding, which the runtime honours
  // as the renderer does (0040): a face that says Restricted License is
  // refused where the data is resolved, naming what it says.
  test('refuses a face whose fsType forbids embedding it', () => {
    const restricted = Uint8Array.from(FONT)
    const view = new DataView(restricted.buffer)
    for (let index = 0; index < view.getUint16(4); index += 1) {
      const record = 12 + 16 * index
      if (String.fromCharCode(...restricted.subarray(record, record + 4)) === 'OS/2') view.setUint16(view.getUint32(record + 8) + 8, 0x0002)
    }
    const { report, images } = mapped({ sans: { normal: 'brand' } }, { brand: restricted })
    const outcome = resolveReport(report, sampleData(), { ...FINAL, images })
    const error = outcome.ok ? undefined : outcome.errors[0]
    expect(error).toMatchObject({ stage: 'resolve', code: 'invalid-asset', path: '/fonts/sans/normal' })
    expect(error?.message).toContain('Restricted License')
  })

  // The host's lookup is its own code and may throw; reading it inside the
  // guard turns that into a refusal naming the face, never an error out of
  // the runtime.
  test('refuses a face whose lookup throws', () => {
    const { report } = mapped({ sans: { normal: 'brand' } })
    const images = (): never => {
      throw new Error("the host's store is down")
    }
    expect(refusals(report, { ...FINAL, images })).toEqual(['resolve asset-lookup-failed /fonts/sans/normal'])
  })

  // The host's answer of another media type than a font is refused: an image
  // mapped as a face would reach the renderer as a font it cannot read.
  test('refuses an answer that is not a font', () => {
    const { report } = mapped({ sans: { normal: 'brand' } })
    const images = (): ImageBytes => ({ mediaType: 'image/png', bytes: FONT })
    expect(refusals(report, { ...FINAL, images })).toEqual(['resolve invalid-asset /fonts/sans/normal'])
  })

  // A preview refuses a missing face as a final render does: a font is
  // structural, not a value a preview may lack and warn about.
  test('refuses a missing face in a preview too', () => {
    const { report, images } = mapped({ sans: { normal: 'brand' } }, {})
    expect(refusals(report, { mode: 'preview', parameters: { from: '2026-01-01' }, creationDate: CREATED, images })).toContain(
      'resolve missing-asset /fonts/sans/normal',
    )
  })

  // One face asset shared by two faces or tokens is fetched once: a resolver
  // that answered twice would be the host's lookup called more than needed.
  test('fetches a shared face asset once', () => {
    let calls = 0
    const base = sampleReport()
    const report: ReportDefinition = {
      ...base,
      assets: [...base.assets, { id: 'brand', mediaType: 'font/ttf', digest: assetDigest(FONT) }],
      fonts: { sans: { normal: 'brand', bold: 'brand' }, serif: { normal: 'brand' } },
    }
    const images = (): ImageBytes => {
      calls += 1
      return { mediaType: 'font/ttf', bytes: FONT }
    }
    const document = resolved(report, { ...FINAL, images })
    expect(calls).toBe(1)
    expect(document.fonts?.sans?.normal.bytes).toBe(document.fonts?.sans?.bold?.bytes)
    expect(document.fonts?.serif?.normal.bytes).toBe(document.fonts?.sans?.normal.bytes)
  })
})
