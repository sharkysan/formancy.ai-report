/**
 * What a search engine reads from a page's head, held for every page: the
 * page set itself, the language, the title and description and their
 * lengths, the canonical address, the alternates and their reciprocity,
 * Open Graph, and the sitemap that lists them all.
 */
import { DEFAULT_LANGUAGE, LANGUAGE, LANGUAGES } from '../languages.js'
import type { PageGroup } from '../pages.js'
import { pathOf } from '../pages.js'
import type { Built } from './read.js'
import { alternatesIn, metaOf, read, textOf } from './read.js'

/** Google shows about 60 characters of a title, and a description of 70 to 160 is neither thin nor cut. */
export const TITLE = { max: 60 } as const
export const DESCRIPTION = { min: 70, max: 160 } as const

/** Every group in every language, once each, at the path the URL scheme gives it, and nothing else. */
export function pageSetProblems({ site }: Built, groups: readonly PageGroup[]): string[] {
  const problems: string[] = []
  const expected = groups.flatMap((group) => LANGUAGES.map((language) => ({ group: group.id, language, file: `${pathOf(group, language)}index.html` })))
  for (const each of expected) {
    const found = site.pages.filter((page) => page.group === each.group && page.language === each.language)
    if (found.length !== 1) problems.push(`${each.group} has ${String(found.length)} pages in ${each.language}, not one`)
    else if (found[0]?.file !== each.file) problems.push(`${each.group} in ${each.language} is at ${String(found[0]?.file)}, not ${each.file}`)
  }
  for (const page of site.pages) if (!expected.some((each) => each.file === page.file)) problems.push(`${page.file} is no group's page in any language`)
  const paths = site.files.map((file) => file.path)
  for (const path of new Set(paths)) if (paths.filter((each) => each === path).length > 1) problems.push(`${path} is written twice`)
  const slugs = new Set(groups.map((group) => JSON.stringify(group.slug)))
  if (slugs.size !== groups.length) problems.push('two page groups share their slugs')
  return problems
}

/** The head of every page. */
export function headProblems(built: Built): string[] {
  const problems: string[] = []
  const { site } = built
  const byUrl = new Map(site.pages.map((page) => [page.url, page]))
  for (const page of site.pages.map(read)) {
    const { document, file } = page
    const say = (problem: string): void => void problems.push(`${file}: ${problem}`)
    const lang = document.documentElement.getAttribute('lang')
    if (lang !== page.language) say(`<html lang> is ${String(lang)}, not ${page.language}`)
    const titles = [...document.querySelectorAll('head title')]
    const title = textOf(titles[0])
    if (titles.length !== 1) say(`${String(titles.length)} titles, not one`)
    if (title === '' || title.length > TITLE.max) say(`the title is ${String(title.length)} characters, not 1 to ${String(TITLE.max)}: "${title}"`)
    const descriptions = metaOf(document, 'name', 'description')
    const description = descriptions[0] ?? ''
    if (descriptions.length !== 1) say(`${String(descriptions.length)} descriptions, not one`)
    if (description.length < DESCRIPTION.min || description.length > DESCRIPTION.max) say(`the description is ${String(description.length)} characters, not ${String(DESCRIPTION.min)} to ${String(DESCRIPTION.max)}: "${description}"`)
    if (metaOf(document, 'name', 'robots').some((value) => /noindex|none/i.test(value))) say('asks not to be indexed')

    const canonical = [...document.querySelectorAll('link[rel="canonical"]')].map((link) => link.getAttribute('href'))
    if (canonical.length !== 1 || canonical[0] !== page.url) say(`its canonical is ${JSON.stringify(canonical)}, not its own address ${page.url}`)

    // Every language and x-default, once each; each the same group's page in
    // that language; x-default the default language's; and each naming this
    // page back in this page's language.
    const alternates = alternatesIn(document)
    const wanted = [...LANGUAGES, 'x-default']
    const named = alternates.map(([language]) => language)
    if (named.length !== wanted.length || wanted.some((language) => !named.includes(language))) say(`its alternates are ${named.join(', ')}, not ${wanted.join(', ')}`)
    for (const [language, href] of alternates) {
      const target = byUrl.get(href)
      const as = language === 'x-default' ? DEFAULT_LANGUAGE : language
      if (target === undefined) say(`its ${language} alternate ${href} is no page of the site`)
      else if (target.group !== page.group || target.language !== as) say(`its ${language} alternate ${href} is ${target.group} in ${target.language}`)
      else if (!alternatesIn(read(target).document).some(([back, address]) => back === page.language && address === page.url)) say(`its ${language} alternate ${href} does not name it back as ${page.language}`)
    }

    const og = (property: string): string[] => metaOf(document, 'property', property)
    // Compared as textOf reads the title: whitespace collapsed, a no-break space a space.
    const collapsed = (value: string | undefined): string => (value ?? '').replaceAll(/\s+/g, ' ').trim()
    if (og('og:url')[0] !== page.url) say(`og:url is ${String(og('og:url')[0])}, not its address`)
    if (collapsed(og('og:title')[0]) !== title) say('og:title is not its title')
    if (og('og:description')[0] !== description) say('og:description is not its description')
    if (og('og:locale')[0] !== LANGUAGE[page.language].og) say(`og:locale is ${String(og('og:locale')[0])}, not ${LANGUAGE[page.language].og}`)
    // X's card, the one part of a shared link Open Graph has no tag for:
    // the large picture's where the page names a picture, the summary where
    // it names none. For the title, the description and the picture, X
    // falls back to Open Graph's, held above.
    const card = metaOf(document, 'name', 'twitter:card')
    const kind = og('og:image').length > 0 ? 'summary_large_image' : 'summary'
    if (card.length !== 1 || card[0] !== kind) say(`twitter:card is ${JSON.stringify(card)}, not ["${kind}"]`)
  }
  const twice = (values: string[], what: string): void => {
    for (const value of new Set(values)) if (values.filter((each) => each === value).length > 1) problems.push(`two pages share the ${what} "${value}"`)
  }
  const documents = site.pages.map((page) => read(page).document)
  twice(documents.map((document) => textOf(document.querySelector('title'))), 'title')
  twice(documents.map((document) => metaOf(document, 'name', 'description')[0] ?? ''), 'description')
  return problems
}

