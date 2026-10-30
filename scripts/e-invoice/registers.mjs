// The two registers the e-invoice gate rests on (0027, 0031), read and held
// to their shape: docs/release/e-invoice-tools.json, every tool the gate
// downloads, the Java CI runs them on and the oldest veraPDF anything may
// run, and scripts/e-invoice/accepted.json, every warning or notice it
// accepts. What each field means is in each file's `$comment`; what holds
// them is scripts/e-invoice/registers.test.mjs, and the gate, which runs
// nothing the tools register does not name, refuses a download whose bytes
// are not the pin's, and holds the veraPDF inside Mustang to the floor.

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spdxAllows } from '../dependency-licences.mjs'

const repo = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

export const TOOLS = 'docs/release/e-invoice-tools.json'
export const ACCEPTED = 'scripts/e-invoice/accepted.json'

/** A released version and nothing else: no range, no tag, no `latest`. */
const EXACT = /^\d+\.\d+\.\d+$/
/** KoSIT's configurations are released by date. */
const DATED = /^\d{4}-\d{2}-\d{2}$/
const SHA256 = /^[0-9a-f]{64}$/

/**
 * Every tool the gate runs, by id, and the address of its release's asset:
 * the one place a pin's URL is decided. An entry's `url` must be this
 * exactly, so a pin moved to another host, or to another release's file
 * under this one's version, is refused before anything is fetched.
 */
export const ASSETS = {
  mustang: {
    version: EXACT,
    url: (tool) => `https://github.com/ZUGFeRD/mustangproject/releases/download/core-${tool.version}/Mustang-CLI-${tool.version}.jar`,
  },
  kosit: {
    version: EXACT,
    url: (tool) => `https://github.com/itplr-kosit/validator/releases/download/v${tool.version}/validator-${tool.version}-standalone.jar`,
  },
  'xrechnung-configuration': {
    version: DATED,
    url: (tool) =>
      `https://github.com/itplr-kosit/validator-configuration-xrechnung/releases/download/v${tool.version}/xrechnung-${tool.xrechnung}-validator-configuration-${tool.version}.zip`,
  },
  // veraPDF's command line is published to Maven Central with a .sha256
  // beside it; its own site has the installer, with a signature and no hash.
  verapdf: { version: EXACT, url: (tool) => `https://repo1.maven.org/maven2/org/verapdf/apps/cli/${tool.version}/cli-${tool.version}.jar` },
}

/** The tools that are programs, run on a Java; the configuration is KoSIT's input. */
const PROGRAMS = new Set(['mustang', 'kosit', 'verapdf'])

/**
 * The tools that judge each format of the corpus, in the order the gate
 * reports them: the XML the runtime writes by Mustang and KoSIT, a PDF the
 * renderer draws by veraPDF and Mustang (0031). KoSIT reads no PDF, and
 * veraPDF no XML.
 */
export const JUDGES = Object.freeze({ xml: Object.freeze(['mustang', 'kosit']), pdf: Object.freeze(['verapdf', 'mustang']) })

/** The tools whose warnings and notices accepted.json may accept: veraPDF has none, a rule of its profile passing or failing. */
export const ACCEPTING = Object.freeze(['mustang', 'kosit'])

/**
 * Licences the dependency policy refuses, admitted for one tool each, by id
 * and exact version, by the decision that read them, as formancy.ai-health
 * 0009 admits CC-BY-4.0 for the one guide package its validator gate needs. The gate downloads such a tool in CI and runs it
 * as a program of its own, and no package of this product carries it, so
 * its terms are the gate's to meet, not a consumer's; a version moved is a
 * licence to read again. What a consumer installs is held by
 * dependency-licences.mjs, which this does not change.
 *
 * - `verapdf@1.30.3`, veraPDF's command line, "Released under the GNU
 *   General Public License v3 and the Mozilla Public License v2 or later"
 *   (its banner) and, in its POM, "either" of the two (cli-1.30.3.pom on
 *   Maven Central, read on 17 October 2026): the PDF/A validator nobody
 *   publishes under a permissive licence, and the one Mustang bundles (0031).
 */
