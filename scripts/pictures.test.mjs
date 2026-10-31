import { join } from 'node:path'
import { describe, expect, test } from 'vitest'
import { parse, plan, redated, table } from './pictures.mjs'
import { readScenes, REPO } from './pictures/record.mjs'

/**
 * `node scripts/pictures.mjs`, the root runner: what it accepts, what it
 * runs and what it prints. Running the app is its script's business and
 * needs a browser; deciding what to run is this file's and needs neither.
 */

const SCENES = [
  { id: 'studio-react', app: 'studio' },
  { id: 'other-one', app: 'other' },
  { id: 'studio-refusal', app: 'studio' },
  { id: 'other-two', app: 'other' },
]
const OUTSIDE = join(REPO, '..', 'pictures-review')

describe('the arguments', () => {
  // A misspelt scene or app would otherwise run nothing and say it succeeded.
  test('are checked against scenes.json', () => {
    expect(parse(['--app', 'studio', '--scene', 'studio-refusal'], SCENES)).toEqual({
      apps: ['studio'],
      scenes: ['studio-refusal'],
      all: false,
      check: false,
      review: undefined,
    })
    expect(() => parse(['--app', 'site'], SCENES)).toThrow('--app site is no app with a scene in scripts/pictures/scenes.json; those are studio, other')
    expect(() => parse(['--scene', 'studio-refusl'], SCENES)).toThrow('--scene studio-refusl is no scene of scripts/pictures/scenes.json')
    expect(() => parse(['--scene'], SCENES)).toThrow(/^--scene needs a value/)
    expect(() => parse(['--scene', '--all'], SCENES)).toThrow(/^--scene needs a value/)
    expect(() => parse(['--force'], SCENES)).toThrow(/^--force is not an option/)
  })

  // Each pair would mean nothing, and running one half of it would surprise.
  test('refuse the combinations that mean nothing', () => {
    expect(() => parse(['--all', '--scene', 'studio-react'], SCENES)).toThrow('--all retakes every scene of an app, so it is not given with --scene')
    expect(() => parse(['--check', '--all'], SCENES)).toThrow(/^--check walks every scene of an app and writes nothing/)
    expect(() => parse(['--check', '--scene', 'studio-react'], SCENES)).toThrow(/^--check walks every scene/)
    expect(() => parse(['--app', 'studio', '--scene', 'other-two'], SCENES)).toThrow('--scene other-two is a other scene, and --app names studio')
  })

  // Refused before any app runs, and a relative directory resolved here,
  // since the app runs elsewhere.
  test('take a review directory outside the repository only, made absolute', () => {
    expect(() => parse(['--review', 'x'], SCENES, { cwd: REPO })).toThrow(/^--review x is inside the repository \(x\)/)
    expect(parse(['--review', '../pictures-review'], SCENES, { cwd: REPO }).review).toBe(OUTSIDE)
  })

  // The repository's own scenes: every app in them is one --app accepts,
  // and today that is the Studio alone.
  test("accept every app of the repository's scenes", () => {
    const apps = [...new Set(readScenes().map((scene) => scene.app))]
    expect(apps).toEqual(['studio'])
    for (const app of apps) expect(parse(['--app', app], readScenes()).apps).toEqual([app])
  })
})

describe('the plan', () => {
  // Every app, in scenes.json's order, when nothing narrows it; a scene only
  // to the app that has it, so no app is asked for a scene it cannot take.
  test("runs the apps in scenes.json's order, each with only its own scenes", () => {
    expect(plan(parse([], SCENES), SCENES)).toEqual({
      runs: [
        { app: 'studio', args: [] },
        { app: 'other', args: [] },
      ],
      fresh: false,
      write: true,
    })
    expect(plan(parse(['--scene', 'other-two', '--scene', 'studio-react', '--review', OUTSIDE], SCENES), SCENES).runs).toEqual([
      { app: 'studio', args: ['--scene', 'studio-react', '--review', OUTSIDE] },
      { app: 'other', args: ['--scene', 'other-two', '--review', OUTSIDE] },
    ])
  })

  // One look: only --all without --app may start a new look, so only it
  // starts from an empty record; --check writes neither pictures nor README.
  test('starts from an empty record only for --all without --app, and writes nothing for --check', () => {
    expect(plan(parse(['--all'], SCENES), SCENES)).toMatchObject({ fresh: true, write: true })
    expect(plan(parse(['--all', '--app', 'studio'], SCENES), SCENES)).toEqual({ runs: [{ app: 'studio', args: ['--all'] }], fresh: false, write: true })
    expect(plan(parse(['--check'], SCENES), SCENES)).toEqual({
      runs: ['studio', 'other'].map((app) => ({ app, args: ['--check'] })),
      fresh: false,
      write: false,
    })
  })
})

describe('the record after --all', () => {
  // --all starts the apps from an empty record, so no app sees the date a
  // picture was first taken; without this, every --all would rewrite every
  // date and captured.json would change on a retake that changed no picture.
  test('keeps the date of every picture retaken as the same bytes and text', () => {
    const look = { platform: 'win32-x64', playwright: '1.64.1', chromium: '156.0.8078.4', fonts: {} }
    const before = {
      'studio-react': { captured: '2026-10-01', sha256: 'a', look, text: { Preview: '- region "Preview"' } },
      'studio-refusal': { captured: '2026-10-01', sha256: 'b', look, text: { Preview: '- region "Preview"' } },
    }
    const after = {
      'studio-react': { ...before['studio-react'], captured: '2026-10-16' },
      'studio-refusal': { ...before['studio-refusal'], captured: '2026-10-16', sha256: 'c' },
    }
    expect(redated(before, after, SCENES)).toEqual({ 'studio-react': before['studio-react'], 'studio-refusal': after['studio-refusal'] })
  })
})

describe('the table', () => {
  // What a reviewer lists in the pull request: which pictures are new, which
  // changed by their bytes, and which a retake left as they were.
  test('says of each scene its CSS size, its bytes, and whether its picture is new, changed or unchanged', () => {
    const before = {
      'studio-react': { css: { width: 1600, height: 900 }, bytes: 257226, sha256: 'a' },
      'studio-refusal': { css: { width: 1600, height: 797 }, bytes: 134764, sha256: 'b' },
    }
    const after = {
      ...before,
      'studio-refusal': { ...before['studio-refusal'], sha256: 'c' },
      'other-two': { css: { width: 390, height: 2290 }, bytes: 477032, sha256: 'd' },
    }
    expect(table(before, after, SCENES).split('\n')).toEqual([
      'scene           CSS size  bytes   picture',
      'studio-react    1600x900  257226  unchanged',
      'other-one       -         -       not taken',
      'studio-refusal  1600x797  134764  changed',
      'other-two       390x2290  477032  new',
    ])
  })
})
