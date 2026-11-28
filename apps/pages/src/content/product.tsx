/**
 * The product page, `/report/<lang>/`: what Formancy Report is today and
 * what its newest release holds, its topics, its exact totals, how it
 * behaves, what it prints, what it does not do yet, dated, where it
 * stands, and on what terms. One layout; the words are product-copy.tsx's,
 * the totals' totals-copy.tsx's and the absences' limits-copy.tsx's, in
 * each language.
 */
import type { ReactElement } from 'react'
import { npmPage } from '../links.js'
import type { Language } from '../languages.js'
import type { Card, PageContext, PageGroup, PageStatus } from '../pages.js'
import { FigureView, STARTERS, STUDIO } from './figures.js'
import { LIMITS_COPY } from './limits-copy.js'
import { PRODUCT_COPY } from './product-copy.js'
import { TOTALS_COPY } from './totals-copy.js'
import { TotalsSection } from './totals.js'

/**
 * Where the start page stands: the day it was last said, and the newest
 * release then, 0.3.0. These sentences say it, each true of that release
 * and of the source on GitHub that day: product-copy.tsx's `standing`, in
 * the hero, of what the release holds and where what the source has
 * gained since is listed, and its `status.format`, that the report format
 * is still a draft; limits-copy.tsx's `items`, what Formancy Report does
 * not do yet, which the section dates by `asOf`; and totals-copy.tsx's
 * `limits.items`, what its totals do not do. limits.test.ts holds the
 * format's sentence and every absence but `detail` to the code they rest
 * on as well, so a change there fails before any release; `detail`, the
 * standing and the totals' limits rest on this alone. A later release may
 * hold what 0.3.0 did not, and do what it said was not done yet, so the
 * site refuses to render once CHANGELOG.md names another release, until
 * somebody says what that one holds and lacks, in every one of them, and
 * changes this with them. The hero and the status section link the
 * changelog's Unreleased, which the release commit renames: the link check
 * refuses the site until it has the heading again.
 */
export const START_STATUS: PageStatus = {
  asOf: '2026-11-28',
  release: '0.3.0',
  feature: 'start',
  ask: 'what that release holds and what Formancy Report does not do yet',
  copy: 'product-copy.tsx, limits-copy.tsx and totals-copy.tsx',
  sentences: '`standing`, which the hero says, and `status.format` in product-copy.tsx, `items` in limits-copy.tsx and `limits.items` in totals-copy.tsx',
  constant: 'START_STATUS',
}

/** Each thing the start page says Formancy Report does not do yet, worded in limits-copy.tsx. */
export type LimitKey = 'detail' | 'data' | 'formats' | 'codes' | 'scripts' | 'viewer' | 'jobs' | 'ai'

/**
 * The order the start page lists them in, in every language: what a report
 * reads, what it prints, what an application runs around it, and who
 * proposes a change to it.
 */
export const LIMIT_ORDER: readonly LimitKey[] = ['detail', 'data', 'formats', 'codes', 'scripts', 'viewer', 'jobs', 'ai']

/** The packages a reader starting with the product installs first: the two builders and the renderer. */
const FIRST_PACKAGES = ['@formancy/report-builder-react', '@formancy/report-builder-angular', '@formancy/report-render-pdf']

/** A word of the licence's table, in the page's language: refused when LICENSE.md says something the page has no words for. */
function termIn(rows: Readonly<Record<string, string>>, english: string): string {
  const said = rows[english]
  if (said === undefined)
    throw new Error(`LICENSE.md's table says "${english}", and the product page has no words for it: translate the row, after reading what changed`)
  return said
}

