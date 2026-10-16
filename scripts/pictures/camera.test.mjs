import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, test } from 'vitest'
import { families, fontVersions, MARGIN, narrowestBreakpoint, padded, SETTINGS, stylesheet, widestBreakpoint } from './camera.mjs'
import { REPO } from './record.mjs'

/**
 * The camera's decisions that need no browser: the settings every picture
 * is taken in, the widths it is taken past or at, the fonts it waits for and
 * the versions it records. Its browser half -- the font wait, the canvas
 * wait, the intrusion check, the settle loop, the encoder -- runs at every
 * capture and every --check.
 */

describe('the settings', () => {
  // A picture taken at another scale, locale or time zone would show other
  // dates and other pixels for the same state.
  test('are the ones every picture is taken in', () => {
    expect(SETTINGS).toEqual({ deviceScaleFactor: 2, locale: 'en-US', timezoneId: 'UTC', reducedMotion: 'reduce', colorScheme: 'light', height: 900 })
  })
})

describe('the clip', () => {
  // A part with no frame of its own would run into the picture's edge and
  // look cut out of the page.
  test('keeps MARGIN of the bench on every side of the parts', () => {
    expect(MARGIN).toBe(16)
    expect(padded({ x: 100, y: 200, width: 300, height: 400 }, MARGIN, { width: 1600, height: 2000 })).toEqual({ x: 84, y: 184, width: 332, height: 432 })
  })

  // The bench stops short of what is drawn beside the parts, side by side:
  // the Studio's bar is 12 px above the builder and the Preview.
  test('keeps what the bench leaves on each side, and no more', () => {
    expect(padded({ x: 12, y: 140, width: 1576, height: 748 }, { top: 12, right: 12, bottom: 12, left: 12 }, { width: 1600, height: 900 })).toEqual({ x: 0, y: 128, width: 1600, height: 772 })
  })

  // A margin past the page's edge would be a box the full-page shot cannot
  // take, and a picture of nothing at its side.
  test('stops at the edges of the page', () => {
    expect(padded({ x: 4, y: 0, width: 1590, height: 600 }, MARGIN, { width: 1600, height: 610 })).toEqual({ x: 0, y: 0, width: 1600, height: 610 })
  })
})

describe('the breakpoints', () => {
  const studio = stylesheet(join(REPO, 'apps', 'studio', 'src'), 'studio.css')

  // The wide pictures are of the layout with the builder beside the
  // Preview; a width at or below the widest max-width would picture the
  // stacked one under a wide caption. The narrow picture is of the
  // narrowest tier, where the bar's controls take a line each.
  test("are read from the Studio's stylesheet as its gate inlines it", () => {
    expect(widestBreakpoint(studio, 'studio.css')).toBe(1440)
    expect(narrowestBreakpoint(studio, 'studio.css')).toBe(640)
  })

  // A stylesheet with no breakpoint left would let any width through.
  test('are refused when the stylesheet has none', () => {
    expect(() => widestBreakpoint('.page { max-width: 100rem; }', 'page.css')).toThrow('found no max-width breakpoint in page.css')
    expect(() => narrowestBreakpoint('.page { max-width: 100rem; }', 'page.css')).toThrow('found no max-width breakpoint in page.css')
  })
})

describe('the stylesheet', () => {
  // The digest the record holds is of what the page loads; an import the
  // camera skipped would leave a changed file out of the stylesheet notice.
  test('inlines its ./ imports and refuses one it does not understand', () => {
    const directory = mkdtempSync(join(tmpdir(), 'pictures-camera-test-'))
    try {
      writeFileSync(join(directory, 'room.css'), '.room { color: red; }')
      writeFileSync(join(directory, 'app.css'), "/* @import is said here */\n@import './room.css';\n.app {}")
      expect(stylesheet(directory, 'app.css')).toBe('/* @import is said here */\n.room { color: red; }\n.app {}')
      writeFileSync(join(directory, 'app.css'), "@import url('https://example.invalid/x.css');")
      expect(() => stylesheet(directory, 'app.css')).toThrow('app.css has an @import the camera does not inline')
    } finally {
      rmSync(directory, { recursive: true, force: true })
    }
  })
})

describe('the font families', () => {
  // The camera waits for every family the page asks Google Fonts for; one
  // missed here is one a fallback face could stand in for unnoticed.
  test("are every family= of the Studio's Google Fonts link", () => {
    expect(families(readFileSync(join(REPO, 'apps', 'studio', 'index.html'), 'utf8'))).toEqual(['Archivo', 'IBM Plex Mono', 'IBM Plex Sans'])
  })

  // A page that asked Google for nothing would give the wait nothing to wait for.
  test('are refused when the page names none', () => {
    expect(() => families('<link rel="preconnect" href="https://fonts.googleapis.com" />')).toThrow(/names no Google Fonts family/)
  })
})

describe('the font versions', () => {
  const names = ['Archivo', 'IBM Plex Mono', 'IBM Plex Sans']
  // In the shape of the URLs Chromium fetched for the Studio on 2026-10-16: the versions are those, the file names made up.
  const urls = ['https://fonts.gstatic.com/s/archivo/v25/k3k6o8.woff2', 'https://fonts.gstatic.com/s/ibmplexmono/v20/-F63fjp.woff2', 'https://fonts.gstatic.com/s/ibmplexsans/v23/zYXz.woff2', 'https://fonts.gstatic.com/s/ibmplexsans/v23/zYX9.woff2']

  // The record's look names the font each picture was drawn in, so a font
  // Google ships is a new look and not an unexplained change of pixels.
  test('are read from the files each family loaded', () => {
    expect(fontVersions(urls, names)).toEqual({ Archivo: 'v25', 'IBM Plex Mono': 'v20', 'IBM Plex Sans': 'v23' })
  })

  // Each would let the record say a version nobody can stand behind.
  test('are refused for a file without one, two of one family, and a family no file was seen for', () => {
    expect(() => fontVersions([...urls, 'https://fonts.gstatic.com/s/archivo/latest/x.woff2'], names)).toThrow('the font file /s/archivo/latest/x.woff2 names no version')
    expect(() => fontVersions([...urls, 'https://fonts.gstatic.com/s/archivo/v26/x.woff2'], names)).toThrow('two versions of Archivo were loaded, v25 and v26')
    expect(() => fontVersions(urls.slice(1), names)).toThrow('no fonts.gstatic.com file was seen for Archivo')
  })
})
