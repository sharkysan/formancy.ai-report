# 0079 — Every starter's PDF and Word file are committed as samples held to the build, and the README draws every package in a sketch

- **Status:** accepted; numbered while 0069 was held for a workbook's export and 0070 to 0073 by another branch; narrows [0034](0034-the-studio-and-the-pages-wear-formancys-room-by-importing-the-released-one.md) for an image, and adds six pictures to [0013](0013-the-studio-is-the-same-room-and-its-pictures-are-taken-by-a-script.md)'s
- **Date:** 2026-11-22
- **Deciders:** Daniel Bacher
- **Verified by:**
  - **The samples.** `scripts/samples.test.mjs`, in `pnpm test:repo`,
    in a group of its own that runs once every other guard has finished:
    `samples/` holds what the packages as built write of every starter
    of report-corpus's `STARTERS`, rendered once for the file, and no
    other file -- each Word file, each XML and the index byte for byte,
    each PDF by report-corpus's `inflatedDigest`, its objects with every
    stream inflated; the README's table of the starters is the one the
    same samples write, each row's pages counted by PDF.js and what its
    PDF holds read from the document it is drawn from; two renders of the
    quotation at `CREATED` are the same bytes, and one at another instant
    other bytes, its PDF and its Word file both; the Factur-X's PDF is the
    document the e-invoice gate recorded in
    `scripts/e-invoice/recorded/run.json`, and each e-invoice's XML the
    file it records in `scripts/e-invoice/recorded/corpus/`; and the
    README links every file of the folder and none it does not hold. On
    fixtures: what a document holds -- its tables, charts, pictures,
    codes, slip, first page of its own and text set off the line; a
    starter named as the Studio's picker names it; a copy of an e-invoice
    the runtime refuses thrown, never written as the writer's sentence; a
    starter the writer refuses with no Word file and its row the writer's
    sentence; an e-invoice's row saying which of its files is the invoice
    and which a copy, by its kind; a pipe or a line break kept in its
    cell; the index's prose linking only files the repository holds; the
    README's table missing, edited or there twice; and the check naming a
    Word file changed by a byte, an index edited, a file missing and one
    no starter writes, passing a PDF of the same document in other bytes
    and naming one of another document, or one that cannot be read.
    Watched failing with no `samples/` at all, 27 files missing, with
    `quotation.docx` changed by one byte, with the README's link to
    `invoice.docx` misspelt, and before the README held its table, each
    then put back.
  - **The sketch.** `scripts/architecture.test.mjs`: every workspace
    package and app, read from `pnpm-workspace.yaml` and each manifest,
    is one box of `docs/images/architecture.svg` named by its name
    without its scope, its name painted in a colour of text, dashed by
    `.private`, the one rule that may dash, exactly where its manifest is
    private, inside the viewBox, moved by no transform, and drawn below
    every workspace package that depends on it; no box or name is any
    other; nothing is held in `<defs>` or a `<symbol>` or drawn by
    `<use>`, and nothing hides or fades, by a rule or an attribute; every
    colour it paints, whatever selects it, is in a rule `.fill-<name>` or
    `.stroke-<name>` holding the installed `@formancy/themes/room.css`'s
    `--<name>`, and nothing paints outside those rules; its first shape
    is its own ground, a rect of the room's ground covering its viewBox;
    and `README.md` and
    [the building blocks](../architecture/05-building-blocks.md) show it.
    Each rule is proved on fixtures first, each watched failing there;
    the real sketch watched failing with report-documents' box deleted,
    report-pages' drawn solid and the violet typed one step off, again
    with a name painted the ground's colour, `text { fill:#ff0000 }`, an
    empty `.private` and a box held in `<defs>`, and with the test support
    drawn below the runtime it reads, each then put back.
  - **The pictures.** The six new scenes of `scripts/pictures/scenes.json`
    -- the sales report, the product data sheet in French, the XRechnung
    with Final on, the invoice's Download Word, the order confirmation's
    services table and the payment reminder's QR-bill -- are held as
    every README picture is
    ([0013](0013-the-studio-is-the-same-room-and-its-pictures-are-taken-by-a-script.md)):
    `scripts/pictures/readme.test.mjs` in `pnpm test:repo`, and the
    Studio's `test:pictures` in CI's `browser` job. The pages of the
    starters stand in `docs/starters.md`, which report-render-pdf's
    `pictures.test.ts` holds as it held the README, and the README's two
    of them to its captions.

## Context

The README sent a reader to the Studio to see what Formancy Report
prints. A reader who wants the file itself -- a PDF to open in a viewer,
a Word file to open in Word, an XRechnung's XML for a validator -- had
to clone the repository, build it and run the demo, or open the online
Studio, turn Final on and click a download, starter by starter. The
person who decides asked for demo PDFs and Word files in the repository
to download, for a simpler README with new pictures, and for a drawn
sketch of the architecture.

