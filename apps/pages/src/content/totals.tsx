/**
 * The start page's section on exact totals, between the topics and how the
 * product behaves: a card for each claim, each on its own tests, a link to
 * the starters' pictures, which print the totals the cards describe, and
 * what the totals do not do. The words are totals-copy.tsx's; the cards are
 * among the product group's own, in the order the page shows them
 * (product.tsx).
 */
import type { ReactElement } from 'react'
import type { PageContext } from '../pages.js'
import { TOTALS_COPY } from './totals-copy.js'

export function TotalsSection({ page }: { readonly page: PageContext }): ReactElement {
  const copy = TOTALS_COPY[page.language]
  return (
    <section className="band" aria-labelledby="totals">
      <h2 id="totals">{copy.heading}</h2>
      <p>{copy.intro}</p>
      <ul className="cards">
        {copy.cards.map((card) => (
          <li key={card.title} className="card">
            <h3>{card.title}</h3>
            <p>{card.text}</p>
          </li>
        ))}
      </ul>
      <p>
        <a className="quiet" href="#examples">
          {copy.examples}
        </a>
      </p>
      <h3 id="totals-limits">{copy.limits.heading}</h3>
      <ul className="links">
        {copy.limits.items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  )
}
