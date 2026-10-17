/**
 * The pictures the pages show, each copied at build time from docs/images,
 * where a script made it and a test holds it (never by hand): the Studio,
 * taken by scripts/pictures.mjs, and what each starter and each sample of
 * either invoice prints, taken by report-render-pdf's
 * scripts/readme-pictures.ts. A description quotes the picture's own
 * words, as the document prints them, in whatever language the page is;
 * figures.test.ts holds every quote to the lines docs/images/pictures.json,
 * or samples.json for a sample, records for that page.
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

/** The countries the euro invoice is a sample of, in the order its page shows them after its own language's (0028). */
export const EURO_COUNTRIES = ['DE', 'AT', 'FR', 'IT', 'ES', 'NL', 'IE'] as const
export type EuroCountry = (typeof EURO_COUNTRIES)[number]

/**
 * The euro invoice with its EPC QR code from each country, as the corpus's
 * samples print it (0028): the German is the Studio's euro invoice
 * starter, maintaining a gas boiler; the others sell that boiler's parts,
 * Austria's in the PSA's frame. Each description quotes the longer words
 * first, so that the wording check takes each quote out whole. Every
 * description and caption here, in each of the four languages, is not
 * reviewed by a native speaker.
 */
export const EUROS: Readonly<Record<EuroCountry, Figure>> = {
  DE: {
    picture: 'starter-euro-invoice.png',
    quotes: ['Rechnungsbetrag 1.132,44 €', 'Umsatzsteuer 19 %', 'DE83 0123 4567 0012 3456 78', 'Rechnung'],
    alt: {
      de: 'Die Startvorlage Euro invoice aus Deutschland, eine Rechnung: die Wartung einer Gastherme bis Umsatzsteuer 19 % und Rechnungsbetrag 1.132,44 €, darunter die Bankverbindung mit der IBAN DE83 0123 4567 0012 3456 78 neben dem EPC-QR-Code, mit dem sie bezahlt wird',
      fr: "Le modèle de départ Euro invoice, d'Allemagne, une Rechnung : l'entretien d'une chaudière à gaz jusqu'à Umsatzsteuer 19 % et Rechnungsbetrag 1.132,44 €, puis les coordonnées bancaires avec l'IBAN DE83 0123 4567 0012 3456 78 à côté du QR code SEPA qui permet de la payer",
      it: "Il modello iniziale Euro invoice, dalla Germania, una Rechnung: la manutenzione di una caldaia a gas fino a Umsatzsteuer 19 % e Rechnungsbetrag 1.132,44 €, poi le coordinate bancarie con l'IBAN DE83 0123 4567 0012 3456 78 accanto al QR code SEPA con cui si paga",
      en: "The Euro invoice starter, from Germany, a Rechnung: a gas boiler's maintenance down to Umsatzsteuer 19 % and Rechnungsbetrag 1.132,44 €, then the bank details with the IBAN DE83 0123 4567 0012 3456 78 beside the EPC QR code to pay it with",
    },
    caption: {
      de: 'Deutschland, de-DE: die Wartung einer Gastherme. Im Studio ist es die Startvorlage Euro invoice.',
      fr: "Allemagne, de-DE : l'entretien d'une chaudière à gaz. Dans le Studio, c'est le modèle de départ Euro invoice.",
      it: 'Germania, de-DE: la manutenzione di una caldaia a gas. Nello Studio è il modello iniziale Euro invoice.',
      en: "Germany, de-DE: a gas boiler's maintenance. In the Studio, it is the Euro invoice starter.",
    },
  },
  AT: {
    picture: 'euro-invoice-at.png',
    quotes: ['Gesamtbetrag € 629,44', 'USt 20 %', 'AT93 8012 3000 1234 5678', 'Zahlen mit Code', 'Rechnung'],
    alt: {
      de: 'Das Beispiel aus Österreich, eine Rechnung: Ersatzteile einer Heizung bis USt 20 % und Gesamtbetrag € 629,44, darunter die Bankverbindung mit der IBAN AT93 8012 3000 1234 5678 neben dem EPC-QR-Code im Rahmen der PSA, an seiner rechten Seite Zahlen mit Code',
      fr: "L'exemple d'Autriche, une Rechnung : des pièces de chauffage jusqu'à USt 20 % et Gesamtbetrag € 629,44, puis les coordonnées bancaires avec l'IBAN AT93 8012 3000 1234 5678 à côté du QR code SEPA dans le cadre de la PSA, avec Zahlen mit Code sur son côté droit",
      it: "L'esempio dall'Austria, una Rechnung: ricambi per il riscaldamento fino a USt 20 % e Gesamtbetrag € 629,44, poi le coordinate bancarie con l'IBAN AT93 8012 3000 1234 5678 accanto al QR code SEPA nella cornice della PSA, con Zahlen mit Code sul lato destro",
      en: "The sample from Austria, a Rechnung: heating parts down to USt 20 % and Gesamtbetrag € 629,44, then the bank details with the IBAN AT93 8012 3000 1234 5678 beside the EPC QR code in the PSA's frame, with Zahlen mit Code up its right side",
    },
    caption: {
      de: 'Österreich, de-AT, im Rahmen der österreichischen PSA.',
      fr: 'Autriche, de-AT, dans le cadre de la PSA autrichienne.',
      it: 'Austria, de-AT, nella cornice della PSA austriaca.',
      en: "Austria, de-AT, in the frame of Austria's PSA.",
    },
  },
  FR: {
    picture: 'euro-invoice-fr.png',
    quotes: ['Total TTC 629,44 €', 'TVA 20 %', 'FR76 0123 4000 1200 0123 4567 880', 'Facture'],
    alt: {
      de: 'Das Beispiel aus Frankreich, eine Facture: Ersatzteile einer Heizung bis TVA 20 % und Total TTC 629,44 €, darunter die Bankverbindung mit der IBAN FR76 0123 4000 1200 0123 4567 880 neben dem EPC-QR-Code, mit dem sie bezahlt wird',
      fr: "L'exemple de France, une Facture : des pièces de chauffage jusqu'à TVA 20 % et Total TTC 629,44 €, puis les coordonnées bancaires avec l'IBAN FR76 0123 4000 1200 0123 4567 880 à côté du QR code SEPA qui permet de la payer",
      it: "L'esempio dalla Francia, una Facture: ricambi per il riscaldamento fino a TVA 20 % e Total TTC 629,44 €, poi le coordinate bancarie con l'IBAN FR76 0123 4000 1200 0123 4567 880 accanto al QR code SEPA con cui si paga",
      en: 'The sample from France, a Facture: heating parts down to TVA 20 % and Total TTC 629,44 €, then the bank details with the IBAN FR76 0123 4000 1200 0123 4567 880 beside the EPC QR code to pay it with',
    },
    caption: { de: 'Frankreich, fr-FR.', fr: 'France, fr-FR.', it: 'Francia, fr-FR.', en: 'France, fr-FR.' },
  },
  IT: {
    picture: 'euro-invoice-it.png',
    quotes: ['Totale fattura 639,93 €', 'IVA 22%', 'Copia di cortesia', 'IT53 N000 0000 0120 0001 2345 678', 'Fattura'],
    alt: {
      de: 'Das Beispiel aus Italien, eine Fattura: Ersatzteile einer Heizung bis IVA 22% und Totale fattura 639,93 €, der Hinweis Copia di cortesia, darunter die Bankverbindung mit der IBAN IT53 N000 0000 0120 0001 2345 678 neben dem EPC-QR-Code, mit dem sie bezahlt wird',
      fr: "L'exemple d'Italie, une Fattura : des pièces de chauffage jusqu'à IVA 22% et Totale fattura 639,93 €, la mention Copia di cortesia, puis les coordonnées bancaires avec l'IBAN IT53 N000 0000 0120 0001 2345 678 à côté du QR code SEPA qui permet de la payer",
      it: "L'esempio dall'Italia, una Fattura: ricambi per il riscaldamento fino a IVA 22% e Totale fattura 639,93 €, la dicitura Copia di cortesia, poi le coordinate bancarie con l'IBAN IT53 N000 0000 0120 0001 2345 678 accanto al QR code SEPA con cui si paga",
      en: 'The sample from Italy, a Fattura: heating parts down to IVA 22% and Totale fattura 639,93 €, the notice Copia di cortesia, then the bank details with the IBAN IT53 N000 0000 0120 0001 2345 678 beside the EPC QR code to pay it with',
    },
    caption: { de: 'Italien, it-IT.', fr: 'Italie, it-IT.', it: 'Italia, it-IT.', en: 'Italy, it-IT.' },
  },
  ES: {
    picture: 'euro-invoice-es.png',
    quotes: ['Total factura 634,68 €', 'IVA 21 %', 'ES25 0000 0012 7000 1234 5678', 'Factura'],
    alt: {
      de: 'Das Beispiel aus Spanien, eine Factura: Ersatzteile einer Heizung bis IVA 21 % und Total factura 634,68 €, darunter die Bankverbindung mit der IBAN ES25 0000 0012 7000 1234 5678 neben dem EPC-QR-Code, mit dem sie bezahlt wird',
      fr: "L'exemple d'Espagne, une Factura : des pièces de chauffage jusqu'à IVA 21 % et Total factura 634,68 €, puis les coordonnées bancaires avec l'IBAN ES25 0000 0012 7000 1234 5678 à côté du QR code SEPA qui permet de la payer",
      it: "L'esempio dalla Spagna, una Factura: ricambi per il riscaldamento fino a IVA 21 % e Total factura 634,68 €, poi le coordinate bancarie con l'IBAN ES25 0000 0012 7000 1234 5678 accanto al QR code SEPA con cui si paga",
      en: 'The sample from Spain, a Factura: heating parts down to IVA 21 % and Total factura 634,68 €, then the bank details with the IBAN ES25 0000 0012 7000 1234 5678 beside the EPC QR code to pay it with',
    },
    caption: { de: 'Spanien, es-ES.', fr: 'Espagne, es-ES.', it: 'Spagna, es-ES.', en: 'Spain, es-ES.' },
  },
  NL: {
    picture: 'euro-invoice-nl.png',
    quotes: ['Totaal incl. btw € 634,68', 'Btw 21%', 'NL17 FMNC 0123 4567 89', 'Factuur'],
    alt: {
      de: 'Das Beispiel aus den Niederlanden, eine Factuur: Ersatzteile einer Heizung bis Btw 21% und Totaal incl. btw € 634,68, darunter die Bankverbindung mit der IBAN NL17 FMNC 0123 4567 89 neben dem EPC-QR-Code, mit dem sie bezahlt wird',
      fr: "L'exemple des Pays-Bas, une Factuur : des pièces de chauffage jusqu'à Btw 21% et Totaal incl. btw € 634,68, puis les coordonnées bancaires avec l'IBAN NL17 FMNC 0123 4567 89 à côté du QR code SEPA qui permet de la payer",
      it: "L'esempio dai Paesi Bassi, una Factuur: ricambi per il riscaldamento fino a Btw 21% e Totaal incl. btw € 634,68, poi le coordinate bancarie con l'IBAN NL17 FMNC 0123 4567 89 accanto al QR code SEPA con cui si paga",
      en: 'The sample from the Netherlands, a Factuur: heating parts down to Btw 21% and Totaal incl. btw € 634,68, then the bank details with the IBAN NL17 FMNC 0123 4567 89 beside the EPC QR code to pay it with',
    },
    caption: { de: 'Niederlande, nl-NL.', fr: 'Pays-Bas, nl-NL.', it: 'Paesi Bassi, nl-NL.', en: 'The Netherlands, nl-NL.' },
  },
  IE: {
    picture: 'euro-invoice-ie.png',
    quotes: ['Total due €645.17', 'VAT 23%', 'IE30 FMNC 0000 0012 3456 78', 'Invoice'],
    alt: {
      de: 'Das Beispiel aus Irland, eine Invoice: Ersatzteile einer Heizung bis VAT 23% und Total due €645.17, darunter die Bankverbindung mit der IBAN IE30 FMNC 0000 0012 3456 78 neben dem EPC-QR-Code, mit dem sie bezahlt wird',
      fr: "L'exemple d'Irlande, une Invoice : des pièces de chauffage jusqu'à VAT 23% et Total due €645.17, puis les coordonnées bancaires avec l'IBAN IE30 FMNC 0000 0012 3456 78 à côté du QR code SEPA qui permet de la payer",
      it: "L'esempio dall'Irlanda, un'Invoice: ricambi per il riscaldamento fino a VAT 23% e Total due €645.17, poi le coordinate bancarie con l'IBAN IE30 FMNC 0000 0012 3456 78 accanto al QR code SEPA con cui si paga",
      en: 'The sample from Ireland, an Invoice: heating parts down to VAT 23% and Total due €645.17, then the bank details with the IBAN IE30 FMNC 0000 0012 3456 78 beside the EPC QR code to pay it with',
    },
    caption: { de: 'Irland, en-IE.', fr: 'Irlande, en-IE.', it: 'Irlanda, en-IE.', en: 'Ireland, en-IE.' },
  },
}

/**
 * Every figure the site shows: the Studio, the starters, the invoice with
 * its QR-bill in each language, and the euro invoice from each country.
 * figures.test.ts holds each one's quotes to its picture, and the wording
 * check reads their quotes as the documents' own words.
 */
export const FIGURES: readonly Figure[] = [STUDIO, ...STARTERS, ...LANGUAGES.map((language) => INVOICES[language]), ...EURO_COUNTRIES.map((country) => EUROS[country])]

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
