# 0051 — The demo is served under a content security policy that admits its own files alone, refuses every connection and requires Trusted Types, its one policy the default one that lets PDF.js's worker through; the deploy writes it, and `pnpm demo` and the browser gate serve the Studio under the same function of their own address

- **Status:** accepted; extends [0018](0018-the-studio-demo-is-served-at-formancy-ai-report.md)
- **Date:** 2026-11-05
- **Deciders:** Daniel Bacher
- **Verified by:** guards in `pnpm test:repo` and the Studio's suite, which
  CI runs on every pull request, and the browser gate in CI's `browser`
  job. Each case was watched failing first on 5 November 2026, its fault
  planted once and the file put back:
  - **`scripts/demo.test.mjs`** -- the policy admits scripts, styles,
    faces and the worker from the builds' own directories alone, never
    `'self'`, `'unsafe-inline'`, `blob:` or a scheme; it refuses every
    connection, form, frame, base, object and manifest; it requires
    Trusted Types and allows the default policy and no other; the
    directories it names are the ones the builds write, Vite's default
    `assets/` and the pages' `FILES`; it is one function of the address,
    the same for every address but for the address; an address that is
    not a directory's, as a browser writes it, is refused; `_headers` is
    one rule every file takes, and a header it cannot carry is refused;
    the deploy writes it at the stage's root for the demo's address, and
    refuses a build holding a `_headers` or `_redirects` of its own; the
    gate and `pnpm demo` serve the Studio with it. Failed with `'self'`
    added to `script-src`, with `connect-src blob:`, with
    `trusted-types 'none'`, with the pages' directory renamed here alone,
    with `_headers` not written, and with a build's own `_headers`
    staged.
  - **`apps/studio/src/preview/pdf-document.test.ts`** -- where the
    browser has Trusted Types, the default policy is made, lets the
    worker's address PDF.js is given through and refuses any other,
    and has no rule for markup or a script's text; it is not made again
    where a default policy exists. Failed with the policy not made, with
    it made where one existed, with every address let through, and with
    a rule for markup added.
  - **The browser gate, `apps/studio/scripts/browser-test.mjs`**, every
    pass served under the headers for its own address, with two checks of
    its own: the policy refused the page nothing, and, wherever the
    journey prints, PDF.js printed in its worker. Run whole, every pass
    held both. Each fault was run on the first pass, which walks the
    journey and the two builders' parity. With the Angular builder's
    static `style` put back, the policy's check named the refused
    `style-src-attr`, and two contrast checks in the Angular pane found a
    text overlapped. With the default policy not made, it named the
    refused Trusted Types sink, and the worker's check said the page
    started no worker. With the parity walk's override a `<style>` again,
    the walk stopped in every starter, with text-transform still on.
  - **By hand, on 5 November 2026.** Both builds staged as the deploy
    stages them, served with its headers for a local address, and every
    page opened in Chromium: the Studio's and the sixteen product pages,
    each with its stylesheet and its faces loaded, and nothing refused and
    no request failed. With the pages' directory taken out of `img-src`
    the same run heard 120 pictures refused.

## Context

The demo was served with no content security policy. Formancy Data's and
Formancy Health's demonstrations are served with one, and the privacy
review read the difference from the three responses on 4 November 2026.
The Studio's promise is that what a person writes into it, a report and the
answers it prints, is sent nowhere. The browser gate held that by
listening: the page fetched nothing and hinted no connection outside the
build. Nothing made the browser refuse a request the page should not make.
A report holds untrusted input, SVGs and expressions among it (§8.4), and a
policy is the second line behind the code that reads it.

A policy names what the page needs, so it was measured before it was
written, on 5 November 2026. The browser gate ran once under a strict
policy in report-only mode, every report collected by the server. The
Studio itself broke it in two ways. The Angular builder's host and its
Preview's slot had a static `style="display: contents"`, which Angular
writes as an attribute, and `style-src` without `'unsafe-inline'` refuses
an attribute. PDF.js starts its worker with `new Worker(workerSrc)`, a
string, and Trusted Types refuse a string handed to that sink. Refused,
PDF.js catches the error, turns its workers off for the page, and imports
the worker's code onto the page's own thread: the preview still prints, so
no check would have noticed, but it prints where the page is drawn. The gate
broke the policy in three ways of its own: it added axe as an inline
script, switched text-transform off with a `<style>` it added, and read
each Download PDF by fetching its `blob:` address in the page.

## Decision

