/**
 * report-render-pdf's browser entry and nothing else of the Studio's: the
 * entry `scripts/renderer-notices.mjs` builds, to see what the notices
 * plugin writes for the renderer's chunks (`notices.test.ts`). The page
 * does not import it.
 */
export const renderer = import('@formancy/report-render-pdf/browser')
