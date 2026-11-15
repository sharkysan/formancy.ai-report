/**
 * The Studio's words the pages name, held to what the Studio says: a page
 * that tells a reader to choose a starter or press a button names it as
 * the Studio's recorded pictures show it (docs/images/readme/captured.json,
 * which `test:pictures` holds to the Studio), and every page of the group
 * still says it. The Studio's words are English in every language.
 */
import type { PageGroup } from '../pages.js'
import type { Built } from './read.js'
import { collapsed, read } from './read.js'

/** Every scene's recorded text, as the Studio's accessibility tree wrote it. */
function recordedText(built: Built): string {
  const scenes = JSON.parse(built.text('docs/images/readme/captured.json')) as Record<string, { text?: Record<string, string> }>
  return Object.values(scenes)
    .flatMap((scene) => Object.values(scene.text ?? {}))
    .join('\n')
}

export function studioWordProblems(built: Built, groups: readonly PageGroup[]): string[] {
  const problems: string[] = []
  const recorded = recordedText(built)
  for (const { id, studioWords = [] } of groups) {
    for (const word of studioWords) if (!recorded.includes(`"${word}"`)) problems.push(`${id}: names "${word}", which no scene of captured.json's Studio says`)
  }
  for (const page of built.site.pages.map(read)) {
    const words = groups.find((group) => group.id === page.group)?.studioWords ?? []
    const said = collapsed(page.document.body.textContent)
    for (const word of words) if (!said.includes(word)) problems.push(`${page.file}: does not say "${word}", which its group names as the Studio's`)
  }
  return problems
}
