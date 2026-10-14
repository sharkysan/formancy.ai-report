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
 * The JSON is what a release report reads once there is one -- formancy.ai-data
 * 0035's shape, which arrives here with packaging. Until then nothing reads
 * it, and it is written anyway so that a run already leaves what the report
 * will need.
 */
export const reporters: NonNullable<NonNullable<ViteUserConfig['test']>['reporters']> = [
  ...configDefaults.reporters,
  ['json', { outputFile: 'test-results/vitest.json' }],
]
