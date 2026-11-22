import { execFileSync } from 'node:child_process'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, posix, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { lexer } from 'marked'
import YAML from 'yaml'
import { describe, expect, test } from 'vitest'
import { headingAnchors } from './heading-anchors.mjs'

/**
 * docs/architecture/, the arc42 documentation, held to the repository it
 * describes (0026), after formancy.ai's (its docs/README.md and CLAUDE.md's
 * "Architecture" rule).
 *
 * Prose does not break, so what a section says about a record is review's.
 * What a test can see is held here, each part derived from the files and
 * never from a phrase:
 *
 * - every section arc42 has, under the file names formancy.ai gives them,
 *   and docs/README.md, the entry that lists them, and nothing else in the
 *   directory, so a section added is a section the entry lists;
 * - every workspace package and app -- the directories pnpm-workspace.yaml's
 *   globs name, by the `name` in each one's package.json -- given one row of
 *   the building blocks' table, whose columns of dependencies name, as code,
 *   exactly what its manifest declares outside devDependencies, so a
 *   package added, or a dependency, fails until its row says so. Which
 *   layer a row stands in is not read;
 * - every decision record linked from at least one section, so a record
 *   added is a decision placed in the architecture, not only in the index;
 * - every relative link in the entry and the sections reaching a file, and
 *   a fragment into a Markdown file reaching a heading GitHub would anchor
 *   (scripts/heading-anchors.mjs);
 * - every path the entry and the sections write as code naming a file or a
 *   directory the checkout holds: a path that starts at `./` or `../` from
 *   the document, any other at the end of a path somewhere in the checkout,
 *   so a renamed test leaves no "held by" citing nothing. Which package a
 *   bare file name is in is review's.
 *
 * Each rule was watched failing with its defect planted in the real files
 * and put back byte for byte; the reading underneath each is proved on
 * fixtures first, as the other guards here prove theirs.
 */
const repo = join(dirname(fileURLToPath(import.meta.url)), '..')

/**
 * arc42's twelve sections, as formancy.ai names their files. This is the
 * shape the documents keep, not a fact about this repository, so it is
 * written here rather than derived: derived from the entry's table, a
 * section dropped from both the table and the disk would pass.
 */
const SECTIONS = [
  '01-introduction-and-goals.md',
  '02-constraints.md',
  '03-context-and-scope.md',
  '04-solution-strategy.md',
  '05-building-blocks.md',
  '06-runtime-view.md',
  '07-deployment-view.md',
  '08-crosscutting-concepts.md',
  '09-quality-requirements.md',
  '10-verification.md',
  '11-risks-and-debt.md',
  '12-glossary.md',
]

const DOCS = join(repo, 'docs')
const ARCHITECTURE = join(DOCS, 'architecture')
const ENTRY = join(DOCS, 'README.md')
const BUILDING_BLOCKS = join(ARCHITECTURE, '05-building-blocks.md')
const DECISIONS = join(DOCS, 'decisions')

/**
 * The building blocks' table, found by the headers of the columns read
 * here, so a column moved or added beside them changes nothing. Each is a
 * key of the table's, as a JSON key is, not a phrase in a sentence.
 */
const COLUMNS = { package: 'Package', here: 'Depends on, here', elsewhere: 'From elsewhere', peers: 'Peers' }

/** A decision record's file name: four digits, a hyphen, a title. The index, README.md, is not one. */
const RECORD = /^\d{4}-.+\.md$/

/** An address with a scheme -- https:, mailto: -- or one that starts at another host: not this checkout's to resolve. */
const EXTERNAL = /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i

/** Raw HTML that would carry an address: a link written so is not read by Markdown's lexer, so it would pass unread. */
const HTML_ADDRESS = /\b(?:href|src)\s*=/i

/**
 * A code span that is a path: segments of letters, digits, `.`, `_`, `-`
 * and the wildcard `*`, perhaps after `./` or `../`, and a `/` in it or a
 * file's extension at its end. No space, no scheme and no `@`, so a
 * command, an address and a package or a specifier -- `@formancy/themes/workbench.css`
 * -- are not one; a span that starts at `/` is an address's path.
 */
const PATH = /^(?:\.\.?\/)*[\w.*-]+(?:\/[\w.*-]+)*\/?$/
const EXTENSION = /\.(?:[cm]?[jt]sx?|json|md|css|ya?ml)$/
const isPath = (text) => PATH.test(text) && !/^\.\w+$/.test(text) && (text.includes('/') || EXTENSION.test(text))

const read = (file) => readFileSync(file, 'utf8').replaceAll('\r\n', '\n')
const isFile = (path) => {
  try {
    return statSync(path).isFile()
  } catch {
    return false
  }
}
const fromRepo = (path) => relative(repo, path).replaceAll('\\', '/')

/**
 * The directories `patterns` name below `root`, as pnpm reads a workspace's
 * `packages`: a path, a path ending in `/*` for each directory directly in
 * it, and a `!` before either to leave those out. Any other shape throws
 * rather than being read as something it is not, because a glob read too
 * narrowly would leave a package out of the check without a word.
 */
function expandWorkspace(patterns, listDirectories) {
  const one = (pattern) => {
    if (/[*?[\]{}]/.test(pattern.replace(/\/\*$/, '')))
      throw new Error(`pnpm-workspace.yaml: "${pattern}" is a glob this guard does not read; teach it, or name the directory`)
    return pattern.endsWith('/*') ? listDirectories(pattern.slice(0, -2)).map((name) => `${pattern.slice(0, -2)}/${name}`) : [pattern]
  }
  const included = patterns.filter((pattern) => !pattern.startsWith('!')).flatMap(one)
  const excluded = new Set(patterns.filter((pattern) => pattern.startsWith('!')).flatMap((pattern) => one(pattern.slice(1))))
  return [...new Set(included)].filter((dir) => !excluded.has(dir)).sort()
}

