import { describe, expect, test } from 'vitest'
import { ACTIONS, actionsOf, CAPACITIES, can, capacitiesOf } from './actions.js'
import type { RolePolicy } from './actions.js'
import type { ReportIdentity } from './identity.js'

/**
 * Who may do what (0046): one table of actions, each with the capacities
 * that may take it, and the operator's role policy saying which of the
 * host's roles hold each capacity. Every decision the server makes about a
 * person's permission is `can`, so two routes cannot disagree about one
 * action, and an action nobody wrote down is nobody's.
 */
const policy: RolePolicy = { author: ['report-authors'], publisher: ['report-publishers'], admin: ['report-admins'] }
const person = (...roles: string[]): ReportIdentity => ({ subject: 'u-1', tenant: 't-1', roles })

describe('the actions table', () => {
  // A capacity no action names, or an action no capacity may take, is a
  // setting that grants nothing or a route nobody can reach: both are a
  // table edited by half.
  test('names each action once, each with capacities from the three the settings name', () => {
    expect(CAPACITIES).toEqual(['author', 'publisher', 'admin'])
    for (const [action, capacities] of Object.entries(ACTIONS)) {
      expect(capacities.length, action).toBeGreaterThan(0)
      expect(
        capacities.every((capacity) => CAPACITIES.includes(capacity)),
        action,
      ).toBe(true)
      expect(new Set(capacities).size, action).toBe(capacities.length)
    }
    for (const capacity of CAPACITIES)
      expect(
        Object.values(ACTIONS).some((capacities) => capacities.includes(capacity)),
        capacity,
      ).toBe(true)
  })

  // The table is the decision; a caller that could push a capacity into a
  // row at run time would have granted it without a commit anybody reads.
  test('is frozen, every row with it', () => {
    expect(Object.isFrozen(ACTIONS)).toBe(true)
    for (const capacities of Object.values(ACTIONS)) expect(Object.isFrozen(capacities)).toBe(true)
    expect(Object.isFrozen(CAPACITIES)).toBe(true)
  })

  // The authoring half of R14: an author saves drafts and keeps images, a
  // publisher publishes, withdraws and reads what it publishes, an
  // administrator sets who renders a template. Written out here, row by
  // row, so a change to who may do what is a change to this test too.
  test('gives each capacity the actions R14 needs, and no more', () => {
    expect(ACTIONS).toEqual({
      'template.list': ['author', 'publisher', 'admin'],
      'draft.read': ['author', 'publisher'],
      'draft.save': ['author'],
      'asset.keep': ['author'],
      'asset.read': ['author', 'publisher'],
      'version.read': ['author', 'publisher'],
      'version.publish': ['publisher'],
      'version.withdraw': ['publisher'],
      'version.restore': ['author'],
      'policy.read': ['publisher', 'admin'],
      'policy.set': ['admin'],
    })
  })
})

describe('can', () => {
  // The question a route that takes an action asks: a role the policy
  // gives a capacity that may take the action.
  test('allows an action to a person holding a role of a capacity that may take it', () => {
    expect(can(person('report-authors'), 'draft.save', policy)).toBe(true)
    expect(can(person('report-publishers'), 'version.publish', policy)).toBe(true)
    expect(can(person('report-admins'), 'policy.set', policy)).toBe(true)
  })

  // No capacity implies another: an administrator who could publish would
  // be a publisher nobody named, and a publisher who could save a draft
  // would publish their own work unreviewed by an author.
  test('denies an action to a person whose capacities do not take it', () => {
    expect(can(person('report-admins'), 'version.publish', policy)).toBe(false)
    expect(can(person('report-publishers'), 'draft.save', policy)).toBe(false)
    expect(can(person('report-authors'), 'policy.set', policy)).toBe(false)
    expect(can(person(), 'template.list', policy)).toBe(false)
    expect(can(person('someone-else'), 'template.list', policy)).toBe(false)
  })

  // Fail closed: an action misspelt in a route, or one a later release
  // names and this one does not, is nobody's; the prototype's names are
  // no action either, so `toString` or `__proto__` grant nothing.
  test('denies an unknown action to everybody', () => {
    const everybody = person('report-authors', 'report-publishers', 'report-admins')
    for (const action of ['draft.delete', 'Draft.save', 'draft.save ', '', 'toString', '__proto__', 'constructor', 'hasOwnProperty']) {
      expect(can(everybody, action, policy), action).toBe(false)
    }
  })

  // A role is the host's word, compared as written: "Report-Authors" is
  // another role, as it is at the identity provider that issued it.
  test('compares roles exactly', () => {
    expect(can(person('Report-Authors'), 'draft.save', policy)).toBe(false)
    expect(can(person('report-authors '), 'draft.save', policy)).toBe(false)
  })

  // A policy is the operator's settings, read once; one missing a capacity,
  // or holding something that is not a list of roles, grants nothing for
  // that capacity rather than throwing in the middle of a request.
  test('reads a capacity the policy gives no list of roles as held by nobody', () => {
    const broken = { author: 'report-authors', publisher: undefined, admin: [7] } as unknown as RolePolicy
    expect(can(person('report-authors'), 'draft.save', broken)).toBe(false)
    expect(can(person('report-authors'), 'template.list', broken)).toBe(false)
  })

  // A role an operator gives two capacities holds both, which is how one
  // person authors and publishes in a small deployment.
  test('allows a role the policy gives two capacities both of them', () => {
    const small: RolePolicy = { author: ['editors'], publisher: ['editors'], admin: [] }
    expect(can(person('editors'), 'draft.save', small)).toBe(true)
    expect(can(person('editors'), 'version.publish', small)).toBe(true)
    expect(can(person('editors'), 'policy.set', small)).toBe(false)
  })
})

describe('what whoami says a person may do', () => {
  // whoami lists what the table gives this person, in the table's order,
  // so a host wiring roles in sees the same answer every route will give.
  test('lists the capacities and the actions a person holds, in the tables’ order', () => {
    const both = person('report-publishers', 'report-authors')
    expect(capacitiesOf(both, policy)).toEqual(['author', 'publisher'])
    expect(actionsOf(both, policy)).toEqual(Object.keys(ACTIONS).filter((action) => action !== 'policy.set'))
    expect(actionsOf(person('report-admins'), policy)).toEqual(['template.list', 'policy.read', 'policy.set'])
    expect(capacitiesOf(person(), policy)).toEqual([])
    expect(actionsOf(person(), policy)).toEqual([])
  })

  // The list whoami answers is the answer `can` gives, action by action:
  // two functions that could disagree about one person would be two
  // decisions.
  test('agrees with can on every action, for every combination of capacities', () => {
    const roles = ['report-authors', 'report-publishers', 'report-admins']
    for (let mask = 0; mask < 8; mask += 1) {
      const someone = person(...roles.filter((_, bit) => (mask & (1 << bit)) !== 0))
      expect(actionsOf(someone, policy)).toEqual(Object.keys(ACTIONS).filter((action) => can(someone, action, policy)))
    }
  })
})
