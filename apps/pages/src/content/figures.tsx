/**
 * The pictures the pages show, each copied at build time from docs/images,
 * where a script made it and a test holds it (never by hand): the Studio,
 * taken by scripts/pictures.mjs, and what each starter and each sample of
 * either invoice prints, taken by report-render-pdf's
 * scripts/readme-pictures.ts. A description quotes the picture's own
 * words, as the document prints them, in whatever language the page is;
 * figures.test.ts holds every quote to the lines docs/images/pictures.json,
 * or samples.json for a sample, records for that page. A picture of the
 * Studio, under readme/, is no document's page: a quote of its own is held
 * to the text docs/images/readme/captured.json records of the scene, as
 * the README's are, and the Studio's words it shows are those its page
 * names as studio words (checks/studio-words.ts, 0081).
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
    de: 'Das Formancy Report Studio: der React-Builder mit Gliederung, Entwurfsansicht und Eigenschaften, daneben die Startvorlage Offerte unter dem Logo der Firma als PDF auf weissem Papier.',
    fr: "Le Studio de Formancy Report : le builder React avec son plan, sa vue de conception et ses propriétés, et à côté le modèle de départ Offerte, sous le logo de l'entreprise, imprimé en PDF sur papier blanc.",
    it: "Lo Studio di Formancy Report: il builder React con struttura, vista di progettazione e proprietà, e accanto il modello iniziale Offerte, sotto il logo dell'azienda, stampato come PDF su carta bianca.",
    en: "The Formancy Report Studio: the React builder with its outline, design view and properties, and beside it the quotation starter, under the firm's mark, printed as a PDF on white paper.",
  },
  caption: {
    de: 'Das Studio: der Editor und daneben das PDF, das aus der Sitzung entsteht.',
    fr: "Le Studio : l'éditeur et, à côté, le PDF que produit la session.",
    it: "Lo Studio: l'editor e, accanto, il PDF prodotto dalla sessione.",
    en: 'The Studio: the editor, and beside it the PDF the session prints.',
  },
}

/** What the starters print, as the README shows them, the quotation first: the document the README's picture of the Studio shows, whose page the start page and the builders' pages name for a shared link. The Studio itself opens on the invoice (0082). */
export const STARTERS: readonly [Figure, ...Figure[]] = [
  {
    picture: 'starter-quotation.png',
    quotes: ['Zwischensumme', 'MWST 8.1 %', 'Rundung', "Total CHF 3'143.00"],
    alt: {
      de: "Die Startvorlage Offerte unter dem Logo der Firma: Positionen in Schweizer Franken, dann Zwischensumme, MWST 8.1 %, Rundung und Total CHF 3'143.00",
      fr: "Le modèle de départ Offerte, sous le logo de l'entreprise : des lignes en francs suisses, puis Zwischensumme, MWST 8.1 %, Rundung et Total CHF 3'143.00",
      it: "Il modello iniziale Offerte, sotto il logo dell'azienda: righe in franchi svizzeri, poi Zwischensumme, MWST 8.1 %, Rundung e Total CHF 3'143.00",
      en: "The quotation starter, an Offerte under the firm's mark: line items in Swiss francs, then Zwischensumme, MWST 8.1 %, Rundung and Total CHF 3'143.00",
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
      de: "Das Beispiel auf Deutsch, eine Rechnung unter dem Logo der Firma: Positionen bis zum Total CHF 1'416.52 und am Fuss der Seite Empfangsschein und Zahlteil mit dem Swiss QR Code, beide über CHF 1 416.52",
      fr: "L'exemple en allemand, une Rechnung, sous le logo de l'entreprise : des lignes jusqu'au Total CHF 1'416.52 et, au pied de la page, Empfangsschein et Zahlteil avec le Swiss QR Code, tous deux d'un montant de CHF 1 416.52",
      it: "L'esempio in tedesco, una Rechnung, sotto il logo dell'azienda: righe fino al Total CHF 1'416.52 e, in fondo alla pagina, Empfangsschein e Zahlteil con lo Swiss QR Code, entrambi per un importo di CHF 1 416.52",
      en: "The sample in German, a Rechnung under the firm's mark: line items down to Total CHF 1'416.52, and across the foot of the page the Empfangsschein and the Zahlteil with its Swiss QR Code, both for CHF 1 416.52",
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
      de: "Das Beispiel auf Französisch, eine Facture unter dem Logo der Firma: Positionen bis zum Total 1'416.52 CHF und am Fuss der Seite Récépissé und Section paiement mit dem Swiss QR Code, beide über CHF 1 416.52",
      fr: "L'exemple en français, une Facture, sous le logo de l'entreprise : des lignes jusqu'au Total 1'416.52 CHF et, au pied de la page, le Récépissé et la Section paiement avec le Swiss QR Code, tous deux d'un montant de CHF 1 416.52",
      it: "L'esempio in francese, una Facture, sotto il logo dell'azienda: righe fino al Total 1'416.52 CHF e, in fondo alla pagina, Récépissé e Section paiement con lo Swiss QR Code, entrambi per un importo di CHF 1 416.52",
      en: "The sample in French, a Facture under the firm's mark: line items down to Total 1'416.52 CHF, and across the foot of the page the Récépissé and the Section paiement with its Swiss QR Code, both for CHF 1 416.52",
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
      de: 'Das Beispiel auf Italienisch, eine Fattura unter dem Logo der Firma: Positionen bis zum Totale CHF 1416.52 und am Fuss der Seite Ricevuta und Sezione pagamento mit dem Swiss QR Code, beide über CHF 1 416.52',
      fr: "L'exemple en italien, une Fattura, sous le logo de l'entreprise : des lignes jusqu'au Totale CHF 1416.52 et, au pied de la page, Ricevuta et Sezione pagamento avec le Swiss QR Code, toutes deux d'un montant de CHF 1 416.52",
      it: "L'esempio in italiano, una Fattura, sotto il logo dell'azienda: righe fino al Totale CHF 1416.52 e, in fondo alla pagina, la Ricevuta e la Sezione pagamento con lo Swiss QR Code, entrambe per un importo di CHF 1 416.52",
      en: "The sample in Italian, a Fattura under the firm's mark: line items down to Totale CHF 1416.52, and across the foot of the page the Ricevuta and the Sezione pagamento with its Swiss QR Code, both for CHF 1 416.52",
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
      de: "Das Beispiel auf Englisch, eine Invoice unter dem Logo der Firma: Positionen bis zum Total CHF 1'416.52 und am Fuss der Seite Receipt und Payment part mit dem Swiss QR Code, beide über CHF 1 416.52",
      fr: "L'exemple en anglais, une Invoice, sous le logo de l'entreprise : des lignes jusqu'au Total CHF 1'416.52 et, au pied de la page, Receipt et Payment part avec le Swiss QR Code, tous deux d'un montant de CHF 1 416.52",
      it: "L'esempio in inglese, un'Invoice, sotto il logo dell'azienda: righe fino al Total CHF 1'416.52 e, in fondo alla pagina, Receipt e Payment part con lo Swiss QR Code, entrambi per un importo di CHF 1 416.52",
      en: "The sample in English, an Invoice under the firm's mark: line items down to Total CHF 1'416.52, and across the foot of the page the Receipt and the Payment part with its Swiss QR Code, both for CHF 1 416.52",
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
      de: 'Die Startvorlage Euro invoice aus Deutschland, eine Rechnung unter dem Logo der Firma: die Wartung einer Gastherme bis Umsatzsteuer 19 % und Rechnungsbetrag 1.132,44 €, darunter die Bankverbindung mit der IBAN DE83 0123 4567 0012 3456 78 neben dem EPC-QR-Code, mit dem sie bezahlt wird',
      fr: "Le modèle de départ Euro invoice, d'Allemagne, une Rechnung, sous le logo de l'entreprise : l'entretien d'une chaudière à gaz jusqu'à Umsatzsteuer 19 % et Rechnungsbetrag 1.132,44 €, puis les coordonnées bancaires avec l'IBAN DE83 0123 4567 0012 3456 78 à côté du QR code SEPA qui permet de la payer",
      it: "Il modello iniziale Euro invoice, dalla Germania, una Rechnung, sotto il logo dell'azienda: la manutenzione di una caldaia a gas fino a Umsatzsteuer 19 % e Rechnungsbetrag 1.132,44 €, poi le coordinate bancarie con l'IBAN DE83 0123 4567 0012 3456 78 accanto al QR code SEPA con cui si paga",
      en: "The Euro invoice starter, from Germany, a Rechnung under the firm's mark: a gas boiler's maintenance down to Umsatzsteuer 19 % and Rechnungsbetrag 1.132,44 €, then the bank details with the IBAN DE83 0123 4567 0012 3456 78 beside the EPC QR code to pay it with",
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
      de: 'Das Beispiel aus Österreich, eine Rechnung unter dem Logo der Firma: Ersatzteile einer Heizung bis USt 20 % und Gesamtbetrag € 629,44, darunter die Bankverbindung mit der IBAN AT93 8012 3000 1234 5678 neben dem EPC-QR-Code im Rahmen der PSA, an seiner rechten Seite Zahlen mit Code',
      fr: "L'exemple d'Autriche, une Rechnung, sous le logo de l'entreprise : des pièces de chauffage jusqu'à USt 20 % et Gesamtbetrag € 629,44, puis les coordonnées bancaires avec l'IBAN AT93 8012 3000 1234 5678 à côté du QR code SEPA dans le cadre de la PSA, avec Zahlen mit Code sur son côté droit",
      it: "L'esempio dall'Austria, una Rechnung, sotto il logo dell'azienda: ricambi per il riscaldamento fino a USt 20 % e Gesamtbetrag € 629,44, poi le coordinate bancarie con l'IBAN AT93 8012 3000 1234 5678 accanto al QR code SEPA nella cornice della PSA, con Zahlen mit Code sul lato destro",
      en: "The sample from Austria, a Rechnung under the firm's mark: heating parts down to USt 20 % and Gesamtbetrag € 629,44, then the bank details with the IBAN AT93 8012 3000 1234 5678 beside the EPC QR code in the PSA's frame, with Zahlen mit Code up its right side",
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
      de: 'Das Beispiel aus Frankreich, eine Facture unter dem Logo der Firma: Ersatzteile einer Heizung bis TVA 20 % und Total TTC 629,44 €, darunter die Bankverbindung mit der IBAN FR76 0123 4000 1200 0123 4567 880 neben dem EPC-QR-Code, mit dem sie bezahlt wird',
      fr: "L'exemple de France, une Facture, sous le logo de l'entreprise : des pièces de chauffage jusqu'à TVA 20 % et Total TTC 629,44 €, puis les coordonnées bancaires avec l'IBAN FR76 0123 4000 1200 0123 4567 880 à côté du QR code SEPA qui permet de la payer",
      it: "L'esempio dalla Francia, una Facture, sotto il logo dell'azienda: ricambi per il riscaldamento fino a TVA 20 % e Total TTC 629,44 €, poi le coordinate bancarie con l'IBAN FR76 0123 4000 1200 0123 4567 880 accanto al QR code SEPA con cui si paga",
      en: "The sample from France, a Facture under the firm's mark: heating parts down to TVA 20 % and Total TTC 629,44 €, then the bank details with the IBAN FR76 0123 4000 1200 0123 4567 880 beside the EPC QR code to pay it with",
    },
    caption: { de: 'Frankreich, fr-FR.', fr: 'France, fr-FR.', it: 'Francia, fr-FR.', en: 'France, fr-FR.' },
  },
  IT: {
    picture: 'euro-invoice-it.png',
    quotes: ['Totale fattura 639,93 €', 'IVA 22%', 'Copia di cortesia', 'IT53 N000 0000 0120 0001 2345 678', 'Fattura'],
    alt: {
      de: 'Das Beispiel aus Italien, eine Fattura unter dem Logo der Firma: Ersatzteile einer Heizung bis IVA 22% und Totale fattura 639,93 €, der Hinweis Copia di cortesia, darunter die Bankverbindung mit der IBAN IT53 N000 0000 0120 0001 2345 678 neben dem EPC-QR-Code, mit dem sie bezahlt wird',
      fr: "L'exemple d'Italie, une Fattura, sous le logo de l'entreprise : des pièces de chauffage jusqu'à IVA 22% et Totale fattura 639,93 €, la mention Copia di cortesia, puis les coordonnées bancaires avec l'IBAN IT53 N000 0000 0120 0001 2345 678 à côté du QR code SEPA qui permet de la payer",
      it: "L'esempio dall'Italia, una Fattura, sotto il logo dell'azienda: ricambi per il riscaldamento fino a IVA 22% e Totale fattura 639,93 €, la dicitura Copia di cortesia, poi le coordinate bancarie con l'IBAN IT53 N000 0000 0120 0001 2345 678 accanto al QR code SEPA con cui si paga",
      en: "The sample from Italy, a Fattura under the firm's mark: heating parts down to IVA 22% and Totale fattura 639,93 €, the notice Copia di cortesia, then the bank details with the IBAN IT53 N000 0000 0120 0001 2345 678 beside the EPC QR code to pay it with",
    },
    caption: { de: 'Italien, it-IT.', fr: 'Italie, it-IT.', it: 'Italia, it-IT.', en: 'Italy, it-IT.' },
  },
  ES: {
    picture: 'euro-invoice-es.png',
    quotes: ['Total factura 634,68 €', 'IVA 21 %', 'ES25 0000 0012 7000 1234 5678', 'Factura'],
    alt: {
      de: 'Das Beispiel aus Spanien, eine Factura unter dem Logo der Firma: Ersatzteile einer Heizung bis IVA 21 % und Total factura 634,68 €, darunter die Bankverbindung mit der IBAN ES25 0000 0012 7000 1234 5678 neben dem EPC-QR-Code, mit dem sie bezahlt wird',
      fr: "L'exemple d'Espagne, une Factura, sous le logo de l'entreprise : des pièces de chauffage jusqu'à IVA 21 % et Total factura 634,68 €, puis les coordonnées bancaires avec l'IBAN ES25 0000 0012 7000 1234 5678 à côté du QR code SEPA qui permet de la payer",
      it: "L'esempio dalla Spagna, una Factura, sotto il logo dell'azienda: ricambi per il riscaldamento fino a IVA 21 % e Total factura 634,68 €, poi le coordinate bancarie con l'IBAN ES25 0000 0012 7000 1234 5678 accanto al QR code SEPA con cui si paga",
      en: "The sample from Spain, a Factura under the firm's mark: heating parts down to IVA 21 % and Total factura 634,68 €, then the bank details with the IBAN ES25 0000 0012 7000 1234 5678 beside the EPC QR code to pay it with",
    },
    caption: { de: 'Spanien, es-ES.', fr: 'Espagne, es-ES.', it: 'Spagna, es-ES.', en: 'Spain, es-ES.' },
  },
  NL: {
    picture: 'euro-invoice-nl.png',
    quotes: ['Totaal incl. btw € 634,68', 'Btw 21%', 'NL17 FMNC 0123 4567 89', 'Factuur'],
    alt: {
      de: 'Das Beispiel aus den Niederlanden, eine Factuur unter dem Logo der Firma: Ersatzteile einer Heizung bis Btw 21% und Totaal incl. btw € 634,68, darunter die Bankverbindung mit der IBAN NL17 FMNC 0123 4567 89 neben dem EPC-QR-Code, mit dem sie bezahlt wird',
      fr: "L'exemple des Pays-Bas, une Factuur, sous le logo de l'entreprise : des pièces de chauffage jusqu'à Btw 21% et Totaal incl. btw € 634,68, puis les coordonnées bancaires avec l'IBAN NL17 FMNC 0123 4567 89 à côté du QR code SEPA qui permet de la payer",
      it: "L'esempio dai Paesi Bassi, una Factuur, sotto il logo dell'azienda: ricambi per il riscaldamento fino a Btw 21% e Totaal incl. btw € 634,68, poi le coordinate bancarie con l'IBAN NL17 FMNC 0123 4567 89 accanto al QR code SEPA con cui si paga",
      en: "The sample from the Netherlands, a Factuur under the firm's mark: heating parts down to Btw 21% and Totaal incl. btw € 634,68, then the bank details with the IBAN NL17 FMNC 0123 4567 89 beside the EPC QR code to pay it with",
    },
    caption: { de: 'Niederlande, nl-NL.', fr: 'Pays-Bas, nl-NL.', it: 'Paesi Bassi, nl-NL.', en: 'The Netherlands, nl-NL.' },
  },
  IE: {
    picture: 'euro-invoice-ie.png',
    quotes: ['Total due €645.17', 'VAT 23%', 'IE30 FMNC 0000 0012 3456 78', 'Invoice'],
    alt: {
      de: 'Das Beispiel aus Irland, eine Invoice unter dem Logo der Firma: Ersatzteile einer Heizung bis VAT 23% und Total due €645.17, darunter die Bankverbindung mit der IBAN IE30 FMNC 0000 0012 3456 78 neben dem EPC-QR-Code, mit dem sie bezahlt wird',
      fr: "L'exemple d'Irlande, une Invoice, sous le logo de l'entreprise : des pièces de chauffage jusqu'à VAT 23% et Total due €645.17, puis les coordonnées bancaires avec l'IBAN IE30 FMNC 0000 0012 3456 78 à côté du QR code SEPA qui permet de la payer",
      it: "L'esempio dall'Irlanda, un'Invoice, sotto il logo dell'azienda: ricambi per il riscaldamento fino a VAT 23% e Total due €645.17, poi le coordinate bancarie con l'IBAN IE30 FMNC 0000 0012 3456 78 accanto al QR code SEPA con cui si paga",
      en: "The sample from Ireland, an Invoice under the firm's mark: heating parts down to VAT 23% and Total due €645.17, then the bank details with the IBAN IE30 FMNC 0000 0012 3456 78 beside the EPC QR code to pay it with",
    },
    caption: { de: 'Irland, en-IE.', fr: 'Irlande, en-IE.', it: 'Irlanda, en-IE.', en: 'Ireland, en-IE.' },
  },
}

