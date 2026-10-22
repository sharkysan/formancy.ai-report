import { defineConfig } from 'vitest/config'
import { coverage } from '../../vitest.coverage'
import { reporters } from '../../vitest.results'

export default defineConfig({
  test: {
    reporters,
    coverage,
    include: ['src/**/*.test.ts'],
    // vitest hands a test an empty string for any stylesheet it is not told
    // to process -- a `?raw` import included -- so the stylesheet's own test
    // would pass on nothing. The entry and its parts are read as written.
    css: { include: [/report-builder\.css/, /[\\/]styles[\\/][\w-]+\.css/] },
  },
})
