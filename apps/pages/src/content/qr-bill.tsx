/**
 * The QR-bill page, `/report/<lang>/<qr-rechnung|facture-qr|fattura-qr|swiss-qr-bill>/`
 * (0024): what a Swiss QR-bill printed by Formancy Report is, as 0022
 * decides it and its tests hold it; the invoice in each language, as the
 * corpus's samples print it, the page's own language first, and shared with
 * its own language's; how to try it; what it does not do, from 0022's costs
 * and SIX's guidelines, and the EPC QR code page for a SEPA transfer in
 * euro (0028); and where it stands, said in the hero and dated at the
 * foot. One layout; the words are qr-bill-copy.tsx's.
 */
import type { ReactElement } from 'react'
import { LANGUAGES } from '../languages.js'
import type { Language } from '../languages.js'
import { isRoot } from '../pages.js'
import type { PageContext, PageGroup, PageStatus, Teaser } from '../pages.js'
import { FigureView, INVOICES } from './figures.js'
import { QR_BILL_COPY } from './qr-bill-copy.js'

/**
 * Where the QR-bill stands, as the page says it: the day it was last said,
 * and the newest release then, which refuses a report with a payment part.
 * Three sentences of qr-bill-copy.tsx say it: `unreleased`, in the hero and
 * after the product page's teaser; `tryIt.text`, of the release the guide
 * installs; and `status.text`, dated. A release CHANGELOG.md names after
 * this one may hold the bill, so the site refuses to render until somebody
 * says whether it does, in all three, and changes this with them (0028).
 */
export const QR_BILL_STATUS: PageStatus = {
  asOf: '2026-10-17',
  release: '0.1.0',
  feature: 'QR-bill',
  copy: 'qr-bill-copy.tsx',
  sentences: "`unreleased`, which the hero and the product page's teaser say, `tryIt.text` and `status.text`",
  constant: 'QR_BILL_STATUS',
}

/** What the product page says of the QR-bill page in `language`: its teaser, and where it stands, as the hero says it. */
const teaserOf = (language: Language): Teaser => ({ ...QR_BILL_COPY[language].teaser, text: `${QR_BILL_COPY[language].teaser.text} ${QR_BILL_COPY[language].unreleased}` })

/** The decision record that says what a QR-bill is and what it costs, which the page links for the reasons it gives. */
const DECISION = 'docs/decisions/0022-a-report-carries-one-swiss-qr-bill-at-the-foot-of-its-last-page.md'

function QrBillBody({ page }: { readonly page: PageContext }): ReactElement {
  const copy = QR_BILL_COPY[page.language]
  const { release } = page.inputs
  const root = page.groups.find(isRoot)
  const samples = [page.language, ...LANGUAGES.filter((language) => language !== page.language)].map((language) => INVOICES[language])
  return (
    <>
      <section className="hero" aria-labelledby="top">
        <p className="eyebrow">{copy.eyebrow}</p>
        <h1 id="top">{copy.h1}</h1>
        <p className="lead">{copy.lead}</p>
        <ul className="actions">
          <li>
            <a className="action" href={page.href('')}>
              {copy.actions.studio}
            </a>
          </li>
          <li>
            <a className="quiet" href="#samples">
              {copy.actions.samples}
            </a>
          </li>
        </ul>
        <p>{copy.unreleased}</p>
      </section>

      <section className="band" aria-labelledby="does">
        <h2 id="does">{copy.does.heading}</h2>
        <ul className="cards">
          {copy.does.cards.map((card) => (
            <li key={card.title} className="card">
              <h3>{card.title}</h3>
              <p>{card.text}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="band" aria-labelledby="samples">
        <h2 id="samples">{copy.samples.heading}</h2>
        <p>{copy.samples.intro}</p>
        <div className="figures">
          {samples.map((figure, index) => (
            <FigureView key={figure.picture} figure={figure} page={page} first={index === 0} />
          ))}
        </div>
      </section>

      <section className="band" aria-labelledby="try">
        <h2 id="try">{copy.tryIt.heading}</h2>
        <p>{copy.tryIt.text(release.version)}</p>
        <ul className="links">
          <li>
            <a href={page.href('')}>{copy.tryIt.links.studio}</a>
          </li>
          <li>
            <a href={`${page.github('packages/report-spec/README.md')}#a-qr-bill`}>{copy.tryIt.links.spec}</a>
          </li>
          <li>
            <a href={`${page.github('packages/report-render-pdf/README.md')}#qr-bills`}>{copy.tryIt.links.renderer}</a>
          </li>
          <li>
            <a href={page.github(DECISION)}>{copy.tryIt.links.decision}</a>
          </li>
          <li>
            <a href={page.github('docs/getting-started.md')}>{copy.tryIt.links.guide}</a>
          </li>
        </ul>
      </section>

      <section className="band panel" aria-labelledby="limits">
        <h2 id="limits">{copy.limits.heading}</h2>
        <ul className="links">
          {copy.limits.items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <p>
          <a href={page.pageHref('epc-qr-code')}>{copy.limits.epc}</a>
        </p>
      </section>

      <section className="band panel" aria-labelledby="status">
        <h2 id="status">{copy.status.heading}</h2>
        <p>
          <strong>{copy.status.text(release.version, page.day(QR_BILL_STATUS.asOf))}</strong>
        </p>
        <p>{copy.status.licence}</p>
        {root === undefined ? null : (
          <p>
            <a href={`${page.pageHref(root.id)}#licence`}>{copy.status.terms}</a>
          </p>
        )}
      </section>
    </>
  )
}

export const QR_BILL_GROUP: PageGroup = {
  id: 'qr-bill',
  slug: { de: 'qr-rechnung', fr: 'facture-qr', it: 'fattura-qr', en: 'swiss-qr-bill' },
  meta: { de: QR_BILL_COPY.de.meta, fr: QR_BILL_COPY.fr.meta, it: QR_BILL_COPY.it.meta, en: QR_BILL_COPY.en.meta },
  teaser: { de: teaserOf('de'), fr: teaserOf('fr'), it: teaserOf('it'), en: teaserOf('en') },
  image: { de: INVOICES.de.picture, fr: INVOICES.fr.picture, it: INVOICES.it.picture, en: INVOICES.en.picture },
  status: QR_BILL_STATUS,
  Body: QrBillBody,
}
