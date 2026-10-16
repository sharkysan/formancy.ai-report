import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, test } from 'vitest'
import { coveredPackages } from '../codecov-config.mjs'
import { gateJobs, readWorkflow } from '../workflows.mjs'
import { evaluateGates, gatesProblems, readGates } from './gates.mjs'

/**
 * The release gates' register (0014; formancy.ai-data 0035),
 * docs/release/gates.json: held to the repository -- every file a test of a
 * package with a suite or of the repository's guards, every job one gates.yml
 * runs, every document committed -- and the evaluator that says where a run
 * leaves each gate, which never calls a document passed, and never a gate
 * with a reason anything but open.
 */
const repo = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

const here = {
  covered: coveredPackages(repo).map((entry) => entry.path),
  jobs: gateJobs(readWorkflow(repo)),
  exists: (path) => existsSync(join(repo, path)),
}

/** The real register with `change` applied to a copy, validated against this repository. */
function problemsWith(change) {
  const register = structuredClone(readGates(repo))
  change(register.gates)
  return gatesProblems(register, here)
}

const gate = (gates, id) => gates.find((entry) => entry.gate === id)

describe('docs/release/gates.json', () => {
  // A validator that only ever saw fixtures proves nothing about the
  // committed file, and the report fails a run whose register does not hold.
  test('holds against this repository', () => {
    expect(gatesProblems(readGates(repo), here)).toEqual([])
  })

  // The 0.1.0 gates rest on what this repository can run; the rest wait,
  // each for a reason, and the cross-framework test is the Studio's. Read
  // from the committed register, so a gate closed by an edit here, or given
  // evidence it does not have, changes this test with it.
  test('rests G1, G2 and G3 on evidence, and keeps G3, G4 to G7 and the legal review open', () => {
    const gates = readGates(repo).gates
    expect(gates.filter((entry) => entry.evidence !== undefined).map((entry) => entry.gate)).toEqual(['G1', 'G2', 'G3'])
    expect(gates.filter((entry) => entry.open !== undefined).map((entry) => entry.gate)).toEqual(['G3', 'G4', 'G5', 'G6', 'G7', 'legal'])
    expect(gate(gates, 'G1').evidence).toEqual(expect.arrayContaining([{ job: 'install' }, { file: 'scripts/upstream-deps.test.mjs' }, { file: 'scripts/dependency-licences.test.mjs' }]))
  })

  // The plan has G1 to G7 and a legal review; a gate dropped from the
  // register is one the report never shows as open, stated or passed.
  test('fails without one of the gates, or with them out of order', () => {
    expect(problemsWith((gates) => gates.splice(4, 1))).toEqual(['the gates are G1, G2, G3, G4, G6, G7, legal, where the plan has G1, G2, G3, G4, G5, G6, G7 and legal, each once and in order'])
    expect(problemsWith((gates) => gates.reverse())[0]).toMatch(/^the gates are legal, G7, /)
  })

  // A gate with nothing to say is one the report cannot place; an empty
  // list of evidence reads as evidence that passed.
  test('fails a gate with neither evidence nor a reason, and an empty list of evidence', () => {
    expect(problemsWith((gates) => delete gate(gates, 'G7').open)).toEqual(['gate G7 has neither evidence nor a reason it is open; it needs one or both'])
    expect(problemsWith((gates) => (gate(gates, 'G6').evidence = []))).toEqual(['gate G6 has an empty list of evidence; leave it out instead'])
  })

  // A file renamed, or one outside a package with a suite and the guards,
  // would be evidence no run can ever pass -- or one that never runs at all.
  test('fails file evidence that is not a test a run reports on', () => {
    const renamed = (gates) => (gate(gates, 'G2').evidence = gate(gates, 'G2').evidence.map((item) => (item.file === 'packages/report-render-pdf/src/corpus.test.ts' ? { file: 'packages/report-render-pdf/src/corpse.test.ts' } : item)))
    expect(problemsWith(renamed)).toEqual(["gate G2's evidence: packages/report-render-pdf/src/corpse.test.ts is not a test file of a package with a suite or of the repository's guards"])
    expect(problemsWith((gates) => gate(gates, 'G2').evidence.push({ file: 'packages/report-render-pdf/src/node.ts' }))).toEqual([
      "gate G2's evidence: packages/report-render-pdf/src/node.ts is not a test file of a package with a suite or of the repository's guards",
    ])
  })

  // Each other kind names something a run can produce, or a committed file.
  test('fails a job or a document that is not there, and an unknown kind', () => {
    expect(problemsWith((gates) => gate(gates, 'G1').evidence.push({ job: 'report' }))).toEqual(["gate G1's evidence: report is not a job of .github/workflows/gates.yml that leaves results"])
    expect(problemsWith((gates) => gate(gates, 'G2').evidence.push({ document: 'docs/release/figures.md' }))).toEqual(["gate G2's evidence: docs/release/figures.md is not a committed file"])
    expect(problemsWith((gates) => gate(gates, 'G2').evidence.push({ file: 'a.test.ts', job: 'verify' }))).toEqual([`gate G2's evidence: {"file":"a.test.ts","job":"verify"} is not exactly one of file, job, document`])
  })

  // The plan is a working document kept out of the repository; a gate's
  // wording copied into the register would publish it.
  test('carries no gate’s wording', () => {
    expect(problemsWith((gates) => (gate(gates, 'G1').says = 'Real package-consumer builds.'))).toEqual([
      "gate G1 carries \"says\", and a gate carries only its id, its evidence and why it is open: the plan's wording stays out of the repository",
    ])
  })
})