/**
 * The e-invoice starter's page, as the invoices page shows it beside the
 * QR-bill's and the EPC QR code's (0081): a Factur-X, whose final render
 * embeds the XML that holds the totals it prints.
 */
export const E_INVOICE: Figure = {
  picture: 'starter-e-invoice.png',
  quotes: ['Rechnungsbetrag 871,63 €', 'Bankverbindung', 'Rechnung'],
  alt: {
    de: 'Die Startvorlage E-invoice (Factur-X), eine Rechnung unter dem Logo der Firma, deren endgültiger Druck ein PDF/A-3b ist, das sein XML einbettet: Positionen in Euro bis zum Rechnungsbetrag 871,63 €, darunter die Bankverbindung neben dem EPC-QR-Code, mit dem sie bezahlt wird',
    fr: "Le modèle de départ E-invoice (Factur-X), une Rechnung allemande, sous le logo de l'entreprise, dont le rendu final est un PDF/A-3b qui embarque son XML : des lignes en euros jusqu'au Rechnungsbetrag 871,63 €, puis la Bankverbindung à côté du QR code SEPA qui permet de la payer",
    it: "Il modello iniziale E-invoice (Factur-X), una Rechnung tedesca, sotto il logo dell'azienda, la cui stampa definitiva è un PDF/A-3b che incorpora il suo XML: righe in euro fino al Rechnungsbetrag 871,63 €, poi la Bankverbindung accanto al QR code SEPA con cui si paga",
    en: "The E-invoice (Factur-X) starter, a German Rechnung under the firm's mark, whose final render is a PDF/A-3b that embeds its XML: line items in euro down to Rechnungsbetrag 871,63 €, then the Bankverbindung beside the EPC QR code to pay it with",
  },
  caption: {
    de: 'Deutschland: eine E-Rechnung als Factur-X / ZUGFeRD. Im Studio ist es die Startvorlage E-invoice (Factur-X).',
    fr: "Allemagne : une facture Factur-X / ZUGFeRD. Dans le Studio, c'est le modèle de départ E-invoice (Factur-X).",
    it: 'Germania: una fattura Factur-X / ZUGFeRD. Nello Studio è il modello iniziale E-invoice (Factur-X).',
    en: 'Germany: a Factur-X / ZUGFeRD e-invoice. In the Studio, it is the E-invoice (Factur-X) starter.',
  },
}

