import { join } from 'node:path'
import { describe, expect, test } from 'vitest'
import { digest, REPO } from './record.mjs'
import { appOptions, checkResult, checkResultFile, notShot, reasonToShoot, widthOf } from './session.mjs'

/**
 * What an app's pictures script decides before and between its scenes,
 * decided once in session.mjs: which arguments it takes, at what width each
 * scene is walked, and which scenes it shoots. The walk itself needs the
 * app's page and a browser, and runs as the app's `pictures.mjs`.
 */

const SCENES = [
  { id: 'other-scene', app: 'other' },
  { id: 'studio-react', app: 'studio' },
  { id: 'studio-narrow', app: 'studio', width: 390 },
]
const OUTSIDE = join(REPO, '..', 'pictures-review')

describe("an app script's arguments", () => {
  // The root runner passes an app only its own scenes; a person running the
  // app script by hand must get the same refusals, or a scene of another app
  // would be walked by nobody and the run would say it succeeded.
  test("are the runner's, for this app only", () => {
    expect(appOptions(['--scene', 'studio-react', '--review', OUTSIDE], SCENES, 'studio')).toEqual({
      apps: [],
      scenes: ['studio-react'],
      all: false,
      check: false,
      review: OUTSIDE,
    })
    expect(appOptions(['--check'], SCENES, 'studio')).toMatchObject({ check: true })
    expect(() => appOptions(['--scene', 'other-scene'], SCENES, 'studio')).toThrow(
      '--scene other-scene is a other scene, and this is apps/studio/scripts/pictures.mjs',
    )
    expect(() => appOptions(['--app', 'studio'], SCENES, 'studio')).toThrow(
      "--app is the root runner's option: apps/studio/scripts/pictures.mjs takes its own scenes only",
    )
    expect(() => appOptions(['--all', '--scene', 'studio-react'], SCENES, 'studio')).toThrow(
      '--all retakes every scene of an app, so it is not given with --scene',
    )
    expect(() => appOptions(['--review', join(REPO, 'x')], SCENES, 'studio')).toThrow(/is inside the repository/)
  })
})

describe("a scene's width", () => {
  // A scene names its width only to picture the narrow layout: one that
  // named a width between the breakpoints would picture a tier no caption
  // describes, under the narrow scene's words. Watched failing with 700.
  test("is the app's unless the scene names one, which must be at or below the narrowest breakpoint", () => {
    expect(widthOf(SCENES[1], { width: 1600, narrowest: 640 })).toBe(1600)
    expect(widthOf(SCENES[2], { width: 1600, narrowest: 640 })).toBe(390)
    expect(() => widthOf({ id: 'studio-tablet', width: 700 }, { width: 1600, narrowest: 640 })).toThrow(
      'studio-tablet names the width 700, and a scene names a width only to picture the narrowest layout, at or below 640px',
    )
    expect(() => widthOf({ id: 'studio-half', width: 390.5 }, { width: 1600, narrowest: 640 })).toThrow(/names the width 390\.5/)
  })
})

describe('which scene is shot', () => {
  const text = { Preview: '- region "Preview"' }
  const picture = Buffer.from('a picture')
  const recorded = { text, bytes: picture.length, sha256: digest(picture) }
  // `file` is read with `in`, because a default would stand in for the `undefined` that means "no picture".
  const shoot = (argv, changes = {}) => {
    const { record = { 'studio-react': recorded }, now = text } = changes
    return reasonToShoot({
      options: appOptions(argv, SCENES, 'studio'),
      id: 'studio-react',
      record,
      text: now,
      picture: 'file' in changes ? changes.file : picture,
    })
  }

  // The default is "retake what is stale": a picture whose text is the
  // record's is left as it is, and every other one is retaken, saying why.
  test("by default, only one whose text changed, or that has no record or no picture, or a picture that is not its record's", () => {
    expect(shoot([])).toBeUndefined()
    expect(shoot([], { now: { Preview: '- region "Preview":\n  - status' } })).toBe('its text changed')
    expect(shoot([], { record: {} })).toBe('it has no record')
    expect(shoot([], { file: undefined })).toBe('it has no picture')
    expect(shoot([], { file: Buffer.from('another picture') })).toBe('its picture is not the one its record describes')
  })

  // --all and --scene shoot what they name, whatever the record says; --check
  // shoots nothing, so a check can never write a picture.
  test('with --all every one, with --scene those named, with --check none', () => {
    expect(shoot(['--all'])).toBe('--all')
    expect(shoot(['--scene', 'studio-react'])).toBe('--scene')
    expect(shoot(['--scene', 'studio-narrow'])).toBeUndefined()
    expect(shoot(['--check'], { record: {} })).toBeUndefined()
  })
})

describe('what a scene that is not shot is said to be', () => {
  const text = { Preview: '- region "Preview"' }
  const line = (argv, now = text) =>
    notShot({ options: appOptions(argv, SCENES, 'studio'), id: 'studio-react', record: { 'studio-react': { text } }, text: now })

  // Under --scene a scene not named is walked and its text read; a scene
  // whose text had changed must not be reported unchanged.
  test('under --scene, compared with its record and said either way, and never retaken', () => {
    expect(line(['--scene', 'studio-narrow'])).toBe("not named by --scene; its text is the record's")
    expect(line(['--scene', 'studio-narrow'], { Preview: '- region "Preview":\n  - status' })).toBe(
      "not named by --scene, and its text is not the record's: `node scripts/pictures.mjs --scene studio-react` retakes it",
    )
  })

  // By default a scene is left only when its text is the record's; under
  // --check nothing is shot, and the check says afterwards what differs.
  test("by default the record's, and under --check walked", () => {
    expect(line([])).toBe("its text is the record's, so it is not retaken")
    expect(line(['--check'])).toBe('walked')
  })
})

describe('what a check leaves for the release report', () => {
  const ran = { app: 'studio', playwright: '1.64.1', startedAt: '2026-10-16T10:00:00.000Z', finishedAt: '2026-10-16T10:01:00.000Z' }

  // The report holds a check's walk to every scene scenes.json gives its
  // app, read from scenes.json itself: a scene the walk never reached was
  // held by nobody. So the result says which scenes were walked, in walk
  // order, and plans nothing of its own that the report could believe.
  test('lists the scenes it walked, and the error only when one ended it', () => {
    const stopped = checkResult({
      ...ran,
      browser: { name: 'chromium', version: '156.0.8078.4', headless: true },
      walked: ['studio-react'],
      error: 'studio-narrow: the printed preview never came',
    })
    expect(stopped).toEqual({
      check: 'pictures',
      app: 'apps/studio',
      startedAt: ran.startedAt,
      finishedAt: ran.finishedAt,
      playwright: '1.64.1',
      browser: { name: 'chromium', version: '156.0.8078.4', headless: true },
      walked: ['studio-react'],
      problems: [],
      error: 'studio-narrow: the printed preview never came',
    })
    // A check whose answer is its problems ended as a check does, not in an error.
    const found = checkResult({ ...ran, walked: ['studio-react', 'studio-narrow'], problems: ['studio-react, part Preview: the page now says something else'] })
    expect(found).not.toHaveProperty('error')
    expect(found.browser).toBeNull()
  })

  // Where collect.mjs --job browser looks for it: beside the app's gate's file.
  test("is written into the app's test-results", () => {
    expect(checkResultFile('studio')).toBe(join(REPO, 'apps', 'studio', 'test-results', 'pictures.json'))
  })
})
