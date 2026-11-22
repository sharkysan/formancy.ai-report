import type { Block, EInvoiceFile, Paragraph } from './document.js'
import { frozen, label } from './page-label.js'

/**
 * The label of a copy of an e-invoice (0077): what every page of a final
 * render says where a host asked for the copy and not the invoice
 * (`ResolveOptions.eInvoice`). A copy is what a Word file is written of:
 * a file a person may change is no invoice, so its every page says that
 * it is a copy, that it is not the invoice, and what the invoice is --
 * the PDF that embeds its XML, of a Factur-X, or its XML, of an
 * XRechnung. It carries no XML itself.
 *
 * The words are the runtime's, in the language the render prints in
 * (0063): the label is the one thing that tells a reader what the page
 * is, and in a language the page does not speak it tells them nothing.
 * So a copy in a language no label is written in is refused, never
 * labelled in another. It says "this document", not "this Word file":
 * the copy is a resolved document, and whatever is made of it is no
 * invoice. A preview's label and an XRechnung's PDF's stay English, as
 * they were (0038).
 *
 * One decision, here: the runtime writes the label, and an engine reads
 * it with `readCopyLabel` and decides no word of it.
 */

/** The languages a copy is labelled in: those the starters print in. A locale's language is its first subtag. */
export const E_INVOICE_COPY_LANGUAGES = ['de', 'en', 'es', 'fr', 'it', 'nl'] as const
export type EInvoiceCopyLanguage = (typeof E_INVOICE_COPY_LANGUAGES)[number]

type Kind = EInvoiceFile['kind']

/** What every page of a copy says, by the e-invoice's kind and the render's language. */
export const E_INVOICE_COPY_LABELS: Readonly<Record<Kind, Readonly<Record<EInvoiceCopyLanguage, string>>>> = Object.freeze({
  facturX: Object.freeze({
    de: 'Kopie einer E-Rechnung: Die Rechnung ist das PDF, das ihr XML einbettet, und dieses Dokument ist nicht die Rechnung',
    en: 'Copy of an e-invoice: the invoice is the PDF that embeds its XML, and this document is not the invoice',
    es: 'Copia de una factura electrónica: la factura es el PDF que incorpora su XML, y este documento no es la factura',
    fr: "Copie d'une facture électronique\u00a0: la facture est le PDF qui intègre son XML, et ce document n'est pas la facture",
    it: 'Copia di una fattura elettronica: la fattura è il PDF che incorpora il suo XML, e questo documento non è la fattura',
    nl: 'Kopie van een e-factuur: de factuur is de pdf waarin haar XML is ingebed, en dit document is niet de factuur',
  }),
  xrechnung: Object.freeze({
    de: 'Kopie einer XRechnung: Die Rechnung ist ihr XML, und dieses Dokument ist nicht die Rechnung',
    en: 'Copy of an XRechnung: the invoice is its XML, and this document is not the invoice',
    es: 'Copia de una XRechnung: la factura es su XML, y este documento no es la factura',
    fr: "Copie d'une XRechnung\u00a0: la facture est son XML, et ce document n'est pas la facture",
    it: 'Copia di una XRechnung: la fattura è il suo XML, e questo documento non è la fattura',
    nl: 'Kopie van een XRechnung: de factuur is haar XML, en dit document is niet de factuur',
  }),
})

const KINDS = ['facturX', 'xrechnung'] as const satisfies readonly Kind[]

/** A copy's label as an engine finds it: its kind, its language, and the paragraph the runtime writes, frozen. */
interface Known {
  readonly kind: Kind
  readonly language: EInvoiceCopyLanguage
  readonly paragraph: Paragraph
}

/** Every label's paragraph, made once and frozen: what a document's own paragraph is held to. */
const PARAGRAPHS: readonly Known[] = KINDS.flatMap((kind) =>
  E_INVOICE_COPY_LANGUAGES.map((language) => ({ kind, language, paragraph: frozen(label(E_INVOICE_COPY_LABELS[kind][language])) })),
)

/**
 * The paragraph a copy of an e-invoice of `kind` is labelled with in a
 * render that prints in `locale`, as the runtime writes it; undefined
 * where no label is written in that locale's language. Frozen, and the
 * same object each time: a document carries a paragraph of its own.
 */
export function eInvoiceCopyParagraph(kind: Kind, locale: string): Paragraph | undefined {
  // By the list, never by a lookup that would find 'constructor' on every object.
  const language = locale.split('-')[0]!.toLowerCase()
  return PARAGRAPHS.find((each) => each.kind === kind && each.language === language)?.paragraph
}

/** The label a header opens with: of which copy, and whether it stands as the runtime writes it. */
export interface CopyLabel extends Known {
  /** Whether the header's paragraph is the runtime's, style and all: the words in white, at one point or light are found, and are not as written. */
  readonly asWritten: boolean
}

/**
 * The copy's label `header` opens with, or undefined where it opens with
 * none: a paragraph of one run whose text is a label's, whatever its
 * style, as a preview's label is read (0057). `asWritten` says whether
 * the paragraph is the runtime's whole -- its size, bold and its colour,
 * and nothing else -- which an engine that writes a copy holds it to:
 * the words in white say nothing to a reader. A label among other runs,
 * or below another block, heads nothing and is not found.
 */
export function readCopyLabel(header: readonly Block[]): CopyLabel | undefined {
  const first = header[0]
  if (first?.kind !== 'paragraph' || first.runs.length !== 1) return undefined
  const run = first.runs[0]!
  if (!('text' in run)) return undefined
  const known = PARAGRAPHS.find(({ paragraph }) => (paragraph.runs[0] as { readonly text: string }).text === run.text)
  return known === undefined ? undefined : { ...known, asWritten: samePlain(first, known.paragraph) }
}

/** Whether two values of a resolved document are the same data: equal primitives, or two arrays, or two objects that are not, of the same keys holding the same values. */
function samePlain(a: unknown, b: unknown): boolean {
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return a === b
  if (Array.isArray(a) !== Array.isArray(b)) return false
  const [left, right] = [Object.keys(a), Object.keys(b)]
  return (
    left.length === right.length &&
    left.every((key) => right.includes(key) && samePlain((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]))
  )
}
