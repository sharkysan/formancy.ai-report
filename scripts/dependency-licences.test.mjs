import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { afterAll, describe, expect, test } from 'vitest'
import YAML from 'yaml'
import { ALLOWED, closure, declaredLicence, EXCEPTIONS, fontLicence, FORMANCY_DATA, ICC_PROFILES, problems, spdxAllows, workspaceClosure } from './dependency-licences.mjs'

/**
 * 0006: everything a published package needs in production, and every font
 * one ships, is under a licence that allows public source and licensed
 * production use. Proved on fixtures for each refusal, then on the tree this
 * repository actually installs.
 */
const repo = join(dirname(fileURLToPath(import.meta.url)), '..')
const script = join(repo, 'scripts', 'dependency-licences.mjs')

const made = []
afterAll(() => {
  for (const directory of made) rmSync(directory, { recursive: true, force: true })
})

/**
 * A directory tree from `files` (path -> JSON-able manifest, string or bytes)
 * and `links` (path -> path it points at), as pnpm's isolated layout links a
 * package's dependencies beside its real directory. The long form of the
 * temporary directory, so a link's target and its realpath agree on Windows.
 */
function tree(files, links = {}) {
  const root = realpathSync.native(mkdtempSync(join(tmpdir(), 'licences-')))
  made.push(root)
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true })
    const bytes = typeof content === 'string' || Buffer.isBuffer(content) ? content : JSON.stringify(content)
    writeFileSync(join(root, path), bytes)
  }
  for (const [path, target] of Object.entries(links)) {
    mkdirSync(dirname(join(root, path)), { recursive: true })
    // A junction on Windows, which needs no privilege; the type is ignored elsewhere.
    symlinkSync(join(root, target), join(root, path), 'junction')
  }
  return root
}

const manifest = (name, version, license, fields = {}) => ({ name, version, ...(license === undefined ? {} : { license }), ...fields })

/** One entry of a closure, as `closure` returns it, for the cases that need no disk. */
const entry = (name, version, licence, more = {}) => ({ name, version, licence, dir: `/x/${name}`, via: ['@formancy/report-x'], sibling: false, fonts: [], profiles: [], ...more })

/** The bytes of an OpenType font holding only a name table with these Windows-platform names. */
function font(names) {
  const records = Object.entries(names).map(([id, text]) => [Number(id), Buffer.from(text, 'utf16le').swap16()])
  const storage = 6 + 12 * records.length
  const table = Buffer.alloc(storage + records.reduce((sum, [, text]) => sum + text.length, 0))
  table.writeUInt16BE(records.length, 2)
  table.writeUInt16BE(storage, 4)
  let offset = 0
  records.forEach(([id, text], index) => {
    const at = 6 + 12 * index
    table.writeUInt16BE(3, at)
    table.writeUInt16BE(1, at + 2)
    table.writeUInt16BE(0x409, at + 4)
    table.writeUInt16BE(id, at + 6)
    table.writeUInt16BE(text.length, at + 8)
    table.writeUInt16BE(offset, at + 10)
    text.copy(table, storage + offset)
    offset += text.length
  })
  const directory = Buffer.alloc(12 + 16)
  directory.writeUInt32BE(0x00010000, 0)
  directory.writeUInt16BE(1, 4)
  directory.write('name', 12, 'latin1')
  directory.writeUInt32BE(directory.length, 20)
  directory.writeUInt32BE(table.length, 24)
  return Buffer.concat([directory, table])
}

/**
 * The bytes of an ICC profile's header and an empty tag table, `marker` in
 * a byte of the header's reserved field so that two made with different
 * markers are two profiles: its size first, and the signature `acsp` at
 * byte 36 (ICC.1, 7.2), which is what tells a profile by its first bytes.
 */
function profile(marker = 0) {
  const bytes = Buffer.alloc(132)
  bytes.writeUInt32BE(bytes.length, 0)
  bytes.write('acsp', 36, 'latin1')
  bytes[100] = marker
  return bytes
}
const digest = (bytes) => `sha256:${createHash('sha256').update(bytes).digest('hex')}`
const reviewed = (bytes) => ({ [digest(bytes)]: { profile: 'a profile made in code', licence: 'May be embedded without restriction.', evidence: 'this test' } })

const OFL = 'This Font Software is licensed under the SIL Open Font License, Version 1.1. This license is available with a FAQ at: https://openfontlicense.org'
const LIBERATION = 'Licensed under the Liberation Fonts license, see https://fedoraproject.org/wiki/Licensing/LiberationFontLicense'