**One function states the headers, as Formancy Health's does**
([formancy.ai-health 0012](https://github.com/sharkysan/formancy.ai-health/blob/main/docs/decisions/0012-a-demo-at-formancy-ai-health-fills-a-synthetic-referral-in-the-browser-served-by-a-worker-of-its-own.md)).
`scripts/demo-headers.mjs`'s `headersFor(page)` gives the headers for the
demo at an address. The deploy writes them for
https://formancy.ai/report/ into `_headers` at the root of the staging
directory, as one rule, `/*`. `vite preview` serves `pnpm demo` with them
for its own address. The browser gate serves the Studio with them for the
address it serves it at.

**The policy admits the builds' own files and nothing else.** Scripts and
the worker come from `<page>assets/`, the Studio's. Styles and faces come
from that directory and `<page>site/`, the pages'. Pictures come from the
pages' directory and `data:`, the icon each page names. Every connection,
form, frame, base, object and manifest is refused. Trusted Types are
required, and the one policy the page may make is `default`.

**The Studio makes that policy, for PDF.js's worker alone.**
`apps/studio/src/preview/pdf-document.ts` makes the default policy where
the browser has Trusted Types. It lets exactly the worker's address
through as a script URL, and has no rule for markup or a script's text,
so a string handed to those sinks stays refused. **The Angular builder's
`display: contents` is a style binding**, which Angular writes through the
CSSOM, as formancy.ai's renderer found it had to
([formancy.ai 0079](https://github.com/sharkysan/formancy.ai/blob/main/docs/decisions/0079-a-host-is-undone-without-a-stylesheet.md)).

**The gate measures the page as it is served.** It evaluates axe through
the DevTools protocol. It switches text-transform off with a constructed
stylesheet, and throws if any element still has one. It reads a Download
PDF by clicking the link with its own `click()` and reading the download,
which moves no focus. It listens for every refusal from before the page's
first script, and fails a pass the policy refused anything in. And it
fails a pass whose journey printed with no PDF.js worker started.

The other headers are Health's: no referrer, `nosniff`, no camera,
microphone or location, and Cloudflare's own cache control with
`no-transform` added, so that Cloudflare injects nothing. Not Health's
`noindex`: the product's pages are meant to be found.

## Consequences

**What it buys.** The browser refuses what the gate only listened for: a
request from the page or its worker, a script or style from anywhere but
the builds, a form posted, the page framed. A script Cloudflare injects
from `/cdn-cgi/` of the same origin is refused, since the policy names
directories and not the origin. A string handed to `innerHTML` or a
script's text is refused. The demo, `pnpm demo` and the gate are served
under one function of their address, so what the gate measures is what
formancy.ai serves.

**What it costs.** The policy names two directories by name. If either
build writes elsewhere, the demo loads without that build's files; the
test holds the names to Vite's default and the pages' `FILES`, not to a
build's output. The default policy applies to the whole page. A future
sink that takes a script URL as a string is refused unless it is PDF.js's
worker, and its code would need a rule here. The gate listens in the page,
and PDF.js's worker is not the page: a refusal inside the worker is heard
by nobody. A worker that did not start fails the gate, since a refused
start is the one that matters. Nothing here reads what the address
serves (0018), so a Cloudflare setting that drops a header goes unnoticed
until somebody reads the response; RELEASING.md says to after a deploy.
Chromium alone runs the gate. The product's pages, which no gate opens,
were opened under the policy once, by hand. Hashed assets are revalidated
on every load, as Cloudflare serves them without the header too.

**What it does not do.** The dev server is served with no headers: its
client is an inline script that opens a WebSocket, which the policy
refuses. It says nothing of formancy.ai's own pages, which formancy.ai's
Worker serves. It does not bind a person's own browser or its extensions.

## Alternatives considered

**`'self'` for scripts and styles.** Rejected: it admits whatever the
origin serves. Cloudflare serves the scripts of its own features from
`/cdn-cgi/` there, and Formancy Health's review measured one, admitted,
sending what was typed to the origin.

**`'unsafe-inline'` for styles, for the two style attributes.** Rejected:
it admits a style any injection writes. Two bindings are cheaper.

**No Trusted Types, as Formancy Data's policy has none.** Rejected: the
measured cost was one sink, PDF.js's worker, and one policy of a few
lines. Everything else on the page already passed no string to a sink.

**`trusted-types 'none'`, as Formancy Health's policy has it.** Rejected:
PDF.js would run its worker on the page's thread with no error anybody
sees. That fallback is what the gate's worker check exists to catch.

**A named policy, and a worker port handed to PDF.js.** Rejected for now.
PDF.js takes a port through `PDFWorker({ port })`, but it does not
terminate a port it was handed, so each document's worker would be the
Studio's to end. The default policy changes nothing PDF.js does.

**`connect-src blob:`, for the gate's reads.** Rejected: it loosens the
demo for the gate's convenience. Downloading the PDF is the route a
person takes anyway.

**Formancy Data's shape, a file server that reads the `_headers` the
deploy writes.** Not taken: one function, read by all three servers, is
the shape Formancy Health's demo has, and it needs no server of its own.
