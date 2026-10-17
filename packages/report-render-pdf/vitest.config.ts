import { defineConfig } from 'vitest/config'
import { coverage } from '../../vitest.coverage'
import { reporters } from '../../vitest.results'
import { fontAsBase64 } from './font-plugin.ts'

export default defineConfig({
  // The slip's font files as base64, as the build reads them.
  plugins: [fontAsBase64],
  test: {
    reporters,
    coverage,
    include: ['src/**/*.test.ts'],
  },
})
