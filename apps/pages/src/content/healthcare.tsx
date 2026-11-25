/**
 * The healthcare page, `/report/<lang>/<gesundheitswesen|sante|sanita|healthcare>/`:
 * what works today for healthcare's documents, Formancy Report's PDFs, each
 * card naming the tests it rests on (`EVIDENCE`) -- formancy's forms have no
 * card, since no test of this checkout holds what formancy is -- and what
 * Formancy Health, a developer preview of its own repository, exports, said
 * as its README says it and dated, since nothing here reads that
 * repository, with links to it and to its demo on formancy.ai (0081). It
 * names HL7 and FHIR, so its footer carries HL7's notice (shell.tsx),
 * which the suite holds word for word.
 */
import type { ReactElement } from 'react'
import type { Language } from '../languages.js'
import { FORMANCY_HEALTH, FORMANCY_HEALTH_DEMO } from '../links.js'
import { isRoot } from '../pages.js'
import type { Card, Evidence, PageContext, PageGroup, PageMeta, Teaser } from '../pages.js'

/**
 * The day the healthcare page last said where Formancy Health stands. A
 * date, because a status goes stale and a reader should see how old it is;
 * change it with the sentence it dates. Read from formancy.ai-health's
 * README and CHANGELOG.md that day: its 0.1.0, a developer preview,
 * released on `HEALTH_RELEASED`.
 */
export const HEALTH_AS_OF = '2026-11-25'

/** The day Formancy Health 0.1.0 was released, as its CHANGELOG.md's heading says, which nothing here reads: dated by `HEALTH_AS_OF`. */
export const HEALTH_RELEASED = '2026-10-19'

interface HealthcareCopy {
  readonly meta: PageMeta
  readonly teaser: Teaser
  readonly eyebrow: string
  readonly h1: string
  readonly lead: string
  readonly today: { readonly heading: string; readonly cards: readonly Card[]; readonly not: string }
  readonly actions: { readonly studio: string; readonly product: string }
  readonly health: {
    readonly heading: string
    readonly text: string
    /** Where Formancy Health stands: `released` the day its 0.1.0 was, `date` the day that was read. */
    readonly status: (released: string, date: string) => string
    readonly link: string
    /** The link's words, to Formancy Health's demo on formancy.ai. */
    readonly demo: string
  }
}

/**
 * The tests each card of "What works today" rests on, one list a card,
 * which the card shares in every language (checks/evidence.ts).
 */
const EVIDENCE = {
  // A table's header repeated on every page it reaches, and its closing
  // rows on the page of the last row they close; the page regions on every
  // page; and the starters printed so from the data handed over.
  documents: [
    'packages/report-render-pdf/src/tables.test.ts',
    'packages/report-render-pdf/src/flow.test.ts',
    'packages/report-render-pdf/src/starters.test.ts',
  ],
  // Sums and averages exact and rounded once, as declared; a word wider
  // than its column and a line no page holds refused, naming where they
  // are, and no PDF written of a document refused.
  exact: [
    'packages/report-runtime/src/decimal.test.ts',
    'packages/report-runtime/src/totals.test.ts',
    'packages/report-render-pdf/src/widths.test.ts',
    'packages/report-render-pdf/src/refusals.test.ts',
  ],
  // In Chromium, nothing asked of any address outside the built Studio
  // while it prints; each image asked of the host by its id and digest, and
  // the bytes handed over drawn; and LICENSE.md's table, read row by row,
  // in which customer data, report templates and generated documents
  // remain the customer's.
  data: ['apps/studio/scripts/browser-test.mjs', 'packages/report-runtime/src/lower.test.ts', 'apps/pages/scripts/inputs.test.mjs'],
} satisfies Record<string, Evidence>