describe('spdxAllows', () => {
  // The list itself: an identifier on it that the parser could not match --
  // a typo, a character the tokeniser splits on -- would refuse every package
  // under that licence and send somebody to write an exception for MIT.
  test('allows each identifier on the list, alone', () => {
    for (const id of ALLOWED) expect(spdxAllows(id), id).toBe(true)
  })

  // The case the policy exists for: GPL code in a product whose production
  // use is licensed.
  test('refuses GPL-3.0-only', () => {
    expect(spdxAllows('GPL-3.0-only')).toBe(false)
  })

  // AGPL reaches across the network to the server that runs it, which is
  // exactly where a report is rendered.
  test('refuses AGPL-3.0-or-later', () => {
    expect(spdxAllows('AGPL-3.0-or-later')).toBe(false)
  })

  // A non-commercial licence forbids the production use the licence sells.
  test('refuses CC-BY-NC-4.0', () => {
    expect(spdxAllows('CC-BY-NC-4.0')).toBe(false)
  })

  // The rest of the families 0006 names, and the licences that are not
  // identifiers at all. An allow-list refuses them by not listing them; this
  // fails if somebody turns it into a deny-list that forgot one.
  test('refuses LGPL, SSPL, BUSL, a source-available pointer and UNLICENSED', () => {
    for (const expression of ['LGPL-2.1-only', 'LGPL-3.0-or-later', 'SSPL-1.0', 'BUSL-1.1', 'CC-BY-NC-SA-4.0', 'GPL-2.0+', 'SEE LICENSE IN LICENSE.md', 'UNLICENSED']) {
      expect(spdxAllows(expression), expression).toBe(false)
    }
  })

  // A dual-licensed package is taken under the branch the policy allows.
  // Refused for offering GPL as well, it would need an exception, and a real
  // refusal would then hide among the formalities.
  test("allows 'MIT OR GPL-2.0'", () => {
    expect(spdxAllows('MIT OR GPL-2.0')).toBe(true)
  })

  // Both licences bind at once. Read like OR, the GPL half ships unnoticed.
  test("refuses 'MIT AND GPL-2.0'", () => {
    expect(spdxAllows('MIT AND GPL-2.0')).toBe(false)
  })

  // Brackets decide which operator binds. Read without them, by precedence
  // alone, the refused expression is '(GPL AND MIT) OR ISC OR Apache-2.0' and
  // passes on its last term.
  test('reads nested parentheses as written', () => {
    expect(spdxAllows('(GPL-3.0-only AND ((MIT OR ISC) OR Apache-2.0))')).toBe(false)
    expect(spdxAllows('GPL-2.0-only AND (MIT OR Apache-2.0)')).toBe(false)
    expect(spdxAllows('((MIT AND ISC) OR (GPL-2.0-only AND (Apache-2.0 OR BSD-3-Clause)))')).toBe(true)
    expect(spdxAllows('Apache-2.0 OR (MIT AND (ISC OR GPL-3.0-only))')).toBe(true)
    expect(spdxAllows('((MIT))')).toBe(true)
  })

  // AND binds tighter than OR, as SPDX defines it: read left to right
  // instead, 'MIT OR GPL AND AGPL' would be '(MIT OR GPL) AND AGPL' and be
  // refused for a branch that never applied.
  test('binds AND tighter than OR', () => {
    expect(spdxAllows('MIT OR GPL-3.0-only AND AGPL-3.0-only')).toBe(true)
    expect(spdxAllows('GPL-3.0-only AND AGPL-3.0-only OR MIT')).toBe(true)
    expect(spdxAllows('GPL-3.0-only OR MIT AND AGPL-3.0-only')).toBe(false)
  })

  // A guard refuses what it cannot read (formancy.ai 0022). A parser that
  // skipped what it did not understand would pass '(MIT' and 'MIT OR' as MIT.
  test('refuses what is not an expression', () => {
    for (const expression of ['', ' ', '(MIT', 'MIT)', 'MIT OR', 'OR MIT', 'MIT GPL-3.0-only', 'MIT AND', '()', 'MIT WITH', 'WITH MIT', 'DocumentRef-x:LicenseRef-y']) {
      expect(spdxAllows(expression), JSON.stringify(expression)).toBe(false)
    }
  })

  // An SPDX exception only ever adds permissions to the licence it names, so
  // the expression is that licence. Taken as allowed on its own, GPL with the
  // Classpath exception would pass.
  test('reads a WITH exception as the licence it qualifies', () => {
    expect(spdxAllows('Apache-2.0 WITH LLVM-exception')).toBe(true)
    expect(spdxAllows('GPL-2.0-only WITH Classpath-exception-2.0')).toBe(false)
    expect(spdxAllows('(MIT OR GPL-3.0-or-later WITH GCC-exception-3.1)')).toBe(true)
  })

  // Only the SPDX exceptions on the reviewed list add permissions and
  // nothing else. Whatever follows WITH is otherwise an unread condition:
  // the Commons Clause turns Apache-2.0 into a licence that forbids selling
  // the software, which is the source-available kind 0006 refuses, and a
  // LicenseRef can say anything.
  test('refuses a WITH whose exception is not one the policy has reviewed', () => {
    for (const expression of ['Apache-2.0 WITH Commons-Clause', 'MIT WITH Commons-Clause', 'MIT with Commons-Clause', 'MIT WITH LicenseRef-NonCommercial', 'BSD-3-Clause WITH No-Production-Use']) {
      expect(spdxAllows(expression), expression).toBe(false)
    }
    // Still allowed on another branch, as any refused term is.
    expect(spdxAllows('ISC OR Apache-2.0 WITH Commons-Clause')).toBe(true)
    expect(spdxAllows('Apache-2.0 with llvm-exception')).toBe(true)
  })

  // SPDX matches identifiers without regard to case. A package that writes
  // 'mit' would otherwise be refused for its spelling, and the exceptions list
  // would fill with spelling corrections.
  test('matches identifiers and operators in either case', () => {
    expect(spdxAllows('mit')).toBe(true)
    expect(spdxAllows('(isc or gpl-3.0-only)')).toBe(true)
    expect(spdxAllows('mit and gpl-3.0-only')).toBe(false)
  })
})

describe('declaredLicence', () => {
  // npm's older forms are still in packages installed today. Ignored, each
  // would be refused as having no licence; the array read as OR would pass a
  // package that lists GPL beside MIT on the MIT alone. The array never said
  // which it meant, so it is read as the stricter.
  test('reads the legacy object and array forms, the array as AND', () => {
    expect(declaredLicence({ license: 'MIT' })).toBe('MIT')
    expect(declaredLicence({ license: { type: 'ISC', url: 'https://example.org' } })).toBe('ISC')
    expect(declaredLicence({ licenses: [{ type: 'MIT' }] })).toBe('MIT')
    expect(declaredLicence({ licenses: [{ type: 'MIT' }, 'GPL-2.0'] })).toBe('(MIT) AND (GPL-2.0)')
    expect(spdxAllows(declaredLicence({ licenses: [{ type: 'MIT' }, { type: 'GPL-2.0' }] }))).toBe(false)
  })

  // A manifest that has both fields says two things, and neither says which
  // wins. Read by the modern field alone, a GPL entry in the legacy array
  // would pass as MIT; both are read, as AND.
  test('reads a license field and a legacy licenses array together, as AND', () => {
    expect(declaredLicence({ license: 'MIT', licenses: [{ type: 'GPL-3.0-only' }] })).toBe('(MIT) AND (GPL-3.0-only)')
    expect(spdxAllows(declaredLicence({ license: 'MIT', licenses: [{ type: 'GPL-3.0-only' }] }))).toBe(false)
    expect(spdxAllows(declaredLicence({ license: { type: 'ISC' }, licenses: ['MIT'] }))).toBe(true)
  })

  // Nothing is not a licence. An empty string or an array entry with no type
  // is as unknown as a missing field, and is refused as one.
  test('says nothing when nothing usable is declared', () => {
    for (const value of [{}, { license: '' }, { license: {} }, { licenses: [] }, { licenses: [{ url: 'x' }] }]) {
      expect(declaredLicence(value), JSON.stringify(value)).toBeUndefined()
    }
  })
})

