// One app's README pictures, walked: the arguments an app's script takes, a
// browser opened with the camera's settings, the app's acts run in walk
// order, and at each scene what the mode asks for -- the text read and
// compared, or the picture taken -- then the record written, or what the
// check found said. formancy.ai-data's scripts/pictures/session.mjs (its
// 0038), for an app with no server, and with a scene that may name its own,
// narrow, width.
//
// apps/<app>/scripts/pictures.mjs holds its routing and one act per scene.
// This holds what it would otherwise decide again: which scene is shot, that
// --check refuses the font files and shoots nothing, that nothing is
// written until every scene of the walk has passed, and what each record
// entry says. Node built-ins, scripts/browsers.mjs, which says how a gate
// launches its browser, and scripts/web-fonts.mjs, which says which faces
// the build serves; the app passes in its own Playwright.
//
//   node scripts/pictures.mjs                walk every scene; retake those whose text changed, or that have no record or no picture
//   node scripts/pictures.mjs --all          retake every scene of the app
//   node scripts/pictures.mjs --scene <id>   retake those scenes (repeatable)
//   node scripts/pictures.mjs --check        walk every scene, compare each part's text with the record, write nothing
//   node scripts/pictures.mjs --review <dir> also write each new picture, decoded to PNG, into <dir> outside the repository
//
// Except, under --check, what the check found: apps/<app>/test-results/pictures.json,
// written however the walk ends, for the release report (collect.mjs --job
// browser). A check that left nothing would look like a check never run.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { LAUNCH_OPTIONS, launchedAs } from '../browsers.mjs'
import { parse } from '../pictures.mjs'
import { declaredFamilies, faceVersions, FONT_FILE } from '../web-fonts.mjs'
import * as camera from './camera.mjs'
import {
  announce,
  checkProblems,
  entry,
  IMAGES,
  lineDiff,
  pairingProblems,
  pictureOf,
  readRecord,
  readScenes,
  REPO,
  stylesheetNotices,
  withEntry,
  writeRecord,
} from './record.mjs'

/** The root runner's arguments, for one app: no --app, and no scene of another app. */
export function appOptions(argv, scenes, app) {
  const script = `apps/${app}/scripts/pictures.mjs`
  if (argv.includes('--app')) throw new Error(`--app is the root runner's option: ${script} takes its own scenes only`)
  const options = parse(argv, scenes)
  for (const id of options.scenes) {
    const { app: other } = scenes.find((scene) => scene.id === id)
    if (other !== app) throw new Error(`--scene ${id} is a ${other} scene, and this is ${script}`)
  }
  return options
}

/**
 * Why scene `id` is shot in this run, or undefined when it is not: what
 * --all and --scene name; by default, a scene whose text is not the
 * record's, or that has no record, no picture, or a picture other than the
 * one its record describes; under --check, none.
 */
export function reasonToShoot({ options, id, record, text, picture }) {
  if (options.check) return undefined
  if (options.all) return '--all'
  if (options.scenes.length > 0) return options.scenes.includes(id) ? '--scene' : undefined
  const recorded = record[id]
  if (recorded === undefined) return 'it has no record'
  if (picture === undefined) return 'it has no picture'
  if (picture.length !== recorded.bytes || camera.digest(picture) !== recorded.sha256) return 'its picture is not the one its record describes'
  if (JSON.stringify(recorded.text) !== JSON.stringify(text)) return 'its text changed'
  return undefined
}

/**
 * What the log says of scene `id` when reasonToShoot gave no reason to shoot
 * it. Under --scene a scene not named was walked and its text read, so it is
 * compared and said either way -- never retaken, since --scene shoots only
 * what it names; by default only a scene whose text is the record's is left.
 */
export function notShot({ options, id, record, text }) {
  if (options.check) return 'walked'
  if (options.scenes.length === 0) return "its text is the record's, so it is not retaken"
  if (JSON.stringify(record[id]?.text) === JSON.stringify(text)) return "not named by --scene; its text is the record's"
  return `not named by --scene, and its text is not the record's: \`node scripts/pictures.mjs --scene ${id}\` retakes it`
}

