// The workflows as the guards read them, parsed with `yaml`.
//
// `.github/workflows/gates.yml` is the one list of what a run does: ci.yml
// and release.yml both call it. So the packages the `test` job runs are read
// from it and never typed a second time anywhere. formancy.ai-data's
// release-report/workflows.mjs, without the report's results keys, which
// arrive here with the report.

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import YAML from 'yaml'

const repo = join(dirname(fileURLToPath(import.meta.url)), '..')

export const GATES_WORKFLOW = '.github/workflows/gates.yml'

/** A workflow under .github/workflows, parsed. */
export function readWorkflow(root = repo, file = GATES_WORKFLOW) {
  return YAML.parse(readFileSync(join(root, file), 'utf8'))
}

/** The packages the `test` job's matrix runs, by npm name. */
export function testMatrix(workflow) {
  const values = workflow?.jobs?.test?.strategy?.matrix?.package
  if (!Array.isArray(values)) throw new Error(`${GATES_WORKFLOW} has no test job whose matrix lists packages`)
  return values.map(String)
}
