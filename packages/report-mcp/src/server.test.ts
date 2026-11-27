import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { QUOTATION } from '@formancy/report-corpus'
import { reportHash } from '@formancy/report-spec'
import { describe, expect, test } from 'vitest'
import { createReportMcpServer, PACKAGE_VERSION, PROMPTS, TOOL_DEFINITIONS } from './server.js'

/**
 * The server, driven through the real protocol by the SDK's own client
 * over its in-memory transport (0088, after formancy.ai 0056 and 0112).
 *
 * `tools.test.ts` holds what each tool decides; this holds that each is
 * reachable under its name, that its arguments survive the round trip,
 * that a refusal arrives as one, and what a client is told before it calls
 * anything. Through a client rather than by inspection, because a tool
 * registered under another argument name is invisible to a unit test and
 * fatal in use: the model's call never matches.
 */
async function connect(): Promise<Client> {
  const server = createReportMcpServer()
  const client = new Client({ name: 'test', version: '0' })
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair()
  await Promise.all([server.connect(serverSide), client.connect(clientSide)])
  return client
}

interface Answer {
  readonly content?: readonly { readonly type: string; readonly text?: string }[]
  readonly structuredContent?: { readonly ok?: boolean; readonly summary?: string; readonly data?: Record<string, unknown> }
  readonly isError?: boolean
}

/** The text a model reads of an answer. */
const textOf = (answer: Answer): string => (answer.content ?? []).map((part) => part.text ?? '').join('\n')

/** What a prompt says, its text parts alone: a cast would keep compiling the day a prompt grows a part of another kind, and stop reading it. */
const promptText = (messages: readonly { readonly content: { readonly type: string; readonly text?: string } }[]): string =>
  messages.map(({ content }) => (content.type === 'text' ? (content.text ?? '') : '')).join('\n')

/** The words that would let a tool take an address, a path or a file: what 0088 says no input holds. */
const ADDRESS_WORDS = new Set(['url', 'uri', 'href', 'path', 'file', 'filename', 'filepath', 'directory', 'dir'])

/**
 * Every property name, at any depth, of a JSON Schema, and every string it
 * gives a format of `uri` or `uri-reference`, as `format:uri`: what the
 * client is told a tool takes.
 */
function addressesIn(schema: unknown): string[] {
  const found: string[] = []
  const visit = (node: unknown): void => {
    if (Array.isArray(node)) return void node.forEach(visit)
    if (typeof node !== 'object' || node === null) return
    const record = node as Record<string, unknown>
    if (typeof record.format === 'string' && /^(?:uri|uri-reference|iri)$/.test(record.format)) found.push(`format:${record.format}`)
    if (typeof record.properties === 'object' && record.properties !== null)
      for (const name of Object.keys(record.properties)) if (ADDRESS_WORDS.has(name.toLowerCase())) found.push(name)
    Object.values(record).forEach(visit)
  }
  visit(schema)
  return found
}

