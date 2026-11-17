import { expectation, readDocx, STARTER_IMAGES, type Docx, type Fixture, type Starter } from '@formancy/report-corpus'
import { RenderRefusal, resolveReport } from '@formancy/report-runtime'
import type { Block, Paragraph, ReportData, ResolvedDocument, ResolveOptions, TextStyle } from '@formancy/report-runtime'
import { renderDocx } from '../render.js'

/**
 * What the writer's tests share: a document written and read back by the
 * corpus's reader, never by anything of the writer's (0068); a refusal
 * caught as what it says; and small documents built as the corpus builds
 * its fixtures.
 */

/** Fixed, so that a document is the same file every time. */
export const CREATED = '2026-10-15T08:00:00Z'

/** `document` written, and the file read back whole. */
export function written(document: ResolvedDocument): Docx {
  return readDocx(renderDocx(document))
}

/** What the writer refuses `document` as; fails the test where it writes it, or throws anything else. */
export function refusalOf(document: ResolvedDocument): { readonly code: string; readonly subject: string | undefined; readonly message: string } {
  try {
    renderDocx(document)
  } catch (error) {
    if (error instanceof RenderRefusal) return { code: error.code, subject: error.subject, message: error.message }
    throw error
  }
  throw new Error('the document was written, where a refusal was expected')
}

export function paragraph(text: string, style?: TextStyle): Paragraph {
  return { kind: 'paragraph', runs: [{ text }], ...(style === undefined ? {} : { style }) }
}

/** A document of `body` on an A4 page with 50 points of margin, with nothing in its page regions unless `more` says so. */
export function documentOf(body: readonly Block[], more: Partial<ResolvedDocument> = {}): ResolvedDocument {
  return {
    info: { title: 'A document', creationDate: CREATED },
    page: { size: 'A4', orientation: 'portrait', margins: { top: 50, right: 50, bottom: 50, left: 50 } },
    pageHeader: [],
    pageFooter: [],
    body,
    ...more,
  }
}

/** `document` as a fixture, its expectation derived as every fixture's is: what `verifyDocx` holds its file to. */
export function fixtureOf(id: string, document: ResolvedDocument, stated: Partial<Fixture['expect']> = {}): Fixture {
  return { id, title: id, document, maxPages: 99, expect: expectation(document, { maxPagesExpected: 99, ...stated }) }
}

/** `starter` resolved against `data`, its own where none is given, as a host resolves it: a final render unless `options` say otherwise. */
export function resolved(starter: Starter, options: Partial<ResolveOptions> = {}, data: ReportData = starter.data): ResolvedDocument {
  const outcome = resolveReport(starter.report, data, {
    mode: 'final',
    parameters: starter.parameters,
    images: (ref) => STARTER_IMAGES.find((image) => image.asset === ref.asset && image.digest === ref.digest),
    creationDate: CREATED,
    ...options,
  })
  if (!outcome.ok) throw new Error(`refused: ${outcome.errors.map((error) => `${error.stage} ${error.code} ${error.path} ${error.message}`).join('; ')}`)
  return outcome.document
}