describe('problems', () => {
  // A package with no licence grants nothing: it is not permissive by
  // default. Today's png-js 1.1.0, which pdfmake pulls in, is one.
  test('refuses a package that declares no licence, naming it and the route to it', () => {
    const found = problems([entry('png-js', '1.1.0', undefined, { via: ['@formancy/report-x', 'pdfkit'] })], {}, {}, {})
    expect(found).toEqual(['png-js@1.1.0 declares no licence (@formancy/report-x > pdfkit > png-js)'])
  })

  // A refused licence names the package, what it declared and how it got in,
  // so the person reading CI's log knows which dependency to replace.
  test('refuses a package under a refused licence, saying which', () => {
    expect(problems([entry('left', '2.0.0', 'GPL-3.0-only')], {}, {}, {})).toEqual([
      'left@2.0.0 is GPL-3.0-only by its package.json, which the policy refuses (@formancy/report-x > left)',
    ])
  })

  // An exception is a review of one release. Honoured by name alone, it would
  // admit every later release, whose licence nobody read; png-js 1.1.1 could
  // have changed it.
  test('honours an exception only at its exact version', () => {
    const exceptions = { 'png-js@1.1.0': { licence: 'MIT', evidence: 'LICENSE in the tarball: MIT License, Copyright (c) 2017 Devon Govett' } }
    expect(problems([entry('png-js', '1.1.0', undefined)], exceptions, {}, {})).toEqual([])
    expect(problems([entry('png-js', '1.1.1', undefined)], exceptions, {}, {})).toEqual([
      'png-js@1.1.1 declares no licence (@formancy/report-x > png-js)',
      'exception png-js@1.1.0 names nothing a published package installs; remove it',
    ])
  })

  // An exception records what the evidence says the licence is; it corrects
  // the metadata, never the policy. Read as a waiver, an exception could admit
  // GPL by saying so.
  test('holds an exception to the policy too', () => {
    const exceptions = { 'quiet@1.0.0': { licence: 'GPL-3.0-only', evidence: 'COPYING' } }
    expect(problems([entry('quiet', '1.0.0', undefined)], exceptions, {}, {})).toEqual([
      'quiet@1.0.0 is GPL-3.0-only by its reviewed exception, which the policy refuses (@formancy/report-x > quiet)',
    ])
  })

  // An exception left behind after its package left reads as a review still
  // in force, and would admit that release again without anyone looking.
  test('refuses an exception nothing installs', () => {
    expect(problems([], { 'gone@1.0.0': { licence: 'MIT', evidence: 'LICENSE' } }, {}, {})).toEqual([
      'exception gone@1.0.0 names nothing a published package installs; remove it',
    ])
  })

  // A dependency that is not installed cannot be read, and is what a customer's
  // install would fetch anyway. Skipped, it would pass unread.
  test('refuses a required dependency that is not installed', () => {
    expect(problems([{ name: 'absent', missing: true, via: ['@formancy/report-x', 'a'] }], {}, {}, {})).toEqual([
      'absent is a dependency of a and is not installed, so its licence cannot be read (@formancy/report-x > a > absent)',
    ])
  })
})

describe('Formancy Data', () => {
  const READ = `sha256:${'a'.repeat(64)}`
  const admitted = { '@formancy/data-client@0.1.0': { licenceFile: READ, for: '@formancy/report-data-provider', evidence: 'LICENSE.md' } }
  const data = (version, more = {}) =>
    entry('@formancy/data-client', version, 'SEE LICENSE IN LICENSE.md', { via: ['@formancy/report-data-provider'], licenceFile: READ, ...more })

  // Data's packages are on this repository's terms under Data's name, sold by
  // the same person; a provider that reads Data cannot exist without them.
  // Refused as a SEE LICENSE IN pointer, the provider could never ship.
  test('admits a Data package at its exact version, with the licence the review read, reached from the provider', () => {
    expect(problems([data('0.1.0')], {}, admitted, {})).toEqual([])
  })

  // A later Data release may change its licence. Admitted by name, it would
  // reach a customer unread; at its exact version only, it is a pointer
  // nobody has read, and the admission that no longer applies is named too.
  test('refuses another version, and the admission it leaves unused', () => {
    expect(problems([data('0.1.1')], {}, admitted, {})).toEqual([
      '@formancy/data-client@0.1.1 is SEE LICENSE IN LICENSE.md by its package.json, which the policy refuses (@formancy/report-data-provider > @formancy/data-client)',
      'Formancy Data admission @formancy/data-client@0.1.0 names nothing a published package installs; remove it',
    ])
  })

  // The version is the same and the licence is not: a republished tarball,
  // or a review of the wrong file. The pointer says only where the terms
  // are; the digest says they are the ones read.
  test('refuses an admitted version whose licence file is not the one the review read', () => {
    const changed = `sha256:${'b'.repeat(64)}`
    expect(problems([data('0.1.0', { licenceFile: changed })], {}, admitted, {})).toEqual([
      `@formancy/data-client@0.1.0's LICENSE.md is ${changed}, not the Formancy Data licence the review read (${READ}) (@formancy/report-data-provider > @formancy/data-client)`,
    ])
    expect(problems([data('0.1.0', { licenceFile: null })], {}, admitted, {})).toEqual([
      `@formancy/data-client@0.1.0's LICENSE.md is missing, not the Formancy Data licence the review read (${READ}) (@formancy/report-data-provider > @formancy/data-client)`,
    ])
  })

  // The provider is the one package that may depend on Data's contracts
  // (CLAUDE.md's package path). Another reaching Data directly would make a
  // host that never runs Data a Data licensee without saying so. Reached
  // through the provider, Data is the provider's dependency, and that is
  // allowed.
  test('refuses Data reached from any package but the provider, and allows it through the provider', () => {
    expect(problems([data('0.1.0', { via: ['@formancy/report-x'] })], {}, admitted, {})).toEqual([
      '@formancy/data-client@0.1.0 is admitted for @formancy/report-data-provider alone, and @formancy/report-x depends on it (@formancy/report-x > @formancy/data-client)',
    ])
    expect(problems([data('0.1.0', { via: ['@formancy/report-x', '@formancy/report-data-provider'] })], {}, admitted, {})).toEqual([])
  })

  // An admission is a reading of one licence file at one version: held to
  // the pointer this repository's own packages use, so a Data package that
  // declared MIT or GPL is judged by its field and not waved through.
  test('judges a Data package that does not point at its licence file like any other package', () => {
    expect(problems([data('0.1.0', { licence: 'GPL-3.0-only' })], {}, admitted, {})).toEqual([
      '@formancy/data-client@0.1.0 is GPL-3.0-only by its package.json, which the policy refuses (@formancy/report-data-provider > @formancy/data-client)',
      'Formancy Data admission @formancy/data-client@0.1.0 names nothing a published package installs; remove it',
    ])
  })
})

