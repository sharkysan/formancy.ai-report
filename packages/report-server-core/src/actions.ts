import type { ReportIdentity } from './identity.js'

/**
 * Who may do what to a tenant's reports, decided in one place (0046).
 *
 * Three capacities, which the operator gives to the host's roles in the
 * server's settings, and one table of actions, each with the capacities that
 * may take it. A route that takes an action is to ask `can` with it, so two
 * routes cannot disagree about one action; no route takes one yet, and
 * whoami, which takes none, lists exactly what `can` would allow. No
 * capacity implies another: a deployment where one person authors and
 * publishes gives one role both.
 *
 * The table holds R14's actions, the templates' -- what an author, a
 * publisher and an administrator may do to a tenant's drafts, assets,
 * versions and policies -- before the routes that take them exist, so that
 * the host's wiring shows what each setting grants before any template
 * depends on it, as Data's whoami shows an identity before any form does
 * (formancy.ai-data 0014). Rendering and downloading are a template's own
 * policy's to grant, and join with it.
 */
export const CAPACITIES = Object.freeze(['author', 'publisher', 'admin'] as const)

export type Capacity = (typeof CAPACITIES)[number]

/** Which of the host's roles hold each capacity: the operator's settings, read once by the composition root. */
export type RolePolicy = { readonly [capacity in Capacity]: readonly string[] }

const row = (...capacities: Capacity[]): readonly Capacity[] => Object.freeze(capacities)

/**
 * Every action, and the capacities that may take it. An action not here is
 * denied to everybody, so a misspelt action in a route, or one a later
 * release adds, is nobody's until a row names it.
 */
export const ACTIONS = Object.freeze({
  /** List the tenant's templates: anybody with a capacity sees what exists. */
  'template.list': row('author', 'publisher', 'admin'),
  /** Read a template's draft. */
  'draft.read': row('author', 'publisher'),
  /** Save a draft from the version it was made against. */
  'draft.save': row('author'),
  /** Keep an image a builder adds, named by its digest. */
  'asset.keep': row('author'),
  /** Read a kept image by its digest. */
  'asset.read': row('author', 'publisher'),
  /** Read a published version. */
  'version.read': row('author', 'publisher'),
  /** Publish a draft as an immutable version. */
  'version.publish': row('publisher'),
  /** Withdraw a published version, so that nothing renders it. */
  'version.withdraw': row('publisher'),
  /** Make a new draft from a published version: authoring, from an older text. */
  'version.restore': row('author'),
  /** Read who may render and download a template. */
  'policy.read': row('publisher', 'admin'),
  /** Set who may render and download a template. */
  'policy.set': row('admin'),
})

export type Action = keyof typeof ACTIONS

/** The roles `policy` gives `capacity`; a capacity given anything but a list of strings is held by nobody. */
function rolesOf(policy: RolePolicy, capacity: Capacity): readonly string[] {
  const roles: unknown = policy[capacity]
  return Array.isArray(roles) && roles.every((role) => typeof role === 'string') ? roles : []
}

/** The capacities `identity` holds under `policy`, in CAPACITIES' order. */
export function capacitiesOf(identity: ReportIdentity, policy: RolePolicy): Capacity[] {
  return CAPACITIES.filter((capacity) => rolesOf(policy, capacity).some((role) => identity.roles.includes(role)))
}

/**
 * Whether `identity` may take `action` under `policy`: a role of a capacity
 * that the action's row names. An action the table does not hold, an
 * inherited name such as `toString` among them, is denied.
 */
export function can(identity: ReportIdentity, action: string, policy: RolePolicy): boolean {
  if (!Object.hasOwn(ACTIONS, action)) return false
  const allowed: readonly Capacity[] = ACTIONS[action as Action]
  return capacitiesOf(identity, policy).some((capacity) => allowed.includes(capacity))
}

/** Every action `identity` may take under `policy`, in the table's order: what whoami answers. */
export function actionsOf(identity: ReportIdentity, policy: RolePolicy): Action[] {
  return (Object.keys(ACTIONS) as Action[]).filter((action) => can(identity, action, policy))
}
