/**
 * The site, as data: every page group, each built in every language (0021).
 * The product page first, which is each language's root; then the topic
 * pages, each linked from every page's bar and from the product page. A
 * payment code's page comes with the change that builds its code, and not
 * before, one page for each code: the Swiss QR-bill's came after its slip
 * (0022, 0024), and the EPC QR code's after the code (0025, 0028).
 */
import { EPC_QR_CODE_GROUP } from './content/epc-qr-code.js'
import { HEALTHCARE_GROUP } from './content/healthcare.js'
import { PRODUCT_GROUP } from './content/product.js'
import { QR_BILL_GROUP } from './content/qr-bill.js'
import type { PageGroup } from './pages.js'

export const GROUPS: readonly PageGroup[] = [PRODUCT_GROUP, QR_BILL_GROUP, EPC_QR_CODE_GROUP, HEALTHCARE_GROUP]
