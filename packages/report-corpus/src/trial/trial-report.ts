import { verify, verifyRefusal } from '../checks.js'
import { RenderRefusal, type RefusalCode } from '../document.js'
import type { Expectation, Fixture } from '../fixture.js'
import { readPdf } from '../read-pdf.js'

/**
 * The renderer trial's findings, and `docs/renderer-trial.md`, the document
 * that records them. `run.ts` renders and times; this module judges each
 * render with the corpus's own checks and writes down a `Trial`, and nothing
 * else. Every number in the document is a value of the trial it is given, or
 * computed from one -- a count, a median -- so that none is typed here.
 */

/** What one engine made of one document, judged on the PDF it produced (0003). */
export type Outcome =
  | { readonly kind: 'pass'; readonly pages: number }
  | { readonly kind: 'refused'; readonly code: RefusalCode; readonly subject: string | undefined }
  | { readonly kind: 'fail'; readonly problems: readonly string[]; readonly pages: number | undefined }

/**
 * Judges a render as every engine's suite does: the PDF read back with
 * PDF.js and verified against the fixture, or what the render rejected with
 * held to the refusal the fixture allows. A PDF that PDF.js cannot read
 * fails. Problems lose the fixture's id, which the document already shows.
 */
export async function judge(fixture: Fixture, rendering: Promise<Uint8Array>): Promise<Outcome> {
  const own = (problems: readonly string[]): string[] => problems.map((problem) => problem.replace(`${fixture.id}: `, ''))
  const settled = await rendering.then(
    (bytes) => ({ bytes }),
    (error: unknown) => ({ error }),
  )
  if ('error' in settled) {
    const problems = verifyRefusal(fixture, settled.error)
    if (problems.length === 0 && settled.error instanceof RenderRefusal) return { kind: 'refused', code: settled.error.code, subject: settled.error.subject }
    return { kind: 'fail', problems: own(problems), pages: undefined }
  }
  const pdf = await readPdf(settled.bytes).catch((error: unknown) => new Error(String(error)))
  if (pdf instanceof Error) return { kind: 'fail', problems: [`PDF.js cannot read the PDF: ${pdf.message}`], pages: undefined }
  const problems = own(verify(fixture, pdf))
  return problems.length === 0 ? { kind: 'pass', pages: pdf.pages.length } : { kind: 'fail', problems, pages: pdf.pages.length }
}

/** The middle value, or the mean of the two middle ones: one slow run -- a collection, another process -- does not move it. */
export function median(values: readonly number[]): number {
  if (values.length === 0) throw new RangeError('there is no median of no values')
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 1 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2
}

/** The commands that regenerate the document, from the repository root. */
export const REGENERATE = ['pnpm --filter @formancy/report-corpus build', 'node packages/report-corpus/dist/trial/run.mjs --date YYYY-MM-DD'] as const

const USAGE = `usage: ${REGENERATE[1]}`

/**
 * The command's one argument: the date the document carries. It is given,
 * not read from the clock, so that the document is a function of the trial
 * alone and carries the day the person running it means.
 */
export function parseArguments(argv: readonly string[]): { readonly date: string } {
  const [flag, date, ...rest] = argv
  if (flag !== '--date' || date === undefined || rest.length > 0) throw new Error(USAGE)
  const [year, month, day] = date.split('-').map(Number)
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(date) ? new Date(Date.UTC(year!, month! - 1, day!)) : undefined
  if (parsed?.toISOString().slice(0, 10) !== date) throw new Error(`--date ${date} is not a calendar date written YYYY-MM-DD; ${USAGE}`)
  return { date }
}

/** A package as installed, and what it does in the trial. */
export interface Installed {
  readonly name: string
  readonly version: string
  readonly role: string
}

export interface Engine {
  readonly name: string
  /** The version the adapter reports, which heads its column. */
  readonly version: string
  readonly packages: readonly Installed[]
}

export interface Machine {
  readonly os: string
  readonly cpu: string
  readonly logicalCpus: number
  readonly memory: string
  readonly node: string
}

export interface FixtureResult {
  readonly fixture: Pick<Fixture, 'id' | 'title' | 'expect'>
  /** One per engine, in the trial's engine order. */
  readonly outcomes: readonly Outcome[]
}

/** One engine on one timed document: its judged first render, then each timed render's milliseconds. */
export interface EngineTiming {
  readonly outcome: Outcome
  readonly milliseconds: readonly number[]
}

export interface Timing {
  readonly fixture: Pick<Fixture, 'id' | 'title'>
  /** One per engine, in the trial's engine order. */
  readonly engines: readonly EngineTiming[]
}

