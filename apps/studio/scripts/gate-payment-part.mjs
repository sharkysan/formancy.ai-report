// A report's QR-bill edited in a real browser (0039): what jsdom cannot
// show of it is the PDF the edit prints, and the code on it read the way a
// banking app reads one, from the page's pixels.
//
// On the invoice, in the builder `framework` names, at every pass of the
// journey: the bill selected by a click on its band in the design view,
// which only a browser that applies the stylesheet can show nothing drawn
// over it takes, its IBAN then among the properties, and the report's own
// properties brought back; the bill selected from its outline row, the
// keyboard on it; an
// IBAN whose check digit is wrong typed into its field and refused there,
// the field invalid and the Download PDF still paying the starter's
// account; an IBAN typed that SIX's rules take, the live region saying the
// IBAN changed, and the Download PDF read back -- every page drawn by
// PDF.js in Node and its codes decoded with ZXing (`readCodes`, 0020) --
// holding one Swiss QR Code whose account, the fourth line of its payload
// (IG 2.4, Table 8), is the IBAN typed, as the code holds it, without
// spaces; and the edit undone from the toolbar, the code paying the
// starter's account again. Everything is undone, so the journey goes on
// from the invoice as it was.
//
// Found by role and accessible name, but for three things read from the
// DOM: the Download PDF's bytes, which the gate fetches as the page offers
// them; whether the IBAN's field is invalid, `aria-invalid`, which
// Playwright's role queries have no option for; and whether the toolbar's
// Undo is unavailable, `aria-disabled`, read of the button found by role
// and name, which a builder keeps in the tree and focusable.

import { readCodes, readPdf } from '@formancy/report-corpus'
import { describeFocus } from './gate-page.mjs'
import { designViewOf, editorOf, open, previewInView, previewOf, said, settled, showing, WITHIN } from './gate-steps.mjs'

/** The invoice starter's account, SIX's example QR-IBAN, as its code holds it. */
const STARTER_ACCOUNT = 'CH4431999123000889012'
/** A QR-IBAN SIX's rules take and no example of SIX's: the first QR-IID's institution and an account of zeros, as typed, with its spaces. */
const TYPED = 'CH58 3000 0000 0000 0000 0'
/** The same with a wrong check digit, which report-spec refuses. */
const MISTYPED = 'CH44 3199 9123 0008 8901 3'

/**
 * Until the Download PDF the Preview offers holds one Swiss QR Code whose
 * account is `account`, as the page prints after an edit: null, or why
 * not, with the accounts last read. Each PDF the Preview offers has an
 * address of its own: one read already is not read again.
 */
async function untilAccount(page, account) {
  const deadline = Date.now() + WITHIN
  let seen = 'no PDF'
  let read = null
  for (;;) {
    await previewInView(page)
    const link = previewOf(page).getByRole('link', { name: 'Download PDF', exact: true })
    const href = (await link.count()) === 1 ? await link.evaluate((anchor) => anchor.href) : null
    if (href !== null && href !== read) {
      read = href
      const bytes = new Uint8Array(await page.evaluate(async (address) => [...new Uint8Array(await (await fetch(address)).arrayBuffer())], href))
      const pages = (await readPdf(bytes)).pages.length
      const codes = []
      for (let number = 1; number <= pages; number += 1) codes.push(...(await readCodes(bytes, number)))
      // A Swiss QR Code begins with its QR type, SPC (IG 2.4, Table 8).
      const bills = codes.filter((code) => code.text.startsWith('SPC\n'))
      const accounts = bills.map((code) => code.text.split('\n')[3])
      if (accounts.length === 1 && accounts[0] === account) return null
      seen = `${String(codes.length)} codes, of which Swiss QR Codes paying ${JSON.stringify(accounts)}`
    }
    if (Date.now() > deadline) return `its PDF holds ${seen}, not one Swiss QR Code paying ${account}, in ${String(WITHIN)} ms`
    await page.waitForTimeout(250)
  }
}

/** The keyboard on `element`, or where it is instead. */
const onIt = async (page, element) => ((await element.evaluate((node) => node === document.activeElement)) ? null : `the keyboard is on ${await describeFocus(page)}`)

