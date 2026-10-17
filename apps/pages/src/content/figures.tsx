/**
 * The pictures the pages show, each copied at build time from docs/images,
 * where a script made it and a test holds it (never by hand): the Studio,
 * taken by scripts/pictures.mjs, and what each starter and each invoice
 * sample prints, taken by report-render-pdf's scripts/readme-pictures.ts. A
 * description quotes the picture's own words, as the document prints them,
 * in whatever language the page is; figures.test.ts holds every quote to the
 * lines docs/images/pictures.json, or samples.json for a sample, records
 * for that page.
 */
import type { ReactElement } from 'react'
import { LANGUAGES } from '../languages.js'
import type { Language } from '../languages.js'
import type { PageContext } from '../pages.js'
import { picturePath } from '../pages.js'

export interface Figure {
  /** Its path under docs/images. */
  readonly picture: string
  /** The words of the document its description quotes, verbatim. */
  readonly quotes: readonly string[]
  readonly alt: Readonly<Record<Language, string>>
  readonly caption: Readonly<Record<Language, string>>
}

/** The Studio, as the README opens with it. */
export const STUDIO: Figure = {
  picture: 'readme/studio-react.webp',
  quotes: [],
  alt: {
    de: 'Das Formancy Report Studio: der React-Builder mit Gliederung, Entwurfsansicht und Eigenschaften, daneben die Startvorlage Offerte als PDF auf weissem Papier.',
    fr: 'Le Studio de Formancy Report : le builder React avec son plan, sa vue de conception et ses propriétés, et à côté le modèle de départ Offerte imprimé en PDF sur papier blanc.',
    it: 'Lo Studio di Formancy Report: il builder React con struttura, vista di progettazione e proprietà, e accanto il modello iniziale Offerte stampato come PDF su carta bianca.',
    en: 'The Formancy Report Studio: the React builder with its outline, design view and properties, and beside it the quotation starter printed as a PDF on white paper.',
  },
  caption: {
    de: 'Das Studio: der Editor und daneben das PDF, das aus der Sitzung entsteht.',
    fr: "Le Studio : l'éditeur et, à côté, le PDF que produit la session.",
    it: "Lo Studio: l'editor e, accanto, il PDF prodotto dalla sessione.",
    en: 'The Studio: the editor, and beside it the PDF the session prints.',
  },
}

/** What the starters print, as the README shows them. */
export const STARTERS: readonly Figure[] = [
  {
    picture: 'starter-quotation.png',
    quotes: ['Zwischensumme', 'MWST 8.1 %', 'Rundung', "Total CHF 3'143.00"],
    alt: {
      de: "Die Startvorlage Offerte: Positionen in Schweizer Franken, dann Zwischensumme, MWST 8.1 %, Rundung und Total CHF 3'143.00",
      fr: "Le modèle de départ Offerte : des lignes en francs suisses, puis Zwischensumme, MWST 8.1 %, Rundung et Total CHF 3'143.00",
      it: "Il modello iniziale Offerte: righe in franchi svizzeri, poi Zwischensumme, MWST 8.1 %, Rundung e Total CHF 3'143.00",
      en: "The quotation starter, an Offerte: line items in Swiss francs, then Zwischensumme, MWST 8.1 %, Rundung and Total CHF 3'143.00",
    },
    caption: {
      de: 'Eine Offerte: Positionen, MWST und Total, exakt berechnet.',
      fr: 'Une offre : des lignes, la TVA et le total, calculés de manière exacte.',
      it: "Un'offerta: righe, IVA e totale, calcolati in modo esatto.",
      en: 'A quotation: line items, VAT and the total, computed exactly.',
    },
  },
  {
    picture: 'starter-service-inspection.png',
    quotes: ['Defect found', "Inspector's signature"],
    alt: {
      de: "Die Startvorlage Serviceinspektion, Seite 2: der Rahmen mit dem Titel Defect found, das Foto aus den Daten und die Abnahme über der Zeile Inspector's signature, mit ihr auf derselben Seite",
      fr: "Le modèle de départ Inspection de service, page 2 : le cadre intitulé Defect found, la photo issue des données, et la validation au-dessus de la ligne Inspector's signature, sur la même page qu'elle",
      it: "Il modello iniziale Ispezione di servizio, pagina 2: il riquadro intitolato Defect found, la foto presa dai dati e la convalida sopra la riga Inspector's signature, sulla stessa pagina",
      en: "The service inspection starter, page 2: the frame headed Defect found, the photo from the data, and the sign-off above Inspector's signature kept with it",
    },
    caption: {
      de: 'Eine Serviceinspektion: ein gerahmter Befund mit seinem Foto, und die Abnahme bleibt bei ihrer Unterschriftszeile.',
      fr: 'Une inspection de service : un constat encadré avec sa photo, et la validation gardée avec sa ligne de signature.',
      it: "Un'ispezione di servizio: un riscontro incorniciato con la sua foto, e la convalida tenuta con la sua riga per la firma.",
      en: 'A service inspection: a framed finding with its photo, and the sign-off kept with its signature line.',
    },
  },
  {
    picture: 'starter-grouped-equipment.png',
    quotes: ['Basel (12 items)', 'Subtotal Basel 12'],
    alt: {
      de: 'Die Startvorlage Geräteverzeichnis, nach Standort gruppiert: Basel (12 items) eröffnet seine Gruppe, und Subtotal Basel 12 schliesst sie',
      fr: 'Le modèle de départ Registre des équipements, groupé par site : Basel (12 items) ouvre son groupe, et Subtotal Basel 12 le clôt',
      it: 'Il modello iniziale Registro delle attrezzature, raggruppato per sede: Basel (12 items) apre il suo gruppo e Subtotal Basel 12 lo chiude',
      en: 'The equipment register starter, grouped by site: Basel (12 items) heads its group, and Subtotal Basel 12 closes it',
    },
    caption: {
      de: 'Ein Geräteverzeichnis, nach Standort gruppiert, jede Gruppe mit ihrer Anzahl und Zwischensumme.',
      fr: 'Un registre des équipements, groupé par site, chaque groupe avec son nombre et son sous-total.',
      it: 'Un registro delle attrezzature, raggruppato per sede, ogni gruppo con il suo conteggio e il suo subtotale.',
      en: 'An equipment register, grouped by site, each group with its count and subtotal.',
    },
  },
]

