import { defineConfig, mergeConfig } from 'vitest/config'
import { coverage } from '../../vitest.coverage'
import { reporters } from '../../vitest.results'
import app from './vite.config.ts'

/**
 * The suite renders the whole site from its source, with the inputs the
 * prerender reads (scripts/inputs.mjs), and reads the HTML back with the
 * DOM jsdom gives it, as a crawler reads it: without running a script.
 */
export default mergeConfig(
  app,
  defineConfig({
    test: {
      reporters,
      coverage: {
        ...coverage,
        // `.tsx` counts, and so do the scripts that read the build's inputs
        // and write its files. render.tsx is the barrel the shared policy
        // excludes as `index.ts`, the renderer's entry that only re-exports;
        // prerender.mjs is the composition root it excludes as `main.ts`: it
        // reads the inputs, runs the compiled renderer and hands the site to
        // write-site.mjs. The `test-` files are the suite's own support,
        // which is test code, as the Studio counts it.
        include: ['src/**/*.{ts,tsx}', 'scripts/**/*.mjs'],
        exclude: ['src/**/*.test.{ts,tsx}', 'scripts/**/*.test.mjs', 'src/**/*.d.ts', 'src/test-*.ts', 'src/render.tsx', 'scripts/prerender.mjs'],
      },
      include: ['src/**/*.test.{ts,tsx}', 'scripts/**/*.test.mjs'],
      environment: 'jsdom',
    },
  }),
)
