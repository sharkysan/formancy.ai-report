/**
 * Every address a page names -- a link, a stylesheet, a picture, a
 * preconnect -- resolved against the page's own address, as a browser
 * resolves it, and held to what exists: inside the site, a built page, a
 * built file or the Studio; a fragment, an id on the page it names; a file
 * of this repository on GitHub, a file the checkout holds; a package on
 * npm, one this repository publishes; the licence's address for mail; and
 * nothing else but the few sites links.ts names.
 */
import { FORMANCY, FORMANCY_DATA, FORMANCY_HEALTH } from '../links.js'
import type { Built, Read } from './read.js'
import { read } from './read.js'

/** The Google Fonts hosts: the stylesheet and its preconnects, as the Studio's page names them. */
const FONTS = ['https://fonts.googleapis.com/', 'https://fonts.gstatic.com/']

export function linkProblems({ site, inputs, exists }: Built): string[] {
  const problems: string[] = []
  const pages = site.pages.map(read)
  const byUrl = new Map(pages.map((page) => [page.url, page]))
  const files = new Set(site.files.map((file) => file.path))
  const repository = `${inputs.repository}/blob/main/`

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
    if (url.protocol !== 'https:') return 'not https'
    if (at === FORMANCY || at === `${inputs.repository}` || at === FORMANCY_DATA || at === FORMANCY_HEALTH) return null
    if (at.startsWith(repository)) return exists(decodeURIComponent(at.slice(repository.length))) ? null : 'a file this repository does not hold'
    if (at.startsWith('https://www.npmjs.com/package/')) return inputs.packages.includes(decodeURIComponent(at.slice('https://www.npmjs.com/package/'.length))) ? null : 'a package this repository does not publish'
    if (FONTS.some((host) => at.startsWith(host))) return element.localName === 'link' ? null : 'Google Fonts named by something other than a <link>'
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