export interface Trial {
  readonly date: string
  readonly machine: Machine
  readonly engines: readonly Engine[]
  /** The PDF reader every check reads through. */
  readonly reader: Installed
  readonly results: readonly FixtureResult[]
  readonly timings: readonly Timing[]
}

/** `docs/renderer-trial.md` for `trial`. */
export function trialReport(trial: Trial): string {
  return [...introduction(trial), ...machine(trial.machine), ...engines(trial), ...corpus(trial), ...failures(trial), ...timings(trial), ...reading(trial)].join('\n')
}

function introduction(trial: Trial): string[] {
  return [
    '# Renderer trial',
    '',
    'Every fixture in the corpus (`packages/report-corpus/src/fixtures`), rendered',
    'by each candidate engine through its trial adapter (`src/trial/`), read back',
    "with PDF.js and judged by the corpus's own checks, as",
    '[0003](decisions/0003-a-rendered-report-is-proved-on-the-pdf-it-produced.md)',
    "requires. The checks are the ones each engine's suite runs, on the PDF that",
    'engine produced.',
    '',
    `**Generated by \`packages/report-corpus/src/trial/run.ts\`, dated ${trial.date};`,
    'do not edit it by hand.** Every outcome, page count, time and version below',
    "was measured or read by the run that wrote it; the numbers in a fixture's",
    "title are the fixture's own. Regenerate it from the repository root:",
    '',
    '```bash',
    ...REGENERATE,
    '```',
    '',
  ]
}

function machine(measured: Machine): string[] {
  return [
    '## Machine',
    '',
    `- **Operating system:** ${measured.os}`,
    `- **CPU:** ${measured.cpu}, ${measured.logicalCpus} logical CPUs`,
    `- **Memory:** ${measured.memory}`,
    `- **Node.js:** ${measured.node}`,
    '',
  ]
}

function engines(trial: Trial): string[] {
  const rows = [
    ...trial.engines.flatMap((engine) => engine.packages.map((installed) => [engine.name, `\`${installed.name}\``, installed.version, installed.role])),
    ['every check', `\`${trial.reader.name}\``, trial.reader.version, trial.reader.role],
  ]
  return ['## Engines', '', "Each version is read from the package's installed `package.json` by the run.", '', ...table(['Adapter', 'Package', 'Version', 'What it does'], rows), '']
}

function corpus(trial: Trial): string[] {
  const header = ['Fixture', 'Expected', ...trial.engines.map((engine) => `${engine.name} ${engine.version}`)]
  const rows = trial.results.map(({ fixture, outcomes }) => [`\`${fixture.id}\`: ${fixture.title}`, expected(fixture.expect), ...outcomes.map(cell)])
  return [
    '## The corpus',
    '',
    'Each fixture is one way a report goes wrong. **pass** is a PDF in which the',
    'checks find nothing wrong, with its pages; **refused as expected** is the',
    'refusal the fixture allows, naming what it must; **FAIL** gives the first',
    'problem the checks found, and the next section all of them.',
    '',
    ...table(header, rows),
    '',
  ]
}

/** Every failure's problems: the corpus's, then those of timed documents the corpus does not hold, which have no other place. */
function failures(trial: Trial): string[] {
  const inCorpus = new Set(trial.results.map(({ fixture }) => fixture.id))
  const judged = [
    ...trial.results,
    ...trial.timings.filter(({ fixture }) => !inCorpus.has(fixture.id)).map(({ fixture, engines: measured }) => ({ fixture, outcomes: measured.map(({ outcome }) => outcome) })),
  ]
  const failed = judged.flatMap(({ fixture, outcomes }) =>
    outcomes.flatMap((outcome, index) => (outcome.kind === 'fail' ? [{ fixture, engine: trial.engines[index]!, problems: outcome.problems }] : [])),
  )
  if (failed.length === 0) return []
  return [
    '## What failed, in full',
    '',
    ...failed.flatMap(({ fixture, engine, problems }) => [`### \`${fixture.id}\` with ${engine.name}`, '', ...problems.map((problem) => `- ${problem}`), '']),
  ]
}

function timings(trial: Trial): string[] {
  const rows = trial.timings.flatMap(({ fixture, engines: measured }) =>
    measured.map(({ outcome, milliseconds }, index) => [
      `\`${fixture.id}\``,
      trial.engines[index]!.name,
      cell(outcome),
      String(milliseconds.length),
      duration(median(milliseconds)),
      duration(Math.min(...milliseconds)),
      duration(Math.max(...milliseconds)),
    ]),
  )
  return [
    '## Render times',
    '',
    'How they were measured: each document was rendered by each adapter once and',
    'judged as above. That render warms the engine and is not timed. The document',
    'was then rendered as many times again as the Runs column says, one after',
    'another in the same Node.js process, each timed alone with `performance.now()`',
    "around the adapter's `render` call, so reading and judging the PDF are not in",
    'it. A refusal is timed until the adapter refuses. The median is the time; the',
    'fastest and slowest runs show the spread.',
    '',
    ...trial.timings.map(({ fixture }) => `- \`${fixture.id}\`: ${fixture.title}`),
    '',
    ...table(['Document', 'Engine', 'Outcome', 'Runs', 'Median', 'Fastest', 'Slowest'], rows),
    '',
  ]
}

