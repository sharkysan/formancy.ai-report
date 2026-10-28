import { generateKeyPairSync } from 'node:crypto'
import { SignJWT, UnsecuredJWT } from 'jose'
import { describe, expect, test } from 'vitest'
import { createReportVerifier } from './identity.js'
import type { ReportIdentityOptions } from './identity.js'

/**
 * The host's token, verified offline by Formancy Data's verifier
 * (@formancy/data-identity 0.3.0, formancy.ai-data 0014, 0091), and the
 * tenant Report requires of it (0046). Each refusal is formancy.ai-data
 * 0014's case, here through Report's wrapper, so a wrapper that let one
 * through -- by catching too much, or reading the payload itself -- fails
 * here; and a token without its tenant is one more.
 *
 * The secret below is this test's own, throwaway, and verifies nothing
 * anywhere else.
 */
const SECRET = 'a-throwaway-test-secret-of-at-least-32-bytes'
const ISSUER = 'https://host.example'
const AUDIENCE = 'formancy-report'
const options: ReportIdentityOptions = { key: { kind: 'secret', secret: SECRET }, issuer: ISSUER, audience: AUDIENCE, tenantClaim: 'tid' }

const key = new TextEncoder().encode(SECRET)

/** A token as the host signs it, with `claims` over the defaults and `change` applied before signing. */
async function token(claims: Record<string, unknown> = {}, change: (jwt: SignJWT) => SignJWT = (jwt) => jwt): Promise<string> {
  const jwt = new SignJWT({ tid: 'acme', roles: ['report-authors'], ...claims }).setProtectedHeader({ alg: 'HS256' }).setIssuer(ISSUER).setAudience(AUDIENCE).setSubject('u-1').setIssuedAt().setExpirationTime('5m')
  return change(jwt).sign(key)
}

