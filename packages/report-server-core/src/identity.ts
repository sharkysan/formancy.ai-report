/**
 * Who is asking, as the server derived it from the host's verified token
 * (0046): the token's subject, the tenant its required claim names, and the
 * roles its roles claim lists.
 *
 * Built only from a token whose signature verified, by report-server's
 * identity module. Nothing else a request carries -- a body, a query, a
 * header other than the token -- contributes to it: a tenant named in a
 * request is a claim by the browser, and the browser is the party the
 * actions table exists to constrain. A single-tenant host puts one constant
 * in every token's tenant claim; there is no request without a tenant.
 */
export interface ReportIdentity {
  /** The token's `sub`: who, at the host, as the host names them. */
  readonly subject: string
  /** The value of the claim the operator maps `tenant` to: whose reports these are. Never empty. */
  readonly tenant: string
  /** The roles the token's roles claim lists, in its order, as the host spells them. */
  readonly roles: readonly string[]
}
