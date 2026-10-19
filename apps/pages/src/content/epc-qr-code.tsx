/**
 * The EPC QR code page, `/report/<lang>/<epc-qr-code|qr-code-sepa>/`
 * (0028): what an EPC QR code printed by Formancy Report is, as 0025
 * decides it and its tests hold it, each card beside the tests it rests on;
 * the euro invoice from each country, as the corpus's samples print it,
 * the page's own language's first, and shared with its own language's;
 * how to try it; what it does not do, from 0025's costs and 0028's, and
 * the QR-bill page for an invoice in francs; and where it stands, said in
 * the hero and dated at the foot. The QR-bill page's layout (0024); the
 * words are epc-qr-code-copy.tsx's.
 */
import type { ReactElement } from 'react'
import type { Language } from '../languages.js'
import { isRoot } from '../pages.js'
import type { PageContext, PageGroup, PageStatus, Teaser } from '../pages.js'
import { EPC_QR_CODE_COPY } from './epc-qr-code-copy.js'
import { EURO_COUNTRIES, EUROS, FigureView } from './figures.js'
import type { EuroCountry } from './figures.js'

/**
 * Where the EPC QR code stands, as the page says it: the day it was last
 * said, and the newest release then, 0.2.0, the first to print one, which
 * 0.1.0 refuses as an unknown kind (0025). Three sentences of
 * epc-qr-code-copy.tsx say it, as the QR-bill page's three say its bill's:
 * `standing`, in the hero and after the product page's teaser;
 * `tryIt.text`, of the release the guide installs; and `status.text`,
 * dated. Each says the newest release holds the code, so the site refuses
 * to render once CHANGELOG.md names another release, until somebody says
 * whether it has the code, in all three, and changes this with them.
 */
export const EPC_QR_CODE_STATUS: PageStatus = {
  asOf: '2026-10-19',
  release: '0.2.0',
  feature: 'EPC QR code',
  copy: 'epc-qr-code-copy.tsx',
  sentences: "`standing`, which the hero and the product page's teaser say, `tryIt.text` and `status.text`",
  constant: 'EPC_QR_CODE_STATUS',
}

/**
 * The day the samples' sources were read: each country's standard VAT rate
 * from the EU's Your Europe table, and the registers that give no bank the
 * bank codes of the German, Austrian, French, Spanish and Dutch accounts.
 * report-corpus's `starters/euro-invoice-countries.ts` cites each source
 * with its address, and says which registers could not be read. The page
 * dates both by it, so that neither reads as today's; nothing reads them
 * again.
 */
export const EURO_SAMPLES_READ = '2026-10-17'

/**
 * The tests each card of the page's "does" section rests on, card by card,
 * in the cards' order: each claim is one 0025 makes and these hold, or one
 * the euro invoice's samples make (0028). epc-qr-code.test.ts holds every
 * file to the checkout, and the list to as many cards as each language has.
 */
export const CARD_EVIDENCE: readonly (readonly string[])[] = [
  // The EPC's rules: the IBAN and its country's length, the QR-IBAN, the BIC
  // and its country, the creditor reference, each text, the bytes; and the
  // same functions for what the report writes and what the data brings.
  ['packages/report-spec/src/epc-payload.test.ts', 'packages/report-spec/src/sepa.test.ts', 'packages/report-spec/src/payment-reference.test.ts', 'packages/report-spec/src/validate-epc-qr-code.test.ts', 'packages/report-runtime/src/lower-epc-qr-code.test.ts'],
  // Refused before the PDF, on its field: the IBAN's rules the validator
  // applies -- its check digits, its country's length, a country of SEPA --
  // and its refusal when the report is validated, on its field, unquoted;
  // shown there by both builders, which run the core's scenario "insert an
  // EPC payment code, and type its account"; the data held to the same
  // rules by the runtime, never quoting a value. That a typo which still
  // fits the check digits, or another account's valid IBAN, passes is
  // what the payload's test shows of any valid IBAN: every country's
  // example account is taken.
  [
    'packages/report-spec/src/epc-payload.test.ts',
    'packages/report-spec/src/validate-epc-qr-code.test.ts',
    'packages/report-builder-core/src/epc-qr-code.test.ts',
    'packages/report-builder-react/src/scenarios.test.tsx',
    'packages/report-builder-angular/src/scenarios.test.ts',
    'packages/report-runtime/src/lower-epc-qr-code.test.ts',
  ],
  // The amount: the PSA's spellings, more than two decimals refused rather
  // than rounded, null left to the payer, and each invoice's total computed
  // in BigInt against the code's.
  ['packages/report-spec/src/epc-payload.test.ts', 'packages/report-runtime/src/lower-epc-qr-code.test.ts', 'packages/report-corpus/src/starters/starters.test.ts', 'packages/report-corpus/src/starters/euro-samples.test.ts'],
  // The details beside the code: decoded, and each read back beside it.
  ['packages/report-render-pdf/src/starters.test.ts', 'packages/report-render-pdf/src/euro-samples.test.ts'],
  // Austria's frame: the PSA's frame, caption and modules' widths, and the
  // Austrian sample alone wearing it.
  ['packages/report-spec/src/epc-print.test.ts', 'packages/report-render-pdf/src/epc-qr-code.test.ts', 'packages/report-render-pdf/src/euro-samples.test.ts'],
  // Proved on the PDF: the EPC's examples byte for byte at level M, and
  // every invoice down to the amount it prints, decoded by ZXing.
  ['packages/report-render-pdf/src/epc-qr-code.test.ts', 'packages/report-render-pdf/src/starters.test.ts', 'packages/report-render-pdf/src/euro-samples.test.ts'],
]

