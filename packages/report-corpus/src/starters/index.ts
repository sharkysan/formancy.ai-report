import { GROUPED_EQUIPMENT } from './grouped-equipment.js'
import { INVOICE } from './invoice.js'
import { QUOTATION } from './quotation.js'
import { INSPECTION_PHOTO, SERVICE_INSPECTION } from './service-inspection.js'
import type { Starter, StarterImage } from './starter.js'

export { equipmentData, equipmentRows, GROUPED_EQUIPMENT } from './grouped-equipment.js'
export { INVOICE, INVOICE_EN, INVOICE_FR, INVOICE_IT, INVOICE_SAMPLES, invoiceData, invoiceLines } from './invoice.js'
export { lineAmount, QUOTATION, quotationData, quotationLines } from './quotation.js'
export { INSPECTION_PHOTO, inspectionData, inspectionNotes, SERVICE_INSPECTION } from './service-inspection.js'
export type { Starter, StarterImage } from './starter.js'

/** The three starters of plan 7, in the order the plan lists them, then the invoice with its QR-bill. */
export const STARTERS: readonly Starter[] = [SERVICE_INSPECTION, QUOTATION, GROUPED_EQUIPMENT, INVOICE]

/** Every approved asset a starter's data names, with the bytes a host would hold for it. */
export const STARTER_IMAGES: readonly StarterImage[] = [INSPECTION_PHOTO]
