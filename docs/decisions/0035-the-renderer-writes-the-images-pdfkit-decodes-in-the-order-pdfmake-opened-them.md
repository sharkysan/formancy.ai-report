# 0035 — The renderer writes the images PDFKit decodes before it embeds them in the order pdfmake opened them, so that one document renders to the same bytes however its decodes finish; PNGs made to embed at once, a digest by object graph with the claim narrowed, a renumbering pass, one zlib thread and a patched PDFKit lost

- **Status:** accepted; extends [0011](0011-report-render-pdf-draws-the-document-and-refuses-what-it-cannot.md), and the claim [0005](0005-pdfmake-renders-reports-behind-one-adapter.md) makes, that one document renders to the same bytes every time, which this makes true of a document with images PDFKit decodes before it embeds
- **Date:** 2026-10-19
- **Deciders:** Daniel Bacher
- **Verified by:**
  - **The renderer, on the PDF it produced.** report-render-pdf's
    `src/image-order.test.ts` draws, in each entry, as a plain PDF and as
    an e-invoice's PDF/A-3b, a PNG with an alpha channel, one interlaced
    and one whose palette has transparency -- the three ways PDFKit
    decodes before it embeds -- each large and at a size of its own, above
    a 16-pixel PNG with an alpha channel, and reads the PDF back: the image
    objects and the soft masks they name with pdf-lib, through
    report-corpus's `readPdfObjects`, and where each is written from the
    file's cross-reference table, each offset held to the object written
    there (`src/testing/decoding.ts`). The images' widths, in the order of
    their numbers, hold that they are numbered as pdfmake opened them,
    which PDFKit does as it embeds them, with the renderer's order or
    without it. The masks' numbers, and where the images and the masks are
    written, are the renderer's order. On 20 October 2026, 200 renders in
    each of the four rows: with the order removed, those three assertions
    failed in 200 of 200, the widths and the count of masks held in 200 of
    200, and the 200 renders of each row were one PDF -- the defect is in
    the order, not in any variance a second render would show; with it,
    none failed.
  - **The wrapper's own account.** The same file holds `finalizeInOrder`
    on stand-ins for PDFKit's images, decodes finishing in an order of
    the test's choosing: an image waits for every one opened before it
    and is written the moment they are, an image already written is left
    alone, and where one image still decoding cannot be wrapped none is,
    which, removed, failed its test.
  - **The hazard, pinned.** `src/pdfmake.test.ts` and `src/browser.test.ts`
    draw a large PNG with an alpha channel above a small one through
    pdfmake alone, in Node's build and in the browser build, and hold that
    PDFKit numbers and writes the small one's soft mask first: 200 of 200
    renders in each build. Made to order the images, each pin failed.
    When PDFKit numbers and writes its images as it opens them, the pins
    fail and say that `image-order.ts` can go.
  - **The PDFKit a host resolves.** The install gate's
    `scripts/install-fixture/image-order.ts`, run by `consume.ts` on the
    packed renderer after a clean `npm install`, draws the same four PNGs
    as `image-order.test.ts`, so that each of PDFKit's three decodes
    stands ahead of another image, and reads with Node alone that the
    images are numbered, and the soft masks numbered and both written, in
    the order pdfmake opened them; it prints the PDFKit and png-js versions
    it ran on. On 20 October 2026, run against the built package as the
    gate runs it, but by Node's own type stripping where the gate has tsx:
    with the renderer's order removed it threw in 100 of 100 runs, and with
    it in none of 100; and with one decode made to call PDFKit's own
    `finalize` past the image's wrapped one, each of the three in turn,
    the render never settled and Node ended the run with exit code 13 in
    5 of 5 runs each, where the fixture's earlier two PNGs, both with an
    alpha channel, passed with the interlaced or the paletted decode made
    so. On 20 October 2026 the install gate passed with it, on the PDFKit
    0.19.1 and png-js 1.1.0 a clean install resolved.
  - **The e-invoice gate's record.** `scripts/e-invoice/recorded/run.json`
    records `variant-blocks.pdf` by its objects inflated, `fb83eb9e…`,
    which the renderer's order reproduces: drawn 300 times in one process
    as the gate draws it, 300 of 300 gave that digest, where without the
    order 23 of 300 gave three others; and the gate's 19 PDFs, drawn 20
    times as the gate draws them, were each the recorded one every time.
    Nothing was recorded again: on 20 October 2026 the gate passed
    without `--record`, every file judged as its corpus expects.
  - **Reverted and restored.** On 20 October 2026 the call in `engine.ts`
    was removed: the four rows' tests in `image-order.test.ts` failed
    and the renderer's other 699 tests passed; the call was put back, and
    `engine.ts` was byte-identical afterwards.

## Context

The e-invoice gate failed once on pull request #41 (run 39320332202,
attempt 1): `scripts/e-invoice/recorded/run.json records
variant-blocks.pdf as another PDF than this run drew, its objects
inflated`. It passed on a rerun. That variant draws every image kind
report-corpus's `IMAGE_KINDS` holds into an e-invoice. Drawn 30 times in
one process it gave the recorded digest 29 times and another once, and
the two PDFs differed in nothing but which of two soft masks took which
object number: `/SMask 58 0 R` against `59 0 R`.

