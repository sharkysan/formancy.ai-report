# 0002 — Depend on released upstream packages at exact versions; never copy them

- **Status:** accepted; narrowed by [0050](0050-every-typescript-and-javascript-file-is-linted-and-formatted-by-the-rules-the-four-repositories-share.md): its wait for a release, for the lint and format rules, a byte-for-byte copy of Formancy Health's until formancy.ai releases them as `@formancy/code-style`, deleted when this repository pins it; the narrowing ended on 2026-10-31, when it pinned `@formancy/code-style` 0.12.0
- **Date:** 2026-10-14
- **Deciders:** Daniel Bacher
- **Verified by:** `scripts/upstream-deps.mjs`, through
  `scripts/upstream-deps.test.mjs` in `pnpm test:repo`, which CI runs on every
  pull request. It refuses any `@formancy/*` dependency, in the root
  manifest or a workspace's, that is not a workspace sibling and is not an
  exact released version. A range, a
  `workspace:` link, or a `link:`, `file:` or git specifier each fail, and the
  test proves each on a fixture before checking the real tree. The same rule
  applies to Formancy Data's packages, which share the scope, so a
  `@formancy/data-*` dependency taken from a checkout fails too. That no
  upstream **source** is copied here is held by review; nothing mechanical
  distinguishes a copied file from a written one.

## Context

Report builds on two repositories.

**formancy.ai.** It publishes the spec, the engine, the expression language
with exact decimals, the renderers, the builders and the themes as packages,
with provenance. `@formancy/*` 0.5.0 was released on 11 October 2026, and its
README says the APIs are not frozen before 1.0. Report needs it for:

- parameter forms, rendered by the formancy renderers;
- expressions and exact decimal arithmetic in calculations;
- canonical hashing;
- the editor chrome.

**Formancy Data.** It holds the database metadata, policies and records
Report's integrated workflow reads. On 14 October it had published nothing:
no tag, and no package on npm.

[formancy.ai-data 0002](https://github.com/sharkysan/formancy.ai-data/blob/main/docs/decisions/0002-depend-on-upstream-never-copy-it.md)
faced the same choice against formancy.ai and chose released packages at
exact versions. A copy that diverged by one validation rule would have
produced a form one side accepts and the other refuses.

## Decision

Depend on the published `@formancy/*` packages, at **exact** versions, and
carry none of their code. A version moves by hand, in a commit whose
CHANGELOG line says which release was adopted and why. Anything Report needs
that formancy or Data does not offer is proposed there, and this repository
waits for the release.

The rule covers Formancy Data's packages too. Until Data publishes one,
Report has no Data dependency in its workspace. The optional Data provider
package arrives with Data's first release. A host application supplies data
directly until then.

## Consequences

**What it buys.**
- **One meaning of each thing.** One engine deciding what a form and an
  expression mean, in the browser, on the server and in a report. A parameter
  form validated by a copied engine would accept what the formancy server
  refuses, and a total computed by a copied decimal implementation would
  differ in a digit nobody checks.
- **0001 stays honest.** A repository that contains no upstream code cannot
  be a proprietary edition of it.

**What it costs.**
- **Latency.** A generic improvement goes through another repository's review
  before Report can use it.
- **Bug fixes by commit.** An upstream fix arrives through a commit somebody
  makes, not through `pnpm install`.
- **Data waits for a release.** The integrated database workflow waits for
  Data's first release, however far Data's source has got. A development
  experiment against a Data checkout stays outside the published packages,
  and says where its packages came from.

**What it forecloses.**
- Patching upstream behaviour locally "just for now". There is no mechanism
  for it, by design.
- Widening the form spec to hold report pages. A report is its own document,
  with its own version line in `@formancy/report-spec`.

## Alternatives considered

**Vendor the engine, or Data's adapters.** Rejected, for two reasons:

- **Divergence.** A copy drifts from the original, one rule at a time.
- **Licence.** Vendoring would make this repository a proprietary edition of
  Apache-2.0 code, which 0001 exists to avoid. For Data's adapters it would be
  a second copy of database code whose behaviour Data proves against real
  servers and this repository would not.

**Ranges with a lockfile.** Rejected, as in Data: `pnpm update` moves a range
without anybody reading upstream's changelog. An exact version has to be
edited, and an edit is a diff.

**A workspace link to a Formancy Data checkout, so the integration can start
now.** Rejected for the published packages. The build would depend on what
one machine had checked out, and the install gate would test something no
customer installs. A clearly labelled experiment may do it outside them.
