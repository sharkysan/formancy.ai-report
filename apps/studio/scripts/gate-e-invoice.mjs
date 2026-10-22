// A report's e-invoice edited in a real browser (0044): what jsdom cannot
// show of it is the PDF/A-3b a final render draws, the XML it embeds, and
// the EPC QR code on its page read the way a banking app reads one.
//
// On the e-invoice starter, in the builder `framework` names, at every pass
// of the journey, its Final render on: the Download PDF read back in Node
// -- its embedded factur-x.xml found by pdf-lib (`readPdfObjects`) and read
// by namespace with saxes (`readCii`), its page's text by PDF.js, every
// code on it decoded from its pixels with ZXing (`readCodes`, 0020) --
// holding the total with VAT the page prints and an EPC QR code paying the
// XML's account (BT-84). Then the e-invoice selected from its outline row,
// the keyboard on it; the buyer's electronic address typed, and the XML
// holding it under its scheme, EM (BT-49), beside the buyer the page
// prints; the first VAT category's rate typed, and the XML's tax at that
// rate the amount the page prints, its total with VAT the page's; and an
// IBAN typed once into the e-invoice's payment instructions, the live
// region saying every payment code pays it, and the XML's account and the
// EPC QR code's both the IBAN typed. Each edit undone from the toolbar,
// the XML and the code back to the starter's, and Final off again, so the
// journey goes on from the e-invoice as it was.
//
// What it does not hold: the page's own words beside the totals -- its
// "Umsatzsteuer 19 % auf" and its "IBAN:" line are the template's literal
// text, which no edit of the e-invoice changes (0044 says so) -- nor its
// own words for the seller, the dates and the bank, its header and its
// "BIC:" line, which report-core holds to no term of the e-invoice, so an
// edit of those terms is held to the page by nothing (0044's cost); and a
// QR-bill's account, which the starter has none of: the bill's half of
// the shared account is held by the builder scenarios, in both builders.
//
// Found by role and accessible name, but for the Download PDF's bytes,
// which the gate fetches as the page offers them, and whether the
// toolbar's Undo is unavailable, `aria-disabled`.

import { elementsAt, readCii, readCodes, readPdf, readPdfObjects, textAt } from '@formancy/report-corpus'
import { describeFocus } from './gate-page.mjs'
import { editorOf, open, previewInView, previewOf, said, settled, showing, WITHIN } from './gate-steps.mjs'

const STT = 'rsm:SupplyChainTradeTransaction'
const HTA = `${STT}/ram:ApplicableHeaderTradeAgreement`
const HTS = `${STT}/ram:ApplicableHeaderTradeSettlement`
const SUMMATION = `${HTS}/ram:SpecifiedTradeSettlementHeaderMonetarySummation`

/** The starter's account (BT-84), as the XML and the EPC QR code hold it, without spaces. */
const STARTER_ACCOUNT = 'DE83012345670012345678'
/** An account typed into the e-invoice: the IBAN the EPC's and ISO 13616's documents print, of a German bank, as the starter's BIC is. */
const TYPED_ACCOUNT = 'DE89 3704 0044 0532 0130 00'
/** The buyer's electronic address typed, under a name RFC 2606 reserves. */
const ADDRESS = 'rechnung@zur-linde.example'
/** The standard rate typed into the first VAT category, the starter's 19 %. */
const RATE = '16'

/** The final PDF's status. */
const FINAL = /^Final render: printed(, with \d+ warnings?)?\.$/

/** Text with every space a formatter may write -- a no-break one, a narrow one -- as one space: what the page's and the gate's amounts are compared as. */
const spaced = (text) => text.replaceAll(/[\u00a0\u202f\s]+/g, ' ')

/** An amount as the starter's German page prints it: "871,63 €". */
const printedAmount = (amount) => spaced(`${new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(amount))} €`)

/**
 * What the Download PDF the Preview offers says of the e-invoice, once its
 * address is one not read before: its embedded XML's root, the lines of
 * its first page, and the account each EPC QR code on it pays, the seventh
 * line of its payload (EPC069-12, 2.2). Null while there is no new PDF.
 */
