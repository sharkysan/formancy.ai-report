/**
 * The React report designer's page,
 * `/report/<lang>/<react-reportdesigner|concepteur-rapports-react|designer-report-react|react-report-designer>/`
 * (0081): `@formancy/report-builder-react`, native to React and over the
 * session the Angular builder edits too (0012), as its tests and the
 * install gate hold it, with a scene of the Studio's React builder alone,
 * the XRechnung's, then the Studio's opening picture. The topic layout
 * (topic.tsx); the words are react-copy.tsx's.
 */
import type { PageGroup, PageStatus } from '../pages.js'
import { STARTERS, STUDIO, STUDIO_XRECHNUNG } from './figures.js'
import { REACT_COPY } from './react-copy.js'
import { topicGroup } from './topic.js'

/**
 * Where the React builder stands, as the page says it: the day it was last
 * said, and the newest release then, 0.3.0. Four parts of react-copy.tsx
 * say it: `standing`, in the hero and on the product page's card;
 * `tryIt.text`, of the release the guide installs; `limits.items`, its peer
 * range and what it does not do yet; and `status.text`, dated. The site
 * refuses to render once CHANGELOG.md names another release, until somebody
 * says whether that one has the builder, on which React, and what it still
 * does not do, in all four, and changes this with them (0028).
 */
export const REACT_STATUS: PageStatus = {
  asOf: '2026-11-25',
  release: '0.3.0',
  feature: 'React builder',
  copy: 'react-copy.tsx',
  sentences: "`standing`, which the hero and the product page's teaser say, `tryIt.text`, `limits.items` and `status.text`",
  constant: 'REACT_STATUS',
}

export const REACT_GROUP: PageGroup = topicGroup({
  id: 'react',
  slug: { de: 'react-reportdesigner', fr: 'concepteur-rapports-react', it: 'designer-report-react', en: 'react-report-designer' },
  copy: REACT_COPY,
  figures: () => [{ figure: STUDIO_XRECHNUNG }, { figure: STUDIO }],
  // The quotation the picture shows in the builder, as the start page's
  // shared picture is: a document's page, never a picture of the Studio.
  image: STARTERS[0].picture,
  status: REACT_STATUS,
  studioWords: ['Builder', 'React'],
})
