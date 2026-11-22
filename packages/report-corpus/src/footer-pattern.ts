import type { Block } from './document.js'

/**
 * The line the page footer prints, as a pattern: its text literally, each
 * page field as digits in a named group. The first paragraph with a page
 * field is the one matched; a footer without one has no pattern.
 */
export function footerPattern(footer: readonly Block[]): RegExp | undefined {
  const paragraph = footer.find((block) => block.kind === 'paragraph' && block.runs.some((run) => 'field' in run))
  if (paragraph?.kind !== 'paragraph') return undefined
  const named = new Set<string>()
  const source = paragraph.runs
    .map((run) => {
      if ('text' in run) return run.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      if (named.has(run.field)) return `\\k<${run.field}>`
      named.add(run.field)
      return `(?<${run.field}>\\d+)`
    })
    .join('')
  return new RegExp(`^${source.replace(/\s+/g, ' ').trim()}$`)
}