describe('the tools a client can see', () => {
  // A tool missing is one an agent never calls; one added without a
  // description is one it calls for the wrong reason.
  test('are the four that need nothing, each with the description TOOL_DEFINITIONS holds', async () => {
    const { tools } = await (await connect()).listTools()
    expect(tools.map(({ name }) => name).sort()).toEqual(['apply_commands', 'describe_commands', 'describe_format', 'validate_report'])
    for (const tool of tools) expect(tool.description, tool.name).toBe(TOOL_DEFINITIONS[tool.name as keyof typeof TOOL_DEFINITIONS])
  })

  // The description is the prompt: one that names the moment is a tool a
  // model reaches for at that moment, one that does not is a tool it has
  // to be told about.
  test('say when to call them, not only what they are', () => {
    expect(TOOL_DEFINITIONS.describe_format).toContain('BEFORE writing or changing a report')
    expect(TOOL_DEFINITIONS.validate_report).toContain('after every change')
    expect(TOOL_DEFINITIONS.describe_commands).toContain('before apply_commands')
    expect(TOOL_DEFINITIONS.apply_commands).toContain('expectedHash')
  })

  // Unannotated, a tool reads as destructive and open-world, so a host that
  // runs read-only tools without asking would ask about every check, and
  // one that trusts annotations could not tell a check from a save.
  test('each say they change nothing and reach nowhere, so no tool publishes or saves', async () => {
    const { tools } = await (await connect()).listTools()
    for (const tool of tools) {
      expect(tool.annotations?.readOnlyHint, tool.name).toBe(true)
      expect(tool.annotations?.openWorldHint, tool.name).toBe(false)
      expect(tool.name, tool.name).not.toMatch(/publish|save|send|fetch/)
    }
  })

  // One envelope for all, declared, so a client learns it once; a schema
  // per tool would be four places for `data` to drift.
  test('each declare the one result envelope', async () => {
    const { tools } = await (await connect()).listTools()
    for (const tool of tools) expect(Object.keys(tool.outputSchema?.properties ?? {}).sort(), tool.name).toEqual(['data', 'ok', 'summary'])
  })

  // An input that took an address or a path would let a model point the
  // server at a file or a host; none does, at any depth, and the walk is
  // shown to find each kind it looks for.
  test('take no URL, path or file name, in any input or any prompt’s argument', async () => {
    const client = await connect()
    const { tools } = await client.listTools()
    for (const tool of tools) expect(addressesIn(tool.inputSchema), tool.name).toEqual([])
    const { prompts } = await client.listPrompts()
    for (const prompt of prompts)
      for (const argument of prompt.arguments ?? []) expect(ADDRESS_WORDS.has(argument.name.toLowerCase()), `${prompt.name}: ${argument.name}`).toBe(false)
    expect(
      addressesIn({
        type: 'object',
        properties: { report: { type: 'object', properties: { logo: { type: 'object', properties: { url: { type: 'string' } } } } } },
      }),
    ).toEqual(['url'])
    expect(addressesIn({ type: 'object', properties: { from: { type: 'string', format: 'uri' }, Path: {} } }).sort()).toEqual(['Path', 'format:uri'])
  })

  // A report arrives as any JSON value, judged by report-spec's validator,
  // the one authority: a schema of the format here would be a second
  // authority, which one day refuses a report report-spec accepts.
  test('take a report as any JSON value, for report-spec to judge', async () => {
    const { tools } = await (await connect()).listTools()
    for (const name of ['validate_report', 'apply_commands']) {
      const report = (tools.find((tool) => tool.name === name)?.inputSchema.properties as Record<string, Record<string, unknown>> | undefined)?.report
      expect(report, name).toBeDefined()
      expect(
        Object.keys(report ?? {}).filter((key) => key !== 'description'),
        name,
      ).toEqual([])
    }
  })

  // The one field a client tells two installations apart by: typed, it
  // would say another release than the one installed.
  test('come from a server that reports the manifest’s version', async () => {
    const client = await connect()
    expect(client.getServerVersion()).toEqual({ name: 'formancy-report', version: PACKAGE_VERSION })
    expect(PACKAGE_VERSION).toMatch(/^\d+\.\d+\.\d+/)
  })
})

