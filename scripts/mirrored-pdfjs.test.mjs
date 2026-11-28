import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, test } from 'vitest'
import { MIRRORED_PDFJS } from '../packages/report-documents/src/inline-end.ts'

/**
 * report-documents ends an inline image only where PDF.js ends it, its
 * tests copied from one release of PDF.js's worker (`MIRRORED_PDFJS`,
 * inline-end.ts, and inline-images.ts). The corpus proves pages with
 * pdfjs-dist and the Studio previews in it: moved past the release the
 * reader mirrors, the two may end an inline image at different bytes, and
 * nothing in the package's own tests would fail. This does, until the
 * mirror has been read again in the new release.
 *
 * And report-mcp, the one published package that carries PDF.js, reads
 * its render check's PDF with it, by the rule the corpus's `pageLines`
 * reads a page by, which its `pdf-text.test.ts` holds equal on the
 * corpus's PDFs (0089): read by another release than the corpus's, the
 * two readings would be of two PDF.js's, and an agent told of lines no
 * check here reads.
 */
const repo = join(dirname(fileURLToPath(import.meta.url)), '..')

/** The workspaces that pin the PDF.js a report is read back with: the corpus's first, the one every reading is held to. */
const PINNED_BY = ['packages/report-corpus', 'apps/studio', 'packages/report-mcp']

/** The pdfjs-dist version a workspace's manifest pins, wherever it names it. */
function pinned(dir) {
  const manifest = JSON.parse(readFileSync(join(repo, dir, 'package.json'), 'utf8'))
  return manifest.dependencies?.['pdfjs-dist'] ?? manifest.devDependencies?.['pdfjs-dist']
}

describe('the PDF.js report-documents mirrors', () => {
  // A guard on the guard: a manifest that stopped naming pdfjs-dist, or
  // named it by a range, would leave the next test comparing nothing.
  test('is pinned to an exact release by the corpus, the Studio and report-mcp', () => {
    for (const dir of PINNED_BY) expect(pinned(dir), dir).toMatch(/^\d+\.\d+\.\d+$/)
  })

  // A pin moved without the mirror read again: the reader would accept an
  // inline image's end where the PDF.js that draws the report reads on, or
  // refuse where it no longer would, and an image the reader never held
  // could print.
  test('is the release the corpus, the Studio and report-mcp pin', () => {
    for (const dir of PINNED_BY) {
      expect(
        pinned(dir),
        `${dir} pins pdfjs-dist ${pinned(dir)}, and report-documents mirrors ${MIRRORED_PDFJS}: re-read findDefaultInlineStreamEnd and inlineStreamSkipEI, and the operator map, in the new pdf.worker.mjs before moving MIRRORED_PDFJS`,
      ).toBe(MIRRORED_PDFJS)
    }
  })
})

describe('the PDF.js report-mcp carries', () => {
  // report-mcp is published, so its pin is what an agent's install
  // resolves: a dependency, never a devDependency, and the corpus's
  // release, which its reader is held to.
  test('is a dependency at the corpus’s release', () => {
    const manifest = JSON.parse(readFileSync(join(repo, 'packages', 'report-mcp', 'package.json'), 'utf8'))
    expect(manifest.dependencies?.['pdfjs-dist']).toBe(pinned('packages/report-corpus'))
  })
})