/**
 * The invoice with its QR-bill in each language, as the corpus's samples
 * print it (0024): the German is the Studio's invoice starter, and the
 * French, Italian and English bill the same work from an invented firm of
 * their region, the slip's headings in SIX's words for the language.
 */
export const INVOICES: Readonly<Record<Language, Figure>> = {
  de: {
    picture: 'starter-invoice.png',
    quotes: ['Rechnung', "Total CHF 1'416.52", 'Empfangsschein', 'Zahlteil', 'CHF 1 416.52'],
    alt: {
      de: "Das Beispiel auf Deutsch, eine Rechnung: Positionen bis zum Total CHF 1'416.52 und am Fuss der Seite Empfangsschein und Zahlteil mit dem Swiss QR Code, beide über CHF 1 416.52",
      fr: "L'exemple en allemand, une Rechnung : des lignes jusqu'au Total CHF 1'416.52 et, au pied de la page, Empfangsschein et Zahlteil avec le Swiss QR Code, tous deux d'un montant de CHF 1 416.52",
      it: "L'esempio in tedesco, una Rechnung: righe fino al Total CHF 1'416.52 e, in fondo alla pagina, Empfangsschein e Zahlteil con lo Swiss QR Code, entrambi per un importo di CHF 1 416.52",
      en: "The sample in German, a Rechnung: line items down to Total CHF 1'416.52, and across the foot of the page the Empfangsschein and the Zahlteil with its Swiss QR Code, both for CHF 1 416.52",
    },
    caption: {
      de: 'Deutsch, für die Deutschschweiz. Im Studio ist es die Startvorlage Invoice.',
      fr: "En allemand, pour la Suisse alémanique. Dans le Studio, c'est le modèle de départ Invoice.",
      it: 'In tedesco, per la Svizzera tedesca. Nello Studio è il modello iniziale Invoice.',
      en: 'German, for German-speaking Switzerland. In the Studio, it is the Invoice starter.',
    },
  },
  fr: {
    picture: 'invoice-fr.png',
    quotes: ['Facture', "Total 1'416.52 CHF", 'Récépissé', 'Section paiement', 'CHF 1 416.52'],
    alt: {
      de: "Das Beispiel auf Französisch, eine Facture: Positionen bis zum Total 1'416.52 CHF und am Fuss der Seite Récépissé und Section paiement mit dem Swiss QR Code, beide über CHF 1 416.52",
      fr: "L'exemple en français, une Facture : des lignes jusqu'au Total 1'416.52 CHF et, au pied de la page, le Récépissé et la Section paiement avec le Swiss QR Code, tous deux d'un montant de CHF 1 416.52",
      it: "L'esempio in francese, una Facture: righe fino al Total 1'416.52 CHF e, in fondo alla pagina, Récépissé e Section paiement con lo Swiss QR Code, entrambi per un importo di CHF 1 416.52",
      en: "The sample in French, a Facture: line items down to Total 1'416.52 CHF, and across the foot of the page the Récépissé and the Section paiement with its Swiss QR Code, both for CHF 1 416.52",
    },
    caption: {
      de: 'Französisch, für die Romandie.',
      fr: 'En français, pour la Suisse romande.',
      it: 'In francese, per la Svizzera romanda.',
      en: 'French, for French-speaking Switzerland.',
    },
  },
  it: {
    picture: 'invoice-it.png',
    quotes: ['Fattura', 'Totale CHF 1416.52', 'Ricevuta', 'Sezione pagamento', 'CHF 1 416.52'],
    alt: {
      de: 'Das Beispiel auf Italienisch, eine Fattura: Positionen bis zum Totale CHF 1416.52 und am Fuss der Seite Ricevuta und Sezione pagamento mit dem Swiss QR Code, beide über CHF 1 416.52',
      fr: "L'exemple en italien, une Fattura : des lignes jusqu'au Totale CHF 1416.52 et, au pied de la page, Ricevuta et Sezione pagamento avec le Swiss QR Code, toutes deux d'un montant de CHF 1 416.52",
      it: "L'esempio in italiano, una Fattura: righe fino al Totale CHF 1416.52 e, in fondo alla pagina, la Ricevuta e la Sezione pagamento con lo Swiss QR Code, entrambe per un importo di CHF 1 416.52",
      en: 'The sample in Italian, a Fattura: line items down to Totale CHF 1416.52, and across the foot of the page the Ricevuta and the Sezione pagamento with its Swiss QR Code, both for CHF 1 416.52',
    },
    caption: {
      de: 'Italienisch, für das Tessin.',
      fr: 'En italien, pour le Tessin.',
      it: 'In italiano, per il Ticino.',
      en: 'Italian, for Ticino.',
    },
  },
  en: {
    picture: 'invoice-en.png',
    quotes: ['Invoice', "Total CHF 1'416.52", 'Receipt', 'Payment part', 'CHF 1 416.52'],
    alt: {
      de: "Das Beispiel auf Englisch, eine Invoice: Positionen bis zum Total CHF 1'416.52 und am Fuss der Seite Receipt und Payment part mit dem Swiss QR Code, beide über CHF 1 416.52",
      fr: "L'exemple en anglais, une Invoice : des lignes jusqu'au Total CHF 1'416.52 et, au pied de la page, Receipt et Payment part avec le Swiss QR Code, tous deux d'un montant de CHF 1 416.52",
      it: "L'esempio in inglese, un'Invoice: righe fino al Total CHF 1'416.52 e, in fondo alla pagina, Receipt e Payment part con lo Swiss QR Code, entrambi per un importo di CHF 1 416.52",
      en: "The sample in English, an Invoice: line items down to Total CHF 1'416.52, and across the foot of the page the Receipt and the Payment part with its Swiss QR Code, both for CHF 1 416.52",
    },
    caption: {
      de: 'Englisch, von einer Basler Firma, die auf Englisch fakturiert.',
      fr: "En anglais, d'une entreprise bâloise qui facture en anglais.",
      it: "In inglese, da un'azienda di Basilea che fattura in inglese.",
      en: 'English, from a Basel firm that invoices in English.',
    },
  },
}

