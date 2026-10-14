# 0001 — A paid module lives in its own repository, under Formancy Data's terms, in force before a lawyer has read them

- **Status:** accepted
- **Date:** 2026-10-14
- **Deciders:** Daniel Bacher
- **Verified by:** `scripts/verify-licenses.mjs`, run by `gates.yml` on every
  pull request and before every release, refuses any publishable package whose
  `license` field is not `SEE LICENSE IN LICENSE.md` or whose tarball would
  ship without `LICENSE.md` and `NOTICE`; `scripts/release/pins.mjs` refuses
  the same in the tarballs a release would publish.
  `scripts/licence-status.test.mjs`, in `pnpm test:repo`, refuses a
  `LICENSE.md` whose version line is not a licence in force that says no
  lawyer has reviewed it, and a README whose licence sentence says anything
  else. That nothing here is copied from formancy.ai or Formancy Data is held
  by [0002](0002-depend-on-upstream-never-copy-it.md)'s guard for
  dependencies and by review for source. That the licence's terms are Formancy
  Data's is held by review: nothing compares the two texts.

## Context

formancy.ai made two decisions on its first day that every paid Formancy
product is read against.
[formancy.ai 0002](https://github.com/sharkysan/formancy.ai/blob/main/docs/decisions/0002-apache-2-0.md)
is Apache-2.0 for everything, with no proprietary edition of that code, ever.
[formancy.ai 0003](https://github.com/sharkysan/formancy.ai/blob/main/docs/decisions/0003-open-core-line.md)
draws the commercial line at operating the platform rather than at using it,
and its sold list already names **PDF and e-signature**. It rejected a
source-available licence *for formancy itself*.

[formancy.ai-data 0001](https://github.com/sharkysan/formancy.ai-data/blob/main/docs/decisions/0001-a-paid-module-in-its-own-repository.md)
answered the same question for a paid database module: a repository of its
own, a source-available licence of its own, and the Apache-2.0 packages
depended on rather than copied. Its licence has been in force since
11 October 2026, at Version 1.1, unreviewed by a lawyer and saying so at the
top ([formancy.ai-data 0048](https://github.com/sharkysan/formancy.ai-data/blob/main/docs/decisions/0048-the-licence-is-in-force-before-a-lawyer-has-read-it.md),
[0054](https://github.com/sharkysan/formancy.ai-data/blob/main/docs/decisions/0054-version-1-1-names-the-address-for-a-redistribution-agreement-too.md)).

Formancy Report designs and renders paginated PDF reports. It is the PDF item
on 0003's sold list, made into a self-hosted product that a developer installs
and runs. It reads Formancy Data's datasets when a customer has both, and the
two are expected to be bought together.

## Decision

Formancy Report is a separate repository under its own licence, the
**Formancy Report Source-Available Licence**. Its terms are Formancy Data's
Version 1.1, with this product's names and with the documents it renders
named as the customer's. It:

- is free to read, fork, evaluate, develop and test, including inside a
  company and without an expiry;
- needs a paid licence to run in production;
- needs a separate agreement to redistribute.

It depends on the released Apache-2.0 `@formancy/*` packages and contains none
of their code. Its packages publish under the same `@formancy` scope, each
declaring `SEE LICENSE IN LICENSE.md` and carrying `LICENSE.md` and `NOTICE`.

Version 1 is in force from 14 October 2026, before a lawyer has read it. It
says so at the top, as Data's does. Contributions are taken under a CLA that
grants the right to sublicense, and assigns no copyright.

## Consequences

**What it buys.**
- **No change upstream.** A revenue line that touches neither formancy's
  licence nor its promise that a self-hoster never hits a paywall.
- **One kind of agreement.** A Report + Data bundle sold under one kind of
  agreement, because the two products' terms are the same. With different
  terms it would need a compatibility review between licence families.
- **A free trial.** Evaluation costs nothing and never expires, so the price
  is never in front of the trial.

**What it costs.**
- **Three repositories to keep in step.** That cost has its own record,
  [0002](0002-depend-on-upstream-never-copy-it.md).
- **A mixed scope.** The `@formancy` scope mixes Apache-2.0 packages with
  source-available ones. The `license` field, the shipped `LICENSE.md`, the
  NOTICE and the word "source-available" in every README answer that
  confusion, and the guard above keeps a copied manifest from undoing it.
- **Dependencies narrowed.** Neither GPL nor AGPL code can ship inside a
  product whose source is public and whose production use is licensed. Nor
  can code under a non-commercial licence. A commercial component needs
  written redistribution rights. That narrows the renderer choice; it is
  written down where the choice is made.
- **An unreviewed licence.** Until a lawyer reviews it, the licence is a
  statement of intent made carefully, not a reviewed contract. A customer's
  production agreement is the document that governs, and the first paid
  release waits for that review.

**What it forecloses.**
- Moving this code into formancy.ai without first relicensing it under
  Apache-2.0.
- Describing Formancy Report as open source, anywhere, ever.
- An AGPL edition, which was this product's working direction until this
  decision. Offering one later would be a new record. The CLA makes that
  possible, because it grants the right to sublicense contributions, but
  nothing here promises it.

**What it asks of formancy.ai.** A record there amending 0003's sold list to
name the paid modules beside the operating-the-platform items. Formancy
Data's 0001 already said that record is owed. This is the second module it
would name.

## Alternatives considered

**AGPLv3 plus a commercial licence.** This was the plan's working preference
until this decision. Rejected for two reasons:

- **The bundle.** A Report community edition could not present Formancy Data,
  which needs a paid production licence, as a free AGPL dependency. So every
  bundle would have needed a licence-compatibility review.
- **Price clarity.** Under AGPL, a company can run Report in production
  without paying, by meeting the licence's conditions. That is a legitimate
  model, but a weaker production boundary to price against than the one Data
  already has.

**Apache-2.0, selling only support and hosting.** Rejected for the reason
Data's 0001 gives: 0003's sold list was thin and every item on it unbuilt. A
product with a clear production-use boundary is the one to price against.

**One shared licence text for Data and Report.** Rejected. Each product keeps
its own text on the same terms, so either can be revised, reviewed or have
its terms changed without a version change in the other repository. The cost
is two texts that can drift apart, held only by review.
