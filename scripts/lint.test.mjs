import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, extname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { isDeepStrictEqual } from 'node:util'
import js from '@eslint/js'
import { ESLint } from 'eslint'
import * as prettier from 'prettier'
import ts from 'typescript'
import tseslint from 'typescript-eslint'
import { describe, expect, test } from 'vitest'
import { FILES, prettierConfig } from './code-style/code-style.mjs'

/**
 * The linter's and the formatter's wiring, as a gate: that every
 * TypeScript and JavaScript file git holds is linted by the shared rules,
 * with the paths eslint.config.mjs passes them, and formatted in
 * prettier.config.mjs's style.
 *
 * The rules themselves are scripts/code-style/code-style.mjs, the copy of
 * what formancy.ai will publish as a shared package for all four
 * repositories, and code-style.test.mjs beside it holds what each does.
 * What is held here is derived from the files git holds, each known by the
 * language Prettier infers for it, and from the two recommended sets as
 * ESLint itself computes them, never from a list of this file's own: a
 * file added, a rule a set adds, a relaxation or a warning anywhere is
 * seen without an edit here. The one case that lints hands ESLint a
 * file's own content and never another text at its path, and lints each
 * file once: on CI, where CI=true, typescript-eslint infers a single run,
 * so a text for a path on disk is typed as the file on disk (Formancy
 * Health's CI run 41045406900, 30 October 2026) and a file linted twice
 * gives no findings the second time (Health's run 41083791693). A case
 * that edits a repository file's text, or lints one twice, would pass
 * there having checked nothing. What a rule does to a text is held in
 * code-style.test.mjs, in a repository of real files it writes.
 *
 * What it cannot see: whether a rule's verdict is right. It holds that a
 * rule runs and fails the build, not that what it reports is a defect.
 */
const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const eslint = new ESLint({ cwd: root })
const scripts = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).scripts

/** The messages for a file of the repository, linted with its own content, as `pnpm lint` reads it. */
const linted = new Set()
const lintOwn = (file) => {
  // A second lint of a file gives no findings in a single run, which would pass vacuously.
  if (linted.has(file)) throw new Error(`${file} is linted twice`)
  linted.add(file)
  return eslint.lintText(readFileSync(file, 'utf8'), { filePath: file }).then(([result]) => result.messages)
}

/** A package's source, which every rule holds, beside which the install fixtures are read. */
const SOURCE = 'packages/report-spec/src/index.ts'

/** A test, by its name, as the size budget knows one; the capture is the name its source would have. */
const TEST = /\.(test|spec)(\.[cm]?[jt]sx?)$/

/** The install fixtures, which import the packed tarballs and are linted without types. */
const UNTYPED = 'scripts/install-fixture/'

/** What the shared rules relax in a test, and nothing else (formancy.ai-data 0116). */
const RELAXED_IN_TESTS = [
  '@typescript-eslint/no-unsafe-assignment',
  '@typescript-eslint/no-unsafe-member-access',
  '@typescript-eslint/no-unsafe-call',
  '@typescript-eslint/no-unsafe-argument',
  '@typescript-eslint/no-unsafe-return',
  '@typescript-eslint/unbound-method',
  '@typescript-eslint/no-explicit-any',
]

/**
 * What the shared rules turn off in every file (formancy.ai-health 0017,
 * formancy.ai-data 0116): a synchronous implementation of an async contract keeps its
 * throws as rejections by being `async`.
 */
const OFF_EVERYWHERE = ['@typescript-eslint/require-await']

const HOOKS = ['react-hooks/rules-of-hooks', 'react-hooks/exhaustive-deps']

/** typescript-eslint's rules that read types, as its rules say of themselves. */
const TYPED_RULES = Object.entries(tseslint.plugin.rules)
  .filter(([, rule]) => rule.meta.docs?.requiresTypeChecking)
  .map(([name]) => `@typescript-eslint/${name}`)

const severity = (entry) => {
  const level = Array.isArray(entry) ? entry[0] : entry
  return { off: 0, warn: 1, error: 2 }[level] ?? level ?? 0
}
const normal = (entry) => (entry === undefined ? [0] : [severity(entry), ...(Array.isArray(entry) ? entry.slice(1) : [])])
const atError = (rules) => Object.keys(rules).filter((rule) => severity(rules[rule]) === 2)
const differing = (a, b) => [...new Set([...Object.keys(a), ...Object.keys(b)])].filter((rule) => !isDeepStrictEqual(normal(a[rule]), normal(b[rule]))).sort()

