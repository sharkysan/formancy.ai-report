import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, test } from 'vitest'
import { DEFAULT_PORT, readSettings, SETTINGS } from './settings.js'
import type { ServerSettings } from './settings.js'
import { DEFAULT_RATE_LIMIT } from './rate-limit.js'

/**
 * The server's settings, as the composition root reads them once from the
 * environment it is handed (main.ts): every one parsed here, so the rules
 * and every refusal are tested without starting a process. A server that is
 * not configured does not start; it says which setting it needs.
 */
const configured = {
  FORMANCY_REPORT_ISSUER: 'https://host.example',
  FORMANCY_REPORT_AUDIENCE: 'formancy-report',
  FORMANCY_REPORT_IDENTITY_SECRET: 'env:HOST_SECRET',
  FORMANCY_REPORT_ATTRIBUTES: 'tenant=tid',
}

/** The settings `env` reads as, or the test fails with the problems it gave. */
function settings(env: Record<string, string | undefined>): ServerSettings {
  const read = readSettings(env)
  if (!read.ok) throw new Error(read.problems.join('\n'))
  return read.settings
}

/** The problems `env` reads as, or the test fails because it was accepted. */
function problems(env: Record<string, string | undefined>): string[] {
  const read = readSettings(env)
  if (read.ok) throw new Error('the settings were accepted')
  return read.problems
}

describe('readSettings', () => {
  // A server with no issuer, audience, key or tenant claim would accept
  // tokens from nobody, or from everybody; it does not start, and says
  // every setting it needs, each by its name, at once.
  test('refuses an unconfigured server, naming every setting it needs', () => {
    expect(problems({})).toEqual([
      'FORMANCY_REPORT_ISSUER is required: the issuer the host’s tokens name in iss.',
      'FORMANCY_REPORT_AUDIENCE is required: the audience the host’s tokens name in aud.',
      'Set exactly one of FORMANCY_REPORT_IDENTITY_SECRET, FORMANCY_REPORT_IDENTITY_PUBLIC_KEY_FILE and FORMANCY_REPORT_IDENTITY_KEYS_FILE.',
      'FORMANCY_REPORT_ATTRIBUTES is required, as tenant=<claim>: the claim every token names its tenant in (0046).',
    ])
  })

  // What a configured server runs on, every default named: the roles
  // claim data-identity reads by default, nobody in any capacity, Data's
  // rate limit, no proxy and no origin trusted, no audit key, the port.
  test('reads a configured server, with every default', () => {
    expect(settings(configured)).toEqual({
      issuer: 'https://host.example',
      audience: 'formancy-report',
      key: { kind: 'secret', reference: 'env:HOST_SECRET' },
      tenantClaim: 'tid',
      rolesClaim: undefined,
      roles: { author: [], publisher: [], admin: [] },
      rateLimit: DEFAULT_RATE_LIMIT,
      trustedProxies: [],
      origins: [],
      auditKey: undefined,
      port: DEFAULT_PORT,
    })
    expect(DEFAULT_PORT).toBe(4392)
  })

  // Compose hands a variable it was not given to the container as "", and
  // a value of "" is no issuer: an empty setting is an unset one, so it
  // is refused where it is required and is the default where it is not.
  test('reads an empty setting as an unset one', () => {
    expect(problems({ ...configured, FORMANCY_REPORT_ISSUER: '' })).toEqual(['FORMANCY_REPORT_ISSUER is required: the issuer the host’s tokens name in iss.'])
    expect(settings({ ...configured, FORMANCY_REPORT_AUTHOR_ROLES: '', FORMANCY_REPORT_RATE_LIMIT: '', PORT: '' })).toMatchObject({
      roles: { author: [] },
      rateLimit: DEFAULT_RATE_LIMIT,
      port: DEFAULT_PORT,
    })
  })

  // A misspelt setting -- FORMANCY_REPORT_AUTHOR_ROLE for _ROLES -- read as
  // nothing would start a server where nobody authors, and nobody could
  // say why. Every FORMANCY_REPORT_ variable is one this server reads, or
  // it does not start; other variables are the platform's.
  test('refuses a FORMANCY_REPORT_ variable it does not read, and leaves every other variable alone', () => {
    expect(problems({ ...configured, FORMANCY_REPORT_AUTHOR_ROLE: 'report-authors', FORMANCY_REPORT_STORE_DIR: '/var/lib/formancy-report' })).toEqual([
      'FORMANCY_REPORT_AUTHOR_ROLE is not a setting this server reads: its settings are listed in packages/report-server/README.md, and a variable a secret reference names is one outside FORMANCY_REPORT_, such as HOST_SECRET.',
      'FORMANCY_REPORT_STORE_DIR is not a setting this server reads: its settings are listed in packages/report-server/README.md, and a variable a secret reference names is one outside FORMANCY_REPORT_, such as HOST_SECRET.',
    ])
    expect(settings({ ...configured, HOST_SECRET: 'x', PATH: '/usr/bin', NODE_ENV: 'production', FORMANCY_DATA_ISSUER: 'y' }).issuer).toBe(
      'https://host.example',
    )
  })
})

