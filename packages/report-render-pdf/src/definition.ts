import type { Content, DynamicContent, TDocumentDefinitions } from 'pdfmake/interfaces.js'
import { QR_BILL_TOP, RenderRefusal, type Block, type ResolvedDocument, type Table } from '@formancy/report-runtime'
import type { CheckedBill } from './bill.js'
import { newBuild, type Build, type Fields, type TablePlan } from './build.js'
import type { Checked, Measured, Page } from './check.js'
import { contentOf } from './content.js'
import { PDF_A_3B } from './pdfa.js'
import { ABOVE_SLIP, slipContent } from './slip.js'
import type { RenderFonts } from './host-fonts.js'
import { DEFAULT_SIZE } from './style.js'
import { checkWords } from './words.js'

/**
 * The pdfmake document definitions a render hands pdfmake, built from the
 * resolved document and what was measured: pure, the same in Node and in a
 * browser, and the one place either entry's definitions come from. What
 * runs them is the entry's own (`node.ts`, `browser.ts`).
 *
 * The page regions: pdfmake draws its header inside the top page margin and
 * its footer inside the bottom one, and lays the body out between. So
 * pdfmake's margins are the document's enlarged by each region's measured
 * height and a 6pt gap, and each region is drawn at the document's own
 * margin: the header from the top of the printable area down, the footer
 * ending at its bottom. Nothing of the body can reach into either.
 */

/** The document's default text style: the font token-less text prints in -- the mapped `sans` host family, or Roboto -- at the default size (0043). */
export function defaultStyle(fonts: RenderFonts): { readonly font: string; readonly fontSize: number } {
  return { font: fonts.defaultFamily, fontSize: DEFAULT_SIZE }
}

/** Between the page header and the body, and between the body and the page footer. */
export const REGION_GAP = 6

/** Space each page region takes from the printable area, its gap to the body included; nothing for a region with no blocks. */
export interface Regions {
  readonly header: number
  readonly footer: number
}

/** What a measuring pass lays out: one item per thing measured, and the build that holds their images and marks. */
export interface Measurement {
  readonly items: readonly Content[]
  readonly build: Build
}

/**
 * The page header and footer that have blocks, each one item, with every
 * page field printed as the page limit: as many digits as the field can
 * have. A region that wraps only for some page numbers is measured at its
 * widest, which is not the same thing, and is not refused.
 */
export function regionsMeasurement(
  document: ResolvedDocument,
  checked: Checked,
  fonts: RenderFonts,
  maxPages: number,
): Measurement & { readonly present: readonly (readonly Block[])[] } {
  const fields: Fields = { pageNumber: maxPages, pageCount: maxPages }
  const present = [document.pageHeader, document.pageFooter].filter((blocks) => blocks.length > 0)
  const build = newBuild('measure', checked, fonts)
  return { present, build, items: present.map((blocks): Content => ({ stack: contentOf(blocks, build, checked.page.width, fields) })) }
}

/** The body's tables and keep-together blocks, each one item laid out at the width it stands at. */
export function bodyMeasurement(measured: readonly Measured[], checked: Checked, fonts: RenderFonts): Measurement {
  const build = newBuild('measure', checked, fonts)
  const items = measured.map(({ block, width }): Content => ({ stack: contentOf([block], build, width), margin: [0, 0, checked.page.width - width, 0] }))
  return { items, build }
}

/** Where the body starts and ends on every page, from the top of the paper: inside the margins and below and above the page regions. */
export function bodyBounds(page: Page, regions: Regions): { readonly top: number; readonly bottom: number } {
  return { top: page.margins.top + regions.header, bottom: page.paperHeight - page.margins.bottom - regions.footer }
}

/**
 * How much of the last page's body a QR-bill's slip takes: from where its
 * drawing starts, the instruction above it, to the body's foot. Nothing if
 * the body ends above the slip on every page.
 */
export function slipReservation(page: Page, regions: Regions): number {
  return Math.max(0, bodyBounds(page, regions).bottom - (QR_BILL_TOP - ABOVE_SLIP))
}

