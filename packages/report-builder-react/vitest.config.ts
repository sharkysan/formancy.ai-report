import { defineConfig } from 'vitest/config'
import { coverage } from '../../vitest.coverage'
import { reporters } from '../../vitest.results'

export default defineConfig({
  test: {
    reporters,
    // The repository's policy, with this package's components counted: the
    // shared list names `.ts` files, and a builder is mostly `.tsx`.
    coverage: {
      ...coverage,
      include: ['src/**/*.{ts,tsx}'],
      exclude: [...(coverage.exclude ?? []), 'src/**/*.test.tsx'],
    },
    include: ['src/**/*.test.{ts,tsx}'],
    // The builder renders into a DOM: jsdom's, which has no layout, so a
    // test measures nothing in pixels and audits nothing a browser computes.
    environment: 'jsdom',
    // Catching a hang, not policing speed. Measured on 2026-10-15 on a
    // Windows 11 workstation: the slowest scenario, axe included, took
    // 774 ms. formancy.ai saw jsdom suites like this run nine to fourteen
    // times slower on a loaded CI runner (its vitest.coverage.ts, on
    // RENDER_TIMEOUT_MS), which would cross vitest's 5 s default for no
    // fault of the test; 20 s is that factor on this measurement, rounded up.
    testTimeout: 20_000,
  },
})
