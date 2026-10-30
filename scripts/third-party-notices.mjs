// The licence and notice texts of every package a built app bundles
// (formancy.ai-data 0046, brought here with the Studio).
//
// A Vite plugin, in apps/studio's config, that writes THIRD-PARTY-NOTICES.txt
// beside the app's index.html. The bundles keep no licence comment, so
// without it the code of React, Angular, pdfmake, PDF.js and upstream
// formancy reaches every browser with none of the texts their licences ask to
// travel with it: MIT's notice, and for an Apache-2.0 package its NOTICE
// (section 4(d)). Vite's own `build.license` reads one licence file per
// package and never a NOTICE.
//
// Every module of every chunk, and every file the build writes beside them,
// is placed, or the build stops:
//
// - under node_modules, it belongs to the package directly below the last
//   node_modules of its path. Each such package is listed once, by name and
//   version, with the full text of every licence and notice file in its
//   directory -- a name that begins LICENSE, LICENCE, COPYING or NOTICE in
//   any case, so rxjs's LICENSE.txt is found and so is formancy's NOTICE,
//   and is not a script or data by its extension -- and of every such file
//   in a directory between there and a bundled file of it, where a package
//   keeps code it vendors under that code's own licence. A package with no
//   licence text at its root stops the build, naming it;
// - in this repository and not under node_modules, it is this repository's
//   own -- a workspace package resolves to its real path here -- and is not
//   listed: LICENSE.md and NOTICE cover it;
// - written by the bundler itself, it is one of BUNDLER_MODULES and is not
//   listed; written by one of the app's own plugins, it is one of the
//   `ownModules` the app's config names and is not listed either; any other
//   module a plugin writes stops the build;
// - a worker, which Vite bundles in a build of its own that runs none of
//   these plugins, stops the build: the module that imports it with
//   `?worker`, and the file its code comes back as, which names no source;
// - a file the build writes is placed by the source files Vite names for
//   it, and a stylesheet or source map Vite makes from a chunk is that
//   chunk's; any other file with no source stops the build;
// - anywhere else, nothing here can say whose it is, and the build stops.
//
// What a package's files cannot say, the app's config says, reviewed:
// `embedded` names a bundled file that carries somebody else's work with no
// licence text of its own beside it -- pdfmake's build/vfs_fonts.js, Roboto's
// four fonts as base64, with only pdfmake's MIT licence in the package -- and
// the text that work's licence asks to travel with it. The text is added to
// the package's entry. A file of the repository's own can carry such a work
// too -- report-render-pdf's bill-fonts chunk, Liberation Sans as base64 --
// and is named by its workspace package's name: that package is then
// listed with the notice alone, its own code still this repository's. A
// file is named by its path in its package, or by a pattern of it for a
// chunk whose name a build hashes. A file named there that the build no
// longer bundles stops the build, so the list cannot outlive what it is
// about.
//
// The modules are read as each chunk is rendered, not from the bundle at the
// end: the CSS step removes a chunk that held only stylesheets, and moves its
// rules into a stylesheet of their own, by the time the bundle is written.
//
// A build that copies a package's files rather than bundling them -- the
// product pages' faces (0023) -- has no bundler to place them: it names the
// packages itself, and `copiedNotices` writes their notices as the plugin
// writes a bundle's.
//
// Node built-ins only, as in formancy.ai-data, where a gate that runs from a
// checkout with nothing installed imports NOTICES_FILE from here.

