// Plan 21's switch across the frameworks in a real browser: an edit made in
// React, the switch, Undo in Angular, the switch back, with the document
// and its history the session's and not a builder's. The edit is the
// quotation's payment line, which prints, so the PDF is held to the session
// too: the first moment the paper says it is no longer busy after the edit,
// its text layer and the Download PDF -- read back with PDF.js in Node --
// both hold the edit. The Studio's jsdom suite runs the same switch
// (studio.test.tsx); what it cannot see is the PDF the browser drew.
//
// Found by role and accessible name, but for the paper's busy state, its
// text layer and the Download PDF's address, which the gate reads as the
// page draws them.

import { readPdf } from '@formancy/report-corpus'
import { builder, editorOf, open, present, selectRow, setField, settled, showing, untilLine, WITHIN } from './gate-steps.mjs'

/** The quotation's payment line, and what the switch check makes of it. */
const PAYMENT = 'Zahlbar innert 30 Tagen netto.'
const EDITED = 'Zahlbar innert 10 Tagen netto.'

/**
 * After an edit: the paper busy while the render is on its way, then the
 * first frame it is not -- what its text layer holds then, and where
 * Download PDF points then -- and the bytes at that address, read in Node.
 * A paper that settled on the earlier PDF, or a link to bytes the paper
 * does not show, is found here.
 */
async function firstSettled(page) {
  await page.waitForFunction(() => document.querySelector('.paper')?.getAttribute('aria-busy') === 'true', undefined, { timeout: WITHIN })
  const handle = await page.waitForFunction(
    () => {
      const paper = document.querySelector('.paper')
      if (paper === null || paper.getAttribute('aria-busy') !== 'false') return null
      const text = [...paper.querySelectorAll('.paper-text span')].map((span) => span.textContent ?? '').join(' ')
      const link = [...document.querySelectorAll('a[download]')].find((anchor) => anchor.textContent.trim() === 'Download PDF')
      return { text: text.replace(/\s+/g, ' '), href: link?.href ?? null }
    },
    undefined,
    { timeout: WITHIN },
  )
  const { text, href } = await handle.jsonValue()
  const bytes = href === null ? [] : await page.evaluate(async (address) => [...new Uint8Array(await (await fetch(address)).arrayBuffer())], href)
  const read = bytes.length === 0 ? { pages: [] } : await readPdf(new Uint8Array(bytes))
  return {
    text,
    downloaded: read.pages
      .flatMap((each) => each.items.map((item) => item.text))
      .join(' ')
      .replace(/\s+/g, ' '),
  }
}

/**
 * Plan 21's switch in a real browser: an edit in React, the switch, Undo
 * in Angular, the switch back. The quotation's payment line, which prints,
 * so the PDF is held to the session too.
 */
export async function frameworkSwitch(gate, page) {
  const { check } = gate
  const editor = editorOf(page)
  await open(page, 'quotation')
  await settled(page)
  await selectRow(editor, PAYMENT)
  await setField(editor, 'Text', EDITED)
  const first = await firstSettled(page)
  check(
    'the edit: once the paper is no longer busy, its pages show the edit',
    first.text.includes(EDITED) ? null : `the text layer then held ${first.text.includes(PAYMENT) ? `the line before the edit, "${PAYMENT}"` : 'neither line'}`,
  )
  check(
    'and Download PDF gives that PDF, read back with PDF.js',
    first.downloaded.includes(EDITED) ? null : `the download ${first.downloaded === '' ? 'was empty' : 'does not hold the edit'}`,
  )
  await untilLine(page, EDITED)
  await builder(page, 'Angular')
  const angular = await editor.evaluate((element) => element.closest('report-builder') !== null)
  check('the switch: the builder shown is Angular’s', angular ? null : 'the region "Report editor" is not inside <report-builder>')
  const outline = () => showing(editor, 'Outline', editor.getByRole('tree', { name: 'Outline', exact: true }))
  check('and the edit made in React is in it', await present((await outline()).getByRole('treeitem', { name: EDITED, exact: true }), `outline row "${EDITED}"`))
  const undo = editor.getByRole('button', { name: 'Undo', exact: true })
  check(
    'and so is its history: Undo is offered',
    await present(editor.getByRole('button', { name: 'Undo', exact: true, disabled: false }), 'Undo that is not disabled'),
  )
  await undo.click()
  await untilLine(page, PAYMENT).then(
    () => check('undone in Angular, the PDF prints the line as it was', null),
    (error) => check('undone in Angular, the PDF prints the line as it was', error.message),
  )
  await builder(page, 'React')
  const back = await editor.evaluate((element) => element.closest('report-builder') === null)
  check('switched back, the builder shown is React’s', back ? null : 'the region "Report editor" is still inside <report-builder>')
  check(
    'and it shows the line as Angular left it',
    await present((await outline()).getByRole('treeitem', { name: PAYMENT, exact: true }), `outline row "${PAYMENT}"`),
  )
  check(
    'and offers Redo of the edit made before the switch',
    await present(editor.getByRole('button', { name: 'Redo', exact: true, disabled: false }), 'Redo that is not disabled'),
  )
}
