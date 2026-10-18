/**
 * The starters as they cross from Node, where the corpus runs, to the page:
 * JSON, with an image's bytes as base64.
 *
 * `@formancy/report-corpus` builds its starters in Node -- an image's digest
 * with `node:crypto`, its PNG with `node:zlib` -- and imports PDF.js's legacy
 * build for its checks, so the page cannot import it. The Studio's Vite
 * plugin (`plugin.ts`) reads it at build time and writes this; the page
 * reads it back with `decodeStarters`. A report and its data are JSON
 * already: exact values travel as strings (0010), and nothing in a starter
 * is a function, a BigInt or undefined, which `codec.test.ts` holds.
 */
import type { ReportData, ReportDefinition } from '@formancy/report-runtime'

/** A starter as the corpus has it, and as the page uses it. */
export interface StudioStarter {
  readonly id: string
  readonly title: string
  /** What the starter exercises that the others do not, in the corpus's words. */
  readonly proves: string
  readonly report: ReportDefinition
  readonly data: ReportData
  readonly parameters: Readonly<Record<string, unknown>>
}

/** An approved asset a starter's data or template names -- the inspection's photo, the firm's mark -- and its bytes. */
export interface StudioImage {
  readonly asset: string
  readonly digest: string
  readonly mediaType: string
  readonly bytes: Uint8Array
}

/** What crosses: the starters as they are, and each image with its bytes as base64. */
export interface EncodedStarters {
  readonly starters: readonly StudioStarter[]
  readonly images: readonly { readonly asset: string; readonly digest: string; readonly mediaType: string; readonly base64: string }[]
}

/** Bytes as base64, by the platform's own `btoa`, which Node and every browser have. */
export function toBase64(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

/** Base64 back to bytes; `atob` throws on text that is not base64. */
export function fromBase64(text: string): Uint8Array {
  const binary = atob(text)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
  return bytes
}

export function encodeStarters(starters: readonly StudioStarter[], images: readonly StudioImage[]): EncodedStarters {
  return {
    starters: starters.map(({ id, title, proves, report, data, parameters }) => ({ id, title, proves, report, data, parameters })),
    images: images.map(({ asset, digest, mediaType, bytes }) => ({ asset, digest, mediaType, base64: toBase64(bytes) })),
  }
}

export function decodeStarters(encoded: EncodedStarters): { readonly starters: readonly StudioStarter[]; readonly images: readonly StudioImage[] } {
  return {
    starters: encoded.starters,
    images: encoded.images.map(({ asset, digest, mediaType, base64 }) => ({ asset, digest, mediaType, bytes: fromBase64(base64) })),
  }
}
