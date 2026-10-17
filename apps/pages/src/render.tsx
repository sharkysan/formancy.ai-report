/**
 * The renderer's entry, which `vite build --ssr` compiles for Node and
 * scripts/prerender.mjs runs: the site from its inputs, and the pictures
 * the inputs must hold.
 */
export { PICTURES, renderSite } from './site.js'
export type { BuiltPage, Site, SiteFile } from './site.js'
