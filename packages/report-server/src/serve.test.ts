import { randomBytes } from 'node:crypto'
import { EventEmitter } from 'node:events'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { FastifyInstance } from 'fastify'
import { SignJWT } from 'jose'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { openReportServer, readAgainOnSignal } from './serve.js'
import { readSettings } from './settings.js'
import type { ServerSettings } from './settings.js'

/**
 * From settings to a server (serve.ts): the identity key and the audit key
 * opened through the source the composition root hands over, every refusal
 * one sentence and never an exception, and the key set read again on
 * SIGHUP (formancy.ai-data 0059). Every secret here is this test's own.
 */
const SECRET = 'a-throwaway-test-secret-of-at-least-32-bytes'
const base = { FORMANCY_REPORT_ISSUER: 'https://host.example', FORMANCY_REPORT_AUDIENCE: 'formancy-report', FORMANCY_REPORT_ATTRIBUTES: 'tenant=tid', FORMANCY_REPORT_AUTHOR_ROLES: 'report-authors' }

const settingsOf = (env: Record<string, string>): ServerSettings => {
  const read = readSettings(env)
  if (!read.ok) throw new Error(read.problems.join('\n'))
  return read.settings
}

/** A secret source over `env` and `files`, as main.ts hands process.env and readFile over. */
const source = (env: Record<string, string>, files: Record<string, string> = {}) => ({
  env,
  readFile: async (path: string) => {
    if (!Object.hasOwn(files, path)) throw new Error(`ENOENT: no such file or directory, open '${path}'`)
    return files[path] as string
  },
})

const sign = (key: Uint8Array, header: { alg: string; kid?: string } = { alg: 'HS256' }) =>
  new SignJWT({ tid: 'acme', roles: ['report-authors'] }).setProtectedHeader(header).setIssuer('https://host.example').setAudience('formancy-report').setSubject('u-1').setExpirationTime('5m').sign(key)

let opened: FastifyInstance[]
let lines: string[]
let directory: string
beforeEach(async () => {
  opened = []
  lines = []
  directory = await mkdtemp(join(tmpdir(), 'formancy-report-serve-'))
})
afterEach(async () => {
  for (const app of opened) await app.close()
  await rm(directory, { recursive: true, force: true })
})
const logger = { stream: { write: (line: string) => void lines.push(line) } }

async function open(settings: ServerSettings, io: ReturnType<typeof source>) {
  const result = await openReportServer(settings, io, logger)
  if (result.ok) opened.push(result.app)
  return result
}

const whoami = (app: FastifyInstance, token: string) => app.inject({ method: 'GET', url: '/v1/whoami', headers: { authorization: `Bearer ${token}` } })

