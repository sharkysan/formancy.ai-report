import { configDefaults, defineConfig } from 'vitest/config'
import { reporters } from './vitest.results'

/**
 * The repository's own guards: checks on the files that describe the repository
 * rather than on a package. codecov.yml matches its generator, every CLA
 * signature names the current text, upstream dependencies are exact releases,
 * and no source file is past the size budget CLAUDE.md sets.
 *
 * Run as `pnpm test:repo`, and by CI on every pull request. A guard that is not
 * a gate is a comment.
 *
 * Two groups, the second run once the first has finished: every guard, then
 * the samples' (scripts/samples.test.mjs, 0079), which renders every starter
 * and, run beside the others, took the CPU two of them need: on one 20-thread
 * Windows machine on 22 November 2026, the slowest cases of
 * dependency-licences.test.mjs and lint.test.mjs, about 2 s each alone, passed
 * the 5 s timeout in two full runs of three, and never in runs without it.
 */
const SAMPLES = 'scripts/samples.test.mjs'

export default defineConfig({
  test: {
    reporters,
    projects: [
      { test: { name: 'guards', include: ['scripts/**/*.test.mjs'], exclude: [...configDefaults.exclude, SAMPLES], sequence: { groupOrder: 0 } } },
      { test: { name: 'samples', include: [SAMPLES], sequence: { groupOrder: 1 } } },
    ],
  },
})
