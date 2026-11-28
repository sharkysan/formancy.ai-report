import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js'
import { REFUSALS } from '@formancy/report-server-core'
import type { WhoAmI } from '@formancy/report-server-core'
import { emptyReport } from '@formancy/report-spec'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { recordingFetch } from './test-support.js'
import type { Asked } from './test-support.js'

/**
 * The bin as a client launches it (0088): main.ts itself, imported afresh
 * for each start, with the environment it is started with, its standard
 * error and output watched, and the stdio transport it connects to the
 * process's pipes replaced by one end of the SDK's in-memory pair, whose
 * other end the case's client holds. What is on trial is the composition
 * root: the two settings both or neither, a token read from a variable
 * once and from a file before every request, and no token's value in
 * anything the bin writes or answers. Report's server is a fetch that
 * answers as its API does and records what it was asked, standing in for
 * the global fetch report-client defaults to; drafts.test.ts asks the
 * server itself.
 */

/** The server end of the pair a start connects to, set by the case before it imports main.ts. */
let serverSide: Transport | undefined
vi.mock('@modelcontextprotocol/sdk/server/stdio.js', () => ({
  // A constructor that returns an object makes `new` give that object: main.ts connects to the case's end.
  StdioServerTransport: class {
    constructor() {
      if (serverSide === undefined) throw new Error('a start connected to no transport the case made')
      return serverSide
    }
  },
}))

/** A token made up for these cases alone: the one value no output may hold. */
const PLANTED = 'planted-token-of-the-main-suite-0123456789'
const NEXT = 'planted-next-token-of-the-main-suite-9876543210'
const AT = 'https://reports.example'

/** Who the stand-in server says a token's holder is. */
const ME: WhoAmI = { subject: 'u-1', tenant: 'acme', roles: ['report-authors'], capacities: ['author'], actions: ['template.list', 'draft.read', 'draft.save'] }

let written: string[]
let asked: Asked[]
let directory: string
let answer: () => Response | Promise<Response>
const exitCode = process.exitCode

beforeEach(async () => {
  written = []
  directory = await mkdtemp(join(tmpdir(), 'report-mcp-main-'))
  answer = () => Response.json(ME)
  const recording = recordingFetch(async () => answer())
  asked = recording.asked
  vi.stubGlobal('fetch', recording.fetch)
  for (const stream of [process.stdout, process.stderr])
    vi.spyOn(stream, 'write').mockImplementation(
      (chunk: string | Uint8Array) => (written.push(`${stream === process.stdout ? 'stdout' : 'stderr'}: ${String(chunk)}`), true),
    )
})

afterEach(async () => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  serverSide = undefined
  process.exitCode = exitCode
  await rm(directory, { recursive: true, force: true })
})

/** The bin started with `env` beside the case's own environment, and the client of its server where it started one. */
async function start(env: Readonly<Record<string, string | undefined>>): Promise<Client | undefined> {
  for (const name of ['FORMANCY_REPORT_URL', 'FORMANCY_REPORT_TOKEN', 'HOST_TOKEN']) vi.stubEnv(name, undefined)
  for (const [name, value] of Object.entries(env)) vi.stubEnv(name, value)
  const [clientSide, server] = InMemoryTransport.createLinkedPair()
  serverSide = server
  vi.resetModules()
  await import('./main.js')
  if (process.exitCode === 1) return undefined
  const client = new Client({ name: 'main-test', version: '0' })
  await client.connect(clientSide)
  return client
}

interface Answer {
  readonly content?: readonly { readonly text?: string }[]
  readonly structuredContent?: { readonly ok?: boolean; readonly summary?: string; readonly data?: unknown }
  readonly isError?: boolean
}

/** Everything a client is told by a started bin, for a case to search: its instructions, its tools and every answer it gave. */
const told = async (client: Client, answers: readonly Answer[]): Promise<string> =>
  [client.getInstructions() ?? '', JSON.stringify((await client.listTools()).tools), ...answers.map((each) => JSON.stringify(each))].join('\n')

const call = async (client: Client, name: string, args: Record<string, unknown> = {}): Promise<Answer> =>
  (await client.callTool({ name, arguments: args })) as Answer

/** The bearer each request the stand-in server was asked carried. */
const bearers = (): string[] => asked.map(({ headers }) => headers['authorization'] ?? '')

