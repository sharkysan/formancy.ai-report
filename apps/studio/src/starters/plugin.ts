/**
 * The Vite plugin that hands the page the corpus's starters: it runs in
 * Node, where `@formancy/report-corpus` does, and serves them as one JSON
 * module (`codec.ts` says why they cannot be imported directly).
 *
 * Only `vite.config.ts` imports this file; nothing the page loads does.
 */
import { STARTER_IMAGES, STARTERS } from '@formancy/report-corpus'
import type { Plugin } from 'vite'
import { encodeStarters } from './codec.js'

/** What the page imports. */
export const STARTERS_IMPORT = 'virtual:formancy-report-starters'

/**
 * The module's id once resolved: `\0` marks it as one no file holds, so no
 * other plugin transforms it. The notices plugin is told it is this
 * repository's own (`ownModules` in vite.config.ts), since it is the
 * corpus's synthetic data and nothing else.
 */
export const STARTERS_MODULE = `\0${STARTERS_IMPORT}`

/** The module's source: the encoded starters, as a default export. */
export function startersSource(): string {
  return `export default ${JSON.stringify(encodeStarters(STARTERS, STARTER_IMAGES))}\n`
}

export function starters(): Plugin {
  return {
    name: 'formancy-report:starters',
    resolveId: (id) => (id === STARTERS_IMPORT ? STARTERS_MODULE : undefined),
    load: (id) => (id === STARTERS_MODULE ? startersSource() : undefined),
  }
}