/** The payment reminder starter's page, as the invoices page shows it (0081): what is overdue, what was paid, and a QR-bill for the rest. */
export const PAYMENT_REMINDER: Figure = {
  picture: 'starter-payment-reminder.png',
  quotes: ["Zu bezahlen CHF 3'207.30", 'CHF 3 207.30', 'Empfangsschein', 'Zahlteil', 'Mahnung'],
  alt: {
    de: "Die Startvorlage Payment reminder, eine Mahnung unter dem Logo der Firma: die überfälligen Rechnungen und die erhaltenen Zahlungen, jede Tabelle mit ihrem eigenen Total, dann Zu bezahlen CHF 3'207.30, und am Fuss der Seite Empfangsschein und Zahlteil mit dem Swiss QR Code, über CHF 3 207.30",
    fr: "Le modèle de départ Payment reminder, une Mahnung, sous le logo de l'entreprise : les factures échues et les paiements reçus, chaque tableau avec son propre total, puis Zu bezahlen CHF 3'207.30 et, au pied de la page, Empfangsschein et Zahlteil avec le Swiss QR Code, d'un montant de CHF 3 207.30",
    it: "Il modello iniziale Payment reminder, una Mahnung, sotto il logo dell'azienda: le fatture scadute e i pagamenti ricevuti, ogni tabella con il proprio totale, poi Zu bezahlen CHF 3'207.30 e, in fondo alla pagina, Empfangsschein e Zahlteil con lo Swiss QR Code, per un importo di CHF 3 207.30",
    en: "The Payment reminder starter, a Mahnung under the firm's mark: the overdue invoices and the payments received against them, each table with its own total, then Zu bezahlen CHF 3'207.30, and across the foot of the page the Empfangsschein and the Zahlteil with its Swiss QR Code, for CHF 3 207.30",
  },
  caption: {
    de: 'Eine Mahnung: was überfällig ist, was bezahlt wurde, und eine QR-Rechnung für den Rest. Im Studio ist es die Startvorlage Payment reminder.',
    fr: "Une relance : ce qui est échu, ce qui a été payé, et une facture QR pour le reste. Dans le Studio, c'est le modèle de départ Payment reminder.",
    it: 'Un sollecito: ciò che è scaduto, ciò che è stato pagato, e una fattura QR per il resto. Nello Studio è il modello iniziale Payment reminder.',
    en: 'A payment reminder: what is overdue, what has been paid, and a QR-bill for the rest. In the Studio, it is the Payment reminder starter.',
  },
}

