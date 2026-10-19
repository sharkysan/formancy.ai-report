/**
 * The whole site, rendered from its inputs: every page group in every
 * language as static HTML, the sitemap, the stylesheet, and the faces and
 * pictures to copy, with the notices of the faces and the room (0021, 0023, 0034). Pure: it reads no file, so the suite checks the site
 * scripts/prerender.mjs renders, and scripts/write-site.test.mjs holds the
 * files written to disk to be that site.
 */
import { renderToStaticMarkup } from 'react-dom/server'
import { PICTURES } from './content/figures.js'
import { Document } from './document.js'
import { GROUPS } from './groups.js'
import type { SiteInputs } from './inputs.js'
import { DEFAULT_LANGUAGE, formatDay, frenchSpaces, LANGUAGES } from './languages.js'
import type { Language } from './languages.js'
import type { PageContext, PageGroup } from './pages.js'
import { besideStylesheet, NOTICES, pathOf, picturePath, relativeHref, STYLESHEET } from './pages.js'
import { sitemap } from './sitemap.js'

export { PICTURES }

/** A page as built: where its file goes, its address, and the HTML. */
export interface BuiltPage {
  /** Its file under dist/: `de/gesundheitswesen/index.html`. */
  readonly file: string
  readonly group: string
  readonly language: Language
  readonly url: string
  /** Its translations, each by hreflang, and x-default. */
  readonly alternates: readonly (readonly [string, string])[]
  readonly html: string
}

/** A file of the built site: written from text, or copied from the repository. */
export type SiteFile = { readonly path: string; readonly text: string } | { readonly path: string; readonly from: string }

export interface Site {
  readonly pages: readonly BuiltPage[]
  /** Every file of the site, the pages' included. */
  readonly files: readonly SiteFile[]
}

/** `group`'s translations: each language's address by hreflang, and English's again as x-default. */
function alternatesOf(group: PageGroup, site: string): (readonly [string, string])[] {
  const url = (language: Language): string => `${site}${pathOf(group, language)}`
  return [...LANGUAGES.map((language) => [language, url(language)] as const), ['x-default', url(DEFAULT_LANGUAGE)] as const]
}

function contextOf(inputs: SiteInputs, group: PageGroup, language: Language, groups: readonly PageGroup[]): PageContext {
  const path = pathOf(group, language)
  const href = (to: string): string => relativeHref(path, to)
  return {
    inputs,
    groups,
    group,
    language,
    path,
    url: `${inputs.site}${path}`,
    href,
    pageHref: (id, other = language) => {
      const target = groups.find((each) => each.id === id)
      if (target === undefined) throw new Error(`no page group ${id}`)
      return href(pathOf(target, other))
    },
    github: (file) => `${inputs.repository}/blob/main/${file}`,
    day: (iso) => formatDay(iso, language),
  }
}

/**
 * What each page whose status `inputs` outdates must say again, a sentence
 * for each: a page's status was written against the release the changelog
 * named then (0024), and a later one may have its feature.
 */
function staleStatuses(inputs: SiteInputs, groups: readonly PageGroup[]): string[] {
  const { version } = inputs.release
  return groups.flatMap(({ status }) =>
    status === undefined || status.release === version
      ? []
      : [`the ${status.feature} page's status was written when ${status.release} was the newest release, and CHANGELOG.md now names ${version}: say whether that release has the ${status.feature} in each sentence of ${status.copy} that says where it stands -- ${status.sentences} -- then change ${status.constant} with them`],
  )
}

/**
 * The site `groups` make -- every one of them, in every language -- from
 * `inputs`. Refused, before any page renders, while a page's status is
 * stale, every such page named in one error, so a release commit meets
 * them all at once (0028).
 */
export function renderSite(inputs: SiteInputs, groups: readonly PageGroup[] = GROUPS): Site {
  const stale = staleStatuses(inputs, groups)
  if (stale.length > 0) throw new Error(stale.join('\n'))
  const pages = groups.flatMap((group) =>
    LANGUAGES.map((language): BuiltPage => {
      const page = contextOf(inputs, group, language, groups)
      const alternates = alternatesOf(group, inputs.site)
      const markup = renderToStaticMarkup(<Document page={page} alternates={alternates} />)
      return {
        file: `${page.path}index.html`,
        group: group.id,
        language,
        url: page.url,
        alternates,
        html: `<!doctype html>\n${language === 'fr' ? frenchSpaces(markup) : markup}\n`,
      }
    }),
  )
  return {
    pages,
    files: [
      ...pages.map((page) => ({ path: page.file, text: page.html })),
      { path: 'sitemap.xml', text: sitemap(pages) },
      { path: STYLESHEET, text: inputs.stylesheet },
      ...inputs.fonts.map((font) => ({ path: besideStylesheet(font.href), from: font.from })),
      { path: NOTICES, text: inputs.notices },
      ...inputs.pictures.map((picture) => ({ path: picturePath(picture.name), from: picture.from })),
    ],
  }
}
