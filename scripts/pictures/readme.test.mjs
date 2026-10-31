import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, test } from 'vitest'
import { readWorkflow } from '../workflows.mjs'
import { entry, pictureOf, REPO, serialize } from './record.mjs'
import {
  END,
  guardProblems,
  HERO_LINE,
  integrityProblems,
  LINE,
  linkProblems,
  lookProblems,
  orphanProblems,
  quoteProblems,
  regionProblems,
  render,
  repository,
  rewrite,
  shapeProblems,
  START,
} from './readme.mjs'

/**
 * The README's pictures of the Studio, held in `pnpm test:repo` without a
 * browser (formancy.ai-data 0038's guard).
 *
 * The first block is the gate: the repository as it is. Every check returns
 * the sentences that are wrong with it, and passes only when there are none.
 * The second block shows each check failing on the change it exists for,
 * made to a small repository built here, so a check that had quietly
 * stopped checking anything would fail there, not pass here.
 */

describe("the repository's README pictures", () => {
  const here = repository()

  // A caption or a recorded size edited without `readme.mjs --write`, or the
  // region's markers lost in an edit of README.md, would leave the README
  // showing what no capture made, or nothing at all, and saying it is held.
  test('are the region README.md shows, as scenes.json and captured.json render it', () => {
    expect(regionProblems(here)).toEqual([])
  })

  // A picture edited, recompressed or deleted by hand would still have a
  // record saying it was taken from the page, and the README would show it.
  test("each have a record, and a file whose bytes are the record's", () => {
    expect(integrityProblems(here)).toEqual([])
  })

  // A picture left behind by a removed scene is committed weight nothing
  // shows; a record without a scene holds a picture to no caption.
  test('are all the pictures directory holds, and all the record holds', () => {
    expect(orphanProblems(here)).toEqual([])
  })

  // A caption that quotes a sentence its picture's parts do not say is the
  // stale picture this whole arrangement exists to prevent.
  test('have captions and alts that quote only what their parts say, in the parts they name', () => {
    expect(quoteProblems(here)).toEqual([])
  })

  // Two machines' pictures side by side differ in fonts and rendering, and
  // the README would show the Studio in two looks with no change to explain it.
  test('were taken on one look', () => {
    expect(lookProblems(here)).toEqual([])
  })

  // A decision record renamed or renumbered leaves a caption linking nowhere.
  test('link only files that exist', () => {
    expect(linkProblems(here)).toEqual([])
  })

  // A scene whose app has no pictures script is taken and checked by nothing.
  test("are scenes of the right shape, each taken by its app's script", () => {
    expect(shapeProblems(here)).toEqual([])
  })

  // An app script with no scene would run a --check that compares nothing,
  // and a region with no picture would pass the region check empty.
  test('leave no app script without a scene and no region without a picture', () => {
    expect(guardProblems(here)).toEqual([])
  })
})

/*
 * A small repository: the hero, an inline scene and two `more` scenes after
 * it, of one app, and one of another. Its snapshot lines are written by hand
 * in the shapes Playwright prints.
 */
const LOOK = {
  platform: 'win32-x64',
  playwright: '1.64.1',
  chromium: '156.0.8078.4',
  fonts: { Archivo: 'v25', 'IBM Plex Mono': 'v20', 'IBM Plex Sans': 'v23' },
}
const SETTINGS = { width: 1600, height: 900, deviceScaleFactor: 2, locale: 'en-US', timezoneId: 'UTC' }
const LINK = './docs/decisions/0010-the-runtime-resolves-a-report-into-a-renderer-neutral-document.md'