/**
 * The Studio's Preview of the invoice starter, as the Word files page shows
 * it (0081): Download Word beside Download PDF. A picture of the Studio,
 * whose words are the Studio's, held by checks/studio-words.ts: it quotes
 * nothing of the document its Preview shows.
 */
export const STUDIO_WORD: Figure = {
  picture: 'readme/studio-word.webp',
  quotes: [],
  alt: {
    de: 'Die Vorschau des Studios mit der Startvorlage Invoice: Download PDF und Download Word über der Rechnung mit ihrem Zahlteil auf weissem Papier',
    fr: "L'aperçu du Studio avec le modèle de départ Invoice : Download PDF et Download Word au-dessus de la facture et de sa section paiement, sur papier blanc",
    it: "L'anteprima dello Studio con il modello iniziale Invoice: Download PDF e Download Word sopra la fattura e la sua sezione pagamento, su carta bianca",
    en: "The Studio's Preview of the Invoice starter: Download PDF and Download Word above the invoice and its payment part, on white paper",
  },
  caption: {
    de: 'In der Vorschau des Studios gibt Download Word die Word-Datei desselben Dokuments, dessen PDF Download PDF gibt.',
    fr: "Dans l'aperçu du Studio, Download Word donne le fichier Word du document même dont Download PDF donne le PDF.",
    it: "Nell'anteprima dello Studio, Download Word dà il file Word dello stesso documento di cui Download PDF dà il PDF.",
    en: "In the Studio's Preview, Download Word gives the Word file of the very document whose PDF Download PDF gives.",
  },
}

