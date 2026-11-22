// A report's Word file in a real browser (0068): what jsdom cannot show of
// it is the file a person downloads, written in the page by the build's
// own chunk of the writer -- over the file fflate serves a browser, which
// no suite under Node loads.
//
// At every starter's preview in the journey, in each builder, and at an
// e-invoice's final render (`wordChecks`). Where the writer writes the
// report: Download Word after Download PDF, the keyboard's next stop, or
// the one after Download XML where a final render of an e-invoice offers it,
// downloaded as a person downloads it and saved as the starter's .docx;
// read whole by the corpus's `readDocx` in Node, which is not its writer;
// held by `verifyDocx` to the document the gate resolves under Node from
// the corpus's starter, at the instant the file says it was made; and
// byte for byte the file report-render-docx writes of that document under
// Node. Where the writer refuses the report -- a preview's label, an
// e-invoice's among them -- no link, and a note in its place named
// "No Word file: " and the sentence the writer refuses that document
// with under Node. An e-invoice's final render is the one whose Word
// file is another document's than its PDF's (0077): the copy the runtime
// resolves of it with `eInvoice: 'copy'`, which the gate resolves under
// Node as the page does and holds the file to, every header of it
// opening with the copy's label, as `verifyDocx` holds of a copy. A code in a file that is written -- the euro
// invoice's EPC QR code -- is read by `verifyDocx` from its picture's
// pixels, by ZXing, which is why the check is waited for (0074); a chart
// in one -- the sales report's bar chart and its pie -- from its part,
// Word's own chart, its words, its values' digits and its axis (0076);
// and a QR-bill's slip in one -- the invoice's and the payment
// reminder's -- from its page, the file's last section, its Swiss QR
// Code from its picture's pixels (0075). Which
// starters are which is the writer's to say, here under Node: the
// Studio's suite names them (pipeline.test.ts), and the journey fails a
// pass that read no file, or no refusal.
//
// And in the framework switch (`wordHolds`, gate-switch.mjs): the Word
// file offered at the first moment the paper is no longer busy after an
// edit holds the edit, as the Download PDF does.
//
// What it does not hold: that Word opens the file, or what Word prints of
// it, which no reader here can say (0068); and of the blank report, the
// Studio's own and no starter of the corpus's, more than its link, its
// name and that the reader reads it whole.
//
// Found by role and accessible name, but for the Download Word's bytes,
// which the gate downloads as the page offers them, and the paper's busy
// state, which the accessibility tree holds as no name.

import { createHash } from 'node:crypto'
import { expectation, readDocx, STARTER_IMAGES, STARTERS, verifyDocx } from '@formancy/report-corpus'
import { renderDocx, RenderRefusal } from '@formancy/report-render-docx'
import { readCopyLabel, resolveReport } from '@formancy/report-runtime'
import { offeredWord } from './gate-download.mjs'
import { describeFocus } from './gate-measure.mjs'
import { previewOf, WITHIN } from './gate-steps.mjs'

const WORD_LINK = 'Download Word'

/** What a fixture states of its pages, which no check of a Word file reads: its pages are Word's (0068). */
const PAGES = 99

/** The starters' approved images, as the page's lookup answers for them: by asset and digest together. */
const images = (ref) => STARTER_IMAGES.find((image) => image.asset === ref.asset && image.digest === ref.digest)

/**
 * `starter`, the corpus's, resolved under Node as the page resolves it as
 * it opens: its own data and parameters, in the report's own language, in
 * `mode`, made at `creationDate`. The page printed it, so a refusal here
 * is the gate's own fault, and thrown.
 */
function resolved(starter, mode, creationDate, more = {}) {
  const outcome = resolveReport(starter.report, starter.data, { mode, parameters: starter.parameters, images, creationDate, ...more })
  if (!outcome.ok)
    throw new Error(`the runtime refuses ${starter.id} under Node: ${outcome.errors.map((error) => `${error.code} at ${error.path}`).join('; ')}`)
  return outcome.document
}

/**
 * The document `starter`'s Word file is written of (0077): the one its
 * PDF is drawn from, but for a final render of an e-invoice, whose Word
 * file is its copy's -- the same render resolved as `eInvoice: 'copy'`,
 * labelled on every header and carrying no XML.
 */
function wordDocument(starter, mode, creationDate) {
  const document = resolved(starter, mode, creationDate)
  return document.eInvoice === undefined ? document : resolved(starter, mode, creationDate, { eInvoice: 'copy' })
}

/** What the writer makes of `document` under Node: its file, or the sentence it refuses it with. */
function writtenUnderNode(document) {
  try {
    return { bytes: renderDocx(document) }
  } catch (error) {
    if (error instanceof RenderRefusal) return { refused: error.message }
    throw error
  }
}

const digest = (bytes) => createHash('sha256').update(bytes).digest('hex').slice(0, 16)

/** The keyboard on `element`, or where it is instead. */
const onIt = async (page, element) =>
  (await element.evaluate((node) => node === document.activeElement)) ? null : `the keyboard is on ${await describeFocus(page)}`

/**
 * The Word file of starter `id` as the Preview offers it, its `mode`
 * render printed, under `state` as the journey names it. Returns 'written'
 * where a file was read and 'refused' where the writer's refusal was, for
 * the journey to hold a pass to both.
 *
 * Read once the paper says it is no longer busy: the Word file, as the
 * PDF, is the one of the render on the paper (pdf-view.tsx), so between a
 * render's status and its pages the Preview still offers the file, or the
 * reason, of the render before -- a final render's, its preview's.
 */
