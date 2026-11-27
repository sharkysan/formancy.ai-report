/**
 * What an agent is told about the format and the commands, held to the
 * constants it is read from (0088).
 *
 * The lists are the format's own constants, the very objects, so that a
 * component kind, a region or a command added to the package reaches what
 * an agent is told with nothing typed twice; a list copied into the facts
 * would describe the format one release behind the one it is about.
 */
import {
  AGGREGATE_FUNCTIONS,
  COMPONENT_KINDS,
  DATASET_ROLES,
  emptyReport,
  EXPRESSION_NAMES,
  FIELD_TYPES,
  FONT_FAMILIES,
  FORMAT_KINDS,
  INLINE_KINDS,
  MAX_REPORT_BYTES,
  MAX_TABLES,
  OPTIONAL_REGIONS,
  PAGE_SIZE_NAMES,
  PARAMETER_TYPES,
  REGION_NAMES,
  REPORT_FORMAT,
  REPORT_SPEC_VERSION,
  ROUNDING_MODES,
} from '@formancy/report-spec'
import * as spec from '@formancy/report-spec'
import { describe, expect, test } from 'vitest'
import { ARGUMENTS, COMMANDS, describeCommands, describedCommand, MAX_BATCH_COMMANDS, PART_COMMANDS } from './commands/registry.js'
import type { CommandDescriptor } from './commands/registry.js'
import { DIAGNOSTIC_SEVERITIES } from './diagnostics/codes.js'
import { EXPRESSION_TYPES, SCOPE_NAMES } from './expressions/members.js'
import { reportFacts } from './facts.js'
import * as core from './index.js'
import { REFUSAL_CODES } from './outcome.js'

describe('reportFacts', () => {
  // A list typed into the facts would stay as it was when a kind, a region
  // or a type is added; the constant itself cannot.
  test('lists the format by its own constants, the very objects', () => {
    const facts = reportFacts()
    expect(facts.format).toBe(REPORT_FORMAT)
    expect(facts.reportSpecVersion).toBe(REPORT_SPEC_VERSION)
    expect(facts.regions).toBe(REGION_NAMES)
    expect(facts.optionalRegions).toBe(OPTIONAL_REGIONS)
    expect(facts.componentKinds).toBe(COMPONENT_KINDS)
    expect(facts.inlineKinds).toBe(INLINE_KINDS)
    expect(facts.datasetRoles).toBe(DATASET_ROLES)
    expect(facts.fieldTypes).toBe(FIELD_TYPES)
    expect(facts.parameterTypes).toBe(PARAMETER_TYPES)
    expect(facts.aggregateFunctions).toBe(AGGREGATE_FUNCTIONS)
    expect(facts.roundingModes).toBe(ROUNDING_MODES)
    expect(facts.formatKinds).toBe(FORMAT_KINDS)
    expect(facts.pageSizes).toBe(PAGE_SIZE_NAMES)
    expect(facts.fontFamilies).toBe(FONT_FAMILIES)
  })

  // What an expression may read, and the CEL type each field is read as,
  // are the compiler's: told anything else, an agent writes `row.amount`
  // where only `header` is bound, or compares a decimal with an integer.
  test('says what an expression reads by the compiler’s own tables', () => {
    const facts = reportFacts()
    expect(facts.scopes).toBe(SCOPE_NAMES)
    expect(facts.namesByScope).toBe(EXPRESSION_NAMES)
    expect(facts.expressionTypes).toBe(EXPRESSION_TYPES)
    expect(facts.diagnostics).toBe(DIAGNOSTIC_SEVERITIES)
  })

  // A bound typed as a number would stay where it was when the limit moved;
  // each is read from report-spec's constant of the name it is given, so a
  // bound renamed or moved there fails here.
  test('gives each bound the value of report-spec’s constant of its name', () => {
    const { bounds } = reportFacts()
    expect(Object.keys(bounds).length).toBeGreaterThan(5)
    expect(bounds.MAX_REPORT_BYTES).toBe(MAX_REPORT_BYTES)
    expect(bounds.MAX_TABLES).toBe(MAX_TABLES)
    for (const [name, value] of Object.entries(bounds)) expect(value, name).toBe((spec as Readonly<Record<string, unknown>>)[name])
  })

  // The notes are what costs a model a turn; one that named a number
  // another release changed would tell it the old one.
  test('writes the numbers its notes name from the constants', () => {
    const notes = reportFacts().notes.join('\n')
    expect(notes).toContain(`at most ${String(MAX_TABLES)} tables`)
    expect(notes).toContain(`"${REPORT_SPEC_VERSION}"`)
    for (const note of reportFacts().notes) expect(note.endsWith('.'), note).toBe(true)
  })

  // An agent that got the report-core package's facts by its index would
  // otherwise find them in its source alone.
  test('is exported from the package', () => {
    expect(core.reportFacts).toBe(reportFacts)
    expect(core.describeCommands).toBe(describeCommands)
  })
})

describe('describeCommands', () => {
  // Told a command the registry does not have, an agent's batch is refused
  // `unknown-command`; left one out, it never uses it.
  test('lists every command of the registry, in its order, each with its arguments in the registry’s words', () => {
    const { commands } = describeCommands()
    expect(commands.map(({ command }) => command)).toEqual(Object.keys(COMMANDS))
    for (const { command, args } of commands) expect(args, command).toHaveLength(ARGUMENTS[command].length)
    expect(commands.find(({ command }) => command === 'setTitle')?.args).toEqual(['a string'])
    expect(commands.find(({ command }) => command === 'translateWord')?.args).toEqual(['a string', 'a string', 'a string, or null to remove it'])
    expect(commands.find(({ command }) => command === 'removePaymentPart')?.args).toEqual([])
  })

  // The words are the ones a refusal of the same arguments says, so what
  // an agent is told and what it is refused with never disagree.
  test('says each argument in the words `invalid-arguments` refuses it in', () => {
    const report = emptyReport('facts', 'Facts', 'en-GB')
    for (const { command, args } of describeCommands().commands) {
      const refusal = describedCommand({ command, args: [...args, 'one too many'] } as unknown as CommandDescriptor)(report)
      expect(refusal, command).toMatchObject({ ok: false, code: 'invalid-arguments' })
      if (!refusal.ok) expect(refusal.message, command).toContain(args.join('; '))
    }
  })

  // The batch's bound, the parts' commands and the refusal codes are the
  // registry's and the outcome's own, so a bound raised there is the bound
  // an agent is told.
  test('gives the batch’s bound, the parts’ commands and the refusal codes as the registry holds them', () => {
    const described = describeCommands()
    expect(described.maxBatchCommands).toBe(MAX_BATCH_COMMANDS)
    expect(described.partCommands).toBe(PART_COMMANDS)
    expect(described.refusalCodes).toBe(REFUSAL_CODES)
  })
})
