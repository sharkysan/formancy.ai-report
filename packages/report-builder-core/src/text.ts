/**
 * The editor's own words, in the three languages it ships with, in one
 * catalogue both builders read.
 *
 * A button called one thing in the React builder and another in the Angular
 * one is drift nobody would find, because nothing compares them; one
 * catalogue makes the comparison unnecessary, as formancy's builder does
 * (formancy.ai 0114). These are the editor talking to the person editing --
 * not the report's own text, which prints as written, and not
 * report-spec's or report-core's sentences, which those packages word in
 * English and which a later step translates by their codes.
 *
 * Placeholders are `{name}`, filled once from the values given; one with no
 * value stays visible, so "Deleted {name}." shows a missing name where
 * "Deleted ." would hide it. Each language is a file of its own, which a
 * translator changes alone: English, the source, in text-en.ts, Swiss
 * German in text-de-ch.ts and Swiss French in text-fr-ch.ts. This file puts
 * them together and fills a message.
 */
import { DE_CH } from './text-de-ch.js'
import { EN } from './text-en.js'
import type { Catalogue, MessageId } from './text-en.js'
import { FR_CH } from './text-fr-ch.js'

export type { MessageId } from './text-en.js'

export const EDITOR_LOCALES = ['en', 'de-CH', 'fr-CH'] as const
export type EditorLocale = (typeof EDITOR_LOCALES)[number]

/** Every message in every language: what a builder reads when it needs the raw catalogue. */
export const EDITOR_TEXT: { readonly [L in EditorLocale]: Catalogue } = Object.freeze({ en: EN, 'de-CH': DE_CH, 'fr-CH': FR_CH })

/** Fills a message for a person: `{name}` from `values`, every placeholder at most once. */
export type EditorText = (id: MessageId, values?: Readonly<Record<string, string | number>>) => string

const PLACEHOLDER = /\{(\w+)\}/g

/** The editor's words in `locale`. Throws a RangeError for a locale the catalogue does not have. */
export function editorText(locale: EditorLocale): EditorText {
  if (!(EDITOR_LOCALES as readonly string[]).includes(locale)) throw new RangeError(`the editor speaks ${EDITOR_LOCALES.join(', ')}, not ${String(locale)}`)
  const catalogue = EDITOR_TEXT[locale]
  return (id, values = {}) => catalogue[id].replace(PLACEHOLDER, (whole, name: string) => (Object.hasOwn(values, name) ? String(values[name]) : whole))
}

/**
 * The language a new component's own text is written in -- "New text", a
 * table's "No rows." -- for a report in `reportLocale`. That text prints,
 * so it is the report's language, never the editor's: two editors in two
 * languages inserting into one report put in the same words. The editor's
 * language with the report's tag, else one of the same language (a de-DE
 * report gets the Swiss German words, which have no sharp s to differ by),
 * else English.
 */
export function contentLocale(reportLocale: string): EditorLocale {
  const tag = reportLocale.toLowerCase()
  const exact = EDITOR_LOCALES.find((locale) => locale.toLowerCase() === tag)
  if (exact !== undefined) return exact
  const language = tag.split('-')[0]
  return EDITOR_LOCALES.find((locale) => locale.split('-')[0] === language) ?? 'en'
}

/** A share as the person's language writes a percentage, by Intl: 125% in all three, where Germany's German would write 125 %. */
export function formatPercent(share: number, locale: EditorLocale): string {
  return new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 0 }).format(share)
}

/** A zoom, written as every other share is. */
export const formatZoom: (zoom: number, locale: EditorLocale) => string = formatPercent
