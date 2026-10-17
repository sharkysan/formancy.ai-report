import { describe, expect, test } from 'vitest'
import { acceptedProblems, readRegisters, toolProblems } from './registers.mjs'

/**
 * The two registers the e-invoice gate rests on (0027):
 * docs/release/e-invoice-tools.json, the tools it downloads and the Java
 * it runs them on, and scripts/e-invoice/accepted.json, the warnings and
 * notices it accepts. Held to their shape here; the bytes each pin names
 * are held where they are used, by scripts/e-invoice/cache.mjs refusing a
 * download whose SHA-256 is not the pin's, in the e-invoice job.
 */
const { tools, accepted } = readRegisters()

/** The register as committed, for a case to break one field of. */
const copy = () => structuredClone(tools)
const broken = (change) => {
  const register = copy()
  change(register)
  return toolProblems(register)
}
const mustang = (register) => register.tools.find((tool) => tool.id === 'mustang')

describe('the tools register', () => {
  test('holds', () => {
    expect(toolProblems(tools)).toEqual([])
  })

  // The gate runs exactly what it names: a tool missing is a judge with
  // nothing to run, a tool twice is two hashes for one download, and one
  // the gate does not know is a download nothing runs.
  test('names Mustang, KoSIT and KoSIT’s XRechnung configuration, each once, and nothing else', () => {
    expect(tools.tools.map((tool) => tool.id)).toEqual(['mustang', 'kosit', 'xrechnung-configuration'])
    expect(broken((register) => register.tools.pop())).toEqual(['docs/release/e-invoice-tools.json: names no xrechnung-configuration, which the gate runs'])
    expect(broken((register) => register.tools.push(structuredClone(register.tools[0])))).toEqual(['docs/release/e-invoice-tools.json: mustang: registered twice'])
    expect(broken((register) => register.tools.push({ ...structuredClone(register.tools[1]), id: 'verapdf' }))).toEqual(['docs/release/e-invoice-tools.json: verapdf: is no tool the gate runs'])
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
    expect(broken((register) => (mustang(register).url = 'https://example.org/Mustang-CLI-2.26.0.jar'))).toEqual(['docs/release/e-invoice-tools.json: mustang: url is not the asset of release 2.26.0 at https://github.com/ZUGFeRD/mustangproject/releases/download/core-2.26.0/Mustang-CLI-2.26.0.jar'])
    expect(broken((register) => (mustang(register).sha256 = mustang(register).sha256.toUpperCase()))).toEqual(['docs/release/e-invoice-tools.json: mustang: sha256 is not 64 lowercase hex digits'])
    // The configuration is versioned by its date, and named for the XRechnung it validates.
    expect(broken((register) => (register.tools[2].version = '2026.08.31'))).toContain('docs/release/e-invoice-tools.json: xrechnung-configuration: version is not an exact release')
    expect(broken((register) => (register.tools[2].xrechnung = '3.0'))).toEqual([
      'docs/release/e-invoice-tools.json: xrechnung-configuration: xrechnung is not an exact release',
      'docs/release/e-invoice-tools.json: xrechnung-configuration: url is not the asset of release 2026-08-31 at https://github.com/itplr-kosit/validator-configuration-xrechnung/releases/download/v2026-08-31/xrechnung-3.0-validator-configuration-2026-08-31.zip',
    ])
  })

  // The release date and the size are what a reader checks a pin by; the
  // licence is the tool's own, which runs in CI with every pull request,
  // and must be one the dependency policy allows.
  test('refuses a release date that is not one, a size that is not one, and a licence the policy refuses', () => {
    expect(broken((register) => (mustang(register).released = '25 August 2026'))).toEqual(['docs/release/e-invoice-tools.json: mustang: released is not a date'])
    expect(broken((register) => (mustang(register).bytes = 0))).toEqual(['docs/release/e-invoice-tools.json: mustang: bytes is not a size'])
    expect(broken((register) => (mustang(register).licence = 'GPL-3.0-or-later'))).toEqual(['docs/release/e-invoice-tools.json: mustang: licence is not one scripts/dependency-licences.mjs allows'])
  })

  // A JAR names the oldest Java it runs on, and the gate refuses to run it
  // on an older one; the configuration is no program. CI's Java must run
  // every JAR, or the job fails on a runner nobody can reproduce.
  test('gives every JAR the oldest Java it runs on, the configuration none, and runs them on a Java that runs all', () => {
    expect(broken((register) => (mustang(register).java = '11'))).toEqual(['docs/release/e-invoice-tools.json: mustang: java is not a Java major version'])
    expect(broken((register) => (register.tools[2].java = 11))).toEqual(['docs/release/e-invoice-tools.json: xrechnung-configuration: java is given, and a configuration is no program'])
    expect(broken((register) => (mustang(register).java = 21))).toEqual(['docs/release/e-invoice-tools.json: runtime: Java 17 does not run mustang, which needs 21'])
    expect(broken((register) => (register.runtime.installedBy = 'apt-get'))).toEqual(['docs/release/e-invoice-tools.json: runtime: installedBy is not actions/setup-java'])
    // The distribution is what gates.yml asks setup-java for (scripts/workflows.test.mjs holds the two equal).
    expect(broken((register) => delete register.runtime.distribution)).toEqual(['docs/release/e-invoice-tools.json: runtime: distribution is not the name setup-java knows the JDK by'])
    expect(broken((register) => delete register.runtime)).toEqual(['docs/release/e-invoice-tools.json: runtime is not the Java CI runs the gate on'])
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
    expect(acceptedBroken((register) => (register.accepted[0].reason = ' '))).toEqual([`scripts/e-invoice/accepted.json: ${first.tool} ${first.message}: gives no reason it is accepted`])
    expect(acceptedBroken((register) => (register.accepted[0].files = []))).toEqual([`scripts/e-invoice/accepted.json: ${first.tool} ${first.message}: names no file of the corpus it is accepted in`])
    expect(acceptedBroken((register) => (register.accepted[0].message = 'error 4 BR-CO-14'))).toEqual([`scripts/e-invoice/accepted.json: ${first.tool} error 4 BR-CO-14: is an error, which refuses a file whatever is accepted`])
    expect(acceptedBroken((register) => (register.accepted[0].tool = 'verapdf'))).toEqual([`scripts/e-invoice/accepted.json: verapdf ${first.message}: names no tool the gate judges`])
    expect(acceptedBroken((register) => register.accepted.push(structuredClone(register.accepted[0])))).toEqual([`scripts/e-invoice/accepted.json: ${first.tool} ${first.message}: registered twice`])
    expect(acceptedProblems({})).toEqual(['scripts/e-invoice/accepted.json: accepted is not a list'])
  })
})
