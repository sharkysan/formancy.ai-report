import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, test } from 'vitest'
import { MARGIN, narrowestBreakpoint, padded, SETTINGS, stylesheet, widestBreakpoint } from './camera.mjs'
import { REPO } from './record.mjs'

/**
 * The camera's decisions that need no browser: the settings every picture
 * is taken in and the widths it is taken past or at. The families it waits
 * for and the versions a record names are scripts/web-fonts.mjs's, held by
 * web-fonts.test.mjs. Its browser half -- the font wait, the canvas wait,
 * the intrusion check, the settle loop, the encoder -- runs at every
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
    expect(padded({ x: 12, y: 140, width: 1576, height: 748 }, { top: 12, right: 12, bottom: 12, left: 12 }, { width: 1600, height: 900 })).toEqual({
      x: 0,
      y: 128,
      width: 1600,
      height: 772,
    })
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
    expect(widestBreakpoint(studio, 'studio.css')).toBe(2052)
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