/** sitemap.xml: exactly the built pages, each with the alternates its head declares. */
export function sitemapProblems({ site }: Built): string[] {
  const file = site.files.find((each) => each.path === 'sitemap.xml')
  if (file === undefined || !('text' in file)) return ['the site has no sitemap.xml']
  const xml = new DOMParser().parseFromString(file.text, 'application/xml')
  if (xml.querySelector('parsererror') !== null) return ['sitemap.xml is not well-formed XML']
  const SITEMAP = 'http://www.sitemaps.org/schemas/sitemap/0.9'
  const XHTML = 'http://www.w3.org/1999/xhtml'
  if (xml.documentElement.namespaceURI !== SITEMAP || xml.documentElement.localName !== 'urlset') return ['sitemap.xml is not a sitemap urlset']
  const problems: string[] = []
  const urls = [...xml.getElementsByTagNameNS(SITEMAP, 'url')]
  const listed = urls.map((url) => url.getElementsByTagNameNS(SITEMAP, 'loc')[0]?.textContent ?? '')
  for (const page of site.pages) {
    const at = listed.filter((loc) => loc === page.url).length
    if (at !== 1) {
      problems.push(`sitemap.xml lists ${page.url} ${String(at)} times, not once`)
      continue
    }
    const entry = urls[listed.indexOf(page.url)]
    const alternates = [...(entry?.getElementsByTagNameNS(XHTML, 'link') ?? [])].map((link) => `${link.getAttribute('hreflang') ?? ''} ${link.getAttribute('href') ?? ''}`).sort()
    const head = alternatesIn(read(page).document).map(([language, href]) => `${language} ${href}`).sort()
    if (JSON.stringify(alternates) !== JSON.stringify(head)) problems.push(`sitemap.xml gives ${page.url} the alternates ${alternates.join(', ')}, and its head ${head.join(', ')}`)
  }
  for (const loc of listed) if (!site.pages.some((page) => page.url === loc)) problems.push(`sitemap.xml lists ${loc}, which is no page of the site`)
  return problems
}