describe('closure', () => {
  // pnpm's isolated layout: a dependency is a link, and its own dependencies
  // are linked beside its REAL directory, not beside the link. Resolved from
  // the link, `b` is never found; and a devDependency, which no customer
  // installs, is never followed.
  test('walks the production dependencies through links to real directories', () => {
    const root = tree(
      {
        'packages/report-x/package.json': manifest('@formancy/report-x', '0.1.0', 'SEE LICENSE IN LICENSE.md', { dependencies: { a: '1.0.0' }, devDependencies: { dev: '1.0.0' } }),
        'node_modules/.pnpm/a@1.0.0/node_modules/a/package.json': manifest('a', '1.0.0', 'MIT', { dependencies: { b: '^1.0.0' } }),
        'node_modules/.pnpm/b@1.0.0/node_modules/b/package.json': manifest('b', '1.0.0', 'ISC'),
        'node_modules/.pnpm/dev@1.0.0/node_modules/dev/package.json': manifest('dev', '1.0.0', 'GPL-3.0-only'),
      },
      {
        'packages/report-x/node_modules/a': 'node_modules/.pnpm/a@1.0.0/node_modules/a',
        'packages/report-x/node_modules/dev': 'node_modules/.pnpm/dev@1.0.0/node_modules/dev',
        'node_modules/.pnpm/a@1.0.0/node_modules/b': 'node_modules/.pnpm/b@1.0.0/node_modules/b',
      },
    )
    const found = closure(join(root, 'packages/report-x'))
    expect(found.map(({ name, version, licence, via }) => ({ name, version, licence, via }))).toEqual([
      { name: '@formancy/report-x', version: '0.1.0', licence: 'SEE LICENSE IN LICENSE.md', via: [] },
      { name: 'a', version: '1.0.0', licence: 'MIT', via: ['@formancy/report-x'] },
      { name: 'b', version: '1.0.0', licence: 'ISC', via: ['@formancy/report-x', 'a'] },
    ])
  })

  // Optional dependencies, and peers marked optional, ship when they are
  // installed and are read then; one that is not installed is not there to
  // read. A required dependency that is missing is a broken install and is
  // reported, never skipped -- and so is a required peer, which npm installs
  // for a customer although this workspace, with auto-install-peers off,
  // does not.
  test('follows installed optional and peer dependencies, and reports a missing required one or a missing required peer', () => {
    const root = tree({
      'app/package.json': manifest('app', '1.0.0', 'MIT', {
        dependencies: { gone: '1.0.0' },
        optionalDependencies: { binary: '1.0.0', 'other-platform': '1.0.0' },
        peerDependencies: { host: '*', 'not-provided': '*', 'agpl-host': '^1.0.0' },
        peerDependenciesMeta: { 'not-provided': { optional: true } },
      }),
      'app/node_modules/binary/package.json': manifest('binary', '1.0.0', 'Apache-2.0'),
      'app/node_modules/host/package.json': manifest('host', '1.0.0', 'AGPL-3.0-only'),
    })
    const found = closure(join(root, 'app'))
    expect(found.map((item) => (item.missing ? `missing ${item.name}` : `${item.name}@${item.version}`))).toEqual(['app@1.0.0', 'missing gone', 'binary@1.0.0', 'host@1.0.0', 'missing agpl-host'])
    expect(problems(found, {}, {}, {})).toEqual([
      'gone is a dependency of app and is not installed, so its licence cannot be read (app > gone)',
      'host@1.0.0 is AGPL-3.0-only by its package.json, which the policy refuses (app > host)',
      'agpl-host is a peer dependency of app and is not installed, so its licence cannot be read (app > agpl-host)',
    ])
  })

  // A workspace sibling is this repository's own, under LICENSE.md, and is
  // not a third-party licence to judge; what it depends on is. Skipped
  // whole, a sibling would be a door for anything behind it.
  test('walks through a workspace sibling without judging its own licence', () => {
    const root = tree(
      {
        'packages/report-x/package.json': manifest('@formancy/report-x', '0.1.0', 'SEE LICENSE IN LICENSE.md', { dependencies: { '@formancy/report-y': 'workspace:*' } }),
        'packages/report-y/package.json': manifest('@formancy/report-y', '0.1.0', 'SEE LICENSE IN LICENSE.md', { dependencies: { copyleft: '1.0.0' } }),
        'packages/report-y/node_modules/copyleft/package.json': manifest('copyleft', '1.0.0', 'GPL-2.0-only'),
      },
      { 'packages/report-x/node_modules/@formancy/report-y': 'packages/report-y' },
    )
    const siblings = new Set([realpathSync(join(root, 'packages/report-x')), realpathSync(join(root, 'packages/report-y'))])
    expect(problems(closure(join(root, 'packages/report-x'), siblings), {}, {}, {})).toEqual([
      'copyleft@1.0.0 is GPL-2.0-only by its package.json, which the policy refuses (@formancy/report-x > @formancy/report-y > copyleft)',
    ])
  })

  // A sibling is passed over only because it is this repository's own, and
  // it is that only when it says so: a private package -- which
  // verify-licenses.mjs never looks at -- that declares GPL is vendored code
  // under GPL, and a published package that depends on it ships it.
  test("judges a workspace sibling that does not declare this repository's licence", () => {
    const root = tree(
      {
        'packages/report-x/package.json': manifest('@formancy/report-x', '0.1.0', 'SEE LICENSE IN LICENSE.md', { dependencies: { '@formancy/vendored': 'workspace:*' } }),
        'packages/vendored/package.json': manifest('@formancy/vendored', '0.1.0', 'GPL-3.0-only', { private: true }),
      },
      { 'packages/report-x/node_modules/@formancy/vendored': 'packages/vendored' },
    )
    const siblings = new Set([realpathSync(join(root, 'packages/report-x')), realpathSync(join(root, 'packages/vendored'))])
    expect(problems(closure(join(root, 'packages/report-x'), siblings), {}, {}, {})).toEqual([
      '@formancy/vendored@0.1.0 is GPL-3.0-only by its package.json, which the policy refuses (@formancy/report-x > @formancy/vendored)',
    ])
  })

  // A `SEE LICENSE IN` pointer says where the terms are and not what they
  // say, so the walk reads the file it points at and records its digest, for
  // an admission to compare; a file that is not there is recorded as
  // missing, never as a digest of nothing. A licence that is not a pointer
  // has no file to read.
  test('records the digest of the file a SEE LICENSE IN pointer names', () => {
    const terms = 'Formancy Data Source-Available Licence\n'
    const root = tree({
      'app/package.json': manifest('app', '1.0.0', 'MIT', { dependencies: { pointed: '1.0.0', lost: '1.0.0' } }),
      'app/node_modules/pointed/package.json': manifest('pointed', '1.0.0', 'SEE LICENSE IN LICENSE.md'),
      'app/node_modules/pointed/LICENSE.md': terms,
      'app/node_modules/lost/package.json': manifest('lost', '1.0.0', 'SEE LICENSE IN LICENSE.md'),
    })
    const digest = `sha256:${createHash('sha256').update(terms).digest('hex')}`
    expect(closure(join(root, 'app')).map(({ name, licenceFile }) => [name, licenceFile])).toEqual([
      ['app', undefined],
      ['pointed', digest],
      ['lost', null],
    ])
  })

  // Packages that depend on each other, which npm allows, would walk forever.
  test('ends on a cycle', () => {
    const root = tree(
      {
        'node_modules/.pnpm/a@1.0.0/node_modules/a/package.json': manifest('a', '1.0.0', 'MIT', { dependencies: { b: '1.0.0' } }),
        'node_modules/.pnpm/b@1.0.0/node_modules/b/package.json': manifest('b', '1.0.0', 'MIT', { dependencies: { a: '1.0.0' } }),
      },
      {
        'node_modules/.pnpm/a@1.0.0/node_modules/b': 'node_modules/.pnpm/b@1.0.0/node_modules/b',
        'node_modules/.pnpm/b@1.0.0/node_modules/a': 'node_modules/.pnpm/a@1.0.0/node_modules/a',
      },
    )
    expect(closure(join(root, 'node_modules/.pnpm/a@1.0.0/node_modules/a')).map(({ name }) => name)).toEqual(['a', 'b'])
  })
})

