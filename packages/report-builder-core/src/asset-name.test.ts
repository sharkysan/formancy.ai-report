import { nextAssetId } from '@formancy/report-core'
import { emptyReport, isIdentifier } from '@formancy/report-spec'
import { describe, expect, test } from 'vitest'
import { assetBase } from './asset-name.js'

/**
 * The id an added image is declared under, read from its file's name. The
 * report holds the id, so a name the validator would refuse is an image
 * the host kept and the report then could not declare (0033).
 */
describe('assetBase', () => {
  // Each line is a name a person's files have: the extension dropped,
  // letters folded to their plain Latin spelling, anything else a hyphen,
  // and a name that is no word -- digits first, or another script -- still
  // an identifier. A fold missing would turn "Müller" into "m-ller".
  test.each([
    ['logo.png', 'logo'],
    ['Logo Müller AG.svg', 'logo-muller-ag'],
    ['2024 Logo.png', 'image-2024-logo'],
    ['山田.png', 'image'],
    ['IMG_4711.JPG', 'img-4711'],
    ['Straße.svg', 'strasse'],
    ['Æsir Ørsted Œuvre.png', 'aesir-orsted-oeuvre'],
    ['Łódź.jpeg', 'lodz'],
    ['Đorđe Ðað.png', 'dorde-dad'],
    ['Þór.png', 'thor'],
    ['Işık İnci.png', 'isik-inci'],
    ['ﬁle².png', 'file2'],
    ['Ｌｏｇｏ.png', 'logo'],
    ['logo.final.v2.png', 'logo-final-v2'],
    ['  Logo  .png', 'logo'],
    ['logo', 'logo'],
    ['logo.', 'logo'],
    ['.png', 'png'],
    ['---.png', 'image'],
    ['', 'image'],
  ])('reads %j as %j', (name, base) => {
    expect(assetBase(name)).toBe(base)
  })

  // A camera's or a scanner's long name is cut, and never ends in the
  // hyphen the cut would leave, which the identifier rule allows and an
  // author would read as a slip. Sixty characters leave the "-999" a
  // thousandth image of the same name takes inside the identifier's 64.
  test('cuts a long name at 60 characters, without a hyphen at the end', () => {
    expect(assetBase(`${'a'.repeat(59)} b.png`)).toBe('a'.repeat(59))
    expect(assetBase(`${'b'.repeat(80)}.png`)).toBe('b'.repeat(60))
    expect(assetBase(`7${'c'.repeat(80)}.png`)).toBe(`image-7${'c'.repeat(53)}`)
  })

  // Whatever a file is called -- every code point, a lone surrogate among
  // them -- the base is an identifier and report-core numbers it without
  // throwing: an id refused after the host kept the bytes would leave them
  // kept for nothing.
  test('gives an identifier report-core numbers, for any name at all', () => {
    let seed = 0x5eed
    const next = (bound: number): number => {
      seed = (seed * 1_103_515_245 + 12_345) % 2 ** 31
      return seed % bound
    }
    const taken = { ...emptyReport('names', 'Names', 'en'), assets: [{ id: 'image', mediaType: 'image/png' as const, digest: `sha256:${'ab'.repeat(32)}` }] }
    for (let run = 0; run < 2000; run += 1) {
      const name = String.fromCharCode(...Array.from({ length: next(90) }, () => next(0x10000)))
      const base = assetBase(name)
      expect(isIdentifier(base), JSON.stringify(name)).toBe(true)
      expect(base.length).toBeLessThanOrEqual(60)
      expect(isIdentifier(nextAssetId(taken, base)), JSON.stringify(name)).toBe(true)
    }
  })
})