/** Every workspace package and app: each directory the globs name that holds a package.json, with that manifest. */
function workspacePackages() {
  const workspace = YAML.parse(read(join(repo, 'pnpm-workspace.yaml'))) ?? {}
  const listDirectories = (dir) => {
    try {
      return readdirSync(join(repo, dir), { withFileTypes: true })
        .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules')
        .map((entry) => entry.name)
    } catch {
      return []
    }
  }
  return expandWorkspace((workspace.packages ?? []).map(String), listDirectories)
    .filter((dir) => isFile(join(repo, dir, 'package.json')))
    .map((dir) => {
      const manifest = JSON.parse(read(join(repo, dir, 'package.json')))
      return { dir, name: manifest.name, manifest }
    })
}

/**
 * Every file the checkout holds, by its path from the root: what git tracks
 * or would, ignored files left out -- `dist`, `node_modules`, a run's
 * results -- and a tracked file deleted from the disk too.
 */
function checkoutFiles() {
  const listed = execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], {
    cwd: repo,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  })
  return listed.split('\0').filter((path) => path !== '' && isFile(join(repo, path)))
}

/** Every token of a Markdown document, depth first, in the order a reader meets them: lists, quotes and table cells included. */
function* tokensOf(tokens) {
  for (const token of tokens ?? []) {
    yield token
    yield* tokensOf(token.tokens)
    yield* tokensOf(token.items)
    if (token.type === 'table') {
      for (const cell of token.header) yield* tokensOf(cell.tokens)
      for (const row of token.rows) for (const cell of row) yield* tokensOf(cell.tokens)
    }
  }
}

/** The text of every code span among `tokens`, in order. */
const spansIn = (tokens) => [...tokensOf(tokens)].filter((token) => token.type === 'codespan').map((token) => token.text)

/**
 * Every address the document gives GitHub to follow -- a link, an image, a
 * reference definition -- and every piece of raw HTML that names one, which
 * is reported rather than read. A code block or a code span holds none.
 */
function addressesIn(markdown) {
  const links = []
  const html = []
  for (const token of tokensOf(lexer(markdown))) {
    if (token.type === 'link' || token.type === 'image' || token.type === 'def') links.push(token.href)
    else if (token.type === 'html' && HTML_ADDRESS.test(token.raw)) html.push(token.raw.trim())
  }
  return { links, html }
}

/**
 * What is wrong with each relative address in `markdown`, the text of the
 * file at `from`, each said once: one that reaches no file -- a directory
 * included, whose page is whatever GitHub lists there -- one written from
 * the root, which GitHub and a checkout read differently, a fragment that
 * names no heading of the Markdown file it points into, and a link written
 * as HTML. Returns the problems and every file the links reached.
 *
 * Pure over `files`, which answers whether a path is a file and what a
 * Markdown file holds, so the tests can hand it a tree that is not this one.
 */
function linkProblems(from, markdown, files) {
  const { links, html } = addressesIn(markdown)
  const problems = html.map((raw) => `${fromRepo(from)}: a link written as HTML, which this guard does not follow: ${raw}`)
  const reached = []
  for (const href of links) {
    if (EXTERNAL.test(href)) continue
    const say = (why) => problems.push(`${fromRepo(from)}: ${href} ${why}`)
    if (href.startsWith('/')) {
      say('starts at the root, which GitHub reads from the repository and a checkout from the disk')
      continue
    }
    const at = href.indexOf('#')
    const path = at === -1 ? href : href.slice(0, at)
    const fragment = at === -1 ? '' : href.slice(at + 1)
    let target
    try {
      target = path === '' ? from : resolve(dirname(from), decodeURIComponent(path))
    } catch {
      say('is not a path a browser can decode')
      continue
    }
    if (!files.isFile(target)) {
      say(`reaches no file (${fromRepo(target)})`)
      continue
    }
    reached.push(target)
    if (fragment === '' || !target.endsWith('.md')) continue
    if (!headingAnchors(files.text(target)).has(decodeURIComponent(fragment))) say(`names no heading of ${fromRepo(target)}`)
  }
  return { problems, reached }
}

/** `text` as a regular expression, each `*` any characters but `/`, and `**` any directories. */
function globSource(text) {
  const segments = text.replace(/\/$/, '').split('/')
  return segments
    .map((segment, index) => {
      if (segment === '**') return index === segments.length - 1 ? '(?:[^/]+/)*[^/]+' : '(?:[^/]+/)*'
      const source = segment
        .split('*')
        .map((part) => part.replaceAll(/[.+?^${}()|[\]\\]/g, '\\$&'))
        .join('[^/]*')
      return index === segments.length - 1 ? source : `${source}/`
    })
    .join('')
}

/**
 * What is wrong with each path `markdown`, the text of the file at `from`,
 * writes as code: one that names nothing in `files`, the checkout's paths
 * from its root. A path that starts at `./` or `../` is read from the
 * document's directory, and must not leave the checkout; any other names
 * whatever ends in it, whole segments, so `glyphs.test.ts` and
 * `report-render-pdf/src/glyphs.test.ts` both find the renderer's test. A
 * path ending in `/` is a directory, and a directory is any path that
 * continues past it. Returns the problems and every path it read.
 */
function pathProblems(from, markdown, files) {
  const at = fromRepo(from)
  const paths = [...new Set(spansIn(lexer(markdown)))].filter(isPath)
  const problems = []
  for (const text of paths) {
    const directory = text.endsWith('/')
    let whole = text
    if (text.startsWith('./') || text.startsWith('../')) {
      whole = posix.normalize(posix.join(posix.dirname(at), text))
      if (whole.startsWith('../')) {
        problems.push(`${at}: \`${text}\` reaches outside the checkout`)
        continue
      }
    }
    const anchored = whole === text ? '(?:^|/)' : '^'
    const pattern = new RegExp(`${anchored}${globSource(whole)}${directory ? '/' : '(?:/|$)'}`)
    if (!files.some((file) => pattern.test(file))) problems.push(`${at}: \`${text}\` names no file or directory the checkout holds`)
  }
  return { problems, paths }
}

