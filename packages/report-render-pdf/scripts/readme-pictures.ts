/**
 * Writes the README's pictures of the starters to `docs/images/`, and the
 * manifest `pictures.test.ts` holds them to: each picture's file, its
 * SHA-256, its caption, and the lines of the page it was drawn from.
 *
 *   pnpm --filter @formancy/report-render-pdf exec unrun scripts/readme-pictures.ts
 *
 * Run it after a change that moves what a starter prints; the test names
 * the picture that no longer shows its page. Pixels depend on the
 * platform's canvas, so the pictures are made here and committed, never
 * compared pixel for pixel.
 */
import { createHash } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { picture, PICTURES, SCALE } from '../src/testing/pictures.js'

const images = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'docs', 'images')
mkdirSync(images, { recursive: true })
const manifest = []
for (const spec of PICTURES) {
  const { png, lines } = await picture(spec)
  writeFileSync(path.join(images, spec.file), png)
  manifest.push({ file: spec.file, starter: spec.starter.id, page: spec.page, scale: SCALE, sha256: createHash('sha256').update(png).digest('hex'), caption: spec.caption, lines })
  console.log(`${spec.file}: ${png.length} bytes, ${lines.length} lines`)
}
writeFileSync(path.join(images, 'pictures.json'), `${JSON.stringify(manifest, null, 2)}\n`)
