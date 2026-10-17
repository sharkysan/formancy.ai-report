/**
 * Every address a page names -- a link, a stylesheet, a picture, a
 * preconnect -- resolved against the page's own address, as a browser
 * resolves it, and held to what exists: inside the site, a built page, a
 * built file or the Studio; a fragment, an id on the page it names; a file
 * of this repository on GitHub, a file the checkout holds, and a fragment
 * of it a heading the file has; a package on npm, one this repository
 * publishes; the licence's address for mail; and nothing else but the few
 * sites links.ts names. Those are for a link a reader follows: what the
 * browser fetches by itself as the page loads -- every address but an
 * <a>'s -- is the site's own (0023).
 */
import { FORMANCY, FORMANCY_DATA, FORMANCY_HEALTH } from '../links.js'
import type { Built, Read } from './read.js'
import { read } from './read.js'

/** A fence's opening or closing line in Markdown: three backticks or tildes or more, indented by three spaces at most. */
const FENCE = /^ {0,3}(`{3,}|~{3,})/

/** An ATX heading, its text without the closing hashes. */
const HEADING = /^ {0,3}#{1,6}[ \t]+(.*?)(?:[ \t]+#+)?[ \t]*$/

/**
 * The anchors GitHub gives the headings of the Markdown `text`: each `#`
 * heading outside a fenced block, a link in it read as its words, the text
 * lowercased, everything but letters, digits, marks, spaces, hyphens and
 * underscores dropped, each space a hyphen, and -1, -2 after an anchor
 * already taken. A heading underlined rather than marked, and an anchor
 * written as HTML, are not read, and a link to one is refused.
 */
export function headingAnchors(text: string): ReadonlySet<string> {
  const anchors = new Set<string>()
  const taken = new Map<string, number>()
  let fence: string | undefined
  for (const line of text.replaceAll('\r\n', '\n').split('\n')) {
    const marker = FENCE.exec(line)?.[1]
    if (marker !== undefined && (fence === undefined || (marker[0] === fence[0] && marker.length >= fence.length))) {
      fence = fence === undefined ? marker : undefined
      continue
    }
    const heading = fence === undefined ? HEADING.exec(line)?.[1] : undefined
    if (heading === undefined) continue
    const base = heading
      .replaceAll(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
      .toLowerCase()
      .replaceAll(/[^\p{L}\p{N}\p{M}\s_-]/gu, '')
      .replaceAll(/\s/g, '-')
    const count = taken.get(base) ?? 0
    taken.set(base, count + 1)
    anchors.add(count === 0 ? base : `${base}-${String(count)}`)
  }
  return anchors
}

export function linkProblems({ site, inputs, exists, text }: Built): string[] {
  const problems: string[] = []
  const pages = site.pages.map(read)
  const byUrl = new Map(pages.map((page) => [page.url, page]))
  const files = new Set(site.files.map((file) => file.path))
  const repository = `${inputs.repository}/blob/main/`
  const anchors = new Map<string, ReadonlySet<string>>()
  const anchorsOf = (path: string): ReadonlySet<string> => {
    const known = anchors.get(path) ?? (path.endsWith('.md') ? headingAnchors(text(path)) : new Set<string>())
    anchors.set(path, known)
    return known
  }

  /** What is wrong with the repository file at `path`, and `fragment` of it, as a link names them, or null. */
  function fileProblemOf(path: string, fragment: string): string | null {
    if (!exists(path)) return 'a file this repository does not hold'
    return fragment === '' || anchorsOf(path).has(decodeURIComponent(fragment)) ? null : `#${fragment} is no heading of ${path}`
  }

  /** What is wrong with `address` as `element` on `page` names it, or null. */
  function problemOf(page: Read, element: Element, address: string): string | null {
    if (address.startsWith('data:')) return element.localName === 'link' && element.getAttribute('rel') === 'icon' ? null : 'a data: address anywhere but the icon'
    if (address.startsWith('mailto:')) return address === `mailto:${inputs.licence.address}` ? null : `mail to an address the licence does not name`
    const url = new URL(address, page.url)
    const fragment = url.hash.slice(1)
    url.hash = ''
    const at = url.href
    if (at.startsWith(inputs.site)) {
      const path = at.slice(inputs.site.length)
      const target = byUrl.get(at)
      if (fragment !== '') return target !== undefined && target.document.getElementById(decodeURIComponent(fragment)) !== null ? null : `#${fragment} is no id on ${at}`
      return path === '' || target !== undefined || files.has(path) ? null : 'no page or file of the site, and not the Studio'
    }
    // A stylesheet, a font, a hint or a picture from anywhere else hands
    // that site the reader's address before a word is read (0023).
    if (element.localName !== 'a') return 'fetched from another site as the page loads, which tells that site who opened the page'
    if (url.protocol !== 'https:') return 'not https'
    if (at === FORMANCY || at === `${inputs.repository}` || at === FORMANCY_DATA || at === FORMANCY_HEALTH) return null
    if (at.startsWith(repository)) return fileProblemOf(decodeURIComponent(at.slice(repository.length)), fragment)
    if (at.startsWith('https://www.npmjs.com/package/')) return inputs.packages.includes(decodeURIComponent(at.slice('https://www.npmjs.com/package/'.length))) ? null : 'a package this repository does not publish'
    return 'an address outside the site that links.ts does not name'
  }

  for (const page of pages) {
    for (const element of page.document.querySelectorAll('[href], [src]')) {
      const address = element.getAttribute('href') ?? element.getAttribute('src') ?? ''
      const problem = problemOf(page, element, address)
      if (problem !== null) problems.push(`${page.file}: <${element.localName}> names ${address}: ${problem}`)
    }
    // A shared link's picture is fetched by whoever shows the link: a file the site serves.
    for (const meta of page.document.querySelectorAll('meta[property="og:image"]')) {
      const address = meta.getAttribute('content') ?? ''
      if (!address.startsWith(inputs.site) || !files.has(address.slice(inputs.site.length))) problems.push(`${page.file}: og:image names ${address}: no file of the site`)
    }
  }
  return problems
}
