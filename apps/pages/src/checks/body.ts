/**
 * What a reader -- a person, a screen reader, a crawler -- meets in a
 * page's body, held for every page: one h1, the content in the HTML itself
 * with no script to run, pictures described and sized, links that say
 * where they go, a language switcher that reaches every translation, and
 * JSON-LD that parses and describes the page it is on.
 */
import { LANGUAGES } from '../languages.js'
import type { PageGroup } from '../pages.js'
import { isRoot } from '../pages.js'
import type { Built, Read } from './read.js'
import { read, textOf } from './read.js'

/**
 * Words a link says when it says nothing about where it goes, in the four
 * languages. A link's words are its accessible name, and a list of links
 * read out of context is a list of these.
 */
const SAYS_NOTHING = /^(?:here|click here|more|read more|link|this|hier|mehr|weiter|weiterlesen|ici|cliquez ici|plus|en savoir plus|lire la suite|qui|clicca qui|di più|altro|leggi di più)$/i

export function bodyProblems({ site }: Built): string[] {
  const problems: string[] = []
  for (const page of site.pages.map(read)) {
    const { document, file } = page
    const say = (problem: string): void => void problems.push(`${file}: ${problem}`)
    const h1 = [...document.querySelectorAll('h1')]
    if (h1.length !== 1 || textOf(h1[0]) === '') say(`${String(h1.length)} h1, not one with words in it`)

    // The content is in the HTML: the h1 and paragraphs of text inside
    // <main>, which a page drawn by a script would have empty.
    const main = document.querySelectorAll('main')
    const paragraphs = [...(main[0]?.querySelectorAll('p') ?? [])].filter((p) => textOf(p).split(' ').length >= 8)
    if (main.length !== 1) say(`${String(main.length)} <main>, not one`)
    else if (main[0]?.contains(h1[0] ?? null) !== true || paragraphs.length < 2) say('its <main> does not hold its h1 and its text: a reader without JavaScript would find it empty')

    for (const script of document.querySelectorAll('script')) {
      if (script.getAttribute('type') !== 'application/ld+json' || script.hasAttribute('src')) say(`a <script> that is not JSON-LD: ${script.outerHTML.slice(0, 80)}`)
    }
    for (const element of document.querySelectorAll('*')) {
      for (const attribute of element.getAttributeNames()) if (attribute.startsWith('on')) say(`<${element.localName}> has the handler ${attribute}`)
    }

    for (const image of document.querySelectorAll('img')) {
      const alt = image.getAttribute('alt')
      if (alt === null || alt.trim() === '') say(`a picture with no description: ${String(image.getAttribute('src'))}`)
      if (!/^\d+$/.test(image.getAttribute('width') ?? '') || !/^\d+$/.test(image.getAttribute('height') ?? '')) say(`a picture without its size: ${String(image.getAttribute('src'))}`)
    }

    for (const link of document.querySelectorAll('a')) {
      const words = textOf(link)
      if (words === '' || SAYS_NOTHING.test(words)) say(`a link whose words say nothing of where it goes: "${words}" to ${String(link.getAttribute('href'))}`)
    }
    problems.push(...switcherProblems(page, site.pages.map(read)))
  }
  return problems
}

/** The language switcher: a link to this page in every language, said in that language, the current one marked. */
function switcherProblems(page: Read, pages: readonly Read[]): string[] {
  const problems: string[] = []
  const say = (problem: string): void => void problems.push(`${page.file}: ${problem}`)
  const links = [...page.document.querySelectorAll('nav.languages a')]
  for (const language of LANGUAGES) {
    const link = links.find((each) => each.getAttribute('hreflang') === language)
    const target = pages.find((each) => each.group === page.group && each.language === language)
    if (link === undefined || target === undefined) {
      say(`the language switcher has no link to ${language}`)
      continue
    }
    if (new URL(link.getAttribute('href') ?? '', page.url).href !== target.url) say(`the language switcher's ${language} link goes to ${new URL(link.getAttribute('href') ?? '', page.url).href}, not ${target.url}`)
    if (link.getAttribute('lang') !== language) say(`the language switcher's ${language} link is not said to be in ${language}`)
    const marked = link.getAttribute('aria-current') === 'page'
    if (marked !== (language === page.language)) say(`the language switcher's ${language} link is ${marked ? '' : 'not '}marked as the page's own`)
  }
  if (links.length !== LANGUAGES.length) say(`the language switcher has ${String(links.length)} links, not ${String(LANGUAGES.length)}`)
  return problems
}

/** The JSON-LD of every page: parsed, and about the page it is on. */
export function structuredDataProblems({ site, inputs }: Built, groups: readonly PageGroup[]): string[] {
  const problems: string[] = []
  const root = groups.find(isRoot)
  for (const page of site.pages.map(read)) {
    const say = (problem: string): void => void problems.push(`${page.file}: ${problem}`)
    const scripts = [...page.document.querySelectorAll('script[type="application/ld+json"]')]
    if (scripts.length !== 1) {
      say(`${String(scripts.length)} JSON-LD blocks, not one`)
      continue
    }
    let data: Record<string, unknown>
    try {
      data = JSON.parse(scripts[0]?.textContent ?? '') as Record<string, unknown>
    } catch (error) {
      say(`its JSON-LD does not parse: ${error instanceof Error ? error.message : String(error)}`)
      continue
    }
    if (data['@context'] !== 'https://schema.org') say(`its JSON-LD's @context is ${String(data['@context'])}`)
    if (page.group === root?.id) {
      const wanted = { '@type': 'SoftwareApplication', name: 'Formancy Report', url: page.url, license: `${inputs.repository}/blob/main/LICENSE.md`, softwareVersion: inputs.release.version }
      for (const [key, value] of Object.entries(wanted)) if (data[key] !== value) say(`its SoftwareApplication's ${key} is ${JSON.stringify(data[key])}, not ${JSON.stringify(value)}`)
      for (const key of ['applicationCategory', 'operatingSystem', 'description']) if (typeof data[key] !== 'string' || data[key] === '') say(`its SoftwareApplication has no ${key}`)
      if ('offers' in data) say('its SoftwareApplication makes an offer: no page states a price')
      continue
    }
    const graph = Array.isArray(data['@graph']) ? (data['@graph'] as Record<string, unknown>[]) : []
    const webPage = graph.find((node) => node['@type'] === 'WebPage')
    const crumbs = graph.find((node) => node['@type'] === 'BreadcrumbList')
    if (webPage?.url !== page.url) say(`its WebPage is at ${String(webPage?.url)}, not its address`)
    const items = Array.isArray(crumbs?.itemListElement) ? (crumbs.itemListElement as Record<string, unknown>[]) : []
    const product = site.pages.find((each) => each.group === root?.id && each.language === page.language)
    if (items.length !== 2 || items[0]?.item !== product?.url || items[1]?.item !== page.url) say(`its breadcrumb is ${JSON.stringify(items.map((item) => item.item))}, not the product page and then this one`)
  }
  return problems
}