export const ADMITTED_LICENCES = new Map([['verapdf@1.30.3', 'GPL-3.0-or-later OR MPL-2.0']])

/** Whether a tool's licence is one the policy allows, or the one a decision admits for that tool at that version. */
const licenceAdmitted = (tool) =>
  typeof tool.licence === 'string' && (spdxAllows(tool.licence) || ADMITTED_LICENCES.get(`${String(tool.id)}@${String(tool.version)}`) === tool.licence)

/** Whether `version` is `floor` or later, both exact `major.minor.patch`, compared part by part as numbers; anything else is not. */
export function atLeast(version, floor) {
  if (!EXACT.test(String(version)) || !EXACT.test(String(floor))) return false
  const [a, b] = [version, floor].map((each) => each.split('.').map((part) => Number.parseInt(part, 10)))
  for (let at = 0; at < 3; at += 1) if (a[at] !== b[at]) return a[at] > b[at]
  return true
}

const readJson = (root, file) => JSON.parse(readFileSync(join(root, file), 'utf8'))

/** Both registers, parsed: `{ tools, accepted }`, each the file as written. */
export function readRegisters(root = repo) {
  return { tools: readJson(root, TOOLS), accepted: readJson(root, ACCEPTED) }
}

/** The register's entry for `id`; a tool it does not name throws, since nothing can run without its pin. */
export function toolOf(register, id) {
  const tool = register.tools.find((entry) => entry.id === id)
  if (tool === undefined) throw new Error(`${TOOLS} names no ${id}`)
  return tool
}

/** What is wrong with one tool's entry, as phrases. */
function entryProblems(tool) {
  const asset = ASSETS[tool.id]
  if (asset === undefined) return ['is no tool the gate runs']
  const problems = []
  if (typeof tool.version !== 'string' || !asset.version.test(tool.version)) problems.push('version is not an exact release')
  if (tool.id === 'xrechnung-configuration' && (typeof tool.xrechnung !== 'string' || !EXACT.test(tool.xrechnung)))
    problems.push('xrechnung is not an exact release')
  if (tool.url !== asset.url(tool)) problems.push(`url is not the asset of release ${String(tool.version)} at ${asset.url(tool)}`)
  if (typeof tool.released !== 'string' || !DATED.test(tool.released)) problems.push('released is not a date')
  if (typeof tool.sha256 !== 'string' || !SHA256.test(tool.sha256)) problems.push('sha256 is not 64 lowercase hex digits')
  if (!Number.isSafeInteger(tool.bytes) || tool.bytes <= 0) problems.push('bytes is not a size')
  if (PROGRAMS.has(tool.id)) {
    if (!Number.isSafeInteger(tool.java) || tool.java < 8) problems.push('java is not a Java major version')
  } else if (tool.java !== null) problems.push('java is given, and a configuration is no program')
  if (!licenceAdmitted(tool))
    problems.push('licence is not one scripts/dependency-licences.mjs allows, nor one a decision admits for this tool at this version')
  return problems
}

/** A GitHub security advisory's id. */
const ADVISORY = /^GHSA(-[23456789cfghjmpqrvwx]{4}){3}$/

/**
 * What is wrong with the veraPDF floor, as phrases: the oldest veraPDF the
 * gate runs, as its pin or inside Mustang, its advisories and its reason;
 * and a veraPDF pin below it.
 */