describe('fonts', () => {
  // The sentence the OFL asks a font to carry in its name table, and the
  // version beside it, are what a person checks by hand; read wrongly, Roboto
  // would be refused and every engine with it.
  test('reads the licence and version from an OpenType name table', () => {
    expect(fontLicence(font({ 5: 'Version 3.014; 2025', 13: OFL }))).toEqual({ readable: true, version: 'Version 3.014; 2025', description: OFL, licence: 'OFL-1.1' })
    expect(fontLicence(font({ 13: 'Licensed under the Apache License, Version 2.0' })).licence).toBe('Apache-2.0')
  })

  // Liberation Sans 2, the font a QR-bill's slip prints in, says the OFL in
  // a shorter sentence than the one the OFL's FAQ suggests. Unread, the
  // renderer's own fonts would be refused, and every release with them. The
  // version is the sentence's: OFL 1.0, which the policy does not allow,
  // is not 1.1, and neither is a 1.10.
  test("reads Liberation Sans 2's sentence as OFL-1.1, and no other version", () => {
    expect(fontLicence(font({ 13: 'Licensed under the SIL Open Font License, Version 1.1' })).licence).toBe('OFL-1.1')
    expect(fontLicence(font({ 13: 'Licensed under the SIL Open Font License, Version 1.0' })).licence).toBeUndefined()
    expect(fontLicence(font({ 13: 'Licensed under the SIL Open Font License, Version 1.10' })).licence).toBeUndefined()
  })

  // A font is untrusted input. A truncated file, or a format whose tables
  // this does not read, is unreadable -- never a crash, and never a pass. Cut
  // inside its strings, the licence sentence's first words would survive and
  // read as OFL-1.1 if the cut went unnoticed.
  test('calls a font it cannot parse unreadable', () => {
    const whole = font({ 13: OFL })
    expect(fontLicence(whole.subarray(0, whole.length - 10))).toEqual({ readable: false })
    expect(fontLicence(whole.subarray(0, 40))).toEqual({ readable: false })
    expect(fontLicence(Buffer.from('%!PS-AdobeFont-1.0: FoxitSans'))).toEqual({ readable: false })
    expect(fontLicence(Buffer.alloc(0))).toEqual({ readable: false })
  })

  // pdfjs-dist declares Apache-2.0 and ships Liberation Sans 1.07.4 under
  // GPL-2.0 with a font exception, which its package.json does not say. A
  // guard that read package.json alone would pass it; the font's own name
  // table says otherwise, and so does this.
  test('refuses a font whose licence is not one the policy allows, in a package that is', () => {
    const root = tree({
      'app/package.json': manifest('app', '1.0.0', 'Apache-2.0'),
      'app/fonts/Ok-Regular.ttf': font({ 5: 'Version 1.0', 13: OFL }),
      'app/standard_fonts/Liberation-Regular.ttf': font({ 5: 'Version 1.07.4', 13: LIBERATION }),
    })
    const found = closure(join(root, 'app'))
    expect(found[0].fonts.map(({ path, licence }) => ({ path, licence }))).toEqual([
      { path: 'fonts/Ok-Regular.ttf', licence: 'OFL-1.1' },
      { path: 'standard_fonts/Liberation-Regular.ttf', licence: undefined },
    ])
    expect(problems(found, {}, {}, {})).toEqual([`app@1.0.0/standard_fonts/Liberation-Regular.ttf is a font whose name table names no licence the policy allows: "${LIBERATION}" (app)`])
  })

  // A Type 1 font has no name table, and neither does a format this does not
  // decode. It is refused until somebody reads its licence and records it,
  // file by file, at the package's exact version.
  test('refuses a font it cannot read unless an exception names that file', () => {
    const root = tree({
      'app/package.json': manifest('app', '1.0.0', 'Apache-2.0'),
      'app/standard_fonts/FoxitSans.pfb': '%!PS-AdobeFont-1.0',
    })
    const found = closure(join(root, 'app'))
    expect(problems(found, {}, {}, {})).toEqual(['app@1.0.0/standard_fonts/FoxitSans.pfb is a font this guard cannot read a licence from; review it and record an exception (app)'])
    expect(problems(found, { 'app@1.0.0/standard_fonts/FoxitSans.pfb': { licence: 'BSD-3-Clause', evidence: 'standard_fonts/LICENSE_FOXIT' } }, {}, {})).toEqual([])
    // A font's exception is held to the policy as a package's is.
    expect(problems(found, { 'app@1.0.0/standard_fonts/FoxitSans.pfb': { licence: 'GPL-2.0-only', evidence: 'LICENSE_LIBERATION' } }, {}, {})).toEqual([
      'app@1.0.0/standard_fonts/FoxitSans.pfb is GPL-2.0-only by its reviewed exception, which the policy refuses (app)',
    ])
  })

  // A CFF-flavoured OpenType font is read like a TrueType one. A collection,
  // a web font and an embedded OpenType font are formats whose name table
  // this does not reach, and each is refused until somebody reads it.
  test('reads a CFF OpenType font, and refuses a collection, a web font and an EOT', () => {
    const cff = font({ 13: OFL })
    cff.writeUInt32BE(0x4f54544f, 0)
    const root = tree({
      'app/package.json': manifest('app', '1.0.0', 'MIT'),
      'app/fonts/Ok.otf': cff,
      'app/fonts/Family.ttc': Buffer.concat([Buffer.from('ttcf'), font({ 13: OFL })]),
      'app/fonts/Web.woff2': Buffer.concat([Buffer.from('wOF2'), font({ 13: OFL })]),
      'app/fonts/Old.eot': font({ 13: OFL }).subarray(4),
    })
    const found = closure(join(root, 'app'))
    expect(found[0].fonts.map(({ path, licence }) => `${path} ${licence}`)).toEqual(['fonts/Family.ttc undefined', 'fonts/Ok.otf OFL-1.1', 'fonts/Old.eot undefined', 'fonts/Web.woff2 undefined'])
    expect(problems(found, {}, {}, {}).map((problem) => problem.split(' is a font')[0])).toEqual(['app@1.0.0/fonts/Family.ttc', 'app@1.0.0/fonts/Old.eot', 'app@1.0.0/fonts/Web.woff2'])
  })

  // A font is a font whatever it is called. Found by extension alone, the
  // same GPL font shipped as `.font`, `.cff` or with no extension at all
  // would never be read; it is found by its first bytes as well.
  test('finds a font by its first bytes when its name is not a font extension', () => {
    const gpl = font({ 13: LIBERATION })
    const root = tree({
      'app/package.json': manifest('app', '1.0.0', 'MIT'),
      'app/fonts/Gpl-Regular.font': gpl,
      'app/fonts/Gpl-Regular': gpl,
      'app/fonts/Type1.data': Buffer.from('%!PS-AdobeFont-1.0: Foxit'),
      // Text that begins as a TrueType font's tag does, long enough to have
      // a table directory, which does not fit it; and code, which is not
      // opened at all.
      'app/bin/flag': 'true, as the flag says\n',
      'app/lib/index.js': 'module.exports = true\n',
    })
    expect(closure(join(root, 'app'))[0].fonts.map(({ path, readable }) => `${path} ${readable}`)).toEqual(['fonts/Gpl-Regular true', 'fonts/Gpl-Regular.font true', 'fonts/Type1.data false'])
  })

  // A published package's own fonts are what it ships first. Passed over
  // with the package's licence, which is this repository's, a renderer
  // package carrying a GPL font would ship it unread.
  test("judges the fonts a workspace package ships, though not the package's own licence", () => {
    const root = tree({
      'packages/report-x/package.json': manifest('@formancy/report-x', '0.1.0', 'SEE LICENSE IN LICENSE.md'),
      'packages/report-x/fonts/Liberation-Regular.ttf': font({ 13: LIBERATION }),
    })
    const found = closure(join(root, 'packages/report-x'), new Set([realpathSync(join(root, 'packages/report-x'))]))
    expect(problems(found, {}, {}, {})).toEqual([
      `@formancy/report-x@0.1.0/fonts/Liberation-Regular.ttf is a font whose name table names no licence the policy allows: "${LIBERATION}" (@formancy/report-x)`,
    ])
  })
})