describe('calling them', () => {
  // Answered without a server: the half of the value that needs nothing.
  test('describe_format and describe_commands answer, structured as well as written', async () => {
    const client = await connect()
    const format = (await client.callTool({ name: 'describe_format', arguments: {} })) as Answer
    expect(format.isError).toBeUndefined()
    expect(format.structuredContent?.ok).toBe(true)
    expect(format.structuredContent?.data?.componentKinds).toContain('table')
    expect(textOf(format)).toContain('epcQrCode')
    const commands = (await client.callTool({ name: 'describe_commands', arguments: {} })) as Answer
    expect(JSON.stringify(commands.structuredContent?.data?.commands)).toContain('"setTitle"')
  })

  // The report survives the trip under its argument's name: registered
  // under another, the call would be judged on nothing.
  test('validate_report takes a report and answers its verdict and its hash', async () => {
    const result = (await (await connect()).callTool({ name: 'validate_report', arguments: { report: QUOTATION.report } })) as Answer
    expect(result.isError).toBeUndefined()
    expect(result.structuredContent?.data).toMatchObject({ valid: true, hash: reportHash(QUOTATION.report) })
  })

  // A refusal is an answer the model reads and acts on, never a transport
  // error, and it is structured too: the answer a client most needs to act
  // on would otherwise be prose alone.
  test('a report the validator refuses arrives as isError, with its errors structured', async () => {
    const result = (await (await connect()).callTool({ name: 'validate_report', arguments: { report: { specVersion: '4' } } })) as Answer
    expect(result.isError).toBe(true)
    expect(result.structuredContent?.ok).toBe(false)
    expect(result.structuredContent?.data).toMatchObject({ valid: false, errors: [{ code: 'not-a-report' }] })
    expect(textOf(result)).toContain('not-a-report')
  })

  // The three arguments survive: the report, the commands as data and the
  // hash an edit is bound to, each under the name a model is told.
  test('apply_commands takes a report, its commands and the hash they were made against', async () => {
    const client = await connect()
    const applied = (await client.callTool({
      name: 'apply_commands',
      arguments: { report: QUOTATION.report, commands: [{ command: 'setTitle', args: ['Offerte 2026-117'] }], expectedHash: reportHash(QUOTATION.report) },
    })) as Answer
    expect(applied.isError).toBeUndefined()
    expect(applied.structuredContent?.data).toMatchObject({ changed: true, report: { title: 'Offerte 2026-117' } })
    const stale = (await client.callTool({
      name: 'apply_commands',
      arguments: { report: QUOTATION.report, commands: [{ command: 'setTitle', args: ['Offerte'] }], expectedHash: 'sha256:00' },
    })) as Answer
    expect(stale.isError).toBe(true)
    expect(stale.structuredContent?.data).toMatchObject({ refusal: { code: 'stale-document' } })
  })
})

describe('the prompts a client can see', () => {
  // A prompt gives the order the tools are used in, which is most of their
  // value; named for what somebody is doing, never for a tool.
  test('are writing a report and translating one, each with a description', async () => {
    const { prompts } = await (await connect()).listPrompts()
    expect(prompts.map(({ name }) => name).sort()).toEqual(['translate_a_report', 'write_a_report'])
    for (const prompt of prompts) expect(prompt.description ?? '', prompt.name).not.toBe('')
  })

  // formancy.ai 0112 left this unchecked: a tool renamed or removed leaves
  // a prompt telling a model to call what is not there.
  test('name only tools the server registers', async () => {
    const client = await connect()
    const { tools } = await client.listTools()
    const registered = new Set(tools.map(({ name }) => name))
    for (const name of Object.keys(PROMPTS)) {
      const { messages } = await client.getPrompt({ name, arguments: { description: 'a delivery note', language: 'fr-CH' } })
      const named = [...promptText(messages).matchAll(/`([a-z]+(?:_[a-z]+)+)`/g)].map((match) => match[1])
      expect(named.length, name).toBeGreaterThan(1)
      for (const tool of named) expect(registered.has(tool ?? ''), `${name} names ${String(tool)}`).toBe(true)
    }
  })

  // Writing starts from the format and ends with the checks, in that
  // order: a model that writes first and asks for the format after has
  // already invented a component kind.
  test('tell a model writing a report to describe the format first and to validate before it is done', async () => {
    const { messages } = await (await connect()).getPrompt({ name: 'write_a_report', arguments: { description: 'a delivery note with its lines' } })
    const said = promptText(messages)
    expect(said).toContain('a delivery note with its lines')
    expect(said.indexOf('`describe_format`')).toBeGreaterThan(-1)
    expect(said.indexOf('`describe_format`')).toBeLessThan(said.indexOf('`validate_report`'))
  })

  // A translation is keyed by the word's exact text, the one thing a model
  // gets wrong first; the prompt names the language it was asked for and
  // the diagnostic that lists what that language lacks.
  test('tell a model translating a report to work from word-missing, by the report’s own commands', async () => {
    const { messages } = await (await connect()).getPrompt({ name: 'translate_a_report', arguments: { language: 'fr-CH' } })
    const said = promptText(messages)
    expect(said).toContain('fr-CH')
    expect(said).toContain('word-missing')
    for (const command of ['addLanguage', 'translateWord', 'translateExpression']) expect(said, command).toContain(command)
  })
})