function floorProblems(register) {
  const floor = register.veraPdfFloor
  if (typeof floor !== 'object' || floor === null) return ['veraPdfFloor is not the oldest veraPDF the gate may run']
  const problems = []
  if (!EXACT.test(String(floor.version))) problems.push('veraPdfFloor: version is not an exact release')
  if (!Array.isArray(floor.advisories) || floor.advisories.length === 0 || floor.advisories.some((id) => !ADVISORY.test(String(id))))
    problems.push('veraPdfFloor: advisories is not a list of the GitHub advisories it is for')
  if (typeof floor.why !== 'string' || floor.why.trim() === '') problems.push('veraPdfFloor: gives no reason')
  const pin = register.tools.find((tool) => tool?.id === 'verapdf')
  if (pin !== undefined && EXACT.test(String(floor.version)) && !atLeast(pin.version, floor.version))
    problems.push(`verapdf: version ${String(pin.version)} is below veraPdfFloor's ${floor.version}`)
  return problems
}

/**
 * What is wrong with the tools register, as sentences: a tool missing,
 * twice or unknown, a field missing or malformed, an address that is not
 * its release's asset, a licence the dependency policy refuses and no
 * decision admits, a veraPDF floor that is none or above the pin, and a
 * runtime that is not CI's Java or does not run every JAR.
 */
export function toolProblems(register) {
  const say = (what) => `${TOOLS}: ${what}`
  if (!Array.isArray(register?.tools)) return [say('tools is not a list of tools')]
  const problems = []
  const seen = new Set()
  for (const tool of register.tools) {
    if (seen.has(tool?.id)) problems.push(say(`${String(tool?.id)}: registered twice`))
    seen.add(tool?.id)
    problems.push(...entryProblems(tool ?? {}).map((problem) => say(`${String(tool?.id)}: ${problem}`)))
  }
  for (const id of Object.keys(ASSETS)) if (!seen.has(id)) problems.push(say(`names no ${id}, which the gate runs`))
  problems.push(...floorProblems(register).map(say))
  const runtime = register.runtime
  if (typeof runtime !== 'object' || runtime === null || !Number.isSafeInteger(runtime.java))
    return [...problems, say('runtime is not the Java CI runs the gate on')]
  if (runtime.installedBy !== 'actions/setup-java') problems.push(say('runtime: installedBy is not actions/setup-java'))
  if (typeof runtime.distribution !== 'string' || !/^[a-z]+$/.test(runtime.distribution))
    problems.push(say('runtime: distribution is not the name setup-java knows the JDK by'))
  for (const tool of register.tools) {
    if (PROGRAMS.has(tool?.id) && Number.isSafeInteger(tool.java) && tool.java > runtime.java)
      problems.push(say(`runtime: Java ${String(runtime.java)} does not run ${tool.id}, which needs ${String(tool.java)}`))
  }
  return problems
}

/**
 * What is wrong with the accepted messages, as sentences: an entry for a
 * tool that is not `ACCEPTING`'s, an error (which refuses a file whatever is
 * accepted), one with no file of the corpus or no reason, and one twice.
 * Whether its files are the corpus's, and whether a run raised it, the
 * judges say.
 */
export function acceptedProblems(register) {
  const say = (what) => `${ACCEPTED}: ${what}`
  if (!Array.isArray(register?.accepted)) return [say('accepted is not a list')]
  const problems = []
  const seen = new Set()
  for (const entry of register.accepted) {
    const name = `${String(entry?.tool)} ${String(entry?.message)}`
    if (seen.has(name)) problems.push(say(`${name}: registered twice`))
    seen.add(name)
    if (!ACCEPTING.includes(entry?.tool)) problems.push(say(`${name}: names no tool whose warnings the gate may accept`))
    if (typeof entry?.message !== 'string' || !/^(warning|notice|information) \S/.test(entry.message)) {
      problems.push(
        say(/^error\b/.test(String(entry?.message)) ? `${name}: is an error, which refuses a file whatever is accepted` : `${name}: is no warning or notice`),
      )
    }
    if (!Array.isArray(entry?.files) || entry.files.length === 0 || entry.files.some((file) => typeof file !== 'string'))
      problems.push(say(`${name}: names no file of the corpus it is accepted in`))
    if (typeof entry?.reason !== 'string' || entry.reason.trim() === '') problems.push(say(`${name}: gives no reason it is accepted`))
  }
  return problems
}
