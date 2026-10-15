import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, test } from 'vitest'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

/** The lines of the first `ts` block under `heading` in `markdown`, trimmed, blank ones left out. */
export function exampleLines(markdown, heading) {
  const section = markdown.split(/^## /m).find((part) => part.startsWith(`${heading}\n`))
  const block = section?.match(/```ts\n([\s\S]*?)```/)?.[1]
  if (block === undefined) return undefined
  return block
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '')
}

describe("the README's \"Render a report\"", () => {
  // The example is code a reader copies. The install gate runs the same
  // lines from the packed packages (scripts/install-fixture/consume.ts), so
  // an example that drifted from what the packages export, or from how they
  // are called, would compile nowhere a reader could see it fail; here it
  // fails when a line of it is not a line the consumer runs.
  test('is code the install gate runs, line for line', () => {
    const lines = exampleLines(readFileSync(join(root, 'README.md'), 'utf8').replaceAll('\r\n', '\n'), 'Render a report')
    const consumer = new Set(readFileSync(join(root, 'scripts/install-fixture/consume.ts'), 'utf8').replaceAll('\r\n', '\n').split('\n').map((line) => line.trim()))
    expect(lines?.length).toBeGreaterThan(3)
    expect(lines?.filter((line) => !consumer.has(line))).toEqual([])
  })

  // The guard reads the section by its heading and the block by its fence:
  // a heading renamed, or a block that is not TypeScript, is no example to
  // hold, and is reported rather than passed.
  test('is found by its heading and its fence', () => {
    expect(exampleLines('# T\n\n## Render a report\n\ntext\n\n```ts\nconst a = 1\n\nconst b = 2\n```\n\n## Next\n', 'Render a report')).toEqual(['const a = 1', 'const b = 2'])
    expect(exampleLines('## Render a report\n\n```js\nconst a = 1\n```\n', 'Render a report')).toBeUndefined()
    expect(exampleLines('## Another\n\n```ts\nconst a = 1\n```\n', 'Render a report')).toBeUndefined()
  })
})
