/*
 * docs/getting-started.md's Node program, from outside the workspace (0015).
 *
 * The install gate writes the guide's Node blocks, in the order the guide
 * shows them, into guide/quotation.ts, and the lines it shows the program
 * printing into guide/output.txt. The host's type-check covers the program
 * with skipLibCheck off, against Node's types; this runs it as a reader
 * would, in the project's directory, and holds it to two things the guide
 * says: that it writes quotation.pdf, a PDF, and that it prints exactly the
 * lines the guide shows -- the refusals' codes and the packages' own
 * messages among them -- in their order.
 *
 * What it cannot show is what the PDF looks like: that is the renderer's
 * suite's, read back with PDF.js (0003).
 */
import { readFileSync, rmSync } from 'node:fs'

// Whatever an earlier run left, so the file checked below is this run's.
rmSync('quotation.pdf', { force: true })

const said: string[] = []
const { log } = console
console.log = (...args: unknown[]): void => {
  said.push(args.map(String).join(' '))
}
try {
  await import('./guide/quotation.js')
} finally {
  console.log = log
}

const shown = readFileSync('guide/output.txt', 'utf8').trimEnd()
const printed = said.join('\n')
if (printed !== shown) throw new Error(`docs/getting-started.md shows its Node program printing\n\n${shown}\n\nand it printed\n\n${printed}`)

const pdf = readFileSync('quotation.pdf')
if (pdf.subarray(0, 5).toString('latin1') !== '%PDF-') throw new Error('the guide wrote quotation.pdf, and it is not a PDF')

console.log(`ok: the guide's Node program ran, wrote quotation.pdf, a ${String(pdf.length)}-byte PDF, and printed the ${String(said.length)} lines the guide shows it printing`)
