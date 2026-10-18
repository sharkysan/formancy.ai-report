import { FACTUR_X, FACTUR_X_PROFILES } from '@formancy/report-runtime'
import type { EInvoiceFile, ResolvedDocument } from '@formancy/report-runtime'

/**
 * An e-invoice as the runtime hands one on, for the renderer's own tests
 * that need one without a report behind it: its XML, here cut short, and
 * the name, relationship and conformance level report-spec gives the EN
 * 16931 profile. The buyer's name in it stands for what the XML holds of
 * people -- a name, an account, a VAT identifier -- which no refusal may
 * name. The samples, resolved by the runtime, are `e-invoice.test.ts`'s.
 */
export const E_INVOICE_FILE: EInvoiceFile = {
  xml: '<?xml version="1.0" encoding="UTF-8"?>\n<rsm:CrossIndustryInvoice><ram:Name>Erika Mustermann</ram:Name></rsm:CrossIndustryInvoice>\n',
  fileName: FACTUR_X.fileName,
  relationship: FACTUR_X_PROFILES.en16931.relationship,
  conformanceLevel: FACTUR_X_PROFILES.en16931.conformanceLevel,
}

/** `document` carrying `file`, whatever it is, as its e-invoice. */
export function invoiced(document: ResolvedDocument, file: unknown = E_INVOICE_FILE): ResolvedDocument {
  return { ...document, eInvoice: file as EInvoiceFile }
}
