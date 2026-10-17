import { execFileSync } from 'node:child_process'
import { readFileSync, readdirSync, statSync } from 'node:fs'
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
    if (/[*?[\]{}]/.test(pattern.replace(/\/\*$/, ''))) throw new Error(`pnpm-workspace.yaml: "${pattern}" is a glob this guard does not read; teach it, or name the directory`)
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
  const listed = execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], { cwd: repo, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
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
    .map((table) => ({ table, column: Object.fromEntries(Object.entries(COLUMNS).map(([key, header]) => [key, table.header.findIndex((cell) => cell.text.trim() === header)])) }))
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
    const paths = ['report-render-pdf/src/glyphs.test.ts', 'glyphs.test.ts', 'scripts/', '.github/workflows/gates.yml', '../getting-started.md', 'scripts/**/*.test.mjs', 'validate-*.ts', 'apps/studio', 'codecov.yml', 'report-builder.css']
    const others = ['@formancy/themes/workbench.css', '@formancy/*', 'pnpm test:repo', '/report/', '.mjs', '--wb-*', 'v*', 'group.<id>', '3 / 2', 'SEE LICENSE IN LICENSE.md', 'NOTICE', 'node:', '~6.0.3', 'scenarios.test']
    expect(paths.filter((text) => !isPath(text))).toEqual([])
    expect(others.filter(isPath)).toEqual([])
  })

  // The verdicts on a tree it is handed: a file by its whole path or its
  // ending, a directory, a glob, a path from the document; and a renamed
  // file, a directory that holds nothing, a glob that matches nothing, a
  // path out of the checkout and half a file name, each refused.
  test('finds a path anywhere it ends, and refuses one that names nothing', () => {
    const from = join(repo, 'docs', 'architecture', 'x.md')
    const files = ['packages/report-render-pdf/src/glyphs.test.ts', 'packages/report-spec/src/validate-input.ts', 'scripts/upstream-deps.test.mjs', 'docs/getting-started.md', 'apps/studio/src/styles/room.css']
    const good = ['`report-render-pdf/src/glyphs.test.ts`', '`glyphs.test.ts`', '`styles/room.css`', '`apps/studio`', '`scripts/`', '`validate-*.ts`', '`scripts/**/*.test.mjs`', '`../getting-started.md`']
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
      { dir: 'packages/b', name: '@x/b', manifest: { dependencies: { '@x/a': 'workspace:*', tslib: '^2' }, peerDependencies: { react: '^19' }, devDependencies: { vitest: '^5' } } },
    ]
    const table = (rows) => ['| Package | Depends on, here | From elsewhere | Peers | Notes |', '|---|---|---|---|---|', ...rows].join('\n')
    expect(buildingBlockProblems(table(['| `@x/a` | — | `lib` | — | |', '| `packages/b` (`@x/b`) | `a` | `tslib` | `react` | |']), packages)).toEqual([])
    expect(buildingBlockProblems(table(['| `@x/a` | — | `lib` | — | |']), packages)).toEqual(['@x/b (packages/b) has no row'])
    expect(buildingBlockProblems(table(['| `@x/a` | — | `lib` | — | |', '| `@x/b` | `a` | `tslib` | `react` | |', '| the rest | | | | |']), packages)).toEqual(['a row names 0 workspace packages as code where it names its package: the rest'])
    expect(buildingBlockProblems(table(['| `@x/a` | — | `lib` | — | |', '| `@x/b` | `a` | `tslib`, `react` | — | |']), packages)).toEqual([
      `@x/b's "From elsewhere" names react, which its manifest does not declare there`,
      `@x/b's "Peers" does not name react, which its manifest declares`,
    ])
    expect(buildingBlockProblems('| Package | Notes |\n|---|---|\n| `@x/a` | |', packages)).toEqual(['0 tables have the columns Package, Depends on, here, From elsewhere, Peers; the building blocks are one'])
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
    const cited = new Set(SECTIONS.map((name) => join(ARCHITECTURE, name)).filter(isFile).flatMap((file) => linkProblems(file, read(file), disk).reached))
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