/** The rules a set of configurations sets for a file at `path`, as ESLint merges them, the sets' own overrides by language included. */
async function rulesOf(configs, path) {
  const reference = new ESLint({ cwd: root, overrideConfigFile: true, overrideConfig: configs })
  return (await reference.calculateConfigForFile(join(root, path))).rules
}

/**
 * Every file git holds that Prettier formats as JavaScript or TypeScript,
 * by the parser it infers -- so a kind of file no list here names is found
 * -- and whether that parser is TypeScript's.
 */
async function trackedSources() {
  const parsers = (await prettier.getSupportInfo()).languages.find((language) => language.name === 'JavaScript').parsers
  const tracked = execFileSync('git', ['ls-files'], { cwd: root, encoding: 'utf8' }).split('\n').filter(Boolean)
  const inferred = await Promise.all(tracked.map((file) => prettier.getFileInfo(join(root, file)).then(({ inferredParser }) => inferredParser)))
  return tracked.flatMap((file, i) => (parsers.includes(inferred[i]) ? [{ file, typescript: inferred[i] === 'typescript' }] : []))
}

/** The workspace directories whose manifest declares React, each ending in a slash. */
function reactWorkspaces() {
  return ['packages', 'apps'].flatMap((group) =>
    readdirSync(join(root, group))
      .filter((name) => {
        const manifest = join(root, group, name, 'package.json')
        if (!existsSync(manifest)) return false
        const { dependencies, devDependencies, peerDependencies } = JSON.parse(readFileSync(manifest, 'utf8'))
        return [dependencies, devDependencies, peerDependencies].some((declared) => declared?.react !== undefined)
      })
      .map((name) => `${group}/${name}/`),
  )
}

// The one case that lints a file builds one program, the tools'. Measured
// on 30 October 2026 on an Apple M2 with 8 cores, under Node 22.23.3, with
// `pnpm test:repo` running every guard at once: 1.8 s for that case, 0.6 s
// for the one that reads every file's configuration, both with and without
// CI=true -- a third of vitest's 5 s default, on a machine with nothing else
// running. On formancy.ai's CI runner the same design took 55.7 s for its
// one case (run of 0f13a27) and 308 s when it built a program for each
// tsconfig. `verify` runs this file beside the others, so the cases wait
// 120 s, twice the slowest runner measure.
const TYPED = { timeout: 120_000 }

