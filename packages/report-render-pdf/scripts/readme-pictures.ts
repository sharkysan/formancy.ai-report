/**
 * Writes the README's pictures of the starters and of both invoices' samples
 * to `docs/images/`, and the manifests `pictures.test.ts` holds them to,
 * `pictures.json` for the starters' and `samples.json` for the samples':
 * each picture's file, its SHA-256, its caption, and the lines of the page
 * it was drawn from.
 *
 *   pnpm --filter @formancy/report-render-pdf exec unrun scripts/readme-pictures.ts
 *
 * Run it after a change that moves what a starter or a sample prints; the
 * test names the picture that no longer shows its page. Pixels depend on
 * the platform's canvas, so the pictures are made here and committed,
 * never compared pixel for pixel.
 */
import { createHash } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { picture, PICTURES, SAMPLE_PICTURES, SCALE, type PictureSpec } from '../src/testing/pictures.js'

const images = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'docs', 'images')
mkdirSync(images, { recursive: true })
/** Draws each picture of `specs`, and writes their manifest as `name`, each entry naming what it is a page of under `of`. */
async function draw(specs: readonly PictureSpec[], name: string, of: 'starter' | 'sample'): Promise<void> {
  const manifest = []
  for (const spec of specs) {
    const { png, lines } = await picture(spec)
    writeFileSync(path.join(images, spec.file), png)
    manifest.push({ file: spec.file, [of]: spec.starter.id, page: spec.page, scale: SCALE, sha256: createHash('sha256').update(png).digest('hex'), caption: spec.caption, lines })
    console.log(`${spec.file}: ${png.length} bytes, ${lines.length} lines`)
  }
  writeFileSync(path.join(images, name), `${JSON.stringify(manifest, null, 2)}\n`)
}

await draw(PICTURES, 'pictures.json', 'starter')
await draw(SAMPLE_PICTURES, 'samples.json', 'sample')
