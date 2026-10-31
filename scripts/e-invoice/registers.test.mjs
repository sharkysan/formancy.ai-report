import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, test } from 'vitest'
import { ACCEPTING, acceptedProblems, ADMITTED_LICENCES, atLeast, JUDGES, readRegisters, toolProblems } from './registers.mjs'

/**
 * The two registers the e-invoice gate rests on (0027, 0031):
 * docs/release/e-invoice-tools.json, the tools it downloads, the Java it
 * runs them on and the oldest veraPDF it may run, and
 * scripts/e-invoice/accepted.json, the warnings and
 * notices it accepts. Held to their shape here; the bytes each pin names
 * are held where they are used, by scripts/e-invoice/cache.mjs refusing a
 * download whose SHA-256 is not the pin's, in the e-invoice job.
 */
const { tools, accepted } = readRegisters()
const repo = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

/** The register as committed, for a case to break one field of. */
const copy = () => structuredClone(tools)
const broken = (change) => {
  const register = copy()
  change(register)
  return toolProblems(register)
}
const mustang = (register) => register.tools.find((tool) => tool.id === 'mustang')
const verapdf = (register) => register.tools.find((tool) => tool.id === 'verapdf')

describe('the tools register', () => {
  test('holds', () => {
    expect(toolProblems(tools)).toEqual([])
  })

  // The gate runs exactly what it names: a tool missing is a judge with
  // nothing to run, a tool twice is two hashes for one download, and one
  // the gate does not know is a download nothing runs.
  test('names Mustang, KoSIT, KoSIT’s XRechnung configuration and veraPDF, each once, and nothing else', () => {
    expect(tools.tools.map((tool) => tool.id)).toEqual(['mustang', 'kosit', 'xrechnung-configuration', 'verapdf'])
    expect(broken((register) => register.tools.pop())).toEqual(['docs/release/e-invoice-tools.json: names no verapdf, which the gate runs'])
    expect(broken((register) => register.tools.push(structuredClone(register.tools[0])))).toEqual([
      'docs/release/e-invoice-tools.json: mustang: registered twice',
    ])
    expect(broken((register) => register.tools.push({ ...structuredClone(register.tools[1]), id: 'saxon' }))).toEqual([
      'docs/release/e-invoice-tools.json: saxon: is no tool the gate runs',
    ])
    expect(toolProblems({})).toEqual(['docs/release/e-invoice-tools.json: tools is not a list of tools'])
  })

  // An inexact version is a tool nobody chose; an address other than the
  // release's asset is a JAR from somewhere else under its name; a hash
  // that is not one checks nothing.
  test('refuses an inexact version, another address and a malformed hash', () => {
    // The address follows the version, so a version changed alone is an address that is not its asset's as well.
    expect(broken((register) => (mustang(register).version = 'latest'))).toEqual([
      'docs/release/e-invoice-tools.json: mustang: version is not an exact release',
      'docs/release/e-invoice-tools.json: mustang: url is not the asset of release latest at https://github.com/ZUGFeRD/mustangproject/releases/download/core-latest/Mustang-CLI-latest.jar',
    ])
    expect(broken((register) => (mustang(register).url = 'https://example.org/Mustang-CLI-2.26.0.jar'))).toEqual([
      'docs/release/e-invoice-tools.json: mustang: url is not the asset of release 2.26.0 at https://github.com/ZUGFeRD/mustangproject/releases/download/core-2.26.0/Mustang-CLI-2.26.0.jar',
    ])
    // veraPDF's is Maven Central's, which publishes a .sha256 beside it; its own site's installer has none.
    expect(broken((register) => (verapdf(register).url = 'https://software.verapdf.org/rel/1.30/verapdf-greenfield-1.30.3-installer.zip'))).toEqual([
      'docs/release/e-invoice-tools.json: verapdf: url is not the asset of release 1.30.3 at https://repo1.maven.org/maven2/org/verapdf/apps/cli/1.30.3/cli-1.30.3.jar',
    ])
    expect(broken((register) => (mustang(register).sha256 = mustang(register).sha256.toUpperCase()))).toEqual([
      'docs/release/e-invoice-tools.json: mustang: sha256 is not 64 lowercase hex digits',
    ])
    // The configuration is versioned by its date, and named for the XRechnung it validates.
    expect(broken((register) => (register.tools[2].version = '2026.08.31'))).toContain(
      'docs/release/e-invoice-tools.json: xrechnung-configuration: version is not an exact release',
    )
    expect(broken((register) => (register.tools[2].xrechnung = '3.0'))).toEqual([
      'docs/release/e-invoice-tools.json: xrechnung-configuration: xrechnung is not an exact release',
      'docs/release/e-invoice-tools.json: xrechnung-configuration: url is not the asset of release 2026-08-31 at https://github.com/itplr-kosit/validator-configuration-xrechnung/releases/download/v2026-08-31/xrechnung-3.0-validator-configuration-2026-08-31.zip',
    ])
  })

  // The release date and the size are what a reader checks a pin by; the
  // licence is the tool's own, which runs in CI with every pull request,
  // and must be one the dependency policy allows.
  test('refuses a release date that is not one, a size that is not one, and a licence the policy refuses', () => {
    expect(broken((register) => (mustang(register).released = '25 August 2026'))).toEqual([
      'docs/release/e-invoice-tools.json: mustang: released is not a date',
    ])
    expect(broken((register) => (mustang(register).bytes = 0))).toEqual(['docs/release/e-invoice-tools.json: mustang: bytes is not a size'])
    expect(broken((register) => (mustang(register).licence = 'GPL-3.0-or-later'))).toEqual([
      'docs/release/e-invoice-tools.json: mustang: licence is not one scripts/dependency-licences.mjs allows, nor one a decision admits for this tool at this version',
    ])
  })

  // veraPDF is GPL or MPL, which the policy refuses for anything a
  // consumer installs; 0031 admits it for the one release it read, as a
  // program the gate runs in CI. Another release, another tool under the
  // same licence, or another licence under veraPDF's name, is a licence
  // nobody read.
  test('admits veraPDF’s GPL-or-MPL for the release a decision read, and for nothing else', () => {
    expect([...ADMITTED_LICENCES]).toEqual([['verapdf@1.30.3', 'GPL-3.0-or-later OR MPL-2.0']])
    expect(verapdf(tools)).toMatchObject({ version: '1.30.3', licence: 'GPL-3.0-or-later OR MPL-2.0' })
    const admission = 'licence is not one scripts/dependency-licences.mjs allows, nor one a decision admits for this tool at this version'
    expect(
      broken((register) =>
        Object.assign(verapdf(register), { version: '1.30.4', url: 'https://repo1.maven.org/maven2/org/verapdf/apps/cli/1.30.4/cli-1.30.4.jar' }),
      ),
    ).toEqual([`docs/release/e-invoice-tools.json: verapdf: ${admission}`])
    expect(broken((register) => (verapdf(register).licence = 'GPL-3.0-or-later'))).toEqual([`docs/release/e-invoice-tools.json: verapdf: ${admission}`])
    expect(broken((register) => (register.tools[1].licence = 'GPL-3.0-or-later OR MPL-2.0'))).toEqual([
      `docs/release/e-invoice-tools.json: kosit: ${admission}`,
    ])
  })

  // veraPDF up to 1.30.1 resolves XML external entities in a PDF's rich
  // text and its XFA (CVE-2026-54078, CVE-2026-54079), and the gate has
  // every PDF it judges parsed by veraPDF twice, as the pin and inside
  // Mustang: the floor holds the pin here, and the gate holds Mustang's
  // copy, read out of its JAR (scripts/e-invoice/verapdf.mjs).
  test('holds veraPDF to a floor, with the advisories it is for and why', () => {
    expect(tools.veraPdfFloor).toMatchObject({ version: '1.30.2', advisories: ['GHSA-3jh7-wm29-q568', 'GHSA-36mm-w85j-3q2j'] })
    expect(broken((register) => (register.veraPdfFloor.version = '1.30.4'))).toEqual([
      "docs/release/e-invoice-tools.json: verapdf: version 1.30.3 is below veraPdfFloor's 1.30.4",
    ])
    expect(broken((register) => (register.veraPdfFloor.version = '1.30'))).toEqual([
      'docs/release/e-invoice-tools.json: veraPdfFloor: version is not an exact release',
    ])
    expect(broken((register) => (register.veraPdfFloor.advisories = ['CVE-2026-54078']))).toEqual([
      'docs/release/e-invoice-tools.json: veraPdfFloor: advisories is not a list of the GitHub advisories it is for',
    ])
    expect(broken((register) => (register.veraPdfFloor.why = ' '))).toEqual(['docs/release/e-invoice-tools.json: veraPdfFloor: gives no reason'])
    expect(broken((register) => delete register.veraPdfFloor)).toEqual([
      'docs/release/e-invoice-tools.json: veraPdfFloor is not the oldest veraPDF the gate may run',
    ])
  })

  // A JAR names the oldest Java it runs on, and the gate refuses to run it
  // on an older one; the configuration is no program. CI's Java must run
  // every JAR, or the job fails on a runner nobody can reproduce.
  test('gives every JAR the oldest Java it runs on, the configuration none, and runs them on a Java that runs all', () => {
    expect(broken((register) => (mustang(register).java = '11'))).toEqual(['docs/release/e-invoice-tools.json: mustang: java is not a Java major version'])
    expect(broken((register) => (register.tools[2].java = 11))).toEqual([
      'docs/release/e-invoice-tools.json: xrechnung-configuration: java is given, and a configuration is no program',
    ])
    expect(broken((register) => (mustang(register).java = 21))).toEqual([
      'docs/release/e-invoice-tools.json: runtime: Java 17 does not run mustang, which needs 21',
    ])
    expect(broken((register) => (register.runtime.installedBy = 'apt-get'))).toEqual([
      'docs/release/e-invoice-tools.json: runtime: installedBy is not actions/setup-java',
    ])
    // The distribution is what gates.yml asks setup-java for (scripts/workflows.test.mjs holds the two equal).
    expect(broken((register) => delete register.runtime.distribution)).toEqual([
      'docs/release/e-invoice-tools.json: runtime: distribution is not the name setup-java knows the JDK by',
    ])
    expect(broken((register) => delete register.runtime)).toEqual(['docs/release/e-invoice-tools.json: runtime is not the Java CI runs the gate on'])
  })

  // What the gate downloads is written into the limitations register, as
  // a number of bytes a release's reader meets: a sum, which a tool moved
  // to a new release makes false while this test, its `heldBy`, would
  // still pass. Every size such a line gives is the register's sizes
  // summed, and there is one.
  test('is as large, in all, as every size the limitations it holds give for the gate’s downloads', () => {
    const total = tools.tools.reduce((sum, tool) => sum + tool.bytes, 0)
    const limitations = JSON.parse(readFileSync(join(repo, 'docs', 'release', 'limitations.json'), 'utf8'))
    const held = Object.values(limitations.records)
      .flatMap((record) => record.limitations ?? [])
      .filter((limitation) => limitation.heldBy === 'scripts/e-invoice/registers.test.mjs')
    const sizes = held.flatMap((limitation) =>
      [...limitation.says.matchAll(/(\d{1,3}(?:,\d{3})+) bytes/g)].map((match) => Number(match[1].replaceAll(',', ''))),
    )
    expect(sizes.length).toBeGreaterThan(0)
    expect(sizes).toEqual(sizes.map(() => total))
  })
})

