import { defineConfig } from 'tsdown'

export default defineConfig([
  {
    entry: ['src/index.ts'],
    format: ['esm'],
    dts: true,
    clean: true,
    // The host-font test data (Liberation Serif and Mono 2.1.5, OFL-1.1) beside the built index, so a consumer of the built corpus reads the fonts the fixture names; the corpus is never published (0043).
    copy: [{ from: 'src/fixtures/host-fonts', to: 'dist' }],
    // Nothing from node_modules is inlined (formancy.ai-data 0046): tsdown
    // inlines a package this one imports at run time without declaring it, and
    // the dist -- and an app's bundle or a tarball made from it -- would carry
    // that code as this repository's own, under its licence. With this list
    // empty, such a build fails instead, naming the package.
    deps: { onlyBundle: [] },
  },
  {
    // The renderer trial's command, `node dist/trial/run.mjs --date
    // YYYY-MM-DD`, built because Node cannot run it from source: its imports
    // name the `.js` files the compiler emits, and type stripping does not map
    // them to `.ts`. A build of its own, so that the package's entry above is
    // built exactly as before, and no export names it. It imports the engines,
    // which are devDependencies, and runs where it was built, so every package
    // stays an import and none is inlined, for 0046's reason.
    entry: { 'trial/run': 'src/trial/run.ts' },
    format: ['esm'],
    dts: false,
    clean: true,
    deps: { neverBundle: true },
  },
])
