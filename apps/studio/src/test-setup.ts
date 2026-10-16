/**
 * The test environment the Studio needs.
 *
 * `@angular/compiler` first, as formancy.ai-data's host page has it: under
 * Vitest the Angular plugin compiles the Studio's component just in time,
 * and without the compiler every test that mounts the Angular builder fails
 * with "needs to be compiled using the JIT compiler, but '@angular/compiler'
 * is not available".
 */
import '@angular/compiler'
import { Blob as NodeBlob } from 'node:buffer'
import { DecompressionStream as NodeDecompressionStream } from 'node:stream/web'
import { configure } from '@testing-library/react'

/**
 * How long a `findBy` waits. The Angular builder is imported and
 * bootstrapped when it is first shown, and a preview is resolved, laid out
 * by pdfmake three times and read back: on a Windows 11 workstation
 * (i9-10900K) on 2026-10-16 the quotation's preview took about a second
 * under the suite, and the default wait is one. Fifteen is
 * formancy.ai-data's figure for the same kind of wait.
 */
configure({ asyncUtilTimeout: 15_000 })

/**
 * The two pieces of the web platform the renderer's browser entry uses that
 * jsdom lacks. Before pdfmake draws a PNG, the renderer inflates its image
 * data as a browser does (report-render-pdf's `bytes.ts`):
 * `new Blob([data]).stream()`, piped through a `DecompressionStream`.
 * jsdom's Blob has no `stream()`, and the jsdom environment has no
 * `DecompressionStream`; so under jsdom the quotation printed and the
 * service inspection, which prints a photo, failed with "stream is not a
 * function". The Node entry renders through the same code, so it would fail
 * here the same way.
 *
 * Node has both, to the same standards (the File API and Compression
 * Streams), and the page is given them here, only where jsdom lacks them. A
 * Blob the page makes for its download is then Node's too, which nothing
 * in the Studio can tell apart. Whether a browser's own Blob and
 * DecompressionStream let the photo print is a browser gate's to show.
 */
if (typeof Blob.prototype.stream !== 'function') globalThis.Blob = NodeBlob as unknown as typeof Blob
globalThis.DecompressionStream ??= NodeDecompressionStream as unknown as typeof DecompressionStream