/**
 * The quotation in the Angular builder, as the Angular report designer's
 * page shows it (0081): edited in the React builder, then shown in the
 * Angular one over the same session. A picture of the Studio, as
 * `STUDIO_WORD` is, whose one quote, the line as it was edited, is one
 * captured.json records the scene's builder showing, as the README's
 * description of the same picture quotes it.
 */
export const STUDIO_ANGULAR: Figure = {
  picture: 'readme/studio-angular.webp',
  quotes: ['Zahlbar innert 10 Tagen netto.'],
  alt: {
    de: 'Der Angular-Builder mit der ausgewählten Zeile «Zahlbar innert 10 Tagen netto.» der Offerte, daneben die Vorschau, die sie druckt',
    fr: "Le builder Angular, la ligne « Zahlbar innert 10 Tagen netto. » de l'offre sélectionnée, à côté de l'aperçu qui l'imprime",
    it: "Il builder Angular con la riga «Zahlbar innert 10 Tagen netto.» dell'offerta selezionata, accanto all'anteprima che la stampa",
    en: 'The Angular builder with the quotation\'s line "Zahlbar innert 10 Tagen netto." selected, beside the Preview printing it',
  },
  caption: {
    de: 'Die Offerte, im React-Builder bearbeitet und dann im Angular-Builder gezeigt: dieselbe Sitzung, die Änderung noch ausgewählt.',
    fr: "L'offre modifiée dans le builder React, puis montrée dans le builder Angular : la même session, la modification toujours sélectionnée.",
    it: "L'offerta modificata nel builder React, poi mostrata nel builder Angular: la stessa sessione, la modifica ancora selezionata.",
    en: 'The quotation edited in the React builder, then shown in the Angular one: the same session, the edit still selected.',
  },
}

