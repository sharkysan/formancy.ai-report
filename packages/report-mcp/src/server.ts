/**
 * The tools and the prompts, wired to the Model Context Protocol (0088).
 *
 * Thin on purpose, as formancy's (formancy.ai 0056): every tool is a call
 * into `tools.ts`, `render.ts` or `drafts.ts` and the answer put in the
 * protocol's shape. What a tool decides is tested without a transport;
 * what is tested here is that it is reachable, under its name, with its
 * arguments.
 */
import { createRequire } from 'node:module'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { STDIO_DEFAULT_MAX_BUFFER_SIZE } from '@modelcontextprotocol/sdk/shared/stdio.js'
import type { ToolAnnotations } from '@modelcontextprotocol/sdk/types.js'
import type { ReportClient } from '@formancy/report-client'
import type { DiagnosticCode, StepDescriptor } from '@formancy/report-core'
import { DATA_MODES } from '@formancy/report-runtime'
import { z } from 'zod'
import { listTemplates, readDraft, saveDraft, whoAmI } from './drafts.js'
import { MAX_ANSWER_BYTES, MAX_CHECK_PAGES, renderCheck } from './render.js'
import { SETTINGS } from './settings.js'
import { applyCommands, checkReport, describeFormat, listCommands } from './tools.js'
import type { LanguageVerdict, ToolResult } from './tools.js'

/**
 * Each tool's description, apart from its wiring. Exported and asserted,
 * because the description is the prompt: the only thing that tells a
 * model when to reach for a tool, and one that does not say when is a
 * tool nobody calls (formancy.ai 0056).
 */
export const TOOL_DEFINITIONS = {
  describe_format:
    'List what a Formancy Report definition is made of: its version, its regions, the component kinds, the field and parameter types, ' +
    'what an expression may read and as which type, the bounds a report is refused past, and the traps. Call this BEFORE writing or ' +
    'changing a report. A kind or a type that is not listed does not exist, whatever other report writers call it.',
  validate_report:
    'Judge a report as the validator and a render would, without saving or rendering anything: the validator first, whose errors a ' +
    'save refuses; the bound a draft is held to, MAX_REPORT_BYTES of JSON; then the diagnostics of its expressions and bindings, whose ' +
    'errors refuse every render; then each declared language’s, whose errors refuse a render in that language alone. Each comes back ' +
    'with its code, its JSON Pointer path and its sentence, and a valid report with its hash and its size. A save also asks what only ' +
    'Report’s server knows, which this does not check: that the report’s id is the template’s, that every image it declares is kept ' +
    'there, and that it maps no font. Of what a language lacks, a word that stands in the payment part is listed in its forPerson: ' +
    'a person writes it, never an agent. Call it after every change you write by hand, and before you show a report to anyone.',
  describe_commands:
    'List every editing command of report-core, the ones both builders run, each written as { "command": name, "args": [...] } with ' +
    'the shape of each argument after the report; how many one edit may hold; and the commands that may change whom a payment ' +
    'reaches. Call it once before apply_commands.',
  apply_commands:
    'Apply a list of report-core commands to a report as one edit, through the registry and the session the builders use: each ' +
    'command is checked before it runs, the result is validated once, and a refused command or an invalid result changes nothing. ' +
    'Answers the new report, its hash and its diagnostics, or the refusal’s code, sentence and path. Prefer it to rewriting a report ' +
    'by hand: a command changes only what it names. Pass expectedHash, the hash validate_report or the last apply_commands answered, ' +
    'and the edit is refused when the report given is not that one.',
  render_check:
    'Render a report with data you pass in, as a host renders it, and read back what the PDF prints: each page’s lines of text, top ' +
    'to bottom, read with PDF.js from the PDF the renderer produced, so you see where a page breaks, what a table prints on which ' +
    'page and what lands on the last. Or the refusal, by whoever gave it: the validator’s errors, the runtime’s with their codes -- ' +
    'what the data lacks or breaks, in a final render -- or the renderer’s. The data is the runtime’s envelope, { header, detail, ' +
    'completeness: { complete: true, captured: the rows given }, consistency: "host-captured" }, an exact number or a date as a string ' +
    'of its digits; an image or a font the report names comes in assets, its bytes in base64 with the digest ' +
    'the report pins, never by address. A final render unless mode is preview, which prints what the data lacks and says so. At most ' +
    `${String(MAX_CHECK_PAGES)} pages, and an answer of at most ${String(MAX_ANSWER_BYTES)} bytes; the PDF itself is not returned. The ` +
    `whole call -- the report, its data and every asset's base64 -- must stay under ${String(STDIO_DEFAULT_MAX_BUFFER_SIZE)} bytes of ` +
    'JSON, or the server ends without an answer: send a sample of the rows, a few hundred, never the whole data. Call it once ' +
    'validate_report answers ok, with data shaped like the real data, before you show a report to anyone.',
  whoami:
    'Ask Report’s server who it takes this server’s token’s holder to be: their subject, their tenant, their roles, and the capacities ' +
    'and actions the operator’s role policy gives those roles. Call it first, before reading or saving a template: save_draft needs ' +
    'draft.save among the actions. The token is the person’s at their host, and what save_draft saves is saved as them.',
  list_templates:
    'List the tenant’s templates on Report’s server, each by its id -- its report’s id -- with its newest draft’s revision and title. ' +
    'Call it to find the template to read; read_draft reads one.',
  read_draft:
    'Read a template’s newest draft from Report’s server: its report, its version { revision, digest }, which save_draft takes as ' +
    'from, who saved it, and the report’s hash, which apply_commands takes as expectedHash. Call it before changing a template, ' +
    'and again whenever save_draft is refused draft-changed.',
  save_draft:
    'Save a report as a template’s next draft on Report’s server, as the person whose token this server holds. It runs validate_report first ' +
    'and sends nothing that call would not answer ok: the validator’s errors, a report past MAX_REPORT_BYTES, or a diagnostic error, its ' +
    'own or a declared language’s. Pass from, the { revision, digest } read_draft or the last save_draft answered, to replace that ' +
    'draft; leave it out for a template not yet saved. A save from a draft that is no longer the newest -- somebody saved since -- is ' +
    'refused draft-changed with the revision that stands, and writes nothing: read the draft again and make the change on it. It ' +
    'keeps no image and maps no font, so a report that declares an image the server does not keep is refused asset-not-kept. It ' +
    'saves a draft, which a person reviews and publishes, and never publishes.',
} as const

