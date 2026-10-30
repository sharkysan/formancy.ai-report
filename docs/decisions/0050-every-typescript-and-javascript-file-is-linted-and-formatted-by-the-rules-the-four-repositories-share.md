# 0050 — Every TypeScript and JavaScript file is linted and formatted by the rules the four formancy repositories share, a copy of Formancy Health's with this repository's paths until formancy.ai releases them as `@formancy/code-style`, and `verify` fails a change that breaks either; every finding fixed, a member a store hook detaches declared `this: void`; a branch from before the format merges main through Formancy Data's `scripts/prettier-merge.mjs`; the change merges with a merge commit, so that blame skips the format; rules of this repository's own, warnings, a split ahead of #60 and a squash lost

- **Status:** accepted; numbered while 0049 was held by a branch not yet merged; narrows [0002](0002-depend-on-upstream-never-copy-it.md): its wait for a release, for the lint and format rules, which are a byte-for-byte copy of Formancy Health's until formancy.ai releases them as `@formancy/code-style`, and go when this repository pins it
- **Date:** 2026-10-30
- **Deciders:** Daniel Bacher
- **Verified by:** the guards and `verify`'s two steps, on 30 October 2026,
  each watched failing first, every file a fault was planted in put back
  byte for byte:
  - **`scripts/code-style/code-style.test.mjs`** (`pnpm test:repo`) -- the
    shared rules, on a repository of real files it writes under the
    system's temporary directory: what each rule and each path does.
    Copied with the module from Formancy Health's `0935874`, byte for
    byte, where each case was watched failing
    ([formancy.ai-health 0017](https://github.com/sharkysan/formancy.ai-health/blob/main/docs/decisions/0017-every-typescript-and-javascript-file-is-linted-by-the-recommended-type-aware-rules-and-formatted-by-prettier.md)
    says how).
  - **`scripts/lint.test.mjs`** (`pnpm test:repo`) -- this repository's
    wiring, derived from the files git holds: every TypeScript and
    JavaScript file linted by `pnpm lint` as `eslint .`, by the rules its
    kind is held to and none at `warn`; every tsconfig `pnpm typecheck`
    runs one lint reads, and every TypeScript file git holds in one of
    them; every file resolving to the shared style; and the format
    scripts naming a misformatted file of every extension git holds.
    Watched failing with `lint` narrowed to `eslint packages`, with `cjs`
    dropped from `format:check`, with the untyped glob widened to
    report-spec, with `./apps/*/tsconfig.json` dropped from the
    tsconfigs lint reads, with `font-plugin.ts` dropped from
    `tsconfig.tools.json`, with `{ semi: true }` in `prettier.config.mjs`,
    and with the Studio dropped from the React glob. Like Health's and
    Data's, it never hands ESLint a text other than a file's own, and
    lints each file once: on CI, where `CI=true`, typescript-eslint infers
    a single run, so a text for a path on disk is typed as the file on
    disk, and a file linted twice gives no findings the second time
    (formancy.ai-health 0017). It passed with `CI=true` and without.
  - **`verify`'s `pnpm lint` and `pnpm format:check`**, on every pull
    request and before a release publishes, since `release.yml` runs
    `gates.yml` itself. With `Promise.resolve()` planted as a statement at
    the end of `packages/report-spec/src/version.ts`, `pnpm lint` exited 1,
    naming `@typescript-eslint/no-floating-promises` at 70:1; with
    `export const planted = "x"` planted there instead,
    `pnpm format:check` exited 1, naming the file. Its SHA-256 was the same
    after each, and `git diff --quiet` clean.
  - **`scripts/workflows.test.mjs`**, its case `verify runs the linter and
    the formatter’s check after the typecheck` -- both steps in `verify`,
    after the build and the typecheck and before the guards. Watched
    failing before `gates.yml` ran them (`pnpm lint: expected -1 to be
    greater than 7`); with `pnpm lint` moved before the typecheck, with
    `pnpm format:check` moved after `pnpm test:repo`, with
    `pnpm format:check` removed, with `pnpm lint` renamed
    `pnpm run lint --quiet`, and with the build step renamed
    `pnpm run build`, which a step not found would otherwise pass.
  - **`scripts/prettier-merge.test.mjs`** (`pnpm test:repo`) -- the merge
    across the format, Formancy Data's test of Data's script
    ([formancy.ai-data 0116](https://github.com/sharkysan/formancy.ai-data/blob/main/docs/decisions/0116-every-typescript-and-javascript-file-is-linted-and-formatted-by-the-rules-the-four-repositories-share.md)
    says how each case failed there): a change on one side, against
    main's format of the same lines, merges without a conflict and comes
    in formatted; a change of what a line says on both sides still
    conflicts; and a side Prettier cannot parse merges unformatted, saying
    so. Watched failing here once, all three cases, with the driver
    handing `git merge-file` the three versions unformatted.
  - **`implementable.test.ts`**, in report-core and in
    report-builder-core -- the members declared `this: void` below: an
    implementation with a narrower parameter and a class whose methods
    read `this` compile, and an object literal whose member reads `this`
    does not, by an `@ts-expect-error` per member. Watched failing in the
    typecheck with the members made function-typed properties (TS2328) and
    with `this: void` removed (TS2578).

  **Measured** on 30 October 2026, once each, after `pnpm build`, on an
  Apple M2 with 8 cores and 16 GB under macOS 26.5.2, with Node 22.23.3,
  pnpm 12.4.2, ESLint 10.13.0 and Prettier 3.9.10, while other work ran (a
  load average of 4.5): over the 891 TypeScript and JavaScript files git
  holds with this change, `pnpm lint` took 21.7 s of wall time, and
  `pnpm format:check` 6.6 s. Not measured on CI's runner.

  **Not mechanically enforced:** how the pull request that brings this
  merges, which GitHub leaves to the person merging; that a disable
  comment's reason is true; that `scripts/code-style/` is Formancy
  Health's, or the rules formancy.ai publishes; and that
  `scripts/prettier-merge.mjs` and its test are Formancy Data's. Nothing
  compares a copy with the file it was copied from.

## Context

This repository had no linter and no formatter, and until 30 October 2026
neither had formancy.ai, Formancy Health or Formancy Data. Style was held by habit
and review, and the mistakes only a type-aware linter sees by nobody. The
maintainer asked on 30 October 2026 for a linter and a formatter in all
four repositories, of the same quality, and not to wait for a release to
start. Formancy Health went first and wrote the rules as one module
shaped as the package formancy.ai will publish,
`scripts/code-style/code-style.mjs`
([formancy.ai-health 0017](https://github.com/sharkysan/formancy.ai-health/blob/main/docs/decisions/0017-every-typescript-and-javascript-file-is-linted-by-the-recommended-type-aware-rules-and-formatted-by-prettier.md)).
Formancy Data went second, and wrote the merge across the format
([formancy.ai-data 0116](https://github.com/sharkysan/formancy.ai-data/blob/main/docs/decisions/0116-every-typescript-and-javascript-file-is-linted-and-formatted-by-the-rules-the-four-repositories-share.md)).
formancy.ai merged the package the same day
([formancy.ai 0225](https://github.com/sharkysan/formancy.ai/blob/main/docs/decisions/0225-the-four-repositories-lint-and-format-by-one-set-of-rules-published-here.md),
its pull request #323), and npm did not have it when this was written.
This repository is the last of the four.

What was here differed from the other two in four ways that the decision
answers.

- **The findings.** With this repository's paths, the shared rules
  reported 147 findings before the format and 149 on the formatted tree,
  measured on 30 October 2026: 93 assertions of a type already known, 16
  `unbound-method`, and no more than nine of any other rule.
- **The size budget.** No source file passed 600 lines once formatted,
  measured on `main` at `7795d7d` with Prettier 3.9.10 on 30 October 2026,
  every file over 250 lines formatted: the largest,
  report-builder-core's `property-fields.ts`, went from 524 lines to 596.
  Data had five files to split first; this repository had none.
- **An open pull request near the budget.** #60, the server's drafts,
  takes `scripts/container.mjs` to 598 lines on its branch at `00e0df6`,
  and Prettier 3.9.10 writes 689 of them, measured the same day; on `main`
  it is 464, and 537 formatted.
- **Gates only CI ran.** The container gate needs Docker, the e-invoice
  gate Java, and the browser gate and the pictures' check Chromium; for
  this change only CI runs them.

## Decision

- **The shared rules, with this repository's paths.** `eslint.config.mjs`
  calls `eslintConfig` from `scripts/code-style/code-style.mjs`, and
  `prettier.config.mjs` exports its `prettierConfig`. The directory, the
  module and its test, is Formancy Health's at `0935874`, byte for byte.
  The rules, every one at error; the seven relaxations in a test;
  `require-await` off in every file; `prefer-promise-reject-errors`
  allowing a forwarded `any` or `unknown`; the style, 160 columns, no
  semicolons, single quotes; TypeScript and JavaScript alone; and why each
  is so are formancy.ai-health 0017's and are not restated here.
- **This repository's paths**, held by `scripts/lint.test.mjs`:
  - `project`, the tsconfigs lint types with:
    `./packages/*/tsconfig.json` and `./apps/*/tsconfig.json` by glob, so
    a new package or app is linted with types without an edit, and
    `tsconfig.tools.json`, which `pnpm typecheck` now runs too, bringing
    the vitest, Vite and tsdown configs into it, with the renderer's
    `font-plugin.ts` and `scripts/readme-pictures.ts`, which were in no
    program. The Angular builder's `tsconfig.spec.json` and the Studio's
    `tsconfig.angular.json` are not named: `typecheck` runs neither, and
    no file is in them alone. The tools' typecheck found one error, the
    Studio's Vite config handing `thirdPartyNotices` a list TypeScript
    inferred as `never[]`, which ran as written; a JSDoc type on the
    function in `scripts/third-party-notices.mjs` answers it.
  - `untyped`: `scripts/install-fixture/**`, which imports the packed
    tarballs the workspace does not resolve; the install gate type-checks
    it.
  - `browser`: `apps/studio/scripts/**` and `scripts/pictures/**`, the
    scripts that drive Playwright, whose `page.evaluate` callbacks run in
    a page: found by `no-undef`, which fired 120 times in them and nowhere
    else without the page's globals.
  - `react`: report-builder-react, the product's pages and the Studio,
    the workspaces that declare React.
- **No split.** The budget is CLAUDE.md's and is never raised; nothing
  on `main` passes it formatted, so nothing was split. When #60 merges,
  `scripts/container.mjs` is split by the reason it changes, in a commit
  that moves code without changing what it does, before the merge is
  formatted, as Data split its five.
- **Every finding fixed.** ESLint's own fixes in one commit, the rest by
  hand after it. **No real bug was found.** `no-base-to-string`'s one
  finding was a test double of the Data provider that would have written
  a `Request` as "[object Object]" where the real client hands a string;
  it now reads a string, a URL or a request. Most of the rest were a cast
  that changed no type, a name nobody used or a caught error's `cause`
  passed on; three asked for more:
  - **`this: void` where a store hook detaches a member.**
    `unbound-method` found the React builder and the Studio handing
    `ReportSession.subscribe` and `document` and `ReportEditor.subscribe`
    and `state` to `useSyncExternalStore`, which calls them off their
    object; the getting-started guide hands it `session.hash` so. Those
    five members are declared `this: void` and stay methods, so an
    implementation with a narrower parameter still compiles, which a
    function-typed property would refuse. What `this: void` refuses is an
    object literal written in place whose member reads `this`; a class, a
    closure or an arrow function is unaffected, and nothing in this
    repository was. The CHANGELOG says so, since a host that implements
    either interface may meet it. Members of interfaces no package exports
    became function-typed properties, since nothing outside implements
    them.
  - **The renderer's `Measurement`**, which its measuring pass throws out
    of pdfmake's layout, now extends `Error`, as `only-throw-error` asks,
    and so does the corpus's copy of it in the renderer trial.
  - **Nine disable comments, each with its reason**, all in tests: seven
    `no-sparse-arrays`, each a hole that is the input under test --
    report-forms' and report-runtime's cases that a hole in untrusted
    data, which JSON cannot hold, is refused where it stands -- and two
    `no-loss-of-precision`, each a literal that is the subject, 10^16 + 1,
    a number JavaScript has already rounded. The seven were on `main`
    already, without the reason the shared rules require.
- **The gate:** `verify` runs `pnpm lint` and `pnpm format:check` after
  the build and the typecheck, and before the guards: in `verify` rather
  than a job of its own, which would need a collect step, an upload and a
  reader in the release report
  ([0014](0014-a-release-report-is-derived-from-the-run-that-gated-it.md)).
- **The format commit, merged as it is.** The format is one commit of
  Prettier's output and nothing else, which `.git-blame-ignore-revs`
  names. It fails one guard, `readme-example.test.mjs`: Prettier wrapped
  two calls in `scripts/install-fixture/server.ts` that the server's
  README quotes line for line, and the next commit wraps the README's
  lines the same way. **The pull request that brings this merges with
  "Create a merge commit", never a squash or a rebase**: a squash folds
  the format into one commit with everything else, a rebase gives it
  another SHA, and either way `.git-blame-ignore-revs` names nothing on
  `main`.
- **A merge across the format.** `scripts/prettier-merge.mjs` and its
  test are Formancy Data's, kept identical but for the record they cite
  and a paragraph saying so, so that a change to either is made in both.
  It runs `git merge` with a merge driver, for that command alone, on
  every extension the shared style formats: the driver formats the common
  ancestor, ours and theirs in this repository's style, then
  `git merge-file` merges the three, so a line the format rewrote
  conflicts only where both sides changed what it says. A branch begun
  before the format has neither the script nor Prettier, so it runs the
  script from a checkout of `main` at least as new as the `origin/main` it
  merges, with `pnpm install` run there, as `CONTRIBUTING.md` says. The
  driver merges a file with itself: code `main` moved to another file is
  carried across by hand, and a file only the branch changed comes in as
  it was written, for `pnpm format` after the merge.
- **A copy until formancy.ai releases.** The copy is the repository's
  tooling, under `scripts/`, which no package's tarball carries, and the
  tools are root devDependencies no package declares, so nothing a host
  installs carries it. The swap is a pull request of its own: the
  package pinned exactly as a root devDependency,
  `scripts/code-style/` deleted, the two config files importing the
  package, and `scripts/upstream-deps.mjs` extended to the root manifest,
  which holds no `@formancy/*` dependency until then. Until the swap, a
  rule is changed in the module the four repositories share first and
  copied here, never changed here alone.

## Consequences

**What it buys.** A promise nobody awaits, an `any` from a parse in a
package's source, an assertion of a type already known, a name nobody
uses, a mistyped global in a script, a method handed off its object, and
an object printed as "[object Object]" fail the pull request that brings
them. The style is a check and not a habit, and the same in the four
repositories.

**What it costs.**
- **Blame.** The format rewrote 608 files, 26,407 lines added and 6,843
  removed. GitHub's blame skips the commit by `.git-blame-ignore-revs`;
  `git blame` only with `--ignore-revs-file` or `blame.ignoreRevsFile`
  set; and `git log -S` and `-L` see it, as does any tool that reads
  neither. A bisect that lands on the format commit meets the one guard it
  fails.
- **Every branch open under the format conflicts with it.** #60 and #61,
  open when this was written, do.
  Through `scripts/prettier-merge.mjs` most of those conflicts go, but not
  all: a line both sides changed is still a conflict, a file only the
  branch changed comes in unformatted, code `main` moved to another file
  is carried across by hand, and the script needs a checkout of `main` at
  least as new as the `main` it merges, its dependencies installed.
- **#60 meets the budget.** Its `scripts/container.mjs` is 689 lines
  formatted, so its merge, whichever lands second, carries a split of the
  container gate by hand: CI alone runs that gate, so the split is proved
  where the merge's CI runs it.
- **A copy that can drift.** Until the swap, nothing compares
  `scripts/code-style/` with Formancy Health's or with formancy.ai's
  package, or `scripts/prettier-merge.mjs` with Formancy Data's, and a
  change to one reaches the others by hand alone.
- **Typed lint's time**, inside `verify`'s 15 minutes: 21.7 s on the Mac
  above, not measured on CI's runner.
- **`require-await` is off everywhere**, and **the relaxations hide an
  `any` in a test**, as formancy.ai-health 0017 says.
- **`this: void` refuses an implementation it did not before**: an object
  literal written in place whose `subscribe`, `document`, `hash` or
  `state` reads `this`. Nothing in this repository was one; a host's
  may be.
- **TypeScript's ceiling, twice.** typescript-eslint 8.72.1 admits
  TypeScript below 6.1.0, and `.npmrc` refuses an unmet peer
  (`strict-peer-dependencies`), so a move to 6.1 waits for it as it waits
  for Angular 22, which declares the same ceiling and is the catalog's
  reason for `~6.0.3`.
- **A Prettier release is a reformat**, one more commit for blame to skip.
- **A disable comment's reason** is review's to read: the rule checks only
  that there is one.
- **What only CI ran.** The container gate (Docker), the e-invoice gate
  (Java), the browser gate and the pictures' check (Chromium), and the
  install gate did not run where this was made; the format and the fixes
  reached files each of them reads, and `this: void` the published types
  the install gate type-checks. The build, the typecheck, the lint, the
  format check, the licence guards, `pnpm check:pkg` and `pnpm test:repo`
  ran there, and every package's suite, but for one case of
  report-server's `audit.test.ts`, *two requests waiting on one
  connection*, which fails on that machine on `main` as well and passes in
  CI.
- **The merge method is remembered, not held.** The repository allows a
  squash, a rebase and a merge commit, and nothing refuses the first two.

**What it forecloses.** A rule at `warn`; a style decided file by file;
a rule changed in this repository alone; and, for the pull request that
brings this, a squash or a rebase.

## Alternatives considered

**Biome, no linter, linting per package through turbo, warnings, 120
columns, every kind of file formatted, `allowDefaultProject` for the tool
configs, and a hook before each commit.** Each rejected in
formancy.ai-health 0017, for reasons that hold here; one width across the
four repositories is the point.

**`no-sparse-arrays` relaxed in tests, in the shared rules.** Rejected:
outside a test a sparse literal is almost always a typo, and seven holes
that are deliberate in one repository's tests are seven comments, not a
fourth set of rules.

**Function-typed properties instead of `this: void`.** Rejected: a
property compares its parameters strictly, so an implementation that
takes a narrower listener, which compiles today, would stop compiling;
`implementable.test.ts` holds that.

**Splitting `scripts/container.mjs` here, ahead of #60.** Rejected: on
`main` it is 537 lines formatted and under the budget, and a split here
would move code #60 is still changing, for #60 to carry across by hand
either way. It is split where it passes the budget, in the merge that
takes it there.

**Rebasing the branch on `main` instead of merging `main` into it.**
Rejected: `.git-blame-ignore-revs` names the format commit by SHA, and a
rebase moves it.

**A merge driver of this repository's own, or one in `.gitattributes`.**
Rejected: Data's is tested, and a second driver would be a second thing
to keep right; an attribute names a driver each person's git
configuration must define, and a branch begun before the format has
neither. The script hands git both for one command and writes nothing
to anybody's configuration (formancy.ai-data 0116).

**The shared module changed for this repository.** Rejected: a rule
changed here alone is a fourth set of rules where there is meant to be
one, and none of this repository's findings asked for one.

**Waiting for `@formancy/code-style`.** What 0002 asks of anything
upstream does not yet offer. Rejected: the maintainer said on 30 October
2026 not to wait, and the rules had been proved in two repositories. The
cost is the copy above.

## Older records

[0002](0002-depend-on-upstream-never-copy-it.md) is not superseded. It
still has this repository depend on what formancy.ai releases, at an
exact version, and copy none of it; this record narrows its wait for a
release, for the lint and format rules alone, and the copy goes when the
package is pinned. It was read again and stamped
(`node scripts/release-report/limitations.mjs --stamp 0002`), its Status
line naming this record.