The cause is how PDFKit 0.19.1 embeds a PNG. pdfmake 0.3.11 opens each
image while it lays the page out, synchronously and in the document's
order, after its last await (`DocMeasure.js` 123, `PDFDocument.js`
77-110, `Printer.js` 36-96), and PDFKit numbers the image's object then
(pdfkit.js 3888). A PNG with a palette's transparency, an alpha channel
or interlacing is decoded first (3926, 3928, 3931), by png-js 1.1.0's
`decodePixels`, which calls `zlib.inflate` with a callback (`lib/png-js.js`
166); in Node that is libuv's thread pool, in pdfmake's browser build its
own zlib behind a `process.nextTick` that is a timer (`build/pdfmake.js`
39312). The callback calls `this.finalize()` (3974, 3990, 3996), and
`finalize` (3935-3953) is where the soft mask is numbered and where the
mask and the image are written. Both the masks' numbers and where each
image is written follow whichever decode finishes first.

When the renderer receives PDFKit's document from `getStream`, laid out
and not yet ended, no decode has called back: 4 of the 13 images of
`variant-blocks.pdf` were still decoding in each of 50 renders per entry.
The renderer then ends the document, and PDFKit writes the last images as
their decodes come back. Most renders came back in the order pdfmake
opened the images, the images being small and their decodes started in
it; a few did not.

Measured on 19 October 2026 on Windows 11 Pro 26200, Node 24.21.0, an
Intel i9-10900K with 20 logical processors and libuv's default pool of
four threads, `variant-blocks.pdf` drawn as the gate draws it: 300 draws
gave 9 distinct files and 5 distinct inflated digests, 268 and 271 of
them the most common; 23 of another 300 gave a digest other than the
recorded one. Eight renders at a time, 30 times, gave 5 of 240 files
unlike the rest. The browser entry gave one file in 100. The raw bytes
vary more often than the inflated digest shows: the interlaced image has
no mask, but where it is written still moves. Drawn among the gate's 18
other PDFs, as the gate draws them, the variant matched its record in 40
of 40 rounds here: the gate meets it rarely, which is how it reached a
pull request before anything failed on it.

Two renders of one document compared with each other could not have
caught it, and none of the renderer's tests did. Counted on 20 October
2026 by a line `finalizeInOrder` wrote at each hand-over, in one run of
the renderer's suite, the line taken out again afterwards: of the 576
hand-overs in the tests the suite held before this record, 3 had an
image still decoding, and only one of them more than one image --
`assets.test.ts`'s page of every image kind in an e-invoice, 4 of its 13
-- in a test that renders it once. A large image's decode, started before a small one's,
finishes after it on every render, so such a document is drawn alike
each time, and not in its order; and a document of small images comes
back in order nearly every time.

