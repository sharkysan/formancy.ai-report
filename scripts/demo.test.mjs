import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, test } from 'vitest'
import { configProblems, demoBase, demoUrl, indexProblems, readDemoConfig, WRANGLER } from './demo.mjs'

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

/** The port the config gives `server` or `preview`, which strictPort keeps from wandering. */
function port(block) {
  const match = new RegExp(`${block}: \\{ port: (\\d+), strictPort: true \\}`).exec(config)
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
    ['a route for the whole site', { ...base, routes: [{ pattern: 'formancy.ai/*', zone_name: 'formancy.ai' }, { pattern: 'formancy.ai', zone_name: 'formancy.ai' }] }, 'path'],
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
    expect(indexProblems('<script type="module" crossorigin src="./assets/index-a.js"></script><link rel="stylesheet" crossorigin href="./assets/index-b.css">')).toEqual([])
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
  test('the browser gate serves the built Studio under the path the demo is served at', () => {
    const gate = readFileSync(join(repo, 'apps', 'studio', 'scripts', 'browser-test.mjs'), 'utf8')
    expect(gate).toMatch(/import \{[^}]*\bdemoBase\b[^}]*\} from '\.\.\/\.\.\/\.\.\/scripts\/demo\.mjs'/)
    expect(gate).toContain('await preview({ root: app, base: demoBase(readDemoConfig())')
  })
})