/** What a workspace package's row must name in each column of dependencies: its manifest's, devDependencies left out. */
function expectedRow({ manifest }, names) {
  const installed = [...Object.keys(manifest.dependencies ?? {}), ...Object.keys(manifest.optionalDependencies ?? {})]
  const peers = Object.keys(manifest.peerDependencies ?? {})
  return {
    here: [...installed, ...peers].filter((name) => names.has(name)).map((name) => name.replace(/^@[^/]+\//, '')),
    elsewhere: installed.filter((name) => !names.has(name)),
    peers: peers.filter((name) => !names.has(name)),
  }
}

/**
 * What is wrong with the building blocks' table in `markdown` against
 * `packages`, the workspace's: the one table with COLUMNS' headers, each
 * row naming one workspace package as code in its package's cell, every
 * package one row, and each column of dependencies naming, as code, what
 * the manifest declares and nothing else -- a sibling by its name without
 * its scope, as the table writes `report-core`. Pure, so the tests hand it
 * tables and packages this repository does not have.
 */
function buildingBlockProblems(markdown, packages) {
  const tables = [...tokensOf(lexer(markdown))].filter((token) => token.type === 'table')
  const located = tables
    .map((table) => ({
      table,
      column: Object.fromEntries(Object.entries(COLUMNS).map(([key, header]) => [key, table.header.findIndex((cell) => cell.text.trim() === header)])),
    }))
    .filter(({ column }) => Object.values(column).every((index) => index !== -1))
  if (located.length !== 1) return [`${String(located.length)} tables have the columns ${Object.values(COLUMNS).join(', ')}; the building blocks are one`]
  const [{ table, column }] = located
  const names = new Set(packages.map(({ name }) => name))
  const problems = []
  const rows = new Map()
  for (const row of table.rows) {
    const named = spansIn(row[column.package].tokens).filter((text) => names.has(text))
    if (named.length !== 1) {
      problems.push(`a row names ${String(named.length)} workspace packages as code where it names its package: ${row[column.package].text}`)
      continue
    }
    if (rows.has(named[0])) problems.push(`${named[0]} has more than one row`)
    rows.set(named[0], row)
  }
  for (const entry of packages) {
    const row = rows.get(entry.name)
    if (row === undefined) {
      problems.push(`${entry.name} (${entry.dir}) has no row`)
      continue
    }
    const expected = expectedRow(entry, names)
    for (const key of ['here', 'elsewhere', 'peers']) {
      const written = new Set(spansIn(row[column[key]].tokens))
      const missing = expected[key].filter((name) => !written.has(name))
      const extra = [...written].filter((name) => !expected[key].includes(name))
      if (missing.length > 0) problems.push(`${entry.name}'s "${COLUMNS[key]}" does not name ${missing.join(', ')}, which its manifest declares`)
      if (extra.length > 0) problems.push(`${entry.name}'s "${COLUMNS[key]}" names ${extra.join(', ')}, which its manifest does not declare there`)
    }
  }
  return problems
}

/** The sketch of the packages in their layers, drawn by hand, which the README and the building blocks show (0079). */
const SKETCH = join(DOCS, 'images', 'architecture.svg')

/** A workspace member's name as the sketch draws it: without its scope. */
const unscoped = (name) => name.replace(/^@[^/]+\//, '')

/** The custom properties of the room the Studio installs, `@formancy/themes/room.css`, from its `:root`, by name, each value's whitespace collapsed. */
function roomColours() {
  const css = read(createRequire(join(repo, 'apps', 'studio', 'package.json')).resolve('@formancy/themes/room.css')).replaceAll(/\/\*[\s\S]*?\*\//g, '')
  const root = /:root\s*\{([^}]*)\}/.exec(css)?.[1] ?? ''
  return Object.fromEntries([...root.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map(([, name, value]) => [name, value.replaceAll(/\s+/g, ' ').trim()]))
}

/** An element's attributes, by name. */
const attributesOf = (text) => Object.fromEntries([...text.matchAll(/([\w:-]+)="([^"]*)"/g)].map(([, name, value]) => [name, value]))

/** The fills a box's name may be painted in: the room's colours of text, never its ground or its glass. */
const TEXT_FILLS = ['fill-text', 'fill-muted', 'fill-client', 'fill-server']

/** The properties that hide or fade what they touch, which no rule or attribute of the sketch may set. */
const HIDING = ['display', 'visibility', 'opacity', 'fill-opacity', 'stroke-opacity', 'clip-path', 'mask', 'filter']

/** Whether `property` paints: a fill, a stroke, or anything that sets a colour or a background. */
const paints = (property) =>
  ['fill', 'stroke', 'border', 'outline', 'box-shadow', 'text-shadow'].includes(property) || /color$|^background|^border-/.test(property)

/** The numbers of a box's rect, `{ x, y, width, height }`, or undefined where it has none. */
function rectOf(body) {
  const rect = /<rect\b([^>]*)>/.exec(body)
  if (rect === null) return undefined
  const { x = '0', y = '0', width, height } = attributesOf(rect[1])
  return { x: Number(x), y: Number(y), width: Number(width), height: Number(height) }
}

/**
 * What is wrong with the sketch's boxes: a member not drawn as one box,
 * `<g id="…">` named by its name without its scope, or a box or a name that
 * is no member's; a box dashed otherwise than its manifest is private; a
 * name painted in no colour of text; a box moved by a transform or standing
 * outside the viewBox; and a member drawn beside or below a workspace
 * package it depends on.
 */
function boxProblems(svg, packages, viewBox) {
  const problems = []
  const members = new Map(packages.map((entry) => [unscoped(entry.name), entry]))
  const NAME = /<text class="(name\b[^"]*)"[^>]*>([^<]*)<\/text>/g
  const boxes = new Map(
    [...svg.matchAll(/<g id="([^"]+)"([^>]*)>([\s\S]*?)<\/g>/g)].map(([, id, attributes, body]) => [id, { attributes, body, rect: rectOf(body) }]),
  )
  const names = [...svg.matchAll(NAME)].map((match) => match[2])
  for (const [name, entry] of members) {
    const box = boxes.get(name)
    if (names.filter((each) => each === name).length > 1) problems.push(`${name} is drawn more than once`)
    if (box === undefined) {
      problems.push(`${entry.name} (${entry.dir}) has no box in the sketch, <g id="${name}">`)
      continue
    }
    const named = [...box.body.matchAll(NAME)]
    if (named.map((match) => match[2]).join() !== name) problems.push(`the box of ${entry.name} is not named ${name}`)
    if (/class="[^"]*\bprivate\b/.test(box.body) !== (entry.manifest.private === true))
      problems.push(
        `${entry.name} is drawn ${entry.manifest.private === true ? 'solid, as a published package' : 'dashed, as private'}, and its manifest says otherwise`,
      )
    for (const fill of named.flatMap((match) => match[1].split(/\s+/)).filter((each) => each.startsWith('fill-') && !TEXT_FILLS.includes(each)))
      problems.push(`the name of ${entry.name} is painted ${fill}, which is no colour of text: fill-text, fill-muted, fill-client or fill-server`)
    if (/\btransform=/.test(box.attributes + box.body))
      problems.push(`the box of ${entry.name} is moved by a transform, so it is not drawn where its rect says`)
    const { rect } = box
    if (rect === undefined) problems.push(`the box of ${entry.name} has no rect`)
    else if (viewBox !== undefined && !(rect.x >= 0 && rect.y >= 0 && rect.x + rect.width <= viewBox.width && rect.y + rect.height <= viewBox.height))
      problems.push(`the box of ${entry.name} stands outside the viewBox, 0 0 ${String(viewBox.width)} ${String(viewBox.height)}`)
  }
  for (const id of boxes.keys()) if (!members.has(id)) problems.push(`the sketch draws a box ${id}, which is no workspace package or app`)
  for (const name of new Set(names)) if (!members.has(name)) problems.push(`the sketch names ${name}, which is no workspace package or app`)
  for (const [name, entry] of members) {
    const below = boxes.get(name)?.rect
    if (below === undefined) continue
    const { dependencies = {}, peerDependencies = {}, optionalDependencies = {} } = entry.manifest
    for (const dependency of Object.keys({ ...dependencies, ...peerDependencies, ...optionalDependencies })) {
      const drawn = boxes.get(unscoped(dependency))?.rect
      if (members.has(unscoped(dependency)) && drawn !== undefined && drawn.y < below.y + below.height)
        problems.push(`${entry.name} depends on ${dependency}, which the sketch draws beside or above it`)
    }
  }
  return problems
}

/**
 * What is wrong with the sketch's style against `room`: a rule of any
 * selector that paints other than as `.fill-<name>` or `.stroke-<name>`
 * with the room's `--<name>`; a rule that hides or fades; a dash set by
 * any rule but `.private`; and a `.private` that sets none.
 */
function styleProblems(style, room) {
  const problems = []
  let dashed = false
  for (const [, written, body] of style.replaceAll(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^}]*)\}/g)) {
    const rule = written.replaceAll(/\s+/g, ' ').trim()
    for (const [, property, declared] of body.matchAll(/([\w-]+)\s*:\s*([^;]+)/g)) {
      const value = declared.replaceAll(/\s+/g, ' ').trim()
      if (HIDING.includes(property)) problems.push(`the rule ${rule} sets ${property}, and nothing in the sketch may hide or fade what it draws`)
      else if (property === 'stroke-dasharray') {
        if (rule !== '.private')
          problems.push(`the rule ${rule} sets stroke-dasharray, which .private alone may, so a published box could be drawn as a private one`)
        else dashed = !['none', '0'].includes(value)
      } else if (paints(property) && value !== 'none') {
        const named = /^\.(fill|stroke)-([\w-]+)$/.exec(rule)
        if (named === null || named[1] !== property)
          problems.push(`the rule ${rule} paints ${property} ${value}, where only a .fill-<name> or .stroke-<name> may, with the room's --<name>`)
        else if (room[`--${named[2]}`] === undefined) problems.push(`the rule ${rule} names --${named[2]}, which room.css does not declare`)
        else if (room[`--${named[2]}`] !== value) problems.push(`the rule ${rule} paints ${value}, and room.css's --${named[2]} is ${room[`--${named[2]}`]}`)
      }
    }
  }
  if (!dashed) problems.push("the sketch's .private sets no stroke-dasharray, so a private box is drawn as a published one")
  return problems
}

