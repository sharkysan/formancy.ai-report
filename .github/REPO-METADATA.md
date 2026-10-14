# Repository metadata

Kept here because GitHub's description, topics and settings live in the
repository's settings, not in the tree. This file is the reviewable source for
what should be set there. Nothing in the repository can read those settings,
so nothing fails when they drift from this file; it is held by review.

## Description

> Design paginated PDF reports from formancy forms, Formancy Data datasets or
> your own JSON, in native Angular and React editors. Source-available; free
> to evaluate and develop, paid in production.

## Topics

```
reporting
report-designer
pdf
pdf-generation
angular
react
typescript
self-hosted
source-available
formancy
```

## Apply

```bash
gh repo edit sharkysan/formancy.ai-report \
  --description "Design paginated PDF reports from formancy forms, Formancy Data datasets or your own JSON, in native Angular and React editors. Source-available; free to evaluate and develop, paid in production." \
  --add-topic reporting --add-topic report-designer --add-topic pdf \
  --add-topic pdf-generation --add-topic angular --add-topic react \
  --add-topic typescript --add-topic self-hosted --add-topic source-available \
  --add-topic formancy \
  --delete-branch-on-merge
```

## Settings

As formancy.ai-data's, set on 2026-10-14:

| Setting | Value | Why |
|---|---|---|
| Delete branch on merge | on | A merged branch is deleted by the merge, never by hand (formancy.ai-data 0036) |
| Ruleset *Protect* | on the default branch: no deletion, no force-push, no bypass, no required check | `main`'s history cannot be rewritten or removed; GOVERNANCE.md says what it does not do |
| Secret scanning and push protection | on | A credential pushed by mistake is refused or reported |
| Dependabot alerts, and with them the dependency graph | on | `security.yml`'s dependency review refuses to run without the graph ("Dependency review is not supported on this repository") |
| Private vulnerability reporting | on | `SECURITY.md` sends reporters to "Report a vulnerability", which exists only when this is on |
| Label `accessibility` | present | As in formancy.ai and formancy.ai-data |
| Environment `npm` | deployment policy: tags `v*` only | The only place `NPM_TOKEN` lives (below) |

## Website

Not yet. Nothing is live for Report, and the *About* field stays empty until
something is.

## Secrets the workflows expect

| Secret | Used by | Without it |
|---|---|---|
| `CODECOV_TOKEN` | `gates.yml`'s coverage upload, passed by `ci.yml` and never by `release.yml`. A repository secret | The upload step is skipped, visibly; with the token set, a failed upload fails that package's `test` job |
| `NPM_TOKEN` | `release.yml`'s `npm-token` and `publish` jobs, on a tag only. A secret of the **`npm` environment**, not of the repository, so a workflow pushed to any other branch or tag cannot read it | A tag push is red in `npm-token`, which runs beside the gates rather than after them, and nothing is published; a rehearsal does not need it |

Both jobs that read `NPM_TOKEN` name the `npm` environment, which
`scripts/workflows.test.mjs` holds. The environment's deployment policy is a
setting of the repository, which no test here can read.
