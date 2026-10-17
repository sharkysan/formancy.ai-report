/**
 * An EPC QR code lowered to the document's block: each text read in the
 * report's scope, held to the EPC's rules, and written into the payload the
 * renderer encodes. "EPC" is EPC069-12, version 3.1, by its section.
 *
 * - **Read as a paragraph.** Every text is its runs, read as a paragraph's
 *   in the report's scope and joined as a QR code's content is
 *   (`joinedText`): a final render refuses a run whose value is null, as
 *   `no-qr-value`, since the transfer would say less than the invoice --
 *   unless the text is optional and prints nothing else.
 * - **Held to the EPC's rules.** report-spec's checks (`epc-payload.ts`),
 *   the very functions its validator applies to a literal, are applied to
 *   every text once it has resolved: a literal passes again, and a value
 *   from data is held where the validator could not see it -- the IBAN's
 *   spaces dropped and its letters made capitals, its country's, its
 *   length and its check digits; the BIC, and whether the account needs
 *   one; the creditor reference; each text's characters and length. A rule
 *   broken is `invalid-epc-qr-code` on the field, naming the code and the
 *   rule and never the value, which may be a person's name or account.
 * - **An optional text that prints nothing is unused.** A BIC, a
 *   reference, a text or information the data gives empty, blank or null
 *   is an element the code leaves empty, as one the template does not
 *   have, in a final render as in a preview: a customer with no BIC on
 *   record is paid by version 002, never refused for a BIC that is no BIC.
 *   The validator refuses a blank literal instead, a second spelling of an
 *   element left out.
 * - **The same in a preview.** A preview prints a value that is null, or
 *   one its data lacks, as nothing, as a paragraph does; the code that
 *   leaves is held to the same rules, and refused where it breaks one,
 *   saying the preview had no value for it. A code the EPC refuses cannot
 *   be drawn as one: it would scan as a transfer no bank makes.
 * - **The amount** is a decimal, or null for the payer to fill in. Any
 *   other value is refused by its type, and a decimal is written with its
 *   own digits, as short as it can be, never rounded: one with more than
 *   two places is refused.
 * - **The payload** is report-spec's `epcPayload` of the checked texts,
 *   held to the EPC's 331 bytes in UTF-8, which only the whole can break.
 */
import { decimalToString } from '@formancy/expressions'
import { checkEpcAmount, checkEpcField, checkEpcPayload, EPC_TEXT_FIELDS, epcBlank, epcPairing, epcPayload } from '@formancy/report-spec'
import type { EpcQrCodeComponent, EpcTextField } from '@formancy/report-spec'
import type { EpcQrCode } from './document.js'
import { joinedText } from './inlines.js'
import type { Encoder } from './inlines.js'
import { valueOf } from './render-context.js'
import type { Render, Scope } from './render-context.js'

/** What a refusal adds when a preview had no value for a run of the text it refuses. */
const LACKED = '; this preview has no value for a run of it'

/** What lowering one code reads, and records its errors in. */
interface Lowering {
  readonly render: Render
  readonly scope: Scope
  readonly code: EpcQrCodeComponent
  readonly path: string
  readonly encoder: Encoder
}

function refuse({ render, code, encoder }: Lowering, path: string, message: string): undefined {
  render.problems.error({ stage: 'resolve', code: 'invalid-epc-qr-code', path, message: `${encoder.said}: ${message}`, componentId: code.id })
  return undefined
}

/** A text as its rule made it, '' for an element the code leaves unused, and whether a preview lacked a value for a run of it. */
interface Checked {
  readonly text: string
  readonly lacking: boolean
}

/**
 * The text `key` of the code, resolved and held to its field's rule
 * (report-spec's `EPC_TEXT_FIELDS`); undefined when a run or the rule
 * refused it, which is recorded. An optional text that prints nothing a
 * payer reads (`epcBlank`), nulls and all, is its element unused, and no
 * rule is asked.
 */
function checked(lowering: Lowering, key: EpcTextField): Checked | undefined {
  const runs = lowering.code[key]
  if (runs === undefined) return { text: '', lacking: false }
  const path = `${lowering.path}/${key}`
  const { what, optional } = EPC_TEXT_FIELDS[key]
  const joined = joinedText(lowering.render, lowering.scope, runs, path, lowering.encoder, optional ? epcBlank : undefined)
  if (joined === undefined) return undefined
  if (optional && epcBlank(joined.text)) return { text: '', lacking: joined.lacking }
  const outcome = checkEpcField(key, joined.text)
  if (outcome.ok) return { text: outcome.value, lacking: joined.lacking }
  return refuse(lowering, path, `${what} ${outcome.rule}${joined.lacking ? LACKED : ''}`)
}

/** The amount as the code writes it after `EUR`, '' for the payer to fill in, or undefined when it is refused, which is recorded. */
function amount(lowering: Lowering): string | undefined {
  if (lowering.code.amount === undefined) return ''
  const path = `${lowering.path}/amount`
  const value = valueOf(lowering.render, lowering.scope, `${path}/cel`)
  if (value === undefined) return undefined
  if (value === null) return ''
  if (value.type !== 'decimal') return refuse(lowering, path, `the amount gives ${value.type}, and an EPC QR code's amount is a decimal in euro, or null to leave it for the payer`)
  const outcome = checkEpcAmount(decimalToString(value.value))
  return outcome.ok ? outcome.value : refuse(lowering, path, `the amount ${outcome.rule}`)
}

/**
 * The block the EPC QR code `code`, at `path`, prints, read in `scope`;
 * undefined when anything of it is refused, which is recorded. Every text
 * is read and every rule broken said, not the first alone.
 */
export function epcQrCodeBlock(render: Render, scope: Scope, code: EpcQrCodeComponent, path: string): EpcQrCode | undefined {
  const lowering: Lowering = { render, scope, code, path, encoder: { said: `component ${code.id}`, componentId: code.id, code: 'an EPC QR code' } }
  const bic = checked(lowering, 'bic')
  const beneficiary = checked(lowering, 'beneficiary')
  const iban = checked(lowering, 'iban')
  const sum = amount(lowering)
  const reference = checked(lowering, 'reference')
  const text = checked(lowering, 'text')
  const information = checked(lowering, 'information')
  // What the IBAN and the BIC break together, each already held to its own rules: a BIC that prints nothing is none.
  const pairing = epcPairing(iban?.text, bic === undefined ? undefined : bic.text === '' ? null : bic.text)
  for (const { field, rule } of pairing) refuse(lowering, `${path}/${field}`, `${rule}${bic?.lacking === true ? LACKED : ''}`)
  if (pairing.length > 0 || bic === undefined || beneficiary === undefined || iban === undefined || sum === undefined || reference === undefined || text === undefined || information === undefined) return undefined
  const payload = epcPayload({
    bic: bic.text,
    beneficiary: beneficiary.text,
    iban: iban.text,
    amount: sum,
    purpose: code.purpose,
    reference: reference.text,
    text: text.text,
    information: information.text,
  })
  const bytes = checkEpcPayload(payload)
  if (!bytes.ok) return refuse(lowering, path, `its payload ${bytes.rule}`)
  return { kind: 'epcQrCode', id: code.id, payload, size: code.size, ...(code.caption === undefined ? {} : { caption: code.caption }) }
}
