import type { ViteUserConfig } from 'vitest/config'
import { configDefaults } from 'vitest/config'

/**
 * vitest's own reporters, GitHub's annotations included, plus a JSON copy of
 * each run in `test-results/`, which turbo never caches.
 *
 * Spread from `configDefaults` rather than named: a `reporters` list replaces
 * vitest's, and naming `default` here would drop the `github-actions`
 * reporter vitest adds on CI, and with it every failure's annotation on the
 * pull request.
 *
 * The JSON is what the release report reads (0014;
 * scripts/release-report/collect.mjs): each file's and each test's status
 * and times. Written to `test-results/`, which turbo never caches, so a
 * report never reads an earlier run's results replayed as this one's. A
 * test's `meta` is written as vitest writes it and left out when collected:
 * nothing here declares shared cases, as formancy.ai-data's adapters do, so
 * nothing reads it.
 */
export const reporters: NonNullable<NonNullable<ViteUserConfig['test']>['reporters']> = [
  ...configDefaults.reporters,
  ['json', { outputFile: 'test-results/vitest.json' }],
]