describe('ICC profiles', () => {
  // A PDF/A embeds its output intent's ICC profile in every PDF a customer
  // sends (0031), and a profile has no licence a guard could read: its
  // copyright tag names a holder, not terms. So a profile is refused
  // until a review has read its licence and recorded the sentence that
  // grants it, by the digest of the very bytes it read; the same profile
  // is then passed in any package that ships it.
  test('refuses an ICC profile nobody reviewed, naming it and its digest, and passes one the review list holds', () => {
    const icc = profile()
    const root = tree({ 'app/package.json': manifest('app', '1.0.0', 'MIT'), 'app/data/sRGB.icc': icc })
    const found = closure(join(root, 'app'))
    expect(found[0].profiles).toEqual([{ path: 'data/sRGB.icc', digest: digest(icc) }])
    expect(problems(found, {}, {}, {})).toEqual([
      `app@1.0.0/data/sRGB.icc is an ICC profile nobody has reviewed (${digest(icc)}); read its licence and record it in ICC_PROFILES with the sentence that grants it (app)`,
    ])
    expect(problems(found, {}, {}, reviewed(icc))).toEqual([])
  })

  // A review is of bytes: a profile changed by one byte -- another
  // version, another vendor's edit -- is another profile, whose licence
  // nobody read, whatever its name.
  test('refuses a profile one byte off the reviewed one', () => {
    const root = tree({ 'app/package.json': manifest('app', '1.0.0', 'MIT'), 'app/data/sRGB.icc': profile(1) })
    expect(problems(closure(join(root, 'app')), {}, {}, reviewed(profile(0)))).toEqual([
      `app@1.0.0/data/sRGB.icc is an ICC profile nobody has reviewed (${digest(profile(1))}); read its licence and record it in ICC_PROFILES with the sentence that grants it (app)`,
      `reviewed ICC profile ${digest(profile(0))} names nothing a published package installs; remove it`,
    ])
  })

  // A profile is a profile whatever it is called: by the .icc or .icm a
  // colour system names it, or by the signature at byte 36 of its header
  // under any other name. Code and text are not opened, as for fonts, so a
  // profile inside a script is not found, which 0006 says.
  test('finds a profile by its .icc or .icm name, and by its header whatever it is called', () => {
    const root = tree({
      'app/package.json': manifest('app', '1.0.0', 'MIT'),
      'app/a.icc': profile(1),
      'app/b.ICM': profile(2),
      'app/data/colour': profile(3),
      'app/data/profile.bin': profile(4),
      'app/lib/profile.js': profile(5),
      'app/fonts/Ok.ttf': font({ 13: OFL }),
      'app/notes': 'acsp, said where a header would not say it, makes no profile',
    })
    const [app] = closure(join(root, 'app'))
    expect(app.profiles.map(({ path }) => path)).toEqual(['a.icc', 'b.ICM', 'data/colour', 'data/profile.bin'])
    expect(app.fonts.map(({ path }) => path)).toEqual(['fonts/Ok.ttf'])
  })

  // The name alone is enough: a file called a profile whose header is no
  // profile's -- cut short, damaged, or a profile of a version this
  // header test does not know -- is still what a colour system would read
  // as one, and is refused unreviewed rather than passed as no profile.
  test('finds a file called .icc or .icm whose header is no profile’s, and refuses it unreviewed', () => {
    const notAHeader = Buffer.from('a file called a profile, with no acsp where a header has it')
    const root = tree({ 'app/package.json': manifest('app', '1.0.0', 'MIT'), 'app/c.icc': notAHeader, 'app/d.ICM': Buffer.concat([notAHeader, Buffer.from([1])]) })
    const found = closure(join(root, 'app'))
    expect(found[0].profiles.map(({ path }) => path)).toEqual(['c.icc', 'd.ICM'])
    expect(problems(found, {}, {}, {})).toEqual([
      `app@1.0.0/c.icc is an ICC profile nobody has reviewed (${digest(notAHeader)}); read its licence and record it in ICC_PROFILES with the sentence that grants it (app)`,
      `app@1.0.0/d.ICM is an ICC profile nobody has reviewed (${digest(Buffer.concat([notAHeader, Buffer.from([1])]))}); read its licence and record it in ICC_PROFILES with the sentence that grants it (app)`,
    ])
  })

  // A review left behind after its profile left reads as one still in
  // force; and a review that records no licence sentence is no review.
  test('refuses a reviewed profile nothing installs, and a review without its licence sentence', () => {
    expect(problems([], {}, {}, reviewed(profile()))).toEqual([`reviewed ICC profile ${digest(profile())} names nothing a published package installs; remove it`])
    const icc = profile()
    const root = tree({ 'app/package.json': manifest('app', '1.0.0', 'MIT'), 'app/sRGB.icc': icc })
    expect(problems(closure(join(root, 'app')), {}, {}, { [digest(icc)]: { profile: 'a profile', licence: ' ', evidence: 'nowhere' } })).toEqual([
      `reviewed ICC profile ${digest(icc)} records no licence sentence; a review quotes the sentence that grants the profile`,
    ])
  })

  // A published package's own profiles are what it ships first, judged
  // though the package's own licence is passed over, as its fonts are.
  test("judges the profiles a workspace package ships, though not the package's own licence", () => {
    const root = tree({
      'packages/report-x/package.json': manifest('@formancy/report-x', '0.1.0', 'SEE LICENSE IN LICENSE.md'),
      'packages/report-x/profiles/print.icc': profile(7),
    })
    const found = closure(join(root, 'packages/report-x'), new Set([realpathSync(join(root, 'packages/report-x'))]))
    expect(problems(found, {}, {}, {})).toEqual([
      `@formancy/report-x@0.1.0/profiles/print.icc is an ICC profile nobody has reviewed (${digest(profile(7))}); read its licence and record it in ICC_PROFILES with the sentence that grants it (@formancy/report-x)`,
    ])
  })
})

