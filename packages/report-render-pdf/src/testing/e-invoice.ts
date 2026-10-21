import { FACTUR_X, FACTUR_X_PROFILES, XRECHNUNG, XRECHNUNG_COPY_PARAGRAPH } from '@formancy/report-runtime'
import type { EInvoiceFile, FacturXFile, ResolvedDocument, XRechnungFile } from '@formancy/report-runtime'

/**
 * An e-invoice as the runtime hands one on, for the renderer's own tests
 * that need one without a report behind it: its XML, here cut short, and
 * the name, relationship and conformance level report-spec gives the EN
 * 16931 profile. The buyer's name in it stands for what the XML holds of
 * people -- a name, an account, a VAT identifier -- which no refusal may
 * name. The samples, resolved by the runtime, are `e-invoice.test.ts`'s.
 */
export const E_INVOICE_FILE: FacturXFile = {
  kind: 'facturX',
  xml: '<?xml version="1.0" encoding="UTF-8"?>\n<rsm:CrossIndustryInvoice><ram:Name>Erika Mustermann</ram:Name></rsm:CrossIndustryInvoice>\n',
  fileName: FACTUR_X.fileName,
  relationship: FACTUR_X_PROFILES.en16931.relationship,
  conformanceLevel: FACTUR_X_PROFILES.en16931.conformanceLevel,
}

/** An XRechnung as the runtime hands one on (0038): its XML, cut short as `E_INVOICE_FILE`'s, in CII, as report-spec names version 3.0. */
export const XRECHNUNG_FILE: XRechnungFile = {
  kind: 'xrechnung',
  xml: E_INVOICE_FILE.xml,
  syntax: XRECHNUNG['3.0'].syntax,
  guideline: XRECHNUNG['3.0'].guideline,
  version: '3.0',
}

/** `document` carrying `file`, whatever it is, as its e-invoice. */
export function invoiced(document: ResolvedDocument, file: unknown = E_INVOICE_FILE): ResolvedDocument {
  return { ...document, eInvoice: file as EInvoiceFile }
}

/** `document` as the runtime resolves a final XRechnung: carrying `file`, every page's header opening with the copy's label, the runtime's own paragraph. */
export function copied(document: ResolvedDocument, file: unknown = XRECHNUNG_FILE): ResolvedDocument {
  return invoiced({ ...document, pageHeader: [XRECHNUNG_COPY_PARAGRAPH, ...document.pageHeader] }, file)
}
