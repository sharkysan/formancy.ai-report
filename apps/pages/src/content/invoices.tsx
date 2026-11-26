/**
 * The invoices page, `/report/<lang>/<rechnungen|factures|fatture|invoices>/`
 * (0081): every way Formancy Report bills on one page -- the QR-bill, the
 * EPC QR code, Factur-X and XRechnung, the payment reminder and the Word
 * file of an invoice -- with a picture of each kind, linking the two
 * payment code pages for the detail. The topic layout (topic.tsx); the
 * words are invoices-copy.tsx's.
 */
import type { Language } from '../languages.js'
import type { PageGroup, PageStatus } from '../pages.js'
import { E_INVOICE, EUROS, INVOICES, PAYMENT_REMINDER } from './figures.js'
import type { EuroCountry } from './figures.js'
import { INVOICES_COPY } from './invoices-copy.js'
import type { Shown } from './topic.js'
import { topicGroup } from './topic.js'

/**
 * Where the invoices stand, as the page says it: the day it was last said,
 * and the newest release then, 0.3.0, the first to hold every invoice the
 * page names, the XRechnung (0038) and the payment reminder (0066) the
 * last of them. Four parts of invoices-copy.tsx say it: `standing`, in
 * the hero and on the product page's card; `tryIt.text`, of the release
 * the guide installs; `limits.items`, what it does not do; and
 * `status.text`, dated. A later release may hold more or other, so the site
 * refuses to render once CHANGELOG.md names another release, until
 * somebody says what that one prints, in all four, and changes this with
 * them (0028).
 */
export const INVOICES_STATUS: PageStatus = {
  asOf: '2026-11-25',
  release: '0.3.0',
  feature: 'invoices',
  ask: 'whether that release prints each invoice the page names',
  copy: 'invoices-copy.tsx',
  sentences: "`standing`, which the hero and the product page's teaser say, `tryIt.text`, `limits.items` and `status.text`",
  constant: 'INVOICES_STATUS',
}

/**
 * The euro invoice each language's page shows, a sample in its language as
 * the EPC QR code page leads with. German's own, the euro invoice starter,
 * is beside the e-invoice starter nearly the same German invoice twice, so
 * the German page shows Austria's, in the PSA's frame.
 */
const EURO: Readonly<Record<Language, EuroCountry>> = { de: 'AT', fr: 'FR', it: 'IT', en: 'IE' }

/**
 * What each picture is, said for this page in each language: a sample is
 * captioned on its payment code's page by the language or the country it
 * stands for, and here by the kind of invoice it is. The e-invoice's and
 * the reminder's own captions say so already.
 */
const CAPTIONS: Readonly<Record<Language, { readonly qrBill: string; readonly epc: string }>> = {
  de: {
    qrBill: 'Eine QR-Rechnung: Empfangsschein und Zahlteil am Fuss der letzten Seite. Im Studio ist es die Startvorlage Invoice.',
    epc: 'Eine Rechnung in Euro aus Österreich, mit dem EPC-QR-Code, aus dem eine Banking-App die SEPA-Überweisung ausfüllt.',
  },
  fr: {
    qrBill: 'Une facture QR : le récépissé et la section paiement au pied de la dernière page.',
    epc: "Une facture en euros de France, avec le QR code SEPA qu'une application bancaire lit pour remplir le virement.",
  },
  it: {
    qrBill: "Una fattura QR: la ricevuta e la sezione pagamento in fondo all'ultima pagina.",
    epc: "Una fattura in euro dall'Italia, con il QR code SEPA che un'app bancaria legge per compilare il bonifico.",
  },
  en: {
    qrBill: 'A Swiss QR-bill: the receipt and the payment part across the foot of the last page.',
    epc: 'A euro invoice from Ireland, with the EPC QR code a banking app reads to fill in the SEPA transfer.',
  },
}

/** The page's pictures in `language`: the QR-bill and the euro invoice in its own language, then the e-invoice and the reminder. */
const figuresIn = (language: Language): readonly [Shown, ...Shown[]] => [
  { figure: INVOICES[language], caption: CAPTIONS[language].qrBill },
  { figure: EUROS[EURO[language]], caption: CAPTIONS[language].epc },
  { figure: E_INVOICE },
  { figure: PAYMENT_REMINDER },
]

export const INVOICES_GROUP: PageGroup = topicGroup({
  id: 'invoices',
  slug: { de: 'rechnungen', fr: 'factures', it: 'fatture', en: 'invoices' },
  copy: INVOICES_COPY,
  figures: figuresIn,
  image: { de: INVOICES.de.picture, fr: INVOICES.fr.picture, it: INVOICES.it.picture, en: INVOICES.en.picture },
  status: INVOICES_STATUS,
  studioWords: ['Starter', 'Invoice', 'Euro invoice', 'E-invoice (Factur-X)', 'E-invoice (XRechnung)', 'Payment reminder', 'Final', 'Download XML'],
})