function reading(trial: Trial): string[] {
  const byEngine = trial.engines.map((engine, index) => {
    const outcomes = trial.results.map((result) => result.outcomes[index]!)
    const failed = trial.results.filter((result) => result.outcomes[index]!.kind === 'fail').map((result) => `\`${result.fixture.id}\``)
    const passed = outcomes.filter((outcome) => outcome.kind === 'pass').length
    const refused = outcomes.filter((outcome) => outcome.kind === 'refused').length
    const verdict = failed.length === 0 ? 'and failed none' : `and failed ${failed.length}: ${failed.join(', ')}`
    return `- **${engine.name}**, on ${trial.results.length} fixtures, rendered ${passed} that pass, refused ${refused} as their fixtures expect, ${verdict}.`
  })
  const either = trial.results
    .filter(({ fixture }) => fixture.expect.outcome === 'render-or-refuse')
    .map(({ fixture, outcomes }) => `- \`${fixture.id}\` allows a PDF or a refusal. ${outcomes.map((outcome, index) => `${trial.engines[index]!.name}: ${cell(outcome)}`).join('; ')}.`)
  const fastest = trial.timings.map(({ fixture, engines: measured }) => {
    const ranked = measured
      .map((timing, index) => ({ name: trial.engines[index]!.name, time: median(timing.milliseconds), outcome: timing.outcome }))
      .sort((a, b) => a.time - b.time)
    const order = ranked.map(({ name, time }) => `${name} ${duration(time)}`).join(', then ')
    const failing = ranked.filter(({ outcome }) => outcome.kind === 'fail').map(({ name }) => ` ${name}'s time is for a PDF that fails its checks.`)
    return `- \`${fixture.id}\`, fastest first by median: ${order}.${failing.join('')}`
  })
  return [
    '## Reading',
    '',
    ...byEngine,
    ...either,
    ...fastest,
    '',
    'What this does not show. A pass means the checks found no problem in the text',
    'and images PDF.js reads back; they cannot see rules, borders, clipping or',
    "colour (0003). A time is the adapter's, not the bare engine's: whatever an",
    'adapter measures or checks before the engine writes the PDF is inside it. The',
    'times come from one process on one machine that nothing reserved for the run,',
    'not from the documented four-vCPU worker plan section 20 sets its targets',
    'for, so those targets are not judged here. Neither memory nor cancellation is',
    'measured.',
    '',
  ]
}

/** What the fixture allows. Its refusal is present exactly when its outcome allows one (`Expectation`). */
function expected({ outcome, refusal }: Expectation): string {
  if (refusal === undefined) return 'a PDF'
  const named = `refusal \`${refusal.code}\`${refusal.subject === undefined ? '' : ` naming \`${refusal.subject}\``}`
  return outcome === 'refuse' ? named : `a PDF, or ${named}`
}

function cell(outcome: Outcome): string {
  if (outcome.kind === 'pass') return `pass, ${pages(outcome.pages)}`
  if (outcome.kind === 'refused') return `refused as expected: \`${outcome.code}\`${outcome.subject === undefined ? '' : ` naming \`${outcome.subject}\``}`
  const more = outcome.problems.length > 1 ? ` (and ${outcome.problems.length - 1} more)` : ''
  return `**FAIL**${outcome.pages === undefined ? '' : ` (${pages(outcome.pages)})`}: ${outcome.problems.slice(0, 1).join('')}${more}`
}

function pages(count: number): string {
  return `${count} page${count === 1 ? '' : 's'}`
}

/** Whole milliseconds, or hundredths under one. */
function duration(milliseconds: number): string {
  return `${milliseconds < 1 ? milliseconds.toFixed(2) : Math.round(milliseconds)} ms`
}

/** A Markdown table. A `|` in a cell would end the cell and a line break the row, so the one is escaped and the other flattened. */
function table(header: readonly string[], rows: readonly (readonly string[])[]): string[] {
  const line = (cells: readonly string[]): string => `| ${cells.map((text) => text.replace(/\|/g, '\\|').replace(/\s*\n\s*/g, ' ')).join(' | ')} |`
  return [line(header), line(header.map(() => '---')), ...rows.map(line)]
}