/** The accepted register as committed, broken one way. */
const acceptedBroken = (change) => {
  const register = structuredClone(accepted)
  change(register)
  return acceptedProblems(register)
}

describe('the accepted messages', () => {
  test('hold', () => {
    expect(acceptedProblems(accepted)).toEqual([])
  })

  // An entry is a tool's message accepted in named files of the corpus, for
  // a reason: one with no reason is a message nobody chose to accept, one
  // in no file is accepted everywhere, and an error is never accepted --
  // it refuses the file whatever anybody writes here.
  test('refuse an entry without a reason or a file, an error, an unknown tool, and one twice', () => {
    const [first] = accepted.accepted
    expect(acceptedBroken((register) => (register.accepted[0].reason = ' '))).toEqual([
      `scripts/e-invoice/accepted.json: ${first.tool} ${first.message}: gives no reason it is accepted`,
    ])
    expect(acceptedBroken((register) => (register.accepted[0].files = []))).toEqual([
      `scripts/e-invoice/accepted.json: ${first.tool} ${first.message}: names no file of the corpus it is accepted in`,
    ])
    expect(acceptedBroken((register) => (register.accepted[0].message = 'error 4 BR-CO-14'))).toEqual([
      `scripts/e-invoice/accepted.json: ${first.tool} error 4 BR-CO-14: is an error, which refuses a file whatever is accepted`,
    ])
    // veraPDF judges, and has no warning to accept: a rule of its profile passes or fails.
    expect(acceptedBroken((register) => (register.accepted[0].tool = 'verapdf'))).toEqual([
      `scripts/e-invoice/accepted.json: verapdf ${first.message}: names no tool whose warnings the gate may accept`,
    ])
    expect(acceptedBroken((register) => register.accepted.push(structuredClone(register.accepted[0])))).toEqual([
      `scripts/e-invoice/accepted.json: ${first.tool} ${first.message}: registered twice`,
    ])
    expect(acceptedProblems({})).toEqual(['scripts/e-invoice/accepted.json: accepted is not a list'])
  })
})