describe('the linter', TYPED, () => {
  // A file ESLint never reads, or reads at warn, or with a recommended rule
  // quietly off, passes `pnpm lint` without anyone noticing: a narrowed
  // command, a relaxation added for tests or for everything, a glob that
  // types too little or relaxes too much. So each file git holds is held
  // to what its kind is held to: TypeScript to both recommended sets at
  // error, its typed half off only in the install fixtures, which differ
  // from a package's source by that half and nothing else; JavaScript to
  // the sets' rules that need no types; a test to its source's rules but
  // the seven relaxations; `require-await` off in every file; and a file of
  // a workspace that declares React to the hooks rules.
  test('every TypeScript and JavaScript file git holds is linted, by the rules its kind is held to', async () => {
    expect(scripts.lint).toBe('eslint .')
    const recommended = {
      typescript: atError(await rulesOf([js.configs.recommended, ...tseslint.configs.recommendedTypeChecked], 'reference.ts')),
      javascript: atError(await rulesOf([js.configs.recommended, ...tseslint.configs.recommended], 'reference.mjs')),
    }
    const react = reactWorkspaces()
    const source = (await eslint.calculateConfigForFile(join(root, SOURCE))).rules
    const problems = []
    const seen = { source: 0, test: 0, javascript: 0, untyped: 0, react: 0 }
    for (const { file, typescript } of await trackedSources()) {
      if (await eslint.isPathIgnored(join(root, file))) {
        problems.push(`${file}: not linted`)
        continue
      }
      const { rules, languageOptions } = await eslint.calculateConfigForFile(join(root, file))
      const test = TEST.test(file)
      // An install fixture's JavaScript (build.mjs) is untyped like any other .mjs, and is held to the JavaScript rules.
      const untyped = typescript && file.startsWith(UNTYPED)
      const typed = typescript && !untyped
      const off = [...OFF_EVERYWHERE, ...(test ? RELAXED_IN_TESTS : []), ...(typed ? [] : TYPED_RULES)]
      for (const rule of Object.keys(rules).filter((rule) => severity(rules[rule]) === 1)) problems.push(`${file}: ${rule} warns`)
      for (const rule of recommended[typescript ? 'typescript' : 'javascript']) {
        if (!off.includes(rule) && severity(rules[rule]) !== 2) problems.push(`${file}: ${rule} is not at error`)
      }
      for (const rule of off) if (severity(rules[rule]) !== 0) problems.push(`${file}: ${rule} is on`)
      if (Boolean(languageOptions.parserOptions?.project) !== typed) problems.push(`${file}: ${typed ? 'not ' : ''}linted with types`)
      if (test) {
        const its = (await eslint.calculateConfigForFile(join(root, file.replace(TEST, '$2')))).rules
        const relaxed = RELAXED_IN_TESTS.filter((rule) => severity(its[rule]) !== 0).sort()
        const differ = differing(rules, its)
        if (!isDeepStrictEqual(differ, relaxed)) problems.push(`${file}: differs from its source by ${differ.join(', ') || 'nothing'}`)
      }
      if (untyped) {
        const beyond = differing(rules, source).filter((rule) => !TYPED_RULES.includes(rule))
        if (beyond.length > 0) problems.push(`${file}: differs from ${SOURCE} by ${beyond.join(', ')}`)
      }
      const inReact = typescript && react.some((workspace) => file.startsWith(workspace))
      if (inReact) for (const rule of HOOKS) if (severity(rules[rule]) !== 2) problems.push(`${file}: ${rule} is not at error`)
      seen[test ? 'test' : untyped ? 'untyped' : typescript ? 'source' : 'javascript'] += 1
      if (inReact) seen.react += 1
    }
    expect(problems).toEqual([])
    for (const [kind, count] of Object.entries(seen)) expect(count, `files of the kind ${kind}`).toBeGreaterThan(0)
  })

  // A new package or app must be linted with types without anyone editing
  // the configuration, and a tool config -- a vitest, Vite or tsdown
  // config -- is typed by tsconfig.tools.json, which `project` must name.
  // So the programs the configuration names are expanded from the
  // configuration ESLint computes, and held to the two things a program
  // is for, without building one for each: they are the tsconfigs
  // `pnpm typecheck` runs, so that nothing is typed that is not checked and
  // nothing checked is left untyped; and every TypeScript file git holds,
  // the install fixtures aside, is in one, as TypeScript itself reads the
  // tsconfig. A file TypeScript's wildcard drops -- where two files differ
  // only in their extension, `include` takes the .ts and not the .tsx
  // (formancy.ai-data's apps/host/src/duplicate.test.tsx was found so) -- is
  // in no program, and so neither type-checked nor linted with types. This
  // is also what holds the Angular builder's specs: it has a
  // tsconfig.spec.json that `typecheck` does not run, and its *.test.ts
  // are in tsconfig.json's program, which it does.
  //
  // One file is then linted, of the tools' program, which is the smallest
  // and the one a package's pattern does not name: a tsconfig the parser
  // cannot read is a fatal message, and a file in no project one too, so a
  // file that lint passes has no message at all. That the typed rules are
  // on for a file, and a program is set for it, the first case holds for
  // every file; this one holds that a program loads. It is the only
  // program built here: linting the first file of each tsconfig took 308 s
  // on formancy.ai's CI runner, beside every other suite, against 9 to 13 s
  // locally (its run 41117900910, 30 October 2026) -- work `pnpm lint`
  // does a step earlier, and which has no bound under load.
  test('every tsconfig `pnpm typecheck` runs is one lint reads, and every TypeScript file git holds is in one', async () => {
    const { project } = (await eslint.calculateConfigForFile(join(root, SOURCE))).languageOptions.parserOptions
    const named = project.flatMap((pattern) => {
      const parts = pattern.replace(/^\.\//, '').split('/')
      return parts
        .reduce(
          (dirs, part) =>
            dirs.flatMap((dir) =>
              part === '*'
                ? readdirSync(join(root, dir), { withFileTypes: true })
                    .filter((entry) => entry.isDirectory())
                    .map((entry) => join(dir, entry.name))
                : [join(dir, part)],
            ),
          ['.'],
        )
        .filter((path) => existsSync(join(root, path)))
    })
    expect(named.length, 'tsconfigs the configuration names').toBeGreaterThan(0)

    // The tsconfigs typecheck runs: the root's tools, and each workspace's
    // own, which its script names with `-p` or leaves at the default.
    const typechecked = ['packages', 'apps'].flatMap((group) =>
      readdirSync(join(root, group)).flatMap((name) => {
        const manifest = join(root, group, name, 'package.json')
        if (!existsSync(manifest)) return []
        const script = JSON.parse(readFileSync(manifest, 'utf8')).scripts?.typecheck
        if (script === undefined) return []
        return [join(group, name, /-p (\S+)/.exec(script)?.[1] ?? 'tsconfig.json')]
      }),
    )
    expect(scripts.typecheck).toContain('tsc --noEmit -p tsconfig.tools.json')
    expect([...named].sort(), 'the tsconfigs lint types with, and those typecheck runs').toEqual([...typechecked, 'tsconfig.tools.json'].sort())

    const placed = new Set(
      named.flatMap((tsconfig) => {
        const path = join(root, tsconfig)
        const { fileNames, errors } = ts.parseJsonConfigFileContent(ts.readConfigFile(path, ts.sys.readFile).config, ts.sys, dirname(path))
        expect(errors, tsconfig).toEqual([])
        return fileNames.map((file) => realpathSync(file))
      }),
    )
    const unplaced = (await trackedSources())
      .filter(({ file, typescript }) => typescript && !file.startsWith(UNTYPED))
      .map(({ file }) => file)
      .filter((file) => !placed.has(realpathSync(join(root, file))))
    expect(unplaced).toEqual([])

    expect(await lintOwn('vitest.coverage.ts'), 'vitest.coverage.ts, in the tools program').toEqual([])
  })
})

describe('the formatter', () => {
  // Two repositories formatted differently would reformat each other's
  // files on every change. A .prettierrc in a directory, or an
  // .editorconfig, which Prettier's command line reads, would change the
  // style for the files beneath it.
  test('every TypeScript and JavaScript file git holds is formatted in the shared style', async () => {
    const differ = []
    for (const { file } of await trackedSources()) {
      const options = await prettier.resolveConfig(join(root, file), { editorconfig: true })
      if (!isDeepStrictEqual(options, prettierConfig)) differ.push(`${file}: ${JSON.stringify(options)}`)
    }
    expect(differ).toEqual([])
  })

  // A glob that matches nothing fails the check, but a narrowed one passes
  // on the files it still names. So both scripts hand Prettier the shared
  // list, and the check, as the script runs it, is run on a misformatted
  // file of every extension git holds, outside the repository, where a run
  // that is killed leaves nothing behind, and must name each.
  test('the format scripts check a misformatted file of every extension git holds', async () => {
    for (const name of ['format', 'format:check']) expect(scripts[name], name).toContain(`'${FILES}'`)
    const extensions = [...new Set((await trackedSources()).map(({ file }) => extname(file)))]
    const [command, ...args] = scripts['format:check'].split(' ').map((word) => word.replace(/^'(.*)'$/, '$1'))
    expect(command).toBe('prettier')
    const prettierRoot = dirname(fileURLToPath(import.meta.resolve('prettier')))
    const bin = join(prettierRoot, JSON.parse(readFileSync(join(prettierRoot, 'package.json'), 'utf8')).bin)
    const dir = realpathSync(mkdtempSync(join(tmpdir(), 'format-sample-')))
    try {
      for (const extension of extensions) writeFileSync(join(dir, `sample${extension}`), 'const a = "x";\n')
      const run = spawnSync(process.execPath, [bin, ...args, '--config', join(root, 'prettier.config.mjs')], { cwd: dir, encoding: 'utf8' })
      expect(run.status, run.stderr).toBe(1)
      for (const extension of extensions) expect(run.stdout + run.stderr).toContain(`sample${extension}`)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