/**
 * The tools that ask Report's server, registered only where the server is
 * given one: without it, they are not there to be called and refused, and
 * the instructions say why they are missing.
 */
export const SERVER_TOOLS = Object.freeze([
  'whoami',
  'list_templates',
  'read_draft',
  'save_draft',
] as const) satisfies readonly (keyof typeof TOOL_DEFINITIONS)[]

/**
 * The version this server reports, from the manifest and never typed: the
 * one field a client tells two installations apart by. `createRequire`
 * resolves `../package.json` to the package's root from both `src/` and
 * `dist/`; it is the package's own file, read as a module, and no setting.
 */
export const PACKAGE_VERSION: string = (createRequire(import.meta.url)('../package.json') as { version: string }).version

/**
 * What every answer looks like, declared once for every tool: whether
 * there is nothing to fix, one or two sentences a person can read, and the
 * part an agent acts on (formancy.ai 0112).
 */
const RESULT_SHAPE = {
  ok: z
    .boolean()
    .describe(
      'False for a refusal, for a report past MAX_REPORT_BYTES, and for a report validate_report finds the validator or a render would refuse: something to fix before going on. The call is isError for all of these but an edit apply_commands applied, whose report is past MAX_REPORT_BYTES: that edit was made, and its report is the one to edit next.',
    ),
  summary: z.string().describe('One or two sentences a person can read.'),
  data: z.unknown().describe('The part an agent acts on.'),
}

/**
 * Both readings of an answer: the text a model reads, and the structure a
 * client parses without pulling JSON out of a string. The text's JSON has
 * no indentation, since a report is the largest thing in it and a model
 * needs no white space to read it. A refusal is `isError`, an answer to act
 * on, never a thrown error; an edit applied is not, though it is not `ok`
 * (0088, 2026-11-27): MCP's `isError` says the call ended in an error, and
 * a client may fold such an answer's content away.
 */
function respond({ ok, applied, summary, data }: ToolResult): {
  content: { type: 'text'; text: string }[]
  structuredContent: Record<string, unknown>
  isError?: boolean
} {
  return {
    content: [{ type: 'text', text: `${summary}\n\n${JSON.stringify(data)}` }],
    structuredContent: { ok, summary, data },
    ...(ok || applied === true ? {} : { isError: true }),
  }
}

/**
 * Every tool that needs nothing: it changes nothing anywhere and reaches
 * nothing but its arguments -- no server and no network, and no file but its packages'
 * own: the manifest, and for `render_check` the renderer's faces, PDFKit's
 * profile and PDF.js's worker module -- so a host may run it without
 * asking. `apply_commands` among them: it answers a new report and keeps
 * none; and `render_check`, which renders with what the call holds and
 * keeps neither the PDF nor anything read of it.
 */
