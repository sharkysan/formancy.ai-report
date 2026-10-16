// `pnpm demo:deploy`: the built Studio, put on formancy.ai at the path the
// Worker's config, apps/studio/wrangler.json, routes to it (0018).
//
//   pnpm demo:deploy                 build, check, deploy with the Cloudflare login Wrangler holds
//   node scripts/demo.mjs --dry-run  check and let Wrangler check what it would upload, after `pnpm build`; uploads nothing
//
// formancy.ai is one static deployment of its own repository: the site at
// `/`, the playground at `/playground/`, served by a Worker named
// formancy-ai. The Studio is not part of it, and is never copied into it:
// that repository is Apache-2.0 and this one is not (0001). It is served by
// a Worker of its own, with static assets and no code, routed at `/report/`
// of the same zone; a route takes precedence over a Worker on the
// hostname's Custom Domain and a more specific route over a less specific
// one, so formancy.ai's Worker never sees a request under `/report/`, and
// this one never sees any other.
//
// The Studio is built with a relative base, so the one build is right at
// the root of `vite preview` and under `/report/`; the browser gate serves
// it under the path read from here, and this refuses a built page that asks
// for a file by an absolute path, which formancy.ai would answer from its
// own site. Static assets are found by the request's whole path, so the
// build is staged under that path in apps/studio/.cloudflare, the directory
// the config names, and the staging is removed afterwards.
//
// Deploying needs a Cloudflare login that can edit Workers on formancy.ai's
// zone, `npx --yes <WRANGLER> login` once, and a clean checkout: the
// deployment's message names the commit it is, and a change not committed
// would be deployed under a commit that does not hold it. Nothing here runs
// in CI, which has no Cloudflare account.

