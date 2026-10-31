/**
 * The server's settings, as the composition root reads them once from the
 * environment it was started with (main.ts), parsed here so every rule and
 * every refusal is tested without starting a process (settings.test.ts).
 * Nothing else in the package reads configuration: a function here is
 * handed the environment, and never looks it up.
 *
 * The identity settings are Formancy Data's, under Report's prefix
 * (formancy.ai-data 0014, 0059), so one host configures both servers alike.
 * A variable set to the empty string is an unset one, which is what Compose
 * hands a container for a variable it was not given. No sentence repeats a
 * value: the commonest mistake is a secret pasted where its reference goes.
 */
import { isAbsolute } from 'node:path'
import { isKeySetAlgorithm } from '@formancy/data-identity'
import type { KeySetAlgorithm, OneKey } from '@formancy/data-identity'
import type { RolePolicy } from '@formancy/report-server-core'
import { corsOriginsSetting } from './cors.js'
import { trustedProxiesSetting } from './proxies.js'
import { rateLimitSetting } from './rate-limit.js'
import type { RateLimit } from './rate-limit.js'

/**
 * Every setting the server reads, with what it is for. The package README's
 * table lists exactly these (settings.test.ts), and any other variable
 * whose name begins `FORMANCY_REPORT_` stops the server, so a misspelt one
 * is found at start rather than read as nothing.
 */
export const SETTINGS = Object.freeze({
  FORMANCY_REPORT_ISSUER: 'required: the issuer the host’s tokens name in iss',
  FORMANCY_REPORT_AUDIENCE: 'required: the audience the host’s tokens name in aud',
  FORMANCY_REPORT_IDENTITY_SECRET: 'a secret reference, env:NAME or file:/absolute/path, to a shared secret of at least 32 bytes (HS256)',
  FORMANCY_REPORT_IDENTITY_PUBLIC_KEY_FILE: 'or the path of a PEM public key, with FORMANCY_REPORT_IDENTITY_ALGORITHM RS256, ES256 or EdDSA',
  FORMANCY_REPORT_IDENTITY_KEYS_FILE:
    'or the absolute path of a JSON Web Key Set, with FORMANCY_REPORT_IDENTITY_ALGORITHM RS256, ES256, EdDSA or HS256; read again on SIGHUP',
  FORMANCY_REPORT_IDENTITY_ALGORITHM: 'the algorithm a public key file or a key set verifies, pinned',
  FORMANCY_REPORT_ATTRIBUTES: 'required: tenant=<claim>, the claim every token names its tenant in',
  FORMANCY_REPORT_ROLES_CLAIM: 'the claim holding a token’s roles; unset, roles',
  FORMANCY_REPORT_AUTHOR_ROLES: 'comma-separated roles that author; unset, none',
  FORMANCY_REPORT_PUBLISHER_ROLES: 'comma-separated roles that publish; unset, none',
  FORMANCY_REPORT_ADMIN_ROLES: 'comma-separated roles that administer; unset, none',
  FORMANCY_REPORT_RATE_LIMIT: 'requests a minute per client address; unset, 600',
  FORMANCY_REPORT_TRUSTED_PROXIES: 'the proxies whose X-Forwarded-For names the client address, IP addresses and CIDR ranges; unset, none',
  FORMANCY_REPORT_CORS_ORIGINS: 'the origins whose pages may call the API, each exactly as a browser sends Origin; unset, none',
  FORMANCY_REPORT_AUDIT_KEY: 'a secret reference to the key the audit trail names who asked by; unset, nobody is named',
  PORT: 'the port the server listens on; unset, 4392',
})

/**
 * The port, unless the operator says otherwise: beside formancy's 4380 and
 * Formancy Data's 4390, and not the Studio's 4394, so the three servers and
 * the Studio run side by side on one machine. A choice, not a measurement.
 */
export const DEFAULT_PORT = 4392

/** What a public key file verifies: the algorithms data-identity's own OneKey takes for one, so the two cannot differ. */
type PublicKeyAlgorithm = Extract<OneKey, { kind: 'public-key' }>['algorithm']

/** Where the identity key comes from, as the settings name it: opened by serve.ts, never here. */
export type IdentityKeySource =
  | { kind: 'secret'; reference: string }
  | { kind: 'public-key'; path: string; algorithm: PublicKeyAlgorithm }
  | { kind: 'key-set'; path: string; algorithm: KeySetAlgorithm }

export interface ServerSettings {
  issuer: string
  audience: string
  key: IdentityKeySource
  tenantClaim: string
  /** Undefined: data-identity's default, `roles`. */
  rolesClaim: string | undefined
  roles: RolePolicy
  rateLimit: RateLimit
  trustedProxies: string[]
  origins: string[]
  /** A secret reference, resolved by serve.ts; undefined, nobody is named in the trail. */
  auditKey: string | undefined
  port: number
}