export async function wordChecks(gate, page, state, { id, mode = 'preview' }) {
  const { check } = gate
  const preview = previewOf(page)
  await page.waitForFunction(() => document.querySelector('.paper')?.getAttribute('aria-busy') === 'false', undefined, { timeout: WITHIN })
  const starter = STARTERS.find((each) => each.id === id)
  // The refusal reads no date, so the one that decides it is the gate's clock.
  const expected = starter === undefined ? { bytes: null } : writtenUnderNode(wordDocument(starter, mode, new Date().toISOString()))

  if ('refused' in expected) {
    const links = await preview.getByRole('link', { name: WORD_LINK, exact: true }).count()
    check(`${state}: no Download Word, the writer refusing the report`, links === 0 ? null : `the Preview offers ${String(links)}`)
    const named = await preview.getByRole('note', { name: `No Word file: ${expected.refused}`, exact: true }).count()
    check(
      `${state}: and a note in its place named by the sentence the writer refuses it with under Node`,
      named === 1 ? null : `the Preview's notes say ${JSON.stringify(await preview.getByRole('note').allInnerTexts())}`,
    )
    return 'refused'
  }

  const word = await offeredWord(page, preview)
  check(
    `${state}: Download Word is offered after Download PDF, saved as ${id}.docx`,
    word === null ? 'the Preview offers no Download Word' : word.fileName === `${id}.docx` ? null : `it is saved as ${word.fileName}`,
  )
  if (word === null) return null
  await preview.getByRole('link', { name: 'Download PDF', exact: true }).focus()
  await page.keyboard.press('Tab')
  // A final render of an e-invoice offers its XML between the two (0065), and since 0077 its Word file after it: the keyboard passes Download XML.
  const xml = preview.getByRole('link', { name: 'Download XML', exact: true })
  const past = (await xml.count()) === 1
  if (past) {
    check(`${state}: Tab from Download PDF reaches Download XML, which stands between the two`, await onIt(page, xml))
    await page.keyboard.press('Tab')
  }
  check(
    `${state}: and Tab from ${past ? 'Download XML' : 'Download PDF'} reaches it`,
    await onIt(page, preview.getByRole('link', { name: WORD_LINK, exact: true })),
  )
  // The keyboard left where no later step finds it: nothing after this reads the focus as this check moved it.
  await page.evaluate(() => (document.activeElement instanceof HTMLElement ? document.activeElement.blur() : undefined))

  let docx
  try {
    docx = readDocx(word.bytes)
  } catch (error) {
    check(`${state}: the Word file is read whole by the corpus's reader`, error instanceof Error ? error.message : String(error))
    return null
  }
  check(`${state}: the Word file is read whole by the corpus's reader`, null)
  if (starter === undefined) return 'written'

  if (docx.created === undefined) {
    check(`${state}: it holds what the document says, resolved under Node at the instant the file was made`, 'the file states no creation date')
    return null
  }
  const document = wordDocument(starter, mode, docx.created)
  // An e-invoice's final render gives a file, and the file is its copy's: a gate that held it to a document without the label would pass a file without one.
  if (starter.report.eInvoice !== undefined)
    check(
      `${state}: the document it is held to is the copy of the e-invoice, labelled as one by the runtime, and carries no XML`,
      readCopyLabel(document.pageHeader)?.asWritten === true && document.eInvoice === undefined ? null : 'the document resolved under Node is no copy',
    )
  // Waited for: a code is held by what ZXing reads in its picture (0074).
  const problems = await verifyDocx({ id, title: id, document, maxPages: PAGES, expect: expectation(document, { maxPagesExpected: PAGES }) }, docx)
  check(
    `${state}: it holds what the document says, resolved under Node at the instant the file was made`,
    problems.length === 0 ? null : problems.slice(0, 4).join('; '),
  )
  const node = renderDocx(document)
  check(
    `${state}: and is byte for byte the file the writer writes of that document under Node`,
    Buffer.compare(Buffer.from(node), Buffer.from(word.bytes)) === 0
      ? null
      : `the page wrote ${String(word.bytes.length)} bytes, SHA-256 ${digest(word.bytes)}…, and Node ${String(node.length)} bytes, ${digest(node)}…`,
  )
  return 'written'
}

/** The text of each paragraph `blocks` hold, in their order, a table's cell by cell. */
function paragraphsIn(blocks) {
  return blocks.flatMap((block) =>
    block.kind === 'paragraph'
      ? [block.runs.map((run) => (run.kind === 'text' ? run.text : '')).join('')]
      : block.rows.flatMap((row) => row.cells.flatMap((cell) => paragraphsIn(cell.blocks))),
  )
}

/**
 * Null where `file`, a Word file as `offeredWord` downloaded it, read
 * whole by the corpus's reader, holds `words` in a paragraph of its body;
 * or why not -- no file, one the reader refuses, or one without them.
 */
export function wordHolds(file, words) {
  if (file === null) return 'the Preview offered no Download Word then'
  let docx
  try {
    docx = readDocx(file.bytes)
  } catch (error) {
    return `the corpus's reader refuses the file: ${error instanceof Error ? error.message : String(error)}`
  }
  return paragraphsIn(docx.body).some((text) => text.includes(words)) ? null : `no paragraph of the file's body holds "${words}"`
}