const COPY: Readonly<Record<Language, HealthcareCopy>> = {
  de: {
    meta: {
      title: 'Gesundheitswesen: Formulare und PDFs – Formancy Report',
      description:
        'Formulare mit formancy, dazu Zuweisungen, Arztberichte und Patientenrechnungen als PDFs aus Ihren Daten, selbst gehostet. FHIR-Export als Developer Preview.',
      name: 'Gesundheitswesen',
    },
    teaser: {
      heading: 'Für das Gesundheitswesen',
      text: 'Zuweisungsschreiben, Arztberichte und Rechnungen an Patientinnen und Patienten, als paginierte PDFs aus den Daten gedruckt, die Ihre Anwendung übergibt, mit exakten Beträgen, nie abgeschnittenem Text und Dokumenten, die Ihnen gehören: was heute geht, und was Formancy Health als Developer Preview exportiert.',
      action: 'Formancy Report im Gesundheitswesen',
    },
    eyebrow: 'Formancy Report für das Gesundheitswesen',
    h1: 'Formulare und PDF-Dokumente fürs Gesundheitswesen, auf Ihren eigenen Servern',
    lead: 'Spitäler, Kliniken, Praxen und die Hersteller ihrer Software brauchen Formulare, die Menschen ausfüllen, und Dokumente, die exakt gedruckt werden. Mit formancy entstehen die Formulare, mit Formancy Report die Dokumente, und beide laufen in Ihrer eigenen Anwendung, dort, wo die Patientendaten schon sind.',
    today: {
      heading: 'Was heute geht',
      cards: [
        {
          title: 'Dokumente mit Formancy Report',
          text: 'Ein Zuweisungsschreiben, ein Untersuchungsbericht, eine Rechnung an eine Patientin: einmal im Editor gestaltet, dann als paginiertes PDF aus den Daten erzeugt, die Ihre Anwendung übergibt, mit Tabellenköpfen, die sich auf jeder Seite wiederholen, und Summen, die bei ihrer letzten Zeile bleiben.',
          evidence: EVIDENCE.documents,
        },
        {
          title: 'Exakt oder gar nicht',
          text: 'Beträge werden exakt berechnet und höchstens einmal gerundet. Text, der nicht passt, wird nie abgeschnitten: Der Renderer bricht ab und sagt, warum, damit kein Dokument stillschweigend eine Zeile verliert.',
          evidence: EVIDENCE.exact,
        },
        {
          title: 'Patientendaten gehören Ihnen',
          text: 'Ihre Anwendung übergibt die Daten, und jedes Bild mit seinem Namen und seinem Hashwert. Im Studio entsteht das PDF im Browser, und die Browsertests des Studios schlagen, abgesehen von blob:- und data:-Adressen, bei jeder Anfrage fehl, die nicht an die Adresse geht, unter der das Studio ausgeliefert wird. Die Daten, die Berichtsvorlagen und die erzeugten Dokumente gehören Ihnen, wie es die Lizenz festhält.',
          evidence: EVIDENCE.data,
        },
      ],
      not: 'Keines von beiden ist ein Klinikinformationssystem oder ein zertifiziertes Medizinprodukt: Es sind Bausteine für die Anwendung, die Sie betreiben.',
    },
    actions: { studio: 'Den Editor im Studio ausprobieren', product: 'Formancy Report: was es heute kann' },
    health: {
      heading: 'Daneben: Formancy Health',
      text: 'Formancy Health exportiert ein formancy-Formular als SDC-Questionnaire, die Antworten einer Person als QuestionnaireResponse und ein PDF, etwa ein Zuweisungsschreiben von Formancy Report, in einer DocumentReference, als Ressourcen von HL7® FHIR® R4. Eine Zuweisung für die Schweiz schreibt es als CH ORF auf CH Core, nach den Implementierungsleitfäden von HL7 Schweiz. Es ist eine Bibliothek: Ihre Anwendung verschickt, was es schreibt.',
      status: (released, date) =>
        `Formancy Health 0.1.0, eine Developer Preview, ist seit dem ${released} veröffentlicht, noch nicht für den Export der Daten einer Person in Produktion (Stand ${date}).`,
      link: 'Formancy Health auf GitHub',
      demo: 'Die Demo von Formancy Health',
    },
  },
  fr: {
    meta: {
      title: 'Santé : formulaires et documents PDF – Formancy Report',
      description:
        "Formulaires avec formancy, et lettres d'adressage, rapports et factures aux patients en PDF paginés depuis vos données, chez vous. Export FHIR en préversion.",
      name: 'Santé',
    },
    teaser: {
      heading: 'Pour le secteur de la santé',
      text: "Des lettres d'adressage, rapports médicaux et factures aux patients, imprimés en PDF paginés à partir des données que fournit votre application, avec des montants exacts, sans aucun texte coupé, et des documents qui restent les vôtres : ce qui fonctionne aujourd'hui, et ce qu'exporte Formancy Health, une préversion pour développeurs.",
      action: 'Formancy Report dans le secteur de la santé',
    },
    eyebrow: 'Formancy Report pour le secteur de la santé',
    h1: 'Formulaires et documents PDF pour la santé, sur vos propres serveurs',
    lead: "Les hôpitaux, les cliniques, les cabinets médicaux et les éditeurs de leurs logiciels ont besoin de formulaires que l'on remplit et de documents imprimés avec exactitude. formancy sert à construire les formulaires, Formancy Report à mettre en page et générer les documents, et les deux tournent dans votre propre application, là où se trouvent déjà les données des patients.",
    today: {
      heading: "Ce qui fonctionne aujourd'hui",
      cards: [
        {
          title: 'Des documents avec Formancy Report',
          text: "Une lettre d'adressage, un rapport d'examen, une facture à une patiente : mis en page une fois dans l'éditeur, puis générés en PDF paginé à partir des données que fournit votre application, avec des en-têtes de tableau répétés sur chaque page et des totaux qui restent avec leur dernière ligne.",
          evidence: EVIDENCE.documents,
        },
        {
          title: 'Exact, ou refusé',
          text: "Les montants sont calculés de manière exacte et arrondis au plus une fois. Un texte qui ne tient pas n'est jamais coupé : le moteur de rendu refuse et dit pourquoi, pour qu'aucun document ne perde une ligne sans le dire.",
          evidence: EVIDENCE.exact,
        },
        {
          title: 'Les données des patients restent les vôtres',
          text: "Votre application fournit les données, et chaque image par son nom et son empreinte. Dans le Studio, le PDF est produit dans le navigateur, et les tests du Studio dans le navigateur échouent, adresses blob: et data: mises à part, dès qu'une requête vise une autre adresse que celle où le Studio est servi. Les données, les modèles de rapports et les documents générés restent les vôtres, comme le dit la licence.",
          evidence: EVIDENCE.data,
        },
      ],
      not: "Aucun des deux n'est un système d'information hospitalier ni un dispositif médical certifié : ce sont des briques pour l'application que vous exploitez.",
    },
    actions: { studio: "Essayer l'éditeur dans le Studio", product: "Formancy Report : ce qu'il fait aujourd'hui" },
    health: {
      heading: 'À côté : Formancy Health',
      text: "Formancy Health exporte un formulaire formancy en Questionnaire SDC, les réponses d'une personne en QuestionnaireResponse et un PDF, comme une lettre d'adressage de Formancy Report, dans une DocumentReference, en ressources HL7® FHIR® R4. Pour la Suisse, il écrit un adressage en CH ORF sur CH Core, selon les guides d'implémentation de HL7 Suisse. C'est une bibliothèque : votre application envoie ce qu'il écrit.",
      status: (released, date) =>
        `Formancy Health 0.1.0, une préversion pour développeurs, est publié depuis le ${released}, pas encore pour l'export en production des données d'une personne (état au ${date}).`,
      link: 'Formancy Health sur GitHub',
      demo: 'La démo de Formancy Health',
    },
  },
  it: {
    meta: {
      title: 'Sanità: moduli e documenti PDF – Formancy Report',
      description:
        'Moduli con formancy, e lettere di invio, referti e fatture ai pazienti come PDF impaginati dai vostri dati, sui vostri server. Export FHIR in anteprima.',
      name: 'Sanità',
    },
    teaser: {
      heading: 'Per la sanità',
      text: 'Lettere di invio, referti e fatture ai pazienti, stampati come PDF impaginati dai dati che la vostra applicazione fornisce, con importi esatti, senza testo tagliato e con documenti che restano vostri: che cosa funziona oggi, e che cosa esporta Formancy Health, in anteprima per sviluppatori.',
      action: 'Formancy Report nella sanità',
    },
    eyebrow: 'Formancy Report per la sanità',
    h1: 'Moduli e documenti PDF per la sanità, sui vostri server',
    lead: 'Ospedali, cliniche, studi medici e i produttori dei loro software hanno bisogno di moduli che le persone compilano e di documenti stampati con esattezza. Con formancy si creano i moduli, con Formancy Report si impaginano e si generano i documenti, ed entrambi girano nella vostra applicazione, là dove si trovano già i dati dei pazienti.',
    today: {
      heading: 'Che cosa funziona oggi',
      cards: [
        {
          title: 'Documenti con Formancy Report',
          text: "Una lettera di invio, un referto d'esame, una fattura a una paziente: impaginati una volta nell'editor, poi generati come PDF impaginato dai dati che la vostra applicazione fornisce, con intestazioni di tabella ripetute su ogni pagina e totali che restano con la loro ultima riga.",
          evidence: EVIDENCE.documents,
        },
        {
          title: 'Esatto, o rifiutato',
          text: 'Gli importi sono calcolati in modo esatto e arrotondati al massimo una volta. Un testo che non ci sta non viene mai tagliato: il renderer rifiuta e dice perché, così nessun documento perde una riga senza avvisare.',
          evidence: EVIDENCE.exact,
        },
        {
          title: 'I dati dei pazienti restano vostri',
          text: 'La vostra applicazione fornisce i dati, e ogni immagine con il suo nome e il suo hash. Nello Studio il PDF viene prodotto nel browser, e i test dello Studio nel browser falliscono, a parte gli indirizzi blob: e data:, a qualsiasi richiesta verso un indirizzo diverso da quello da cui lo Studio è servito. I dati, i modelli di report e i documenti generati restano vostri, come dice la licenza.',
          evidence: EVIDENCE.data,
        },
      ],
      not: "Nessuno dei due è un sistema informativo ospedaliero né un dispositivo medico certificato: sono componenti per l'applicazione che gestite.",
    },
    actions: { studio: "Provare l'editor nello Studio", product: 'Formancy Report: che cosa fa oggi' },
    health: {
      heading: 'Accanto: Formancy Health',
      text: 'Formancy Health esporta un modulo formancy come Questionnaire SDC, le risposte di una persona come QuestionnaireResponse e un PDF, come una lettera di invio di Formancy Report, in una DocumentReference, come risorse HL7® FHIR® R4. Per la Svizzera scrive un invio come CH ORF su CH Core, secondo le guide di implementazione di HL7 Svizzera. È una libreria: la vostra applicazione invia ciò che scrive.',
      status: (released, date) =>
        `Formancy Health 0.1.0, un'anteprima per sviluppatori, è pubblicato dal ${released}, non ancora per l'esportazione in produzione dei dati di una persona (stato al ${date}).`,
      link: 'Formancy Health su GitHub',
      demo: 'La demo di Formancy Health',
    },
  },
  en: {
    meta: {
      title: 'Healthcare forms and PDF documents – Formancy Report',
      description:
        'Forms with formancy, and referral letters, reports and patient invoices as paginated PDFs from your own data, self-hosted. HL7 FHIR export in preview.',
      name: 'Healthcare',
    },
    teaser: {
      heading: 'For healthcare',
      text: 'Referral letters, medical reports and invoices to patients, printed as paginated PDFs from the data your application hands over, with exact amounts, no text cut to fit, and documents that remain yours: what works today, and what Formancy Health, a developer preview, exports.',
      action: 'Formancy Report in healthcare',
    },
    eyebrow: 'Formancy Report for healthcare',
    h1: 'Forms and PDF documents for healthcare, on your own servers',
    lead: 'Hospitals, clinics, practices and the vendors whose software they run need forms that people fill in and documents that print exactly. formancy builds the forms, Formancy Report lays out and prints the documents, and both run inside your own application, where the patient data already is.',
    today: {
      heading: 'What works today',
      cards: [
        {
          title: 'Documents with Formancy Report',
          text: 'A referral letter, a report on an examination, an invoice to a patient: laid out once in the editor, then printed as a paginated PDF from the data your application hands over, with table headers that repeat on every page and totals that stay with their last row.',
          evidence: EVIDENCE.documents,
        },
        {
          title: 'Exact, or refused',
          text: 'Amounts are computed exactly and rounded at most once. Text that does not fit is never cut off: the renderer refuses and says why, so no document silently loses a line.',
          evidence: EVIDENCE.exact,
        },
        {
          title: 'Patient data remains yours',
          text: "Your application hands over the data, and each image by its name and digest. In the Studio, the PDF is printed in the browser, and the Studio's browser tests fail, blob: and data: addresses aside, on any request outside the address the Studio is served at. The data, the report templates and the documents generated remain yours, as the licence says.",
          evidence: EVIDENCE.data,
        },
      ],
      not: 'Neither is a hospital information system or a certified medical device: they are building blocks for the application you run.',
    },
    actions: { studio: 'Try the editor in the Studio', product: 'Formancy Report: what it does today' },
    health: {
      heading: 'Beside it: Formancy Health',
      text: "Formancy Health exports a formancy form as an SDC Questionnaire, a person's answers as its QuestionnaireResponse, and a PDF, such as a Formancy Report referral letter, in a DocumentReference, as HL7® FHIR® R4 resources. A Swiss referral is written as CH ORF on CH Core, HL7 Switzerland's implementation guides. It is a library: your application sends what it writes.",
      status: (released, date) =>
        `Formancy Health 0.1.0, a developer preview, released on ${released}; not yet for the production export of a person's record (as of ${date}).`,
      link: 'Formancy Health on GitHub',
      demo: "Formancy Health's demo",
    },
  },
}

