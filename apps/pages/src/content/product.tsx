/**
 * The product page, `/report/<lang>/`: what Formancy Report is today, what
 * it prints, where it stands, and on what terms. One layout; the words are
 * product-copy.tsx's, in each language.
 */
import type { ReactElement } from 'react'
import { npmPage } from '../links.js'
import type { PageContext, PageGroup } from '../pages.js'
import { FigureView, STARTERS, STUDIO } from './figures.js'
import { PRODUCT_COPY } from './product-copy.js'

/** The packages a reader starting with the product installs first: the two builders and the renderer. */
const FIRST_PACKAGES = ['@formancy/report-builder-react', '@formancy/report-builder-angular', '@formancy/report-render-pdf']

/** A word of the licence's table, in the page's language: refused when LICENSE.md says something the page has no words for. */
function termIn(rows: Readonly<Record<string, string>>, english: string): string {
  const said = rows[english]
  if (said === undefined) throw new Error(`LICENSE.md's table says "${english}", and the product page has no words for it: translate the row, after reading what changed`)
  return said
}

function ProductBody({ page }: { readonly page: PageContext }): ReactElement {
  const copy = PRODUCT_COPY[page.language]
  const { release, licence } = page.inputs
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
        <FigureView figure={STUDIO} page={page} first />
      </section>

      <section className="band" aria-labelledby="today">
        <h2 id="today">{copy.today.heading}</h2>
        <ul className="cards">
          {copy.today.cards.map((card) => (
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

      <section className="band panel" aria-labelledby="status">
        <h2 id="status">{copy.status.heading(release.version)}</h2>
        <p>{copy.status.released(page.day(release.date))}</p>
        <p>{copy.status.format}</p>
        <p>{copy.status.missing}</p>
        <ul className="links">
          <li>
            <a href={`${page.github('CHANGELOG.md')}#${release.anchor}`}>{copy.status.changelog(release.version)}</a>
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

      {page.groups.map((group) => {
        const teaser = group.teaser?.[page.language]
        if (teaser === undefined) return null
        return (
          <section key={group.id} className="band" aria-labelledby={`topic-${group.id}`}>
            <h2 id={`topic-${group.id}`}>{teaser.heading}</h2>
            <p>{teaser.text}</p>
            <p>
              <a className="quiet" href={page.pageHref(group.id)}>
                {teaser.action}
              </a>
            </p>
          </section>
        )
      })}
    </>
  )
}

export const PRODUCT_GROUP: PageGroup = {
  id: 'product',
  slug: { de: '', fr: '', it: '', en: '' },
  meta: { de: PRODUCT_COPY.de.meta, fr: PRODUCT_COPY.fr.meta, it: PRODUCT_COPY.it.meta, en: PRODUCT_COPY.en.meta },
  image: 'starter-quotation.png',
  Body: ProductBody,
}
