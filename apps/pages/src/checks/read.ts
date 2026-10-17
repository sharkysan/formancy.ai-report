/**
 * The built site, read back as a crawler reads it: each page's HTML parsed
 * by the DOM, with no script run (DOMParser runs none). The suite's checks
 * read only this, never the components, so a page is held to what it says
 * and not to how it was made.
 */
import type { SiteInputs } from '../inputs.js'
import type { BuiltPage, Site } from '../site.js'

/** What every check is handed: the site, the inputs it was rendered from, whether a repository path is a file, and a file's text. */
export interface Built {
  readonly site: Site
  readonly inputs: SiteInputs
  readonly exists: (path: string) => boolean
  /** The text of the repository file at `path`, one `exists` holds: read for a link to one of its headings. */
  readonly text: (path: string) => string
}

/** A page with its parsed document. */
export interface Read extends BuiltPage {
  readonly document: Document
}

const parsed = new WeakMap<BuiltPage, Document>()

/** `page`, parsed once. */
export function read(page: BuiltPage): Read {
  let document = parsed.get(page)
  if (document === undefined) {
    document = new DOMParser().parseFromString(page.html, 'text/html')
    parsed.set(page, document)
  }
  return { ...page, document }
}

/** An element's text, its whitespace collapsed. */
export const textOf = (element: Element | null | undefined): string => (element?.textContent ?? '').replaceAll(/\s+/g, ' ').trim()

/** The `content` of each `<meta>` whose `attribute` is `value`. */
export const metaOf = (document: Document, attribute: 'name' | 'property', value: string): string[] =>
  [...document.querySelectorAll(`meta[${attribute}="${value}"]`)].map((element) => element.getAttribute('content') ?? '')

/** A page's alternates as its head declares them: hreflang to address, each hreflang listed once or more. */
export const alternatesIn = (document: Document): [string, string][] =>
  [...document.querySelectorAll('link[rel="alternate"][hreflang]')].map((link) => [link.getAttribute('hreflang') ?? '', link.getAttribute('href') ?? ''])
