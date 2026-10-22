# Formancy Report — architecture and decision documentation

Engineering documentation for the people who need to understand *why*
Formancy Report is built the way it is: contributors, integrators, and
customers evaluating a module whose source is public and whose production
use is licensed.

It is not the user documentation. How to use the packages is in
[the README](../README.md), each package's own README, and
[the getting-started guide](getting-started.md), whose code the install gate
compiles and runs. How work is done here, and the bar a change meets, is
[`CLAUDE.md`](../CLAUDE.md). Nothing here is a tutorial.

## Start here

| If you are… | Read |
|---|---|
| New to the codebase | [Introduction and goals](architecture/01-introduction-and-goals.md), then [Solution strategy](architecture/04-solution-strategy.md) — the ideas everything else follows from |
| Looking for where something lives | [Building blocks](architecture/05-building-blocks.md) |
| Following a report from data to a PDF | [Runtime view](architecture/06-runtime-view.md) |
| Wondering why an obvious simpler thing was not done | [Decision records](decisions/README.md) and their index |
| Integrating the packages, or deciding whether to | [Deployment view](architecture/07-deployment-view.md), then [Risks and technical debt](architecture/11-risks-and-debt.md) and [the known limitations](release/limitations.json) |
| About to change something load-bearing | [Verification](architecture/10-verification.md), [Risks and technical debt](architecture/11-risks-and-debt.md) and the record behind it |

## Architecture

Structured as [arc42](https://arc42.org), as formancy.ai's is, because it is
a recognised shape and a reader who knows it can find things without being
told.

| | |
|---|---|
| [1. Introduction and goals](architecture/01-introduction-and-goals.md) | What Formancy Report is, what it is not, and the quality goals the records keep choosing |
| [2. Constraints](architecture/02-constraints.md) | What was not chosen, and what several decisions look arbitrary without |
| [3. Context and scope](architecture/03-context-and-scope.md) | The system boundary, and everything that stays the host's |
| [4. Solution strategy](architecture/04-solution-strategy.md) | The ideas the rest follows from |
| [5. Building blocks](architecture/05-building-blocks.md) | Every package and app, what each may import, and what is inside each |
| [6. Runtime view](architecture/06-runtime-view.md) | An edit, a render, a read from Formancy Data, switching frameworks over one session, the Studio's preview, a QR-bill, an EPC QR code, an e-invoice, an SVG from the file a person saved to the page, an image from the file a person chooses, a QR-bill's IBAN from its field, an e-invoice's account typed once |
| [7. Deployment view](architecture/07-deployment-view.md) | What is published and where, how a release gets there, and what a host needs |
| [8. Cross-cutting concepts](architecture/08-crosscutting-concepts.md) | Exact values, refusals, final and preview, untrusted input, determinism, version lines, licences, languages, accessibility, the room |
| [9. Quality requirements](architecture/09-quality-requirements.md) | Scenarios stated so that each can fail, and the bounds with how each was chosen |
| [10. Verification](architecture/10-verification.md) | The gates, what each proves, and what none of them sees |
| [11. Risks and technical debt](architecture/11-risks-and-debt.md) | The larger accepted risks with their records, and where the full register is |
| [12. Glossary](architecture/12-glossary.md) | Terms that mean something specific here, and words used for two things |

`scripts/architecture.test.mjs`, in `pnpm test:repo`, fails when a section
file is missing; when a workspace package or app has no row in
[the building blocks](architecture/05-building-blocks.md), or a row names
other dependencies than its manifest declares; when a decision record is
cited by no section; when a relative link here or in a section does not
reach a file or a heading GitHub would give it; and when a path written as
code names nothing the checkout holds
([0026](decisions/0026-the-architecture-is-documented-in-arc42s-sections-held-to-the-repository-by-a-guard.md)).
What a section says about a record, and which layer a package stands in,
are held by review.

## Decisions

The records in [`decisions/`](decisions/README.md) are numbered in the order
they were made, and the index there gives each one's status. Every record
carries a **Verified by** line naming the test or gate that fails when the
decision is violated, or says plainly what nothing checks.

A record that rests on one of formancy.ai's or Formancy Data's cites it as
`formancy.ai NNNN` or `formancy.ai-data NNNN`, with a link, and does not
restate it. These documents do the same.

## Release

| | |
|---|---|
| [The release report](release/README.md) | What every run of the gates reports about itself, what fails it, and what a release does with it |
| [`gates.json`](release/gates.json) | The release gates, each with the evidence a run must pass or the reason it is open |
| [`limitations.json`](release/limitations.json) | For every decision record, the costs a user, integrator or operator meets, one sentence each |
| [The renderer trial](renderer-trial.md) | What chose pdfmake, as the trial measured it |
