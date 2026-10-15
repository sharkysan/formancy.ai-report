import type { PdfPage, PdfTextItem, ReadPdf } from '@formancy/report-corpus'
import { expect } from 'vitest'
import { normalise } from './documents.js'

/**
 * A page's text as lines a reader sees, rebuilt from PDF.js's runs: a copy
 * of `@formancy/report-corpus`'s `lines.ts`, which its index does not export,
 * and goes once it does. Runs on one baseline make one line, read left to
 * right, and lines are read top to bottom.
 */
export interface Line {
  readonly text: string
  readonly top: number
  readonly bottom: number
  /** The left edge of its first run. */
  readonly x: number
  /** The right edge of its last run. */
  readonly right: number
}

/** How far below the baseline the reader's text box reaches, as a fraction of the font size. */
const DESCENT = 0.2
const SAME_LINE = 0.3
const WORD_GAP = 0.15

function baselineOf(item: PdfTextItem): number {
  return item.bottom - DESCENT * item.height
}

export function pageLines(page: PdfPage): Line[] {
  const byBaseline = [...page.items].sort((a, b) => baselineOf(a) - baselineOf(b) || a.x - b.x)
  const lines: PdfTextItem[][] = []
  for (const item of byBaseline) {
    const current = lines.at(-1)
    const first = current?.[0]
    if (current !== undefined && first !== undefined && Math.abs(baselineOf(item) - baselineOf(first)) < SAME_LINE * Math.min(item.height, first.height)) {
      current.push(item)
    } else {
      lines.push([item])
    }
  }
  return lines.map((items) => {
    const ordered = items.sort((a, b) => a.x - b.x)
    let joined = ''
    ordered.forEach((item, index) => {
      const before = ordered[index - 1]
      const gap = before === undefined ? 0 : item.x - (before.x + before.width)
      joined += (before !== undefined && gap > WORD_GAP * Math.min(item.height, before.height) ? ' ' : '') + item.text
    })
    const last = ordered.at(-1)!
    return { text: normalise(joined), top: Math.min(...ordered.map((item) => item.top)), bottom: Math.max(...ordered.map((item) => item.bottom)), x: ordered[0]!.x, right: last.x + last.width }
  })
}

/** Whether `text` is on the line as whole words: `0.00` is not found in `10.00`. */
export function lineHas(line: Line, text: string): boolean {
  return ` ${line.text} `.includes(` ${normalise(text)} `)
}

/** The one line that has `text`, and its page; a test that asks expects exactly one. */
export function lineOf(pdf: ReadPdf, text: string): Line & { readonly page: number } {
  const found = pdf.pages.flatMap((page) => pageLines(page).flatMap((line) => (lineHas(line, text) ? [{ ...line, page: page.number }] : [])))
  expect(found, text).toHaveLength(1)
  return found[0]!
}

/** The one run PDF.js read as exactly `text`, and its page: one column's line where another prints on the same baseline. */
export function runOf(pdf: ReadPdf, text: string): PdfTextItem & { readonly page: number } {
  const found = pdf.pages.flatMap((page) => page.items.flatMap((item) => (normalise(item.text) === normalise(text) ? [{ ...item, page: page.number }] : [])))
  expect(found, text).toHaveLength(1)
  return found[0]!
}

/** The one page a line of `text` is on. */
export function pageOf(pdf: ReadPdf, text: string): number {
  return lineOf(pdf, text).page
}
