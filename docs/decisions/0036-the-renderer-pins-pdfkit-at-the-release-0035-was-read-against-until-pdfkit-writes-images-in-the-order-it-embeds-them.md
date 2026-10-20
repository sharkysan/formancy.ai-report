# 0036 — The renderer pins PDFKit at 0.19.1, the release 0035 was read against, until PDFKit writes images in the order it embeds them; a host's override, and leaving it to the range, lost

- **Status:** accepted; extends [0035](0035-the-renderer-writes-the-images-pdfkit-decodes-in-the-order-pdfmake-opened-them.md)
- **Date:** 2026-10-20
- **Deciders:** Daniel Bacher
- **Verified by:**
  - **The renderer's suite, on the workspace's install.** report-render-pdf's
    `src/pdfkit-pin.test.ts` holds that the manifest names PDFKit at an
    exact release and that it is the one pdfmake loads, resolved from
    pdfmake's own directory. With the manifest made to say 0.19.0 it
    failed, on 20 October 2026.
  - **The install gate, on what npm installs.** `scripts/install-fixture/image-order.ts`,
    run by `consume.ts` in the Node host, reads the PDFKit that pdfmake
    loads, resolved from pdfmake's own directory, and the PDFKit
    `@formancy/report-render-pdf`'s installed manifest pins, and throws when
    they differ. Made to expect 0.19.0, it failed with "pdfmake loads PDFKit
    0.19.1, where @formancy/report-render-pdf pins 0.19.0", on 20 October
    2026.
  - **The architecture guard.** `scripts/architecture.test.mjs` fails while
    report-render-pdf's row in the building blocks does not name `pdfkit`
    among its dependencies.

## Context

0035 has the renderer write the images PDFKit decodes before it embeds
them in the order pdfmake opened them, by wrapping three details of
PDFKit 0.19.1 that are not its API. pdfmake 0.3.11 asks for PDFKit at
`^0.19.1`, so a host resolves the newest 0.19 release, and 0035 named the
cost: a later 0.19.x that moved one of those details would print varying
bytes again, or leave a render never ending, found by the install gate at
its next run. On 20 October 2026, 0.19.1 was the only release in that
range; PDFKit had published 0.20.0 to 0.20.2, which pdfmake's range does
not admit.

The maintainer asked for PDFKit to be pinned until PDFKit itself writes
the images in the order it embeds them.

## Decision

`@formancy/report-render-pdf` declares `pdfkit` at exactly `0.19.1` among
its dependencies, beside pdfmake. The renderer imports nothing from it:
the dependency is there so that an install places 0.19.1 where pdfmake
finds it. npm does: a host's install holds one PDFKit, at 0.19.1, which
satisfies both the renderer's exact version and pdfmake's range, and the
install gate holds that pdfmake loads it.

The browser entry is not changed by it: pdfmake's browser build carries
its own PDFKit inside `build/pdfmake.js`, fixed by pdfmake's exact
version.

The pin goes with 0035's wrapper, together, when PDFKit numbers and writes
a decoded image in the order it embeds it and pdfmake takes that release:
the pins in `pdfmake.test.ts` and `browser.test.ts` fail then and say so.

## Consequences

**What it buys.** The PDFKit a host's npm install gives pdfmake is the
one the renderer's suite and 0035's measurements ran on, so a PDFKit
0.19.2 cannot move under a release of the renderer unseen.

**What it costs.**
- **A dependency nothing imports.** The manifest names a package the
  code never loads itself, which a reader may take for a leftover; this
  record and the manifest's place beside pdfmake are the explanation.
- **A host with a PDFKit of its own.** A host that depends on PDFKit
  itself, at a release other than 0.19.1, gets two copies, and which one
  pdfmake loads is its package manager's to decide; the install gate's
  hosts hold no PDFKit of their own, so that case is not measured.
- **npm alone measured.** The install gate installs with npm. Whether
  pnpm or Yarn place 0.19.1 where pdfmake finds it was not measured; a
  host on either can hold pdfmake's resolution with its own `overrides`
  or `resolutions`.
- **A fix upstream waits for this to be undone.** A PDFKit 0.19.x that
  fixed the order would not reach a host until the renderer moved its
  pin, in a release of its own.

**What it forecloses.** Nothing that cannot be undone: one line of a
manifest and one check of the install fixture.

## Alternatives considered

**Leaving it to pdfmake's range, as 0035 did.** Rejected at the
maintainer's request: the install gate finds a breaking 0.19.x only at its
next run, after a host may have installed it.

**Asking hosts to pin PDFKit with `overrides`.** Rejected as the default:
it puts on every host a rule that only the renderer needs, and a host
that misses it gets the failure 0035 names. It stays the way for a pnpm or
Yarn host, as above.

**Pinning pdfmake's dependency through a bundled copy of PDFKit.**
Rejected for the reason 0031 and 0035 give: a copy of upstream.