import { spawnSync } from 'node:child_process'
import { cpSync, existsSync, readFileSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const repo = join(dirname(fileURLToPath(import.meta.url)), '..')
const app = join(repo, 'apps', 'studio')
const CONFIG = join(app, 'wrangler.json')

/** The site the demo is a path of: formancy.ai's zone. */
const HOST = 'formancy.ai'

/** The directory the config gives Wrangler, where the build is staged under the demo's path. */
const STAGE = './.cloudflare'

/**
 * Wrangler, at an exact version older than two weeks when it was chosen
 * (4.146.0, published on 2026-10-01): npx with no version takes whatever
 * the registry calls newest on the day someone deploys.
 */
export const WRANGLER = 'wrangler@4.146.0'

/** apps/studio/wrangler.json, as Wrangler reads it. */
export function readDemoConfig() {
  return JSON.parse(readFileSync(CONFIG, 'utf8'))
}

/** The route whose pattern ends in `/*`, which every path under the demo's takes. */
function wildcard(config) {
  return (config.routes ?? []).find((route) => typeof route.pattern === 'string' && route.pattern.endsWith('/*'))
}

/** The path the demo is served under, with both its slashes: `/report/`. */
export function demoBase(config) {
  const route = wildcard(config)
  if (route === undefined || !route.pattern.startsWith(`${HOST}/`)) return undefined
  return route.pattern.slice(HOST.length, -1)
}

/** The address a reader opens: formancy.ai, at the demo's path. */
export function demoUrl(config) {
  const base = demoBase(config)
  return base === undefined ? undefined : `https://${HOST}${base}`
}

/**
 * What would put the demo anywhere but one path of formancy.ai, or put more
 * there than the built Studio: one sentence per problem, none when the
 * config is the demo's.
 */
export function configProblems(config) {
  const problems = []
  if (config.main !== undefined) problems.push(`the config names main, ${String(config.main)}: the demo's Worker serves the built Studio and runs no code`)
  if (config.workers_dev !== false) problems.push('workers_dev is not false: the demo would answer on a workers.dev address beside formancy.ai')
  if (config.preview_urls !== false) problems.push('preview_urls is not false: every version would answer on an address of its own')
  const routes = config.routes ?? []
  for (const route of routes) {
    if (route.custom_domain !== undefined) problems.push(`the route ${String(route.pattern)} sets custom_domain: a Custom Domain takes a whole hostname, and the demo is one path of ${HOST}`)
    else if (route.zone_name !== HOST) problems.push(`the route ${String(route.pattern)} is on the zone ${String(route.zone_name)}, not ${HOST}`)
  }
  const base = demoBase(config)
  if (base === undefined) problems.push(`no route ${HOST}/<path>/*: nothing says which path of ${HOST} the demo is`)
  else if (!/^\/[a-z][a-z0-9-]*\/$/.test(base)) problems.push(`the demo's path is ${base}: it is one path of ${HOST}, never its whole site, which is formancy.ai's own Worker's`)
  else {
    const bare = `${HOST}${base.slice(0, -1)}`
    const expected = [`${HOST}${base}*`, bare]
    if (!routes.some((route) => route.pattern === bare)) problems.push(`no route ${bare}: the path without its slash would be answered by formancy.ai's 404 instead of being sent to ${base}`)
    const others = routes.filter((route) => !expected.includes(route.pattern))
    for (const route of others) problems.push(`the route ${String(route.pattern)} is not the demo's path: it would send the demo more of ${HOST} than ${base}`)
  }
  if (config.assets?.directory !== STAGE) problems.push(`assets.directory is ${String(config.assets?.directory)}, not ${STAGE}: the deploy stages the build there, under the demo's path`)
  if (config.assets?.html_handling !== 'auto-trailing-slash') problems.push(`assets.html_handling is ${String(config.assets?.html_handling)}, not auto-trailing-slash, which sends the path without its slash to the page and its relative files`)
  return problems
}

/**
 * Every `src` or `href` of the built page that names a file by an absolute
 * path. Under the demo's path such a file is formancy.ai's, not the
 * Studio's: the page loads and its script does not.
 */
export function indexProblems(html) {
  return [...html.matchAll(/\b(?:src|href)="\/(?!\/)[^"]*"/g)].map((match) => match[0])
}

/**
 * A command's output, without its last newline; a command that fails stops
 * the deploy. Wrangler is told not to send Cloudflare its usage telemetry.
 */
function run(command, args, options = {}) {
  const settings = { cwd: repo, encoding: 'utf8', env: { ...process.env, WRANGLER_SEND_METRICS: 'false' }, ...options }
  // npx is a .cmd on Windows, which Node starts only through a shell: one
  // command line, as the install gate's, rather than arguments beside
  // `shell`, which Node would concatenate unescaped all the same (DEP0190).
  const result =
    command === 'npx' && process.platform === 'win32'
      ? spawnSync(['npx.cmd', ...args.map((arg) => (/[\s"]/.test(arg) ? `"${arg.replaceAll('"', '\\"')}"` : arg))].join(' '), { ...settings, shell: true })
      : spawnSync(command, args, settings)
  if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} exited ${String(result.status)}`)
  return (result.stdout ?? '').trimEnd()
}

function main(args) {
  const unknown = args.filter((arg) => arg !== '--dry-run')
  if (unknown.length > 0) throw new Error(`unknown argument ${unknown.join(' ')}; usage: node scripts/demo.mjs [--dry-run]`)
  const dryRun = args.includes('--dry-run')
  const config = readDemoConfig()
  const problems = configProblems(config)
  if (problems.length > 0) throw new Error(`apps/studio/wrangler.json is not the demo's:\n  ${problems.join('\n  ')}`)
  const changed = run('git', ['status', '--porcelain'])
  if (changed !== '' && !dryRun) throw new Error(`the checkout has changes, and the deployment would name a commit that does not hold them; commit them first:\n${changed}`)
  const dist = join(app, 'dist')
  if (!existsSync(join(dist, 'index.html'))) throw new Error('apps/studio/dist/index.html is not there: run `pnpm build` first, or `pnpm demo:deploy`, which does')
  const absolute = indexProblems(readFileSync(join(dist, 'index.html'), 'utf8'))
  if (absolute.length > 0) throw new Error(`the built page asks for files by an absolute path, which formancy.ai answers from its own site: ${absolute.join(', ')}`)
  const commit = run('git', ['rev-parse', 'HEAD'])
  const stage = join(app, STAGE)
  const base = demoBase(config)
  rmSync(stage, { recursive: true, force: true })
  try {
    cpSync(dist, join(stage, base), { recursive: true })
    const deploy = ['--yes', WRANGLER, 'deploy', '--config', 'apps/studio/wrangler.json', '--message', `formancy.ai-report@${commit}`, ...(dryRun ? ['--dry-run'] : [])]
    run('npx', deploy, { stdio: 'inherit' })
  } finally {
    rmSync(stage, { recursive: true, force: true })
  }
  console.log(dryRun ? `\nchecked, and nothing uploaded: ${commit}${changed === '' ? '' : ', with uncommitted changes'} would be served at ${demoUrl(config)}` : `\n${commit} is served at ${demoUrl(config)}`)
}

if (process.argv[1]?.endsWith('demo.mjs')) {
  try {
    main(process.argv.slice(2))
  } catch (error) {
    console.error(`\nthe demo was not deployed: ${error instanceof Error ? error.message : String(error)}`)
    process.exitCode = 1
  }
}
