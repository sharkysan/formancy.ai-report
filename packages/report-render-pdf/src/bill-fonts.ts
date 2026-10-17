import bold from '../fonts/LiberationSans-Bold.ttf'
import regular from '../fonts/LiberationSans-Regular.ttf'

/**
 * Liberation Sans 2.1.5's two faces as base64, for the browser entry's
 * virtual files: the bytes of the package's own `fonts` directory, which the
 * build writes into a chunk of their own (`font-plugin.ts`, in tsdown's
 * build and in Vitest's tests). The browser entry imports this module the first
 * time a document has a payment part, never before, so that a host that
 * never prints a bill never loads it.
 */
export const LIBERATION_SANS = { normal: regular, bold } as const
