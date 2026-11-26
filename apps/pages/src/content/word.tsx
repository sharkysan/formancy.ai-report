/**
 * The Word files page, `/report/<lang>/<word-dateien|documents-word|documenti-word|word-documents>/`
 * (0081): what `@formancy/report-render-docx` writes of a report and what
 * it refuses, as 0068, 0074, 0075, 0076 and 0077 decide it and their tests
 * hold it, with the Studio's Download Word beside Download PDF. The topic
 * layout (topic.tsx); the words are word-copy.tsx's.
 */
import type { PageGroup, PageStatus } from '../pages.js'
import { INVOICES, STUDIO_WORD } from './figures.js'
import { topicGroup } from './topic.js'
import { WORD_COPY } from './word-copy.js'

/**
 * Where the Word writer stands, as the page says it: the day it was last
 * said, and the newest release then, 0.3.0, the first to publish it
 * (0068). Four parts of word-copy.tsx say it: `standing`, in the hero and
 * on the product page's card; `tryIt.text`, of the release that
 * publishes the writer; `limits.items`, what it does not do; and
 * `status.text`, dated. The site refuses to render once CHANGELOG.md names
 * another release, until somebody says whether that one has the writer and
 * what it does not do, in all four, and changes this with them (0028).
 */
export const WORD_STATUS: PageStatus = {
  asOf: '2026-11-25',
  release: '0.3.0',
  feature: 'Word writer',
  copy: 'word-copy.tsx',
  sentences: "`standing`, which the hero and the product page's teaser say, `tryIt.text`, `limits.items` and `status.text`",
  constant: 'WORD_STATUS',
}

export const WORD_GROUP: PageGroup = topicGroup({
  id: 'word',
  slug: { de: 'word-dateien', fr: 'documents-word', it: 'documenti-word', en: 'word-documents' },
  copy: WORD_COPY,
  figures: () => [{ figure: STUDIO_WORD }],
  // The invoice whose Word file the hero's second link opens, in each
  // language: a document's page, as every page's shared picture is.
  image: { de: INVOICES.de.picture, fr: INVOICES.fr.picture, it: INVOICES.it.picture, en: INVOICES.en.picture },
  status: WORD_STATUS,
  studioWords: ['Starter', 'Download Word', 'Download PDF'],
})
