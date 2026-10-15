import { describe, expect, test } from 'vitest'
import { EDITOR_LOCALES, EDITOR_TEXT, editorText, formatZoom } from './text.js'
import type { MessageId } from './text.js'

const PLACEHOLDER = /\{(\w+)\}/g

function placeholders(message: string): string[] {
  return [...message.matchAll(PLACEHOLDER)].map((match) => match[1] as string).sort()
}

describe('the catalogue', () => {
  // A message missing in one language would show its id, or nothing, to a
  // person who chose that language; one only a translation has is a label no
  // English reader ever sees, so nobody notices it is stale.
  test('every language has exactly the messages English has', () => {
    const english = Object.keys(EDITOR_TEXT.en).sort()
    for (const locale of EDITOR_LOCALES) expect(Object.keys(EDITOR_TEXT[locale]).sort(), locale).toEqual(english)
  })

  // A translation that drops or misspells a placeholder prints "{name}", or
  // says "Deleted." without saying what.
  test('every translation has the placeholders its English has', () => {
    for (const locale of EDITOR_LOCALES) {
      for (const [id, english] of Object.entries(EDITOR_TEXT.en)) {
        expect(placeholders(EDITOR_TEXT[locale][id as MessageId]), `${locale} ${id}`).toEqual(placeholders(english))
      }
    }
  })

  // An empty label is a button with no accessible name: axe fails it and a
  // screen reader says only "button".
  test('no message is empty', () => {
    for (const locale of EDITOR_LOCALES) {
      for (const [id, message] of Object.entries(EDITOR_TEXT[locale])) expect(message.trim(), `${locale} ${id}`).not.toBe('')
    }
  })

  // de-CH is written as Switzerland writes German: a sharp s would read as a
  // German-from-Germany page in a Swiss product.
  test('Swiss German has no sharp s', () => {
    for (const [id, message] of Object.entries(EDITOR_TEXT['de-CH'])) expect(message, id).not.toContain('ß')
  })

  // A language whose catalogue is English with a few words changed is not a
  // translation; at least the labels a person reads first differ.
  test('each language says the panes in its own words', () => {
    const panes: MessageId[] = ['pane.outline', 'pane.palette', 'pane.properties', 'pane.problems', 'action.undo', 'action.delete']
    for (const id of panes) {
      expect(EDITOR_TEXT['de-CH'][id], id).not.toBe(EDITOR_TEXT.en[id])
      expect(EDITOR_TEXT['fr-CH'][id], id).not.toBe(EDITOR_TEXT.en[id])
    }
  })
})

describe('editorText', () => {
  // A builder that formats its own words would format them twice, once per
  // framework; this is the one place a placeholder is filled.
  test('fills placeholders from the values given', () => {
    const t = editorText('en')
    expect(t('target.after', { where: 'Body', name: 'Title' })).toBe('Body, after Title')
    expect(editorText('de-CH')('target.after', { where: 'Hauptteil', name: 'Titel' })).toBe('Hauptteil, nach Titel')
  })

  // "Deleted ." reads as a sentence and hides that the name never came;
  // "Deleted {name}." is visibly wrong.
  test('leaves a placeholder visible when its value is missing', () => {
    expect(editorText('en')('status.deleted')).toBe('Deleted {name}.')
  })

  // A value that itself holds braces -- a text whose content is "{name}" --
  // is printed as it is, never filled again.
  test('does not fill a placeholder inside a value', () => {
    expect(editorText('en')('target.after', { where: '{name}', name: 'x' })).toBe('{name}, after x')
  })

  // A locale the catalogue does not have would silently fall back to
  // English; it is refused, so the host learns at once.
  test('refuses a locale it does not have', () => {
    expect(() => editorText('it-CH' as never)).toThrow(RangeError)
  })
})

describe('formatZoom', () => {
  // The zoom readout is a number on a page, derived in the person's
  // language by Intl rather than written: Switzerland writes 125%, where
  // Germany writes 125 %, and a hand-made format would get one of them wrong.
  test('formats a zoom as a percentage, as the language writes one', () => {
    expect(formatZoom(1.25, 'en')).toBe('125%')
    expect(formatZoom(1.25, 'de-CH')).toBe(new Intl.NumberFormat('de-CH', { style: 'percent' }).format(1.25))
    expect(formatZoom(1.25, 'de-CH')).not.toBe(new Intl.NumberFormat('de', { style: 'percent' }).format(1.25))
    expect(formatZoom(0.5, 'fr-CH')).toBe(new Intl.NumberFormat('fr-CH', { style: 'percent' }).format(0.5))
    expect(formatZoom(1.255, 'en')).toBe('126%')
  })
})