/** The checks, in the builder shown, which `framework` names. */
export async function paymentPartChecks(gate, page, framework) {
  const { check } = gate
  const editor = editorOf(page)
  await open(page, 'invoice')
  await settled(page)
  check(`${framework}: the invoice's Download PDF holds one Swiss QR Code, paying the starter's account`, await untilAccount(page, STARTER_ACCOUNT))

  // Its band, clicked in the design view as a pointer clicks it: Playwright
  // clicks only once the band itself would take the click, so a selected
  // box or a region's label drawn over it fails here. The bill selected
  // shows its IBAN among the properties; the properties' Report then gives
  // the report's own back, so that the row below selects the bill anew.
  const band = await showing(editor, 'Design view', designViewOf(page).getByRole('img', { name: said('canvas.paymentPart'), exact: true }))
  const byBand = await band.click({ timeout: 5_000 }).then(
    async () => {
      await showing(editor, 'Properties', editor.getByRole('form'))
      return editor
        .getByRole('textbox', { name: said('field.iban'), exact: true })
        .waitFor({ timeout: 5_000 })
        .then(
          () => null,
          () => "the bill's IBAN is not among the properties",
        )
    },
    (error) => `the band did not take the click: ${String(error?.message ?? error).split('\n')[0]}`,
  )
  check(`${framework}: its band in the design view, clicked, selects the bill`, byBand)
  const toReport = editor.getByRole('button', { name: said('properties.report'), exact: true })
  if ((await toReport.count()) === 1) await toReport.click()
  await settled(page)

  // Its row, after the regions, clicked: the bill selected, and the keyboard on the row.
  const tree = await showing(editor, 'Outline', editor.getByRole('tree', { name: said('pane.outline'), exact: true }))
  const row = tree.getByRole('treeitem', { name: said('canvas.paymentPart'), exact: true })
  await row.click()
  // Waited for, as zoneless Angular draws the selection a frame after the click.
  const chosen = await tree
    .getByRole('treeitem', { name: said('canvas.paymentPart'), exact: true, selected: true })
    .waitFor({ timeout: 5_000 })
    .then(
      () => null,
      () => 'the row is not selected',
    )
  check(`${framework}: its ${said('canvas.paymentPart')} row selects the bill`, chosen)
  check(`${framework}: with the keyboard on the row`, await onIt(page, row))

  // An IBAN SIX's rules refuse: refused on its field, the bill as it was.
  const iban = await showing(editor, 'Properties', editor.getByRole('textbox', { name: said('field.iban'), exact: true }))
  await iban.fill(MISTYPED)
  await iban.press('Tab')
  const refused = await editor
    .getByRole('textbox', { name: said('field.iban'), exact: true })
    .and(editor.locator('[aria-invalid="true"]'))
    .waitFor({ timeout: 5_000 })
    .then(
      () => null,
      () => 'the field is not marked invalid',
    )
  check(`${framework}: an IBAN with a wrong check digit is refused on its field`, refused)
  check(`${framework}: and the Download PDF still pays the starter's account`, await untilAccount(page, STARTER_ACCOUNT))

  // An IBAN SIX's rules take: the bill pays it, read from the PDF's pixels.
  const field = await showing(editor, 'Properties', editor.getByRole('textbox', { name: said('field.iban'), exact: true }))
  await field.fill(TYPED)
  await field.press('Tab')
  const changed = await editor
    .getByRole('status')
    .filter({ hasText: said('status.changed', { field: said('field.iban') }) })
    .first()
    .waitFor({ timeout: 5_000 })
    .then(
      () => null,
      () => 'the live region never said the IBAN changed',
    )
  check(`${framework}: an IBAN SIX's rules take is typed into the bill`, changed)
  check(`${framework}: and the Swiss QR Code the Download PDF draws, decoded from its pixels, pays it`, await untilAccount(page, TYPED.replaceAll(' ', '')))

  // Undone from the toolbar: the code pays the starter's account again.
  const undo = editor.getByRole('toolbar', { name: said('toolbar.label'), exact: true }).getByRole('button', { name: said('action.undo'), exact: true })
  if ((await undo.getAttribute('aria-disabled')) !== 'true') await undo.click()
  check(`${framework}: undone, the code pays the starter's account again`, await untilAccount(page, STARTER_ACCOUNT))
  await settled(page)
}