/**
 * The PDF's definition. pdfmake's own page limit, `maxPagesNumber`, cuts the
 * document short; the renderer's throws out of the layout instead, from the
 * function pdfmake calls for each page's background, as the page after the
 * last one allowed is added. So no more than one page past the limit is ever
 * laid out, and nothing is written.
 *
 * A QR-bill's slip is the last page's footer, in place of the page footer:
 * pdfmake lays the footer out once every page is, knowing their count, and
 * gives what is placed above the footer's top the room down to the paper's
 * foot (`pdfmake.test.ts` holds both). The body keeps the slip's room at
 * its end, a spacer as tall as `slipReservation`: where the last page has
 * less room left, pdfmake moves to a new page and starts it without the
 * space, and the slip has that page to itself.
 *
 * A document with an e-invoice is a PDF/A-3b, whose version and subset are
 * the definition's (`PDF_A_3B`); its file and XMP are the final pass's hook
 * (`render.ts`). Neither moves a line: the measuring passes, which have
 * neither, lay the page out as this one does.
 */
export function layoutDefinition(
  document: ResolvedDocument,
  checked: Checked,
  regions: Regions,
  plans: ReadonlyMap<Table, TablePlan>,
  fonts: RenderFonts,
  maxPages: number,
  bill?: CheckedBill,
): TDocumentDefinitions {
  const page: Page = checked.page
  const { margins } = page
  const { top: bodyTop, bottom: bodyBottom } = bodyBounds(page, regions)
  const build = newBuild('render', checked, fonts, { top: bodyTop, bottom: bodyBottom }, plans)
  const region = (blocks: readonly Block[], margin: [number, number, number, number]): DynamicContent | undefined => {
    if (blocks.length === 0) return undefined
    return (pageNumber, pageCount) => ({ stack: contentOf(blocks, build, page.width, { pageNumber, pageCount }), margin })
  }
  const header = region(document.pageHeader, [margins.left, margins.top, margins.right, 0])
  const footer = region(document.pageFooter, [margins.left, REGION_GAP, margins.right, 0])
  // Once now, so that their images are in the dictionary before pdfmake reads it.
  header?.(1, 1, { width: page.paperWidth, height: page.paperHeight, orientation: document.page.orientation })
  footer?.(1, 1, { width: page.paperWidth, height: page.paperHeight, orientation: document.page.orientation })
  // pdfmake lays the footer out from the body's foot, so the slip's parts are placed from there.
  const slip = bill === undefined ? undefined : (): Content => ({ stack: slipContent(bill, QR_BILL_TOP, bodyBottom, page.paperWidth) })
  const last: DynamicContent | undefined =
    slip === undefined ? footer : (pageNumber, pageCount, size) => (pageNumber === pageCount ? slip() : footer?.(pageNumber, pageCount, size))
  const reserved = bill === undefined ? [] : [{ stack: [], margin: [0, slipReservation(page, regions), 0, 0] } satisfies Content]
  return {
    ...(checked.pdfa === undefined ? {} : PDF_A_3B),
    info: { title: document.info.title, creationDate: checked.creationDate },
    pageSize: { width: page.paperWidth, height: page.paperHeight },
    pageMargins: [margins.left, bodyTop, margins.right, page.paperHeight - bodyBottom],
    defaultStyle: defaultStyle(fonts),
    content: [...contentOf(document.body, build, page.width), ...reserved],
    images: build.images,
    ...(header === undefined ? {} : { header }),
    ...(last === undefined ? {} : { footer: last }),
    background: (number) => {
      // pdfmake has measured every word, and laid out no line yet.
      if (number === 1) checkWords(build.words)
      if (number > maxPages) throw new RenderRefusal('too-many-pages', `the report needs more than ${maxPages} pages`)
      return null
    },
    pageBreakBefore: (node, queries) => {
      const rule = node.headlineLevel === undefined ? undefined : build.rules.get(node.headlineLevel)
      return rule?.(node, queries) ?? false
    },
  }
}
