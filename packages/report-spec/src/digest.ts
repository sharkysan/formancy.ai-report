/**
 * An approved asset's digest, taken where a person adds an image (0033).
 *
 * A report pins an asset by its id and the SHA-256 of its bytes (0007),
 * written as `DIGEST` (`syntax.ts`) says: `sha256:` and 64 lower-case hex
 * digits. The syntax and its computation stand in one package, so that the
 * editor that names an image and the validator that reads the name cannot
 * disagree about what one looks like.
 *
 * The hash is @noble/hashes' SHA-256, which `@formancy/spec` already uses
 * for a form's hash, for the reason it gives: Web Crypto's is asynchronous,
 * is there only in a secure context, and is no part of ES2023's library,
 * and this is a pure function a builder calls in the middle of an add. It
 * runs on the caller's thread.
 */
import { sha256 } from '@noble/hashes/sha2.js'
import { bytesToHex } from '@noble/hashes/utils.js'

/** `sha256:` and the lower-case hex SHA-256 of exactly `bytes`; @noble/hashes' TypeError for anything that is not a Uint8Array. */
export function assetDigest(bytes: Uint8Array): string {
  return `sha256:${bytesToHex(sha256(bytes))}`
}
