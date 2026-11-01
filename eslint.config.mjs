import { eslintConfig } from '@formancy/code-style'

/**
 * The repository's lint rules: the four formancy repositories' shared ones,
 * `@formancy/code-style`, which formancy.ai publishes and this repository
 * pins exactly (0050), given Formancy Report's paths. `scripts/lint.test.mjs`
 * holds what is passed here.
 */
export default eslintConfig({
  root: import.meta.dirname,
  // The tsconfigs `pnpm typecheck` runs, by glob, so that a new package or
  // app is linted with types without an edit here. A package whose tests
  // are a program of their own, beside its source's, runs it as
  // tsconfig.test.json, as report-client does. The Angular builder's specs and the Studio's Angular plugin have
  // a tsconfig of their own that `typecheck` does not run, and no file of
  // theirs is in them alone; tsconfig.tools.json brings the vitest, Vite
  // and tsdown configs into the typecheck, with the renderer's font plugin,
  // which its build and its tests import, and its script that draws the
  // README's pictures.
  project: ['./packages/*/tsconfig.json', './packages/*/tsconfig.test.json', './apps/*/tsconfig.json', './tsconfig.tools.json'],
  ignoreFiles: ['.gitignore'],
  tests: ['**/*.{test,spec}.{ts,tsx,mts,cts,js,mjs}'],
  // The install fixtures import the packed tarballs, which the workspace
  // does not resolve; the install gate type-checks them, in the consumer
  // project that has them.
  untyped: ['scripts/install-fixture/**'],
  // The scripts that drive Playwright: the Studio's browser gates and
  // pictures, and the README pictures' shared steps.
  browser: ['apps/studio/scripts/**', 'scripts/pictures/**'],
  react: ['packages/report-builder-react/**/*.{ts,tsx}', 'apps/pages/**/*.{ts,tsx}', 'apps/studio/**/*.{ts,tsx}'],
})
