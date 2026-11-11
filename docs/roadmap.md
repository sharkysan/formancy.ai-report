# Formancy Report — roadmap

What comes next, in the order it is meant to come, and what is not planned
at all. What Report does today is [the README's](../README.md#what-it-does)
list, and what each release holds is [the changelog](../CHANGELOG.md); this
page names nothing they do.

It is a plan, not a promise. An item is built when its decision record is
written, and that record may narrow it, split it or turn it down; where the
order changes, this page changes in the same pull request. An item that
lands leaves this page for the README and the changelog in the pull request
that lands it.

## In progress

- **Charts**: bar, line and pie charts of a report's data, drawn as vectors
  in the report's own fonts by Apache ECharts, every number they print
  decided by the runtime, so that a chart never disagrees with the table
  beside it. The model is the first pull request, then the runtime, the
  renderer and both builders.
- **Documents**: images and PDFs printed as pages of a report, from its
  template or from its data, inside its own header and footer and counted
  in its page numbers, everything Report cannot print whole refused before
  a page is drawn. First the one reader of PDFs that the runtime, the
  renderer and the server share, then the component, the builders, the
  server and a formancy form's uploads.

## What a report can hold

1. **Barcodes**: Code 128, EAN-13 and UPC-A, GS1-128, DataMatrix (GS1
   DataMatrix among them, which healthcare and logistics label with) and
   PDF417, each drawn from its own matrix and refused where it may not
   scan, as a QR code is
   ([0020](decisions/0020-a-qr-code-is-drawn-from-its-own-matrix-and-refused-where-it-may-not-scan.md)).
2. **Nested groups**: a table grouped at several levels, each with its own
   header, footer and totals, grouped and aggregated once in the runtime.
3. **More than one dataset**: a second detail dataset, a subreport, and a
   detail nested in a detail -- an order's lines under each order -- each
   resolved by the runtime as the one detail is.
4. **Running totals**: a page's subtotal, carried forward at its foot and
   brought forward at the next page's head, as a German or Swiss invoice
   of many pages prints it.
5. **Crosstabs**: a dataset pivoted by two of its fields, with exact row,
   column and grand totals, refused where its columns would pass the page
   rather than cut at its edge.
6. **Columns and labels**: a body that flows in columns, and sheets of
   labels or cards on a stated grid.
7. **Rich text from data**: a field that holds formatted text -- emphasis,
   lists, headings -- printed in the report's fonts, in a format a record
   fixes and checks, never markup run as it arrives.
8. **Watermarks and backgrounds**: text or an image under every page or a
   range of pages, a letterhead or a "Draft".
9. **A table of contents and bookmarks**: a contents page whose page
   numbers are the PDF's, and the same outline as the PDF's bookmarks.
10. **Positioned elements in the page header and footer**, which the
    format's plan already names
    ([0007](decisions/0007-a-report-definition-is-its-own-versioned-document.md)).
11. **More scripts**: right-to-left text, Arabic and Hebrew, and Chinese,
    Japanese and Korean, shaped as each script is written, with the
    fallback fonts the renderer's plan names
    ([0011](decisions/0011-report-render-pdf-draws-the-document-and-refuses-what-it-cannot.md)).
    Until then a report refuses them, as it does now.
12. **Code in a report**: a script the template carries for what an
    expression cannot say -- a function of its own, a value carried from
    row to row, a step as a page or a group begins -- run in a sandbox
    with no network, no files, no clock and no randomness, held to a
    bound of time and memory, so the same report and the same data print
    the same PDF; and functions the host registers by name and type, which
    a report may call. A record decides the language and the sandbox, and
    how it stands beside the rule that an expression runs no code
    ([0009](decisions/0009-an-expression-is-checked-and-bound-member-by-member.md)):
    a script is untrusted as a template is, and a report that holds one is
    refused where the sandbox is not there to run it.

## What a render can be

1. **An accessible PDF**: tagged, its headings, tables, reading order and
   images' alternative text taken from the report's own structure, and
   held to PDF/UA by a gate.
2. **Excel and CSV**: a report's tables as a workbook and as text, every
   value exact -- a decimal written as a decimal, never through a binary
   number.
3. **Word and HTML**, after Excel.
4. **A signed PDF**: a final render signed (PAdES) with a key the host
   holds and hands to the renderer for that render. Report keeps no key.

## The editor

1. **Copy, paste and duplicate**: a component, or several, within a report
   and from one report into another, its expressions checked again where
   it lands, as formancy's builders carry a field with its rules.
2. **Select several**, and align and distribute them where the layout
   lets them move.
3. **Free placement where a region is positioned**, the page header and
   footer first. The body stays a flow whose pages break where the
   renderer measures them; whether any of it is placed freely is a record
   of its own.
4. **Shared styles and themes** across a tenant's reports, and a gallery
   of templates beyond the starters.
5. **Save in both builders**, over the draft the server keeps
   ([0049](decisions/0049-a-templates-draft-is-kept-by-the-report-server-one-per-tenant-saved-by-compare-and-swap.md)).
6. **The form review's pane** in both builders, and a parameter form
   written from a report's parameters
   ([0048](decisions/0048-a-form-version-that-removes-moves-or-retypes-a-field-a-report-reads-blocks-that-reports-submissions-of-it-until-reviewed-anything-else-prints.md)).

## The server, and what works with it

1. **Publication, render jobs and their artifacts**, and the server's
   image published
   ([0046](decisions/0046-report-has-a-server-of-its-own-over-the-hosts-verified-identity.md)).
2. **Fonts kept beside the images**, and older revisions of a draft kept
   for a stated time.
3. **Renders on a schedule**, each artifact handed to the host to send.
   Report sends nothing itself.
4. **A PDF viewer** published as a component of its own, beside the
   builders.
5. **A consistent read from Formancy Data**, once Data exports a snapshot
   ([0016](decisions/0016-the-data-provider-reads-formancy-data-0-1-0-best-effort.md)).
6. **AI that a person reviews**: an agent proposes report-core commands as
   data, and a person sees what each would change and applies them in one
   undo step, or none
   ([0008](decisions/0008-edits-are-commands-and-a-refused-edit-changes-nothing.md));
   and a server for agents over the Model Context Protocol, as formancy's
   `@formancy/mcp` is, which checks a report before it changes anything.

## Not planned

Each of these is a choice, and the reason is the one the rest of Report is
built on:

- **Data connectors in the editor**, to a database or an API. The host
  hands Report its data, and nothing in a package reaches the network.
- **Anything fetched by address.** An image, a font or a document is one
  the host approved, named by its digest.
- **Drill-down and other interaction inside a report.** A report is a
  paginated PDF, printed as it reads.