const LOCAL_CHECK: ToolAnnotations = { readOnlyHint: true, openWorldHint: false }

/** whoami, the list and a draft's read: they reach Report's server, and change nothing there. */
const SERVER_READ: ToolAnnotations = { readOnlyHint: true, openWorldHint: true }

/**
 * save_draft, which writes. Never destructive: every revision a save
 * writes is kept beside the ones before it, and nothing a save does
 * removes one (0049). Not idempotent: a second save from the version the
 * first replaced is refused, and one from the newest writes another.
 */
const SERVER_WRITE: ToolAnnotations = { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true }

/**
 * A report arrives as any JSON value, on purpose: report-spec's validator
 * is the one authority on what a report is, and a schema of the format
 * here would be a second, which one day refuses a report report-spec
 * accepts.
 */
const REPORT = z.unknown().describe('A Formancy Report definition: the whole JSON document, reportSpecVersion and all.')
/** Commands as data, each judged by report-core's registry before it runs; their shapes are describe_commands'. */
const COMMANDS = z.array(z.unknown()).describe('The commands, in order, each { "command": name, "args": [...] } as describe_commands lists them.')
/** The data a render reads, judged by the runtime's data check, the one authority on it. */
const DATA = z
  .unknown()
  .describe(
    'The data, as the runtime reads it: { header: { field: value }, detail: [{ field: value }], completeness: { complete: true, captured: the rows given }, consistency: "host-captured" }, an exact number or a date as a string.',
  )
const PARAMETERS = z.unknown().optional().describe('The value of each parameter, by its id, as a person fills them in; a default applies to one left out.')
const LOCALE = z.string().optional().describe('The language it prints in: the report’s own when absent, or one its translations declare, exactly.')
const TIME_ZONE = z.string().optional().describe('The IANA zone instants print in, as Europe/Zurich: UTC when absent.')
const MODE = z.enum(DATA_MODES).optional().describe('final, which refuses data that lacks a field, unless preview, which prints it and says so on every page.')
const ASSETS = z
  .array(
    z.object({
      asset: z.string().describe('The asset’s id, as the report or the data names it.'),
      digest: z.string().describe('The sha256: digest the report or the data pins it by.'),
      mediaType: z.string().describe('Its media type, as the report declares it: image/png, image/jpeg, image/svg+xml or font/ttf.'),
      base64: z.string().describe('Its bytes, in base64.'),
    }),
  )
  .optional()
  .describe('Every image or font the report or its data names, as bytes: each is held to its digest before anything renders.')
const EXPECTED_HASH = z
  .string()
  .optional()
  .describe(
    'The hash of the report the commands were written against, from validate_report or the last apply_commands. Given, the edit is refused when the report is not that one.',
  )
/** A template, by the id it is kept under; report-server judges it, and report-client puts it in the path as one segment. */
const TEMPLATE = z.string().describe('The template’s id, its report’s id, as list_templates names it.')
/** A draft's version as read_draft and save_draft answer it; drafts.ts holds each part to report-server-core's and report-spec's own tests. */
const FROM = z
  .object({
    revision: z.number().describe('The draft’s revision, as answered.'),
    digest: z.string().describe('The draft’s digest, sha256: and 64 hexadecimal digits, as answered.'),
  })
  .optional()
  .describe('The version of the draft this report replaces, as read_draft or the last save_draft answered it. Leave it out for a template not yet saved.')

/** What a translation's descriptors are made of: a word as the report prints it and its translation, an expression's source and its translation's. */
export interface TranslationOf {
  readonly word: string
  readonly text: string
  readonly source: string
  readonly translation: string
}

/** What the prompt writes where a model puts its own words. */
export const PLACEHOLDERS: TranslationOf = {
  word: '<the word exactly as the report prints it>',
  text: '<its translation>',
  source: '<the expression’s source>',
  translation: '<its translation’s source>',
}

/**
 * The descriptors a translation is applied with, typed by the registry's
 * own descriptor type, so that a command renamed or an argument retyped in
 * report-core does not compile: the language added, a word translated and
 * an expression translated. The prompt prints them with `PLACEHOLDERS`,
 * and `server.test.ts` applies them through the registry.
 */
export function translationSteps(
  language: string,
  { word, text, source, translation }: TranslationOf,
): readonly [StepDescriptor, StepDescriptor, StepDescriptor] {
  return [
    { command: 'addLanguage', args: [language] },
    { command: 'translateWord', args: [language, word, text] },
    { command: 'translateExpression', args: [language, source, { cel: translation }] },
  ]
}