function HealthcareBody({ page }: { readonly page: PageContext }): ReactElement {
  const copy = COPY[page.language]
  const root = page.groups.find(isRoot)
  return (
    <>
      <section className="hero" aria-labelledby="top">
        <p className="eyebrow">{copy.eyebrow}</p>
        <h1 id="top">{copy.h1}</h1>
        <p className="lead">{copy.lead}</p>
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
        <p>{copy.today.not}</p>
        <ul className="actions">
          <li>
            <a className="action" href={page.href('')}>
              {copy.actions.studio}
            </a>
          </li>
          {root === undefined ? null : (
            <li>
              <a className="quiet" href={page.pageHref(root.id)}>
                {copy.actions.product}
              </a>
            </li>
          )}
        </ul>
      </section>

      <section className="band panel" aria-labelledby="health">
        <h2 id="health">{copy.health.heading}</h2>
        <p>{copy.health.text}</p>
        <p>
          <strong>{copy.health.status(page.day(HEALTH_RELEASED), page.day(HEALTH_AS_OF))}</strong>
        </p>
        <ul className="links">
          <li>
            <a href={FORMANCY_HEALTH_DEMO}>{copy.health.demo}</a>
          </li>
          <li>
            <a href={FORMANCY_HEALTH}>{copy.health.link}</a>
          </li>
        </ul>
      </section>
    </>
  )
}

export const HEALTHCARE_GROUP: PageGroup = {
  id: 'healthcare',
  slug: { de: 'gesundheitswesen', fr: 'sante', it: 'sanita', en: 'healthcare' },
  meta: { de: COPY.de.meta, fr: COPY.fr.meta, it: COPY.it.meta, en: COPY.en.meta },
  cards: { de: COPY.de.today.cards, fr: COPY.fr.today.cards, it: COPY.it.today.cards, en: COPY.en.today.cards },
  teaser: { de: COPY.de.teaser, fr: COPY.fr.teaser, it: COPY.it.teaser, en: COPY.en.teaser },
  hl7Notice: true,
  Body: HealthcareBody,
}
