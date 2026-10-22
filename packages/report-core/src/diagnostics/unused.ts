/**
 * Declarations nothing uses: a style no component names, an asset no image
 * draws, a parameter, field or aggregate nothing prints, orders by, totals
 * or reads. Each renders as written; each is probably a leftover, and a
 * parameter or a field costs something at every render -- a question on
 * the parameter form, a column the provider fetches.
 *
 * What an expression reads counts: its paths are asked of the parser, as
 * the compiler asks them. An expression that does not parse reads nothing
 * it can be credited with; its own diagnostic says why.
 */
import { parse, referencedPaths } from '@formancy/expressions'
import { FONT_FACE_KEYS, isFontMediaType } from '@formancy/report-spec'
import type { DatasetRole, ReportDefinition } from '@formancy/report-spec'
import { pathParts } from '../expressions/compile-site.js'
import { quote } from '../outcome.js'
import { diagnostic } from './codes.js'
import type { Diagnostic, DiagnosticCode } from './codes.js'
import type { ExpressionSite, ReportParts } from './parts.js'

/** What expressions read, by name: the members read, or 'all' when one reads the whole map. */
type Reads = ReadonlyMap<string, ReadonlySet<string> | 'all'>

function expressionReads(sites: readonly ExpressionSite[]): Reads {
  const reads = new Map<string, Set<string> | 'all'>()
  for (const site of sites) {
    const parsed = parse(site.cel)
    if (!parsed.ok) continue
    for (const path of referencedPaths(parsed.ast)) {
      const { name, member, rest } = pathParts(path)
      const known = reads.get(name)
      // A whole read may read any member; a read by a key that is no
      // identifier reads none, since every member's id is one.
      if (member === undefined && rest === '') reads.set(name, 'all')
      else if (member === undefined) continue
      else if (known === undefined) reads.set(name, new Set([member]))
      else if (known !== 'all') known.add(member)
    }
  }
  return reads
}

/** Whether an expression reads `id` under any of `names`. */
function read(reads: Reads, names: readonly string[], id: string): boolean {
  return names.some((name) => {
    const members = reads.get(name)
    return members === 'all' || members?.has(id) === true
  })
}

/** The name an expression reads each dataset's fields under. */
const READ_AS: { readonly [R in DatasetRole]: string } = { header: 'header', detail: 'row' }

export function unusedDiagnostics(report: ReportDefinition, parts: ReportParts): Diagnostic[] {
  const reads = expressionReads(parts.expressions)
  const found: Diagnostic[] = []
  const check = (declared: readonly { readonly id: string }[], used: (id: string) => boolean, code: DiagnosticCode, list: string, message: (id: string) => string): void => {
    for (const [index, { id }] of declared.entries()) if (!used(id)) found.push(diagnostic(code, message(quote(id)), { path: `${list}/${index}` }))
  }
  const styles = new Set(parts.styles)
  const assets = new Set(parts.assets)
  const parameters = new Set(parts.parameters)
  const aggregates = new Set(parts.aggregates)
  // A font asset is used when a font token maps one of its faces to it, where an image asset is used when an image draws it (0043).
  const mappedFaces = new Set<string>()
  for (const faces of Object.values(report.fonts ?? {})) for (const key of FONT_FACE_KEYS) if (faces[key] !== undefined) mappedFaces.add(faces[key])
  check(report.styles, (id) => styles.has(id), 'unused-style', '/styles', (id) => `style ${id} is used by no component, column or row`)
  report.assets.forEach((asset, index) => {
    const font = isFontMediaType(asset.mediaType)
    if (font ? mappedFaces.has(asset.id) : assets.has(asset.id)) return
    found.push(diagnostic('unused-asset', font ? `font ${quote(asset.id)} is mapped to no font token` : `asset ${quote(asset.id)} is drawn by no image`, { path: `/assets/${index}` }))
  })
  check(
    report.parameters,
    (id) => parameters.has(id) || read(reads, ['params'], id),
    'unused-parameter',
    '/parameters',
    (id) => `parameter ${id} is neither printed nor read, and the person rendering would be asked for it for nothing`,
  )
  for (const role of ['header', 'detail'] as const) {
    const fields = new Set(parts.fields.filter(({ dataset }) => dataset === role).map(({ field }) => field))
    check(
      report.datasets[role]?.fields ?? [],
      (id) => fields.has(id) || read(reads, [READ_AS[role]], id),
      'unused-field',
      `/datasets/${role}/fields`,
      (id) => `field ${id} of the ${role} dataset is neither printed, drawn, ordered by, totalled nor read, and would be fetched for nothing`,
    )
  }
  check(
    report.aggregates,
    (id) => aggregates.has(id) || read(reads, ['totals', 'group'], id),
    'unused-aggregate',
    '/aggregates',
    (id) => `aggregate ${id} is neither printed nor read, and would be computed over every row for nothing`,
  )
  return found
}
