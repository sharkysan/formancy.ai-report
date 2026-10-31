// Chromium's own accessibility tree of one element, as the Studio's browser
// gate compares the two builders' (gate-parity.mjs): the nodes the DevTools
// protocol's Accessibility.getFullAXTree gives, written one node a line,
// indented two spaces a level, so that two trees compare as text and a
// difference is a line.
//
// The protocol's tree is the one Chromium hands a screen reader: each node's
// role, its name and description as Chromium computes them, its value, and
// its states and properties. The normalisation takes out what is not a
// role, a name, a description, a value or a state -- what says how a
// builder's markup is put together, not what a person meets -- and nothing
// else. Each is a case of scripts/accessible-tree.test.mjs:
//
//   - every protocol id, and every property whose value points at other
//     nodes (aria-labelledby, aria-describedby, aria-controls, aria-owns and
//     their like, by the value's type, not by a list of names): the ids are
//     each framework's own -- React's useId, the Angular builder's counter --
//     and the name and description they give are kept;
//   - a node Chromium does not expose (`ignored`: hidden, aria-hidden,
//     presentational), its exposed descendants kept at its depth;
//   - an element with no role of its own and nothing said of it, `generic`
//     or `none` with neither name nor description: a framework's wrapper that
//     a screen reader passes through -- the Angular builder's component host
//     around the problems' list, which the React builder draws without one.
//     One that is named, or described, is kept, and compared;
//   - text itself -- StaticText, its InlineTextBox runs, a LineBreak -- which
//     the gate compares in Playwright's snapshot, beside this.
//
// And, where the gate asks, what is under a node it names (`prune`): the
// host's view a builder draws in its middle (0029), whose region is the
// builder's and is kept, and whose content is the host's -- the Studio's one
// Preview in both builders, its status and its pages moving while it
// prints. The same is taken out of Playwright's snapshot (`pruned`).
//
// Node only, no import, and pure.

/** Text, which Playwright's snapshot compares. */
const TEXT = new Set(['StaticText', 'InlineTextBox', 'LineBreak'])

/** Roles that say nothing of their own: an element a screen reader passes through. */
const ROLELESS = new Set(['generic', 'none'])

/** The protocol's value types that point at other nodes: a relation by id, never a state. */
const POINTERS = new Set(['idref', 'idrefList', 'node', 'nodeList', 'domRelation'])

/** A computed string as the protocol gives one, '' when there is none. */
const said = (field) => (field === undefined || field.value === undefined ? '' : String(field.value))

/** One node's line: its role and name, then its description, its value, and each state and property but a relation by id. */
function line(node, depth) {
  const parts = [`${'  '.repeat(depth)}${said(node.role)} ${JSON.stringify(said(node.name))}`]
  if (said(node.description) !== '') parts.push(`description=${JSON.stringify(said(node.description))}`)
  if (node.value !== undefined && node.value.value !== undefined) parts.push(`value=${JSON.stringify(node.value.value)}`)
  for (const property of node.properties ?? []) {
    if (POINTERS.has(property.value?.type)) continue
    parts.push(`${property.name}=${JSON.stringify(property.value?.value ?? null)}`)
  }
  return parts.join(' ')
}

/**
 * The lines of the subtree under the one exposed node with `role` and
 * `name`, among `nodes` -- what Accessibility.getFullAXTree returns --
 * with nothing under an exposed node `prune` names (`{ role, name }`) but
 * its own line. Throws when there is not exactly one such root, or a child
 * it names is not among `nodes`: a tree read in part would compare as one
 * that agreed.
 */
export function treeLines(nodes, { role, name, prune = null }) {
  const byId = new Map(nodes.map((node) => [node.nodeId, node]))
  const roots = nodes.filter((node) => node.ignored !== true && said(node.role) === role && said(node.name) === name)
  if (roots.length !== 1) throw new Error(`Chromium's tree has ${String(roots.length)} ${role} named "${name}", where the gate reads one`)
  const lines = []
  const visit = (node, depth) => {
    const kind = said(node.role)
    const kept = node.ignored !== true && !TEXT.has(kind) && !(ROLELESS.has(kind) && said(node.name) === '' && said(node.description) === '')
    if (kept) lines.push(line(node, depth))
    if (kept && prune !== null && kind === prune.role && said(node.name) === prune.name) return
    for (const id of node.childIds ?? []) {
      const child = byId.get(id)
      if (child === undefined) throw new Error(`Chromium's tree names a child ${String(id)} of a ${kind} it does not hold`)
      visit(child, kept ? depth + 1 : depth)
    }
  }
  visit(roots[0], 0)
  return lines
}

/**
 * Playwright's snapshot, as lines, with nothing under each node with
 * `role` and `name` but its own line: the lines indented deeper than it
 * that follow it, up to the next line that is not.
 */
export function pruned(lines, { role, name }) {
  const head = `- ${role} ${JSON.stringify(name)}`
  const kept = []
  let under = null
  for (const text of lines) {
    const depth = text.length - text.trimStart().length
    if (under !== null && depth > under) continue
    under = null
    kept.push(text)
    const own = text.trimStart()
    if (own === head || own.startsWith(`${head}:`) || own.startsWith(`${head} [`)) under = depth
  }
  return kept
}

/** A line as a failure says it: its depth, then what it says. */
const shown = (text) => {
  const depth = text.length - text.trimStart().length
  return `(${String(depth / 2)}) ${text.trimStart()}`
}

/**
 * What `left` and `right`, two lists of lines, differ by, as a failure says
 * it: the lines only one of them has, as many of each as `limit`, with the
 * depth each stands at; or, when both hold the same lines, where the first
 * stands in another order. Null when they are the same.
 */
export function difference(left, right, { names = ['one', 'the other'], limit = 4 } = {}) {
  if (left.length === right.length && left.every((text, at) => text === right[at])) return null
  // Each line of `from` that `other` does not hold as many times.
  const only = (from, other) => {
    const counts = new Map()
    for (const text of other) counts.set(text, (counts.get(text) ?? 0) + 1)
    return from.filter((text) => {
      const count = counts.get(text) ?? 0
      if (count === 0) return true
      counts.set(text, count - 1)
      return false
    })
  }
  const [mine, theirs] = [only(left, right), only(right, left)]
  if (mine.length === 0 && theirs.length === 0) {
    const at = left.findIndex((text, index) => text !== right[index])
    return `the same lines in another order, from line ${String(at + 1)}: ${names[0]} has ${shown(left[at])} where ${names[1]} has ${shown(right[at])}`
  }
  const say = (name, lines) =>
    lines.length === 0
      ? `${name} has no line the other lacks`
      : `${name} alone has ${lines.slice(0, limit).map(shown).join(' | ')}${lines.length > limit ? ` and ${String(lines.length - limit)} more` : ''}`
  return `${say(names[0], mine)}; ${say(names[1], theirs)}`
}
