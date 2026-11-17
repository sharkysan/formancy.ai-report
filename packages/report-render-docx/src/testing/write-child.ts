/**
 * The writer in a process of its own, for the test that a document is the
 * same bytes in another process and under another time zone as in the
 * test's (`stable.test.ts`): reads a resolved document from standard
 * input as `wire.ts` writes it, writes its Word file, and puts the file
 * on standard output as base64, with the zone the process ran in on the
 * line before it. Run by `unrun`:
 *
 *   TZ=Pacific/Kiritimati node node_modules/unrun/dist/cli.mjs src/testing/write-child.ts < document
 *
 * It imports nothing but the writer and the wire's reader, so that the
 * process holds nothing a test set up.
 */
import { renderDocx } from '../index.js'
import { fromWire } from './wire.js'

const chunks: Buffer[] = []
for await (const chunk of process.stdin) chunks.push(chunk as Buffer)
const file = renderDocx(fromWire(Buffer.concat(chunks).toString('utf8')))
process.stdout.write(`${String(new Date(2026, 0, 1).getTimezoneOffset())}\n${Buffer.from(file).toString('base64')}`)
