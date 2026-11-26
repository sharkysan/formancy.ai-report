/**
 * The site, as data: every page group, each built in every language (0021).
 * The product page first, which is each language's root; then the topic
 * pages, each linked from every page's bar and from the product page. A
 * payment code's page comes with the change that builds its code, and not
 * before, one page for each code: the Swiss QR-bill's came after its slip
 * (0022, 0024), and the EPC QR code's after the code (0025, 0028). The
 * invoices page, the Word files page and the two report designers' pages
 * came with 0081, each of what 0.3.0 holds, in the order a reader meets
 * them: what Report bills, then each code, then the Word file, then the
 * builders.
 */
import { ANGULAR_GROUP } from './content/angular.js'
import { EPC_QR_CODE_GROUP } from './content/epc-qr-code.js'
import { HEALTHCARE_GROUP } from './content/healthcare.js'
import { INVOICES_GROUP } from './content/invoices.js'
import { PRODUCT_GROUP } from './content/product.js'
import { QR_BILL_GROUP } from './content/qr-bill.js'
import { REACT_GROUP } from './content/react.js'
import { WORD_GROUP } from './content/word.js'
import type { PageGroup } from './pages.js'

export const GROUPS: readonly PageGroup[] = [
  PRODUCT_GROUP,
  INVOICES_GROUP,
  QR_BILL_GROUP,
  EPC_QR_CODE_GROUP,
  WORD_GROUP,
  ANGULAR_GROUP,
  REACT_GROUP,
  HEALTHCARE_GROUP,
]
