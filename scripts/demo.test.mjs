import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, describe, expect, test } from 'vitest'
import { FILES } from '../apps/pages/src/pages.ts'
import { ASSETS, headersFor, SITE } from './demo-headers.mjs'
import { BUILDS, configProblems, demoBase, demoUrl, headersFile, indexProblems, readDemoConfig, stageDemo, WRANGLER } from './demo.mjs'

/**
 * README.md's "Try it": the commands that run the Studio as a demo, held to
 * the manifests and the Studio's Vite config they depend on, and the demo
 * on formancy.ai held to the Worker's config. Prose names a script, a port
 * and an address; none breaks when a manifest or a config moves, so this
 * does.
 */
const repo = join(dirname(fileURLToPath(import.meta.url)), '..')
const readme = readFileSync(join(repo, 'README.md'), 'utf8').replaceAll('\r\n', '\n')
const root = JSON.parse(readFileSync(join(repo, 'package.json'), 'utf8'))
const studio = JSON.parse(readFileSync(join(repo, 'apps', 'studio', 'package.json'), 'utf8'))
const config = readFileSync(join(repo, 'apps', 'studio', 'vite.config.ts'), 'utf8')
const wrangler = readDemoConfig()

/** The text under `## <title>`, up to the next heading of that level. */
function section(title) {
  const start = readme.indexOf(`\n## ${title}\n`)
  if (start === -1) return ''
  const end = readme.indexOf('\n## ', start + 1)
  return readme.slice(start, end === -1 ? undefined : end)
}

/** The port the config gives `server` or `preview`, which strictPort keeps from wandering, whatever else the block holds. */
function port(block) {
  const match = new RegExp(`${block}: \\{ port: (\\d+), strictPort: true[ ,]`).exec(config)
  return match === null ? undefined : Number(match[1])
}

describe("README.md's Try it", () => {
  const tryIt = section('Try it')
  const commands = [...tryIt.matchAll(/```bash\n([\s\S]*?)```/g)].flatMap((match) => match[1].split('\n')).filter((line) => line.trim() !== '')

  // A section renamed or its block reformatted would leave the checks below
  // reading nothing and passing.
  test('is a section with one block of commands, ending in pnpm demo', () => {
    expect(tryIt).not.toBe('')
    expect(commands.at(-1)).toBe('pnpm demo')
  })

  // A root script renamed or dropped would leave the README telling a
  // newcomer to run a command pnpm does not have, the first thing they try.
  test("names only pnpm's own install and the root's scripts", () => {
    for (const line of commands.filter((each) => each.startsWith('pnpm '))) {
      const [, name] = line.split(' ')
      expect(name === 'install' || Object.hasOwn(root.scripts, name), line).toBe(true)
    }
  })

  // The demo is the Studio as the browser gate measures it: built, then
  // served by Vite's preview with the Studio's own config. A demo that ran
  // the dev server, or another build, would show what no gate checked.
  test('runs the build and then the Studio served as the browser gate serves it', () => {
    expect(root.scripts.demo).toBe('pnpm build && pnpm --filter @formancy/report-studio preview')
    expect(studio.name).toBe('@formancy/report-studio')
    expect(studio.scripts.preview).toBe('vite preview')
    const gate = readFileSync(join(repo, 'apps', 'studio', 'scripts', 'browser-test.mjs'), 'utf8')
    expect(gate).toMatch(/import \{[^}]*\bpreview\b[^}]*\} from 'vite'/)
    expect(gate).toContain('await preview({ root: app')
  })

  // A port changed in the config would leave the README sending a reader to
  // an address nothing answers; every port the README names is the Studio's.
  test("names only the Studio's port, for both the demo and the dev server", () => {
    const preview = port('preview')
    expect(preview).toBeDefined()
    expect(port('server')).toBe(preview)
    expect(tryIt).toContain(`http://localhost:${String(preview)}`)
    const named = [...readme.matchAll(/(?:localhost:|\bport )(\d{2,5})\b/g)].map((match) => Number(match[1]))
    expect(named.length).toBeGreaterThan(0)
    for (const each of named) expect(each).toBe(preview)
  })

  // A route moved in the Worker's config would leave the README sending a
  // reader to formancy.ai's 404 while the demo answered somewhere else.
  test("sends a reader to the address the demo's Worker is routed at", () => {
    expect(tryIt).toContain(demoUrl(wrangler))
  })
})

