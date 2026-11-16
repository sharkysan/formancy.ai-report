/**
 * The Node entry in a process of its own, for the test that a document
 * renders to the same bytes in another process as in the test's
 * (`chart-content.test.ts`): reads a resolved document from standard
 * input as `wire.ts` writes it, renders it with the entry's `renderPdf`,
 * and writes the PDF to standard output as base64. A refusal, or anything
 * thrown, ends the process with its error. Run by `unrun`, which the
 * README's pictures are run by:
 *
 *   node node_modules/unrun/dist/cli.mjs src/testing/render-child.ts < document
 *
 * It imports nothing but the entry and the wire's reader, so that the
 * process holds nothing a test set up: no corpus, no mock, no state of
 * zrender's or pdfmake's but what the render leaves.
 */
import { renderPdf } from '../index.js'
import { fromWire } from './wire.js'

const chunks: Buffer[] = []
for await (const chunk of process.stdin) chunks.push(chunk as Buffer)
const pdf = await renderPdf(fromWire(Buffer.concat(chunks).toString('utf8')), { maxPages: 20 })
process.stdout.write(Buffer.from(pdf).toString('base64'))
