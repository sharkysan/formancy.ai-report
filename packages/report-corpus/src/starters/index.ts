import type { ImageResolver } from '@formancy/report-runtime'
import { EURO_INVOICE } from './euro-invoice.js'
import { GROUPED_EQUIPMENT } from './grouped-equipment.js'
import { INVOICE } from './invoice.js'
import { LOGO } from './logo.js'
import { QUOTATION } from './quotation.js'
import { INSPECTION_PHOTO, SERVICE_INSPECTION } from './service-inspection.js'
import type { Starter, StarterImage } from './starter.js'

export { E_INVOICE, E_INVOICE_EXEMPT_PAID, E_INVOICE_REVERSE_CHARGE, E_INVOICE_SAMPLES, eInvoiceData, exemptPaidData, reverseChargeData } from './e-invoice.js'
export { EURO_INVOICE, EURO_INVOICE_AT, EURO_INVOICE_ES, EURO_INVOICE_FR, EURO_INVOICE_IE, EURO_INVOICE_IT, EURO_INVOICE_NL, EURO_INVOICE_SAMPLES, euroInvoiceData, euroInvoiceLines } from './euro-invoice.js'
export { equipmentData, equipmentRows, GROUPED_EQUIPMENT } from './grouped-equipment.js'
export { INVOICE, INVOICE_EN, INVOICE_FR, INVOICE_IT, INVOICE_SAMPLES, invoiceData, invoiceLines } from './invoice.js'
export { LETTERHEAD, LOGO, LOGO_ASSET } from './logo.js'
export { lineAmount, QUOTATION, quotationData, quotationLines } from './quotation.js'
export { INSPECTION_PHOTO, inspectionData, inspectionNotes, SERVICE_INSPECTION } from './service-inspection.js'
export type { Starter, StarterImage } from './starter.js'

/** The three starters of plan 7, in the order the plan lists them, then the invoice with its QR-bill and the invoice with its EPC code. */
export const STARTERS: readonly Starter[] = [SERVICE_INSPECTION, QUOTATION, GROUPED_EQUIPMENT, INVOICE, EURO_INVOICE]

/** Every approved asset a starter's or a sample's data or template names, with the bytes a host would hold for it: the inspection's photo, and the firm's mark. */
export const STARTER_IMAGES: readonly StarterImage[] = [INSPECTION_PHOTO, LOGO]

/** The host's lookup of its approved assets, as the runtime asks it: a starter's image by its id and digest, or nothing. */
export const starterImages: ImageResolver = (ref) => STARTER_IMAGES.find((image) => image.asset === ref.asset && image.digest === ref.digest)
