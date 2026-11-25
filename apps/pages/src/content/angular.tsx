/**
 * The Angular report designer's page,
 * `/report/<lang>/<angular-reportdesigner|concepteur-rapports-angular|designer-report-angular|angular-report-designer>/`
 * (0081): `@formancy/report-builder-angular`, native to Angular and over
 * the session the React builder edits too (0012), as its tests and the
 * install gate hold it, with the Studio's picture of the switch. The topic
 * layout (topic.tsx); the words are angular-copy.tsx's.
 */
import type { PageGroup, PageStatus } from '../pages.js'
import { ANGULAR_COPY } from './angular-copy.js'
import { STARTERS, STUDIO_ANGULAR } from './figures.js'
import { topicGroup } from './topic.js'

/**
 * Where the Angular builder stands, as the page says it: the day it was
 * last said, and the newest release then, 0.3.0. Four parts of
 * angular-copy.tsx say it: `standing`, in the hero and on the product
 * page's card; `tryIt.text`, of the release the guide installs;
 * `limits.items`, its peer range and what it does not do yet; and
 * `status.text`, dated. The site refuses to render once CHANGELOG.md names
 * another release, until somebody says whether that one has the builder,
 * on which Angular, and what it still does not do, in all four, and
 * changes this with them (0028).
 */
export const ANGULAR_STATUS: PageStatus = {
  asOf: '2026-11-25',
  release: '0.3.0',
  feature: 'Angular builder',
  copy: 'angular-copy.tsx',
  sentences: "`standing`, which the hero and the product page's teaser say, `tryIt.text`, `limits.items` and `status.text`",
  constant: 'ANGULAR_STATUS',
}

export const ANGULAR_GROUP: PageGroup = topicGroup({
  id: 'angular',
  slug: { de: 'angular-reportdesigner', fr: 'concepteur-rapports-angular', it: 'designer-report-angular', en: 'angular-report-designer' },
  copy: ANGULAR_COPY,
  figures: () => [{ figure: STUDIO_ANGULAR }],
  // The quotation the picture shows in the builder, as the start page's
  // shared picture is: a document's page, never a picture of the Studio.
  image: STARTERS[0].picture,
  status: ANGULAR_STATUS,
  studioWords: ['Builder', 'Angular'],
})
