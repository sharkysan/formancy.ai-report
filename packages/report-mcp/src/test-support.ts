/**
 * What the suites share, and no module of the package: the quotation grown
 * to a size chosen to the byte, and a starter's images as an agent passes
 * them. Test files alone import it; every module is held to the specifiers
 * its list names in `composition.test.ts`, which no list names this in.
 */
import { QUOTATION, STARTER_IMAGES } from '@formancy/report-corpus'
import type { Component, ReportDefinition } from '@formancy/report-spec'
import { expect } from 'vitest'

/** A report's size as report-spec states `MAX_REPORT_BYTES` is measured: the UTF-8 length of its JSON. */
export const bytesOf = (report: unknown): number => new TextEncoder().encode(JSON.stringify(report)).byteLength

/**
 * The quotation grown to exactly `bytes` bytes by texts of plain letters
 * at the end of its body, each within the text's own bound: a valid report
 * of a size chosen to the byte.
 */
export function quotationOf(bytes: number): ReportDefinition {
  const quotation = QUOTATION.report
  const text = (id: string, length: number): Component => ({ kind: 'text', id, content: [{ kind: 'text', text: 'x'.repeat(length) }] })
  const padded = (texts: readonly Component[]): ReportDefinition => ({
    ...quotation,
    regions: { ...quotation.regions, body: [...quotation.regions.body, ...texts] },
  })
  const texts: Component[] = []
  while (bytesOf(padded([...texts, text(`pad-${String(texts.length)}`, 9000)])) < bytes) texts.push(text(`pad-${String(texts.length)}`, 9000))
  const last = `pad-${String(texts.length)}`
  const short = bytes - bytesOf(padded([...texts, text(last, 0)]))
  const report = padded([...texts, text(last, short)])
  expect(bytesOf(report)).toBe(bytes)
  return report
}

/** An asset as an agent passes it to render_check: its id, its digest, its media type and its bytes in base64. */
export interface PassedAsset {
  readonly asset: string
  readonly digest: string
  readonly mediaType: string
  readonly base64: string
}

/** Every image a starter names, as an agent passes it. */
export const STARTER_ASSETS: readonly PassedAsset[] = STARTER_IMAGES.map(({ asset, digest, mediaType, bytes }) => ({
  asset,
  digest,
  mediaType,
  base64: Buffer.from(bytes).toString('base64'),
}))