A file committed is a claim about what Formancy Report prints, and it
drifts as silently as prose: the renderer, the writer, the runtime and
the starters change every week, and a PDF committed once would go on
showing a starter as it printed then. What makes a file the same twice:

- a final render states its creation date, in a PDF's metadata and a
  Word file's core properties, and the Studio and the browser gate read
  it from the clock;
- the Word writer writes the same bytes for the same document, every zip
  entry dated 1 January 1980
  ([0068](0068-a-report-is-written-as-a-word-file-by-a-writer-of-its-own-and-what-belongs-to-its-pdf-is-refused.md)),
  and the XML reads no clock;
- the renderer draws the same bytes for the same document on one machine
  ([0035](0035-the-renderer-writes-the-images-pdfkit-decodes-in-the-order-pdfmake-opened-them.md)),
  but PDFKit deflates every stream with the zlib of the Node it runs on,
  and another zlib may write one stream in other bytes; the e-invoice
  gate records its PDFs by `inflatedDigest` for that reason
  ([0031](0031-an-e-invoice-is-drawn-as-a-pdf-a-3b-that-embeds-its-xml.md)),
  and Node 22 and 24 on Windows were seen to draw the same bytes there,
  and Linux's were never compared.

The building blocks drew the layers as a block of text, and the README
had no picture of them.

## Decision

**`samples/`, written by `node scripts/samples.mjs --write`.** For every
starter of report-corpus's `STARTERS`, in its order: `<id>.pdf`, its
final render of its own data, parameters and images, resolved by the
runtime at one instant, `CREATED`, 2026-10-17T08:00:00Z, the e-invoice
gate's, and drawn by the renderer's Node entry; `<id>.docx`, written by
the Word writer of the same document, or of an e-invoice of its copy,
`eInvoice: 'copy'`, as the Studio's Download Word gives it
([0077](0077-a-report-that-carries-an-e-invoice-is-written-into-a-word-file-as-the-copy-the-runtime-labels-on-every-page.md));
`<id>.xml` of an e-invoice, the runtime's; and `README.md`, an index
generated with them, saying of an e-invoice which file is the invoice and
which a copy, and, where the writer refuses a starter, giving no file and
the writer's sentence in its place. A copy the runtime refuses is the
script's error, never a sentence of the writer's. The names are the
Studio's downloads'. The script imports the packages from their `dist/`,
as the e-invoice gate does, so that the root installs none of them.

**What a row says is read from its file.** Each row of the index, and of
the README's table of the starters, which the script writes as a
generated block of its own, names the starter as the Studio's picker does
and says what its PDF holds: its pages, counted by PDF.js, its language,
and its tables, charts, pictures, codes, slip, first page of its own and
text set off the line, read from the document it is drawn from. Nothing
in a row is typed by hand, so a row cannot say what its file does not
hold; it says no more than a count, either.

**Held to the build in `pnpm test:repo`.** Each Word file, each XML, the
index and the README's table byte for byte, and each PDF by its objects
with every stream inflated, never by its bytes; `--write` leaves a PDF
whose document is unchanged as it was, so that a run on another zlib
rewrites nothing. One instant is the fix at the source: the date is in
the bytes, and a clock would make every run another file. The e-invoice
gate's instant makes the Factur-X's PDF the document veraPDF and Mustang
judged, and each XML the file Mustang and KoSIT's validator judged, which
the guard holds to the gate's record. The guard renders every starter
once, in a group of `test:repo` that runs after every other guard: run
beside them, it took the CPU two of them need.

**The README** links the samples from its opening line and from the
table, and shows two pages of the starters; every page, the invoices'
samples among them, moves to `docs/starters.md`, which
report-render-pdf's `pictures.test.ts` holds as it held the README.

**The sketch.** `docs/images/architecture.svg`: the packages and the two
apps in their layers, each drawn below every package that depends on it,
the test support above the runtime it reads, drawn as a pen draws, each
box twice over, in the room's colours by the room's names, on its own
ground; violet the editing column, teal the column that decides and
prints; dashed what is private. The README shows it, and the building
blocks open with it above their text drawing.

## Consequences

A reader opens a real PDF, a Word file or an XRechnung's XML from the
README, without a build or a browser, and a pull request that changes
what a starter prints shows it as a changed file. The two e-invoice
samples are the very files the e-invoice gate's validators judged.