describe('the settings, both or neither', () => {
  // Neither is a supported state: the tools that need nothing are the
  // half of the value that needs no deployment, and the bin says why the
  // others are missing rather than failing to start.
  // A variable set to the empty string is an unset one, as a client's
  // configuration may hand over one it was not given a value for.
  test('starts with neither, registering the tools that need nothing alone, and asks nothing', async () => {
    for (const env of [{}, { FORMANCY_REPORT_URL: '', FORMANCY_REPORT_TOKEN: '' }]) {
      const client = await start(env)
      if (client === undefined) throw new Error(`the bin did not start: ${written.join('')}`)
      expect((await client.listTools()).tools.map(({ name }) => name)).not.toContain('save_draft')
      expect(client.getInstructions()).toContain('not registered')
    }
    expect(asked).toEqual([])
    expect(written).toEqual([])
  })

  // Half-configured is the state worth refusing: a server with no token
  // is refused every request, a token with no server asks nothing, and
  // both read as the tools being broken. One sentence, naming both
  // settings and quoting neither, and no server started.
  test('stops with one sentence where one is set without the other, quoting neither', async () => {
    for (const env of [{ FORMANCY_REPORT_URL: AT }, { FORMANCY_REPORT_TOKEN: `env:HOST_TOKEN`, HOST_TOKEN: PLANTED }]) {
      written = []
      process.exitCode = exitCode
      expect(await start(env), JSON.stringify(Object.keys(env))).toBeUndefined()
      expect(process.exitCode).toBe(1)
      expect(written).toHaveLength(1)
      expect(written[0]).toMatch(/^stderr: Set FORMANCY_REPORT_URL and FORMANCY_REPORT_TOKEN together, or neither/)
      expect(written[0]).not.toContain(AT)
    }
  })

  // Both, and the four tools that ask the server are there, asking the
  // server the URL names with the token the variable held when the bin
  // started: a variable is read once, as a client hands the bin its
  // environment once.
  test('starts with both, asking the server the URL names with the token a variable held when it started', async () => {
    const client = await start({ FORMANCY_REPORT_URL: AT, FORMANCY_REPORT_TOKEN: 'env:HOST_TOKEN', HOST_TOKEN: PLANTED })
    if (client === undefined) throw new Error(`the bin did not start: ${written.join('')}`)
    expect((await client.listTools()).tools.map(({ name }) => name)).toEqual(expect.arrayContaining(['whoami', 'list_templates', 'read_draft', 'save_draft']))
    vi.stubEnv('HOST_TOKEN', NEXT)
    const me = await call(client, 'whoami')
    expect(me.structuredContent?.data).toEqual(ME)
    expect(asked.map(({ route }) => route)).toEqual(['GET /v1/whoami'])
    expect(bearers()).toEqual([`Bearer ${PLANTED}`])
  })

  // What a setting may not be is refused at start, each by a sentence of
  // its own that quotes no value: a token pasted where its reference goes,
  // a variable unset or the bin's own, a relative file, and a URL that
  // carries a password. Started, the bin would answer every call refused.
  test('stops on a setting it refuses, by a sentence that quotes no value', async () => {
    const refused: readonly (readonly [Readonly<Record<string, string>>, RegExp])[] = [
      [{ FORMANCY_REPORT_TOKEN: PLANTED }, /never the token itself/],
      [{ FORMANCY_REPORT_TOKEN: 'env:HOST_TOKEN' }, /HOST_TOKEN, which is unset or empty/],
      [{ FORMANCY_REPORT_TOKEN: 'env:host-token' }, /upper case/],
      [{ FORMANCY_REPORT_TOKEN: 'env:FORMANCY_REPORT_URL' }, /holds a setting and never a token/],
      [{ FORMANCY_REPORT_TOKEN: `file:token.txt` }, /absolute path/],
    ]
    for (const [env, said] of refused) {
      written = []
      process.exitCode = exitCode
      expect(await start({ FORMANCY_REPORT_URL: AT, ...env }), JSON.stringify(env)).toBeUndefined()
      expect(process.exitCode).toBe(1)
      expect(written.join(''), JSON.stringify(env)).toMatch(said)
      // The token pasted where its reference goes is the commonest mistake, and the one a sentence that quoted it would publish.
      expect(written.join(''), JSON.stringify(env)).not.toContain(PLANTED)
    }
    written = []
    process.exitCode = exitCode
    const password = 'a-password-of-the-main-suite'
    expect(
      await start({ FORMANCY_REPORT_URL: `https://agent:${password}@reports.example`, FORMANCY_REPORT_TOKEN: 'env:HOST_TOKEN', HOST_TOKEN: PLANTED }),
    ).toBeUndefined()
    expect(written.join('')).toMatch(/FORMANCY_REPORT_URL is refused by report-client/)
    expect(written.join('')).not.toContain(password)
  })
})

