/**
 * The pictures the pages show, each copied at build time from docs/images,
 * where a script made it and a test holds it (never by hand): the Studio,
 * taken by scripts/pictures.mjs, and what each starter prints, taken by
 * report-render-pdf's scripts/readme-pictures.ts. A description quotes the
 * picture's own words, as the document prints them, in whatever language
 * the page is; figures.test.ts holds every quote to the lines
 * docs/images/pictures.json records for that page.
 */
import type { ReactElement } from 'react'
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

/** Every picture the site shows, each by its path under docs/images: what the build copies. */
export const PICTURES: readonly string[] = [STUDIO, ...STARTERS].map((figure) => figure.picture)

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