/** The diagnostics the translate prompt names, typed by report-core's codes, and the list of what a person writes, by the verdict's own key. */
const WORD_MISSING = 'word-missing' satisfies DiagnosticCode
const TRANSLATION_DIFFERS = 'translation-differs' satisfies DiagnosticCode
const FOR_PERSON = 'forPerson' satisfies keyof LanguageVerdict

/**
 * What somebody asks an agent to do with a report, each in the order that
 * gets it right the first time, MCP's own answer to a skill pack
 * (formancy.ai 0112). Named for what is being done, never for a tool, and
 * every tool a prompt names in backticks is one this server registers,
 * which `server.test.ts` holds.
 */
export const PROMPTS = {
  write_a_report: {
    title: 'Write a report',
    description:
      'Write a new Formancy Report template from a description, in the order that gets it right the first time: the format, the report, then the checks and a render.',
    args: { description: z.string().min(1).describe('What the report is for, in a sentence or two.') },
    text: (description: string): readonly string[] => [
      `Write a Formancy Report template for: ${description}`,
      '',
      'Work in this order, and do not skip the first step:',
      '',
      '1. Call `describe_format`. It lists the regions, the component kinds, the field and parameter types, what an expression may',
      '   read and as which type, and the traps. A kind or a type that is not listed does not exist, whatever other report writers',
      '   call it, and a decimal is written as a string of its digits, never as a JSON number.',
      '2. Write the report: its datasets and their fields first, then what each region prints.',
      '3. Call `validate_report`. Fix what the validator gives first, by each error’s path; then each diagnostic error, which',
      '   refuses every render; then each language’s. Call it again until it answers ok.',
      '4. For every change after that, call `describe_commands` once, then `apply_commands` with the commands and the hash the',
      '   last answer gave, rather than writing the report again: a command changes only what it names.',
      '5. Call `render_check` with a sample of rows shaped like the real data, a few hundred and never the whole data, and read each',
      '   page’s lines: where a page breaks, what a table prints on which page, and what the runtime refuses of the data in a final',
      '   render. Fix what you see, and check again.',
      '6. Show the person the report, what `validate_report` still warns of and what `render_check` printed, before it is used.',
    ],
  },
  translate_a_report: {
    title: 'Translate a report',
    description: 'Write a report’s words in a language it declares, or one to add, word by word, keyed as the format keys them.',
    args: { language: z.string().min(1).describe('The language, as a BCP 47 tag: fr-CH, it-CH, en-GB.') },
    text: (language: string): readonly string[] => {
      const [add, word, expression] = translationSteps(language, PLACEHOLDERS).map((step) => JSON.stringify(step))
      return [
        `Translate this report into ${language}.`,
        '',
        'A Formancy Report is translated word by word: each word is keyed by its exact text in the report’s own language, and an',
        'expression that prints words by its source. A key of your own is refused. Work this way:',
        '',
        `1. Call \`validate_report\`. If the report declares no translation for ${language}, call \`apply_commands\` with`,
        `   ${String(add)} and the hash it answered.`,
        `2. Read the ${WORD_MISSING} diagnostics listed under ${language}: each is a word or an expression the language lacks, at its path.`,
        `   Leave out every one \`validate_report\` lists in ${FOR_PERSON} for ${language}: it stands in the payment part, which prints on the`,
        '   QR-bill’s slip and is encoded in the code a bank reads, so a person writes it. Never translate it; name each to the person.',
        '3. Call `apply_commands` once, with every translation in one list and the hash the last answer gave: for a word,',
        `   ${String(word)},`,
        `   and for an expression, ${String(expression)}.`,
        `4. Call \`validate_report\` again. A ${TRANSLATION_DIFFERS} error means a translated expression prints another type or reads`,
        `   other members than its source: write it again. Stop when nothing is listed under ${language}.`,
        '5. Show the person the translations before the report is used.',
      ]
    },
  },
} as const

/** What a server is made with. */
export interface ReportMcpOptions {
  /**
   * Report's server, asked through report-client as the person whose token
   * the client sends: given, the four tools that ask it are registered
   * beside the five that need nothing; absent, they are not, and the
   * instructions say why.
   */
  readonly client?: ReportClient
}

/**
 * What a client hands its model before any tool is called: the order the
 * tools are used in, and whether the tools that ask Report's server are
 * there -- and, where they are not, why, by the bin's own settings.
 */
