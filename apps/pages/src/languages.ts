/**
 * The languages every page exists in (0021): Switzerland's three official
 * languages the product is sold in, and English. Every page group has a page
 * in each, and each page names the others as its alternates.
 */
export const LANGUAGES = ['de', 'fr', 'it', 'en'] as const
export type Language = (typeof LANGUAGES)[number]

/** The language a search engine shows a reader whose language is none of these: `x-default`. */
export const DEFAULT_LANGUAGE: Language = 'en'

/**
 * Per language: its name in itself, for the language switcher; the locale
 * every date is formatted for, Swiss where the language is one of
 * Switzerland's; and the Open Graph locale.
 */
export const LANGUAGE: Readonly<Record<Language, { readonly name: string; readonly locale: string; readonly og: string }>> = {
  de: { name: 'Deutsch', locale: 'de-CH', og: 'de_CH' },
  fr: { name: 'Français', locale: 'fr-CH', og: 'fr_CH' },
  it: { name: 'Italiano', locale: 'it-CH', og: 'it_CH' },
  en: { name: 'English', locale: 'en-GB', og: 'en_GB' },
}

/**
 * `html` with French's spaces made no-break: the one before `:`, `;`, `?`,
 * `!` and `»`, and the one after `«`, so no line starts with the mark. The
 * copy is written with ordinary spaces, as anybody types it; the French
 * pages are set this way once, here. A mark with no space before it -- an
 * address's colon -- is left alone.
 */
export const frenchSpaces = (html: string): string => html.replaceAll(/ ([:;?!»])/g, ' $1').replaceAll('« ', '« ')

/** An ISO day, `2026-10-16`, as `language` writes it: through Intl, never typed. */
export function formatDay(day: string, language: Language): string {
  const [year, month, date] = day.split('-').map(Number)
  if (year === undefined || month === undefined || date === undefined || Number.isNaN(year + month + date)) throw new Error(`${day} is not an ISO day`)
  return new Intl.DateTimeFormat(LANGUAGE[language].locale, { dateStyle: 'long', timeZone: 'UTC' }).format(Date.UTC(year, month - 1, date))
}
