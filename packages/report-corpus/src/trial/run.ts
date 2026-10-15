import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import os from 'node:os'
import path from 'node:path'
import { performance } from 'node:perf_hooks'
import { fileURLToPath } from 'node:url'
import type { EngineAdapter } from '../document.js'
import { expectation, type Fixture } from '../fixture.js'
import { ALL_FIXTURES } from '../fixtures/all.js'
import { details, documentOf, ledger, totalRow } from '../fixtures/build.js'
import { pagesOfRows } from '../fixtures/geometry.js'
import { groupBoundary } from '../fixtures/group-boundary.js'
import { longTable } from '../fixtures/long-table.js'
import { oversized } from '../fixtures/oversized.js'
import { pdfmakeAdapter } from './pdfmake.js'
import { pdfme } from './pdfme.js'
import { judge, parseArguments, trialReport, type Engine, type EngineTiming, type FixtureResult, type Installed, type Machine, type Outcome, type Timing } from './trial-report.js'

/**
 * The renderer trial, as a command: every corpus fixture rendered by each
 * candidate engine's adapter and judged, three documents and one refusal
 * timed, and `docs/renderer-trial.md` written from what was measured.
 *
 * The composition root. Everything it decides -- how a render is judged,
 * what the document says -- is `trial-report.ts`, tested there; this file
 * reads the machine, the installed versions and the clock, and writes the
 * file.
 *
 * Node cannot run it from source: its imports name the `.js` files the
 * compiler emits, which `--experimental-strip-types` does not map back to
 * `.ts`. tsdown builds it to `dist/trial/run.mjs` (`tsdown.config.ts`):
 *
 *     pnpm --filter @formancy/report-corpus build
 *     node packages/report-corpus/dist/trial/run.mjs --date YYYY-MM-DD
 */

const ADAPTERS: readonly EngineAdapter[] = [pdfmakeAdapter, pdfme]

/** Timed renders per engine and document, after one untimed render that is judged. */
const RUNS = 5

/**
 * Detail rows for about a hundred pages. Both adapters set 48 one-line
 * ledger rows on a corpus page: counted on each one's long-table PDF on
 * 2026-10-14. 4790 rows and the total then take 100 pages; the document
 * reports the pages each PDF has, not this estimate.
 */
const HUNDRED_PAGE_ROWS = 4790

function hundredPages(): Fixture {
  const rows = details(1, HUNDRED_PAGE_ROWS)
  const total = totalRow(rows)
  const document = documentOf('Hundred pages', [ledger('lines', [...rows, total])])
  const pages = pagesOfRows(rows.length + 1)
  return {
    id: 'hundred-pages',
    title: `The long-table fixture at ${HUNDRED_PAGE_ROWS} rows and their total, about a hundred pages`,
    document,
    maxPages: pages.max,
    expect: expectation(document, { minPagesExpected: pages.min, maxPagesExpected: pages.max, exactText: [total.cells[2] ?? ''] }),
  }
}

/** The documents timed: a report of several pages, the group fixture, a hundred pages, and refusing the oversized job. */
const TIMED: readonly Fixture[] = [longTable, groupBoundary, hundredPages(), oversized]

const require = createRequire(import.meta.url)

/** `name` as installed where `from` resolves it: the version in its own `package.json`, found above its entry point. */
function installed(name: string, role: string, from: NodeJS.Require = require): Installed {
  const entry = from.resolve(name)
  for (let directory = path.dirname(entry); ; directory = path.dirname(directory)) {
    const manifest = path.join(directory, 'package.json')
    if (existsSync(manifest)) {
      const json = JSON.parse(readFileSync(manifest, 'utf8')) as { name?: unknown; version?: unknown }
      if (json.name === name && typeof json.version === 'string') return { name, version: json.version, role }
    }
    if (path.dirname(directory) === directory) throw new Error(`no package.json naming ${name} above ${entry}`)
  }
}

function engines(): Engine[] {
  const fromPdfmake = createRequire(require.resolve('pdfmake/package.json'))
  const packages: Readonly<Record<string, readonly Installed[]>> = {
    pdfmake: [installed('pdfmake', 'lays out the document'), installed('pdfkit', "writes the PDF; pdfmake's own dependency", fromPdfmake)],
    pdfme: [
      installed('@pdfme/generator', 'lays out the template and writes the PDF'),
      installed('@pdfme/schemas', 'the text, table, image and line boxes'),
      installed('@pdfme/common', 'the template model and pagination'),
      installed('@pdfme/pdf-lib', 'the PDF writer'),
    ],
  }
  return ADAPTERS.map((adapter) => ({ name: adapter.name, version: adapter.version, packages: packages[adapter.name] ?? [] }))
}

function machine(): Machine {
  const cpus = os.cpus()
  return {
    os: `${os.version()} (${os.type()} ${os.release()}, ${os.arch()})`,
    cpu: cpus[0]?.model.trim() ?? 'not reported',
    logicalCpus: cpus.length,
    memory: `${(os.totalmem() / 2 ** 30).toFixed(1)} GiB`,
    node: process.version,
  }
}

function render(adapter: EngineAdapter, fixture: Fixture): Promise<Uint8Array> {
  return adapter.render(fixture.document, { maxPages: fixture.maxPages })
}

/**
 * One judged render, which also warms the engine, then `RUNS` timed ones.
 * Both adapters write the same bytes for the same document, so the timed
 * renders are the judged one again.
 */
async function timed(adapter: EngineAdapter, fixture: Fixture): Promise<EngineTiming> {
  const outcome = await judge(fixture, render(adapter, fixture))
  const milliseconds: number[] = []
  for (let run = 0; run < RUNS; run++) {
    const start = performance.now()
    await render(adapter, fixture).catch(() => undefined)
    milliseconds.push(performance.now() - start)
  }
  return { outcome, milliseconds }
}

function progress(adapter: EngineAdapter, fixture: Fixture, what: string): void {
  process.stderr.write(`${adapter.name.padEnd(8)} ${fixture.id.padEnd(18)} ${what}\n`)
}

/** The repository's root: the nearest directory above this file with the workspace manifest. */
function repositoryRoot(): string {
  for (let directory = path.dirname(fileURLToPath(import.meta.url)); ; directory = path.dirname(directory)) {
    if (existsSync(path.join(directory, 'pnpm-workspace.yaml'))) return directory
    if (path.dirname(directory) === directory) throw new Error('the trial is not running inside the repository')
  }
}

async function main(): Promise<void> {
  const { date } = parseArguments(process.argv.slice(2))
  const results: FixtureResult[] = []
  for (const fixture of ALL_FIXTURES) {
    const outcomes: Outcome[] = []
    for (const adapter of ADAPTERS) {
      const outcome = await judge(fixture, render(adapter, fixture))
      progress(adapter, fixture, outcome.kind)
      outcomes.push(outcome)
    }
    results.push({ fixture, outcomes })
  }
  const timings: Timing[] = []
  for (const fixture of TIMED) {
    const measured: EngineTiming[] = []
    for (const adapter of ADAPTERS) {
      const timing = await timed(adapter, fixture)
      progress(adapter, fixture, `${timing.outcome.kind}, timed`)
      measured.push(timing)
    }
    timings.push({ fixture, engines: measured })
  }
  const file = path.join(repositoryRoot(), 'docs', 'renderer-trial.md')
  writeFileSync(file, trialReport({ date, machine: machine(), engines: engines(), reader: installed('pdfjs-dist', 'reads every PDF back'), results, timings }))
  process.stderr.write(`wrote ${file}\n`)
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  process.exitCode = 1
})
