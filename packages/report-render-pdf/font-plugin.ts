import { readFileSync } from 'node:fs'

/**
 * A font file of the package's, imported as a module whose default export
 * is its bytes in base64 (`src/bill-fonts.ts`): the one way tsdown's build
 * and Vitest's tests both read one, so that what the tests hold is what is
 * published. The module's source map has no mappings, so the bytes are not
 * written a second time into the map of the chunk that carries them.
 */
export const fontAsBase64 = {
  name: 'font-as-base64',
  // Under Vitest, before Vite's own asset handling, which would give the file's address instead.
  enforce: 'pre' as const,
  load(id: string): { readonly code: string; readonly map: { readonly mappings: '' } } | undefined {
    if (!id.endsWith('.ttf')) return undefined
    return { code: `export default ${JSON.stringify(readFileSync(id).toString('base64'))}`, map: { mappings: '' } }
  },
}