describe('this workspace', () => {
  // The real tree, so the guard is a gate and not an example. A walk that
  // found no publishable package has lost a directory and would pass by
  // checking nothing; report-spec is the one there is today.
  test('passes, and found @formancy/report-spec', () => {
    const { published, entries } = workspaceClosure()
    expect(published).toContain('@formancy/report-spec')
    expect(problems(entries)).toEqual([])
  })

  // The renderer ships fonts of its own, Liberation Sans 2.1.5 for the
  // QR-bill's slip: read from the very files it publishes, at the version
  // their name tables give.
  test("reads report-render-pdf's own Liberation Sans 2.1.5 as OFL-1.1", () => {
    const renderer = workspaceClosure().entries.find((item) => item.name === '@formancy/report-render-pdf')
    expect(renderer.fonts.map(({ path, licence, version }) => ({ path, licence, version }))).toEqual([
      { path: 'fonts/LiberationSans-Bold.ttf', licence: 'OFL-1.1', version: 'Version 2.1.5' },
      { path: 'fonts/LiberationSans-Regular.ttf', licence: 'OFL-1.1', version: 'Version 2.1.5' },
    ])
  })

  // The admissions are read against what pnpm installed: each Data package
  // the provider needs, at the version it pins, with the licence file the
  // review read -- and nothing but the provider reaching it.
  test('admits Formancy Data 0.1.0 for the provider, and reaches it from nothing else', () => {
    const { entries } = workspaceClosure()
    const data = entries.filter((item) => !item.missing && Object.hasOwn(FORMANCY_DATA, `${item.name}@${item.version}`))
    expect(data.map((item) => `${item.name}@${item.version}`).sort()).toEqual(Object.keys(FORMANCY_DATA).sort())
    for (const item of data) {
      expect(item.licenceFile).toBe(FORMANCY_DATA[`${item.name}@${item.version}`].licenceFile)
      expect(item.via[0]).toBe('@formancy/report-data-provider')
    }
  })

  // The one ICC profile the production tree ships is PDFKit's, which an
  // e-invoice's PDF/A embeds (0031): the ICC's sRGB2014, by the digest the
  // renderer's tests pin on the profile both entries embed, admitted by
  // the review list with the ICC's licence. pdfjs-dist's profile is the
  // corpus's and the Studio's, never a published package's.
  test("reads PDFKit's ICC profile as the one in the production tree, the reviewed sRGB2014", () => {
    const { entries } = workspaceClosure()
    const profiles = entries.flatMap((item) => (item.profiles ?? []).map((each) => [`${item.name}@${item.version}/${each.path}`, each.digest]))
    const srgb2014 = 'sha256:384b832de3412066743b52a75ee906b6fb9fb8d9e09e936fc2c43223815c6e0a'
    expect([...new Map(profiles).entries()]).toEqual([['pdfkit@0.19.1/js/data/sRGB_IEC61966_2_1.icc', srgb2014]])
    expect(Object.keys(ICC_PROFILES)).toEqual([srgb2014])
    expect(ICC_PROFILES[srgb2014].licence).toBe(
      'This profile is made available by the International Color Consortium, and may be copied, distributed, embedded, made, used, and sold without restriction. Altered versions of this profile shall have the original identification and copyright information removed and shall not be misrepresented as the original profile.',
    )
  })

  // Watched failing on a profile nobody reviewed: the real tree with the
  // review list emptied refuses PDFKit's profile, and pdfjs-dist's
  // profile, which no review read, is refused as any would be.
  test("refuses PDFKit's profile without its review, and pdfjs-dist's, which nobody reviewed", () => {
    const { entries } = workspaceClosure()
    const unreviewed = problems(entries, EXCEPTIONS, FORMANCY_DATA, {}).filter((problem) => problem.includes('ICC profile'))
    expect(unreviewed).toHaveLength(1)
    expect(unreviewed[0].startsWith('pdfkit@0.19.1/js/data/sRGB_IEC61966_2_1.icc is an ICC profile nobody has reviewed (sha256:384b832de3412066743b52a75ee906b6fb9fb8d9e09e936fc2c43223815c6e0a); ')).toBe(true)
    // The renderer pins PDFKit itself (0036), so the walk reaches it there first.
    expect(unreviewed[0].endsWith(' (@formancy/report-render-pdf > pdfkit)')).toBe(true)
    const corpus = createRequire(join(repo, 'packages', 'report-corpus', 'package.json'))
    const [pdfjs] = closure(dirname(corpus.resolve('pdfjs-dist/package.json')))
    const refused = problems([pdfjs], {}, {}, {}).filter((problem) => problem.includes('ICC profile'))
    expect(refused).toHaveLength(1)
    expect(refused[0].startsWith('pdfjs-dist@6.4.299/iccs/CGATS001Compat-v2-micro.icc is an ICC profile nobody has reviewed (sha256:')).toBe(true)
  })

  // The command CI runs: a problem has to reach the exit code, or the gates
  // step is green whatever the walk found.
  test('the command exits 0 here and 1 on a tree with a GPL dependency, naming it', () => {
    const passed = spawnSync(process.execPath, [script], { encoding: 'utf8' })
    expect(passed.stderr).toBe('')
    expect(passed.status).toBe(0)
    const root = tree({
      'packages/report-x/package.json': manifest('@formancy/report-x', '0.1.0', 'SEE LICENSE IN LICENSE.md', { dependencies: { left: '1.0.0' } }),
      'packages/report-x/node_modules/left/package.json': manifest('left', '1.0.0', 'GPL-3.0-only'),
      'packages/private-x/package.json': manifest('private-x', '0.1.0', undefined, { private: true, dependencies: { right: '1.0.0' } }),
    })
    const failed = spawnSync(process.execPath, [script, root], { encoding: 'utf8' })
    expect(failed.status).toBe(1)
    expect(failed.stderr).toContain('left@1.0.0 is GPL-3.0-only by its package.json, which the policy refuses (@formancy/report-x > left)')
    // A private package publishes nothing, so its dependencies are not walked.
    expect(failed.stderr).not.toContain('right')
  })

  // The walk never follows a devDependency, because no customer installs
  // one. That holds only while no build copies one into what is published:
  // a bundler inlines a package the code imports at run time and the
  // manifest does not declare, so a GPL devDependency would ship inside dist
  // as this repository's own code. Every publishable package's build
  // therefore inlines nothing from node_modules, held by whatever builds it:
  // - tsdown's `deps.onlyBundle: []`, read from each build configuration
  //   itself, entry by entry;
  // - for an Angular package, which ng-packagr builds and which has no such
  //   setting, the bundle's own source map, which names every file the
  //   bundle was made from. That is read from what the build made: in CI,
  //   where the verify job builds first, and locally once there is a build.
  // A package built by neither is refused, so a third bundler cannot arrive
  // unread.
  test("every publishable package's build inlines nothing from node_modules", async () => {
    const { published } = workspaceClosure()
    const packages = readdirSync(join(repo, 'packages')).map((name) => join(repo, 'packages', name))
    const directories = packages.filter((dir) => published.includes(JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')).name))
    expect(directories.length).toBeGreaterThan(0)
    const read = { tsdown: 0, ngPackagr: 0 }
    for (const dir of directories) {
      if (existsSync(join(dir, 'tsdown.config.ts'))) {
        const { default: config } = await import(pathToFileURL(join(dir, 'tsdown.config.ts')).href)
        for (const build of [config].flat()) expect(build.deps?.onlyBundle, dir).toEqual([])
        read.tsdown += 1
        continue
      }
      expect(existsSync(join(dir, 'ng-package.json')), `${dir} is built by neither tsdown nor ng-packagr`).toBe(true)
      const bundles = join(dir, 'dist', 'fesm2022')
      if (!existsSync(bundles) && process.env.CI !== 'true') continue
      const maps = readdirSync(bundles).filter((name) => name.endsWith('.mjs.map'))
      expect(maps.length, dir).toBeGreaterThan(0)
      for (const map of maps) {
        const { sources } = JSON.parse(readFileSync(join(bundles, map), 'utf8'))
        expect(sources.length, map).toBeGreaterThan(0)
        for (const source of sources) expect(join(bundles, source).startsWith(join(dir, 'src')), `${map}: ${source}`).toBe(true)
      }
      read.ngPackagr += 1
    }
    expect(read.tsdown).toBeGreaterThan(0)
  })

  // 0006 names the gates step as what holds the rule before every release as
  // well as on every pull request. Dropped from the verify job, the record
  // would name a gate that is not there.
  test('runs in the verify job of the gates', () => {
    const gates = YAML.parse(readFileSync(join(repo, '.github', 'workflows', 'gates.yml'), 'utf8'))
    expect(gates.jobs.verify.steps.map((step) => step.run)).toContain('node scripts/dependency-licences.mjs')
  })

  // The walk over pnpm's real layout on this machine, not only over fixtures
  // shaped like it: pdfmake as the corpus installs it (0003), the engine the
  // corpus embeds. Today's only refusal in its closure is png-js 1.1.0, which
  // declares no licence and ships an MIT LICENSE; that is the exception the
  // package that publishes pdfmake will need, and no package here does yet.
  // Its Roboto is the font 0006 names, read from the file; PDFKit's ICC
  // profile passes by its review, as in the real tree.
  test('reads pdfmake as the corpus installs it: every dependency found, Roboto 3.014 under OFL-1.1', () => {
    const corpus = createRequire(join(repo, 'packages', 'report-corpus', 'package.json'))
    const found = closure(dirname(corpus.resolve('pdfmake/package.json')))
    expect(found.filter((item) => item.missing)).toEqual([])
    expect(found.map(({ name }) => name)).toEqual(expect.arrayContaining(['pdfmake', 'pdfkit', 'fontkit', 'png-js']))
    expect(problems(found, {}, {}, ICC_PROFILES)).toEqual(['png-js@1.1.0 declares no licence (pdfmake > pdfkit > png-js)'])
    const roboto = found[0].fonts.filter(({ path }) => path.startsWith('fonts/Roboto/'))
    expect(roboto.map(({ path }) => path)).toEqual(['fonts/Roboto/Roboto-Italic.ttf', 'fonts/Roboto/Roboto-Medium.ttf', 'fonts/Roboto/Roboto-MediumItalic.ttf', 'fonts/Roboto/Roboto-Regular.ttf'])
    for (const face of roboto) expect(face, face.path).toMatchObject({ licence: 'OFL-1.1', version: 'Version 3.014; 2025' })
  })

  // The claim 0006 makes about the PDF.js the corpus reads with: its package
  // is Apache-2.0 and its standard fonts are not all what that says.
  test('refuses the standard fonts pdfjs-dist ships beside its Apache-2.0 code', () => {
    const corpus = createRequire(join(repo, 'packages', 'report-corpus', 'package.json'))
    const [pdfjs] = closure(dirname(corpus.resolve('pdfjs-dist/package.json')))
    expect(`${pdfjs.name}@${pdfjs.version} ${pdfjs.licence}`).toBe('pdfjs-dist@6.4.299 Apache-2.0')
    const refused = problems([pdfjs], {}, {}, {}).map((problem) => problem.split(' is a font')[0])
    expect(refused).toContain('pdfjs-dist@6.4.299/standard_fonts/LiberationSans-Regular.ttf')
    expect(refused).toContain('pdfjs-dist@6.4.299/standard_fonts/FoxitSerif.pfb')
  })
})
