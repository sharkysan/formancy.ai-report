/*
 * What a bundler's client types say of a stylesheet a module imports for its
 * effect -- Vite's `vite/client` says the same -- so that the guide's React
 * entry, which imports the workbench's and the builder's stylesheets, is
 * checked as a page's code is. TypeScript 6 checks that a side-effect import
 * resolves, and a .css file is no module it can resolve; esbuild, which
 * bundles the entry, resolves the file itself, through each package's
 * `exports` map.
 */
declare module '*.css'
