import type { Fixture } from '../fixture.js'
import { decimals } from './decimals.js'
import { emptyDataset } from './empty-dataset.js'
import { fonts } from './fonts.js'
import { groupBoundary } from './group-boundary.js'
import { imageInvalid, images } from './images.js'
import { longParagraph } from './long-paragraph.js'
import { longTable } from './long-table.js'
import { nullMissing } from './null-missing.js'
import { oneRow } from './one-row.js'
import { oversized } from './oversized.js'
import { summaryFits, summaryOverflows } from './summary.js'
import { tallRow } from './tall-row.js'

/** The corpus every engine answers to, in the order of the plan's section 20. */
export const ALL_FIXTURES: readonly Fixture[] = [
  emptyDataset,
  oneRow,
  longTable,
  tallRow,
  longParagraph,
  groupBoundary,
  summaryFits,
  summaryOverflows,
  decimals,
  nullMissing,
  fonts,
  images,
  imageInvalid,
  oversized,
]