describe('evaluateGates', () => {
  const run = (overrides = {}) => ({ fileOutcome: () => 'passed', needs: { install: { result: 'success' } }, documents: {}, ...overrides })
  const history = { sha: 'abcdef1234567890abcdef1234567890abcdef12', date: '2026-10-14T10:00:00Z', behind: 4 }

  // A document from another commit read as "passed in this run" would be a
  // claim the run never checked, reported as if it had.
  test('gives a gate whose only evidence is a document the state stated, never passed', () => {
    const [stated] = evaluateGates({ gates: [{ gate: 'G2', evidence: [{ document: 'docs/renderer-trial.md' }] }] }, run({ documents: { 'docs/renderer-trial.md': history } }))
    expect(stated).toEqual({ gate: 'G2', state: 'stated', evidence: [{ kind: 'document', value: 'docs/renderer-trial.md', outcome: 'stated', history }] })
  })

  // Evidence that ran and passed passes the gate; one item that did not
  // fails it, and a document beside them neither helps nor hurts.
  test('passes a gate only when every item that runs passed', () => {
    const register = { gates: [{ gate: 'G1', evidence: [{ job: 'install' }, { document: 'docs/renderer-trial.md' }] }, { gate: 'G2', evidence: [{ file: 'a.test.ts' }] }] }
    expect(evaluateGates(register, run()).map((entry) => entry.state)).toEqual(['passed', 'passed'])
    expect(evaluateGates(register, run({ needs: { install: { result: 'failure' } } }))[0].evidence[0]).toEqual({ kind: 'job', value: 'install', outcome: 'failed', result: 'failure' })
    expect(evaluateGates(register, run({ fileOutcome: () => 'absent' }))[1]).toMatchObject({ state: 'failed', evidence: [{ kind: 'file', value: 'a.test.ts', outcome: 'absent' }] })
  })

  // Locally there are no needs: a job's evidence did not run, which is not a pass.
  test('leaves a job unpassed where there are no needs', () => {
    const [g1] = evaluateGates({ gates: [{ gate: 'G1', evidence: [{ job: 'install' }] }] }, run({ needs: null }))
    expect(g1).toMatchObject({ state: 'failed', evidence: [{ outcome: 'absent', local: true }] })
  })

  // A gate with a reason is open, whatever its evidence: G3's scenarios
  // passing in each framework is not the Studio's cross-framework test. And
  // the evidence it has still has to pass, or a partly evidenced gate would
  // hide a failure behind its reason.
  test('keeps a gate with a reason open, and fails it when the evidence it has did not pass', () => {
    const register = { gates: [{ gate: 'G3', evidence: [{ file: 'a.test.ts' }], open: 'The Studio’s test.' }, { gate: 'G4', open: 'Later.' }] }
    expect(evaluateGates(register, run())).toEqual([
      { gate: 'G3', state: 'open', open: 'The Studio’s test.', evidence: [{ kind: 'file', value: 'a.test.ts', outcome: 'passed' }] },
      { gate: 'G4', state: 'open', open: 'Later.', evidence: [] },
    ])
    expect(evaluateGates(register, run({ fileOutcome: () => 'failed' }))[0].state).toBe('failed')
  })
})