describe('createReportVerifier', () => {
  // The token a host signs becomes who is asking: its subject, its tenant
  // from the mapped claim, its roles.
  test('verifies a token and gives its subject, its tenant and its roles', async () => {
    const verify = await createReportVerifier(options)
    expect(await verify(await token())).toEqual({ ok: true, identity: { subject: 'u-1', tenant: 'acme', roles: ['report-authors'] } })
  })

  // A tenant an identity provider numbers is its decimal string, as Data
  // reads it, so one tenant is one string on both servers.
  test('reads a tenant claim that is a whole number as its decimal string', async () => {
    const verify = await createReportVerifier(options)
    expect(await verify(await token({ tid: 3 }))).toMatchObject({ ok: true, identity: { tenant: '3' } })
  })

  // The roles claim is the operator's to name; an identity provider that
  // puts groups in `groups` is read there and nowhere else.
  test('reads the roles from the claim the options name', async () => {
    const verify = await createReportVerifier({ ...options, rolesClaim: 'groups' })
    expect(await verify(await token({ groups: ['report-publishers'] }))).toMatchObject({ ok: true, identity: { roles: ['report-publishers'] } })
  })

  // formancy.ai-data 0014's refusals, each a token that must not become an
  // identity: a forgery, another issuer's or another audience's token, one
  // expired or with no expiry, one with nobody in it, and one unsigned.
  test('refuses a wrong signature, issuer or audience, an expired token, one with no exp or no sub, and alg none', async () => {
    const verify = await createReportVerifier(options)
    const forged = await new SignJWT({ tid: 'acme' }).setProtectedHeader({ alg: 'HS256' }).setIssuer(ISSUER).setAudience(AUDIENCE).setSubject('u-1').setExpirationTime('5m').sign(new TextEncoder().encode('another-secret-of-at-least-thirty-two-bytes'))
    const unsigned = new UnsecuredJWT({ tid: 'acme' }).setIssuer(ISSUER).setAudience(AUDIENCE).setSubject('u-1').setExpirationTime('5m').encode()
    const refused = {
      'a wrong signature': forged,
      'another issuer': await token({}, (jwt) => jwt.setIssuer('https://other.example')),
      'another audience': await token({}, (jwt) => jwt.setAudience('formancy-data')),
      'an expired token': await token({}, (jwt) => jwt.setExpirationTime(Math.floor(Date.now() / 1000) - 3600)),
      'no exp': await new SignJWT({ tid: 'acme' }).setProtectedHeader({ alg: 'HS256' }).setIssuer(ISSUER).setAudience(AUDIENCE).setSubject('u-1').sign(key),
      'no sub': await new SignJWT({ tid: 'acme' }).setProtectedHeader({ alg: 'HS256' }).setIssuer(ISSUER).setAudience(AUDIENCE).setExpirationTime('5m').sign(key),
      'alg none': unsigned,
      'not a token': 'not.a.token',
    }
    for (const [what, presented] of Object.entries(refused)) {
      const outcome = await verify(presented)
      expect(outcome.ok, what).toBe(false)
    }
  })

  // Report's own refusal: a token that names no tenant has no reports to
  // reach. Read as no tenant at all it would be a tenant of its own, the
  // empty one, shared by every host that forgot the claim (SV-Q6: the
  // claim is required, and a single-tenant host puts a constant in it).
  test('refuses a token without the tenant claim, or with an empty one, naming the claim and not a value', async () => {
    const verify = await createReportVerifier(options)
    const without = await verify(await token({ tid: undefined }))
    expect(without).toEqual({ ok: false, reason: 'the token has no tid claim, which names its tenant' })
    expect(await verify(await token({ tid: '' }))).toEqual({ ok: false, reason: 'the tid claim, which names the tenant, is empty' })
    expect(await verify(await token({ tid: ['acme'] }))).toEqual({ ok: false, reason: 'the tid claim is not a string or a whole number' })
    // The claim the tenant is read from and no other: a token whose
    // tenant is under another name is a token without one.
    expect((await verify(await token({ tid: undefined, tenant: 'acme' }))).ok).toBe(false)
  })

  // A reason is logged; one that held the token, or a claim's value, would
  // put a credential or a person's identifier in the log (CLAUDE.md).
  test('says why in words that hold neither the token nor a claim’s value', async () => {
    const verify = await createReportVerifier(options)
    const cases = [await token({ tid: undefined, roles: ['secret-role'] }), await token({}, (jwt) => jwt.setIssuer('https://leaked.example')), await token({ roles: 'not-a-list' })]
    for (const presented of cases) {
      const outcome = await verify(presented)
      expect(outcome.ok).toBe(false)
      const reason = outcome.ok ? '' : outcome.reason
      for (const part of [presented, ...presented.split('.'), 'secret-role', 'leaked', 'not-a-list', 'u-1', 'acme']) expect(reason, part).not.toContain(part)
    }
  })

  // A secret short enough to guess accepts forgeries; refused when the
  // verifier is made, so a server never starts on one (formancy.ai-data
  // 0014).
  test('refuses a secret under 32 bytes when it is made', async () => {
    await expect(createReportVerifier({ ...options, key: { kind: 'secret', secret: 'short' } })).rejects.toThrow('at least 32 bytes')
  })

  // Key confusion: a public key's PEM is public, so a token signed with
  // HS256 over its text would verify wherever the PEM were taken for a
  // shared secret. The algorithm is pinned by the key's kind, and the
  // forgery is refused (formancy.ai-data 0014).
  test('refuses an HS256 token signed with the text of the public key it is verified against', async () => {
    const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' })
    const pem = publicKey.export({ type: 'spki', format: 'pem' }).toString()
    const verify = await createReportVerifier({ ...options, key: { kind: 'public-key', pem, algorithm: 'ES256' } })
    const honest = await new SignJWT({ tid: 'acme' }).setProtectedHeader({ alg: 'ES256' }).setIssuer(ISSUER).setAudience(AUDIENCE).setSubject('u-1').setExpirationTime('5m').sign(privateKey)
    expect(await verify(honest)).toMatchObject({ ok: true, identity: { tenant: 'acme' } })
    const confused = await new SignJWT({ tid: 'acme' }).setProtectedHeader({ alg: 'HS256' }).setIssuer(ISSUER).setAudience(AUDIENCE).setSubject('u-1').setExpirationTime('5m').sign(new TextEncoder().encode(pem))
    expect((await verify(confused)).ok).toBe(false)
  })

  // A tenant claim named nowhere would make every token tenantless and
  // every request a 401 nobody could explain: refused when it is made.
  test('refuses to be made without a tenant claim to read', async () => {
    await expect(createReportVerifier({ ...options, tenantClaim: '' })).rejects.toThrow('tenantClaim names the claim a token names its tenant in')
  })

  // What the verifier hands on is the server's to keep: a frozen copy, so
  // nothing that holds the identity can rewrite a person's roles or tenant
  // for a later decision.
  test('hands on an identity nothing can change', async () => {
    const verify = await createReportVerifier(options)
    const outcome = await verify(await token())
    if (!outcome.ok) throw new Error('the token was refused')
    expect(Object.isFrozen(outcome.identity)).toBe(true)
    expect(Object.isFrozen(outcome.identity.roles)).toBe(true)
  })
})
