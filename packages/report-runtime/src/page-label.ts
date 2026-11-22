import type { Paragraph } from './document.js'

/**
 * A label, as the runtime heads every page with one -- a preview's, an
 * XRechnung's copy's (0038), a copy of an e-invoice's (0077): the text
 * alone, small, bold and red, in a paragraph of its own.
 */
export const label = (text: string): Paragraph => ({ kind: 'paragraph', runs: [{ text }], style: { size: 8, bold: true, color: '#b00020' } })

/** `paragraph` frozen through: its runs, each run, and its style. */
export function frozen(paragraph: Paragraph): Paragraph {
  for (const run of paragraph.runs) Object.freeze(run)
  Object.freeze(paragraph.runs)
  Object.freeze(paragraph.style)
  return Object.freeze(paragraph)
}
