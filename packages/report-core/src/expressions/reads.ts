/**
 * What expressions read, by name, asked of the parser as the compiler asks
 * it (`compile-site.ts`): the paths `referencedPaths` gives, taken apart by
 * `pathParts`. The diagnostics ask it to know what nothing reads
 * (`unused.ts`), and the command that removes a field with its readers to
 * know what does (`readers.ts`), so the two cannot disagree on what an
 * expression reads. An expression that does not parse reads nothing it
 * can be credited with; its own diagnostic says why.
 */
import { parse, referencedPaths } from '@formancy/expressions'
import type { DatasetRole } from '@formancy/report-spec'
import { pathParts } from './compile-site.js'

/** The name an expression reads each dataset's fields under: `header.<id>`, `row.<id>`. */
export const READ_AS: { readonly [R in DatasetRole]: 'header' | 'row' } = { header: 'header', detail: 'row' }

/** What expressions read, by name: the members read, or 'all' where one reads the whole map. */
export type Reads = ReadonlyMap<string, ReadonlySet<string> | 'all'>

/** What the expressions `cels` read between them. */
export function expressionReads(cels: Iterable<string>): Reads {
  const reads = new Map<string, Set<string> | 'all'>()
  for (const cel of cels) {
    const parsed = parse(cel)
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

/** Whether `reads` read `id` under any of `names`: by its id, or by reading the name whole. */
export function readsMember(reads: Reads, names: readonly string[], id: string): boolean {
  return names.some((name) => {
    const members = reads.get(name)
    return members === 'all' || members?.has(id) === true
  })
}
