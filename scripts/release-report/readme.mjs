// The README block that says what the repository is tested with (0014;
// formancy.ai-data 0035's readme.mjs): one table in README.md, rendered from
// `testedOn()` -- what the checkout itself says -- in
// scripts/generated-block.mjs's grammar.
//
// `node scripts/release-report/readme.mjs --write` rewrites the block after a
// dependency, a peer or a tool changes; without `--write` it lists the
// documents whose block is stale and exits 1. tested-on.test.mjs fails until
// they match, naming this command. The block holds static facts only: what a
// run ran -- the Node of each job, and the React and Angular each install
// host resolved -- is the release report's, from that run.

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { browserName } from '../browsers.mjs'
import { readBlock, replaceBlock } from '../generated-block.mjs'
import { testedOn } from './tested-on.mjs'

const repo = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

export const GENERATOR = 'scripts/release-report/readme.mjs'

const code = (text) => `\`${text}\``
/** A table cell: a `|` inside one would end it. */
const cell = (text) => String(text).replaceAll('|', '\\|')

/** Versions of a tool, each with where it is loaded when they differ. */
function versions(tool) {
  if (tool.versions.length === 1) return tool.versions[0].version
  return tool.versions.map(({ version, from }) => `${version} (${from.join(', ')})`).join('; ')
}

/** README.md's block: one table, every row derived. */
export function readmeTable(facts) {
  const ci = [...new Set(facts.node.ci.map((entry) => entry.version))]
  const rows = [
    ...facts.upstream.map((entry) => [
      `${code(entry.name)}${entry.direct ? '' : ' (transitive)'}`,
      entry.version,
      entry.declared === null ? '' : code(entry.declared),
    ]),
    ...facts.runtime.map((entry) => [`${code(entry.name)}, by ${code(entry.package)}`, entry.loaded, code(entry.range)]),
    ...facts.peers.map((entry) => [`${code(entry.name)}, a peer of ${code(entry.package)}`, `${entry.loaded}, in its suites`, code(entry.range)]),
    ['Node, the workspace', '', facts.node.engines === null ? 'nothing' : code(facts.node.engines)],
    ['Node, CI', ci.join(', '), ''],
    [facts.packageManager.name, `${facts.packageManager.version}, through corepack`, `${code(facts.packageManager.declared)}, the root's \`packageManager\``],
    ...facts.browser.pins.map((pin) => [
      browserName(pin.browser),
      `${pin.browserVersion}, the ${pin.name} Playwright ${facts.browser.playwright} pins (revision ${pin.revision})`,
      '',
    ]),
    ...facts.tooling.map((tool) => [code(tool.name), versions(tool), tool.declared === null ? '' : code(tool.declared)]),
  ]
  const launched = facts.browser.pins.length === 1 ? browserName(facts.browser.pins[0].browser) : 'each browser'
  return [
    '| | Tested with | Declared as |',
    '| --- | --- | --- |',
    ...rows.map((row) => `| ${row.map(cell).join(' | ')} |`),
    '',
    `What a run actually ran -- the Node of each job, the React and Angular each install host resolved at both ends of the builders’ peer ranges, and the ${launched} the browser gate launched -- is in the release report every CI run produces and every release attaches, signed.`,
  ].join('\n')
}

/** Every document with a block of this generator, and the body it should hold. */
export const documents = (facts) => [{ file: 'README.md', body: readmeTable(facts) }]

/** The documents whose block differs from what `facts` renders: `{ file, current, next }`. */
export function stale(facts, root = repo) {
  return documents(facts).flatMap(({ file, body }) => {
    const current = readFileSync(join(root, file), 'utf8')
    return readBlock(current, GENERATOR) === body ? [] : [{ file, current, next: replaceBlock(current, GENERATOR, body) }]
  })
}

// `node scripts/release-report/readme.mjs [--write]`
if (process.argv[1]?.replaceAll('\\', '/').endsWith('scripts/release-report/readme.mjs')) {
  const differing = stale(testedOn(repo))
  if (process.argv.includes('--write')) {
    for (const { file, next } of differing) writeFileSync(join(repo, file), next, 'utf8')
    console.log(differing.length === 0 ? 'every tested-with block is current' : `rewrote ${differing.map(({ file }) => file).join(', ')}`)
  } else if (differing.length > 0) {
    console.error(`stale: ${differing.map(({ file }) => file).join(', ')}; run node scripts/release-report/readme.mjs --write`)
    process.exitCode = 1
  } else {
    console.log('every tested-with block is current')
  }
}