/**
 * The viewport width scene `scene` is walked at: its own `width`, which must
 * be at or below the narrowest breakpoint, since a scene names a width only
 * to picture the narrow layout; else the app's `width`, which the camera's
 * context already refuses at or below the widest.
 */
export function widthOf(scene, { width, narrowest }) {
  if (scene.width === undefined) return width
  if (!(Number.isInteger(scene.width) && scene.width > 0 && scene.width <= narrowest)) {
    throw new Error(
      `${scene.id} names the width ${JSON.stringify(scene.width)}, and a scene names a width only to picture the narrowest layout, at or below ${String(narrowest)}px`,
    )
  }
  return scene.width
}

/**
 * Waits until `locator`'s accessibility snapshot matches `pattern`, polling
 * it: how an act waits for a state, since it reads the tree the record holds
 * and never a CSS selector. Refuses after `within` ms with what it last said.
 */
export async function untilSnapshot(locator, pattern, { within, what }) {
  const deadline = Date.now() + within
  for (;;) {
    const said = await locator.ariaSnapshot({ timeout: within }).catch(() => '')
    if (pattern.test(said)) return said
    if (Date.now() > deadline) throw new Error(`${what} never came: after ${String(within)} ms its part said\n${said.slice(0, 1500)}`)
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
}

/**
 * How long nothing in the parts may have been `aria-busy` before a scene's
 * text is read. The Studio's paper is busy from the moment an edit asks for
 * a render until PDF.js has drawn every page of the new PDF (pdf-view.tsx,
 * held by its test and by the browser gate's first frame after an edit),
 * and the mark goes up in the effect that asks, so any window longer than
 * a frame sees a render on its way. Chosen, not measured: half a second.
 *
 * A DOM read, the one this file makes: `aria-busy` is the state, and the
 * accessibility snapshot does not carry it.
 */
const QUIET_MS = 500

async function quiet(page, parts, within) {
  const deadline = Date.now() + within
  let since = Date.now()
  for (;;) {
    const busy = await Promise.all(Object.values(parts).map((part) => part.locator('[aria-busy="true"]').count()))
    if (busy.some((count) => count > 0)) since = Date.now()
    else if (Date.now() - since >= QUIET_MS) return
    if (Date.now() > deadline) throw new Error(`a part was still busy after ${String(within)} ms`)
    await page.waitForTimeout(50)
  }
}

/** Today, as captured.json dates a picture: the UTC date, which the record's dates are compared in. */
const today = () => new Date().toISOString().slice(0, 10)

/** A repository file's bytes, or undefined when there is none. */
const repositoryFile = (path) => (existsSync(join(REPO, path)) ? readFileSync(join(REPO, path)) : undefined)

/**
 * What a --check of `app`'s pictures found, as the release report reads it:
 * when it ran, the Playwright and the browser it walked in, as launchedAs()
 * records it (null when none launched), the scenes it walked, in walk order,
 * what the comparison found, and the error that ended the walk before it, if
 * one did. Which scenes it had to walk is scenes.json's, and the report
 * reads that file itself: a scene of the app not walked was held by nobody.
 * The check's own problems are its answer, not an error.
 */
export function checkResult({ app, playwright, startedAt, finishedAt, browser = null, walked = [], problems = [], error }) {
  return {
    check: 'pictures',
    app: `apps/${app}`,
    startedAt,
    finishedAt,
    playwright,
    browser,
    walked: [...walked],
    problems: [...problems],
    ...(error === undefined ? {} : { error }),
  }
}

/** Where a --check of `app` leaves its result. */
export const checkResultFile = (app) => join(REPO, 'apps', app, 'test-results', 'pictures.json')

/**
 * Walks `config.app`'s scenes and does what `argv` asks (see the header).
 *
 * `config`:
 *   - `app`, and its `chromium` and `playwright` (the installed version);
 *   - `width`, refused at or below `css`'s widest breakpoint; `css` is
 *     `{ directory, entry }`, the stylesheet as the app's gate inlines it,
 *     and `themes` the `@formancy/themes` version the app pins -- the two
 *     the stylesheet notice is about;
 *   - `origin` and `dist`: where the page is served from;
 *   - `within`: how long a step may take, which the font wait also takes;
 *   - `data`: what the pictures were taken over, said in the record;
 *   - `open(page)`: from a blank page to where the first act starts;
 *   - `acts`: `{ <scene id>: async (page, scene) => ({ parts, keepFocus }) }`,
 *     in walk order. An act reaches its state by role and name, asserts what
 *     its caption says, and returns its parts as locators.
 *
 * Under --check, what the walk found is written to checkResultFile(app)
 * however it ends.
 */
export async function pictures(config, argv = process.argv.slice(2)) {
  const scenes = readScenes()
  const options = appOptions(argv, scenes, config.app)
  const found = { browser: null, walked: [], problems: [], compared: false }
  if (!options.check) return walk(config, scenes, options, found)
  const startedAt = new Date().toISOString()
  let error
  try {
    await walk(config, scenes, options, found)
  } catch (thrown) {
    // The comparison's own problems are the check's answer; anything thrown before it ended the walk.
    if (!found.compared) error = thrown instanceof Error ? thrown.message : String(thrown)
    throw thrown
  } finally {
    const file = checkResultFile(config.app)
    const result = checkResult({
      app: config.app,
      playwright: config.playwright,
      startedAt,
      finishedAt: new Date().toISOString(),
      browser: found.browser,
      walked: found.walked,
      problems: found.problems,
      error,
    })
    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(file, `${JSON.stringify(result, null, 2)}\n`, 'utf8')
  }
}

/** The walk itself, for pictures(): `found` gathers what a --check result says. */
async function walk(config, scenes, options, found) {
  const { app, chromium, playwright, width, css, themes, origin, dist, within, acts } = config
  const actIds = Object.keys(acts)
  // Before the walk, so an act is never run without the scene it is the picture of.
  const unpaired = pairingProblems({ app, scenes, actIds })
  if (unpaired.length > 0) throw new Error(unpaired.join('\n'))
  if (!existsSync(join(dist, 'index.html'))) throw new Error(`no built page at apps/${app}/dist: run \`pnpm --filter @formancy/report-${app} build\` first`)

  const record = readRecord()
  const sheet = camera.stylesheet(css.directory, css.entry)
  const breakpoint = camera.widestBreakpoint(sheet, css.entry)
  const narrowest = camera.narrowestBreakpoint(sheet, css.entry)
  const stylesheet = `sha256 ${camera.digest(sheet)} of src/${css.entry} with its imports, and @formancy/themes ${themes}`
  // The faces the build serves (0023), and each one's version for the look.
  const families = declaredFamilies(dist)
  if (families.length === 0)
    throw new Error(`no stylesheet of apps/${app}/dist declares a face, so there is nothing to wait for and a fallback face would be pictured unnoticed`)
  const versions = faceVersions(join(REPO, 'apps', app), families)
  const widths = Object.fromEntries(
    actIds.map((id) => [
      id,
      widthOf(
        scenes.find((scene) => scene.id === id),
        { width, narrowest },
      ),
    ]),
  )

  // As the browser gate launches it, so the two walk the build the report holds both to.
  const launch = { ...LAUNCH_OPTIONS }
  const browser = await chromium.launch(launch)
  found.browser = launchedAs(browser, launch)
  let context
  let page
  try {
    context = await camera.context(browser, { width, breakpoint })
    await camera.serve(context, { origin, dist })
    // --check compares text, which does not depend on the faces, and
    // measures each clip for intruders in the fallback stack, as it did
    // when the faces came from Google: what it finds does not wait on a
    // font's arrival. After serve(), since the route registered last is
    // asked first, and serve() answers every file of the build.
    if (options.check) await context.route(FONT_FILE, (route) => route.abort())
    page = await context.newPage()
    page.setDefaultTimeout(within)
    await config.open(page)

    const running = {}
    const shots = {}
    for (const [id, act] of Object.entries(acts)) {
      const scene = scenes.find((candidate) => candidate.id === id)
      await page.setViewportSize({ width: widths[id], height: camera.SETTINGS.height })
      let reached
      try {
        reached = await act(page, scene)
      } catch (error) {
        // Named, since the scene that fails is the picture whose caption no longer holds.
        throw new Error(`${id}: ${error instanceof Error ? error.message : String(error)}`)
      }
      const { parts, keepFocus = false } = reached
      await quiet(page, parts, within)
      // Still first, in every mode: a blur can change what a field says, and
      // a capture's text and a check's must be read in the same state.
      await camera.still(page, { keepFocus })
      running[id] = await camera.text(parts, { scene: id })
      const file = repositoryFile(pictureOf(id))
      const reason = reasonToShoot({ options, id, record, text: running[id], picture: file })
      if (reason === undefined) {
        console.log(`  ${id}: ${notShot({ options, id, record, text: running[id] })}`)
        // The clip measured and its intrusion check run in --check too: text a
        // change draws between or over the parts, outside them all, would
        // otherwise pass every check while the picture no longer shows the page.
        if (options.check) await camera.clip(page, parts, { scene: id })
        found.walked.push(id)
        continue
      }
      shots[id] = { ...(await camera.take(page, parts, { scene: id, families, within, keepFocus })), width: widths[id] }
      // The text read before the shot is what --check reads; the text after
      // it is what the record keeps. Two that differ mean the act does not
      // wait for the state it pictures, and a check would compare a moment.
      if (JSON.stringify(shots[id].text) !== JSON.stringify(running[id])) {
        const changed = Object.keys(running[id]).filter((part) => shots[id].text[part] !== running[id][part])
        const diffs = changed.map((part) => `  ${part}:\n    ${lineDiff(running[id][part], shots[id].text[part]).join('\n    ')}`)
        throw new Error(
          `${id}: ${changed.join(', ')} said something else after the picture was taken than before it, so the act does not wait for the state it pictures:\n${diffs.join('\n')}`,
        )
      }
      console.log(
        `  ${id}: shot (${reason}), ${String(shots[id].clip.width)}x${String(shots[id].clip.height)} CSS px, settled in ${String(shots[id].shots)} shots`,
      )
    }

    if (options.check) {
      announce(stylesheetNotices({ app, scenes, record, stylesheet }))
      const problems = checkProblems({ app, scenes, record, actIds, running, playwright, file: repositoryFile })
      found.problems = problems
      found.compared = true
      if (problems.length > 0) throw new Error(`the ${app} pictures no longer show what the page shows:\n  ${problems.join('\n  ')}`)
      const count = Object.keys(running).length
      console.log(
        `${app}: every part of ${String(count)} ${count === 1 ? 'scene' : 'scenes'} says what its picture was recorded saying, and every caption quotes only what its parts say`,
      )
      return
    }

    const captured = today()
    let next = record
    const written = {}
    for (const [id, shot] of Object.entries(shots)) {
      const picture = await camera.webp(browser, shot.png)
      if (options.review !== undefined) {
        mkdirSync(options.review, { recursive: true })
        writeFileSync(join(options.review, `${id}.png`), await camera.decodedPng(browser, picture))
      }
      const look = camera.look(browser, { playwright, fonts: versions })
      const settings = { ...camera.SETTINGS, width: shot.width }
      // withEntry refuses a misquoting caption and another look before anything is written.
      next = withEntry(next, scenes, id, entry(id, { captured, settings, clip: shot.clip, picture, look, data: config.data, stylesheet, text: shot.text }))
      written[id] = picture
    }
    if (Object.keys(written).length === 0) return
    mkdirSync(IMAGES, { recursive: true })
    for (const [id, picture] of Object.entries(written)) writeFileSync(join(REPO, pictureOf(id)), picture)
    writeRecord(next, scenes)
    console.log(`${app}: wrote ${Object.keys(written).join(', ')}${options.review === undefined ? '' : `, and each decoded to PNG in ${options.review}`}`)
  } finally {
    await page?.unrouteAll({ behavior: 'ignoreErrors' })
    await context?.unrouteAll({ behavior: 'ignoreErrors' })
    await browser.close()
  }
}