import { readdirSync, readFileSync, realpathSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/** The file each build writes beside its index.html. */
export const NOTICES_FILE = 'THIRD-PARTY-NOTICES.txt'

/** A licence's text, by how its file's name begins: LICENSE, LICENSE.txt, LICENCE.md, COPYING. */
const LICENCE = /^(licen[cs]e|copying)/i

/** A notice a licence asks to be reproduced, Apache-2.0's above all. */
const NOTICE = /^notice/i

/**
 * A script, a stylesheet, JSON, a source map or WebAssembly, by its
 * extension: code or data, never a licence's text, whatever its name begins
 * with -- a package's license.js is not its licence.
 */
const CODE = /\.(?:[cm]?[jt]sx?|json|map|wasm|css)$/i

/**
 * The modules the bundler writes into a chunk itself rather than reading
 * them from a package: Rolldown's runtime helpers and Vite's preload
 * helpers, the ones formancy.ai-data's apps had with Vite 8.3.3 on
 * 2026-10-11. They are not listed, and Vite's own licence output lists none
 * of them either. Any other module whose id begins with `\0` -- the
 * bundler's mark for one no file holds -- and is not one of the app's
 * `ownModules` stops the build, so a plugin that writes a library into a
 * chunk is read before it ships.
 */
export const BUNDLER_MODULES = new Set(['\0rolldown/runtime.js', '\0vite/modulepreload-polyfill.js', '\0vite/preload-helper.js'])

/** A module Vite turns into a worker, as its own worker plugin tells them (`?worker`, `?sharedworker`). */
const WORKER = /[?&](?:worker|sharedworker)(?:&|$)/

const NODE_MODULES = '/node_modules/'

/** A path `/`-separated, as the bundler names modules on every platform. */
const slashed = (path) => path.replaceAll('\\', '/')

/** A module id as a path: without the query a plugin may add. */
const pathOf = (id) => slashed(id.split('?')[0])

/** The package directory a path under node_modules belongs to: the one directly below its last node_modules. */
function packageDirectory(path) {
  const at = path.lastIndexOf(NODE_MODULES)
  if (at === -1) return undefined
  const below = path.slice(at + NODE_MODULES.length).split('/')
  const name = below[0].startsWith('@') ? `${below[0]}/${below[1]}` : below[0]
  return `${path.slice(0, at + NODE_MODULES.length)}${name}`
}

/**
 * The directory of the workspace package a file of the repository's own
 * belongs to: the nearest above it, below the repository's root, that holds
 * a package.json. `seen` keeps each directory's answer for the next file.
 */
function workspacePackage(path, repository, seen) {
  for (let directory = dirname(path); directory.startsWith(repository); directory = dirname(directory)) {
    if (!seen.has(directory)) seen.set(directory, readdirSync(directory).includes('package.json'))
    if (seen.get(directory)) return directory
  }
  return undefined
}

/** The bundled file of `files` that `notice` names: by its path in the package, or by a pattern of it. */
const namedFile = (notice, files) => [...files].sort().find((file) => (typeof notice.file === 'string' ? file === notice.file : notice.file.test(file)))

/** A file's text, which must be UTF-8: a byte-order mark is dropped, anything else that is not UTF-8 throws. */
const utf8 = (bytes) => new TextDecoder('utf-8', { fatal: true }).decode(bytes)

/**
 * The licence and notice files in one directory of a package, in name
 * order, each named by `prefix` and its own name; `problems` names any that
 * is not UTF-8, as package `id`'s.
 */
function licenceFiles(directory, prefix, id) {
  const files = []
  const problems = []
  for (const name of readdirSync(directory).sort()) {
    if ((!LICENCE.test(name) && !NOTICE.test(name)) || CODE.test(name)) continue
    if (!statSync(join(directory, name)).isFile()) continue
    try {
      files.push({ name: `${prefix}${name}`, licence: LICENCE.test(name), text: utf8(readFileSync(join(directory, name))).trimEnd() })
    } catch {
      problems.push(`${id}'s ${prefix}${name} is not UTF-8, so it cannot be reproduced as it ships`)
    }
  }
  return { files, problems }
}

/**
 * A package as the notices list it, read from its directory: its manifest's
 * name, version and licence, the licence and notice files at its root, then
 * those in each directory of `within` -- the directories between its root
 * and a bundled file of it -- in path order. `problems` says why it cannot be
 * listed as it ships; `how` says how its files reach the build.
 */
function readPackage(directory, within, how = 'bundled') {
  let manifest
  try {
    manifest = JSON.parse(readFileSync(join(directory, 'package.json'), 'utf8'))
  } catch {
    return { problems: [`${directory} holds a bundled module and no package.json this plugin can read, so its name and terms are unknown`] }
  }
  const id = `${String(manifest.name)}@${String(manifest.version)}`
  const own = licenceFiles(directory, '', id)
  const problems = [...own.problems]
  const files = [...own.files]
  for (const inner of [...within].sort()) {
    const found = licenceFiles(inner, `${inner.slice(directory.length + 1)}/`, id)
    problems.push(...found.problems)
    files.push(...found.files)
  }
  if (problems.length === 0 && !own.files.some((file) => file.licence && file.text.trim() !== '')) {
    problems.push(
      `${id} is ${how} and ships no licence text: no file at its root whose name begins LICENSE, LICENCE or COPYING, and is not a script or data, holds any`,
    )
  }
  return { id, name: String(manifest.name), version: String(manifest.version), declared: manifest.license, files, problems }
}

/** Packages in the order the notices list them: by name, then by version. */
const byNameAndVersion = (a, b) => (a.name === b.name ? (a.version < b.version ? -1 : 1) : a.name < b.name ? -1 : 1)

/**
 * The `embedded` notices, each with its text read: the file named is
 * UTF-8, or the build stops naming it.
 */
function embeddedNotices(embedded) {
  const notices = []
  const problems = []
  for (const entry of embedded) {
    try {
      notices.push({ ...entry, text: utf8(readFileSync(entry.from)).trimEnd() })
    } catch {
      problems.push(`the notice for ${entry.package}'s ${entry.file}, ${slashed(entry.from)}, cannot be read as UTF-8`)
    }
  }
  return { notices, problems }
}

/**
 * Every package `ids` came from -- the modules of the chunks and the source
 * files of what is written beside them -- each once, in name and version
 * order, and what stops them being listed. `workspace` is the directory
 * whose files outside node_modules are this repository's own; `own` the
 * ids of the modules the app's plugins write; `embedded` the reviewed
 * notices for what a bundled file carries.
 */
function bundledPackages(ids, { workspace, own, embedded }) {
  // By its real path, as the bundler names modules: on Windows a directory
  // reached through an 8.3 name (C:\Users\DBACH~1.BLA) is the same directory
  // the bundler names by its long one.
  const repository = `${slashed(realpathSync.native(resolve(workspace))).replace(/\/$/, '')}/`
  // Each package directory, with the directories below its root that hold a
  // bundled file of it, and those files by their path in the package.
  const directories = new Map()
  // Each workspace package a file of the repository's own is bundled from,
  // with those files by their path in it, for the notices that name one.
  const workspaces = new Map()
  const seen = new Map()
  const problems = []
  for (const id of ids) {
    if (id.startsWith('\0')) {
      if (!BUNDLER_MODULES.has(id) && !own.has(id))
        problems.push(
          `${JSON.stringify(id.slice(1))} is a module a plugin or the bundler wrote, and neither one of the reviewed BUNDLER_MODULES in scripts/third-party-notices.mjs nor one of the app's own`,
        )
      continue
    }
    if (WORKER.test(id)) {
      problems.push(`${slashed(id)} is a worker, which Vite bundles in a build of its own that this plugin does not see, so what it carries is unknown`)
      continue
    }
    const path = pathOf(id)
    const directory = packageDirectory(path)
    if (directory === undefined) {
      if (!path.startsWith(repository)) {
        problems.push(
          `${path} is bundled and is neither in a package under node_modules nor this repository's own, so whose it is and under what terms is unknown`,
        )
      } else if (embedded.length > 0) {
        const workspace = workspacePackage(path, repository, seen)
        if (workspace !== undefined) workspaces.set(workspace, (workspaces.get(workspace) ?? new Set()).add(path.slice(workspace.length + 1)))
      }
      continue
    }
    const found = directories.get(directory) ?? { within: new Set(), files: new Set() }
    directories.set(directory, found)
    found.files.add(path.slice(directory.length + 1))
    for (let inner = dirname(path); inner.length > directory.length && inner.startsWith(`${directory}/`); inner = dirname(inner)) found.within.add(inner)
  }
  const notices = embeddedNotices(embedded)
  problems.push(...notices.problems)
  const carried = new Set()
  const packages = new Map()
  for (const [directory, { within, files }] of directories) {
    const found = readPackage(directory, within)
    problems.push(...found.problems)
    if (found.problems.length > 0) continue
    // One name and version installed twice -- pnpm does, once per set of
    // peers -- is one package; what the second copy vendors is added.
    const listed = packages.get(found.id) ?? found
    if (listed !== found) for (const file of found.files) if (!listed.files.some((each) => each.name === file.name)) listed.files.push(file)
    packages.set(found.id, listed)
    for (const notice of notices.notices) {
      const file = notice.package === found.name && !carried.has(notice) ? namedFile(notice, files) : undefined
      if (file === undefined) continue
      carried.add(notice)
      listed.files.push({ name: `${file}: ${notice.name}`, licence: false, text: notice.text })
    }
  }
  // A workspace package is listed only for what a notice says one of its
  // files carries, and with that notice alone.
  for (const [directory, files] of workspaces) {
    // The bundler read this manifest for the module's scope before the
    // plugin saw the module, and stops on one that does not parse.
    const manifest = JSON.parse(readFileSync(join(directory, 'package.json'), 'utf8'))
    for (const notice of notices.notices) {
      const file = notice.package === manifest.name && !carried.has(notice) ? namedFile(notice, files) : undefined
      if (file === undefined) continue
      carried.add(notice)
      const id = `${String(manifest.name)}@${String(manifest.version)}`
      const listed = packages.get(id) ?? { id, name: String(manifest.name), version: String(manifest.version), own: true, files: [], problems: [] }
      listed.files.push({ name: `${file}: ${notice.name}`, licence: false, text: notice.text })
      packages.set(id, listed)
    }
  }
  for (const notice of notices.notices) {
    if (!carried.has(notice))
      problems.push(
        `the notice for ${notice.package}'s ${notice.file} (${notice.name}) names a file this build does not bundle: the reviewed list in the app's config is out of date`,
      )
  }
  return { packages: [...packages.values()].sort(byNameAndVersion), problems }
}

const RULE = '-'.repeat(80)

/** What a bundle's notices say of themselves. */
const BUNDLED = [
  'The packages below are bundled into the files beside this one. Each is',
  'listed once, by name and version, with the licence its package.json',
  'declares, and is followed by its licence and notice files as it ships',
  'them: those at its root, and those in any directory between there and a',
  'file of it that is bundled, named by their path in the package. Where a',
  "bundled file carries somebody else's work that its package ships no",
  "licence text for -- fonts inside a script -- that work's notice follows,",
  'named by the file that carries it.',
  '',
  "The rest of this build is not listed: the Formancy Report repository's own",
  "code, under the terms of that repository's LICENSE.md and NOTICE, which are",
  'at the root of its source, not beside this file; and the helpers the',
  'bundler writes into its output itself.',
]

/** What the notices of the files a build copies say of themselves. */
const COPIED = [
  'The packages below ship files that this build copies, as they ship them,',
  'beside this one. Each is listed once, by name and version, with the',
  'licence its package.json declares, and is followed by the licence and',
  'notice files at its root, as it ships them.',
  '',
  "The rest of this build is not listed: the Formancy Report repository's own",
  "work, under the terms of that repository's LICENSE.md and NOTICE, which are",
  'at the root of its source, not beside this file.',
]

/** The notices file's text: what it is, as `intro` says, then each package with its files' texts. */
function noticesText(packages, intro) {
  const lines = ['Third-party notices', '', ...intro]
  for (const found of packages) {
    lines.push('', RULE, `${found.name} ${found.version}`)
    if (found.own === true) lines.push("This repository's own package, listed for the work a file of it carries.")
    if (typeof found.declared === 'string') lines.push(`Declared licence: ${found.declared}`)
    lines.push(`Files: ${found.files.map((file) => file.name).join(', ')}`, RULE)
    for (const file of found.files) lines.push('', `== ${file.name} ==`, '', file.text)
  }
  return `${lines.join('\n')}\n`
}

/**
 * The notices for the packages at `directories` -- each an installed
 * package's directory, named once or more, in any order -- whose files a
 * build copies rather than bundles: each listed once, in name and version
 * order, as the plugin lists a bundled one, with the licence and notice
 * files at its root. Throws, naming every package that cannot be listed as
 * it ships.
 */
export function copiedNotices(directories) {
  const packages = new Map()
  const problems = []
  for (const directory of new Set(directories)) {
    const found = readPackage(directory, new Set(), 'copied')
    problems.push(...found.problems)
    if (found.problems.length === 0) packages.set(found.id, found)
  }
  if (problems.length > 0) throw new Error(`${NOTICES_FILE} cannot be written:\n- ${problems.join('\n- ')}`)
  return noticesText([...packages.values()].sort(byNameAndVersion), COPIED)
}

/**
 * The plugin. Build only: the dev server and the app's suite bundle
 * nothing. `workspace` defaults to this repository's root, found from this
 * file when the bundle is written, not when the config loads. Among the
 * plugins Vite runs last, after its CSS step and its page, so it sees the
 * stylesheets, the page and what the plugins before it write.
 *
 * `ownModules`: the ids of the modules the app's own plugins write, each of
 * them this repository's code. `embedded`: `{ package, file, name, from }`
 * for each bundled file that carries a work with no licence text of its own
 * in its package -- `from` the file holding the notice that work's licence
 * asks for.
 *
 * @param {{
 *   workspace?: string
 *   ownModules?: readonly string[]
 *   embedded?: readonly { package: string; file: string | RegExp; name: string; from: string }[]
 * }} [options]
 */
export function thirdPartyNotices({ workspace, ownModules = [], embedded = [] } = {}) {
  const own = new Set(ownModules)
  let root
  let modules = new Set()
  let stylesheets = new Set()
  return {
    name: 'formancy-report:third-party-notices',
    apply: 'build',
    enforce: 'post',
    configResolved(config) {
      root = config.root
    },
    renderStart() {
      modules = new Set()
      stylesheets = new Set()
    },
    renderChunk(_code, chunk) {
      for (const id of chunk.moduleIds) modules.add(id)
      for (const fileName of chunk.viteMetadata?.importedCss ?? []) stylesheets.add(fileName)
      return null
    },
    generateBundle(_options, bundle) {
      const items = Object.values(bundle)
      const maps = new Set(items.flatMap((item) => (item.type === 'chunk' && item.sourcemapFileName ? [item.sourcemapFileName] : [])))
      const ids = [...modules]
      const problems = []
      for (const item of items) {
        if (item.type === 'chunk' || stylesheets.has(item.fileName) || maps.has(item.fileName)) continue
        if (item.originalFileNames.length === 0)
          problems.push(
            `${item.fileName} is written from no source file Vite names -- a worker's code, which Vite bundles in a build of its own, or a file a plugin emits -- so whose it is is unknown`,
          )
        for (const name of item.originalFileNames) ids.push(resolve(root, name))
      }
      const found = bundledPackages(ids, { workspace: workspace ?? fileURLToPath(new URL('..', import.meta.url)), own, embedded })
      problems.push(...found.problems)
      if (problems.length > 0) this.error(`${NOTICES_FILE} cannot be written:\n- ${problems.join('\n- ')}`)
      this.emitFile({ type: 'asset', fileName: NOTICES_FILE, source: new TextEncoder().encode(noticesText(found.packages, BUNDLED)) })
    },
  }
}
