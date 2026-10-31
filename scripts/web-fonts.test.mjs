import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, describe, expect, test } from 'vitest'
import { declaredFamilies, faceVersions, familiesOf, FONT_FILE, fontsourceFaces } from './web-fonts.mjs'

/**
 * The faces the Studio and the pages serve from their own build (0023): the
 * families a built stylesheet declares, which the Studio's browser gate and
 * its README pictures wait for; the requests a pass refuses to measure the
 * fallback stack; and the Fontsource packages that ship them, whose font
 * versions a picture's record names.
 */
const repo = join(dirname(fileURLToPath(import.meta.url)), '..')
const made = []
afterAll(() => {
  for (const directory of made) rmSync(directory, { recursive: true, force: true })
})

/** A directory holding `files`, each path with its text. */
function tree(files) {
  const directory = mkdtempSync(join(tmpdir(), 'web-fonts-'))
  made.push(directory)
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(directory, path)), { recursive: true })
    writeFileSync(join(directory, path), text)
  }
  return directory
}

describe('the families a stylesheet declares', () => {
  // The gate waits for each family the page asks for, and fails a pass in
  // which one did not load. A family read from an ordinary rule's stack is
  // one the page merely hopes for -- 'Archivo' in admin.css's --display,
  // which nothing serves here -- and waiting for it would fail every pass.
  // Minified, a name loses its quotes; either way it is one family.
  test("are every @font-face's family, once each, quoted or not, and no stack's", () => {
    const css = [
      "@font-face {\n  font-family: 'Archivo Variable';\n  font-weight: 100 900;\n  src: url(./a.woff2) format('woff2-variations');\n}",
      '@font-face{font-family:IBM Plex Sans;font-weight:400;src:url(./b.woff2)format("woff2")}',
      '@font-face{font-family:"IBM Plex Sans";font-weight:500;src:url(./c.woff2)format("woff2")}',
      ".room{--display:'Archivo','Archivo Variable',sans-serif;font-family:'IBM Plex Mono',monospace}",
    ].join('\n')
    expect(familiesOf(css)).toEqual(['Archivo Variable', 'IBM Plex Sans'])
    expect(familiesOf('.page { font-family: var(--sans); }')).toEqual([])
  })

  // The built page's own: every stylesheet the build wrote, in any
  // directory, so a face moved into a lazily loaded chunk's stylesheet is
  // still waited for; a build that declares none says so as an empty list,
  // which each caller refuses in its own words.
  test('are read from every stylesheet a build wrote, sorted', () => {
    const dist = tree({
      'index.html': '<link rel="stylesheet" href="./assets/index.css">',
      'assets/index.css': '@font-face{font-family:IBM Plex Sans;src:url(./a.woff2)}',
      'assets/lazy/chunk.css': "@font-face{font-family:'Archivo Variable';src:url(./b.woff2)}",
      'assets/index.js': "const css = '@font-face{font-family:Hidden}'",
    })
    expect(declaredFamilies(dist)).toEqual(['Archivo Variable', 'IBM Plex Sans'])
    expect(declaredFamilies(tree({ 'assets/index.css': 'body { margin: 0 }' }))).toEqual([])
  })
})

describe('a request for a font file', () => {
  // The pass that measures the fallback stack refuses exactly the font
  // files: a stylesheet or a script refused with them would measure a page
  // that is not the Studio, and a face let through would measure the faces.
  test('is known by its extension, with a query or not', () => {
    for (const url of [
      'http://localhost:4394/report/assets/ibm-plex-sans-latin-400-normal-Bx1.woff2',
      'http://studio.invalid/assets/a.woff',
      'http://x/a.ttf?v=2',
      'http://x/a.OTF#x',
    ])
      expect({ url, font: FONT_FILE.test(url) }).toEqual({ url, font: true })
    for (const url of ['http://localhost:4394/report/assets/index-B.css', 'http://x/a.js', 'http://x/woff2/index.html', 'http://x/a.woff2.map'])
      expect({ url, font: FONT_FILE.test(url) }).toEqual({ url, font: false })
  })
})

describe("the faces' versions", () => {
  // The record's look names the font each picture was drawn in, so a font
  // that changed under the pictures is seen. Served from the build, a
  // font's file names no version; its Fontsource package records the
  // Google Fonts release its files were made from. Keyed by the font's own
  // family, as the look named it when the faces came from Google, so the
  // same fonts are the same look.
  test("are each family's release, from the Studio's Fontsource packages", () => {
    const studio = join(repo, 'apps', 'studio')
    expect(faceVersions(studio, ['Archivo Variable', 'IBM Plex Mono', 'IBM Plex Sans'])).toEqual({
      Archivo: 'v25',
      'IBM Plex Mono': 'v20',
      'IBM Plex Sans': 'v23',
    })
  })

  // A family no package ships -- a face from somewhere else, or a package
  // dropped -- has no version to record, and a record that named none
  // would say nothing of what was pictured.
  test('refuse a family no Fontsource package of the app ships', () => {
    expect(() => faceVersions(join(repo, 'apps', 'studio'), ['IBM Plex Sans', 'Inter'])).toThrow(
      'no Fontsource package of apps/studio declares the family Inter, so its version cannot be recorded',
    )
  })
})

describe('the faces the apps serve (0006, 0023)', () => {
  // dependency-licences.mjs reads the fonts of the published packages from
  // their name tables, and the apps are private, so it reads neither these
  // packages nor their WOFF2 files, whose tables are compressed. What holds
  // the faces to 0006's terms for a font is this: each Fontsource package an
  // app serves declares OFL-1.1, and ships the licence's text, which the
  // apps' notices reproduce. Whether the files' own name tables say so is
  // review's.
  test('are OFL-1.1, by each package and the licence it ships', () => {
    const faces = ['studio', 'pages'].flatMap((app) => fontsourceFaces(join(repo, 'apps', app)).map((face) => ({ app, ...face })))
    expect(faces.map(({ app, name }) => `${app} ${name}`).sort()).toEqual([
      'pages @fontsource-variable/archivo',
      'pages @fontsource/ibm-plex-mono',
      'pages @fontsource/ibm-plex-sans',
      'studio @fontsource-variable/archivo',
      'studio @fontsource/ibm-plex-mono',
      'studio @fontsource/ibm-plex-sans',
    ])
    for (const face of faces) {
      const licence = readFileSync(join(face.directory, 'LICENSE'), 'utf8')
      expect({ face: face.name, declared: face.licence, text: licence.includes('SIL OPEN FONT LICENSE Version 1.1 - 26 February 2007') }).toEqual({
        face: face.name,
        declared: 'OFL-1.1',
        text: true,
      })
    }
  })
})
