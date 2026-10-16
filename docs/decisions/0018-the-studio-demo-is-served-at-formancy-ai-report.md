# 0018 — The Studio's demo is served at formancy.ai/report/, by a Worker of its own

- **Status:** accepted
- **Date:** 2026-10-16
- **Deciders:** Daniel Bacher
- **Verified by:**
  - **`scripts/demo.test.mjs`, in `pnpm test:repo`.**
    - `apps/studio/wrangler.json` routes `formancy.ai/report/*`, and
      `formancy.ai/report` without its slash, on formancy.ai's zone.
    - It gives the Worker no code, no workers.dev address and no preview
      address, stages the build where the deploy puts it, and sends the
      path without its slash to the page.
    - README's *Try it* names the address the route serves.
    - The deploy refuses a built page that asks for a file by an absolute
      path.
    - The browser gate serves the Studio under the demo's path.

    Each refusal was watched failing against a configuration check that
    accepted everything.
  - **The browser gate, `apps/studio/scripts/browser-test.mjs`, in CI's
    `browser` job.** Every check of the Studio runs with the Studio served
    under `/report/`. The gate also checks that the page fetched nothing
    outside that path but the web fonts. Against Vite's default absolute
    base it failed: the page never drew its starter picker. With the
    relative base it passed every pass.
  - **By hand, on 16 October 2026.** `node scripts/demo.mjs --dry-run`,
    with Wrangler 4.146.0, read the build's 10 files from the staging
    directory, matched both routes to its `report/` directory, and uploaded
    nothing.

## Context

`pnpm demo` runs the Studio from a clone. A reader without a clone has the
README's pictures and nothing to try. The Studio needs no server: it prints
the PDF in the page from the starters' synthetic data, which the build
carries. So any static host can serve it.

formancy.ai's website is one static deployment from formancy.ai's own
repository: the site at `/`, the playground at `/playground/`. A Cloudflare
Worker named `formancy-ai` serves it, with static assets (formancy.ai's
README, "Build formancy.ai"). That repository is Apache-2.0. This one is
not, which is why it is separate
([0001](0001-a-paid-module-in-its-own-repository.md)).

The rightsholder chose formancy.ai, beside the playground, over GitHub
Pages.

## Decision

**The demo is https://formancy.ai/report/.**

**A Cloudflare Worker of its own serves it.** The Worker,
`formancy-report-studio`, has static assets and no code. It is routed at
`formancy.ai/report/*` and at `formancy.ai/report` on formancy.ai's zone,
with no workers.dev address and no preview address. Cloudflare gives a
route precedence over a Worker on the same hostname's Custom Domain, and a
more specific route precedence over a less specific one. Either way,
formancy.ai's own Worker is unchanged and never sees a request under
`/report/`, and this Worker sees no other request.

**The Studio is built with a relative base.** Vite's `base` is `./`, so one
build is right at the root of `vite preview`, for `pnpm demo`, and under
`/report/`. Static assets are found by the request's whole path, so the
deploy copies the build under `report/` in `apps/studio/.cloudflare`, the
directory the config names. It removes that directory afterwards.

**The browser gate serves it where the demo is.** It serves the build under
the path read from the Worker's config, so every check is a check of the
build as formancy.ai serves it. The check on what the page fetched is held
to that path.

**The rightsholder deploys it by hand,** with `pnpm demo:deploy`. The
command:
- builds, then checks the config and the built page;
- runs Wrangler at a pinned version, with its telemetry off;
- refuses a checkout with uncommitted changes, so the deployment's message
  names the commit it holds.

Nothing in CI deploys it. RELEASING.md says when to deploy.

## Consequences

**What it buys.**
- **A demo with nothing to install.** Anyone can open it. It has both
  builders and the PDF printed in the page, beside formancy.ai's
  playground.
- **The gated build in the served shape.** The browser gate runs the build
  under `/report/`, as formancy.ai serves it, not only at a root.
- **formancy.ai untouched.** Its repository, its build and its Worker carry
  none of this repository's code, so its licence stays true without
  qualification.

**What it costs.**
- **Deployed by hand.** Nothing checks that what formancy.ai/report/ serves
  is main's or the latest release's. The deployment's message names its
  commit, and Cloudflare's dashboard shows it. A forgotten deploy leaves an
  older Studio online.
- **A public page that asks Google for its fonts.** formancy.ai's site and
  playground do the same, so a visitor's browser sends Google their
  address. The Studio still says `noindex`, as it did as a local app.
- **Cloudflare's account holds the rest.** The Worker, its routes and
  whatever the zone adds, such as caching or headers, are in the
  rightsholder's account. Nothing here reads them. The Worker sets no
  header of its own, and neither does formancy.ai's site.
- **Chromium alone,** like the gate.
- **The routing is checked only once deployed.** Nothing in CI asks
  Cloudflare anything. The precedence of the routes over formancy.ai's
  Worker is Cloudflare's documented behaviour. Whether formancy.ai/report/
  answers is checked by hand after a deploy.

**What it forecloses.** Nothing that cannot be undone: deleting the Worker
gives `/report/` back to formancy.ai's 404.

## Alternatives considered

**GitHub Pages, at sharkysan.github.io/formancy.ai-report/.** Not chosen.
It is a second address for the product beside its website, though one that
a workflow could deploy with no secret.

**Copy the built Studio into formancy.ai's build, as its playground is.**
Rejected. It would put this repository's code into an Apache-2.0
repository's build and deployment, which 0001 keeps apart. It would also
tie the demo to formancy.ai's releases.

**A subdomain, report.formancy.ai, as a Custom Domain.** Rejected. It would
serve the build at a root and need no path, but it is not beside the
playground, and it is a second hostname for one site.

**Build with `base: '/report/'`.** Rejected. `pnpm demo` would have to
serve under `/report/` as well, and the built page would hold the path the
config already says. The relative base is right in both places.

**Deploy from CI on each release.** Not now. It needs a Cloudflare token in
the repository, a secret that can change formancy.ai's zone, for a page
that changes once a release.