describe('a token in a file', () => {
  // A host's own tool renews the person's token before it expires and
  // writes it to the file: read once, the bin would send the expired one
  // until the person restarted their agent (0088, Alternatives).
  test('is read again before each request, its line’s ending taken off', async () => {
    const file = join(directory, 'token')
    await writeFile(file, `${PLANTED}\n`)
    const client = await start({ FORMANCY_REPORT_URL: AT, FORMANCY_REPORT_TOKEN: `file:${file}` })
    if (client === undefined) throw new Error(`the bin did not start: ${written.join('')}`)
    await call(client, 'whoami')
    await writeFile(file, `${NEXT}\r\n`)
    await call(client, 'list_templates')
    expect(bearers()).toEqual([`Bearer ${PLANTED}`, `Bearer ${NEXT}`])
  })

  // A file gone, empty, or holding what no bearer header carries sends
  // nothing, and the agent is told so by a sentence that names the
  // setting, not the path, nor anything the file held.
  test('that cannot be read, is empty, or holds what is no token sends nothing, and says so', async () => {
    const file = join(directory, 'token')
    const client = await start({ FORMANCY_REPORT_URL: AT, FORMANCY_REPORT_TOKEN: `file:${file}` })
    if (client === undefined) throw new Error(`the bin did not start: ${written.join('')}`)
    const gone = await call(client, 'whoami')
    expect(gone.isError).toBe(true)
    expect(gone.structuredContent?.summary).toContain('The file FORMANCY_REPORT_TOKEN names could not be read')
    expect(gone.structuredContent?.summary).not.toContain(directory)
    await writeFile(file, '\n')
    expect((await call(client, 'whoami')).structuredContent?.summary).toContain('is empty')
    await writeFile(file, `${PLANTED}\nsecond line`)
    expect((await call(client, 'whoami')).structuredContent?.summary).toContain('no bearer token')
    expect(asked).toEqual([])
  })
})

describe('no token in any output', () => {
  // The token is the person's at their host: whoever reads what the agent
  // was answered, what the bin wrote to its streams, or a refusal, must
  // not find it there. One token, planted, is looked for in every output
  // of every path a request takes -- answered, refused by the server, a
  // gateway's page, a network that failed, a save sent and one refused --
  // and found in the one place it belongs, the requests' bearer.
  test('is written, answered or thrown by any path, though every request carries it', async () => {
    const file = join(directory, 'token')
    await writeFile(file, PLANTED)
    const client = await start({ FORMANCY_REPORT_URL: AT, FORMANCY_REPORT_TOKEN: `file:${file}` })
    if (client === undefined) throw new Error(`the bin did not start: ${written.join('')}`)
    const answers: Answer[] = []
    const thrown: unknown[] = []
    const report = emptyReport('invoice', 'Invoice', 'en')
    const paths: readonly (readonly [() => Response | Promise<Response>, string, Record<string, unknown>])[] = [
      [() => Response.json(ME), 'whoami', {}],
      [() => Response.json(REFUSALS.unauthenticated, { status: 401 }), 'whoami', {}],
      [() => new Response(`<html>Bad gateway: Bearer ${PLANTED}</html>`, { status: 502 }), 'list_templates', {}],
      [() => Promise.reject(new TypeError(`fetch failed for Bearer ${PLANTED}`, { cause: { code: 'ECONNREFUSED' } })), 'read_draft', { template: 'invoice' }],
      [() => Response.json({ ...REFUSALS['draft-changed'], revision: 4 }, { status: 412 }), 'save_draft', { template: 'invoice', report }],
      [() => Response.json({ template: 'invoice', revision: 5, digest: `sha256:${'a'.repeat(64)}` }), 'save_draft', { template: 'invoice', report }],
    ]
    for (const [answered, name, args] of paths) {
      answer = answered
      try {
        answers.push(await call(client, name, args))
      } catch (error) {
        thrown.push(error)
      }
    }
    expect(thrown).toEqual([])
    expect(answers.map((each) => each.isError === true)).toEqual([false, true, true, true, true, false])
    // A network that failed is said by its code, and never by what a fetch's message holds.
    expect(answers[3]?.structuredContent?.summary).toContain('ECONNREFUSED')
    expect(asked).toHaveLength(paths.length)
    expect(bearers().every((bearer) => bearer === `Bearer ${PLANTED}`)).toBe(true)
    expect(await told(client, answers)).not.toContain(PLANTED)
    expect(written.join('')).not.toContain(PLANTED)
    expect(written).toEqual([])
  })
})