export type SettingsReading = { ok: true; settings: ServerSettings } | { ok: false; problems: string[] }

type Environment = Readonly<Record<string, string | undefined>>

const PREFIX = 'FORMANCY_REPORT_'

/**
 * Why a secret `reference` given to `setting` is refused here, or
 * `undefined`: an `env:` reference to a variable of the server's own --
 * one of its settings, or any name under its prefix, which is a setting or
 * stops the server -- holds no secret. The audience travels in every
 * token's `aud`, so a secret read from it is one anybody holding a token
 * has. Every other reference is data-identity's to resolve.
 */
function referenceProblem(setting: keyof typeof SETTINGS, reference: string | undefined): string | undefined {
  if (reference === undefined || !reference.startsWith('env:')) return undefined
  const name = reference.slice('env:'.length)
  if (!name.startsWith(PREFIX) && !Object.hasOwn(SETTINGS, name)) return undefined
  return `${setting} names a variable of this server’s own settings, which holds no secret: put the secret in a variable outside ${PREFIX}, such as HOST_SECRET, or in a file, and name that.`
}

/** Exactly one key, and its algorithm where it has one; `problems` gathers why not. */
function keySource(value: (name: keyof typeof SETTINGS) => string | undefined, problems: string[]): IdentityKeySource | undefined {
  const reference = value('FORMANCY_REPORT_IDENTITY_SECRET')
  const publicKeyFile = value('FORMANCY_REPORT_IDENTITY_PUBLIC_KEY_FILE')
  const keysFile = value('FORMANCY_REPORT_IDENTITY_KEYS_FILE')
  const algorithm = value('FORMANCY_REPORT_IDENTITY_ALGORITHM')
  const refuse = (problem: string) => void problems.push(problem)
  if ([reference, publicKeyFile, keysFile].filter((each) => each !== undefined).length !== 1) {
    return refuse('Set exactly one of FORMANCY_REPORT_IDENTITY_SECRET, FORMANCY_REPORT_IDENTITY_PUBLIC_KEY_FILE and FORMANCY_REPORT_IDENTITY_KEYS_FILE.')
  }
  if (reference !== undefined) {
    if (algorithm !== undefined) return refuse('FORMANCY_REPORT_IDENTITY_ALGORITHM is for a public key file or a key set; a secret is always HS256.')
    const problem = referenceProblem('FORMANCY_REPORT_IDENTITY_SECRET', reference)
    if (problem !== undefined) return refuse(problem)
    return { kind: 'secret', reference }
  }
  if (publicKeyFile !== undefined) {
    if (algorithm === undefined)
      return refuse('FORMANCY_REPORT_IDENTITY_ALGORITHM is required with FORMANCY_REPORT_IDENTITY_PUBLIC_KEY_FILE: RS256, ES256 or EdDSA.')
    // A PEM's text taken as an HMAC secret verifies any token its reader signs with it.
    if (algorithm === 'HS256') return refuse('HS256 is a shared secret: it is FORMANCY_REPORT_IDENTITY_SECRET or a key set, never a public key file.')
    if (algorithm !== 'RS256' && algorithm !== 'ES256' && algorithm !== 'EdDSA')
      return refuse('FORMANCY_REPORT_IDENTITY_ALGORITHM is RS256, ES256 or EdDSA for a public key file.')
    return { kind: 'public-key', path: publicKeyFile, algorithm }
  }
  const path = keysFile as string
  if (algorithm === undefined)
    return refuse(
      'FORMANCY_REPORT_IDENTITY_ALGORITHM is required with FORMANCY_REPORT_IDENTITY_KEYS_FILE: RS256, ES256, EdDSA or HS256, for every key in the set.',
    )
  if (!isKeySetAlgorithm(algorithm)) return refuse('FORMANCY_REPORT_IDENTITY_ALGORITHM is RS256, ES256, EdDSA or HS256 for a key set.')
  if (!isAbsolute(path))
    return refuse('FORMANCY_REPORT_IDENTITY_KEYS_FILE is an absolute path: the file is read again, on SIGHUP, from wherever the server then runs.')
  return { kind: 'key-set', path, algorithm }
}

