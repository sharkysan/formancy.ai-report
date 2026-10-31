import { EDGE, imageLabel, once, OVERLAP, pictures, plural, points, quoted, TOP_EDGE_PER_POINT, type Page } from './check-page.js'
import { pageDimensions, type PageSetup } from './document.js'
import { normalise, type Expectation, type ExpectedImage } from './fixture.js'
import { lineHas, type Line } from './lines.js'
import type { PdfBox } from './read-pdf.js'

/**
 * Where things are on the page: how many pages and of what size, the page
 * regions above and below the body, what the body holds, and that nothing
 * crosses a margin or another piece of text.
 *
 * Every position is a box computed from a run's baseline and font size
 * (`read-pdf.ts`), not traced from its glyphs. An accent or a descender
 * reaches past its box, so glyphs that touch by less than `OVERLAP` beyond
 * the boxes -- an ogonek in one line meeting the acute of a capital in the
 * line below, in text set tighter than any fixture sets it -- are not seen.
 * Page images are the evidence for those, and for anything drawn as vector
 * paths rather than text or images, text clipped by a clipping path, and
 * colour: white text on white extracts perfectly. An SVG image is the one
 * vector drawing read here, by the box of the clip it is painted inside
 * (`drawings.ts`), where an image is read by its own.
 */

export function pageCount(pages: readonly Page[], expected: Expectation): string[] {
  if (pages.length < expected.minPagesExpected) return [`${plural(pages.length, 'page')}; at least ${expected.minPagesExpected} expected`]
  if (pages.length > expected.maxPagesExpected) return [`${plural(pages.length, 'page')}; at most ${expected.maxPagesExpected} expected`]
  return []
}

export function pageSizes(pages: readonly Page[], setup: PageSetup): string[] {
  const { width, height } = pageDimensions(setup)
  return pages
    .filter(({ page }) => Math.abs(page.width - width) > EDGE || Math.abs(page.height - height) > EDGE)
    .map(({ page }) => `page ${page.number} is ${page.width} × ${page.height} pt; the document asks for ${width} × ${height}`)
}

/**
 * On every page, each line of the page header and footer, the header's
 * above every line of the body and the footer's below every line and image
 * of the body. A footer drawn at the top of the page, or into the last row
 * between two of its cells where no box crosses another, is reported here.
 */
export function regions(pages: readonly Page[], expected: Expectation): string[] {
  return pages.flatMap((each) => {
    const { page, header, footer, body } = each
    const problems = [
      ...missing(header, expected.pageHeaderLines).map((text) => `page ${page.number}: the page header line ${quoted(text)} is missing`),
      ...missing(footer, expected.pageFooterLines).map((text) => `page ${page.number}: the page footer line ${quoted(text)} is missing`),
    ]
    const headerFoot = Math.max(...header.map((line) => line.bottom))
    const highest = body[0]
    if (highest !== undefined && highest.top < headerFoot - OVERLAP) {
      problems.push(
        `page ${page.number}: ${quoted(highest.text)} starts at ${points(highest.top)} pt, above the foot of the page header at ${points(headerFoot)}`,
      )
    }
    const footerTop = Math.min(...footer.map((line) => line.top))
    const lowest = body.reduce<Line | undefined>((low, line) => (low === undefined || line.bottom > low.bottom ? line : low), undefined)
    if (lowest !== undefined && lowest.bottom > footerTop + OVERLAP) {
      problems.push(`page ${page.number}: ${quoted(lowest.text)} reaches ${points(lowest.bottom)} pt, below the top of the page footer at ${points(footerTop)}`)
    }
    for (const { label, box } of pictures(each)) {
      if (box.top < footerTop && box.bottom > footerTop + OVERLAP) {
        problems.push(`page ${page.number}: ${label} reaches ${points(box.bottom)} pt, below the top of the page footer at ${points(footerTop)}`)
      }
    }
    return problems
  })
}