function scenes() {
  return [
    {
      id: 'studio-react',
      app: 'studio',
      placement: 'hero',
      title: 'React',
      caption: `Down to “Total CHF 3'143.00” ([0010](${LINK})).`,
      alt: 'The Studio, “Preview: printed.”',
      quotes: { "Total CHF 3'143.00": ['Preview'], 'Preview: printed.': ['Preview'] },
    },
    {
      id: 'studio-refusal',
      app: 'studio',
      placement: 'inline',
      title: 'Refused',
      caption: 'Its button, “Select Book value”.',
      alt: 'The Preview.',
      quotes: { 'Select Book value': ['Preview'] },
    },
    {
      id: 'studio-narrow',
      app: 'studio',
      placement: 'more',
      title: 'Narrow',
      width: 390,
      caption: '“Page 1 of 2” and the next.',
      alt: 'The Studio, narrow.',
      quotes: { 'Page 1 of 2': ['Preview'] },
    },
    {
      id: 'studio-blank',
      app: 'studio',
      placement: 'more',
      title: 'Blank',
      caption: '“the body holds nothing”.',
      alt: 'The builder.',
      quotes: { 'the body holds nothing': ['Builder'] },
    },
    {
      id: 'viewer-page',
      app: 'viewer',
      placement: 'inline',
      title: 'A viewer',
      caption: '“Page 1 of 1”.',
      alt: 'A page.',
      quotes: { 'Page 1 of 1': ['Viewer'] },
    },
  ]
}

const TEXT = {
  'studio-react': { Preview: '- region "Preview":\n  - status: "Preview: printed."\n  - group "Page 1 of 1": "Rundung CHF 0.00 Total CHF 3\'143.00"' },
  'studio-refusal': { Preview: '- region "Preview":\n  - button "Select Book value"' },
  'studio-narrow': { Preview: '- region "Preview":\n  - text: Page 1 of 2' },
  'studio-blank': { Builder: '- region "Report editor":\n  - text: the body holds nothing, so the report prints only its headers, footers and summary' },
  'viewer-page': { Viewer: '- region "Viewer":\n  - text: Page 1 of 1' },
}

/** The small repository, every check passing: what the README regions, the record and the files are after a capture. */
function fixture() {
  const list = scenes()
  const files = new Map()
  const record = {}
  for (const scene of list) {
    const picture = Buffer.from(`the picture of ${scene.id}`)
    files.set(pictureOf(scene.id), picture)
    const width = scene.width ?? 1600
    record[scene.id] = entry(scene.id, {
      captured: '2026-10-16',
      settings: { ...SETTINGS, width },
      clip: { x: 0, y: 0, width, height: 400 },
      picture,
      look: structuredClone(LOOK),
      data: 'the starters',
      stylesheet: 'sha256 0',
      text: TEXT[scene.id],
    })
  }
  const skeleton = [
    '# Formancy Report',
    '',
    'Intro.',
    '',
    START('hero'),
    END,
    '',
    '## The Studio',
    '',
    START('studio'),
    END,
    '',
    '## A viewer',
    '',
    START('viewer'),
    END,
    '',
  ].join('\n')
  return {
    scenes: list,
    record,
    recordText: serialize(record, list),
    readme: rewrite(skeleton, list, record),
    listing: ['captured.json', ...list.map((scene) => `${scene.id}.webp`)],
    file: (path) => files.get(path),
    exists: (path) => path === LINK.slice(2) || files.has(path),
    appScripts: ['studio', 'viewer'],
    files,
  }
}

const ALL = { regionProblems, integrityProblems, orphanProblems, quoteProblems, lookProblems, linkProblems, shapeProblems, guardProblems }

