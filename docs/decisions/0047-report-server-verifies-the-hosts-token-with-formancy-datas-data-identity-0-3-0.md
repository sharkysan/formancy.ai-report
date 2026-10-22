# 0047 — report-server verifies the host's token with Formancy Data's own verifier, `@formancy/data-identity` at exactly 0.3.0, read under Data's settings' names; 0006's guard admits Data's licence for report-server's data-identity beside the provider's client, each for its own package alone; Report's own verifier on jose, Data's server as a bridge, a session and a peer dependency lost

- **Status:** accepted; numbered while 0043, 0044 and 0045 were held by branches not yet merged, and numbered before 0048 and merged after it; extends [0006](0006-dependencies-and-fonts-allow-public-source-and-licensed-production.md) and [0016](0016-the-data-provider-reads-formancy-data-0-1-0-best-effort.md)
- **Date:** 2026-10-22
- **Deciders:** Daniel Bacher
- **Verified by:**
  - **The admission.** `scripts/dependency-licences.test.mjs`. On
    fixtures: data-identity at 0.3.0 with the licence file the review read
    is admitted from report-server, and from a package that reaches it
    through report-server; it is refused from the provider and from any
    other package, naming the package that depends on it; and Data's
    client is refused from the server, as it is from anything but the
    provider. On the real tree: the admissions are exactly Data 0.1.0's
    client and core for the provider and Data 0.3.0's data-identity for the
    server, every Data package the walk meets is one of them, each with the
    file the review read, and each reached from its own package and no
    other. Watched failing on the real tree before the admission: the
    command exited 1 with "@formancy/data-identity@0.3.0 is SEE LICENSE IN
    LICENSE.md by its package.json, which the policy refuses
    (@formancy/report-server > @formancy/data-identity)", the only problem
    the walk found in report-server's closure.
  - **The exact version.** `scripts/upstream-deps.test.mjs` refuses a
    range, a `workspace:` link or a path for any `@formancy/data-*`
    dependency, and an exemption from pnpm's release age the lockfile does
    not install; `pnpm-workspace.yaml` exempts this one version, dated.
  - **Data's rules, through Report.** `packages/report-server/src/identity.test.ts`
    runs formancy.ai-data 0014's refusals through the verifier data-identity
    builds (0046), and `settings.test.ts` and `serve.test.ts` the settings
    and the key set read again on SIGHUP (formancy.ai-data 0059), under
    Report's names.
  - **From the registry.** The install gate's `server` host installs the
    packed server, and npm installs data-identity 0.3.0 from the registry
    beside it; the consumer type-checks with `skipLibCheck` off and verifies
    a token through it (`scripts/install-fixture/server.ts`). The README's
    generated table lists data-identity at 0.3.0
    (`scripts/release-report/tested-on.test.mjs`).
  - **Not mechanically enforced:** that data-identity imports nothing but
    jose and Node's built-ins, which its manifest says and Data's 0091
    leaves to review there; and that the licence file is the one 0016's
    review read, which the digest holds and nothing reads again.

## Context

The server verifies the host's token ([0046](0046-report-has-a-server-of-its-own-over-the-hosts-verified-identity.md)).
Formancy Data's server verifies the same tokens, under rules Data decided
and proved: the algorithm pinned by the key's kind, `sub` and `exp`
required, a short secret refused, key confusion refused by construction, a
key set selected by `kid` and read again on SIGHUP, with a long list of
rules for each key (formancy.ai-data 0014, 0059). A host using both signs
one token for a person.

The plan's question SV-Q2 put three ways to it:
- (a) Data releases its verifier as a package without its drivers;
- (b) Report depends on `@formancy/data-server` 0.1.0 as a bridge, with
  PostgreSQL's and SQL Server's drivers, the Azure identity SDK and a
  `@formancy/spec` beside Report's;
- (c) Report writes its own verifier on jose.

The user chose to ask Data for a package, and Data released
`@formancy/data-identity` 0.3.0 on 21 October 2026: `createIdentityVerifier`,
`KeySet`, `KeySetRefusal`, `readKeySet`, `openKeySetFile`, `resolveSecret`,
`isKeySetAlgorithm` and `oneKeySet`, on jose alone, which Data's server
re-exports as the same objects (formancy.ai-data 0091). Its `LICENSE.md` is
the Formancy Data Source-Available Licence Version 1.1, byte for byte the
file Data 0.1.0 shipped and 0016's review read: its SHA-256 is the digest
`FORMANCY_DATA` already holds, compared on 22 October 2026.

