import { defineConfig, mergeConfig } from 'vitest/config'
import { coverage } from '../../vitest.coverage'
import { reporters } from '../../vitest.results'
import app from './vite.config.ts'

/**
 * The suite runs through the same plugins the build does, merged rather than
 * restated, as formancy.ai-data's apps do and for their reason: a test copy
 * without the Angular plugin fails every file that mounts Angular with
 * "needs to be compiled using the JIT compiler".
 */
export default mergeConfig(
  app,
  defineConfig({
    test: {
      reporters,
      coverage: {
        ...coverage,
        // `.tsx` counts. `main.tsx` is the composition root the shared
        // policy excludes as `main.ts`; the `test-` files are the suite's own
        // support, which is test code.
        include: ['src/**/*.{ts,tsx}'],
        exclude: ['src/**/*.test.{ts,tsx}', 'src/**/*.d.ts', 'src/main.tsx', 'src/test-*.{ts,tsx}'],
      },
      include: ['src/**/*.test.{ts,tsx}'],
      environment: 'jsdom',
      setupFiles: ['src/test-setup.ts'],
      // A timeout catches a hang; it does not time anything. The journey
      // walks every starter in both builders, prints each preview and final
      // render through the real pipeline, and runs axe twice at each of its
      // states. Measured on 2026-10-18 on a Windows 11 workstation
      // (i9-10900K), under coverage with the rest of the suite beside it,
      // once the Preview stood in the design view's place (0029) -- printed
      // again by each builder it is shown in, and the design view walked for
      // each starter: the journey took 47.3 s, its walk again with requests
      // recorded 27.6 s, and plan 21's switch 6.7 s, against vitest's 5 s
      // default (on 2026-10-16, before it: 22.2 s, 7.4 s and 4.0 s). 120 s
      // is the journey two and a half times over. formancy.ai saw suites like
      // this run nine to fourteen times slower on a loaded CI runner (its
      // vitest.coverage.ts, on RENDER_TIMEOUT_MS); a runner that slow fails
      // the journey here, and is the measurement to raise it by.
      testTimeout: 120_000,
    },
  }),
)
