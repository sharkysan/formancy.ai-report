/**
 * The countries and territories a SEPA credit transfer reaches, and what
 * their accounts and their banks are written with: the length of each
 * country's IBAN, whether it is in the EEA, and the country code each
 * territory's BICs carry.
 *
 * Recorded from, on 17 October 2026:
 * - **EPC409-09**, "EPC List of Countries in the SEPA Schemes' Geographical
 *   Scope", version 8.0, issued 24 December 2025. Section 5 gives every
 *   country and territory with the code its BICs and its IBANs carry;
 *   section 2 says which are in the EU or the EEA. Gibraltar is in section
 *   5's table and in neither of section 2's lists, and is outside the EU
 *   and the EEA: it is recorded as outside the EEA.
 * - **SWIFT's IBAN Registry**, release 101, for each country's length.
 *   swift.com refused the download that day (HTTP 403, "SWIFT site
 *   off-line"), so the lengths were read from python-stdnum's `iban.dat`,
 *   which says it was generated from `iban-registry-v101.txt` (commit
 *   6070c60af5d4, 4 January 2026), and agree with php-iban's
 *   `registry.txt` for every country here. `epc-payload.test.ts` holds
 *   each to the registry's example IBAN for its country.
 *
 * A country joining SEPA, or a registry release changing a length, is a
 * change here and nowhere else.
 */

/** What a country's accounts are: its IBAN's length, and whether it is in the EEA. */
export interface SepaCountry {
  readonly length: number
  readonly eea: boolean
}

/** Each country code an IBAN of SEPA begins with (EPC409-09 v8.0, 5), its length (IBAN Registry 101) and whether it is in the EEA (2). */
const IBAN_COUNTRIES: { readonly [country: string]: SepaCountry } = {
  AD: { length: 24, eea: false }, // Andorra
  AL: { length: 28, eea: false }, // Albania
  AT: { length: 20, eea: true }, // Austria
  BE: { length: 16, eea: true }, // Belgium
  BG: { length: 22, eea: true }, // Bulgaria
  CH: { length: 21, eea: false }, // Switzerland
  CY: { length: 28, eea: true }, // Cyprus
  CZ: { length: 24, eea: true }, // Czech Republic
  DE: { length: 22, eea: true }, // Germany
  DK: { length: 18, eea: true }, // Denmark
  EE: { length: 20, eea: true }, // Estonia
  ES: { length: 24, eea: true }, // Spain, the Canary Islands
  FI: { length: 18, eea: true }, // Finland, the Åland Islands
  // France, French Guiana, Guadeloupe, Martinique, Mayotte, Réunion, Saint
  // Barthélemy, Saint Martin; and Saint Pierre and Miquelon, which is
  // outside the EEA and whose accounts no IBAN tells apart.
  FR: { length: 27, eea: true },
  GB: { length: 22, eea: false }, // the United Kingdom, Guernsey, the Isle of Man, Jersey
  GI: { length: 23, eea: false }, // Gibraltar
  GR: { length: 27, eea: true }, // Greece
  HR: { length: 21, eea: true }, // Croatia
  HU: { length: 28, eea: true }, // Hungary
  IE: { length: 22, eea: true }, // Ireland
  IS: { length: 26, eea: true }, // Iceland
  IT: { length: 27, eea: true }, // Italy
  LI: { length: 21, eea: true }, // Liechtenstein
  LT: { length: 20, eea: true }, // Lithuania
  LU: { length: 20, eea: true }, // Luxembourg
  LV: { length: 21, eea: true }, // Latvia
  MC: { length: 27, eea: false }, // Monaco
  MD: { length: 24, eea: false }, // Moldova
  ME: { length: 22, eea: false }, // Montenegro
  MK: { length: 19, eea: false }, // North Macedonia
  MT: { length: 31, eea: true }, // Malta
  NL: { length: 18, eea: true }, // the Netherlands
  NO: { length: 15, eea: true }, // Norway
  PL: { length: 28, eea: true }, // Poland
  PT: { length: 25, eea: true }, // Portugal, the Azores, Madeira
  RO: { length: 24, eea: true }, // Romania
  RS: { length: 22, eea: false }, // Serbia
  SE: { length: 24, eea: true }, // Sweden
  SI: { length: 19, eea: true }, // Slovenia
  SK: { length: 24, eea: true }, // Slovakia
  SM: { length: 27, eea: false }, // San Marino
  VA: { length: 22, eea: false }, // Vatican City State
}

/**
 * The territories whose BICs carry a country code of their own and whose
 * IBANs another's (EPC409-09 v8.0, 5). Every other country of SEPA writes
 * its BICs with its IBANs' code.
 */
const BIC_TERRITORIES: { readonly [bicCountry: string]: string } = {
  BL: 'FR', // Saint Barthélemy
  GF: 'FR', // French Guiana
  GG: 'GB', // Guernsey
  GP: 'FR', // Guadeloupe
  IM: 'GB', // the Isle of Man
  JE: 'GB', // Jersey
  MF: 'FR', // Saint Martin (French part)
  MQ: 'FR', // Martinique
  PM: 'FR', // Saint Pierre and Miquelon
  RE: 'FR', // Réunion
  YT: 'FR', // Mayotte
}

/** The country of SEPA whose IBANs begin with `country`, or undefined when it is none. */
export function sepaCountry(country: string): SepaCountry | undefined {
  return Object.hasOwn(IBAN_COUNTRIES, country) ? IBAN_COUNTRIES[country] : undefined
}

/** The code the IBANs carry of the territory whose BICs carry `bicCountry`, or undefined when no territory of SEPA's BICs carry it. */
export function sepaIbanCountryOfBic(bicCountry: string): string | undefined {
  if (Object.hasOwn(BIC_TERRITORIES, bicCountry)) return BIC_TERRITORIES[bicCountry]
  return Object.hasOwn(IBAN_COUNTRIES, bicCountry) ? bicCountry : undefined
}

/** Every country code an IBAN of SEPA begins with, in alphabetical order. */
export const SEPA_IBAN_COUNTRIES: readonly string[] = Object.keys(IBAN_COUNTRIES).sort()
