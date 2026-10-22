import { createIdentityVerifier } from '@formancy/data-identity'
import type { IdentityOptions } from '@formancy/data-identity'
import type { ReportIdentity } from '@formancy/report-server-core'

/**
 * The host's token, verified offline by Formancy Data's own verifier
 * (@formancy/data-identity at exactly 0.3.0, 0047; formancy.ai-data 0014,
 * 0059, 0091), so that a host signing one token for a person has it read
 * by Report's server under exactly the rules Data's applies: the algorithm
 * pinned by the key's kind, `sub` and `exp` required, a key set selected by
 * `kid`, nothing fetched. What Report adds is the tenant (0046): the claim
 * the operator names is required, so a token without it is refused like
 * any bad token, and no request reaches the server without a tenant.
 */
export type ReportIdentityOptions = Omit<IdentityOptions, 'attributes'> & {
  /** The claim a token names its tenant in, `tid` for Entra ID. Required, and never empty. */
  tenantClaim: string
}

export type ReportIdentityOutcome = { ok: true; identity: ReportIdentity } | { ok: false; reason: string }

/**
 * A token to who is asking, or why not. A reason is jose's code or a
 * sentence naming a claim, and never the token or a claim's value, so it
 * may be logged.
 */
export type ReportVerifier = (token: string) => Promise<ReportIdentityOutcome>

/**
 * Builds the verifier once, at start. A key that would accept forgeries --
 * a secret under 32 bytes, a PEM that does not import, a set no builder
 * checked -- throws here, as data-identity throws it, so a server is never
 * made with one; and so does a tenant claim named nowhere.
 */
export async function createReportVerifier(options: ReportIdentityOptions): Promise<ReportVerifier> {
  const { tenantClaim, ...identity } = options
  if (typeof tenantClaim !== 'string' || tenantClaim === '') throw new Error('tenantClaim names the claim a token names its tenant in, and is required (0046)')
  const verify = await createIdentityVerifier({ ...identity, attributes: { tenant: tenantClaim } })
  return async (token) => {
    const outcome = await verify(token)
    if (!outcome.ok) return outcome
    const tenant = outcome.identity.attributes['tenant']
    if (tenant === undefined) return { ok: false, reason: `the token has no ${tenantClaim} claim, which names its tenant` }
    if (tenant === '') return { ok: false, reason: `the ${tenantClaim} claim, which names the tenant, is empty` }
    return { ok: true, identity: Object.freeze({ subject: outcome.identity.actor.id, tenant, roles: Object.freeze([...outcome.identity.actor.roles]) }) }
  }
}