/** The tenant's claim from `tenant=<claim>`, the one attribute; `problems` gathers why not. */
function tenantClaim(text: string | undefined, problems: string[]): string | undefined {
  let claim: string | undefined
  for (const [index, pair] of (text ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry !== '')
    .entries()) {
    const [attribute, mapped, extra] = pair.split('=').map((part) => part.trim())
    if (attribute === undefined || mapped === undefined || extra !== undefined || attribute === '' || mapped === '') {
      problems.push(`FORMANCY_REPORT_ATTRIBUTES: entry ${String(index + 1)} is not attribute=claim.`)
      return undefined
    }
    // An attribute the server reads nothing from is a setting that does nothing; Data's region=reg copied here says so.
    // Named by its place, never quoted: a secret pasted here with base64's `=` would be an attribute.
    if (attribute !== 'tenant')
      problems.push(`FORMANCY_REPORT_ATTRIBUTES maps tenant alone: this server reads no other attribute, and entry ${String(index + 1)} names one.`)
    else if (claim !== undefined) {
      // Read silently, the last would win, and the operator who wrote the second would not know which the server reads.
      problems.push(`FORMANCY_REPORT_ATTRIBUTES maps tenant once: entry ${String(index + 1)} maps it again.`)
      return undefined
    } else claim = mapped
  }
  if (claim === undefined) problems.push('FORMANCY_REPORT_ATTRIBUTES is required, as tenant=<claim>: the claim every token names its tenant in (0046).')
  return claim
}

/** A comma-separated list of roles: space around each ignored, each kept once, an empty entry refused. */
function roleList(name: keyof typeof SETTINGS, text: string | undefined, problems: string[]): string[] {
  if (text === undefined) return []
  const entries = text.split(',').map((entry) => entry.trim())
  const empty = entries.findIndex((entry) => entry === '')
  if (empty !== -1) {
    problems.push(`${name}: entry ${String(empty + 1)} is empty, which is where a role written into the list went missing.`)
    return []
  }
  return [...new Set(entries)]
}

/** Every setting the server runs on, from `env`, or every reason it does not start. */
export function readSettings(env: Environment): SettingsReading {
  const problems: string[] = []
  const value = (name: keyof typeof SETTINGS): string | undefined => {
    const given = env[name]
    return given === undefined || given === '' ? undefined : given
  }

  const issuer = value('FORMANCY_REPORT_ISSUER')
  if (issuer === undefined) problems.push('FORMANCY_REPORT_ISSUER is required: the issuer the host’s tokens name in iss.')
  const audience = value('FORMANCY_REPORT_AUDIENCE')
  if (audience === undefined) problems.push('FORMANCY_REPORT_AUDIENCE is required: the audience the host’s tokens name in aud.')
  const key = keySource(value, problems)
  const tenant = tenantClaim(value('FORMANCY_REPORT_ATTRIBUTES'), problems)
  const roles = {
    author: roleList('FORMANCY_REPORT_AUTHOR_ROLES', value('FORMANCY_REPORT_AUTHOR_ROLES'), problems),
    publisher: roleList('FORMANCY_REPORT_PUBLISHER_ROLES', value('FORMANCY_REPORT_PUBLISHER_ROLES'), problems),
    admin: roleList('FORMANCY_REPORT_ADMIN_ROLES', value('FORMANCY_REPORT_ADMIN_ROLES'), problems),
  }

  const limit = rateLimitSetting(value('FORMANCY_REPORT_RATE_LIMIT'))
  if (!limit.ok) problems.push(limit.problem)
  const proxies = trustedProxiesSetting(value('FORMANCY_REPORT_TRUSTED_PROXIES'))
  if (!proxies.ok) problems.push(proxies.problem)
  const origins = corsOriginsSetting(value('FORMANCY_REPORT_CORS_ORIGINS'))
  if (!origins.ok) problems.push(origins.problem)

  const auditKey = value('FORMANCY_REPORT_AUDIT_KEY')
  const auditReference = referenceProblem('FORMANCY_REPORT_AUDIT_KEY', auditKey)
  if (auditReference !== undefined) problems.push(auditReference)

  const portText = value('PORT')
  const port = portText === undefined ? DEFAULT_PORT : /^[1-9][0-9]{0,4}$/.test(portText) ? Number(portText) : Number.NaN
  if (!(port >= 1 && port <= 65_535)) problems.push('PORT is a whole number from 1 to 65535.')

  for (const name of Object.keys(env).sort()) {
    if (name.startsWith(PREFIX) && !Object.hasOwn(SETTINGS, name)) {
      problems.push(
        `${name} is not a setting this server reads: its settings are listed in packages/report-server/README.md, and a variable a secret reference names is one outside ${PREFIX}, such as HOST_SECRET.`,
      )
    }
  }

  if (
    problems.length > 0 ||
    issuer === undefined ||
    audience === undefined ||
    key === undefined ||
    tenant === undefined ||
    !limit.ok ||
    !proxies.ok ||
    !origins.ok
  )
    return { ok: false, problems }
  return {
    ok: true,
    settings: {
      issuer,
      audience,
      key,
      tenantClaim: tenant,
      rolesClaim: value('FORMANCY_REPORT_ROLES_CLAIM'),
      roles,
      rateLimit: limit.rateLimit,
      trustedProxies: proxies.trustedProxies,
      origins: origins.origins,
      auditKey,
      port,
    },
  }
}