async function readInvoice(page, read) {
  await previewInView(page)
  const link = previewOf(page).getByRole('link', { name: 'Download PDF', exact: true })
  const href = (await link.count()) === 1 ? await link.evaluate((anchor) => anchor.href) : null
  if (href === null || href === read.href) return null
  read.href = href
  const bytes = new Uint8Array(await page.evaluate(async (address) => [...new Uint8Array(await (await fetch(address)).arrayBuffer())], href))
  const embedded = (await readPdfObjects(bytes)).associatedFiles.find((file) => file.f === 'factur-x.xml')?.embedded
  const pdf = await readPdf(bytes)
  const lines = pdf.pages.flatMap((sheet) => sheet.items.map((item) => item.text))
  const codes = []
  for (let number = 1; number <= pdf.pages.length; number += 1) codes.push(...(await readCodes(bytes, number)))
  const accounts = codes.filter((code) => code.text.startsWith('BCD\n')).map((code) => code.text.split('\n')[6])
  return { xml: embedded === undefined ? null : readCii(new TextDecoder().decode(embedded.bytes)), text: spaced(lines.join(' ')), accounts }
}

/**
 * Until the Download PDF holds what `holds` asks of it -- null when it
 * does, else why not -- within WITHIN: null, or why not, as last read.
 */
async function until(page, holds) {
  const deadline = Date.now() + WITHIN
  const read = { href: null }
  let why = 'no final PDF was offered'
  for (;;) {
    const invoice = await readInvoice(page, read)
    if (invoice !== null) {
      why = invoice.xml === null ? 'its PDF embeds no factur-x.xml' : (holds(invoice) ?? null)
      if (why === null) return null
    }
    if (Date.now() > deadline) return `${why}, in ${String(WITHIN)} ms`
    await page.waitForTimeout(250)
  }
}

/** Whether the XML's total with VAT (BT-112) is the one the page prints, and every EPC QR code on it pays the XML's account (BT-84) and that alone. */
function agrees({ xml, text, accounts }) {
  const total = textAt(xml, `${SUMMATION}/ram:GrandTotalAmount`)
  const account = textAt(xml, `${HTS}/ram:SpecifiedTradeSettlementPaymentMeans/ram:PayeePartyCreditorFinancialAccount/ram:IBANID`)
  if (total === undefined || !text.includes(`Rechnungsbetrag ${printedAmount(total)}`)) return `the page does not print the XML's total with VAT, ${String(total)}, as its Rechnungsbetrag`
  if (accounts.length !== 1 || accounts[0] !== account) return `its EPC QR codes pay ${JSON.stringify(accounts)}, and the XML's account is ${String(account)}`
  return null
}

/** The XML's account (BT-84), and the EPC QR code's, are `account`, and the page's total is the XML's. */
const paying = (account) => (invoice) => {
  const named = textAt(invoice.xml, `${HTS}/ram:SpecifiedTradeSettlementPaymentMeans/ram:PayeePartyCreditorFinancialAccount/ram:IBANID`)
  return named !== account ? `the XML's account (BT-84) is ${String(named)}, not ${account}` : agrees(invoice)
}

/** The buyer's electronic address (BT-49) is `address` under EM, or, for null, absent; the buyer the XML names the one the page prints; and the page's total the XML's. */
const addressed = (address) => (invoice) => {
  const [element] = elementsAt(invoice.xml, `${HTA}/ram:BuyerTradeParty/ram:URIUniversalCommunication/ram:URIID`)
  const buyer = textAt(invoice.xml, `${HTA}/ram:BuyerTradeParty/ram:Name`)
  if (address === null && element !== undefined) return `the XML names the buyer's electronic address ${element.text}`
  if (address !== null && (element?.text !== address || element.attributes.schemeID !== 'EM')) return `the XML's buyer's electronic address (BT-49) is ${JSON.stringify(element?.text)} under ${JSON.stringify(element?.attributes.schemeID)}`
  if (buyer === undefined || !invoice.text.includes(buyer)) return `the page does not print the buyer the XML names, ${String(buyer)}`
  return agrees(invoice)
}

/** The XML's standard-rated breakdown at `rate` (BT-119) holds a tax (BT-117) the page prints, and the page's total is the XML's. */
const taxedAt = (rate) => (invoice) => {
  const breakdown = elementsAt(invoice.xml, `${HTS}/ram:ApplicableTradeTax`).find((tax) => textAt(tax, 'ram:CategoryCode') === 'S' && Number(textAt(tax, 'ram:RateApplicablePercent')) === Number(rate))
  const amount = breakdown === undefined ? undefined : textAt(breakdown, 'ram:CalculatedAmount')
  if (amount === undefined) return `the XML holds no standard-rated breakdown at ${rate} %`
  if (!invoice.text.includes(printedAmount(amount))) return `the page does not print the XML's tax at ${rate} %, ${amount}`
  return agrees(invoice)
}

