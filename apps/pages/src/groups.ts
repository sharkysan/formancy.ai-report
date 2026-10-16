/**
 * The site, as data: every page group, each built in every language (0021).
 * The product page first, which is each language's root; then the topic
 * pages, each linked from every page's bar and from the product page. The
 * invoice pages -- the Swiss QR-bill, SEPA's EPC code -- are added here by
 * the changes that build those features, and not before.
 */
import { HEALTHCARE_GROUP } from './content/healthcare.js'
import { PRODUCT_GROUP } from './content/product.js'
import type { PageGroup } from './pages.js'

export const GROUPS: readonly PageGroup[] = [PRODUCT_GROUP, HEALTHCARE_GROUP]