describe('the judges', () => {
  // KoSIT reads XML and veraPDF reads PDF; Mustang reads both. A tool
  // named for a format it does not read would be a verdict nobody made.
  test('are Mustang and KoSIT for the XML, veraPDF and Mustang for a PDF, and only Mustang and KoSIT accept a warning', () => {
    expect(JUDGES).toEqual({ xml: ['mustang', 'kosit'], pdf: ['verapdf', 'mustang'] })
    expect(ACCEPTING).toEqual(['mustang', 'kosit'])
  })
})

describe('atLeast', () => {
  // The floor compares versions part by part as numbers: as text, 1.30.10
  // would sort below 1.30.2.
  test('compares exact versions part by part, and refuses anything else', () => {
    expect([atLeast('1.30.2', '1.30.2'), atLeast('1.30.3', '1.30.2'), atLeast('1.30.10', '1.30.2'), atLeast('2.0.0', '1.30.2')]).toEqual([
      true,
      true,
      true,
      true,
    ])
    expect([atLeast('1.30.1', '1.30.2'), atLeast('1.9.9', '1.30.2'), atLeast('0.31.0', '1.30.2')]).toEqual([false, false, false])
    expect([atLeast('1.30', '1.30.2'), atLeast('1.30.2', 'latest'), atLeast(undefined, '1.30.2')]).toEqual([false, false, false])
  })
})