describe('openReportServer', () => {
  // The secret is named by a reference and read through the source main.ts
  // hands over, so the package itself never looks at process.env.
  test('serves with a secret read through its reference, the tenant from the mapped claim', async () => {
    for (const [env, io] of [
      [{ ...base, FORMANCY_REPORT_IDENTITY_SECRET: 'env:HOST_SECRET' }, source({ HOST_SECRET: SECRET })],
      [{ ...base, FORMANCY_REPORT_IDENTITY_SECRET: 'file:/run/secrets/host' }, source({}, { '/run/secrets/host': `${SECRET}\n` })],
    ] as const) {
      const result = await open(settingsOf(env), io)
      if (!result.ok) throw new Error(result.problem)
      const answer = await whoami(result.app, await sign(new TextEncoder().encode(SECRET)))
      expect(answer.statusCode).toBe(200)
      expect(answer.json()).toMatchObject({ tenant: 'acme', capacities: ['author'] })
    }
  })

  // A host whose identity provider lists roles in another claim names it,
  // and the verifier reads that claim and no other. Read from the settings
  // and not handed on, the verifier read `roles`: every person held no
  // capacity, and only a person asking whoami would see it.
  test('reads a token’s roles from the claim FORMANCY_REPORT_ROLES_CLAIM names', async () => {
    const result = await open(settingsOf({ ...base, FORMANCY_REPORT_IDENTITY_SECRET: 'env:HOST_SECRET', FORMANCY_REPORT_ROLES_CLAIM: 'groups' }), source({ HOST_SECRET: SECRET }))
    if (!result.ok) throw new Error(result.problem)
    const signedWith = (claims: Record<string, unknown>) =>
      new SignJWT({ tid: 'acme', ...claims }).setProtectedHeader({ alg: 'HS256' }).setIssuer('https://host.example').setAudience('formancy-report').setSubject('u-1').setExpirationTime('5m').sign(new TextEncoder().encode(SECRET))
    const grouped = await whoami(result.app, await signedWith({ groups: ['report-authors'] }))
    expect(grouped.json()).toMatchObject({ roles: ['report-authors'], capacities: ['author'] })
    const inRoles = await whoami(result.app, await signedWith({ roles: ['report-authors'] }))
    expect(inRoles.json()).toMatchObject({ roles: [], capacities: [] })
  })

  // Every refusal of the key at start is one sentence main.ts prints
  // before it exits, never a stack trace, and none repeats the secret, the
  // reference's target or the file's text.
  test('says in one sentence why a key does not open, repeating nothing of it', async () => {
    const cases = [
      [{ ...base, FORMANCY_REPORT_IDENTITY_SECRET: 'env:HOST_SECRET' }, source({}), /HOST_SECRET/],
      [{ ...base, FORMANCY_REPORT_IDENTITY_SECRET: 'env:HOST_SECRET' }, source({ HOST_SECRET: 'too-short-to-trust' }), /at least 32 bytes/],
      [{ ...base, FORMANCY_REPORT_IDENTITY_SECRET: 'not-a-reference-but-the-secret-itself-pasted' }, source({}), /env:NAME or file:/],
      [{ ...base, FORMANCY_REPORT_IDENTITY_PUBLIC_KEY_FILE: '/run/host.pem', FORMANCY_REPORT_IDENTITY_ALGORITHM: 'ES256' }, source({}), /^FORMANCY_REPORT_IDENTITY_PUBLIC_KEY_FILE cannot be read\.$/],
      [{ ...base, FORMANCY_REPORT_IDENTITY_PUBLIC_KEY_FILE: '/run/host.pem', FORMANCY_REPORT_IDENTITY_ALGORITHM: 'ES256' }, source({}, { '/run/host.pem': 'not a pem at all' }), /./],
      [{ ...base, FORMANCY_REPORT_IDENTITY_KEYS_FILE: join(directory, 'missing.json'), FORMANCY_REPORT_IDENTITY_ALGORITHM: 'HS256' }, source({}), /./],
    ] as const
    for (const [env, io, says] of cases) {
      const result = await open(settingsOf(env), io)
      expect(result.ok).toBe(false)
      if (result.ok) continue
      expect(result.problem).toMatch(says)
      for (const leaked of ['too-short-to-trust', 'not-a-reference-but-the-secret-itself-pasted', 'not a pem at all', '/run/host.pem']) expect(result.problem).not.toContain(leaked)
    }
  })

  // The audit key names who asked in the trail (0046); the trail is the
  // server's own log, one line per event, and holds no claim's value.
  test('audits into its log, naming who by the audit key it opened', async () => {
    const env = { ...base, FORMANCY_REPORT_IDENTITY_SECRET: 'env:HOST_SECRET', FORMANCY_REPORT_AUDIT_KEY: 'env:AUDIT_KEY' }
    const result = await open(settingsOf(env), source({ HOST_SECRET: SECRET, AUDIT_KEY: 'an-audit-key-for-this-test-only-of-40-bytes' }))
    if (!result.ok) throw new Error(result.problem)
    await whoami(result.app, await sign(new TextEncoder().encode(SECRET)))
    const audited = lines.map((line) => JSON.parse(line) as { msg: string; audit?: { tenant: string | null } }).filter((line) => line.msg === 'audit')
    expect(audited).toHaveLength(1)
    expect(audited[0]?.audit?.tenant).toMatch(/^[0-9a-f]{32}$/)
    expect(lines.join('')).not.toContain('acme')
    expect(lines.join('')).not.toContain('u-1')
    const missing = await open(settingsOf(env), source({ HOST_SECRET: SECRET }))
    expect(missing.ok).toBe(false)
  })
})

