import type { ReactElement } from 'react'
import type { SiteInputs } from './inputs.js'
import type { Language } from './languages.js'

/** What a page says of itself in one language: its title, its description, and its name in a menu or a breadcrumb. */
export interface PageMeta {
  readonly title: string
  readonly description: string
  readonly name: string
}

/**
 * A page group: one page, in every language (0021). The site is a list of
 * them (groups.ts); a group added there is built in every language, linked
 * from every page's bar, listed in the sitemap and named as an alternate by
 * each of its translations, with nothing else to edit.
 */
export interface PageGroup {
  readonly id: string
  /**
   * Its path segment in each language, a word of that language, so the
   * address says what the page is about: `/report/de/gesundheitswesen/`.
   * The product page's is empty: it is the language's root, `/report/de/`.
   */
  readonly slug: Readonly<Record<Language, string>>
  readonly meta: Readonly<Record<Language, PageMeta>>
  /** What the product page says of a topic page, in each language, under a heading of its own, with a link to it. */
  readonly teaser?: Readonly<Record<Language, Teaser>>
  /** HL7's trademark notice, which a page naming HL7 or FHIR carries in its footer. */
  readonly hl7Notice?: true
  /** Its picture for a shared link: one of the site's pictures, under docs/images, the same in every language or one for each. */
  readonly image?: string | Readonly<Record<Language, string>>
  /** Where the page says its feature stands, for a page written before any release had its feature, which says at each release whether that one has it. */
  readonly status?: PageStatus
  readonly Body: (props: { readonly page: PageContext }) => ReactElement
}

/**
 * Where a page says its feature stands (0024): the day it was last said,
 * and the newest release then, which had the feature or did not, as the
 * page's sentences say. A release CHANGELOG.md names after this one may
 * have it where that one did not, or no longer have it, so the site
 * refuses to render until somebody says whether it does (0028). The rest
 * is what the refusal names: the feature, the file whose sentences say
 * where it stands, those sentences, and the constant that holds this, to
 * change with them.
 */
export interface PageStatus {
  readonly asOf: string
  readonly release: string
  readonly feature: string
  readonly copy: string
  readonly sentences: string
  readonly constant: string
}

export interface Teaser {
  readonly heading: string
  readonly text: string
  /** The link's words, which name the page it leads to. */
  readonly action: string
}

/** The product page's group, the root of each language's pages: the one whose slugs are empty. */
export const isRoot = (group: PageGroup): boolean => group.slug.en === ''

/** One page being rendered: its group and language, where it is, and links from it to the rest. */
export interface PageContext {
  readonly inputs: SiteInputs
  /** Every page group of the site, in its order. */
  readonly groups: readonly PageGroup[]
  readonly group: PageGroup
  readonly language: Language
  /** Its directory under the site, `de/gesundheitswesen/`. */
  readonly path: string
  /** Its address, which is its canonical one. */
  readonly url: string
  /** A link from this page to a path of the site, relative so the page is right wherever the site is served; `''` is the Studio. */
  readonly href: (to: string) => string
  /** A link from this page to `group`'s page, in this page's language unless another is given. */
  readonly pageHref: (group: string, language?: Language) => string
  /** The address of a file of this repository on GitHub, at main. */
  readonly github: (path: string) => string
  /** An ISO day, as this page's language writes it. */
  readonly day: (iso: string) => string
}

/**
 * The site's own files, beside the pages and never under a language: the
 * stylesheet, the faces it names and their notices, and the pictures. Under the demo's path, beside the Studio's
 * `assets/`, which is the Studio's alone (scripts/demo.mjs refuses a path
 * both builds hold).
 */
export const FILES = 'site/'

/** The site path of the stylesheet. */
export const STYLESHEET = `${FILES}pages.css`

/** The site path of a file the stylesheet names by a relative url(): a face's, `fonts/…`. */
export const besideStylesheet = (href: string): string => `${STYLESHEET.slice(0, STYLESHEET.lastIndexOf('/') + 1)}${href}`

/** The site path of the notices for the faces' files and the room's stylesheet, as the Studio's build writes its own at its root (0023, 0034). */
export const NOTICES = `${FILES}THIRD-PARTY-NOTICES.txt`

/** The site path a picture under docs/images is served at. */
export const picturePath = (name: string): string => `${FILES}${name.slice(name.lastIndexOf('/') + 1)}`

/** The directory of `group`'s page in `language`: `de/`, or `de/gesundheitswesen/`. */
export function pathOf(group: PageGroup, language: Language): string {
  const slug = group.slug[language]
  return slug === '' ? `${language}/` : `${language}/${slug}/`
}

/**
 * The relative link from the directory `from` to the site path `to`: a
 * directory when it ends in `/` or is empty (the site's root, which is the
 * Studio), a file otherwise.
 */
export function relativeHref(from: string, to: string): string {
  const here = from.split('/').filter((part) => part !== '')
  const there = to.split('/').filter((part) => part !== '')
  let shared = 0
  while (shared < here.length && shared < there.length - (to.endsWith('/') || to === '' ? 0 : 1) && here[shared] === there[shared]) shared += 1
  const up = '../'.repeat(here.length - shared)
  const down = there.slice(shared).join('/')
  const link = `${up}${down}${down !== '' && (to.endsWith('/') || to === '') ? '/' : ''}`
  return link === '' ? './' : link
}
