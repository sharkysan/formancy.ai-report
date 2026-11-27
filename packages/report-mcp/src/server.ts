/**
 * The tools and the prompts, wired to the Model Context Protocol (0088).
 *
 * Thin on purpose, as formancy's (formancy.ai 0056): every tool is a call
 * into `tools.ts` and the answer put in the protocol's shape. What a tool
 * decides is tested without a transport; what is tested here is that it
 * is reachable, under its name, with its arguments.
 */
import { createRequire } from 'node:module'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { ToolAnnotations } from '@modelcontextprotocol/sdk/types.js'
import type { DiagnosticCode, StepDescriptor } from '@formancy/report-core'
import { z } from 'zod'
import { applyCommands, checkReport, describeFormat, listCommands } from './tools.js'
import type { ToolResult } from './tools.js'

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
    'there, and that it maps no font. Call it after every change you write by hand, and before you show a report to anyone.',
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
} as const

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
      'False for a refusal, for a report past MAX_REPORT_BYTES, and for a report validate_report finds the validator or a render would refuse: something to fix before going on.',
    ),
  summary: z.string().describe('One or two sentences a person can read.'),
  data: z.unknown().describe('The part an agent acts on.'),
}

/**
 * Both readings of an answer: the text a model reads, and the structure a
 * client parses without pulling JSON out of a string. The text's JSON has
 * no indentation, since a report is the largest thing in it and a model
 * needs no white space to read it. A refusal is `isError`, an answer to act
 * on, never a thrown error.
 */
function respond({ ok, summary, data }: ToolResult): {
  content: { type: 'text'; text: string }[]
  structuredContent: Record<string, unknown>
  isError?: boolean
} {
  return {
    content: [{ type: 'text', text: `${summary}\n\n${JSON.stringify(data)}` }],
    structuredContent: { ok, summary, data },
    ...(ok ? {} : { isError: true }),
  }
}

/**
 * Every tool here: it changes nothing anywhere and reaches nothing but its
 * arguments -- no server, no file, no network -- so a host may run it
 * without asking. `apply_commands` among them: it answers a new report and
 * keeps none.
 */
const LOCAL_CHECK: ToolAnnotations = { readOnlyHint: true, openWorldHint: false }

/**
 * A report arrives as any JSON value, on purpose: report-spec's validator
 * is the one authority on what a report is, and a schema of the format
 * here would be a second, which one day refuses a report report-spec
 * accepts.
 */
const REPORT = z.unknown().describe('A Formancy Report definition: the whole JSON document, reportSpecVersion and all.')
/** Commands as data, each judged by report-core's registry before it runs; their shapes are describe_commands'. */
const COMMANDS = z.array(z.unknown()).describe('The commands, in order, each { "command": name, "args": [...] } as describe_commands lists them.')
const EXPECTED_HASH = z
  .string()
  .optional()
  .describe(
    'The hash of the report the commands were written against, from validate_report or the last apply_commands. Given, the edit is refused when the report is not that one.',
  )

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

/** The diagnostics the translate prompt names, typed by report-core's codes. */
const WORD_MISSING = 'word-missing' satisfies DiagnosticCode
const TRANSLATION_DIFFERS = 'translation-differs' satisfies DiagnosticCode

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
      'Write a new Formancy Report template from a description, in the order that gets it right the first time: the format, the report, then the checks.',
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
      '5. Show the person the report, and what `validate_report` still warns of, before it is used.',
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

/** Formancy Report's MCP server: the tools that need nothing, and the prompts. Connect it to a transport to serve it. */
export function createReportMcpServer(): McpServer {
  const server = new McpServer({ name: 'formancy-report', version: PACKAGE_VERSION })

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

  const { write_a_report: write, translate_a_report: translate } = PROMPTS
  server.registerPrompt('write_a_report', { title: write.title, description: write.description, argsSchema: write.args }, ({ description }) =>
    asked(write.text(description)),
  )
  server.registerPrompt('translate_a_report', { title: translate.title, description: translate.description, argsSchema: translate.args }, ({ language }) =>
    asked(translate.text(language)),
  )

  return server
}

/** A prompt's lines as the one message a person sends. */
const asked = (lines: readonly string[]) => ({ messages: [{ role: 'user' as const, content: { type: 'text' as const, text: lines.join('\n') } }] })
