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

describe('the README\'s "Render a report"', () => {
  // The example is code a reader copies. The install gate runs the same
  // lines from the packed packages (scripts/install-fixture/consume.ts), so
  // an example that drifted from what the packages export, or from how they
  // are called, would compile nowhere a reader could see it fail; here it
  // fails when a line of it is not a line the consumer runs.
  test('is code the install gate runs, line for line', () => {
    const lines = exampleLines(readFileSync(join(root, 'README.md'), 'utf8').replaceAll('\r\n', '\n'), 'Render a report')
    const consumer = new Set(
      readFileSync(join(root, 'scripts/install-fixture/consume.ts'), 'utf8')
        .replaceAll('\r\n', '\n')
        .split('\n')
        .map((line) => line.trim()),
    )
    expect(lines?.length).toBeGreaterThan(3)
    expect(lines?.filter((line) => !consumer.has(line))).toEqual([])
  })

  // The guard reads the section by its heading and the block by its fence:
  // a heading renamed, or a block that is not TypeScript, is no example to
  // hold, and is reported rather than passed.
  test('is found by its heading and its fence', () => {
    expect(exampleLines('# T\n\n## Render a report\n\ntext\n\n```ts\nconst a = 1\n\nconst b = 2\n```\n\n## Next\n', 'Render a report')).toEqual([
      'const a = 1',
      'const b = 2',
    ])
    expect(exampleLines('## Render a report\n\n```js\nconst a = 1\n```\n', 'Render a report')).toBeUndefined()
    expect(exampleLines('## Another\n\n```ts\nconst a = 1\n```\n', 'Render a report')).toBeUndefined()
  })
})

describe('the Data provider\'s README, "Read a report\'s data"', () => {
  // The same rule for the provider's example: a reader copies it into a
  // host that talks to a real data server, so every line of it is a line
  // the install gate runs, from the packed provider and the data-client
  // release it pins, against a server answering Data 0.5.0's routes.
  test('is code the install gate runs, line for line', () => {
    const readme = readFileSync(join(root, 'packages/report-data-provider/README.md'), 'utf8').replaceAll('\r\n', '\n')
    const lines = exampleLines(readme, "Read a report's data")
    const consumer = new Set(
      readFileSync(join(root, 'scripts/install-fixture/consume.ts'), 'utf8')
        .replaceAll('\r\n', '\n')
        .split('\n')
        .map((line) => line.trim()),
    )
    expect(lines?.length).toBeGreaterThan(5)
    expect(lines?.filter((line) => !consumer.has(line))).toEqual([])
  })
})

describe('the form bridge\'s README, "Read a submission"', () => {
  // A reader copies it into a host that keeps formancy's form versions
  // beside their submissions, so every line of it is a line the install
  // gate runs, from the packed bridge and the @formancy/spec it pins
  // (scripts/install-fixture/forms.ts).
  test('is code the install gate runs, line for line', () => {
    const readme = readFileSync(join(root, 'packages/report-forms/README.md'), 'utf8').replaceAll('\r\n', '\n')
    const lines = exampleLines(readme, 'Read a submission')
    const consumer = new Set(
      readFileSync(join(root, 'scripts/install-fixture/forms.ts'), 'utf8')
        .replaceAll('\r\n', '\n')
        .split('\n')
        .map((line) => line.trim()),
    )
    expect(lines?.length).toBeGreaterThan(5)
    expect(lines?.filter((line) => !consumer.has(line))).toEqual([])
  })
})

describe('the form bridge\'s README, "Start a report from a form"', () => {
  // The generator's example too (0045): a reader copies it into a host
  // that keeps the form version a person starts from, so every line of it
  // is a line the install gate runs, from the packed bridge
  // (scripts/install-fixture/forms.ts).
  test('is code the install gate runs, line for line', () => {
    const readme = readFileSync(join(root, 'packages/report-forms/README.md'), 'utf8').replaceAll('\r\n', '\n')
    const lines = exampleLines(readme, 'Start a report from a form')
    const consumer = new Set(
      readFileSync(join(root, 'scripts/install-fixture/forms.ts'), 'utf8')
        .replaceAll('\r\n', '\n')
        .split('\n')
        .map((line) => line.trim()),
    )
    expect(lines?.length).toBeGreaterThan(3)
    expect(lines?.filter((line) => !consumer.has(line))).toEqual([])
  })
})

describe('the form bridge\'s README, "Review a new form version"', () => {
  // The review's example too (0048): a reader copies it into a host that
  // shows a review and applies a resolution through a report-core
  // session, so every line of it is a line the install gate runs, from
  // the packed bridge and report-core (scripts/install-fixture/forms.ts).
  test('is code the install gate runs, line for line', () => {
    const readme = readFileSync(join(root, 'packages/report-forms/README.md'), 'utf8').replaceAll('\r\n', '\n')
    const lines = exampleLines(readme, 'Review a new form version')
    const consumer = new Set(
      readFileSync(join(root, 'scripts/install-fixture/forms.ts'), 'utf8')
        .replaceAll('\r\n', '\n')
        .split('\n')
        .map((line) => line.trim()),
    )
    expect(lines?.length).toBeGreaterThan(3)
    expect(lines?.filter((line) => !consumer.has(line))).toEqual([])
  })
})