/**
 * Every figure the site shows: the Studio, the starters, and the invoice in
 * each language. figures.test.ts holds each one's quotes to its picture,
 * and the wording check reads their quotes as the documents' own words.
 */
export const FIGURES: readonly Figure[] = [STUDIO, ...STARTERS, ...LANGUAGES.map((language) => INVOICES[language])]

/** Every picture the site shows, each by its path under docs/images: what the build copies. */
export const PICTURES: readonly string[] = FIGURES.map((figure) => figure.picture)

/**
 * A figure on `page`: the picture at its own size, so the page does not
 * move as it loads, described and captioned in the page's language. Only
 * the first picture of a page loads at once; the rest load as they near
 * the window.
 */
export function FigureView({ figure, page, first = false }: { readonly figure: Figure; readonly page: PageContext; readonly first?: boolean }): ReactElement {
  const picture = page.inputs.pictures.find((each) => each.name === figure.picture)
  if (picture === undefined) throw new Error(`the site shows ${figure.picture}, and the inputs hold no such picture`)
  return (
    <figure className="figure">
      <img src={page.href(picturePath(figure.picture))} alt={figure.alt[page.language]} width={picture.width} height={picture.height} loading={first ? 'eager' : 'lazy'} decoding="async" />
      <figcaption>{figure.caption[page.language]}</figcaption>
    </figure>
  )
}
