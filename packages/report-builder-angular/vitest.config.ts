import { fileURLToPath } from 'node:url'
import angular from '@analogjs/vite-plugin-angular'
import { defineConfig } from 'vitest/config'
import { coverage } from '../../vitest.coverage'
import { reporters } from '../../vitest.results'

export default defineConfig({
  plugins: [
    angular({
      // Absolute, because the plugin otherwise guesses tsconfig.spec.json
      // relative to a root that shifts between vite, vitest and turbo.
      tsconfig: fileURLToPath(new URL('./tsconfig.spec.json', import.meta.url)),
    }),
  ],
  test: {
    reporters,
    coverage,
    include: ['src/**/*.test.ts'],
    environment: 'jsdom',
    /*
     * A timeout catches a hang; it does not time anything. The first builder
     * a file mounts compiles every component it holds, and in a full parallel
     * run on a Windows laptop on 15 October 2026 the slowest such test took
     * 1.6 s. formancy.ai saw the same kind of test run fourteen times slower
     * on a loaded CI runner than locally, and moved its suites that mount
     * real trees to 20 s (its vitest.coverage.ts, RENDER_TIMEOUT_MS); 1.6 s
     * fourteen times over is past that, so 30 s. The one test that selects
     * every row of a large report sets its own.
     */
    testTimeout: 30_000,
    setupFiles: ['src/test-setup.ts'],
  },
})