/**
 * The XRechnung starter in the React builder, as the React report
 * designer's page shows it first (0081): a scene the React builder alone
 * draws, its e-invoice selected and the Preview of its final render. A
 * picture of the Studio, as `STUDIO_WORD` is: it quotes nothing of the
 * document its Preview shows.
 */
export const STUDIO_XRECHNUNG: Figure = {
  picture: 'readme/studio-xrechnung.webp',
  quotes: [],
  alt: {
    de: 'Der React-Builder mit der Startvorlage E-invoice (XRechnung): ihre E-Rechnung ausgewählt und deren Felder in den Eigenschaften, daneben die Vorschau des endgültigen Drucks mit Download PDF, Download XML und Download Word',
    fr: "Le builder React avec le modèle de départ E-invoice (XRechnung) : sa facture XRechnung sélectionnée et ses champs dans les propriétés, à côté de l'aperçu du rendu final avec Download PDF, Download XML et Download Word",
    it: "Il builder React con il modello iniziale E-invoice (XRechnung): la sua fattura XRechnung selezionata e i suoi campi nelle proprietà, accanto all'anteprima della stampa definitiva con Download PDF, Download XML e Download Word",
    en: 'The React builder with the E-invoice (XRechnung) starter: its e-invoice selected and its fields in the properties, beside the Preview of its final render with Download PDF, Download XML and Download Word',
  },
  caption: {
    de: 'Die XRechnung im React-Builder: ihre E-Rechnung Feld für Feld bearbeitet, und der endgültige Druck gibt ihr XML neben dem PDF und der Word-Datei.',
    fr: 'La XRechnung dans le builder React : sa facture modifiée champ par champ, et le rendu final qui donne son XML à côté du PDF et du fichier Word.',
    it: 'La XRechnung nel builder React: la sua fattura modificata campo per campo, e la stampa definitiva che dà il suo XML accanto al PDF e al file Word.',
    en: 'The XRechnung in the React builder: its e-invoice edited field by field, and its final render giving its XML beside the PDF and the Word file.',
  },
}