Two rules stood in the way. CLAUDE.md said nothing but the provider depends
on Data, and `scripts/dependency-licences.mjs` refused Data reached from any
other package (0016, extending 0006).

## Decision

**report-server depends on `@formancy/data-identity` at exactly 0.3.0**
(0002), and verifies every token with the verifier it builds. Report reads
the identity settings Data's server has under Data's names, with Report's
prefix, each with Data's rule: `FORMANCY_REPORT_ISSUER`, `_AUDIENCE`,
`_IDENTITY_SECRET`, `_IDENTITY_PUBLIC_KEY_FILE`, `_IDENTITY_KEYS_FILE` and
`_IDENTITY_ALGORITHM`. Two are Report's own. `_ATTRIBUTES` is Data's name,
but not Data's rule: Report maps `tenant` alone, once, and requires it
(0046), where Data maps any attribute. `_ROLES_CLAIM`, the claim a token's
roles are read from, is a setting Data's server does not have; it passes
data-identity's own `rolesClaim` option, whose default, `roles`, it keeps
when unset.

**0006's guard admits it for report-server alone.** `FORMANCY_DATA` gains
`@formancy/data-identity@0.3.0`, keyed to that version and to the digest of
the licence file the review read, for `@formancy/report-server`. Each
admission names its one package: Data's client and core are the provider's,
data-identity is the server's, and neither may reach the other's. Data
reached from any other package is still refused. No mechanism changed: an
admission always named the package it was for, and now a second package is
named, for a second Data package.

**The rule in CLAUDE.md changes with it.** Formancy Data's packages are
admitted for two packages, each for its own: `report-data-provider` for
Data's contracts, at exactly 0.1.0, and `report-server` for Data's identity
verifier, at exactly 0.3.0.

## Consequences

**What it buys.**
- **One reading of a token.** Data's key rules are one implementation, in
  Data, proved there; a host's one key set verifies on both servers under
  the same rules, and a forgery one refuses the other refuses too.
- **A small closure.** data-identity brings jose and nothing else; the
  server's dependencies are Fastify's, the rate limiter's and these two,
  since report-server-core depends on nothing.
- **One review for both.** A key rule Data tightens reaches Report as a
  version to adopt, with a changelog line, never a patch to keep in step.

**What it costs.**
- **Data's licence, to run the server.** The server depends on a Data
  package, so running it in production needs a production licence for
  Formancy Data as well as for Report, even for a host that never runs
  Data's server. The rightsholder and the terms are the same, so it is one
  agreement type, as 0016 says of the provider.
- **A review per Data release.** The admission is keyed to 0.3.0 and its
  licence file's digest, so every data-identity upgrade is a fresh reading
  of its licence and a release of report-server.
- **Data's sentences.** A refusal's reason in the log, a key set's refusal
  at start and the secret reference's errors are Data's wording, which a
  Data release may change.
- **Data's defaults.** The verifier tolerates 30 seconds of clock skew on
  `exp` and `nbf`, data-identity's default, which the server does not
  change and nothing here measured.
- **A range inside.** data-identity declares jose as `^6.2.12`, so a
  consumer's install resolves jose afresh; the guard judges what is
  installed, and the release report what a clean install resolved.

**What it forecloses.** A token rule of Report's own. A rule Report needs
that Data's verifier does not have goes to Data first, as the tenant would
have, had it been a key rule and not an attribute Report requires of a
verified token.

## Alternatives considered

**Report's own verifier on jose** (SV-Q2 c). Rejected: a second
implementation of 0014's and 0059's key rules. A host using both servers
with one key set would not find out where they disagreed until one accepted
a token the other refused; 0002 and "one decision, one place" argue against
it.

**`@formancy/data-server` 0.1.0 as a bridge** (SV-Q2 b). Rejected once
data-identity was released: it brings both database adapters, their drivers
-- `postgres`, `mssql`, `tedious` -- the Azure identity and key-vault SDKs,
and `@formancy/spec` 0.5.0 beside the 0.7.0 Report pins, into a server that
opens no database; and Data's own web server beside Report's.

**A session instead of a token.** Rejected for formancy.ai-data 0014's
reason, which 0046 takes: the people are the host's, and a second identity
would have to be kept in step with the first.

**data-identity as a peer dependency, so the host brings it.** Rejected:
the host would choose the version, and the server's tokens would be verified
by whichever release it chose; the exact pin is the point.

**Copying data-identity's source into report-server.** Rejected by 0002:
Data's rules would drift one at a time, and the copy would be Data's code
under this repository's name.