describe('the demo on formancy.ai (0018)', () => {
  const base = { ...wrangler, routes: wrangler.routes.map((route) => ({ ...route })), assets: { ...wrangler.assets } }

  // The Worker as committed: the built Studio at one path of formancy.ai, and
  // at no address beside it.
  test("the Studio's Wrangler config serves the built Studio at /report/ of formancy.ai and nowhere else", () => {
    expect(configProblems(wrangler)).toEqual([])
    expect(demoBase(wrangler)).toBe('/report/')
    expect(demoUrl(wrangler)).toBe('https://formancy.ai/report/')
  })

  // Each would put the demo somewhere the README and the gate do not say, or
  // put more than the built Studio there: a workers.dev address beside the
  // route, a route on another site, code at the edge, a path without its
  // slash answered by formancy.ai's 404, or the staging directory another
  // than the one the deploy fills.
  test.each([
    ['a workers.dev address', { ...base, workers_dev: true }, 'workers_dev'],
    ['a preview address per version', { ...base, preview_urls: true }, 'preview_urls'],
    ['code that runs at the edge', { ...base, main: 'worker.js' }, 'main'],
    ['a route on another zone', { ...base, routes: [{ pattern: 'formancy.ai/report/*', zone_name: 'example.com' }, base.routes[1]] }, 'zone'],
    ['no route for the path without its slash', { ...base, routes: [base.routes[0]] }, 'formancy.ai/report'],
    [
      'a route for the whole site',
      {
        ...base,
        routes: [
          { pattern: 'formancy.ai/*', zone_name: 'formancy.ai' },
          { pattern: 'formancy.ai', zone_name: 'formancy.ai' },
        ],
      },
      'path',
    ],
    ['a custom domain', { ...base, routes: [...base.routes, { pattern: 'report.formancy.ai', custom_domain: true }] }, 'custom_domain'],
    ['assets staged elsewhere', { ...base, assets: { ...base.assets, directory: './dist' } }, '.cloudflare'],
    ['no redirect from /report to /report/', { ...base, assets: { ...base.assets, html_handling: 'none' } }, 'auto-trailing-slash'],
  ])('refuses %s', (_name, config, says) => {
    const problems = configProblems(config)
    expect(problems.length).toBeGreaterThan(0)
    expect(problems.join('\n')).toContain(says)
  })

  // A page built with an absolute base asks formancy.ai for /assets/…, the
  // site's own directory: the demo is a blank page while every log says it
  // deployed (formancy.ai's README, "Build formancy.ai"). The gate would see
  // it; the deploy refuses it before anything is uploaded.
  test('refuses a built page that asks for a file by an absolute path, and only that', () => {
    expect(
      indexProblems('<script type="module" crossorigin src="./assets/index-a.js"></script><link rel="stylesheet" crossorigin href="./assets/index-b.css">'),
    ).toEqual([])
    expect(indexProblems('<link rel="icon" href="data:," /><link href="https://fonts.googleapis.com/css2?family=Archivo" rel="stylesheet" />')).toEqual([])
    expect(indexProblems('<script type="module" crossorigin src="/assets/index-a.js"></script>')).toEqual(['src="/assets/index-a.js"'])
    expect(indexProblems('<link rel="modulepreload" crossorigin href="/report/assets/c.js">')).toEqual(['href="/report/assets/c.js"'])
  })

  // The deploy is the root's script, after the same build `pnpm demo` makes,
  // and with the Wrangler the record names, never whatever npx finds newest.
  test('is deployed by the root script, after the build, with a pinned Wrangler', () => {
    expect(root.scripts['demo:deploy']).toBe('pnpm build && node scripts/demo.mjs')
    expect(WRANGLER).toMatch(/^wrangler@\d+\.\d+\.\d+$/)
  })

  // Cloudflare's Workers Builds runs the commands its dashboard holds, which
  // nothing here can read; REPO-METADATA.md records them. Recorded apart
  // from `pnpm demo:deploy`, the two would drift, and the demo deployed on
  // a push to main would be built or checked otherwise than one deployed by
  // hand.
  test("REPO-METADATA.md's Workers Builds settings are pnpm demo:deploy's halves, for the demo's Worker", () => {
    const metadata = readFileSync(join(repo, '.github', 'REPO-METADATA.md'), 'utf8')
    const setting = (name) => new RegExp(`^\\| ${name} \\| \`([^\`]+)\` \\|`, 'm').exec(metadata)?.[1]
    expect(setting('Worker')).toBe(wrangler.name)
    expect(setting('Root directory')).toBe('/')
    expect(setting('Production branch')).toBe('main')
    expect(`${String(setting('Build command'))} && ${String(setting('Deploy command'))}`).toBe(root.scripts['demo:deploy'])
  })

  // Workers Builds picks Node from .node-version and defaults to another
  // major; without it the demo would be built on a Node no gate builds on.
  test('Cloudflare builds the demo on the Node every gate and the release run on', () => {
    const pinned = readFileSync(join(repo, '.node-version'), 'utf8').trim()
    const workflows = ['gates.yml', 'release.yml'].map((file) => readFileSync(join(repo, '.github', 'workflows', file), 'utf8'))
    const versions = workflows.flatMap((text) => [...text.matchAll(/node-version: (\S+)/g)].map((match) => match[1]))
    expect(versions.length).toBeGreaterThan(0)
    for (const each of versions) expect(each).toBe(pinned)
  })

  // A Wrangler bumped in the script and not in RELEASING.md would have the
  // rightsholder log in with one version and deploy with another.
  test('RELEASING.md names only the Wrangler the deploy runs', () => {
    const releasing = readFileSync(join(repo, 'RELEASING.md'), 'utf8')
    const named = [...releasing.matchAll(/\bwrangler@[\w.-]+/g)].map((match) => match[0])
    expect(named.length).toBeGreaterThan(0)
    for (const each of named) expect(each).toBe(WRANGLER)
  })

  // The gate measuring the Studio at the root of its origin would pass a
  // build that is a blank page under /report/; served under the demo's
  // path, every check of it is a check of the demo as formancy.ai serves it.
  test('the browser gate serves the built Studio under the path the demo is served at, with the headers the deploy writes for it', () => {
    const gate = readFileSync(join(repo, 'apps', 'studio', 'scripts', 'browser-test.mjs'), 'utf8')
    expect(gate).toMatch(/import \{[^}]*\bdemoBase\b[^}]*\} from '\.\.\/\.\.\/\.\.\/scripts\/demo\.mjs'/)
    expect(gate).toMatch(/import \{[^}]*\bheadersFor\b[^}]*\} from '\.\.\/\.\.\/\.\.\/scripts\/demo-headers\.mjs'/)
    expect(gate).toContain('const base = demoBase(readDemoConfig())')
    expect(gate).toContain('await preview({ root: app, base, preview: { headers: headersFor(served) }')
  })

  // `pnpm demo` is the Studio as the gate measures it, its headers too, for
  // the address it is opened at: the preview's own port, at its root.
  test("pnpm demo serves the Studio with the deploy's headers, for the address it is opened at", () => {
    expect(config).toMatch(/import \{ headersFor \} from '\.\.\/\.\.\/scripts\/demo-headers\.mjs'/)
    expect(config).toContain(`headers: headersFor('http://localhost:${String(port('preview'))}/')`)
  })
})