/** The keyboard on `element`, or where it is instead. */
const onIt = async (page, element) => ((await element.evaluate((node) => node === document.activeElement)) ? null : `the keyboard is on ${await describeFocus(page)}`)

/** A field of the e-invoice's properties named `name`, given `value` and left with Tab; until the live region says `said`. */
async function typed(editor, name, value, saying) {
  const field = await showing(editor, 'Properties', editor.getByRole('textbox', { name, exact: true }))
  await field.fill(value)
  await field.press('Tab')
  return editor
    .getByRole('status')
    .filter({ hasText: saying })
    .first()
    .waitFor({ timeout: 5_000 })
    .then(
      () => null,
      () => `the live region never said "${saying}"`,
    )
}

/** The checks, in the builder shown, which `framework` names. */
export async function eInvoiceChecks(gate, page, framework) {
  const { check } = gate
  const editor = editorOf(page)
  await open(page, 'e-invoice')
  await settled(page)
  await previewInView(page)
  const final = previewOf(page).getByRole('checkbox', { name: 'Final', exact: true })
  await final.check()
  await settled(page, FINAL)
  check(`${framework}: the e-invoice's final Download PDF embeds its XML, whose total the page prints, and its EPC QR code pays the XML's account`, await until(page, paying(STARTER_ACCOUNT)))

  // Its row, after the regions, clicked: the e-invoice selected, and the keyboard on the row.
  const tree = await showing(editor, 'Outline', editor.getByRole('tree', { name: said('pane.outline'), exact: true }))
  const row = tree.getByRole('treeitem', { name: said('outline.eInvoice'), exact: true })
  await row.click()
  // Waited for, as zoneless Angular draws the selection a frame after the click.
  const chosen = await tree
    .getByRole('treeitem', { name: said('outline.eInvoice'), exact: true, selected: true })
    .waitFor({ timeout: 5_000 })
    .then(
      () => null,
      () => 'the row is not selected',
    )
  check(`${framework}: its ${said('outline.eInvoice')} row selects the e-invoice`, chosen)
  check(`${framework}: with the keyboard on the row`, await onIt(page, row))

  // The buyer: its electronic address typed, the XML naming it under EM.
  const buyer = said('field.buyerAddress')
  check(`${framework}: the buyer's electronic address is typed into the e-invoice`, await typed(editor, buyer, ADDRESS, said('status.changed', { field: buyer })))
  check(`${framework}: and the final PDF's XML names it, under EM, beside the buyer the page prints`, await until(page, addressed(ADDRESS)))

  // A rate: the first category's, the XML's tax at it printed on the page.
  const rate = said('field.vatCategoryRate', { item: 1 })
  check(`${framework}: a VAT rate is typed into the e-invoice`, await typed(editor, rate, RATE, said('status.changed', { field: rate })))
  check(`${framework}: and the final PDF's XML taxes at it what the page prints`, await until(page, taxedAt(RATE)))

  // The account, typed once: the XML's and the EPC QR code's both.
  const iban = said('field.iban')
  check(`${framework}: an IBAN typed into the e-invoice's payment instructions is said to be every payment code's`, await typed(editor, iban, TYPED_ACCOUNT, said('status.accountShared', { field: iban })))
  check(`${framework}: and the final PDF's XML names it, and the EPC QR code its page draws, decoded from its pixels, pays it`, await until(page, paying(TYPED_ACCOUNT.replaceAll(' ', ''))))

  // Undone from the toolbar, each edit: the XML and the code are the starter's again.
  const undo = editor.getByRole('toolbar', { name: said('toolbar.label'), exact: true }).getByRole('button', { name: said('action.undo'), exact: true })
  for (let step = 0; step < 3; step += 1) if ((await undo.getAttribute('aria-disabled')) !== 'true') await undo.click()
  check(`${framework}: undone, the XML names no electronic address of the buyer's again, taxes at 19 %, and it and the code pay the starter's account`, await until(page, (invoice) => addressed(null)(invoice) ?? taxedAt('19')(invoice) ?? paying(STARTER_ACCOUNT)(invoice)))
  await previewInView(page)
  await final.uncheck()
  await settled(page)
}