function missing(lines: readonly Line[], expected: readonly string[]): string[] {
  return expected.filter((text) => !lines.some((line) => line.text === normalise(text)))
}

/** On every page, a line matching the footer, numbering this page and counting them all. */
export function footers(pages: readonly Page[], pattern: RegExp): string[] {
  const matcher = once(pattern)
  return pages.flatMap(({ page, lines }) => {
    const matched = lines.map((line) => matcher.exec(line.text)).filter((match) => match !== null)
    const correct = matched.find(
      (match) =>
        (match.groups?.['pageNumber'] ?? String(page.number)) === String(page.number) &&
        (match.groups?.['pageCount'] ?? String(pages.length)) === String(pages.length),
    )
    if (correct !== undefined) return []
    const [first] = matched
    if (first === undefined) return [`page ${page.number}: no line matches the footer ${String(pattern)}`]
    return [`page ${page.number}: the footer says '${first[0]}'; this is page ${page.number} of ${pages.length}`]
  })
}

/** A page with nothing between its page header and footer: an accidental page break, or a table that left only its regions behind. */
export function emptyPages(pages: readonly Page[]): string[] {
  return pages
    .filter((each) => each.body.length === 0 && pictures(each).length === 0)
    .map(({ page }) => `page ${page.number} prints nothing between its page header and footer`)
}

/** Where a kept-together group is: the one page all its lines are on, and its first line there. */
function placed(pages: readonly Page[], group: readonly string[]): { page: Page; first: Line } | undefined {
  const page = pages.find(({ body }) => group.every((text) => body.some((line) => lineHas(line, text))))
  const first = page?.body.find((line) => lineHas(line, group[0] ?? ''))
  return page === undefined || first === undefined ? undefined : { page, first }
}

export function keptTogether(pages: readonly Page[], group: readonly string[]): string[] {
  if (placed(pages, group) !== undefined) return []
  const where = group.map((text) => pages.filter(({ lines }) => lines.some((line) => lineHas(line, text))).map(({ page }) => page.number))
  const absent = group.filter((_, index) => where[index]!.length === 0)
  if (absent.length > 0)
    return absent.map((text) => `${quoted(text)}, which must be kept together with ${plural(group.length - 1, 'other line')}, is not on any page`)
  return [`${group.map((text) => quoted(text)).join(', ')} are split across pages ${[...new Set(where.flat())].sort((a, b) => a - b).join(', ')}`]
}

/**
 * Kept-together groups in order of the room left for them: those that fit
 * under what precedes them on its page first, then those that start a page
 * of their own, and at least one of each. A group starts its page when no
 * line or image of the body stands above its first line. Groups that are
 * not whole on one page are left to `keptTogether`.
 */
export function keptByRoom(pages: readonly Page[], groups: readonly (readonly string[])[]): string[] {
  const found = groups.flatMap((group) => {
    const at = placed(pages, group)
    if (at === undefined) return []
    const above = (box: PdfBox | Line): boolean => box.bottom <= at.first.top + OVERLAP
    return [{ text: group[0] ?? '', page: at.page.page.number, moved: !at.page.body.some(above) && !pictures(at.page).some(({ box }) => above(box)) }]
  })
  if (found.length === 0) return []
  const firstMoved = found.findIndex((group) => group.moved)
  if (firstMoved < 0) return [`no kept-together group starts a page of its own: none reached the page boundary`]
  if (firstMoved === 0) return [`every kept-together group starts a page of its own: none fitted under what precedes it`]
  const stayed = found.slice(firstMoved).find((group) => !group.moved)
  if (stayed === undefined) return []
  const moved = found[firstMoved]!
  return [
    `${quoted(stayed.text)} fits under what precedes it on page ${stayed.page}, though ${quoted(moved.text)}, which had more room, moved to page ${moved.page}`,
  ]
}