function ProductBody({ page }: { readonly page: PageContext }): ReactElement {
  const copy = PRODUCT_COPY[page.language]
  const limits = LIMITS_COPY[page.language]
  const { release, licence } = page.inputs
  const unreleased = `${page.github('CHANGELOG.md')}#unreleased`
  return (
    <>
      <section className="hero" aria-labelledby="top">
        <p className="eyebrow">{copy.eyebrow(release.version)}</p>
        <h1 id="top">{copy.h1}</h1>
        <p className="lead">{copy.lead}</p>
        <ul className="actions">
          <li>
            <a className="action" href={page.href('')}>
              {copy.actions.studio}
            </a>
          </li>
          <li>
            <a className="quiet" href={page.github('docs/getting-started.md')}>
              {copy.actions.guide}
            </a>
          </li>
          <li>
            <a className="quiet" href={page.inputs.repository}>
              {copy.actions.source}
            </a>
          </li>
        </ul>
        <p>{copy.standing(release.version, <a href={unreleased}>{copy.status.unreleased}</a>)}</p>
        <FigureView figure={STUDIO} page={page} first />
      </section>

      <section className="band" aria-labelledby="topics">
        <h2 id="topics">{copy.topics.heading}</h2>
        <ul className="cards topics">
          {page.groups.map((group) => {
            const teaser = group.teaser?.[page.language]
            if (teaser === undefined) return null
            return (
              <li key={group.id} className="card topic">
                <article aria-labelledby={`topic-${group.id}`}>
                  <h3 id={`topic-${group.id}`}>{teaser.heading}</h3>
                  <p>{teaser.text}</p>
                  {teaser.standing === undefined ? null : <p>{teaser.standing}</p>}
                  <p>
                    <a className="quiet" href={page.pageHref(group.id)}>
                      {teaser.action}
                    </a>
                  </p>
                </article>
              </li>
            )
          })}
        </ul>
      </section>

      <TotalsSection page={page} />

      <section className="band" aria-labelledby="behaves">
        <h2 id="behaves">{copy.behaves.heading}</h2>
        <ul className="cards">
          {copy.behaves.cards.map((card) => (
            <li key={card.title} className="card">
              <h3>{card.title}</h3>
              <p>{card.text}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="band" aria-labelledby="examples">
        <h2 id="examples">{copy.examples.heading}</h2>
        <p>{copy.examples.intro}</p>
        <div className="figures">
          {STARTERS.map((figure) => (
            <FigureView key={figure.picture} figure={figure} page={page} />
          ))}
        </div>
        <p>
          <a className="action" href={page.href('')}>
            {copy.examples.action}
          </a>
        </p>
      </section>

      <section className="band panel" aria-labelledby="limits">
        <h2 id="limits">{limits.heading}</h2>
        <p>{limits.intro(page.day(START_STATUS.asOf))}</p>
        <ul className="links">
          {LIMIT_ORDER.map((key) => (
            <li key={key}>{limits.items[key]}</li>
          ))}
        </ul>
        <p>
          <a href={page.github('docs/roadmap.md')}>{limits.roadmap}</a>
        </p>
      </section>

      <section className="band panel" aria-labelledby="status">
        <h2 id="status">{copy.status.heading(release.version)}</h2>
        <p>{copy.status.released(page.day(release.date))}</p>
        <p>{copy.status.format}</p>
        <ul className="links">
          <li>
            <a href={`${page.github('CHANGELOG.md')}#${release.anchor}`}>{copy.status.changelog(release.version)}</a>
          </li>
          <li>
            <a href={unreleased}>{copy.status.unreleased}</a>
          </li>
          {FIRST_PACKAGES.map((name) => (
            <li key={name}>
              <a href={npmPage(name)}>{copy.status.npm(name)}</a>
            </li>
          ))}
        </ul>
      </section>

      <section className="band panel" aria-labelledby="licence">
        <h2 id="licence">{copy.licence.heading}</h2>
        <p>{copy.licence.intro}</p>
        <table className="terms">
          <caption>{copy.licence.caption}</caption>
          <thead>
            <tr>
              <th scope="col">{copy.licence.use}</th>
              <th scope="col">{copy.licence.terms}</th>
            </tr>
          </thead>
          <tbody>
            {licence.terms.map(([use, terms]) => (
              <tr key={use}>
                <th scope="row">{termIn(copy.licence.rows, use)}</th>
                <td>{termIn(copy.licence.rows, terms)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p>
          {copy.licence.footnote({
            version: licence.version,
            date: page.day(licence.date),
            licence: <a href={page.github('LICENSE.md')}>LICENSE.md</a>,
            mail: <a href={`mailto:${licence.address}`}>{licence.address}</a>,
          })}
        </p>
        <p>{copy.licence.upstream}</p>
      </section>
    </>
  )
}

/** The page's claim cards in `language`, in the order it shows them: the exact totals', then how it behaves. */
const cardsOf = (language: Language): readonly Card[] => [...TOTALS_COPY[language].cards, ...PRODUCT_COPY[language].behaves.cards]

export const PRODUCT_GROUP: PageGroup = {
  id: 'product',
  studioWords: ['Download PDF'],
  slug: { de: '', fr: '', it: '', en: '' },
  meta: { de: PRODUCT_COPY.de.meta, fr: PRODUCT_COPY.fr.meta, it: PRODUCT_COPY.it.meta, en: PRODUCT_COPY.en.meta },
  cards: { de: cardsOf('de'), fr: cardsOf('fr'), it: cardsOf('it'), en: cardsOf('en') },
  image: 'starter-quotation.png',
  status: START_STATUS,
  Body: ProductBody,
}