describe('the identity key (formancy.ai-data 0014, 0059)', () => {
  const without = { FORMANCY_REPORT_ISSUER: 'https://host.example', FORMANCY_REPORT_AUDIENCE: 'formancy-report', FORMANCY_REPORT_ATTRIBUTES: 'tenant=tid' }

  // One key, named one way: two would leave which one verifies to the
  // order the code reads them in.
  test('is exactly one of a secret, a public key file and a key set file', () => {
    const exactly = 'Set exactly one of FORMANCY_REPORT_IDENTITY_SECRET, FORMANCY_REPORT_IDENTITY_PUBLIC_KEY_FILE and FORMANCY_REPORT_IDENTITY_KEYS_FILE.'
    expect(
      problems({
        ...without,
        FORMANCY_REPORT_IDENTITY_SECRET: 'env:S',
        FORMANCY_REPORT_IDENTITY_KEYS_FILE: '/run/keys.json',
        FORMANCY_REPORT_IDENTITY_ALGORITHM: 'RS256',
      }),
    ).toEqual([exactly])
    expect(settings({ ...without, FORMANCY_REPORT_IDENTITY_SECRET: 'file:/run/secrets/host' }).key).toEqual({
      kind: 'secret',
      reference: 'file:/run/secrets/host',
    })
  })

  // A public key verifies with the algorithm the operator pins, never the
  // one a token names; HS256 over a PEM's text is the key confusion
  // formancy.ai-data 0014 refuses.
  test('pins a public key file to RS256, ES256 or EdDSA, and never HS256', () => {
    const file = { ...without, FORMANCY_REPORT_IDENTITY_PUBLIC_KEY_FILE: '/run/host.pem' }
    expect(problems(file)).toEqual(['FORMANCY_REPORT_IDENTITY_ALGORITHM is required with FORMANCY_REPORT_IDENTITY_PUBLIC_KEY_FILE: RS256, ES256 or EdDSA.'])
    expect(problems({ ...file, FORMANCY_REPORT_IDENTITY_ALGORITHM: 'HS256' })).toEqual([
      'HS256 is a shared secret: it is FORMANCY_REPORT_IDENTITY_SECRET or a key set, never a public key file.',
    ])
    expect(problems({ ...file, FORMANCY_REPORT_IDENTITY_ALGORITHM: 'none' })).toEqual([
      'FORMANCY_REPORT_IDENTITY_ALGORITHM is RS256, ES256 or EdDSA for a public key file.',
    ])
    expect(settings({ ...file, FORMANCY_REPORT_IDENTITY_ALGORITHM: 'EdDSA' }).key).toEqual({ kind: 'public-key', path: '/run/host.pem', algorithm: 'EdDSA' })
  })

  // A key set is read again on SIGHUP from wherever the process then runs,
  // so its path is absolute, and every key in it verifies the one
  // algorithm the operator pins (formancy.ai-data 0059).
  test('pins a key set file to one algorithm, by an absolute path', () => {
    const set = { ...without, FORMANCY_REPORT_IDENTITY_KEYS_FILE: '/run/identity/keys.json' }
    expect(problems(set)).toEqual([
      'FORMANCY_REPORT_IDENTITY_ALGORITHM is required with FORMANCY_REPORT_IDENTITY_KEYS_FILE: RS256, ES256, EdDSA or HS256, for every key in the set.',
    ])
    expect(problems({ ...set, FORMANCY_REPORT_IDENTITY_ALGORITHM: 'PS256' })).toEqual([
      'FORMANCY_REPORT_IDENTITY_ALGORITHM is RS256, ES256, EdDSA or HS256 for a key set.',
    ])
    expect(problems({ ...set, FORMANCY_REPORT_IDENTITY_KEYS_FILE: 'keys.json', FORMANCY_REPORT_IDENTITY_ALGORITHM: 'RS256' })).toEqual([
      'FORMANCY_REPORT_IDENTITY_KEYS_FILE is an absolute path: the file is read again, on SIGHUP, from wherever the server then runs.',
    ])
    expect(settings({ ...set, FORMANCY_REPORT_IDENTITY_ALGORITHM: 'HS256' }).key).toEqual({
      kind: 'key-set',
      path: '/run/identity/keys.json',
      algorithm: 'HS256',
    })
  })

  // A reference may name any variable, and one of the server's own is no
  // secret: the audience travels in plain text in every token's aud, so a
  // secret read from it is one anybody holding a token has, and the trail's
  // key read from the issuer is one anybody can guess. Every FORMANCY_REPORT_
  // variable is a setting or refused, so a reference to one is a mistake
  // however it is spelt; the sentence says where a secret goes instead.
  test('refuses a secret reference to one of the server’s own settings, or to any FORMANCY_REPORT_ variable', () => {
    for (const setting of ['FORMANCY_REPORT_IDENTITY_SECRET', 'FORMANCY_REPORT_AUDIT_KEY'] as const) {
      for (const target of ['FORMANCY_REPORT_AUDIENCE', 'FORMANCY_REPORT_ISSUER', 'PORT', 'FORMANCY_REPORT_IDENTITY_SECRET_VALUE']) {
        const found = problems({ ...configured, [setting]: `env:${target}` })
        expect(found, `${setting}=env:${target}`).toEqual([
          `${setting} names a variable of this server’s own settings, which holds no secret: put the secret in a variable outside FORMANCY_REPORT_, such as HOST_SECRET, or in a file, and name that.`,
        ])
        for (const problem of found) expect(problem).not.toContain(target === 'PORT' ? 'env:PORT' : target)
      }
    }
    expect(settings({ ...configured, FORMANCY_REPORT_AUDIT_KEY: 'env:AUDIT_KEY' }).auditKey).toBe('env:AUDIT_KEY')
  })

  // An algorithm beside a secret means nothing -- a secret is HS256 -- and
  // set there it says the operator meant another key.
  test('refuses an algorithm beside a secret', () => {
    expect(problems({ ...configured, FORMANCY_REPORT_IDENTITY_ALGORITHM: 'RS256' })).toEqual([
      'FORMANCY_REPORT_IDENTITY_ALGORITHM is for a public key file or a key set; a secret is always HS256.',
    ])
  })

  // A sentence about a setting is printed where the operator's log goes:
  // it names the setting and never repeats a value, which might be the
  // secret pasted where its reference belongs.
  test('never repeats a value in a problem', () => {
    const pasted = 'this-is-the-secret-itself-pasted-by-mistake'
    const found = problems({
      ...configured,
      FORMANCY_REPORT_IDENTITY_KEYS_FILE: pasted,
      FORMANCY_REPORT_IDENTITY_ALGORITHM: pasted,
      FORMANCY_REPORT_RATE_LIMIT: pasted,
      FORMANCY_REPORT_ATTRIBUTES: pasted,
      PORT: pasted,
    })
    expect(found.length).toBeGreaterThan(0)
    for (const problem of found) expect(problem).not.toContain(pasted)
    // A value with an `=` in it -- a key=value secret pasted here -- reads as an attribute named by what stands before it.
    for (const problem of problems({ ...configured, FORMANCY_REPORT_ATTRIBUTES: 'hunter2secret=x' })) expect(problem).not.toContain('hunter2')
  })
})