describe('the server\'s README, "Embed the server"', () => {
  // A reader copies it into a host that serves Report from its own
  // process, so every line of it is a line the install gate runs, from the
  // packed server in a Node host holding the server and what it declares
  // and nothing else (scripts/install-fixture/server.ts, 0046).
  test('is code the install gate runs, line for line', () => {
    const readme = readFileSync(join(root, 'packages/report-server/README.md'), 'utf8').replaceAll('\r\n', '\n')
    const lines = exampleLines(readme, 'Embed the server')
    const consumer = new Set(
      readFileSync(join(root, 'scripts/install-fixture/server.ts'), 'utf8')
        .replaceAll('\r\n', '\n')
        .split('\n')
        .map((line) => line.trim()),
    )
    expect(lines?.length).toBeGreaterThan(3)
    expect(lines?.filter((line) => !consumer.has(line))).toEqual([])
  })
})

describe('the client\'s README, "Save and reopen a draft"', () => {
  // A reader copies it into a host's page, or its server, that keeps a
  // report's draft on Report's server, so every line of it is a line the
  // install gate runs, from the packed client against the packed server
  // in the server's host (scripts/install-fixture/server.ts, 0049).
  test('is code the install gate runs, line for line', () => {
    const readme = readFileSync(join(root, 'packages/report-client/README.md'), 'utf8').replaceAll('\r\n', '\n')
    const lines = exampleLines(readme, 'Save and reopen a draft')
    const consumer = new Set(
      readFileSync(join(root, 'scripts/install-fixture/server.ts'), 'utf8')
        .replaceAll('\r\n', '\n')
        .split('\n')
        .map((line) => line.trim()),
    )
    expect(lines?.length).toBeGreaterThan(3)
    expect(lines?.filter((line) => !consumer.has(line))).toEqual([])
  })
})

describe('the client\'s README, "Ask the server\'s model"', () => {
  // A reader copies it into a builder's host whose server asks its model
  // (0084), so every line of it is a line the install gate runs, from the
  // packed client and report-ai against the packed server, made with a
  // scripted completer, in the server's host
  // (scripts/install-fixture/server.ts): an example that drifted from what
  // the packages export, or from how the AskModel is made, would compile
  // nowhere a reader could see it fail.
  test('is code the install gate runs, line for line', () => {
    const readme = readFileSync(join(root, 'packages/report-client/README.md'), 'utf8').replaceAll('\r\n', '\n')
    const lines = exampleLines(readme, "Ask the server's model")
    const consumer = new Set(
      readFileSync(join(root, 'scripts/install-fixture/server.ts'), 'utf8')
        .replaceAll('\r\n', '\n')
        .split('\n')
        .map((line) => line.trim()),
    )
    expect(lines?.length).toBeGreaterThan(3)
    expect(lines?.filter((line) => !consumer.has(line))).toEqual([])
  })
})

describe('the Word writer\'s README, "Write a report as a Word file"', () => {
  // A reader copies it into a host that hands a person a report to go on
  // writing in (0068). The getting-started guide writes no Word file, so
  // this example is the one a reader meets: every line of it is a line
  // the install gate runs, from the packed writer on the fflate and the
  // pako a clean install gives it (scripts/install-fixture/docx.ts). An example that
  // drifted from what the package exports would otherwise compile nowhere.
  test('is code the install gate runs, line for line', () => {
    const readme = readFileSync(join(root, 'packages/report-render-docx/README.md'), 'utf8').replaceAll('\r\n', '\n')
    const lines = exampleLines(readme, 'Write a report as a Word file')
    const consumer = new Set(
      readFileSync(join(root, 'scripts/install-fixture/docx.ts'), 'utf8')
        .replaceAll('\r\n', '\n')
        .split('\n')
        .map((line) => line.trim()),
    )
    expect(lines?.length).toBeGreaterThan(5)
    expect(lines?.filter((line) => !consumer.has(line))).toEqual([])
  })
})

describe('the model turn\'s README, "Ask a model"', () => {
  // A reader copies it into a host that asks its own model (0083), so
  // every line of it is a line the install gate runs, from the packed
  // report-ai in the Node host (scripts/install-fixture/model-turn.ts). An
  // example that drifted from what the package exports, or from how a run
  // is asked, would otherwise compile nowhere.
  test('is code the install gate runs, line for line', () => {
    const readme = readFileSync(join(root, 'packages/report-ai/README.md'), 'utf8').replaceAll('\r\n', '\n')
    const lines = exampleLines(readme, 'Ask a model')
    const consumer = new Set(
      readFileSync(join(root, 'scripts/install-fixture/model-turn.ts'), 'utf8')
        .replaceAll('\r\n', '\n')
        .split('\n')
        .map((line) => line.trim()),
    )
    expect(lines?.length).toBeGreaterThan(10)
    expect(lines?.filter((line) => !consumer.has(line))).toEqual([])
  })
})

describe(`the model turn's README, "Translate a language's missing words"`, () => {
  // A reader copies it into a host whose server asks its model (0085), so
  // every line of it is a line the install gate runs, from the packed
  // report-ai in the Node host (scripts/install-fixture/translation.ts):
  // an example that drifted from what the package exports, or from how a
  // proposal is applied, would otherwise compile nowhere.
  test('is code the install gate runs, line for line', () => {
    const readme = readFileSync(join(root, 'packages/report-ai/README.md'), 'utf8').replaceAll('\r\n', '\n')
    const lines = exampleLines(readme, "Translate a language's missing words")
    const consumer = new Set(
      readFileSync(join(root, 'scripts/install-fixture/translation.ts'), 'utf8')
        .replaceAll('\r\n', '\n')
        .split('\n')
        .map((line) => line.trim()),
    )
    expect(lines?.length).toBeGreaterThan(5)
    expect(lines?.filter((line) => !consumer.has(line))).toEqual([])
  })
})
