/**
 * The addresses outside the site a page links to, in one place: the suite
 * holds every link a page has to the site, to these, or to this
 * repository's files on GitHub and its packages on npm (checks/links.ts).
 */

/** formancy's website: the form builder Report builds on, whose repository is Apache-2.0. */
export const FORMANCY = 'https://formancy.ai/'

/** Formancy Data's repository, from which Report optionally reads a dataset (0016). */
export const FORMANCY_DATA = 'https://github.com/sharkysan/formancy.ai-data'

/** Formancy Health's repository: 0.1.0, a developer preview, released (as the healthcare page says, dated). */
export const FORMANCY_HEALTH = 'https://github.com/sharkysan/formancy.ai-health'

/** Formancy Health's demo on formancy.ai, which the healthcare page links beside its repository for a reader who would rather see it run. */
export const FORMANCY_HEALTH_DEMO = 'https://formancy.ai/health/'

/** formancy's page for its Angular form builder, which the Angular report designer's page links for a reader who builds forms too (0081). */
export const FORMANCY_ANGULAR = 'https://formancy.ai/angular-form-builder/'

/** The legal notice of formancy.ai, the site these pages are served on, which every page's footer links (checks/body.ts). */
export const LEGAL_NOTICE = 'https://formancy.ai/legal/'

/** formancy.ai's privacy notice, which every page's footer links beside the legal notice. */
export const PRIVACY_NOTICE = 'https://formancy.ai/privacy/'

/** A package's page on npm. */
export const npmPage = (name: string): string => `https://www.npmjs.com/package/${name}`
