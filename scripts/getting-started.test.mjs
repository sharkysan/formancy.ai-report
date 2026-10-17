import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { lexer } from 'marked'
import { describe, expect, test } from 'vitest'
import { fencedBlocks, importedPackages, readGuide } from './getting-started.mjs'
import { headingAnchors } from './heading-anchors.mjs'
import { GUIDE_HOSTS, HOSTS, planProjects } from './install-hosts.mjs'

/**
 * docs/getting-started.md and the install gate, held to each other without
 * running the gate (0015). The gate compiles and runs what the guide hands
 * it; this holds that the guide hands it everything -- no block of code
 * escapes, and every module a host is given is type-checked and run or
 * bundled there -- and that section 1 tells a reader to install what the
 * code imports, and what the gate installs. Each guard was watched failing
 * against the guide with the defect it names put in by hand.
 */

const repo = join(dirname(fileURLToPath(import.meta.url)), '..')
const guide = readFileSync(join(repo, 'docs', 'getting-started.md'), 'utf8')
const fixture = join(repo, 'scripts', 'install-fixture')

/** The published packages' manifests, by name: what the gate plans its projects from. */
function manifests() {
  const root = join(repo, 'packages')
  return new Map(
    readdirSync(root)
      .map((name) => JSON.parse(readFileSync(join(root, name, 'package.json'), 'utf8')))
      .filter((manifest) => manifest.private !== true)
      .map((manifest) => [manifest.name, manifest]),
  )
}

/** The projects the gate plans that build `kind`'s part of the guide. */
const projectsOf = (kind) => planProjects(manifests()).filter((project) => project.guide?.kind === kind)

/** What the guide gives each host, as the gate reads it. */
const read = () => readGuide(guide, GUIDE_HOSTS)

/** Every link a token and its children hold, in order. */
const linksIn = (token) => [...(token.type === 'link' ? [token.href] : []), ...[...(token.items ?? []), ...(token.tokens ?? [])].flatMap((child) => linksIn(child))]

/** The guide's relative links: everything but an address with a scheme. */
const guideLinks = (markdown) => lexer(markdown).flatMap((token) => linksIn(token)).filter((href) => !/^[a-z][a-z0-9+.-]*:/i.test(href))

