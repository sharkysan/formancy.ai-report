/**
 * What the pages' browser gate measures, derived: the widths from the
 * stylesheet the pages serve and the pages from the sitemap the build wrote,
 * so a breakpoint or a page added is measured without anybody editing the gate.
 */

/** The rule and prelude of every `@media` or `@container` rule of `css` that asks about the width, or a container's inline size. */
const WIDTH_QUERY = /@(media|container)\s*([^{]*\b(?:width|inline-size)\b[^{]*)\{/g

/** The one form the passes read: `(max-width: Nrem)`, alone, of the window. */
const READ = /^\(\s*max-width:\s*([\d.]+)rem\s*\)$/

/**
 * Every width query of `css` as a breakpoint in CSS pixels. A query in any
 * other form -- a `min-width`, a breakpoint in pixels or em, the range
 * syntax, a query joined to another -- is refused, naming it: the passes
 * would leave the layout at its edge measured by nobody. So is every
 * container query, whatever its form: it asks about its container's
 * width, which no pass sets.
 */
function breakpointsOf(css) {
  const queries = [...css.matchAll(WIDTH_QUERY)].map((match) => ({ rule: match[1], query: (match[2] ?? '').trim() }))
  const unread = [
    ...new Set(
      queries.filter(({ rule, query }) => rule !== 'media' || !READ.test(query)).map(({ rule, query }) => (rule === 'media' ? query : `@${rule} ${query}`)),
    ),
  ]
  if (unread.length > 0) throw new Error(`the pages' stylesheet asks about the width in a form the gate does not measure: ${unread.join(', ')}`)
  return queries.map(({ query }) => Number(READ.exec(query)?.[1]) * 16)
}

/**
 * The passes worth measuring: the reflow width (WCAG 2.2 SC 1.4.10, 320 CSS
 * pixels with no horizontal scrolling), the same with the web fonts refused,
 * a phone, one pixel past each breakpoint, where the wider layout is at its
 * narrowest, a laptop and a screen.
 */
export function sitePasses(css) {
  const breakpoints = breakpointsOf(css)
  if (breakpoints.length === 0) throw new Error("found no max-width breakpoint in the pages' stylesheet, so the widths below measure nothing")
  return [
    { label: 'reflow, 320', width: 320, height: 900 },
    { label: 'reflow, 320, web fonts refused', width: 320, height: 900, refuseFonts: true },
    { label: 'phone, 360', width: 360, height: 900 },
    ...[...new Set([...breakpoints.map((px) => px + 1), 1280, 1920])]
      .sort((a, b) => a - b)
      .map((width) =>
        width === 1280
          ? { label: 'laptop, 1280', width, height: 900 }
          : width === 1920
            ? { label: 'screen, 1920', width, height: 1080 }
            : { label: `one past the ${width - 1}px breakpoint`, width, height: 900 },
      ),
  ]
}

/** Every page the sitemap lists, in order, at the address `served` stands for `site`. */
export function sitemapPages(xml, site, served) {
  const locs = [...xml.matchAll(/<loc>([^<]*)<\/loc>/g)].map((match) => match[1])
  if (locs.length === 0) throw new Error('the sitemap lists no page, so the gate would measure nothing')
  return locs.map((loc) => {
    if (!loc.startsWith(site)) throw new Error(`the sitemap lists ${loc}, outside the site ${site}`)
    return served + loc.slice(site.length)
  })
}
