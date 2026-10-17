/**
 * The addresses outside the site a page links to, in one place: the suite
 * holds every link a page has to the site, to these, or to this
 * repository's files on GitHub and its packages on npm (checks/links.ts).
 */

/** formancy's website: the form builder Report builds on, whose repository is Apache-2.0. */
export const FORMANCY = 'https://formancy.ai/'

/** Formancy Data's repository, from which Report optionally reads a dataset (0016). */
export const FORMANCY_DATA = 'https://github.com/sharkysan/formancy.ai-data'

/** Formancy Health's repository: in development, nothing released (as the healthcare page says, dated). */
export const FORMANCY_HEALTH = 'https://github.com/sharkysan/formancy.ai-health'

/** A package's page on npm. */
export const npmPage = (name: string): string => `https://www.npmjs.com/package/${name}`