/** The relative modules a fixture runner imports, statically or with import(), by specifier. */
const runnerImports = (runner) => [...readFileSync(join(fixture, runner), 'utf8').matchAll(/^import\s[^'"]*['"](\.[^'"]+)['"]|\bimport\(\s*['"](\.[^'"]+)['"]\s*\)/gm)].map((match) => match[1] ?? match[2])

describe('docs/getting-started.md', () => {
  // A block of code no host compiles reads as true and drifts from the
  // packages unnoticed, which is the failure the guide's gate exists for.
  test('hands every block of code to a host the install gate builds', () => {
    const code = fencedBlocks(guide).filter((block) => /^(ts|tsx|typescript|mts|cts|js|jsx|javascript|mjs|cjs)$/i.test(block.language))
    expect(code.length).toBeGreaterThan(5)
    expect(code.filter((block) => !block.attributes.has('guide')).map((block) => block.line)).toEqual([])
    expect(() => read()).not.toThrow()
  })

  // A host the guide writes for that no planned project builds would take
  // its blocks to nowhere, and the gate would pass without them.
  test('is built by a project the gate plans, for every host a block names', () => {
    const used = new Set(fencedBlocks(guide).flatMap((block) => block.attributes.get('guide')?.split(',') ?? []))
    expect([...used].sort()).toEqual(GUIDE_HOSTS.map((host) => host.kind).sort())
    for (const kind of used) expect(projectsOf(kind).length, kind).toBeGreaterThan(0)
  })

  // An import of a package section 1 never mentions compiles in the gate --
  // npm put it there as something else's dependency -- and fails for the
  // reader who installed what the guide said.
  test('imports only what section 1 tells a reader to install, beside the framework', () => {
    for (const [kind, given] of read()) {
      const [project] = projectsOf(kind)
      const host = HOSTS[project.host]
      const framework = new Set([...(host.peers ?? []), ...Object.keys(host.follows ?? {})])
      const installed = new Set(given.installs.map((install) => install.name))
      const imported = [...given.files.values()].flatMap((code) => importedPackages(code))
      const missing = imported.filter((name) => !installed.has(name) && !framework.has(name) && !(name === 'node:' && kind === 'node'))
      expect(missing, `${kind} imports what no install line names`).toEqual([])
    }
  })

  // A package the guide installs that the gate does not would be one the
  // gate never ran the guide beside; a version the guide pins that differs
  // from the gate's, a release nobody checked.
  test('tells a reader to install only what the gate installs, at the version it installs', () => {
    for (const [kind, given] of read()) {
      expect(given.installs.length, kind).toBeGreaterThan(0)
      const application = given.installs.filter((install) => !install.dev)
      const tools = given.installs.filter((install) => install.dev)
      for (const project of projectsOf(kind)) {
        const has = new Set([...project.packages, ...Object.keys(project.framework)])
        expect(application.filter((install) => !has.has(install.name)).map((install) => install.name), `${project.name} does not install`).toEqual([])
        const pinned = application.filter((install) => install.version !== null)
        expect(pinned.map((install) => `${install.name}@${install.version}`), project.name).toEqual(pinned.map((install) => `${install.name}@${project.framework[install.name]}`))
        // A tool the guide installs is one the gate builds with, at its range.
        const builds = HOSTS[project.host].tools ?? {}
        expect(tools.map((install) => `${install.name}@${install.version}`), `${project.name} builds with`).toEqual(tools.map((install) => `${install.name}@${builds[install.name]}`))
      }
    }
  })

  // The guide's program runs only in a project set up as the gate's: ES
  // modules (it awaits at its top level), the tools the gate builds it
  // with, and the compiler settings it is checked under. Review followed the
  // guide in a fresh `npm init -y` project, which is CommonJS, and the
  // program did not run until the type was set; a looser tsconfig hid an
  // error the gate's settings would have shown.
  test('sets a reader\'s Node project up as the gate sets up its own', () => {
    const node = read().get('node')
    expect(node.settings).toEqual({ type: 'module' })
    expect(node.installs.filter((install) => install.dev).map((install) => install.name).sort()).toEqual(Object.keys(HOSTS.node.tools).sort())
    const tsconfig = fencedBlocks(guide).filter((block) => block.language === 'json' && block.lead.includes('`tsconfig.json`'))
    expect(tsconfig.map((block) => block.line), 'one tsconfig.json block').toHaveLength(1)
    expect(JSON.parse(tsconfig[0].code).compilerOptions).toEqual(HOSTS.node.tsconfig.content.compilerOptions)
  })

  // The guide leans on sections of the package READMEs -- the renderer's
  // refusals, the stylesheet, the data contract -- and a renamed heading
  // there would break its link silently. Every relative link must reach a
  // file, and every anchor a heading of it, as GitHub slugs headings.
  test('links only to files and headings that exist', () => {
    const broken = guideLinks(guide).flatMap((href) => {
      const [path, anchor] = href.split('#')
      const file = path === '' ? join(repo, 'docs', 'getting-started.md') : join(repo, 'docs', decodeURIComponent(path))
      let target
      try {
        target = readFileSync(file, 'utf8')
      } catch {
        return [`${href}: no such file`]
      }
      if (anchor === undefined || anchor === '' || !file.endsWith('.md')) return []
      return headingAnchors(target).has(anchor) ? [] : [`${href}: no such heading`]
    })
    expect(guideLinks(guide).length).toBeGreaterThan(5)
    expect(broken).toEqual([])
  })

  // A reader of the rendered guide sees no info string: the file a block
  // goes in must be said in the sentence that leads into it, or a page whose
  // main module imports ./report-page.js leaves the reader guessing.
  test('names, in the prose before it, the file every block of code goes in', () => {
    const entries = new Map(GUIDE_HOSTS.map((host) => [host.kind, host.entry]))
    const unnamed = fencedBlocks(guide)
      .filter((block) => ['ts', 'tsx'].includes(block.language) && block.attributes.has('guide'))
      .flatMap((block) => {
        const files = new Set(block.attributes.get('guide').split(',').map((kind) => block.attributes.get('file') ?? entries.get(kind)))
        return [...files].filter((file) => !block.lead.includes(`\`${file}\``)).map((file) => `line ${String(block.line)}: ${file}`)
      })
    expect(unnamed).toEqual([])
  })

  // A module the gate writes and never compiles, runs or bundles is a block
  // that passes whatever it says.
  test('gives every host modules its type-check covers, its runner runs and, for a page, its browser build bundles', () => {
    for (const [kind, host] of Object.entries(HOSTS)) {
      if (host.guide === undefined) continue
      const { entry, runner, bundled } = host.guide
      expect(host.tsconfig.content.include, kind).toContain('guide')
      expect(runnerImports(runner), kind).toContain(`./guide/${entry.replace(/\.tsx?$/, '.js')}`)
      const stem = runner.replace(/\.tsx?$/, '')
      expect(host.steps.some((step) => step.command.some((arg) => arg.split('/').at(-1)?.startsWith(stem))), `${kind} has no step that runs ${runner}`).toBe(true)
      const bundles = host.steps.some((step) => step.command[0] === 'node' && step.command[1] === 'build.mjs' && /(^|\/)guide$/.test(step.command[step.command.indexOf('--modules') + 1] ?? ''))
      expect(bundles, `${kind} bundles the guide's modules`).toBe(bundled)
    }
  })
})

/** Two hosts, one that runs a program and compares its output, and a page. */
const HOSTS_FIXTURE = [
  { kind: 'node', entry: 'guide.ts', prints: true, bundled: false },
  { kind: 'react', entry: 'guide.tsx', prints: false, bundled: true },
]
const guideOf = (...blocks) => blocks.join('\n\n')
const fence = (info, code) => `\`\`\`${info}\n${code}\n\`\`\``

describe("the guide's reading", () => {
  // The gate builds the program in the order a reader types it, so a block
  // that defines what a later one uses must come first in the module.
  test('appends each block to its host and file in order, a block for two hosts to both', () => {
    const read = readGuide(
      guideOf(
        '# A guide',
        fence('sh guide=node,react', 'npm install @formancy/report-runtime @formancy/themes@0.5.0'),
        fence('ts guide=node', 'const a = 1'),
        fence('ts guide=react file=shared.ts', 'export const b = 2'),
        fence('ts guide=node', 'console.log(a)'),
        fence('text guide=node', '1'),
        fence('tsx guide=react', 'export const c = <p />'),
        fence('json', '{}'),
      ),
      HOSTS_FIXTURE,
    )
    expect(read.get('node')).toEqual({
      files: new Map([['guide.ts', 'const a = 1\n\nconsole.log(a)']]),
      output: '1',
      installs: [
        { name: '@formancy/report-runtime', version: null, dev: false },
        { name: '@formancy/themes', version: '0.5.0', dev: false },
      ],
      settings: {},
      blocks: [3, 7, 15, 19],
    })
    expect([...read.get('react').files.keys()]).toEqual(['shared.ts', 'guide.tsx'])
    expect(read.get('react').blocks).toEqual([3, 11, 23])
  })

  // A project set up as the guide tells a reader to: the module type and
  // the tools it builds with, kept apart from what the application imports,
  // so the guard can hold each to what the gate's project is given.
  test('reads the project setting and the tools a reader installs to build with', () => {
    const read = readGuide(
      guideOf(
        fence('sh guide=node', 'npm pkg set type=module\nnpm install --save-dev typescript@~6.0.3 tsx@^4.20.3'),
        fence('ts guide=node', 'const a = 1'),
        fence('tsx guide=react', 'export const y = 0'),
      ),
      HOSTS_FIXTURE,
    )
    expect(read.get('node').settings).toEqual({ type: 'module' })
    expect(read.get('node').installs).toEqual([
      { name: 'typescript', version: '~6.0.3', dev: true },
      { name: 'tsx', version: '^4.20.3', dev: true },
    ])
  })

  // Each of these is a block the gate would write and never run, or not
  // write at all; refused with its line, so the guide is fixed rather than
  // the block skipped.
  test.each([
    ['a TypeScript block with no tag', fence('ts', 'const a = 1'), /line 1: a ts block with no guide= tag/],
    ['a fence with no language', fence('', 'const a = 1'), /line 1: a fence with no language/],
    ['a JavaScript block, which the gate does not compile', fence('js guide=node', 'const a = 1'), /line 1: a js block; the install gate compiles TypeScript/],
    ['a host the gate does not build', fence('ts guide=vue', 'const a = 1'), /guide=vue is no host/],
    ['an attribute the reading does not know', fence('ts guid=node', 'const a = 1'), /guid=node is not something/],
    ['a second module for a host that runs one and bundles none', fence('ts guide=node file=other.ts', 'const a = 1'), /node runs one module, guide.ts/],
    ['TypeScript without JSX in a page whose entry is .tsx', fence('ts guide=react', 'const a = 1'), /a ts block in guide.tsx/],
    ['a path where a file name belongs', fence('ts guide=react file=../escape.ts', 'const a = 1'), /is not a plain .ts or .tsx name/],
    ['two files one import cannot tell apart', guideOf(fence('tsx guide=react', 'export const a = 1'), fence('ts guide=react file=guide.ts', 'const b = 2')), /guide.ts beside guide.tsx/],
    ['output for a host whose run compares none', fence('text guide=react', 'ok'), /react's run compares no output/],
    ['an install block holding something else', fence('sh guide=node', 'npm i left-pad'), /is not an npm install line/],
    ['a tag on a block the gate neither compiles, compares nor installs', fence('json guide=node', '{}'), /guide= on a json block/],
    // What review showed GitHub draws as code and the line reader never
    // read: each is now read, and refused untagged (0015).
    ['an untagged TypeScript block in a list item', '- a step\n\n    ```ts\n    const a = 1\n    ```', /line 3: a ts block with no guide= tag/],
    ['an untagged TypeScript block in a quote', '> ```ts\n> const a = 1\n> ```', /line 1: a ts block with no guide= tag/],
    ['an indented code block, which has no info string to tag', 'Some prose.\n\n    const a = 1', /an indented code block/],
    ['a node fence, which GitHub highlights as code', fence('node', 'const a = 1'), /a node block with no guide= tag/],
    ['an untagged install line', fence('sh', 'npm install @formancy/report-viewer'), /a sh block with no guide= tag; only json/],
    ['an untagged bash block', fence('bash', 'npm install pdfjs-dist'), /a bash block with no guide= tag/],
    ['an untagged output nothing compares', fence('text', 'wrote quotation.pdf'), /a text block with no guide= tag/],
  ])('refuses %s', (_, markdown, message) => {
    expect(() => readGuide(guideOf(markdown, fence('ts guide=node', 'const z = 0'), fence('tsx guide=react', 'export const y = 0')), HOSTS_FIXTURE)).toThrow(message)
  })

  // A host given nothing to run would pass its runner's import only by
  // failing it, far from the guide that lost the block.
  test('refuses a guide that gives a host no module to run', () => {
    expect(() => readGuide(fence('ts guide=node', 'const a = 1'), HOSTS_FIXTURE)).toThrow(/gives react no guide.tsx/)
  })

  // The gate compiles the code a reader sees: a fence in a list item, in a
  // quote, or with a tab before its tag is code on GitHub and is compiled; a
  // fence inside an HTML comment is invisible there, so a declaration hidden
  // in one cannot make the visible code compile.
  test('reads code where GitHub shows it, and nothing it hides', () => {
    const read = readGuide(
      guideOf(
        '- first\n\n    ```ts guide=node\n    const listed = 1\n    ```',
        '> ```ts guide=node\n> const quoted = 2\n> ```',
        '```ts\tguide=node\nconst tabbed = 3\n```',
        '<!--\n```ts guide=node\nconst hidden = 4\n```\n-->',
        fence('tsx guide=react', 'export const y = 0'),
      ),
      HOSTS_FIXTURE,
    )
    expect(read.get('node').files.get('guide.ts')).toBe('const listed = 1\n\nconst quoted = 2\n\nconst tabbed = 3')
    expect(read.get('node').blocks).toEqual([3, 7, 11])
  })

  // CRLF from a Windows checkout, and a tilde fence, are the same guide.
  test('reads fences as CommonMark does, line ends and tildes alike', () => {
    expect(fencedBlocks('text\r\n~~~ts guide=node\r\nconst a = 1\r\n~~~\r\n').map(({ line, language, code }) => ({ line, language, code }))).toEqual([{ line: 2, language: 'ts', code: 'const a = 1' }])
  })
})

describe('the packages a module imports', () => {
  // What section 1 must name: a package once, by its name, whatever subpath
  // or form of import names it.
  test('are named once each, without their subpath, Node built-ins as node:', () => {
    const code = [
      "import { a } from '@formancy/report-render-pdf/browser'",
      "import type { B } from '@formancy/report-runtime'",
      "import '@formancy/themes/workbench.css'",
      "import { createRoot } from 'react-dom/client'",
      "import { writeFile } from 'node:fs/promises'",
      "import { c } from './preview.js'",
      "export { d } from 'react'",
      "const e = await import('@formancy/report-core')",
    ].join('\n')
    expect(importedPackages(code)).toEqual(['@formancy/report-core', '@formancy/report-render-pdf', '@formancy/report-runtime', '@formancy/themes', 'node:', 'react', 'react-dom'])
  })
})
