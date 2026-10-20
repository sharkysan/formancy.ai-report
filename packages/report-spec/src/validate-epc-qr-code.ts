/**
 * An EPC QR code: its shape, and the EPC's rules applied to every text no
 * data can change.
 *
 * Its texts are runs read in the report's scope and encoded in the code,
 * so they read what a paragraph in its place reads and never a page number
 * or count, as `validate-payment-text.ts` reads every payment code's. A
 * text of literal runs prints the same in every render, so
 * `epc-payload.ts`'s rules are applied to it here, where it is written; any
 * other is checked by the runtime with the same rules, once the data has
 * resolved it. A literal optional text that is blank is refused as the
 * text left out, so that a code has one spelling (`checkEpcField`). What
 * only literal texts can say together is said too: a BIC the IBAN does not
 * go with, and a payload already past its bytes before any data is read.
 */
import { oneOf, optional, reference } from './check.js'
import type { ComponentBase } from './components.js'
import type { RegionName } from './definition.js'
import { checkEpcField, checkEpcPayload, checkEpcPurpose, EPC_TEXT_FIELDS, epcPairing, epcPayload } from './epc-payload.js'
import type { EpcTextField } from './epc-payload.js'
import { epcCaptionBreak } from './epc-print.js'
import { EPC_CAPTIONS } from './epc-qr-code.js'
import type { EpcQrCodeComponent } from './epc-qr-code.js'
import { at } from './pointer.js'
import type { Ctx } from './validate-context.js'
import { readExpression } from './validate-inline.js'
import { readPaymentText } from './validate-payment-text.js'
import type { PaymentScope, PaymentText } from './validate-payment-text.js'

export const EPC_QR_CODE_REQUIRED = ['size', 'beneficiary', 'iban']
export const EPC_QR_CODE_OPTIONAL = ['bic', 'amount', 'purpose', 'reference', 'text', 'information', 'caption']

/** Whether a property that is present was read: absent is read, as nothing. */
const read = (o: Record<string, unknown>, key: string, value: unknown): boolean => o[key] === undefined || value !== undefined

/** The purpose, a literal string the template writes, held to its rule. */
function readPurpose(c: Ctx, value: unknown, path: string): string | undefined {
  const code = reference(c.f, value, path)
  if (code === undefined) return undefined
  const checked = checkEpcPurpose(code)
  if (checked.ok) return code
  c.f.report(path, 'invalid-epc-qr-code', `the purpose ${checked.rule}`)
  return undefined
}

/**
 * The rules only literal texts can break together: a reference and a text
 * both present (EPC069-12 2.2, {Or}), whatever reads them; a BIC the IBAN
 * does not go with, or none where one is needed; and a payload past its
 * bytes on what the literal texts write alone. A text read from data
 * writes nothing here, and the amount nothing: each can only add bytes,
 * so what is left is the least the code holds.
 */
function readTogether(c: Ctx, o: Record<string, unknown>, path: string, texts: Readonly<Record<EpcTextField, PaymentText<string>>>, purpose: string | undefined): void {
  if (o.reference !== undefined && o.text !== undefined) {
    c.f.report(at(path, 'text'), 'invalid-epc-qr-code', 'a code holds a creditor reference or a text, never both: only one of the two may be populated (EPC069-12 2.2)')
  }
  const bic = o.bic === undefined ? null : texts.bic.checked
  for (const { field, rule } of epcPairing(texts.iban.checked, bic)) c.f.report(at(path, field), 'invalid-epc-qr-code', rule)
  const least = epcPayload({
    bic: texts.bic.checked,
    beneficiary: texts.beneficiary.checked ?? '',
    iban: texts.iban.checked ?? '',
    purpose,
    reference: texts.reference.checked,
    text: texts.text.checked,
    information: texts.information.checked,
  })
  const bytes = checkEpcPayload(least)
  if (!bytes.ok) c.f.report(path, 'invalid-epc-qr-code', `its literal texts alone make a payload that ${bytes.rule}`)
}

/**
 * The EPC QR code at `path`, standing in `region`, its square `size`
 * already read; undefined when anything in it could not be.
 */
export function readEpcQrCode(c: Ctx, o: Record<string, unknown>, path: string, region: RegionName, base: ComponentBase | undefined, size: number | undefined): EpcQrCodeComponent | undefined {
  const scope: PaymentScope = { region, reads: 'report', encoded: 'an EPC QR code' }
  const field = (key: EpcTextField): PaymentText<string> =>
    readPaymentText(c, o[key], at(path, key), scope, 'invalid-epc-qr-code', EPC_TEXT_FIELDS[key].what, (written) => checkEpcField(key, written))
  const texts = {
    beneficiary: field('beneficiary'),
    iban: field('iban'),
    bic: field('bic'),
    reference: field('reference'),
    text: field('text'),
    information: field('information'),
  }
  const amount = readExpression(c.f, o.amount, at(path, 'amount'))
  const purpose = readPurpose(c, o.purpose, at(path, 'purpose'))
  const caption = oneOf(c.f, o.caption, at(path, 'caption'), EPC_CAPTIONS)
  readTogether(c, o, path, texts, purpose)
  const small = caption === undefined || size === undefined ? undefined : epcCaptionBreak(size)
  if (small !== undefined) c.f.report(at(path, 'size'), 'invalid-epc-qr-code', small)
  if (
    base === undefined ||
    size === undefined ||
    texts.beneficiary.runs === undefined ||
    texts.iban.runs === undefined ||
    !read(o, 'bic', texts.bic.runs) ||
    !read(o, 'amount', amount) ||
    !read(o, 'purpose', purpose) ||
    !read(o, 'reference', texts.reference.runs) ||
    !read(o, 'text', texts.text.runs) ||
    !read(o, 'information', texts.information.runs) ||
    !read(o, 'caption', caption)
  ) {
    return undefined
  }
  return {
    ...base,
    kind: 'epcQrCode',
    size,
    beneficiary: texts.beneficiary.runs,
    iban: texts.iban.runs,
    ...optional('bic', texts.bic.runs),
    ...optional('amount', amount),
    ...optional('purpose', purpose),
    ...optional('reference', texts.reference.runs),
    ...optional('text', texts.text.runs),
    ...optional('information', texts.information.runs),
    ...optional('caption', caption),
  }
}