The cost: every clone carries the samples and the pictures, and git's
history keeps every version of them. The samples are 27 files of 616,698
bytes, the PDFs 455,564 of them, written by Node 24.21.0 on Windows 11 on
22 November 2026, and a change to the renderer's output that moves every
PDF -- a face, pdfmake -- adds about as much again; the six new README
pictures are 1,549,498 bytes of WebP more, and a retake of them as much
again. A pull request that changes what a starter prints now runs
`node scripts/samples.mjs --write` after `pnpm build` and commits what it
wrote, or `pnpm test:repo` fails and says to. `pnpm test:repo` renders
every starter, its PDF and its Word file, once, and the quotation twice
more, after the other guards: a full run took 34.8 to 40.0 seconds in
three runs under Node 24.21.0 on 22 November 2026; with the guard run
beside the others, a run took 17.6 to 24.2 seconds and two other guards
passed their 5-second timeouts in two runs of three. The PDFs' bytes are those the Node of the machine that ran
`--write` deflated, and the guard holds their documents, not their bytes:
a PDF CI would draw of the same document may differ in its streams'
compressed bytes, which no reader sees and nothing here measures on
Linux. The samples are `main`'s, as the online Studio is, and can be
ahead of the latest release; their data is the corpus's synthetic data,
and the invoices among them are samples, never invoices. A Word file's
lines and pages are Word's, and no test opens one. Where the writer
refuses a starter, the index says why rather than offering a file; on 22
November 2026 it wrote every one. What a row says is a count and a list,
not what the starter is for: the README's prose and `docs/starters.md`
say that.

The sketch is drawn, not derived. The guard holds which packages it
names, which it draws as private, that each stands below the packages
that depend on it, that a reader can see each, its colours and its
ground; not the column a box stands in, the line under each name, or that
no word leaves its box, which review holds. A package added to the
workspace fails the guard until someone draws its box by hand: a group of
a rect, a pen's path and two texts, copied from a neighbour, its numbers
moved to a free place below what depends on it and above what it depends
on, and its path drawn again or left as the copy's, since nothing here
generates the pen's wobble. Its colours are typed into it, against
[0034](0034-the-studio-and-the-pages-wear-formancys-room-by-importing-the-released-one.md)'s
rule that nothing here copies the room: an image cannot import a
stylesheet, so each is held to the installed room by its name, and a
release of the room that moves one fails the guard until the sketch is
drawn again. An image loads no web face, so its words are in the
reader's own monospace and sans, of other widths than the IBM Plex it
names. The pictures of the editing -- the switch to Angular, a
diagnostic, a refusal, a phone's width -- move into the README's fold.

## Alternatives considered

- **Files built by CI and attached to each release.** A reader of `main`
  would find no link until a release, a pull request's change to them
  would be seen by nobody, and the release body is the changelog's.
- **Only the online Studio's downloads.** A browser and a click a file,
  `main`'s at any moment, and no address to link a file by.
- **PDFs held byte for byte.** It would fail CI on a Node the files were
  not written on, which is why the e-invoice gate records digests (0031);
  writing them in CI alone would leave a contributor unable to see what
  the guard wants.
- **PDFs deflated again, or written uncompressed, for stable bytes.** A
  sample would no longer be what the renderer gives a host.
- **A preview of each starter, or a PDF/A-2b.** A preview of an
  e-invoice writes no XML and is labelled, and the writer refuses a
  labelled preview (0068); a PDF/A-2b is what a host asks for, and the
  e-invoice gate judges every starter as one already. The samples are
  the plain final render a host gets by default.
- **The clock's date, written once and kept.** `--write` would change
  every file on every run, and the guard could hold nothing.
- **Git LFS.** Every contributor would need it installed to see the
  files, and GitHub meters its storage and its bandwidth.
- **A branch of their own.** The README on `main` would link a state no
  run of `main`'s gates holds.
- **A table of the starters typed in the README.** Its rows said what each
  starter was written to show, and one said a one-page quotation repeated
  its header on each page; nothing held a row to its file.
- **Each language of a starter written in several as a sample of its own.**
  The product data sheet and the payment reminder would add a PDF and a
  Word file a language, for a row that says only what its file holds;
  the Studio prints each language, and `docs/starters.md` shows the
  invoice in four.
- **The samples guard beside the others, with longer timeouts on those it
  slows.** Every guard would wait as long as the slowest under load, and
  a new slow one would fail the same way.
- **Mermaid.** GitHub draws it in its own style, not the room's, and lays
  it out itself; the person asked for a drawn picture.
- **A sketch generated from the building blocks' table.** A layout engine
  for one picture; the guard holds what a generator would have derived,
  the names and what is private, and review the rest.
- **A sketch that follows GitHub's theme by `prefers-color-scheme`.** In
  an image the query reads the reader's system, not the theme GitHub
  shows, so some readers would get dark words on a dark page; a ground
  of its own reads the same on both.