describe("the demo's headers (0051)", () => {
  const page = 'https://formancy.ai/report/'
  /** The policy for `address`, each directive's name to its sources. */
  const policy = (address = page) => {
    const { 'Content-Security-Policy': written } = headersFor(address)
    return new Map(
      written.split('; ').map((directive) => {
        const [name = '', ...sources] = directive.split(' ')
        return [name, sources]
      }),
    )
  }

  // `'self'` admits whatever the origin serves, Cloudflare's /cdn-cgi/
  // scripts among them; the builds' own directories admit their files.
  test("admits scripts, styles, faces and the worker from the builds' own directories alone, never the whole origin", () => {
    const directives = policy()
    expect(directives.get('default-src')).toEqual(["'none'"])
    expect(directives.get('script-src')).toEqual([`${page}assets/`])
    expect(directives.get('worker-src')).toEqual([`${page}assets/`])
    expect(directives.get('style-src')).toEqual([`${page}assets/`, `${page}site/`])
    expect(directives.get('font-src')).toEqual([`${page}assets/`, `${page}site/`])
    expect(directives.get('img-src')).toEqual(['data:', `${page}site/`])
    for (const sources of directives.values()) {
      for (const source of sources) expect(["'self'", "'unsafe-inline'", "'unsafe-eval'", 'blob:', '*', 'https:']).not.toContain(source)
    }
  })

  // What a person writes into the Studio is sent nowhere: no request, no
  // form posted, no page framing it, no base that moves its files.
  test('refuses every connection, form, frame, base, object and manifest', () => {
    const directives = policy()
    for (const name of ['connect-src', 'form-action', 'base-uri', 'frame-ancestors', 'object-src', 'manifest-src'])
      expect(directives.get(name), name).toEqual(["'none'"])
  })

  // A string handed to a sink that parses markup or loads code is refused,
  // and the one policy that may be made is the default one, which lets
  // PDF.js's worker through (apps/studio/src/preview/pdf-document.ts).
  test('requires Trusted Types, and allows the default policy and no other', () => {
    const directives = policy()
    expect(directives.get('require-trusted-types-for')).toEqual(["'script'"])
    expect(directives.get('trusted-types')).toEqual(['default'])
  })

  // The directories the policy names are where the builds write: Vite's
  // default assets directory, which the Studio's config leaves alone, and
  // the pages' own. Renamed in either build and not here, the demo would
  // load with none of that build's styles or scripts.
  test("names the Studio's assets directory and the pages' own, as their builds write them", () => {
    expect(ASSETS).toBe('assets/')
    expect(config).not.toMatch(/assetsDir/)
    expect(SITE).toBe(FILES)
  })

  // The gate's, `pnpm demo`'s and the deploy's policies are one function of
  // the address, and differ in it alone: whatever the gate measures under
  // its address is what formancy.ai serves under its own.
  test('is the same for every address but for the address', () => {
    const local = 'http://localhost:4394/report/'
    const swapped = Object.fromEntries(Object.entries(headersFor(local)).map(([name, value]) => [name, value.replaceAll(local, page)]))
    expect(swapped).toEqual(headersFor(page))
  })

  // An address that is not a directory's, or carries a query, a fragment or
  // a user, would put into the policy a source nobody meant.
  test.each([
    'https://formancy.ai/report',
    'https://formancy.ai/report/index.html',
    'https://formancy.ai/report/?a=1',
    'https://formancy.ai/report/#a',
    'https://someone@formancy.ai/report/',
    'ftp://formancy.ai/report/',
    '/report/',
    'https://FORMANCY.ai/report/',
  ])('refuses %s, which is not the address of a directory as a browser writes it', (address) => {
    expect(() => headersFor(address)).toThrow(/the demo's headers are for the address of the directory/)
  })

  // Cloudflare joins a header two matching rules set into one value, so the
  // file is one rule; a line it cannot read as written is refused.
  test('are written as one rule every file takes, and a header the file cannot carry is refused', () => {
    expect(headersFile({ 'X-A': '1', 'X-B': 'two words' })).toBe('/*\n  X-A: 1\n  X-B: two words\n')
    expect(() => headersFile({ '! X-A': '1' })).toThrow(/not letters, digits and hyphens/)
    expect(() => headersFile({ 'X-A': 'one\ntwo' })).toThrow(/breaks a line/)
    expect(() => headersFile({ 'X-A': 'a'.repeat(2000) })).toThrow(/past the 2000/)
  })
})

describe('what the deploy stages (0018, 0021)', () => {
  const made = []
  afterAll(() => {
    for (const directory of made) rmSync(directory, { recursive: true, force: true })
  })

  /** A directory holding `files`, each path with its text. */
  function tree(files) {
    const directory = mkdtempSync(join(tmpdir(), 'formancy-report-demo-'))
    made.push(directory)
    for (const [path, text] of Object.entries(files)) {
      mkdirSync(dirname(join(directory, path)), { recursive: true })
      writeFileSync(join(directory, path), text)
    }
    return directory
  }

  /** Every file under `directory`, as a path from it with forward slashes. */
  const listed = (directory) =>
    readdirSync(directory, { recursive: true, withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => relative(directory, join(entry.parentPath, entry.name)).replaceAll('\\', '/'))
      .sort()

  const studio = () => tree({ 'index.html': '<script type="module" src="./assets/index-a.js"></script>', 'assets/index-a.js': '' })
  const pages = (extra = {}) =>
    tree({ 'en/index.html': '<link rel="stylesheet" href="../site/pages.css">', 'sitemap.xml': '<urlset/>', 'site/pages.css': '', ...extra })

  // One Worker serves both, from one directory: the Studio's page at the
  // demo's path, where 0018 put it, and the pages beside it under their
  // languages. A deploy that staged the Studio alone would serve every
  // page as formancy.ai's 404.
  const page = 'https://formancy.ai/report/'

  test("puts the Studio's build and the pages' build under the demo's path, the Studio's page at its root", () => {
    const into = tree({})
    stageDemo([studio(), pages()], into, page)
    expect(listed(into)).toEqual([
      '_headers',
      'report/assets/index-a.js',
      'report/en/index.html',
      'report/index.html',
      'report/site/pages.css',
      'report/sitemap.xml',
    ])
  })

  // Cloudflare reads `_headers` at the root of the assets directory, never
  // under the demo's path, and serves it to nobody: the headers the demo's
  // address takes, for every file of both builds (0051).
  test("writes the demo's headers, for its address, at the root Cloudflare reads them from", () => {
    const into = tree({})
    stageDemo([studio(), pages()], into, page)
    expect(readFileSync(join(into, '_headers'), 'utf8')).toBe(headersFile(headersFor(page)))
    expect(readFileSync(join(into, '_headers'), 'utf8')).toContain(`script-src ${page}assets/;`)
  })

  // A build's own `_headers` or `_redirects` would be served at
  // /report/_headers, and read as rules by nobody, or, if a build ever
  // wrote one at the root, beside the deploy's: refused, so the headers
  // are decided in one place.
  test.each(['_headers', '_redirects', 'de/_headers'])('refuses a build holding a %s of its own, and stages nothing', (file) => {
    const into = tree({})
    expect(() => stageDemo([studio(), pages({ [file]: '/*\n  X-A: 1\n' })], into, page)).toThrow(/a file Cloudflare reads as rules/)
    expect(listed(into)).toEqual([])
  })

  // A path both builds write would be served from whichever was copied
  // last: the Studio's page replaced by a page's, or a stylesheet by the
  // other's. Refused before anything is staged, naming the path.
  test('refuses a path both builds hold, naming it, and stages nothing', () => {
    const into = tree({})
    expect(() => stageDemo([studio(), pages({ 'index.html': '<title>a page</title>' })], into, page)).toThrow(/index\.html is in both/)
    expect(listed(into)).toEqual([])
  })

  // Every page of either build, not only the Studio's: under the demo's
  // path, a page that asks for /site/pages.css is answered by formancy.ai's
  // own site, and loads without its stylesheet.
  test('refuses a page of either build that asks for a file by an absolute path', () => {
    const into = tree({})
    expect(() => stageDemo([studio(), pages({ 'de/index.html': '<link rel="stylesheet" href="/site/pages.css">' })], into, page)).toThrow(
      /de\/index\.html asks for a file by an absolute path: href="\/site\/pages\.css"/,
    )
    expect(listed(into)).toEqual([])
  })

  // The deploy stages exactly the two apps' builds, each from where its own
  // build writes it and each known by a file it always writes: a build
  // left out would be missing from the demo, and one staged from a stale
  // directory would serve what no build of this commit made.
  test("stages the Studio's build and the pages' build, each where its app's build writes it", () => {
    expect(BUILDS).toEqual([
      { app: 'apps/studio', writes: 'index.html' },
      { app: 'apps/pages', writes: 'sitemap.xml' },
    ])
    for (const { app } of BUILDS) expect(JSON.parse(readFileSync(join(repo, app, 'package.json'), 'utf8')).scripts.build).toBeDefined()
  })
})
