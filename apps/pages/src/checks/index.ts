/**
 * Every check of the built site, as sentences: none when the site is what
 * 0021 says. Each is a function of the site, its inputs and the checkout,
 * so the suite can hand it a site with one thing broken and watch it say so
 * (checks.test.ts), as well as the site the build writes (site.test.ts).
 */
import type { PageGroup } from '../pages.js'
import { bodyProblems, structuredDataProblems } from './body.js'
import { headProblems, pageSetProblems, sitemapProblems } from './head.js'
import { linkProblems } from './links.js'
import type { Built } from './read.js'
import { wordingProblems } from './wording.js'

export type { Built } from './read.js'

export function siteProblems(built: Built, groups: readonly PageGroup[]): string[] {
  return [
    ...pageSetProblems(built, groups),
    ...headProblems(built),
    ...sitemapProblems(built),
    ...bodyProblems(built),
    ...structuredDataProblems(built, groups),
    ...linkProblems(built),
    ...wordingProblems(built),
  ]
}