describe('the tenant and the roles (0046)', () => {
  // The tenant claim is required, and is the only attribute: an attribute
  // the server reads nothing from is a setting that does nothing, and one
  // copied from Data's settings, region=reg, says so here.
  test('maps tenant to its claim, and nothing else', () => {
    expect(settings({ ...configured, FORMANCY_REPORT_ATTRIBUTES: ' tenant = tid ' }).tenantClaim).toBe('tid')
    expect(problems({ ...configured, FORMANCY_REPORT_ATTRIBUTES: 'tenant=tid,region=reg' })).toEqual([
      'FORMANCY_REPORT_ATTRIBUTES maps tenant alone: this server reads no other attribute, and entry 2 names one.',
    ])
    expect(problems({ ...configured, FORMANCY_REPORT_ATTRIBUTES: 'tenant' })).toEqual(['FORMANCY_REPORT_ATTRIBUTES: entry 1 is not attribute=claim.'])
    expect(problems({ ...configured, FORMANCY_REPORT_ATTRIBUTES: 'tenant=tid=x' })).toEqual(['FORMANCY_REPORT_ATTRIBUTES: entry 1 is not attribute=claim.'])
    // Two claims for one tenant: read silently, the last would win, and the
    // operator who added the second would not know which the server reads.
    expect(problems({ ...configured, FORMANCY_REPORT_ATTRIBUTES: 'tenant=tid,tenant=org' })).toEqual([
      'FORMANCY_REPORT_ATTRIBUTES maps tenant once: entry 2 maps it again.',
    ])
    expect(problems({ ...configured, FORMANCY_REPORT_ATTRIBUTES: 'region=reg' })).toEqual([
      'FORMANCY_REPORT_ATTRIBUTES maps tenant alone: this server reads no other attribute, and entry 1 names one.',
      'FORMANCY_REPORT_ATTRIBUTES is required, as tenant=<claim>: the claim every token names its tenant in (0046).',
    ])
  })

  // Who holds each capacity is the operator's: comma-separated roles,
  // spaces around each ignored, each kept once; one role may hold two.
  test('reads the roles each capacity is given', () => {
    const read = settings({
      ...configured,
      FORMANCY_REPORT_AUTHOR_ROLES: 'report-authors, editors,editors',
      FORMANCY_REPORT_PUBLISHER_ROLES: 'editors',
      FORMANCY_REPORT_ADMIN_ROLES: 'report-admins',
      FORMANCY_REPORT_ROLES_CLAIM: 'groups',
    })
    expect(read.roles).toEqual({ author: ['report-authors', 'editors'], publisher: ['editors'], admin: ['report-admins'] })
    expect(read.rolesClaim).toBe('groups')
  })

  // An empty entry is where a role went missing from the list; read as
  // nothing, the role the operator meant would hold nothing, silently.
  test('refuses an empty entry in a list of roles', () => {
    expect(problems({ ...configured, FORMANCY_REPORT_PUBLISHER_ROLES: 'report-publishers,,editors' })).toEqual([
      'FORMANCY_REPORT_PUBLISHER_ROLES: entry 2 is empty, which is where a role written into the list went missing.',
    ])
  })
})

