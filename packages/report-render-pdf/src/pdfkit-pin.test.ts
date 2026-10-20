import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, test } from 'vitest'

/**
 * The PDFKit this package pins, which it imports nothing of, is the one
 * pdfmake loads (0036): the order image-order.ts writes a document's
 * images in wraps three details of that release (0035). Read here from the
 * workspace's install; the install gate's image-order fixture holds the
 * same of what npm installs for a host.
 */
const manifest = (directory: string): { version: string; dependencies?: Record<string, string> } => JSON.parse(readFileSync(path.join(directory, 'package.json'), 'utf8')) as { version: string; dependencies?: Record<string, string> }
const here = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const own = createRequire(path.join(here, 'package.json'))
const loaded = path.dirname(createRequire(own.resolve('pdfmake')).resolve('pdfkit/package.json'))

describe('PDFKit', () => {
  // A pin dropped from the manifest, or left at a release pdfmake no longer
  // loads once pdfmake moves, would leave the wrapper on a PDFKit it was
  // never read against, with nothing failing in this suite.
  test('is pinned at an exact release, the one pdfmake loads', () => {
    const pinned = manifest(here).dependencies?.pdfkit
    expect(pinned).toMatch(/^\d+\.\d+\.\d+$/)
    expect(manifest(loaded).version).toBe(pinned)
  })
})