function instructionsFor(client: ReportClient | undefined): string {
  const [last, ...rest] = [...SERVER_TOOLS].reverse()
  const named = `${rest.reverse().join(', ')} and ${String(last)}`
  const [url, token] = Object.keys(SETTINGS)
  const server =
    client === undefined
      ? `The tools that read and save a template’s draft on Report’s server -- ${named} -- are not registered: this server was started without ${String(url)} and ${String(token)}. Set both, Report’s server’s base URL and a secret reference to the person’s token at their host, env:NAME or file:/absolute/path, and start it again; the tools above need neither.`
      : `${named} ask Report’s server as the person whose token this server was given: what save_draft saves is saved as them, and nothing here publishes.`
  return `Formancy Report’s own checks for a report template: call describe_format before writing one, validate_report after every change, and render_check before showing it to anyone. ${server}`
}

/** Formancy Report's MCP server: the tools that need nothing, those that ask Report's server where `options` give one, and the prompts. Connect it to a transport to serve it. */
export function createReportMcpServer(options: ReportMcpOptions = {}): McpServer {
  const { client } = options
  const server = new McpServer({ name: 'formancy-report', version: PACKAGE_VERSION }, { instructions: instructionsFor(client) })

  server.registerTool('describe_format', { description: TOOL_DEFINITIONS.describe_format, outputSchema: RESULT_SHAPE, annotations: LOCAL_CHECK }, () =>
    respond(describeFormat()),
  )
  server.registerTool(
    'validate_report',
    { description: TOOL_DEFINITIONS.validate_report, inputSchema: { report: REPORT }, outputSchema: RESULT_SHAPE, annotations: LOCAL_CHECK },
    ({ report }) => respond(checkReport(report)),
  )
  server.registerTool('describe_commands', { description: TOOL_DEFINITIONS.describe_commands, outputSchema: RESULT_SHAPE, annotations: LOCAL_CHECK }, () =>
    respond(listCommands()),
  )
  server.registerTool(
    'apply_commands',
    {
      description: TOOL_DEFINITIONS.apply_commands,
      inputSchema: { report: REPORT, commands: COMMANDS, expectedHash: EXPECTED_HASH },
      outputSchema: RESULT_SHAPE,
      annotations: LOCAL_CHECK,
    },
    ({ report, commands, expectedHash }) => respond(applyCommands(report, commands, expectedHash)),
  )
  server.registerTool(
    'render_check',
    {
      description: TOOL_DEFINITIONS.render_check,
      inputSchema: { report: REPORT, data: DATA, parameters: PARAMETERS, locale: LOCALE, timeZone: TIME_ZONE, mode: MODE, assets: ASSETS },
      outputSchema: RESULT_SHAPE,
      annotations: LOCAL_CHECK,
    },
    async ({ report, data, parameters, locale, timeZone, mode, assets }, { signal }) =>
      respond(await renderCheck({ report, data, parameters, locale, timeZone, mode, assets }, signal)),
  )
  if (client !== undefined) registerServerTools(server, client)

  const { write_a_report: write, translate_a_report: translate } = PROMPTS
  server.registerPrompt('write_a_report', { title: write.title, description: write.description, argsSchema: write.args }, ({ description }) =>
    asked(write.text(description)),
  )
  server.registerPrompt('translate_a_report', { title: translate.title, description: translate.description, argsSchema: translate.args }, ({ language }) =>
    asked(translate.text(language)),
  )

  return server
}

/** The four tools that ask Report's server through `client`, each with its arguments, the envelope and what it says it changes and reaches. */
function registerServerTools(server: McpServer, client: ReportClient): void {
  server.registerTool('whoami', { description: TOOL_DEFINITIONS.whoami, outputSchema: RESULT_SHAPE, annotations: SERVER_READ }, async () =>
    respond(await whoAmI(client)),
  )
  server.registerTool('list_templates', { description: TOOL_DEFINITIONS.list_templates, outputSchema: RESULT_SHAPE, annotations: SERVER_READ }, async () =>
    respond(await listTemplates(client)),
  )
  server.registerTool(
    'read_draft',
    { description: TOOL_DEFINITIONS.read_draft, inputSchema: { template: TEMPLATE }, outputSchema: RESULT_SHAPE, annotations: SERVER_READ },
    async ({ template }) => respond(await readDraft(client, template)),
  )
  server.registerTool(
    'save_draft',
    {
      description: TOOL_DEFINITIONS.save_draft,
      inputSchema: { template: TEMPLATE, report: REPORT, from: FROM },
      outputSchema: RESULT_SHAPE,
      annotations: SERVER_WRITE,
    },
    async ({ template, report, from }) => respond(await saveDraft(client, template, report, from)),
  )
}

/** A prompt's lines as the one message a person sends. */
const asked = (lines: readonly string[]) => ({ messages: [{ role: 'user' as const, content: { type: 'text' as const, text: lines.join('\n') } }] })