describe('the audit key (0046)', () => {
  const AUDIT = 'an-audit-key-for-this-test-only-of-40-bytes'
  const opening = async (env: Record<string, string>, io: ReturnType<typeof source>) => {
    const result = await open(settingsOf(env), io)
    return result.ok ? 'opened' : result.problem
  }

  // The key is all that keeps the trail's references from being reversed:
  // with one of a byte, whoever reads the log tries all 256 against one
  // tenant they know, and has every reference. The floor is the 32 bytes
  // data-identity holds a shared secret to.
  test('is at least 32 bytes', async () => {
    const env = { ...base, FORMANCY_REPORT_IDENTITY_SECRET: 'env:HOST_SECRET', FORMANCY_REPORT_AUDIT_KEY: 'env:AUDIT_KEY' }
    const short = await opening(env, source({ HOST_SECRET: SECRET, AUDIT_KEY: 'k'.repeat(31) }))
    expect(short).toBe('FORMANCY_REPORT_AUDIT_KEY is at least 32 bytes: the trail names who asked by it, and a shorter key is found by trying keys against one tenant the reader knows.')
    expect(await opening(env, source({ HOST_SECRET: SECRET, AUDIT_KEY: 'k'.repeat(32) }))).toBe('opened')
  })

  // A key the identity already uses would make whoever is handed the audit
  // key, to check the trail, a signer of tokens; and a public key's text is
  // no secret at all. However it is reached -- the same reference, another
  // one to the same text, a key of the set -- it is refused, and the
  // sentence says nothing of the key.
  test('is not the identity key, however it is reached', async () => {
    const pem = (await import('node:crypto')).generateKeyPairSync('ec', { namedCurve: 'P-256' }).publicKey.export({ type: 'spki', format: 'pem' }).toString()
    const setKey = 'a-shared-secret-of-a-key-set-of-at-least-32-bytes'
    const keysFile = join(directory, 'keys.json')
    await writeFile(keysFile, JSON.stringify({ keys: [{ kty: 'oct', kid: 'k1', alg: 'HS256', k: Buffer.from(randomBytes(32)).toString('base64url') }, { kty: 'oct', kid: 'k2', alg: 'HS256', k: Buffer.from(setKey, 'utf8').toString('base64url') }] }))
    const cases = [
      [{ ...base, FORMANCY_REPORT_IDENTITY_SECRET: 'env:HOST_SECRET', FORMANCY_REPORT_AUDIT_KEY: 'env:HOST_SECRET' }, source({ HOST_SECRET: SECRET })],
      [{ ...base, FORMANCY_REPORT_IDENTITY_SECRET: 'file:/run/secrets/host', FORMANCY_REPORT_AUDIT_KEY: 'file:/run/secrets/host' }, source({}, { '/run/secrets/host': `${SECRET}\n` })],
      [{ ...base, FORMANCY_REPORT_IDENTITY_SECRET: 'env:HOST_SECRET', FORMANCY_REPORT_AUDIT_KEY: 'env:AUDIT_KEY' }, source({ HOST_SECRET: SECRET, AUDIT_KEY: SECRET })],
      [{ ...base, FORMANCY_REPORT_IDENTITY_PUBLIC_KEY_FILE: '/run/host.pem', FORMANCY_REPORT_IDENTITY_ALGORITHM: 'ES256', FORMANCY_REPORT_AUDIT_KEY: 'file:/run/host.pem' }, source({}, { '/run/host.pem': pem })],
      [{ ...base, FORMANCY_REPORT_IDENTITY_KEYS_FILE: keysFile, FORMANCY_REPORT_IDENTITY_ALGORITHM: 'HS256', FORMANCY_REPORT_AUDIT_KEY: 'env:AUDIT_KEY' }, source({ AUDIT_KEY: setKey })],
    ] as const
    for (const [env, io] of cases) {
      const problem = await opening(env, io)
      expect(problem, env.FORMANCY_REPORT_AUDIT_KEY).toBe('FORMANCY_REPORT_AUDIT_KEY is the identity key: a secret one would let whoever is given the audit key to read the trail sign tokens, and a public one is no secret. Give the trail a key of its own.')
      for (const leaked of [SECRET, setKey, 'BEGIN PUBLIC KEY']) expect(problem).not.toContain(leaked)
    }
    // A key of its own, beside each kind of identity key, a set of public
    // keys among them, which holds no secret to compare, opens.
    const publicSet = join(directory, 'public-keys.json')
    const jwk = (await import('node:crypto')).generateKeyPairSync('ec', { namedCurve: 'P-256' }).publicKey.export({ format: 'jwk' })
    await writeFile(publicSet, JSON.stringify({ keys: [{ ...jwk, kid: 'p1', alg: 'ES256' }] }))
    for (const env of [
      { ...base, FORMANCY_REPORT_IDENTITY_PUBLIC_KEY_FILE: '/run/host.pem', FORMANCY_REPORT_IDENTITY_ALGORITHM: 'ES256', FORMANCY_REPORT_AUDIT_KEY: 'env:AUDIT_KEY' },
      { ...base, FORMANCY_REPORT_IDENTITY_KEYS_FILE: keysFile, FORMANCY_REPORT_IDENTITY_ALGORITHM: 'HS256', FORMANCY_REPORT_AUDIT_KEY: 'env:AUDIT_KEY' },
      { ...base, FORMANCY_REPORT_IDENTITY_KEYS_FILE: publicSet, FORMANCY_REPORT_IDENTITY_ALGORITHM: 'ES256', FORMANCY_REPORT_AUDIT_KEY: 'env:AUDIT_KEY' },
    ]) {
      expect(await opening(env, source({ AUDIT_KEY: AUDIT }, { '/run/host.pem': pem }))).toBe('opened')
    }
  })
})

