/**
 * The product data sheet in each language it is written in (0064): every
 * word it prints. The German is the sheet's own language; the French, the
 * Italian and the English are its translations (0063), word for word in
 * the places the German stands, since a text's runs keep their order in
 * every language.
 *
 * The product, an insulation board for underfloor heating, and every
 * value of it are invented, and claim no test of any board: the sheet
 * shows what a data sheet prints, not what such a board measures. The
 * standards named, EN 13501-1's fire class and EN 15804's modules, are
 * named as a data sheet names them, and the board meets neither. No
 * native speaker has reviewed the French, the Italian or the English.
 *
 * A footnote's text starts with a no-break space, U+00A0, so that the
 * mark before it and its first word are one word to pdfmake, which never
 * leaves the mark alone on a line (0061); and a no-break space stands
 * before a percent sign, and before a French colon, so that neither starts
 * a line.
 */

/** The units the sheet prints beside its values, the same words in every language: a literal that holds a letter is a word all the same (0063). */
export const UNITS = {
  millimetres: ' mm',
  /** Before the cube of kg/m³. */
  perCubicMetre: ' kg/m',
  conductivity: ' W/(m·K)',
  /** m²·K/W: before the square, and after it. */
  resistance: [' m', '·K/W'],
  /** W/(m²·K): before the square, and after it. */
  transmittance: [' W/(m', '·K)'],
  kilopascals: ' kPa',
} as const

/** The sheet in one language: its locale, and every word it prints there but the units. */
export interface SheetWords {
  readonly locale: 'de-CH' | 'fr-CH' | 'it-CH' | 'en'
  /** The report's title, which the sheet's heading prints too. */
  readonly title: string
  /** What the firm's UID is followed by, as the VAT number it is. */
  readonly vatNumber: string
  /** The words before the article number. */
  readonly article: string
  readonly description: string
  readonly technical: string
  readonly thickness: string
  readonly density: string
  readonly conductivity: string
  readonly resistance: string
  /** Followed by footnote 1's mark. */
  readonly transmittance: string
  readonly compressive: string
  readonly fire: string
  readonly environment: string
  /** Followed by footnote 2's mark. */
  readonly warming: string
  /** The unit of the warming potential around CO₂'s index: before it, and after it up to the square of m². */
  readonly carbon: readonly [beforeIndex: string, afterIndex: string]
  /** Each footnote's text after its mark. */
  readonly notes: readonly [string, string]
  /** The words before the date the sheet was issued, and after it. */
  readonly issued: readonly [string, string]
}

const NBSP = ' '

export const GERMAN_SHEET: SheetWords = {
  locale: 'de-CH',
  title: 'Produktdatenblatt',
  vatNumber: 'MWST',
  article: 'Art.-Nr. ',
  description: 'Dämmplatte aus expandiertem Polystyrol (EPS) für Fussbodenheizungen im Wohnbau.',
  technical: 'Technische Daten',
  thickness: 'Dicke',
  density: 'Rohdichte',
  conductivity: 'Wärmeleitfähigkeit λ',
  resistance: 'Wärmedurchlasswiderstand R',
  transmittance: 'U-Wert der Platte',
  compressive: `Druckspannung bei 10${NBSP}% Stauchung`,
  fire: 'Brandverhalten nach EN 13501-1',
  environment: 'Ökobilanz',
  warming: 'Treibhauspotenzial GWP',
  carbon: [' kg CO', '-Äq. pro m'],
  notes: [`${NBSP}U = 1/R, ohne Wärmeübergangswiderstände.`, `${NBSP}Herstellung, Module A1–A3 nach EN 15804.`],
  issued: ['Stand: ', ' · Technische Änderungen vorbehalten.'],
}

export const FRENCH_SHEET: SheetWords = {
  locale: 'fr-CH',
  title: 'Fiche technique',
  vatNumber: 'TVA',
  article: 'Réf. ',
  description: 'Panneau isolant en polystyrène expansé (EPS) pour chauffages au sol dans l’habitat.',
  technical: 'Caractéristiques techniques',
  thickness: 'Épaisseur',
  density: 'Masse volumique',
  conductivity: 'Conductivité thermique λ',
  resistance: 'Résistance thermique R',
  transmittance: 'Coefficient U du panneau',
  compressive: `Résistance à la compression à 10${NBSP}%`,
  fire: 'Réaction au feu selon EN 13501-1',
  environment: 'Bilan écologique',
  warming: 'Potentiel de réchauffement global GWP',
  carbon: [' kg CO', ' éq. par m'],
  notes: [`${NBSP}U = 1/R, sans résistances superficielles.`, `${NBSP}Fabrication, modules A1–A3 selon EN 15804.`],
  issued: [`État${NBSP}: `, ' · Sous réserve de modifications techniques.'],
}

export const ITALIAN_SHEET: SheetWords = {
  locale: 'it-CH',
  title: 'Scheda tecnica',
  vatNumber: 'IVA',
  article: 'Art. ',
  description: 'Pannello isolante in polistirene espanso (EPS) per riscaldamenti a pavimento nell’edilizia abitativa.',
  technical: 'Dati tecnici',
  thickness: 'Spessore',
  density: 'Massa volumica',
  conductivity: 'Conduttività termica λ',
  resistance: 'Resistenza termica R',
  transmittance: 'Valore U del pannello',
  compressive: `Resistenza a compressione al 10${NBSP}%`,
  fire: 'Reazione al fuoco secondo EN 13501-1',
  environment: 'Bilancio ecologico',
  warming: 'Potenziale di riscaldamento globale GWP',
  carbon: [' kg CO', ' eq. per m'],
  notes: [`${NBSP}U = 1/R, senza resistenze superficiali.`, `${NBSP}Produzione, moduli A1–A3 secondo EN 15804.`],
  issued: ['Stato: ', ' · Con riserva di modifiche tecniche.'],
}

export const ENGLISH_SHEET: SheetWords = {
  locale: 'en',
  title: 'Product data sheet',
  vatNumber: 'VAT',
  article: 'Item ',
  description: 'Insulation board of expanded polystyrene (EPS) for underfloor heating in housing.',
  technical: 'Technical data',
  thickness: 'Thickness',
  density: 'Density',
  conductivity: 'Thermal conductivity λ',
  resistance: 'Thermal resistance R',
  transmittance: 'U-value of the board',
  compressive: `Compressive stress at 10${NBSP}% strain`,
  fire: 'Reaction to fire to EN 13501-1',
  environment: 'Life cycle assessment',
  warming: 'Global warming potential GWP',
  carbon: [' kg CO', '-eq. per m'],
  notes: [`${NBSP}U = 1/R, without surface resistances.`, `${NBSP}Manufacture, modules A1–A3 to EN 15804.`],
  issued: ['Issued: ', ' · Subject to technical change.'],
}
