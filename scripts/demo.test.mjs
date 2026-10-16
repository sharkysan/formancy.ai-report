import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, test } from 'vitest'

/**
 * README.md's "Try it": the commands that run the Studio as a demo, held to
 * the manifests and the Studio's Vite config they depend on. Prose names a
 * script and a port; neither breaks when a manifest or the config moves, so
 * this does.
 */
const repo = join(dirname(fileURLToPath(import.meta.url)), '..')
const readme = readFileSync(join(repo, 'README.md'), 'utf8').replaceAll('\r\n', '\n')
const root = JSON.parse(readFileSync(join(repo, 'package.json'), 'utf8'))
const studio = JSON.parse(readFileSync(join(repo, 'apps', 'studio', 'package.json'), 'utf8'))
const config = readFileSync(join(repo, 'apps', 'studio', 'vite.config.ts'), 'utf8')

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
})
