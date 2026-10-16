/**
 * sitemap.xml: every page, each with its translations as alternates, as
 * Google reads hreflang from a sitemap. Served at /report/sitemap.xml;
 * formancy.ai's robots.txt is that repository's, so the sitemap is named
 * to Google Search Console by hand (0021).
 */

/** A page as the sitemap lists it: its address, and its alternates by hreflang. */
export interface SitemapEntry {
  readonly url: string
  readonly alternates: readonly (readonly [string, string])[]
}

const escape = (text: string): string => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')

export function sitemap(entries: readonly SitemapEntry[]): string {
  const urls = entries.map(({ url, alternates }) =>
    [
      '  <url>',
      `    <loc>${escape(url)}</loc>`,
      ...alternates.map(([language, href]) => `    <xhtml:link rel="alternate" hreflang="${escape(language)}" href="${escape(href)}"/>`),
      '  </url>',
    ].join('\n'),
  )
  return ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">', ...urls, '</urlset>', ''].join('\n')
}