describe('the rest', () => {
  // The rate limit, the proxies and the origins are each refused by their
  // own rule (rate-limit.ts, proxies.ts, cors.ts); here, that the settings
  // read them and name the variable.
  test('reads the rate limit, the trusted proxies and the origins by their rules', () => {
    const read = settings({
      ...configured,
      FORMANCY_REPORT_RATE_LIMIT: '2',
      FORMANCY_REPORT_TRUSTED_PROXIES: '10.0.0.0/8, ::1',
      FORMANCY_REPORT_CORS_ORIGINS: 'https://app.example',
    })
    expect(read.rateLimit).toEqual({ max: 2, timeWindowMs: 60_000 })
    expect(read.trustedProxies).toEqual(['10.0.0.0/8', '::1'])
    expect(read.origins).toEqual(['https://app.example'])
    expect(problems({ ...configured, FORMANCY_REPORT_RATE_LIMIT: 'abc', FORMANCY_REPORT_TRUSTED_PROXIES: '*', FORMANCY_REPORT_CORS_ORIGINS: '*' })).toEqual([
      'FORMANCY_REPORT_RATE_LIMIT is a whole number of requests a minute per client address, at least 1.',
      expect.stringMatching(/^FORMANCY_REPORT_TRUSTED_PROXIES: entry 1 trusts every peer/),
      expect.stringMatching(/^FORMANCY_REPORT_CORS_ORIGINS: entry 1 is a wildcard/),
    ])
  })

  // The audit key is a secret reference, opened where the server is made;
  // the port a number a socket can listen on.
  test('reads the audit key’s reference and the port', () => {
    expect(settings({ ...configured, FORMANCY_REPORT_AUDIT_KEY: 'file:/run/secrets/audit', PORT: '8080' })).toMatchObject({
      auditKey: 'file:/run/secrets/audit',
      port: 8080,
    })
    for (const port of ['0', '65536', '80.5', '-1', ' 80', '0x50'])
      expect(problems({ ...configured, PORT: port }), port).toEqual(['PORT is a whole number from 1 to 65535.'])
  })
})

describe('what the documents say', () => {
  // The README's table of settings is what an operator configures from;
  // one it lacks is a setting nobody finds, and one it lists that the
  // server does not read is refused at start (above).
  test('the README lists every setting the server reads, and no other', () => {
    const readme = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'README.md'), 'utf8')
    const listed = [...readme.matchAll(/^\| `((?:FORMANCY_REPORT_)?[A-Z_]+)` \|/gm)].map((match) => match[1])
    expect(listed).toEqual(Object.keys(SETTINGS))
  })
})