/**
 * Every figure the site shows: the Studio, the starters, the invoice with
 * its QR-bill in each language, the euro invoice from each country, and
 * the topic pages' own (0081). figures.test.ts holds each one's quotes to
 * its picture, and the wording check reads their quotes as the documents'
 * own words.
 */
export const FIGURES: readonly Figure[] = [
  STUDIO,
  ...STARTERS,
  ...LANGUAGES.map((language) => INVOICES[language]),
  ...EURO_COUNTRIES.map((country) => EUROS[country]),
  E_INVOICE,
  PAYMENT_REMINDER,
  STUDIO_WORD,
  STUDIO_ANGULAR,
  STUDIO_XRECHNUNG,
]

/** Every picture the site shows, each by its path under docs/images: what the build copies. */
export const PICTURES: readonly string[] = FIGURES.map((figure) => figure.picture)

/**
 * A figure on `page`: the picture at its own size, so the page does not
 * move as it loads, described in the page's language as the figure
 * describes it, which the wording check holds, and captioned by the figure
 * or by `caption`, a page's own words for what the picture shows there.
 * Only the first picture of a page loads at once; the rest load as they
 * near the window.
 */
export function FigureView({
  figure,
  page,
  first = false,
  caption = figure.caption[page.language],
}: {
  readonly figure: Figure
  readonly page: PageContext
  readonly first?: boolean
  readonly caption?: string
}): ReactElement {
  const picture = page.inputs.pictures.find((each) => each.name === figure.picture)
  if (picture === undefined) throw new Error(`the site shows ${figure.picture}, and the inputs hold no such picture`)
  return (
    <figure className="figure">
      <img
        src={page.href(picturePath(figure.picture))}
        alt={figure.alt[page.language]}
        width={picture.width}
        height={picture.height}
        loading={first ? 'eager' : 'lazy'}
        decoding="async"
      />
      <figcaption>{caption}</figcaption>
    </figure>
  )
}
