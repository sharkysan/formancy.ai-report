import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { createReportClient } from '@formancy/report-client'
import { wordExpressions } from '@formancy/report-core'
import { QUOTATION, STARTERS } from '@formancy/report-corpus'
import { STDIO_DEFAULT_MAX_BUFFER_SIZE } from '@modelcontextprotocol/sdk/shared/stdio.js'
import { DATA_MODES } from '@formancy/report-runtime'
import { REFUSALS } from '@formancy/report-server-core'
import { emptyReport, MAX_REPORT_BYTES, reportHash, reportWords } from '@formancy/report-spec'
import type { ReportDefinition } from '@formancy/report-spec'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import { createReportMcpServer, PACKAGE_VERSION, PLACEHOLDERS, PROMPTS, SERVER_TOOLS, TOOL_DEFINITIONS, translationSteps } from './server.js'
import type { ReportMcpOptions } from './server.js'
import { SETTINGS } from './settings.js'
import { quotationOf, recordingFetch, STARTER_ASSETS, startReportServer } from './test-support.js'
import type { RunningServer } from './test-support.js'
import { applyCommands } from './tools.js'

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
async function connect(options: ReportMcpOptions = {}): Promise<Client> {
  const server = createReportMcpServer(options)
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

/** The tools that need nothing, which every server registers. */
const LOCAL_TOOLS = Object.keys(TOOL_DEFINITIONS).filter((name) => !(SERVER_TOOLS as readonly string[]).includes(name))

/** Report's server for the cases that ask it through the protocol. */
let reports: RunningServer
beforeAll(async () => {
  reports = await startReportServer()
})
afterAll(async () => {
  await reports.close()
})
/** A server half that asks that server as its author, through `fetch` where a case records what is asked. */
const withServer = (fetch?: typeof globalThis.fetch): ReportMcpOptions => ({
  client: createReportClient({ server: reports.at, token: () => reports.sign(), ...(fetch === undefined ? {} : { fetch }) }),
})

describe('the tools a client can see', () => {
  // A tool missing is one an agent never calls; one added without a
  // description is one it calls for the wrong reason. Without a server,
  // the four that need one are not there to be called and refused.
  test('are the five that need nothing, each with the description TOOL_DEFINITIONS holds', async () => {
    const { tools } = await (await connect()).listTools()
    expect(tools.map(({ name }) => name).sort()).toEqual(['apply_commands', 'describe_commands', 'describe_format', 'render_check', 'validate_report'])
    expect(tools.map(({ name }) => name).sort()).toEqual([...LOCAL_TOOLS].sort())
    for (const tool of tools) expect(tool.description, tool.name).toBe(TOOL_DEFINITIONS[tool.name as keyof typeof TOOL_DEFINITIONS])
  })

  // Given Report's server, the four that ask it are registered beside the
  // five: whoami, the list, a draft's read and its save, and nothing that
  // publishes.
  test('are the nine, given a server, the four that ask it among them', async () => {
    const { tools } = await (await connect(withServer())).listTools()
    expect(tools.map(({ name }) => name).sort()).toEqual(Object.keys(TOOL_DEFINITIONS).sort())
    expect([...SERVER_TOOLS].sort()).toEqual(['list_templates', 'read_draft', 'save_draft', 'whoami'])
    for (const tool of tools) expect(tool.description, tool.name).toBe(TOOL_DEFINITIONS[tool.name as keyof typeof TOOL_DEFINITIONS])
  })

  // A tool not registered says nothing of itself, so the server says why
  // it is missing in the instructions a client hands its model: an agent
  // asked to save would otherwise say it cannot, and the person would not
  // learn the two settings that give it the tool.
  test('say, without a server, which tools are missing and the settings that bring them', async () => {
    const without = (await connect()).getInstructions() ?? ''
    for (const name of [...SERVER_TOOLS, ...Object.keys(SETTINGS)]) expect(without, name).toContain(name)
    expect(without).toContain('not registered')
    const given = (await connect(withServer())).getInstructions() ?? ''
    expect(given).not.toContain('not registered')
    expect(given).toContain('as the person whose token')
  })

  // The description is the prompt: one that names the moment is a tool a
  // model reaches for at that moment, one that does not is a tool it has
  // to be told about.
  test('say when to call them, not only what they are', () => {
    expect(TOOL_DEFINITIONS.describe_format).toContain('BEFORE writing or changing a report')
    expect(TOOL_DEFINITIONS.validate_report).toContain('after every change')
    expect(TOOL_DEFINITIONS.describe_commands).toContain('before apply_commands')
    expect(TOOL_DEFINITIONS.apply_commands).toContain('expectedHash')
    expect(TOOL_DEFINITIONS.render_check).toContain('once validate_report answers ok')
    expect(TOOL_DEFINITIONS.whoami).toContain('first')
    expect(TOOL_DEFINITIONS.read_draft).toContain('before changing a template')
    expect(TOOL_DEFINITIONS.save_draft).toContain('validate_report first')
    expect(TOOL_DEFINITIONS.save_draft).toContain('never publishes')
  })

  // validate_report checks what the validator, the draft's size and a
  // render check, and not what a save asks of the server's own state: a
  // description that said it judges as a save would sends an agent to a
  // 422 after the fact for a font, an image the server does not keep or
  // an id that is not the template's (formancy.ai 0056: a check that stays
  // on the server is named as staying there).
  test('say which of a save’s checks validate_report leaves to the server', () => {
    expect(TOOL_DEFINITIONS.validate_report).not.toMatch(/as a save/)
    expect(TOOL_DEFINITIONS.validate_report).toContain('MAX_REPORT_BYTES')
    for (const left of ['the template’s', 'kept there', 'no font']) expect(TOOL_DEFINITIONS.validate_report, left).toContain(left)
  })

  // Unannotated, a tool reads as destructive and open-world, so a host that
  // runs read-only tools without asking would ask about every check, and
  // one that trusts annotations could not tell a check from a save. The
  // five that need nothing change nothing and reach nowhere; the three
  // that read the server reach it and change nothing; save_draft alone
  // writes, a new revision beside the old (0049), so never destructively,
  // and twice is not once.
  test('each say what they change and what they reach, and none publishes', async () => {
    const { tools } = await (await connect(withServer())).listTools()
    const said = Object.fromEntries(tools.map(({ name, annotations }) => [name, annotations]))
    for (const name of LOCAL_TOOLS) expect(said[name], name).toEqual({ readOnlyHint: true, openWorldHint: false })
    for (const name of ['whoami', 'list_templates', 'read_draft']) expect(said[name], name).toEqual({ readOnlyHint: true, openWorldHint: true })
    expect(said['save_draft']).toEqual({ readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true })
    for (const tool of tools) expect(tool.name, tool.name).not.toMatch(/publish|send|fetch/)
  })

  // One envelope for all, declared, so a client learns it once; a schema
  // per tool would be nine places for `data` to drift.
  test('each declare the one result envelope', async () => {
    const { tools } = await (await connect(withServer())).listTools()
    expect(tools).toHaveLength(Object.keys(TOOL_DEFINITIONS).length)
    for (const tool of tools) expect(Object.keys(tool.outputSchema?.properties ?? {}).sort(), tool.name).toEqual(['data', 'ok', 'summary'])
  })

  // An input that took an address or a path would let a model point the
  // server at a file or a host; none does, at any depth, and the walk is
  // shown to find each kind it looks for. The server's address is the
  // bin's setting, never a tool's argument.
  test('take no URL, path or file name, in any input or any prompt’s argument', async () => {
    const client = await connect(withServer())
    const { tools } = await client.listTools()
    expect(tools).toHaveLength(Object.keys(TOOL_DEFINITIONS).length)
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
    const { tools } = await (await connect(withServer())).listTools()
    for (const name of ['validate_report', 'apply_commands', 'render_check', 'save_draft']) {
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

describe('the tools that ask Report’s server, through the protocol', () => {
  // Each argument survives the trip under the name a model is told -- the
  // template, the report and the version it replaces -- and a refusal is
  // isError with its structure: a save whose `from` were dropped would
  // create, and be refused draft-changed for good; one whose report were
  // renamed would send nothing.
  test('save a draft as the person, read it back, and answer a stale save draft-changed, as isError, with the revision that stands', async () => {
    const recording = recordingFetch()
    const client = await connect(withServer(recording.fetch))
    const report = emptyReport('memo', 'Memo', 'en')
    const created = (await client.callTool({ name: 'save_draft', arguments: { template: 'memo', report } })) as Answer
    expect(created.isError).toBeUndefined()
    const version = created.structuredContent?.data as { revision: number; digest: string }
    expect(version.revision).toBe(1)
    const read = (await client.callTool({ name: 'read_draft', arguments: { template: 'memo' } })) as Answer
    expect(read.structuredContent?.data).toMatchObject({ template: 'memo', ...version, hash: reportHash(report), report })
    const theirs = (await client.callTool({ name: 'save_draft', arguments: { template: 'memo', report, from: version } })) as Answer
    expect(theirs.structuredContent?.data).toMatchObject({ revision: 2 })
    const mine = (await client.callTool({ name: 'save_draft', arguments: { template: 'memo', report, from: version } })) as Answer
    expect(mine.isError).toBe(true)
    expect(mine.structuredContent?.data).toEqual({ status: 412, refusal: { ...REFUSALS['draft-changed'], revision: 2 }, standing: 2 })
    const tag = `"1-${version.digest.slice('sha256:'.length)}"`
    expect(recording.asked.filter(({ route }) => route.startsWith('PUT')).map(({ headers }) => headers['if-match'] ?? headers['if-none-match'])).toEqual([
      '*',
      tag,
      tag,
    ])
    const me = (await client.callTool({ name: 'whoami', arguments: {} })) as Answer
    expect(me.structuredContent?.data).toMatchObject({ tenant: 'acme', capacities: ['author'] })
    const listed = (await client.callTool({ name: 'list_templates', arguments: {} })) as Answer
    expect(listed.structuredContent?.data).toEqual({ templates: [{ template: 'memo', revision: 2, title: 'Memo' }] })
  })

  // A report the validator refuses is refused before anything is sent, and
  // arrives as isError: a save the server refused after the fact is the
  // 422 an agent's checks are there to spare it.
  test('refuse to send a report the validator refuses, as isError', async () => {
    const recording = recordingFetch()
    const client = await connect(withServer(recording.fetch))
    const refused = (await client.callTool({ name: 'save_draft', arguments: { template: 'memo', report: { reportSpecVersion: '9' } } })) as Answer
    expect(refused.isError).toBe(true)
    expect(refused.structuredContent?.data).toMatchObject({ valid: false })
    expect(recording.asked).toEqual([])
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

  // An edit applied is no call that ended in an error, MCP's meaning of
  // isError, though the report it made is past the bound a save takes: a
  // client that folds an error's content away, or a model that retries
  // what failed, would lose the report the agent has to bring back within
  // the bound. Not ok, so the agent knows there is something to fix, and
  // not isError, which 0088 keeps for a refusal (2026-11-27).
  test('apply_commands answers an edit applied past MAX_REPORT_BYTES as not ok, and as no error', async () => {
    const report = quotationOf(MAX_REPORT_BYTES - 1)
    const grown = (await (
      await connect()
    ).callTool({
      name: 'apply_commands',
      arguments: { report, commands: [{ command: 'setTitle', args: [`${report.title}xx`] }] },
    })) as Answer
    expect(grown.isError).toBeUndefined()
    expect(grown.structuredContent?.ok).toBe(false)
    expect(grown.structuredContent?.data).toMatchObject({ changed: true, size: { code: 'report-too-large' }, report: { title: `${report.title}xx` } })
  })
})

describe('render_check through the protocol', () => {
  // Every argument survives the trip under the name a model is told: the
  // report, its data, its parameters, the locale, the zone, the mode and
  // the assets, each read back from what the runtime printed with.
  test('takes the report, its data and what a render names, and answers each page’s lines', async () => {
    const result = (await (
      await connect()
    ).callTool({
      name: 'render_check',
      arguments: {
        report: QUOTATION.report,
        data: QUOTATION.data,
        parameters: QUOTATION.parameters,
        locale: 'de-CH',
        timeZone: 'Europe/Zurich',
        mode: 'preview',
        assets: STARTER_ASSETS,
      },
    })) as Answer
    expect(result.isError).toBeUndefined()
    const data = result.structuredContent?.data as { pages: { page: number; lines: string[] }[]; manifest: Record<string, unknown> } | undefined
    expect(data?.pages.map(({ page }) => page)).toEqual([1])
    expect(data?.pages[0]?.lines[0]).toBe('Offerte Q-2026-0415')
    expect(data?.manifest).toMatchObject({ locale: 'de-CH', timeZone: 'Europe/Zurich', mode: 'preview' })
    expect(textOf(result)).toContain('Offerte Q-2026-0415')
  })

  // A render refused is a call that ended in an error, structured: the
  // runtime's codes are what the agent fixes the data by.
  test('answers a refusal as isError, with the runtime’s errors structured', async () => {
    const result = (await (
      await connect()
    ).callTool({
      name: 'render_check',
      arguments: { report: QUOTATION.report, data: { ...QUOTATION.data, header: {} }, assets: STARTER_ASSETS },
    })) as Answer
    expect(result.isError).toBe(true)
    expect(result.structuredContent?.data).toMatchObject({
      rendered: false,
      runtime: expect.arrayContaining([expect.objectContaining({ code: 'missing-field' })]),
    })
  })

  // A mode the tool does not take is the protocol's to refuse, by the
  // schema a client is told, which is the runtime's own list: a mode the
  // runtime gained would otherwise be refused here. render.ts refuses
  // another again for a library's caller.
  test('tells a client the modes it takes, the runtime’s', async () => {
    const { tools } = await (await connect()).listTools()
    const mode = (tools.find(({ name }) => name === 'render_check')?.inputSchema.properties as Record<string, { enum?: unknown }> | undefined)?.mode
    expect(mode?.enum).toEqual([...DATA_MODES])
  })

  // The SDK's stdio transport reads at most this of one message and ends
  // the server past it, with no answer (0088): a call of real data and a
  // logo passes it long before the runtime's rows bound does, so the
  // description says so, by the transport's own number.
  test('tells a model the whole call must stay under the transport’s bound', () => {
    expect(TOOL_DEFINITIONS.render_check).toContain(`under ${String(STDIO_DEFAULT_MAX_BUFFER_SIZE)} bytes`)
    expect(TOOL_DEFINITIONS.render_check).toContain('the server ends without an answer')
  })
})

describe('the prompts a client can see', () => {
  // A prompt gives the order the tools are used in, which is most of their
  // value; named for what somebody is doing, never for a tool.
  test('are writing a report and translating one, each with a description', async () => {
    const { prompts } = await (await connect()).listPrompts()
    // Held to the table the server registers them from, so that a prompt added to PROMPTS and not registered, or registered and not exported, fails here.
    expect(prompts.map(({ name }) => name).sort()).toEqual(Object.keys(PROMPTS).sort())
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
    // The payment part's words are a person's (0088, 2026-11-28): the prompt tells the agent to leave out what validate_report lists for one, by the verdict's own key.
    expect(said).toContain('forPerson')
    expect(said).toContain('payment part')
    expect(TOOL_DEFINITIONS.validate_report).toContain('forPerson')
    for (const step of translationSteps('fr-CH', PLACEHOLDERS)) expect(said).toContain(JSON.stringify(step))
  })

  // The descriptors the prompt prints are made by one typed function, and
  // run here through the registry on a report that prints words and an
  // expression that prints words: a command renamed in report-core does
  // not compile, and its arguments reordered are refused here, where the
  // prompt would otherwise tell a model to send what the registry refuses.
  test('show the commands as descriptors the registry applies', () => {
    const starter = STARTERS.find(({ report }) => wordExpressions(report).length > 0)
    if (starter === undefined) throw new Error('no starter prints words by an expression')
    const { report } = starter
    const word = reportWords(report)[0]?.text ?? ''
    const source = wordExpressions(report)[0]?.cel ?? ''
    const steps = translationSteps('es-ES', { word, text: `${word} (es)`, source, translation: source })
    const result = applyCommands(report, steps)
    expect(result.summary).not.toMatch(/invalid-arguments|unknown-command/)
    expect(result.ok).toBe(true)
    const spanish = (result.data as { report: ReportDefinition }).report.translations?.find(({ locale }) => locale === 'es-ES')
    expect(spanish?.words).toEqual([{ word, text: `${word} (es)` }])
    expect(spanish?.expressions).toEqual([{ cel: source, expression: { cel: source } }])
  })
})
