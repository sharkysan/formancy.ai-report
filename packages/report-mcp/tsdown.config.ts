import { defineConfig } from 'tsdown'

export default defineConfig({
  // `main.ts` is the bin a client launches; its shebang is kept, and npm
  // makes the file it names executable when it installs the package.
  entry: ['src/index.ts', 'src/main.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  // Nothing from node_modules is inlined (formancy.ai-data 0046): tsdown
  // inlines a package this one imports at run time without declaring it, and
  // the dist -- and an app's bundle or a tarball made from it -- would carry
  // that code as this repository's own, under its licence. With this list
  // empty, such a build fails instead, naming the package.
  deps: { onlyBundle: [] },
})
