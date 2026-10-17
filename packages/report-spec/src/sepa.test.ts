import { describe, expect, test } from 'vitest'
import { SEPA_IBAN_COUNTRIES, sepaCountry, sepaIbanCountryOfBic } from './sepa.js'

describe('the countries of SEPA', () => {
  // EPC409-09 v8.0, 2: "27 Member States of the European Union", "3
  // countries of the European Economic Area" and "11 non-EEA countries";
  // Gibraltar is in its table of 5 and in neither list, and outside the
  // EEA. A country counted on the wrong side would ask a BIC of an account
  // that needs none, or let a code without one reach a bank that must have
  // it.
  test('are the 30 of the EEA and the 12 outside it, by the codes of their IBANs', () => {
    const eea = SEPA_IBAN_COUNTRIES.filter((country) => sepaCountry(country)?.eea === true)
    const outside = SEPA_IBAN_COUNTRIES.filter((country) => sepaCountry(country)?.eea === false)
    expect(eea).toHaveLength(30)
    expect(outside).toEqual(['AD', 'AL', 'CH', 'GB', 'GI', 'MC', 'MD', 'ME', 'MK', 'RS', 'SM', 'VA'])
  })

  // Each country writes its own BICs with its IBANs' code, and each
  // territory of 5's table with its own, paired with France's or the
  // United Kingdom's: a territory missing from the pairs would refuse
  // every bank on Guernsey or Réunion.
  test("pair every territory's BICs with its IBANs, as EPC409-09 5 does", () => {
    for (const country of SEPA_IBAN_COUNTRIES) expect(sepaIbanCountryOfBic(country), country).toBe(country)
    for (const territory of ['BL', 'GF', 'GP', 'MF', 'MQ', 'PM', 'RE', 'YT']) expect(sepaIbanCountryOfBic(territory), territory).toBe('FR')
    for (const territory of ['GG', 'IM', 'JE']) expect(sepaIbanCountryOfBic(territory), territory).toBe('GB')
  })

  // A code outside SEPA is none of them, and a name every object has is
  // not read as one: the table answers for its own entries only.
  test('know no other country', () => {
    for (const code of ['US', 'FO', 'GL', 'XK', 'AX', '__proto__', 'constructor', 'toString']) {
      expect(sepaCountry(code), code).toBeUndefined()
      expect(sepaIbanCountryOfBic(code), code).toBeUndefined()
    }
  })
})
