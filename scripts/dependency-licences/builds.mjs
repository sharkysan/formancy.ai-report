// Native builds, read by the SBOM each ships (0089, extending 0006): which
// package of a family the review read a walked package is, what is wrong
// with one -- or with any package that ships a native addon no review read
// -- and what is wrong with the builds the lockfile names, every
// platform's, which no machine installs all of. dependency-licences.mjs
// runs these with its own tables and its own judge of an SPDX expression,
// `allows`, handed in, so that this module decides no licence of its own.

/** The admission in `builds` whose family `name` is one of, the family itself or one of its builds, `family-…`: [family, admission], or undefined. */
function familyOf(name, builds) {
  return Object.entries(builds).find(([family]) => name === family || name.startsWith(`${family}-`))
}

/** A component's place and licence as a review records it: `name@version`, and its licence or null. */
const componentKey = ({ name, version }) => (version === undefined ? name : `${name}@${version}`)

/**
 * The components of `sbom`, a build's of `name@version`, whose licence the
 * policy refuses or that state none, by `componentKey`, sorted: what a
 * review records of the build. The build's own file, which the SBOM lists
 * under the build's own purl, is the package's, judged by its manifest.
 */
export function beyondPolicy(sbom, name, version, allows) {
  const own = `pkg:npm/${name.replace(/^@/, '%40')}@${version}`
  return Object.fromEntries(
    (sbom.components ?? [])
      .filter((component) => !String(component.purl ?? '').startsWith(own))
      .filter((component) => component.licence === undefined || !allows(component.licence))
      .map((component) => [componentKey(component), component.licence ?? null])
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
  )
}

/**
 * What is wrong with a package of a family `builds` admits, or with one
 * that ships a native addon no admission names: [] where neither, or where
 * it is the family's version, reached through the package admitted for,
 * depended on by exactly what the review saw -- the family by
 * `dependents`, a build by its family -- and, for a build, one the review
 * read, by its SBOM's digest and the components beyond the policy that SBOM
 * lists. Every dependent, not the first route the walk found: a package
 * that depends on the family itself would hide behind a route through the
 * package admitted for, as `confinement` says of a confined one.
 */
export function buildProblems(item, id, route, builds, allows) {
  const family = familyOf(item.name, builds)
  if (family === undefined) {
    return (item.natives ?? []).length === 0
      ? []
      : [`${id} ships a native addon, ${item.natives.join(', ')}, whose build no review read: read its SBOM and record it in BUILDS_READ (${route})`]
  }
  const [name, admitted] = family
  if (item.version !== admitted.version) return [`${id} is a version of ${name}, which a review read at ${admitted.version} alone (${route})`]
  const found = []
  if (!item.via.includes(admitted.for)) found.push(`${id} is admitted for ${admitted.for} alone, and is reached otherwise (${route})`)
  const dependents = [...(item.dependents ?? [item.via.at(-1)])].sort()
  const saw = [...(item.name === name ? admitted.dependents : [name])].sort()
  if (JSON.stringify(dependents) !== JSON.stringify(saw))
    found.push(`${id} is depended on by ${dependents.join(' and ')}, where the review saw ${saw.join(' and ')} alone (${route})`)
  if (item.name === name) return found
  const read = admitted.builds[item.name]
  if (read === undefined) return [...found, `${id} is a build of ${name} no review read (${route})`]
  if (item.sbom?.sha256 !== read.sbom)
    return [...found, `${id}'s sbom.cdx.json is ${item.sbom?.sha256 ?? 'missing'}, not the SBOM the review read (${read.sbom}) (${route})`]
  const beyond = beyondPolicy(item.sbom, item.name, item.version, allows)
  if (JSON.stringify(beyond) !== JSON.stringify(admitted.beyondPolicy))
    found.push(`${id}'s SBOM lists ${JSON.stringify(beyond)} beyond the policy, not what the review recorded (${route})`)
  return found
}

/**
 * What is wrong with `lockfile`, pnpm-lock.yaml's text, against `builds`:
 * every package of an admitted family it names, at any version and on any
 * platform, must be one the review read -- the family's version, a build
 * it names, and the tarball it read, by the integrity pnpm records and
 * installs by, so that a build's binary is held with its SBOM -- and every
 * build a review read must be one the lockfile names, so the table holds
 * no more than it installs. A machine installs its own platform's build
 * alone, so the lockfile is what says the rest.
 */
export function lockfileProblems(lockfile, builds) {
  const named = new Set()
  for (const [, name, version] of lockfile.matchAll(/^ {2}'?((?:@[^@\s'/]+\/)?[^@\s'/]+)@([^'\s:(]+)/gm)) named.add(`${name}@${version}`)
  const integrity = new Map()
  for (const [, name, version, of] of lockfile.matchAll(/^ {2}'?((?:@[^@\s'/]+\/)?[^@\s'/]+)@([^'\s:(]+)'?:\n {4}resolution: \{integrity: ([^,}\s]+)/gm))
    integrity.set(`${name}@${version}`, of)
  const found = []
  for (const [family, admitted] of Object.entries(builds)) {
    const members = [...named].filter((key) => {
      const name = key.slice(0, key.lastIndexOf('@'))
      return name === family || name.startsWith(`${family}-`)
    })
    for (const key of members.sort()) {
      const name = key.slice(0, key.lastIndexOf('@'))
      const version = key.slice(key.lastIndexOf('@') + 1)
      if (version !== admitted.version) found.push(`pnpm-lock.yaml names ${key}, a version of ${family} no review read, at ${admitted.version} alone`)
      else if (name !== family && !Object.hasOwn(admitted.builds, name)) found.push(`pnpm-lock.yaml names ${key}, a build of ${family} no review read`)
      else {
        const read = name === family ? admitted.integrity : admitted.builds[name].integrity
        const installed = integrity.get(key)
        if (installed !== read) found.push(`pnpm-lock.yaml installs ${key} as ${installed ?? 'no integrity'}, not the tarball the review read (${read})`)
      }
    }
    for (const name of Object.keys(admitted.builds)) {
      if (!named.has(`${name}@${admitted.version}`)) found.push(`build ${name}@${admitted.version} names nothing pnpm-lock.yaml installs; remove it`)
    }
  }
  return found
}
