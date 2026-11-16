import type { ReactElement, ReactNode } from 'react'
import type { SiteInputs } from './inputs.js'
import type { Language } from './languages.js'

/** What a page says of itself in one language: its title, its description, and its name in a menu or a breadcrumb. */
export interface PageMeta {
  readonly title: string
  readonly description: string
  readonly name: string
}

/**
 * The tests a claim rests on, one at least: each a file of this checkout,
 * a test or the entry of a gate CI runs (checks/evidence.ts's
 * `EVIDENCE_KIND`), so a test renamed or removed leaves the claim refused
 * rather than resting on nothing.
 */
export type Evidence = readonly [string, ...string[]]

/** A claim a page makes, as a card: its heading, its words, and the tests it rests on. */
export interface Card {
  readonly title: string
  readonly text: ReactNode
  readonly evidence: Evidence
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
  /**
   * Every claim card the page shows, in its order, in each language: the
   * page shows these and no other (checks/evidence.ts), and each language's
   * card rests on the one list of tests the English one does.
   */
  readonly cards: Readonly<Record<Language, readonly Card[]>>
  /** What the product page says of a topic page, in each language, under a heading of its own, with a link to it. */
  readonly teaser?: Readonly<Record<Language, Teaser>>
  /**
   * The Studio's words the page names, as the Studio writes them in every
   * language: each is one a scene of docs/images/readme/captured.json says
   * in quotes, and each page of the group says it (checks/studio-words.ts).
   */
  readonly studioWords?: readonly string[]
  /** HL7's trademark notice, which a page naming HL7 or FHIR carries in its footer. */
  readonly hl7Notice?: true
  /** Its picture for a shared link: one of the site's pictures, under docs/images, the same in every language or one for each. */
  readonly image?: string | Readonly<Record<Language, string>>
  /**
   * Where the page says it stands, against the newest release when it was
   * said: a page written before any release had its feature, which says at
   * each release whether that one has it, or the start page, which says
   * what the release holds and what Formancy Report does not do yet.
   */
  readonly status?: PageStatus
  readonly Body: (props: { readonly page: PageContext }) => ReactElement
}

/**
 * Where a page says it stands (0024): the day it was last said, and the
 * newest release then, which had the page's feature or did not, as the
 * page's sentences say -- or, where the sentences say something else, what
 * `ask` names: the start page's, what that release holds and what
 * Formancy Report does not do yet. A release CHANGELOG.md names after this
 * one may have the feature where that one did not, or no longer have it,
 * or hold and lack other things, so the site refuses to render until
 * somebody says what is true of it (0028). The rest is what the refusal
 * names: the feature, the files whose sentences say where the page
 * stands, those sentences, and the constant that holds this, to change
 * with them.
 */
export interface PageStatus {
  readonly asOf: string
  readonly release: string
  readonly feature: string
  /**
   * What the sentences must say again, where "whether that release has the
   * <feature>" is not it: the start page's say what the release holds and
   * what Formancy Report does not do yet.
   */
  readonly ask?: string
  readonly copy: string
  readonly sentences: string
  readonly constant: string
}

export interface Teaser {
  readonly heading: string
  readonly text: string
  /** The link's words, which name the page it leads to. */
  readonly action: string
  /** Where the topic's page stands, for a page with a status: the card says it beside the teaser. */
  readonly standing?: string
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
