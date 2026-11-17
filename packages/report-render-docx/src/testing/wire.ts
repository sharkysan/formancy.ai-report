import type { ResolvedDocument } from '@formancy/report-runtime'

/**
 * A resolved document as text, for the writer in a process of its own
 * (`write-child.ts`): JSON, every byte array -- a font's, an image's --
 * an object of one key, `base64`, which nothing in a resolved document is
 * otherwise. Both ends are the tests', and read nothing else.
 */

/** `document` as the text a child process reads. */
export function toWire(document: ResolvedDocument): string {
  return JSON.stringify(document, (_, value: unknown) => (value instanceof Uint8Array ? { base64: Buffer.from(value).toString('base64') } : value))
}

/** The document `text` holds, its byte arrays read back. */
export function fromWire(text: string): ResolvedDocument {
  return JSON.parse(text, (_, value: unknown) => {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return value
    const keys = Object.keys(value)
    const base64 = (value as { base64?: unknown }).base64
    return keys.length === 1 && typeof base64 === 'string' ? new Uint8Array(Buffer.from(base64, 'base64')) : value
  }) as ResolvedDocument
}