describe('each check, on a small repository', () => {
  // The guard on the guards below: the unchanged small repository passes
  // every check, so each failure below is the change it names and nothing else.
  test('passes every check as a capture leaves it', () => {
    const state = fixture()
    for (const [name, check] of Object.entries(ALL)) expect(check(state), name).toEqual([])
  })

  // The format README.md shows, pinned: the picture at its recorded CSS width
  // with its alt, the italic caption, a run of `more` scenes folded into one
  // <details> whose summary is their titles, and the line that says how the
  // pictures are taken and held. The hero is not in its app's region.
  test('renders a region in the order scenes.json gives, with runs of more scenes folded', () => {
    const { scenes: list, record } = fixture()
    expect(render(list, record).studio).toBe(
      [
        '<img src="./docs/images/readme/studio-refusal.webp" width="1600" alt="The Preview.">',
        '',
        '*Its button, “Select Book value”.*',
        '',
        '<details>',
        '<summary>More: Narrow, Blank</summary>',
        '',
        '<img src="./docs/images/readme/studio-narrow.webp" width="390" alt="The Studio, narrow.">',
        '',
        '*“Page 1 of 2” and the next.*',
        '',
        '<img src="./docs/images/readme/studio-blank.webp" width="1600" alt="The builder.">',
        '',
        '*“the body holds nothing”.*',
        '',
        '</details>',
        '',
        LINE,
      ].join('\n'),
    )
  })

  // The README opens with a picture of the editor, as formancy.ai's and
  // Formancy Data's do: a hero left in its app's region would put the first
  // picture of the editor below the whole Status, where a reader who stops
  // at the top never sees one.
  test('renders the hero in a region of its own, ending with the line that says how it is held', () => {
    const { scenes: list, record } = fixture()
    expect(Object.keys(render(list, record))).toEqual(['hero', 'studio', 'viewer'])
    expect(render(list, record).hero).toBe(
      [
        '<img src="./docs/images/readme/studio-react.webp" width="1600" alt="The Studio, “Preview: printed.”">',
        '',
        `*Down to “Total CHF 3'143.00” ([0010](${LINK})).*`,
        '',
        HERO_LINE,
      ].join('\n'),
    )
  })

  // The hero's line sends the reader to the section that says how the
  // pictures are taken and what nothing checks. An anchor is no file, so the
  // link check does not read it: a heading renamed would leave the line
  // pointing nowhere, and this reads the heading the anchor is made from.
  test("ends the hero with a line whose anchor is a heading of README.md's", () => {
    const anchors = [...HERO_LINE.matchAll(/\]\(#([^)]+)\)/g)].map((match) => match[1])
    expect(anchors).toEqual(['the-studio'])
    const headings = readFileSync(join(REPO, 'README.md'), 'utf8')
      .split(/\r?\n/)
      .filter((line) => line.startsWith('## '))
      .map((line) =>
        line
          .slice(3)
          .trim()
          .toLowerCase()
          .replaceAll(/[^a-z0-9 -]/g, '')
          .replaceAll(' ', '-'),
      )
    expect(headings).toContain('the-studio')
  })

  // The line every app's region ends with names the commands that hold the
  // pictures, and the CI job that runs them; a script renamed or dropped
  // from a manifest, or a job that no longer runs the check, would leave
  // the README naming a check nobody runs. Read from the manifests and from
  // gates.yml, so a rename fails here.
  test("ends each app's region with a line naming commands and a CI job that exist", () => {
    const studio = JSON.parse(readFileSync(join(REPO, 'apps', 'studio', 'package.json'), 'utf8'))
    const root = JSON.parse(readFileSync(join(REPO, 'package.json'), 'utf8'))
    const named = [...LINE.matchAll(/`([^`]+)`/g)].map((match) => match[1])
    expect(named).toEqual(['node scripts/pictures.mjs', 'pnpm --filter @formancy/report-studio test:pictures', 'pnpm test:repo', 'browser'])
    expect(studio.name).toBe('@formancy/report-studio')
    expect(studio.scripts['test:pictures']).toBe('node scripts/pictures.mjs --check')
    expect(root.scripts['test:repo']).toMatch(/vitest run --config vitest\.repo\.config\.mts/)
    const runs = (readWorkflow(REPO).jobs?.browser?.steps ?? []).map((step) => String(step.run ?? ''))
    expect(runs.some((run) => run.includes('test:pictures') && run.includes('@formancy/report-studio'))).toBe(true)
  })

  // Watched failing with: one caption edited in scenes.json without `readme.mjs --write`.
  test('regions: a caption edited without writing the README', () => {
    const state = fixture()
    state.scenes[1].caption = 'Its button, “Select Book value”, said differently.'
    expect(regionProblems(state)).toEqual([
      'README.md\'s pictures region "studio" is not what scenes.json and captured.json render: run `node scripts/pictures/readme.mjs --write`',
    ])
  })

  // Watched failing with: the studio region's markers deleted from README.md.
  test("regions: the studio region's markers deleted", () => {
    const state = fixture()
    state.readme = state.readme.replace(START('studio'), '')
    expect(regionProblems(state)).toEqual([expect.stringContaining('does not hold the pictures region "studio"')])
  })

  // A second copy of a region, or one no scene is drawn in, is a region nothing renders.
  test('regions: one twice, and one no scene is drawn in', () => {
    const twice = fixture()
    twice.readme = `${twice.readme}\n${START('viewer')}\n${END}\n`
    expect(regionProblems(twice)).toEqual(['README.md holds the pictures region "viewer" twice'])
    const stray = fixture()
    stray.readme = `${stray.readme}\n${START('site')}\n${END}\n`
    expect(regionProblems(stray)).toEqual(['README.md holds a pictures region "site" no scene is drawn in'])
  })

  // Watched failing with: one byte appended to a picture; separately, a picture deleted.
  test('integrity: a picture changed by a byte, and one deleted', () => {
    const changed = fixture()
    changed.files.set(pictureOf('studio-refusal'), Buffer.concat([changed.files.get(pictureOf('studio-refusal')), Buffer.from([0])]))
    expect(integrityProblems(changed)).toEqual([expect.stringMatching(/^docs\/images\/readme\/studio-refusal\.webp is not the picture its record describes/)])
    const deleted = fixture()
    deleted.files.delete(pictureOf('studio-narrow'))
    expect(integrityProblems(deleted)).toEqual(['docs/images/readme/studio-narrow.webp does not exist, and its record says it was taken'])
  })

  // A record written by hand, or merged with CRLF line endings, is not what
  // the camera writes, and the next capture would rewrite every line of it.
  test('integrity: a scene with no record, and a record not as the camera writes it', () => {
    const missing = fixture()
    delete missing.record['studio-react']
    missing.recordText = serialize(missing.record, missing.scenes)
    expect(integrityProblems(missing)).toEqual(['studio-react has no record: `node scripts/pictures.mjs --scene studio-react` takes it'])
    const crlf = fixture()
    crlf.recordText = crlf.recordText.replaceAll('\n', '\r\n')
    expect(integrityProblems(crlf)).toEqual([
      'docs/images/readme/captured.json is not as the camera writes it: pretty-printed, keyed in scenes.json order, LF only',
    ])
  })

  // Watched failing with: a stray picture in the directory; separately, a record with no scene.
  test('orphans: a stray picture, and a record with no scene', () => {
    const stray = fixture()
    stray.listing.push('stray.webp')
    expect(orphanProblems(stray)).toEqual(["docs/images/readme/stray.webp is no scene's picture"])
    const record = fixture()
    record.record['studio-gone'] = record.record['studio-react']
    expect(orphanProblems(record)).toEqual(['captured.json records studio-gone, which is no scene of scenes.json'])
  })

  // Watched failing with: “Select Book value” changed to “Select Tag” in a caption.
  test('quotes: a caption quoting what its part does not say', () => {
    const state = fixture()
    state.scenes[1].caption = 'Its button, “Select Tag”.'
    expect(quoteProblems(state)).toEqual([
      'studio-refusal: “Select Tag” is quoted in its caption or alt and is not a key of its quotes, so nothing holds it to the picture',
      'studio-refusal: “Select Book value” is a key of its quotes and is quoted in neither its caption nor its alt',
    ])
    state.scenes[1].quotes = { 'Select Tag': ['Preview'] }
    expect(quoteProblems(state)).toEqual([
      'studio-refusal: “Select Tag” is not inside one name or value of what the part Preview says, so the caption quotes what its picture does not show',
    ])
  })

  // Watched failing with: the total scoped to a part the picture does not have.
  test('quotes: a quote scoped to a part the picture does not have, and a recorded line that does not decode', () => {
    const part = fixture()
    part.scenes[0].quotes["Total CHF 3'143.00"] = ['Preview', 'Builder']
    expect(quoteProblems(part)).toEqual(["studio-react: “Total CHF 3'143.00” must occur in the part Builder, which the picture does not have"])
    const line = fixture()
    line.record['studio-refusal'].text.Preview += '\nbutton: unread'
    expect(quoteProblems(line)).toEqual(
      expect.arrayContaining([
        'studio-refusal, part Preview: line 3 is not an accessibility snapshot line: it does not start with "- " at an even indentation',
      ]),
    )
  })

  // Watched failing with: one record's chromium edited.
  test('one look: one record taken on another Chromium', () => {
    const state = fixture()
    state.record['studio-narrow'].look.chromium = '157.0.0.0'
    expect(lookProblems(state)).toEqual([
      expect.stringMatching(
        /^the pictures were taken on 2 looks, and every one must be taken on one: .*Chromium 156\.0\.8078\.4.*; .*Chromium 157\.0\.0\.0.*`node scripts\/pictures\.mjs --all` retakes every picture$/,
      ),
    ])
  })

  // Watched failing with: a caption linking a decision record that does not exist.
  test('links: a caption linking a decision record that does not exist', () => {
    const state = fixture()
    state.scenes[1].caption = 'Its button, “Select Book value” ([0099](./docs/decisions/0099-no-such-record.md)).'
    expect(linkProblems(state)).toEqual(["studio-refusal's caption links ./docs/decisions/0099-no-such-record.md, which is no file of the repository"])
  })

  // Every <img> is written into README.md by the render, not by a caption:
  // a picture gone would leave the README showing nothing while a
  // caption-only check stayed green.
  test('links: a region showing a picture that does not exist', () => {
    const state = fixture()
    state.files.delete(pictureOf('studio-blank'))
    expect(linkProblems(state)).toEqual([
      'README.md\'s pictures region "studio" links ./docs/images/readme/studio-blank.webp, which is no file of the repository',
    ])
  })

  // Watched failing with: a scene's app set to `studios`.
  test('shape: a scene whose app has no pictures script', () => {
    const state = fixture()
    state.scenes[3].app = 'studios'
    expect(shapeProblems(state)).toEqual(['studio-blank: apps/studios/scripts/pictures.mjs does not exist, so nothing takes or checks this picture'])
  })

  // Each would break the render or the walk: an id the file name cannot
  // carry, two scenes of one id, Markdown an alt would show as written, a
  // placement nothing renders, a width that is not a whole number.
  test('shape: ids, alts, placements, widths and titles', () => {
    const state = fixture()
    state.scenes[0].id = 'Studio React'
    state.scenes[3].id = 'studio-narrow'
    state.scenes[2].alt = 'The Studio at `390`.'
    state.scenes[1].placement = 'banner'
    state.scenes[2].width = '390'
    state.scenes[4].title = ''
    expect(shapeProblems(state)).toEqual([
      'the scene id "Studio React" is not [a-z0-9-]+',
      'studio-refusal: placement "banner" is none of hero, inline, more',
      "studio-narrow's alt has Markdown in it, which an alt shows as written",
      'studio-narrow: width "390" is not a whole number of CSS pixels',
      'the scene id studio-narrow is used twice',
      'viewer-page has no title',
    ])
  })

  // No hero would open the README with no picture of the editor, which is
  // what that region exists for; two would put two pictures where the
  // README opens with one.
  test('shape: no hero, and two', () => {
    const none = fixture()
    none.scenes[0].placement = 'inline'
    expect(shapeProblems(none)).toEqual(['scenes.json must have exactly one hero scene, the picture README.md opens with; it has 0'])
    const two = fixture()
    two.scenes[1].placement = 'hero'
    expect(shapeProblems(two)).toEqual(['scenes.json must have exactly one hero scene, the picture README.md opens with; it has 2'])
  })

  // A <details> summary lists its `more` scenes' titles with commas, so a
  // title with one in it reads as two scenes.
  test('shape: a title with a comma in it', () => {
    const state = fixture()
    state.scenes[3].title = 'Blank, with its warning'
    expect(shapeProblems(state)).toEqual([
      "studio-blank's title has a comma in it, and a <details> summary joins titles with commas, so it would read as two scenes",
    ])
  })

  // Watched failing with: the viewer's scene removed from scenes.json.
  test('guard on the guard: an app script with no scene, and no scene at all', () => {
    const state = fixture()
    state.scenes.splice(4, 1)
    expect(guardProblems(state)).toEqual(['apps/viewer/scripts/pictures.mjs takes no scene of scenes.json, so its check would compare nothing'])
    expect(shapeProblems({ ...state, scenes: [] })).toEqual([
      'scenes.json has no scene, so the README shows no picture and nothing is checked',
      'scenes.json must have exactly one hero scene, the picture README.md opens with; it has 0',
    ])
  })

  // A render that drew no picture would be written into README.md and then
  // match it, so the region check alone would pass an empty README.
  test('guard on the guard: a region that draws no picture, and a render that cannot draw', () => {
    const state = fixture()
    const rendered = render(state.scenes, state.record)
    expect(guardProblems(state, { ...rendered, viewer: '*“Page 1 of 1”.*' })).toEqual(['the pictures region "viewer" renders no picture'])
    expect(guardProblems({ ...state, record: {} })).toEqual([
      expect.stringMatching(/^the regions could not be rendered, so none drew a picture: studio-react has no record/),
    ])
  })
})
