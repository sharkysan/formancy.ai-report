// @vitest-environment node

import { execFileSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, test } from 'vitest'

/**
 * The chunks the preview's pipeline is built into (0068). The Word writer
 * is asked for where a PDF has printed, by an `import()` in `pipeline.ts`,
 * so that a page loads none of it, nor of the two libraries it zips and
 * inflates with, before it has a file to write. What `vite.config.ts`
 * says of the chunk is its size, measured, and a size would be said of it
 * all the same were the import a static one: the writer would then load
 * with the page, in a chunk nobody measured. This is what fails then.
 *
 * `scripts/pipeline-chunks.mjs` builds the pipeline alone, in a process
 * of its own, as `notices.test.ts` has the renderer's entry built: the
 * Studio's own module over the Studio's own resolver, without its page.
 */

interface Chunk {
  readonly fileName: string
  readonly isEntry: boolean
  readonly imports: readonly string[]
  readonly dynamicImports: readonly string[]
  readonly moduleIds: readonly string[]
}

const app = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

/** What a module of the writer's chunk is of, by where the bundler found it: the writer's built package, or a library pnpm installed for it. */
const WRITER: Readonly<Record<string, RegExp>> = {
  'report-render-docx': /\/packages\/report-render-docx\/dist\//,
  fflate: /\/node_modules\/\.pnpm\/fflate@[^/]+\/node_modules\/fflate\//,
  pako: /\/node_modules\/\.pnpm\/pako@[^/]+\/node_modules\/pako\//,
}

/** Which of the writer and its libraries `chunk` holds a module of. */
const writerIn = (chunk: Chunk): string[] =>
  Object.entries(WRITER)
    .filter(([, where]) => chunk.moduleIds.some((id) => where.test(id.replaceAll('\\', '/'))))
    .map(([name]) => name)

test('the Word writer and its two libraries are one chunk, which the pipeline imports dynamically and nothing it loads with imports', () => {
  const { chunks } = JSON.parse(
    execFileSync(process.execPath, [join(app, 'scripts', 'pipeline-chunks.mjs')], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }),
  ) as { readonly chunks: readonly Chunk[] }
  const holding = chunks.filter((chunk) => writerIn(chunk).length > 0)
  // One chunk, and all three in it: a pattern that found no module would find no chunk, and hold nothing.
  expect(holding.map(writerIn)).toEqual([Object.keys(WRITER)])
  const writer = holding[0]!
  // Every chunk that loads with the pipeline: its entry, and whatever that imports statically, however far.
  const byName = new Map(chunks.map((chunk) => [chunk.fileName, chunk]))
  const statics = new Set<string>()
  const walk = (name: string): void => {
    if (statics.has(name)) return
    statics.add(name)
    for (const next of byName.get(name)?.imports ?? []) walk(next)
  }
  for (const entry of chunks.filter((chunk) => chunk.isEntry)) walk(entry.fileName)
  expect(statics.size).toBeGreaterThan(0)
  expect(statics.has(writer.fileName)).toBe(false)
  expect(chunks.some((chunk) => statics.has(chunk.fileName) && chunk.dynamicImports.includes(writer.fileName))).toBe(true)
}, 120_000)