export function outsidePrintable(pages: readonly Page[], setup: PageSetup): string[] {
  const { margins } = setup
  return pages.flatMap((each) => {
    const { page } = each
    const boxes: { label: string; box: PdfBox; topEdge: number }[] = [
      ...page.items.map((item) => ({ label: quoted(item.text), box: item, topEdge: EDGE + TOP_EDGE_PER_POINT * item.height })),
      ...pictures(each).map(({ label, box }) => ({ label, box, topEdge: EDGE })),
    ]
    const right = page.width - margins.right
    const bottom = page.height - margins.bottom
    return boxes.flatMap(({ label, box, topEdge }) => {
      const past: string[] = []
      if (box.x < margins.left - EDGE) past.push(`the left margin (from ${points(box.x)} pt; the margin is at ${points(margins.left)})`)
      if (box.x + box.width > right + EDGE) past.push(`the right margin (to ${points(box.x + box.width)} pt; the margin is at ${points(right)})`)
      if (box.top < margins.top - topEdge) past.push(`the top margin (from ${points(box.top)} pt; the margin is at ${points(margins.top)})`)
      if (box.bottom > bottom + EDGE) past.push(`the bottom margin (to ${points(box.bottom)} pt; the margin is at ${points(bottom)})`)
      return past.map((edge) => `page ${page.number}: ${label} extends past ${edge}`)
    })
  })
}

/** Every pair of text runs, images and drawings on a page that share more than `OVERLAP` both ways. */
export function overlaps(pages: readonly Page[]): string[] {
  return pages.flatMap((each) => {
    const { page } = each
    const boxes = [...page.items.map((item) => ({ label: quoted(item.text), box: item })), ...pictures(each)].sort((a, b) => a.box.top - b.box.top)
    const found: string[] = []
    boxes.forEach(({ label, box }, index) => {
      for (const other of boxes.slice(index + 1)) {
        if (other.box.top >= box.bottom - OVERLAP) break
        const across = Math.min(box.x + box.width, other.box.x + other.box.width) - Math.max(box.x, other.box.x)
        const down = Math.min(box.bottom, other.box.bottom) - Math.max(box.top, other.box.top)
        if (across > OVERLAP && down > OVERLAP) found.push(`page ${page.number}: ${label} overlaps ${other.label} by ${points(across)} × ${points(down)} pt`)
      }
    })
    return found
  })
}

/**
 * The images the PDF embeds against the document's PNGs and JPEGs: each
 * page region's on every page, then the body's in page order and the order
 * each page draws them, as many, each at its size. An SVG image is drawn
 * as vectors, never as an image, and `drawings.ts` finds it.
 */
export function images(pages: readonly Page[], expected: Expectation): string[] {
  const raster = (list: readonly ExpectedImage[]): ExpectedImage[] => list.filter((image) => image.kind === 'raster')
  const [regions, body] = [raster(expected.pageRegionImages), raster(expected.images)]
  const sized = (image: PdfBox, { width, height }: ExpectedImage): boolean => Math.abs(image.width - width) <= EDGE && Math.abs(image.height - height) <= EDGE
  const problems: string[] = []
  const drawn = pages.flatMap(({ page }) => {
    const left = [...page.images]
    for (const image of regions) {
      const at = left.findIndex((each) => sized(each, image))
      if (at < 0) problems.push(`page ${page.number}: the page regions' image of ${image.width} × ${image.height} pt is not drawn`)
      else left.splice(at, 1)
    }
    return left.map((image) => ({ image, page: page.number }))
  })
  if (drawn.length !== body.length) return [...problems, `${plural(drawn.length, 'image')} drawn; ${body.length} expected`]
  return [
    ...problems,
    ...drawn.flatMap(({ image, page }, index) => {
      const { width, height } = body[index]!
      return sized(image, body[index]!)
        ? []
        : [`page ${page}: ${imageLabel(image)} is drawn ${points(image.width)} × ${points(image.height)} pt; the document draws it ${width} × ${height}`]
    }),
  ]
}
