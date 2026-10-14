# Security Policy

## Reporting a vulnerability

Please report security vulnerabilities through GitHub Security Advisories
("Report a vulnerability" on the Security tab) rather than a public issue.

We aim to acknowledge a report within 3 working days and to provide a
remediation timeline within 10 working days.

Please do not include a working exploit in the initial report; a description of
the vulnerability class and the affected component is enough to begin triage.

## Scope

Formancy Report turns templates and a customer's data into PDF documents, and
serves those documents to people. Templates, expressions, datasets, fonts and
images are untrusted input even when an administrator wrote them. The areas we
consider highest risk, and are most interested in reports about, follow from
that:

- **Cross-tenant exposure**: a dataset, a rendered PDF, a cached artefact or a
  preview reaching a person the host's authorisation did not admit, including
  through a cache key that leaves out the tenant, the principal or the policy
  version.
- **Authorisation bypass** on preview, render or download: a decision taken
  from something the browser supplied -- a tenant, a role, a hidden field --
  rather than from the host's verified identity, or a published report used to
  read data its author could not.
- **Derived disclosure**: a value the person may not read revealed through a
  total, a group label, a sort order, a row count, a validation message or the
  metadata given to an AI model.
- **Remote-resource fetch**: anything that makes the renderer, the server or a
  worker request a URL a template, a dataset or an outsider named. Assets are
  referenced by approved identifier, never by address.
- **Expression and template abuse**: an expression that escapes its typed,
  bounded evaluation, runs code, reads the clock or randomness where a report
  must be reproducible, or exhausts its budget unnoticed.
- **Resource exhaustion**: rows, pages, image pixels, fonts, nesting, time or
  output size that a limit should have refused, and a cancelled job that keeps
  consuming a worker.
- **Parser input**: font, image and SVG files that reach a parser without
  their type, size and dimensions checked.
- **Sensitive data in diagnostics**: a row, a parameter holding personal data,
  a connection detail or a credential in a log line, an error message, a debug
  artefact or an API response.
- **Silent wrong output**: a production PDF that drops rows, truncates content
  or rounds a total without saying so -- an integrity failure, and in scope.

Nothing in the packages is meant to fetch a URL. A report that found a way to
make Report reach the network on an outsider's instruction is in scope and
serious.