describe('a key set file (formancy.ai-data 0059)', () => {
  const jwks = (keys: Record<string, Uint8Array>) => JSON.stringify({ keys: Object.entries(keys).map(([kid, bytes]) => ({ kty: 'oct', kid, alg: 'HS256', k: Buffer.from(bytes).toString('base64url') })) })

  // A key is rotated by writing the new set and sending SIGHUP: the set
  // read again replaces the one in force, the old key stops verifying, and
  // the log says what changed by kid, never by key.
  test('is read again on SIGHUP, and the log says so by kid', async () => {
    const first = randomBytes(32)
    const second = randomBytes(32)
    const file = join(directory, 'keys.json')
    await writeFile(file, jwks({ k1: first }))
    const result = await open(settingsOf({ ...base, FORMANCY_REPORT_IDENTITY_KEYS_FILE: file, FORMANCY_REPORT_IDENTITY_ALGORITHM: 'HS256' }), source({}))
    if (!result.ok) throw new Error(result.problem)
    expect((await whoami(result.app, await sign(first, { alg: 'HS256', kid: 'k1' }))).statusCode).toBe(200)

    const signals = new EventEmitter()
    readAgainOnSignal(signals, result.keyFile, result.app.log)
    await writeFile(file, jwks({ k2: second }))
    signals.emit('SIGHUP')
    for (let wait = 0; wait < 40 && !lines.join('').includes('identity keys read again'); wait += 1) await new Promise((resolve) => setTimeout(resolve, 25))
    expect((await whoami(result.app, await sign(second, { alg: 'HS256', kid: 'k2' }))).statusCode).toBe(200)
    expect((await whoami(result.app, await sign(first, { alg: 'HS256', kid: 'k1' }))).statusCode).toBe(401)
    const log = lines.join('')
    expect(log).toContain('"added":["k2"]')
    expect(log).toContain('"removed":["k1"]')
    for (const bytes of [first, second]) expect(log).not.toContain(Buffer.from(bytes).toString('base64url'))
  })

  // A SIGHUP with the file as it was, the operator checking that it is
  // read, says so, and changes nothing.
  test('says that nothing changed when the file read again is the set in force', async () => {
    const first = randomBytes(32)
    const file = join(directory, 'keys.json')
    await writeFile(file, jwks({ k1: first }))
    const result = await open(settingsOf({ ...base, FORMANCY_REPORT_IDENTITY_KEYS_FILE: file, FORMANCY_REPORT_IDENTITY_ALGORITHM: 'HS256' }), source({}))
    if (!result.ok) throw new Error(result.problem)
    const signals = new EventEmitter()
    readAgainOnSignal(signals, result.keyFile, result.app.log)
    signals.emit('SIGHUP')
    for (let wait = 0; wait < 40 && !lines.join('').includes('nothing changed'); wait += 1) await new Promise((resolve) => setTimeout(resolve, 25))
    expect(lines.join('')).toContain('identity keys read again; nothing changed')
    expect((await whoami(result.app, await sign(first, { alg: 'HS256', kid: 'k1' }))).statusCode).toBe(200)
  })

  // Node's default for SIGHUP is to end the process; with a one-key
  // setting there is nothing to read again, and the server says so and
  // goes on.
  test('leaves a server with one key running on SIGHUP, saying nothing was read', async () => {
    const result = await open(settingsOf({ ...base, FORMANCY_REPORT_IDENTITY_SECRET: 'env:HOST_SECRET' }), source({ HOST_SECRET: SECRET }))
    if (!result.ok) throw new Error(result.problem)
    expect(result.keyFile).toBeUndefined()
    const signals = new EventEmitter()
    readAgainOnSignal(signals, undefined, result.app.log)
    signals.emit('SIGHUP')
    expect(lines.join('')).toContain('SIGHUP: the identity key is not a key set file; nothing was read again')
  })

  // A file that does not parse leaves the set in force, so a half-written
  // file never refuses every token; the log says why at error, and holds
  // nothing of the file.
  test('keeps the set in force when the file read again is refused', async () => {
    const first = randomBytes(32)
    const file = join(directory, 'keys.json')
    await writeFile(file, jwks({ k1: first }))
    const result = await open(settingsOf({ ...base, FORMANCY_REPORT_IDENTITY_KEYS_FILE: file, FORMANCY_REPORT_IDENTITY_ALGORITHM: 'HS256' }), source({}))
    if (!result.ok) throw new Error(result.problem)
    const signals = new EventEmitter()
    readAgainOnSignal(signals, result.keyFile, result.app.log)
    await writeFile(file, '{"keys": [ {"kty": "oct", "k": "half-written')
    signals.emit('SIGHUP')
    for (let wait = 0; wait < 40 && !lines.join('').includes('not read again'); wait += 1) await new Promise((resolve) => setTimeout(resolve, 25))
    expect(lines.join('')).toContain('identity keys not read again; the set in force is unchanged')
    expect(lines.join('')).not.toContain('half-written')
    expect((await whoami(result.app, await sign(first, { alg: 'HS256', kid: 'k1' }))).statusCode).toBe(200)
  })
})
