import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, test } from 'vitest'

/**
 * What npm shows of each published package beside its code (0081): the
 * keywords a reader searches npm by, and the homepage. Every published
 * manifest names keywords, and says among them that it is source-available
 * and a formancy package; none calls a package open source, which CLAUDE.md
 * says nowhere may (0001); and every one names the one homepage, which the
 * pages' suite holds to the English start page it builds
 * (apps/pages/src/site.test.ts). That a keyword names what its own package
 * does is review's.
 */
const repo = join(dirname(fileURLToPath(import.meta.url)), '..')

/** Every manifest under packages/ npm publishes: one not marked private. */
function publishedManifests() {
  return readdirSync(join(repo, 'packages'))
    .sort()
    .map((name) => join(repo, 'packages', name, 'package.json'))
    .filter((path) => existsSync(path))
    .map((path) => JSON.parse(readFileSync(path, 'utf8')))
    .filter((manifest) => manifest.private !== true)
}

/** A keyword as npm's search reads one best: lower case, words joined by hyphens. */
const KEYWORD = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/** A keyword that calls a package open source, however it is spelt. */
const OPEN = /^(?:open-?source|oss|foss|floss|libre)$/

/** Every keyword a published package names, in addition to its own. */
const SHARED = ['formancy', 'source-available']

/** What is wrong with `manifests`' keywords and homepages, as sentences. Pure, so a case can hand it manifests the repository does not have. */
function manifestProblems(manifests) {
  const problems = []
  for (const { name, keywords } of manifests) {
    if (!Array.isArray(keywords) || keywords.length <= SHARED.length) {
      problems.push(`${String(name)} names no keywords of its own`)
      continue
    }
    for (const keyword of keywords) {
      if (typeof keyword !== 'string' || !KEYWORD.test(keyword))
        problems.push(`${String(name)}: the keyword ${JSON.stringify(keyword)} is not lower case words joined by hyphens`)
      else if (OPEN.test(keyword)) problems.push(`${String(name)}: the keyword "${keyword}" calls it open source`)
    }
    if (new Set(keywords).size !== keywords.length) problems.push(`${String(name)} names a keyword twice`)
    for (const keyword of SHARED) if (!keywords.includes(keyword)) problems.push(`${String(name)} does not name the keyword "${keyword}"`)
  }
  const homepages = [...new Set(manifests.map((manifest) => manifest.homepage))]
  if (homepages.length !== 1 || typeof homepages[0] !== 'string' || !homepages[0].startsWith('https://'))
    problems.push(`the published packages name the homepages ${JSON.stringify(homepages)}, not one address over https`)
  return problems
}

describe("what npm shows beside each published package's code (0081)", () => {
  // A package without keywords is found on npm by its name alone; one
  // calling itself open source says on npm what the licence says it is not.
  test('names keywords of its own, never "open source", and the one homepage the others name', () => {
    const manifests = publishedManifests()
    expect(manifests.length).toBeGreaterThan(1)
    expect(manifestProblems(manifests)).toEqual([])
  })

  // The check itself, over manifests made for it: each way a manifest is
  // wrong is named, so the case above cannot pass by reading nothing.
  test('names a manifest without keywords, with an open-source one, or with another homepage', () => {
    const good = { name: '@formancy/report-good', keywords: ['formancy', 'pdf', 'source-available'], homepage: 'https://formancy.ai/report/en/' }
    expect(manifestProblems([good])).toEqual([])
    expect(
      manifestProblems([
        good,
        { name: '@formancy/report-bare', homepage: good.homepage },
        { name: '@formancy/report-open', keywords: ['formancy', 'pdf', 'open-source', 'source-available'], homepage: good.homepage },
        { name: '@formancy/report-oss', keywords: ['formancy', 'OSS', 'oss', 'pdf', 'pdf', 'source-available'], homepage: good.homepage },
        { name: '@formancy/report-alone', keywords: ['pdf', 'report', 'invoice'], homepage: 'https://github.com/sharkysan/formancy.ai-report' },
      ]),
    ).toEqual([
      '@formancy/report-bare names no keywords of its own',
      '@formancy/report-open: the keyword "open-source" calls it open source',
      '@formancy/report-oss: the keyword "OSS" is not lower case words joined by hyphens',
      '@formancy/report-oss: the keyword "oss" calls it open source',
      '@formancy/report-oss names a keyword twice',
      '@formancy/report-alone does not name the keyword "formancy"',
      '@formancy/report-alone does not name the keyword "source-available"',
      'the published packages name the homepages ["https://formancy.ai/report/en/","https://github.com/sharkysan/formancy.ai-report"], not one address over https',
    ])
  })
})