This breaks what the repository says: `docs/getting-started.md` ("the
same report, data and date print the same bytes"), 0005 ("one document
renders to the same bytes every time"), 0011's table plans "with the same
bytes as the rules alone produce", the renderer's README, the runtime
and deployment views and §8.5 of the architecture. An integrator may
cache, deduplicate or sign a PDF by its bytes on the strength of them.

## Decision

`written` (`engine.ts`), which both entries hand PDFKit's document to,
calls `finalizeInOrder` (`image-order.ts`) before the final pass's
`finish` and before it ends the document. Every image in pdfmake's
registry still decoding -- a PNG whose `image` is still set -- has its
`finalize` wrapped for that document alone: a decode that finishes marks
its image, and the images are finalized in the registry's order, each as
soon as every one opened before it has been. The registry is keyed by
the names the renderer gives its images, `image0`, `image1`...
(`content.ts`), which no array index is, so it gives them in the order
pdfmake added them, the order it opened them. PDFKit writes every
object itself; nothing is renumbered and nothing written twice.

It rests on one precondition: that no decode has called back before the
hand-over. None can: pdfmake lays the document out in one synchronous
step after its last await, and the steps from there to `written` are
promise reactions, which run before any callback from the thread pool or
a timer. A measuring pass throws out of the layout before it ends, so
never reaches `written`.

A PDFKit that moved what this reads meets one of two ends, and nothing
at run time tells them apart. One that leaves an image still decoding
with no `finalize` to wrap, or none that can be found still decoding, has
its images written as their decodes finish, wrapping none, since one
image left unwrapped would hold every image after it and the document
would never end; a report then prints as it did before this record,
rather than failing. One that kept `finalize` but called it otherwise
than through `this` on one of its three decodes would write that image
past its wrapper, and every image opened after it would wait for it
forever: the render would never end. The install gate draws each of the
three ahead of another image and fails on either.

## Consequences

**What it buys.**
- **One document, one PDF, again.** A document with PNGs PDFKit decodes
  before it embeds renders to the same bytes however their decodes
  finish, in each entry, in one process or with renders running side by
  side; the claims 0005, 0011 and the getting-started guide make are
  true, and none is withdrawn.
- **The e-invoice gate's record holds.** The renderer's order is the one
  most renders already had, so every recorded PDF is reproduced as it
  was recorded, and the gate fails no more on a draw it did not change.
- **No measured time.** The median render of `variant-blocks.pdf` was
  101.03 ms without the order and 100.80 ms with it over 300 renders in
  Node, and 155.40 ms and 155.15 ms over 100 in the browser entry; the
  quotation's, 91.26 ms and 91.43 ms over 100, and the same file either
  way, as every PDF whose decodes came back in order is.

**What it costs.**
- **It reads and wraps three details of PDFKit that are not its API**:
  the registry pdfmake keeps the images it opened in, `_imageRegistry`,
  which pdfmake itself reads and writes, adding each image once it has
  embedded it (`PDFDocument.js` 108-109); a PNG's `image`, set until the
  image is written; and `finalize`, called through `this`. They are typed
  at the boundary in `image-order.ts`, as `pdfa.ts` types `file`. The
  browser build carries the same PNG code (`build/pdfmake.js`
  19288-19416). It is the closest the renderer comes to patching PDFKit:
  a wrapper on PDFKit's objects for the document's life, not a copy of
  its code.
- **A host resolves PDFKit within pdfmake's `^0.19.1`, and png-js within
  PDFKit's `^1.1.0`**, not at the lockfile's 0.19.1 and 1.1.0. A later
  0.19.x that moved one of those details would leave its images in the
  order their decodes finish, or, had it moved how one decode calls
  `finalize`, leave a render with such an image ahead of another never
  ending, unseen by the renderer's own suite, which runs on the
  lockfile's. The install gate holds both on what a clean install
  resolves at each run, and says which versions; a release of PDFKit
  between two runs is not held until the next. On 19 October 2026 npm
  offered 0.19.1 as the newest 0.19.x and 1.1.0 as the newest 1.x of
  png-js.
- **It does not fail closed, and on one change it does not end.** An
  image it cannot wrap is written as its decode finishes rather than
  refused: a byte order is not content, and refusing it would refuse
  every report with such a logo on that host, for a PDF whose every page
  is right. But a decode that called `finalize` past the wrapper would
  hold every image opened after its own, and the render would neither
  print nor refuse. Nothing in the renderer times it out, and its own
  suite would meet it only when the lockfile moved, as a test's timeout;
  ahead of a host, only the install gate meets it.
- **What it does not cover:** the bytes across the two entries, or across
  builds of zlib, which deflate one stream otherwise and are held to one
  document by its objects inflated
  ([0031](0031-an-e-invoice-is-drawn-as-a-pdf-a-3b-that-embeds-its-xml.md));
  and an image that finished decoding before the hand-over, which the
  precondition says cannot happen and nothing checks at run time.

## Alternatives considered

**Embedding the images before pdfmake lays the page out.** pdfmake makes
PDFKit's document and lays it out in one synchronous step, with no hook
between them, and an image embedded beforehand is reused only through
PDFKit's private registry under pdfmake's key; reaching it means building
pdfmake's internal `Printer`, which the browser build bundles. The embed
would still call back.

**PNGs that embed at once.** PDFKit 0.19.1 embeds a PNG without a decode
only when it has no alpha, no palette transparency and no interlacing;
its one transparency without a decode is a colour key's `/Mask`. An alpha
channel cannot become that without loss, and drawing other pixels than
the approved ones is the wrong trade for a byte order. Only interlacing
could be undone losslessly, one case of three.

**A digest by object graph, and the claim narrowed.** A prototype that
numbered the objects by their reach from the trailer gave 300 of 300
unordered draws one digest the same day, where their bytes had 8
distinct files and their objects inflated 4. It would have kept the gate
green, but it withdraws a promise integrators may cache, deduplicate or
sign by, the bytes would still vary, and it hides the defect rather than
mending it. It was the fallback had relying on PDFKit's internals been
refused.

**Renumbering after PDFKit writes.** A second PDF writer, rewriting the
cross-reference table and every reference, under PDF/A.

**`UV_THREADPOOL_SIZE=1`.** The host's process setting, and a package
reads no configuration; nor does it reach the browser build.

**Waiting for every decode, then ending.** Changes no order; or, done
before `finish` and `end`, renumbers every PDF and records the gate again.

**A patched PDFKit.** As 0031 found for its `/CheckSum` and `/ID`: a copy
of upstream, kept in step by hand
([0002](0002-depend-on-upstream-never-copy-it.md)). The fix belongs
upstream -- decode at once, or number and write in the order the images
were embedded -- and asking PDFKit for it is the rightsholder's call; the
pins say when it has arrived.

**Leaving it, and rerunning the gate when it fails.** A gate that passes
on a second try teaches its readers to rerun it, and the PDFs a host
draws would still differ.
