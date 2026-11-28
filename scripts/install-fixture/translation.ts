/*
 * A language's missing words asked of a model (report-ai, 0085), from the
 * packed packages under Node: the quotation, French added by a report-core
 * session, asked of a host's server through askThrough, whose complete is
 * scripted here -- it checks the briefing's digest it was sent, reads the
 * request's keys and answers each word, the title in French and every
 * other word in capitals, so that what landed is told from what was asked
 * -- and the answer proposed against the session's report, held to the
 * format and the compiler, and applied as one step against its hash, the
 * French title then the one report-spec's reportIn prints; an edit made
 * meanwhile refuses the same batch stale. The README's "Translate a
 * language's missing words" is lines of this file
 * (scripts/readme-example.test.mjs). consume.ts runs it and prints what it
 * returns.
 */
import { addLanguage, languageDiagnostics, openReportSession } from '@formancy/report-core'
import { reportIn } from '@formancy/report-spec'
import { askThrough, proposeTranslation, translateMissing } from '@formancy/report-ai'
import type { TranslationProposal, TranslationResult } from '@formancy/report-ai'
import { briefingDigest, MAX_MODEL_REQUEST_BYTES } from '@formancy/report-ai'
import type { Complete } from '@formancy/report-ai'
import { quotation } from './quotation.js'

/** The host's server, scripted: what it was sent, and an answer for every word the request asks. */
const sent: string[] = []
const myServer: Complete = (request) => {
  sent.push(request.kind)
  if (request.briefing !== briefingDigest(request.kind)) return Promise.reject(new Error('the page briefs otherwise than this server'))
  const asked = JSON.parse(request.user) as { readonly into: string; readonly words: readonly { readonly key: string; readonly source: string }[] }
  const words = Object.fromEntries(asked.words.map(({ key, source }) => [key, source === 'Offerte' ? 'Offre' : source.toUpperCase()]))
  return Promise.resolve({ text: JSON.stringify({ into: asked.into, words, expressions: {} }) })
}

export async function translatedByModel(): Promise<string> {
  const opened = openReportSession(quotation)
  if (!opened.ok) throw new Error('the quotation did not open')
  const { session } = opened
  if (!session.apply((report) => addLanguage(report, 'fr-CH')).ok) throw new Error('French was not added')
  const lacked = languageDiagnostics(session.document(), 'fr-CH').filter(({ code }) => code === 'word-missing').length

  const ask = askThrough(myServer) // complete sends { kind, user, briefing } to the host's server
  const run: TranslationResult = await translateMissing(ask, session.document(), 'fr-CH')
  if (!run.ok) throw new Error(`the run ended ${run.ended}`)
  const proposal: TranslationProposal = proposeTranslation(session.document(), run.answer)
  const batch = { command: 'batch', args: [proposal.rows.map((row) => row.step)] } as const
  const applied = session.apply(batch, { expectedHash: proposal.expectedHash, label: 'Translate into French' })
  if (!applied.ok) throw new Error(`the proposal was refused: ${applied.message}`)

  if (sent.join() !== 'translation') throw new Error(`the server was sent ${String(sent.length)} requests, not the one translation`)
  if (proposal.refused.length !== 0) throw new Error(`the proposal refused ${proposal.refused.map(({ key, reason }) => `${key} (${reason})`).join(', ')}`)
  const lacking = languageDiagnostics(session.document(), 'fr-CH').filter(({ code }) => code === 'word-missing')
  if (lacking.length !== 0) throw new Error(`the French still lacks ${String(lacking.length)} words`)
  const french = reportIn(session.document(), 'fr-CH').title
  if (french !== 'Offre') throw new Error(`the French title is ${french}`)
  session.undo()
  session.apply({ command: 'setTitle', args: ['Offerte 2026'] })
  const stale = session.apply(batch, { expectedHash: proposal.expectedHash })
  if (stale.ok || stale.code !== 'stale-document') throw new Error('a proposal applied over a later edit was not refused stale')

  return `report-ai asked a scripted server, through askThrough, for the ${String(lacked)} words the quotation's French lacked, ${String(proposal.rows.length)} rows applied as one step against the report's hash, the French title ${french}, and the same batch refused stale after an edit, every request under ${String(MAX_MODEL_REQUEST_BYTES)} bytes`
}