/** The sample each language's page leads with and is shared with: German's is the starter, English's the Irish, the sample in English. */
const OWN: Readonly<Record<Language, EuroCountry>> = { de: 'DE', fr: 'FR', it: 'IT', en: 'IE' }

/** What the product page says of the EPC QR code page in `language`: its teaser, and where it stands, as the hero says it. */
const teaserOf = (language: Language): Teaser => ({ ...EPC_QR_CODE_COPY[language].teaser, text: `${EPC_QR_CODE_COPY[language].teaser.text} ${EPC_QR_CODE_COPY[language].standing}` })

/** The decision record that says what an EPC QR code is and what it costs, which the page links for the reasons it gives. */
const DECISION = 'docs/decisions/0025-a-report-prints-an-epc-qr-code-held-to-the-epc-rules-beside-the-qr-bill.md'

/** The decision record that cites where each sample's rate and each register was read, with its address, which the samples link. */
const SAMPLES_RECORD = 'docs/decisions/0028-the-euro-invoice-comes-as-samples-from-six-euro-countries-and-an-epc-qr-code-page-shows-them.md'

function EpcQrCodeBody({ page }: { readonly page: PageContext }): ReactElement {
  const copy = EPC_QR_CODE_COPY[page.language]
  const { release } = page.inputs
  const root = page.groups.find(isRoot)
  const own = OWN[page.language]
  const samples = [own, ...EURO_COUNTRIES.filter((country) => country !== own)].map((country) => EUROS[country])
  const read = page.day(EURO_SAMPLES_READ)
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
        <p>{copy.standing}</p>
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
        <p>{copy.samples.intro(read)}</p>
        <p>
          {copy.samples.accounts(read)} <a href={page.github(SAMPLES_RECORD)}>{copy.samples.record}</a>
        </p>
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
            <a href={`${page.github('packages/report-spec/README.md')}#an-epc-qr-code`}>{copy.tryIt.links.spec}</a>
          </li>
          <li>
            <a href={`${page.github('packages/report-render-pdf/README.md')}#epc-qr-codes`}>{copy.tryIt.links.renderer}</a>
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
          <a href={page.pageHref('qr-bill')}>{copy.limits.qrBill}</a>
        </p>
      </section>

      <section className="band panel" aria-labelledby="status">
        <h2 id="status">{copy.status.heading}</h2>
        <p>
          <strong>{copy.status.text(release.version, page.day(EPC_QR_CODE_STATUS.asOf))}</strong>
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

export const EPC_QR_CODE_GROUP: PageGroup = {
  id: 'epc-qr-code',
  slug: { de: 'epc-qr-code', fr: 'qr-code-sepa', it: 'qr-code-sepa', en: 'epc-qr-code' },
  meta: { de: EPC_QR_CODE_COPY.de.meta, fr: EPC_QR_CODE_COPY.fr.meta, it: EPC_QR_CODE_COPY.it.meta, en: EPC_QR_CODE_COPY.en.meta },
  teaser: { de: teaserOf('de'), fr: teaserOf('fr'), it: teaserOf('it'), en: teaserOf('en') },
  image: { de: EUROS[OWN.de].picture, fr: EUROS[OWN.fr].picture, it: EUROS[OWN.it].picture, en: EUROS[OWN.en].picture },
  status: EPC_QR_CODE_STATUS,
  Body: EpcQrCodeBody,
}