/**
 * What is wrong with `svg`, the sketch, against `packages`, the workspace's
 * members as `workspacePackages` reads them, and `room`, the room's custom
 * properties as `roomColours` reads them: its boxes (`boxProblems`); its
 * style (`styleProblems`); a colour, a dash or anything hiding set outside
 * the style, in an attribute or an inline style; an element that draws by
 * reference or not at all, `<defs>`, `<symbol>` or `<use>`; and a ground
 * not its own -- the first shape after the style a rect of `.fill-ground`
 * covering the viewBox -- so that the sketch reads the same on a light page
 * and a dark one.
 */
function sketchProblems(svg, packages, room) {
  const box = /viewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(svg)
  const viewBox = box === null ? undefined : { width: Number(box[1]), height: Number(box[2]) }
  const problems = boxProblems(svg, packages, viewBox)
  const style = /<style>([\s\S]*?)<\/style>/.exec(svg)?.[1]
  if (style === undefined) return [...problems, 'the sketch has no <style>, so no colour of it is named']
  problems.push(...styleProblems(style, room))
  const outside = svg.replace(/<style>[\s\S]*?<\/style>/, '')
  const stray = [
    ...outside.matchAll(/#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(|\b(?:fill|stroke|stop-color|color)="(?!none")|\bstyle="/gi),
  ]
  if (stray.length > 0) problems.push(`the sketch paints outside its style's named colours: ${[...new Set(stray.map((match) => match[0]))].join(', ')}`)
  const hidden = [...outside.matchAll(new RegExp(`\\b(?:stroke-dasharray|${HIDING.join('|')})=(?=")`, 'g'))]
  if (hidden.length > 0) problems.push(`the sketch dashes or hides outside its style: ${[...new Set(hidden.map((match) => match[0]))].join(', ')}`)
  for (const element of ['defs', 'symbol'])
    if (new RegExp(`<${element}\\b`).test(outside)) problems.push(`the sketch holds <${element}>, which draws nothing until something uses it`)
  if (/<use\b/.test(outside)) problems.push('the sketch holds <use>, which draws another element where its rect does not say')

  const first = /<(rect|path|circle|ellipse|line|polyline|polygon|text|g|use|image)\b([^>]*)>/.exec(svg.slice(svg.indexOf('</style>')))
  const ground = first === null ? {} : attributesOf(first[2])
  const covers =
    viewBox !== undefined &&
    first?.[1] === 'rect' &&
    (ground.class ?? '').split(' ').includes('fill-ground') &&
    Number(ground.x ?? 0) === 0 &&
    Number(ground.y ?? 0) === 0 &&
    Number(ground.width) === viewBox.width &&
    Number(ground.height) === viewBox.height
  if (!covers)
    problems.push(
      'the sketch does not open with its own ground, a rect of .fill-ground covering its viewBox, so its words would stand on the colour of whatever page shows it',
    )
  return problems
}

/** Where `markdown` shows a picture: every image's address, wherever it stands. */
const picturesIn = (markdown) => [...tokensOf(lexer(markdown))].filter((token) => token.type === 'image').map((token) => token.href)

/** The checkout, as `linkProblems` reads it. */
const disk = { isFile, text: read }

/** The entry and every section that exists, each as its path and its text. */
const documents = () => [ENTRY, ...SECTIONS.map((name) => join(ARCHITECTURE, name))].filter(isFile).map((file) => ({ file, text: read(file) }))

describe('the reading underneath the guard', () => {
  // A link in a table cell, a list or a quote is a link GitHub follows; a
  // walk that read only paragraphs would pass every table here unread, and
  // this documentation is mostly tables. Code is not a link, and HTML is
  // not read at all, so it is reported.
  test('finds every address GitHub follows, wherever it stands, and no address in code', () => {
    const markdown = [
      '# T [h](heading.md)',
      '',
      '| a | b |',
      '|---|---|',
      '| [cell](cell.md#x) | `[no](code.md)` |',
      '',
      '- [item](item.md)',
      '  > [quote](quote.md)',
      '',
      '![picture](picture.png)',
      '',
      '[ref]: definition.md',
      '',
      '```md',
      '[block](block.md)',
      '```',
      '',
      '<a href="html.md">html</a>',
    ].join('\n')
    const { links, html } = addressesIn(markdown)
    expect(links.sort()).toEqual(['cell.md#x', 'definition.md', 'heading.md', 'item.md', 'picture.png', 'quote.md'])
    expect(html).toHaveLength(1)
  })

  // The guard's verdicts, on a tree it is handed: what a directory, a root
  // path, a missing file and a missing heading each look like, and that a
  // good link and an address elsewhere pass.
  test('refuses a link to nothing, to a directory, from the root, or to a heading that is not there', () => {
    const from = join(repo, 'docs', 'architecture', 'x.md')
    const tree = new Map([[join(repo, 'docs', 'decisions', '0001-a.md'), '# 0001 — A\n\n## Context\n']])
    const files = { isFile: (path) => tree.has(path), text: (path) => tree.get(path) }
    const markdown = [
      '[ok](../decisions/0001-a.md#context)',
      '[web](https://example.com/x)',
      '[dir](../decisions/)',
      '[root](/docs/decisions/0001-a.md)',
      '[gone](../decisions/0002-b.md)',
      '[heading](../decisions/0001-a.md#consequences)',
    ].join('\n\n')
    const { problems, reached } = linkProblems(from, markdown, files)
    expect(reached.map(fromRepo)).toEqual(['docs/decisions/0001-a.md', 'docs/decisions/0001-a.md'])
    expect(problems).toHaveLength(4)
    expect(problems[0]).toMatch(/\.\.\/decisions\/ reaches no file/)
    expect(problems[1]).toMatch(/starts at the root/)
    expect(problems[2]).toMatch(/0002-b\.md reaches no file/)
    expect(problems[3]).toMatch(/#consequences names no heading/)
  })

  // A span read as a path that is none -- a command, a specifier, a
  // version, a CSS variable -- would fail the documents for a word; a path
  // not read as one would pass renamed.
  test('reads as a path what names one, and nothing else', () => {
    const paths = [
      'report-render-pdf/src/glyphs.test.ts',
      'glyphs.test.ts',
      'scripts/',
      '.github/workflows/gates.yml',
      '../getting-started.md',
      'scripts/**/*.test.mjs',
      'validate-*.ts',
      'apps/studio',
      'codecov.yml',
      'report-builder.css',
    ]
    const others = [
      '@formancy/themes/workbench.css',
      '@formancy/*',
      'pnpm test:repo',
      '/report/',
      '.mjs',
      '--wb-*',
      'v*',
      'group.<id>',
      '3 / 2',
      'SEE LICENSE IN LICENSE.md',
      'NOTICE',
      'node:',
      '~6.0.3',
      'scenarios.test',
    ]
    expect(paths.filter((text) => !isPath(text))).toEqual([])
    expect(others.filter(isPath)).toEqual([])
  })

  // The verdicts on a tree it is handed: a file by its whole path or its
  // ending, a directory, a glob, a path from the document; and a renamed
  // file, a directory that holds nothing, a glob that matches nothing, a
  // path out of the checkout and half a file name, each refused.
  test('finds a path anywhere it ends, and refuses one that names nothing', () => {
    const from = join(repo, 'docs', 'architecture', 'x.md')
    const files = [
      'packages/report-render-pdf/src/glyphs.test.ts',
      'packages/report-spec/src/validate-input.ts',
      'scripts/upstream-deps.test.mjs',
      'docs/getting-started.md',
      'apps/studio/src/styles/room.css',
    ]
    const good = [
      '`report-render-pdf/src/glyphs.test.ts`',
      '`glyphs.test.ts`',
      '`styles/room.css`',
      '`apps/studio`',
      '`scripts/`',
      '`validate-*.ts`',
      '`scripts/**/*.test.mjs`',
      '`../getting-started.md`',
    ]
    const bad = ['`report-render-pdf/src/glyphs-gone.test.ts`', '`dist/`', '`check-*.ts`', '`../../../outside.md`', '`lyphs.test.ts`', '`../README.md`']
    expect(pathProblems(from, good.join(' '), files).problems).toEqual([])
    const { problems } = pathProblems(from, bad.join(' '), files)
    expect(problems).toHaveLength(bad.length)
    expect(problems[3]).toMatch(/reaches outside the checkout/)
  })

  // The table's verdicts, on packages it is handed: a package with no row,
  // a row that names no package, and a dependency missing from its column
  // or named in the wrong one would each leave a row that says other than
  // the manifest it describes.
  test('holds each row of the building blocks to its manifest', () => {
    const packages = [
      { dir: 'packages/a', name: '@x/a', manifest: { dependencies: { lib: '1.0.0' } } },
      {
        dir: 'packages/b',
        name: '@x/b',
        manifest: { dependencies: { '@x/a': 'workspace:*', tslib: '^2' }, peerDependencies: { react: '^19' }, devDependencies: { vitest: '^5' } },
      },
    ]
    const table = (rows) => ['| Package | Depends on, here | From elsewhere | Peers | Notes |', '|---|---|---|---|---|', ...rows].join('\n')
    expect(buildingBlockProblems(table(['| `@x/a` | — | `lib` | — | |', '| `packages/b` (`@x/b`) | `a` | `tslib` | `react` | |']), packages)).toEqual([])
    expect(buildingBlockProblems(table(['| `@x/a` | — | `lib` | — | |']), packages)).toEqual(['@x/b (packages/b) has no row'])
    expect(buildingBlockProblems(table(['| `@x/a` | — | `lib` | — | |', '| `@x/b` | `a` | `tslib` | `react` | |', '| the rest | | | | |']), packages)).toEqual([
      'a row names 0 workspace packages as code where it names its package: the rest',
    ])
    expect(buildingBlockProblems(table(['| `@x/a` | — | `lib` | — | |', '| `@x/b` | `a` | `tslib`, `react` | — | |']), packages)).toEqual([
      `@x/b's "From elsewhere" names react, which its manifest does not declare there`,
      `@x/b's "Peers" does not name react, which its manifest declares`,
    ])
    expect(buildingBlockProblems('| Package | Notes |\n|---|---|\n| `@x/a` | |', packages)).toEqual([
      '0 tables have the columns Package, Depends on, here, From elsewhere, Peers; the building blocks are one',
    ])
  })

  // A glob read too narrowly leaves a package out of the building-blocks
  // check without a word, so a shape this does not read throws.
  test('expands the workspace globs pnpm reads, and refuses a shape it does not', () => {
    const listDirectories = (dir) => ({ packages: ['a', 'b'], apps: ['c'] })[dir] ?? []
    expect(expandWorkspace(['packages/*', 'apps/*', '!packages/b', 'tools'], listDirectories)).toEqual(['apps/c', 'packages/a', 'tools'])
    expect(() => expandWorkspace(['packages/**'], listDirectories)).toThrow(/does not read/)
    expect(() => expandWorkspace(['packages/report-*'], listDirectories)).toThrow(/does not read/)
  })

  // A guard on the guard: every rule below is about absence, so a reading
  // that found nothing -- a renamed directory, a lexer that changed shape,
  // a git that listed no file -- would pass them all forever.
  test('is reading the repository at all', () => {
    const names = workspacePackages().map((entry) => entry.name)
    expect(names).toContain('@formancy/report-spec')
    expect(names).toContain('@formancy/report-studio')
    expect(readdirSync(DECISIONS).filter((name) => RECORD.test(name))).toContain('0001-a-paid-module-in-its-own-repository.md')
    expect(documents().flatMap(({ file, text }) => linkProblems(file, text, disk).reached).length).toBeGreaterThan(SECTIONS.length)
    const files = checkoutFiles()
    expect(files).toContain('docs/architecture/05-building-blocks.md')
    expect(documents().flatMap(({ file, text }) => pathProblems(file, text, files).paths).length).toBeGreaterThan(SECTIONS.length)
  })
})

describe('the reading of the sketch', () => {
  const member = (name, { isPrivate = false, dependencies = {} } = {}) => ({
    dir: `packages/${name}`,
    name: `@formancy/${name}`,
    manifest: { name: `@formancy/${name}`, private: isPrivate, dependencies },
  })
  const room = { '--ground': '#080a12', '--client': '#8b7bff', '--muted': '#95a0b4', '--text': '#eef1f8' }
  const box = (name, { isPrivate = false, x = 10, y = 10, width = 80, height = 20, fill = 'fill-client', attributes = '' } = {}) =>
    `<g id="${name}"${attributes}><rect class="fill-muted" x="${String(x)}" y="${String(y)}" width="${String(width)}" height="${String(height)}"/><path class="pen stroke-client${isPrivate ? ' private' : ''}" d="M0 0"/><text class="name ${fill}" x="1" y="1">${name}</text></g>`
  const STYLE =
    '/* .fill-old { fill: red } */ .fill-ground { fill: #080a12; } .fill-muted { fill: #95a0b4; } .fill-text { fill: #eef1f8; } .stroke-client { stroke: #8b7bff; } .fill-client { fill: #8b7bff; } .pen { fill: none; } .private { stroke-dasharray: 7 5; }'
  const spec = (options = {}) => box('report-spec', { y: 150, ...options })
  const corpus = (options = {}) => box('report-corpus', { isPrivate: true, ...options })
  const sketch = ({
    ground = '<rect class="fill-ground" x="0" y="0" width="400" height="200" rx="18"/>',
    style = STYLE,
    more = '',
    boxes = [spec(), corpus()],
  } = {}) => ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 200">', `<style>${style}${more}</style>`, ground, ...boxes, '</svg>'].join('\n')
  const members = [
    member('report-spec'),
    member('report-corpus', { isPrivate: true, dependencies: { '@formancy/report-spec': 'workspace:*', vitest: '5.0.4' } }),
  ]

  // A guard on the guard: a sketch drawn to every rule passes, comments in
  // its style, a pen that paints no fill and a rounded ground among it.
  test('passes a sketch drawn to the rules', () => {
    expect(sketchProblems(sketch(), members, room)).toEqual([])
  })

  // A package added to the workspace and not drawn, one drawn twice, and a
  // box left for one renamed away: the sketch would show a repository that
  // is not this one, and the README would carry it.
  test('refuses a member not drawn, drawn twice, or a box that is no member', () => {
    expect(sketchProblems(sketch(), [...members, member('report-new')], room)).toEqual([
      '@formancy/report-new (packages/report-new) has no box in the sketch, <g id="report-new">',
    ])
    expect(sketchProblems(sketch({ boxes: [spec(), spec(), corpus()] }), members, room)).toEqual(['report-spec is drawn more than once'])
    expect(sketchProblems(sketch({ boxes: [spec(), corpus(), box('report-old', { y: 60 })] }), members, room)).toEqual([
      'the sketch draws a box report-old, which is no workspace package or app',
      'the sketch names report-old, which is no workspace package or app',
    ])
  })

  // The legend says a dashed box is private: a package made private, or
  // published, with its box left as it was, would say the other; and a
  // .private that dashes nothing, or a dash set by any other rule, draws
  // the two alike.
  test('refuses a box drawn otherwise than its manifest says it is published, and a dash .private alone does not set', () => {
    expect(sketchProblems(sketch({ boxes: [spec({ isPrivate: true }), corpus({ isPrivate: false })] }), members, room)).toEqual([
      '@formancy/report-spec is drawn dashed, as private, and its manifest says otherwise',
      '@formancy/report-corpus is drawn solid, as a published package, and its manifest says otherwise',
    ])
    const undashed = "the sketch's .private sets no stroke-dasharray, so a private box is drawn as a published one"
    expect(sketchProblems(sketch({ style: STYLE.replace('.private { stroke-dasharray: 7 5; }', '.private {}') }), members, room)).toEqual([undashed])
    expect(sketchProblems(sketch({ style: STYLE.replace('.private { stroke-dasharray: 7 5; }', '') }), members, room)).toEqual([undashed])
    expect(sketchProblems(sketch({ more: ' .pen { stroke-dasharray: 3 3; }' }), members, room)).toEqual([
      'the rule .pen sets stroke-dasharray, which .private alone may, so a published box could be drawn as a private one',
    ])
    expect(sketchProblems(sketch({ boxes: [spec(), corpus(), '<path stroke-dasharray="3 3" d="M0 0"/>'] }), members, room)).toEqual([
      'the sketch dashes or hides outside its style: stroke-dasharray=',
    ])
  })

  // A colour of the room's moved upstream, a colour of the sketch's own,
  // a rule that paints by an element's name or a box's id, and a colour
  // painted outside the style: the sketch would leave the room the Studio
  // and the pages wear (0034), and nothing else would see it.
  test("refuses a colour that is not the room's of its name, whatever paints it", () => {
    expect(sketchProblems(sketch(), members, { ...room, '--client': '#7a6aff' })).toEqual([
      "the rule .stroke-client paints #8b7bff, and room.css's --client is #7a6aff",
      "the rule .fill-client paints #8b7bff, and room.css's --client is #7a6aff",
    ])
    expect(sketchProblems(sketch({ more: ' .title { fill: #ffffff; } .fill-brand { fill: #ff0000; }' }), members, room)).toEqual([
      "the rule .title paints fill #ffffff, where only a .fill-<name> or .stroke-<name> may, with the room's --<name>",
      'the rule .fill-brand names --brand, which room.css does not declare',
    ])
    expect(sketchProblems(sketch({ more: ' text { fill:#ff0000 } #report-spec rect { fill:#ff0000 }' }), members, room)).toEqual([
      "the rule text paints fill #ff0000, where only a .fill-<name> or .stroke-<name> may, with the room's --<name>",
      "the rule #report-spec rect paints fill #ff0000, where only a .fill-<name> or .stroke-<name> may, with the room's --<name>",
    ])
    expect(sketchProblems(sketch({ boxes: [spec(), corpus(), '<path fill="#123456" d="M0 0"/>', '<text style="fill: red">x</text>'] }), members, room)).toEqual(
      ['the sketch paints outside its style\'s named colours: fill=", #123456, style="'],
    )
  })

  // A box no reader sees is a package the sketch leaves out while naming
  // it: one held in <defs> or a symbol and never drawn, moved by a
  // transform or off the canvas, hidden or faded, or named in the colour of
  // the ground.
  test('refuses a box a reader cannot see', () => {
    expect(sketchProblems(sketch({ boxes: [spec(), `<defs>${corpus()}</defs>`] }), members, room)).toEqual([
      'the sketch holds <defs>, which draws nothing until something uses it',
    ])
    expect(sketchProblems(sketch({ boxes: [spec(), `<symbol id="s">${corpus()}</symbol>`, '<use href="#s"/>'] }), members, room)).toEqual([
      'the sketch holds <symbol>, which draws nothing until something uses it',
      'the sketch holds <use>, which draws another element where its rect does not say',
    ])
    expect(sketchProblems(sketch({ boxes: [spec(), corpus({ attributes: ' transform="translate(900 0)"' })] }), members, room)).toEqual([
      'the box of @formancy/report-corpus is moved by a transform, so it is not drawn where its rect says',
    ])
    expect(sketchProblems(sketch({ boxes: [spec(), corpus({ x: 380 })] }), members, room)).toEqual([
      'the box of @formancy/report-corpus stands outside the viewBox, 0 0 400 200',
    ])
    expect(sketchProblems(sketch({ more: ' .pen { opacity: 0; }', boxes: [spec(), corpus({ attributes: ' visibility="hidden"' })] }), members, room)).toEqual([
      'the rule .pen sets opacity, and nothing in the sketch may hide or fade what it draws',
      'the sketch dashes or hides outside its style: visibility=',
    ])
    expect(sketchProblems(sketch({ more: ' .gone { display: none; }' }), members, room)).toEqual([
      'the rule .gone sets display, and nothing in the sketch may hide or fade what it draws',
    ])
    expect(sketchProblems(sketch({ boxes: [spec(), corpus({ fill: 'fill-ground' })] }), members, room)).toEqual([
      'the name of @formancy/report-corpus is painted fill-ground, which is no colour of text: fill-text, fill-muted, fill-client or fill-server',
    ])
  })

  // The sketch says each package depends only on what is drawn below it: a
  // dependency drawn beside or above would say that a package reaches up a
  // layer, which the layers forbid.
  test('refuses a package drawn beside or below one it depends on', () => {
    const above = ['@formancy/report-corpus depends on @formancy/report-spec, which the sketch draws beside or above it']
    expect(sketchProblems(sketch({ boxes: [spec({ y: 10 }), corpus({ y: 150 })] }), members, room)).toEqual(above)
    expect(sketchProblems(sketch({ boxes: [spec({ y: 20 }), corpus({ y: 10 })] }), members, room)).toEqual(above)
  })

  // Without a ground of its own the sketch's light words would stand on
  // GitHub's white page, and its dark ones on the dark page.
  test('refuses a sketch that does not open on its own ground', () => {
    const refused = [
      'the sketch does not open with its own ground, a rect of .fill-ground covering its viewBox, so its words would stand on the colour of whatever page shows it',
    ]
    expect(sketchProblems(sketch({ ground: '' }), members, room)).toEqual(refused)
    expect(sketchProblems(sketch({ ground: '<rect class="fill-ground" x="0" y="0" width="300" height="200"/>' }), members, room)).toEqual(refused)
    expect(sketchProblems(sketch({ ground: '<rect class="fill-muted" x="0" y="0" width="400" height="200"/>' }), members, room)).toEqual(refused)
  })
})

describe('the sketch', () => {
  // Read from the workspace and from the room the Studio installs, never
  // from a list here: a package added, renamed, published or made private,
  // and a colour moved in a release of the room, each fail until the
  // sketch is drawn again.
  test("draws every workspace package and app, each as its manifest publishes it, in the room's colours, on its own ground", () => {
    const members = workspacePackages()
    expect(members.length).toBeGreaterThan(10)
    expect(sketchProblems(read(SKETCH), members, roomColours())).toEqual([])
  })

  // A sketch nobody is shown is a drawing nobody keeps true by looking: the
  // README opens its architecture with it, and the building blocks with it.
  test('is shown by the README and by the building blocks', () => {
    expect(picturesIn(read(join(repo, 'README.md')))).toContain('docs/images/architecture.svg')
    expect(picturesIn(read(BUILDING_BLOCKS))).toContain('../images/architecture.svg')
  })
})

describe('docs/architecture', () => {
  // A section that is not there is a question a reader of arc42 knows to
  // ask and finds no answer to; an entry that is not there leaves the
  // sections without a door.
  test('has the entry, docs/README.md, and every arc42 section', () => {
    expect(isFile(ENTRY), 'docs/README.md').toBe(true)
    expect(SECTIONS.filter((name) => !isFile(join(ARCHITECTURE, name)))).toEqual([])
  })

  // A thirteenth file is one nobody is sent to, and a section the entry
  // stopped listing is one a reader starting there never reaches.
  test('holds only the sections, and the entry links every one', () => {
    expect(readdirSync(ARCHITECTURE).filter((name) => !SECTIONS.includes(name))).toEqual([])
    const linked = new Set(linkProblems(ENTRY, read(ENTRY), disk).reached)
    expect(SECTIONS.filter((name) => !linked.has(join(ARCHITECTURE, name)))).toEqual([])
  })

  // A package added without its row is a package whose dependencies
  // nobody wrote down, and a row whose dependencies are not its manifest's
  // tells a reader the package may import what it does not, or hides what
  // it does: a sibling added, an upstream package or a peer.
  test('gives every workspace package and app one row of the building blocks, naming what its manifest depends on', () => {
    expect(buildingBlockProblems(read(BUILDING_BLOCKS), workspacePackages())).toEqual([])
  })

  // A record nothing in the architecture cites is a decision made beside
  // the design rather than in it: the index lists it, and nothing says
  // where it bears. Cited means linked, to the record's file.
  test('cites every decision record from a section', () => {
    const cited = new Set(
      SECTIONS.map((name) => join(ARCHITECTURE, name))
        .filter(isFile)
        .flatMap((file) => linkProblems(file, read(file), disk).reached),
    )
    const records = readdirSync(DECISIONS).filter((name) => RECORD.test(name))
    expect(records.filter((name) => !cited.has(join(DECISIONS, name)))).toEqual([])
  })

  // A link that lands nowhere, or at the top of a file whose heading was
  // renamed, is the silent kind of wrong: GitHub renders it either way.
  test('links only to files, and to headings GitHub gives them', () => {
    expect(documents().flatMap(({ file, text }) => linkProblems(file, text, disk).problems)).toEqual([])
  })

  // A test named as what holds a scenario, renamed or deleted, leaves the
  // scenario held by nothing while every other check stays green; so does
  // a module or a script the building blocks name.
  test('names as code only paths the checkout holds', () => {
    const files = checkoutFiles()
    expect(documents().flatMap(({ file, text }) => pathProblems(file, text, files).problems)).toEqual([])
  })
})
