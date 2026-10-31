/**
 * The site's own files, read as a browser and a licence read them: every
 * url() of a stylesheet names a file of the site, and none another site's;
 * no stylesheet @imports, which a browser would fetch from wherever it
 * names; every face the site serves is one a stylesheet names; and each
 * package a file is copied from is in the notices beside them, with the
 * copyright and licence the OFL asks each copy to carry (0023).
 */
import { NOTICES } from '../pages.js'
import type { Built } from './read.js'

/** The package an installed file is copied from: the one directly below the last node_modules of its path. */
const packageOf = (from: string): string | undefined => /\/node_modules\/((?:@[\w.-]+\/)?[\w.-]+)\/(?!.*\/node_modules\/)/.exec(from)?.[1]

export function fileProblems({ site, inputs }: Built): string[] {
  const problems: string[] = []
  const paths = new Set(site.files.map((file) => file.path))
  const named = new Set<string>()
  for (const file of site.files) {
    if (!file.path.endsWith('.css') || !('text' in file)) continue
    const css = file.text.replaceAll(/\/\*[\s\S]*?\*\//g, '')
    for (const [rule] of css.matchAll(/@import[^;]*/g))
      problems.push(`${file.path}: ${rule} is a stylesheet a reader's browser would fetch, from wherever it names`)
    for (const [, , href = ''] of css.matchAll(/url\(\s*(['"]?)([^'")]*)\1\s*\)/g)) {
      if (href.startsWith('data:')) continue
      const at = new URL(href, `${inputs.site}${file.path}`).href
      if (!at.startsWith(inputs.site))
        problems.push(`${file.path}: url(${href}) is a file of another site, which a reader's browser would ask for, telling it who opened the page`)
      else if (!paths.has(at.slice(inputs.site.length))) problems.push(`${file.path}: url(${href}) names no file of the site`)
      else named.add(at.slice(inputs.site.length))
    }
  }
  const notices = site.files.find((file) => file.path === NOTICES)
  const listed =
    notices !== undefined && 'text' in notices ? new Set([...notices.text.matchAll(/^-{80}\n(\S+) \S+\n/gm)].map((match) => match[1])) : new Set<string>()
  for (const file of site.files) {
    if (!('from' in file)) continue
    const copied = packageOf(file.from)
    if (copied === undefined) continue
    if (!named.has(file.path)) problems.push(`${file.path} is served, and no stylesheet of the site names it`)
    if (!listed.has(copied)) problems.push(`${file.path} is copied from ${copied}, which ${NOTICES} does not list`)
  }
  return problems
}
