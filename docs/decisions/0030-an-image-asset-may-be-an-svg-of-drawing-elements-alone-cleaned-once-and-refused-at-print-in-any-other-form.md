# 0030 — An image asset may be an SVG of drawing elements alone, cleaned once by report-spec's rules when it is approved into the one form the renderer draws, and refused at print in any other form

- **Status:** accepted
- **Date:** 2026-10-18
- **Deciders:** Daniel Bacher
- **Verified by:**
  - **The rules, in report-spec.** `src/svg.test.ts` and its siblings,
    `svg-syntax.test.ts`, `svg-elements.test.ts`, `svg-style.test.ts`,
    `svg-values.test.ts`, `svg-path.test.ts`, `svg-bounds.test.ts` and
    `svg-threats.test.ts`, cover:
    - every element and attribute of every cleaned drawing found in
      `svg-allow.ts`'s tables, the drawing read back by saxes 6.0.0, a
      parser that is not the writer, and never searched for a phrase;
    - `cleanSvg` a fixed point of itself, the same bytes and nothing
      removed, on every sample and on a thousand seeded mutations of them,
      each read back by saxes;
    - the written drawing ASCII, with no `<`, `>`, `&`, `"` or `'` in a
      value, and the writer refusing to write one;
    - each hazard of the table under *Context* refused with its code or
      removed, and no byte of its value in the message, nor in an element
      path, which repeats a name only as a message may;
    - every refusal ending with what to do, its own advice or its code's,
      a refusal of each code holding its code's;
    - every removal listed by kind and name, the first
      `MAX_SVG_REMOVED_NAMES` names and a count of the rest;
    - every `url(#…)` naming an id the drawing writes, of a gradient for a
      paint and of a clip path for a clip, and every id named, as saxes
      reads them; what is written on an element held to what draws there
      (`WRITTEN_ON`), and a clip rule a clip path would inherit written on
      it;
    - what is kept found from the shapes up, so that a chain of 3,300
      groups each holding the last one's clip path is cleaned in one pass;
    - a mebibyte of each shape of value a pattern or a search could make
      quadratic -- an rgb() of percentages, a number's trailing zeros, the
      spaces of a `url()`, a dash array, a transform list, a class list, a
      selector -- cleaned within `CEILING_MS`, and the cascade refused at
      a unit past `MAX_SVG_CASCADE`'s work and accepted at it;
    - the cascade, a gradient's `href` chain flattened, numbers and units,
      relative steps summed exactly, path data refused whole when it is
      malformed, transforms composed and refused past the bound, shrinking
      past its reciprocal, or drawing a gradient past it in any box inside
      its shape's, an arc's box holding the curves the converter draws it
      with;
    - the root's paint and transform moved onto a group inside it, and a
      link written as the group it draws as, its address gone;
    - each bound accepted at itself and refused one past it, the written
      drawing held to `MAX_SVG_BYTES` as well as the file, a drawing
      written in exactly that many bytes approved and one a byte longer
      refused;
    - what a drawing costs: a curve, a stroke, a dash, more for a dash
      array of more entries, an arc that draws nothing, a clip path for
      every element it clips, a gradient's stops for every shape painted
      with it, and the units of the page-sized transparency groups;
    - `checkSvg` accepting the bytes `cleanSvg` wrote and refusing the same
      drawing in any other form, naming the byte where it differs;
    - one invented sample for each drawing program's way of writing a logo,
      each accepted or refused as *What it costs* says, thirteen in all,
      eight accepted and five refused (`src/svg-exporters.ts`, test
      support, never published).

    `validate-declarations.test.ts` holds the third media type, and a GIF
    or a misspelt type still refused.
  - **The runtime.** `report-runtime/src/lower.test.ts` refuses an SVG
    answer past `MAX_SVG_BYTES` as `invalid-asset` before its bytes are
    read, which a Proxy around them observes, and hands an SVG asset to the
    document with its media type.
  - **On the PDF**
    ([0003](0003-a-rendered-report-is-proved-on-the-pdf-it-produced.md)).
    report-render-pdf's `src/svg.test.ts` reads each drawing back from the
    page and its pixels:
    - no image embedded; a clip of exactly the image's box, with the
      drawing's paths inside it in its own colours and no other, read by
      the corpus's reader through the transparency groups a clip path
      draws into;
    - `contain` keeping the drawing's proportions, centred;
    - by its pixels, `cover` and a transform on the root painting nothing
      outside the box, each beside the same drawing as it came, which does;
    - a root's `fill="none"` printing no fill, and an even-odd rule its hole;
    - an SVG in a page header drawn on every page;
    - `MAX_SVG_DRAWING` at its bound and one past it, an image in a page
      region counted on every page `maxPages` allows, and every 32 bytes of
      a drawing one unit;
    - every SVG image of the body counted against `MAX_SVG_SEGMENTS` and
      `MAX_SVG_GROUPS` as though all fell on one page, beside those of the
      page regions;
    - a template's SVG asset and an image field's, resolved by the runtime
      from a host's lookup;
    - and every PDF it draws holding no annotation, read with the corpus's
      `readAnnotations`.
  - **The guards behind the check.** `src/svg-threats.test.ts` refuses
    each hazard as it came, declared `image/svg+xml`, as `invalid-asset`
    naming the asset and none of its value, with pdfmake's `createPdf`
    never called, a link, a script and metadata among them; then shows the
    renderer's own list of elements refusing what reaches it without the
    check, and the converter's image and warning callbacks refusing what
    reaches them without the list; holds that list to report-spec's
    `SVG_ELEMENTS`; and draws a drawing shrunk to the bound, in a box of a
    point and in one 480 points wide, and a gradient composed to it, in a
    landscape box 550 points wide, where the same drawings past the bound,
    in the form the cleaner would have written them, are refused as
    `invalid-asset` and not thrown.
  - **Every drawing the cleaner accepts, drawn.** `src/svg-converter.test.ts`
    draws the renderer's drawings and a thousand seeded mutations of them
    that the cleaner accepts through the converter's throwing callbacks,
    with no warning, no image opened and no link; holds the worst drawing
    the bounds accept, a zigzag whose every segment crosses the box in a
    clipped group, rasterised page-wide at scale 2, to under sixteen times
    the quotation starter's first page rasterised in the same process; and
    holds the converter's colour names to the cleaner's, `yellowgreen` the
    one name the converter lacks.
  - **pdfmake as it is.** `src/pdfmake.test.ts` pins, at 0.3.11:
    - svg-to-pdfkit opens an `<image>`'s local file past pdfmake's local
      access policy;
    - pdfmake hands the converter what xmldoc writes back of the drawing,
      re-indented, one element a line, with the box's size added;
    - without a warning callback the converter warns to the console and
      draws on;
    - the converter clips the drawing to its viewport, the box;
    - it draws a clip path and a gradient again for every reference, each
      group the size of the page;
    - it writes a link annotation for an `<a>`, `javascript:` included,
      whatever its callbacks say.

    `src/browser.test.ts` holds the browser entry to the Node entry's
    definitions for an SVG and to the paths and clips it draws, read by the
    corpus's reader through every group, refuses every hazard there before
    pdfmake runs, and refuses an image the browser build would open from
    its virtual files. `src/refusals.test.ts` and `src/assets.test.ts` refuse a
    PNG or a JPEG declared an SVG and an SVG declared either, saying what
    the bytes are.
  - **The corpus.** `report-corpus/src/read-pdf.test.ts` reads painted
    paths and rectangular clips where a hand-built PDF puts them, through
    a form and a transform; skips what a soft mask paints, nested masks
    included; judges a clip rectangular by its four corners and never by
    its bounds; and reads a transparency group's form, to which PDF.js
    hands no matrix. `src/drawings.test.ts` fails on a drawing missing, of
    another size, out of order, or a clip with nothing painted in it, and
    finds a page region's drawing on every page. `src/check-ink.test.ts`
    fails on ink in the band around a drawing. `src/checks.test.ts` and
    `src/fixture.test.ts` read a drawing's box as the margin and overlap
    checks read an image's. `src/trial/undrawn.test.ts` holds both trial
    adapters to refusing an SVG image. The corpus's SVG fixtures
    (`src/fixtures/svg.ts`), a mark and a clipped gradient each drawn
    `contain` and `cover` in the body and in a page header on three pages,
    run through `report-render-pdf/src/corpus.test.ts` and `browser.test.ts`
    beside the corpus, each drawing also held to `verifyInk`.
  - **From outside.** The install gate's `consume.ts` cleans a drawing as a
    person saved it with the packed runtime's `cleanSvg`, prints the
    approved bytes declared by their digest on one page with no image in
    the PDF, reads the logo's disc and the clip of its box in the page's
    inflated drawing, which the same invoice without it does not hold, and
    has the drawing as saved refused as `invalid-asset` naming the asset.
  - **In an e-invoice**, beside
    [0031](0031-an-e-invoice-is-drawn-as-a-pdf-a-3b-that-embeds-its-xml.md).
    report-spec's `src/svg-extent.test.ts` holds the extent to drawings
    whose matrices it works out by hand: a skewed group's inverse and where
    it takes the viewBox's origin, a clipped shape's, a gradient's matrix
    outside a group and inside one, a stroke's, one in user space and one
    in the box of a curve, taken over every box inside the curve's control
    points, a group clipped in its own box, with a group inside it, and in
    the box of a curve, held at its far corner; the points the converter
    draws an outline with, a chain of reflected quadratics' and a grown
    arc's; and each stream's nesting. Its `svg-path.test.ts` refuses, in
    every report, a gradient a box inside its shape's would take past
    `MAX_SVG_COORDINATE`, and holds an arc's box to the curves the
    converter draws; its `svg.test.ts` holds the exporter samples it
    accepts to page-sized groups under no shrink and five graphics states.
    report-render-pdf's `src/svg-pdfa.test.ts` draws each drawing the
    defect was measured on, and those found beside it and in its review,
    in an e-invoice: drawn, with no integer past the range in any object or
    content stream of its PDF, read with report-corpus's `readPdfNumbers`,
    or refused as `unsupported` naming the image, pdfmake's `createPdf`
    never called; draws every one in a report that is no e-invoice, those
    refused for their range with integers past it in their PDFs; refuses
    an image in a page header as one in the body, each image of an asset
    in its own box, and on a landscape page by its long side; holds the
    bound to at least every number each drawing's PDF writes, and where it
    passes 10^8 to within twice the largest, four times for a gradient in
    the box of a curve whose control points reach past it; and draws
    report-corpus's `SVG_BOUND` in `SVG_BOUND_SIDE`, refusing it a
    hundredth smaller.
    report-corpus's `src/numbers.test.ts` holds that reader: integers and
    reals as they are written, no number in a string, a name, a comment or
    a reference, an inline image refused, every object's numbers and every
    content stream's, and no other stream's. The e-invoice gate has veraPDF
    and Mustang judge `variant-svg.pdf`, SVGs in every way the converter
    paints one, and `variant-svg-bound.pdf`, `SVG_BOUND` in its smallest
    box, whose groups' boxes reach 1,887,500,000 and whose gradient's
    matrix 2,000,000,000; both were accepted on 18 October 2026.
  - **Each rule, changed on its own, on 18 October 2026.** Each change made
    a named test fail, and was put back. The changes were:
    - report-spec's, 42 in all, each a single change: `use` or `text`
      admitted as removed; a gradient's `href` copied verbatim;
      `!important` admitted; the depth bound raised by one; the root's
      paint left on the root; a byte past ASCII kept; a CSS comment deleted
      in place, or an escape admitted; relative steps summed as floats;
      numbers under a millionth written as they are; a duplicate id
      admitted; a translucent gradient counted as one group unit, the
      group-opacity unit not counted, a clip path counted once and not per
      reference, a stroke once, arcs per quarter turn, dashes and stops per
      use not counted; rules counted rather than simple selectors; an
      inherited `currentColor` not written on a child of another colour;
      removals past the names not counted; references and removals settled
      in one round; `svg:fill` read as `fill`; a processing instruction
      refused inside what is removed; text properties refused rather than
      removed; `zoomAndPan` refused on the root; conditional attributes
      removed rather than refused; a link unwrapped with its attributes
      dropped; `checkSvg` not comparing bytes; the written drawing not held
      to `MAX_SVG_BYTES`; the rule cache keyed on its buckets' heads; an
      internal subset read past; a style in a removed subtree applied; a
      zero-size shape written; an unused gradient kept; a viewBox side
      under one admitted; a malformed path drawn up to its error; the
      writer copying a name it did not generate; a control character
      admitted; a hidden element written; colours written as named;
    - report-spec's, after review, 23 more, each a single change: the
      rgb() percentage pattern that splits a run of digits, trailing zeros
      dropped by a pattern, `url()` read by a pattern with whitespace on
      either side (each failed its mebibyte at a sixteenth of the size, in
      3.1 to 3.7 s against `CEILING_MS`); what follows a clip path's url
      read past; the coordinate bound and the composed one exclusive; no
      bound on the inverse; an element path of raw names; an arc that
      draws nothing counted nothing; every property kept on every element,
      and a stop's paint on shapes; no clip rule written on a clip path;
      the writer writing `url(#)`; the cascade unbounded, a unit loose, its
      declarations not counted; the written form a byte loose; dashes
      counted per entry; no advice of a code's; a colour's advice
      dropped; removal in rounds again, under which the chain of clip
      paths took 2.9 s; a gradient's composite unbounded; an arc's box
      not widened by its ellipse;
    - report-spec's colour table with `coral` mistranscribed, which the
      colour test failed in both pdfmake builds; the clip reads or the stop
      count left out of `drawn`;
    - the renderer's, after review: no bytes in `drawingUnits`, which the
      test of 32 bytes and four weights failed; its list of elements
      without `clipPath`, which the test that holds it to `SVG_ELEMENTS`
      failed; report-spec's inverse bound and its gradient bound each
      removed and the dist rebuilt, under which PDFKit threw
      `unsupported number` from inside pdfmake, an `Error`, and the two
      tests that expect `invalid-asset` failed; and
      `MAX_SVG_SEGMENTS` put back at 30,000, under which the worst drawing
      took more than sixteen starter pages to rasterise and the converter
      test failed;
    - the renderer's: `contain` drawn as `none` and `cover` as `meet`; a
      header SVG counted once and not on every page; the one-page sums of
      segments and groups removed; the stop weight set to 5 and the group
      weight to 0; the check replaced by cleaning at print, which drew the
      link, the script and the metadata the cleaner removes instead of
      refusing them; the list of elements switched off, which twelve
      refusals failed; the image callback unset, in Node and in the browser
      build, which drew the image; the warning callback unset, which drew
      the drawing; `linearGradient` left out of the list, which the batch
      of drawings failed, naming the drawing; the box's width and height
      swapped, which the corpus's fixtures failed, naming the size of the
      clips that were drawn;
    - the e-invoice check's, each a single change: in report-spec, where
      a group's inverse takes the origin measured without its
      translation, the inverse's rows read by their diagonal, a
      gradient's matrix outside a group measured from zero, a group's
      stream given the root's frame or not started again, a save's depth
      counted from the root, a clipped group's box measured without the
      matrices below it, a clip making no page-sized group, each failing
      `svg-extent.test.ts`; and after review, a stroke's gradient not
      measured, a clipped group's box stopped at its first group, a
      gradient in user space measured in its shape's box, a gradient's
      matrix taken in the cleaner's box alone, a clip's box at its near
      corner, the outlines' points not measured, an arc held about its
      end, the stream's matrix not started again at a group, a
      gradient's matrix in a group taken from the root, each failing
      `svg-extent.test.ts`, and the cleaner's gradient bound in its box
      alone, failing `svg-path.test.ts`; the exporter samples held to four
      graphics states, or a group's inverse taken as a shrink, failing
      `svg.test.ts`; in the
      renderer, the bound without its groups, the origin, the page's
      side, the fit's offset in a gradient's, its gradients, its group's
      own matrices, the fit, the drawing's own numbers, the nesting or the
      margin, `cover` read as `contain`, and the check made for every
      report or for none, each failing `svg-pdfa.test.ts`; after review,
      a page region's images passed over, an asset's first image alone
      held, a landscape page read by its height, the outlines bounded by
      a constant and either piece of advice given for every refusal, each
      failing it, and report-spec's gradient matrix in
      the cleaner's box, its clip's box at the near corner and its
      outlines left unmeasured, each with the dist rebuilt, failing it
      too; and in the
      corpus's reader, every number read as an integer, a string's digits
      or a reference's read as numbers, a comment read to the next token,
      an inline image read, a string that does not end read to the end,
      content streams, a page's own or the objects outside them left
      unread, every stream read as content, each failing `numbers.test.ts`,
      and a hex string that does not end read on, under which its test
      never ended;
    - the runtime's SVG byte cap removed;
    - the corpus's: the mask skip, the nested-group count, the null matrix,
      corners rather than bounds, the form's matrix, the clip's restore on
      `Q`; paint ignored in a clip, a region's drawings not matched per
      page, `images()` counting SVGs, the layout checks without drawings,
      their order ignored; the ink band, its edge pixels, its cut at the
      page's edge; the trial's SVG refusal, without which both adapters
      refused an SVG as a broken JPEG; `readAnnotations` reading a link's
      `url` alone, which the `javascript:` link failed;
    - the install gate's renderer rebuilt to clean at print rather than
      check, which failed with "a drawing as saved, never approved, was not
      refused as an invalid asset"; and, after review, its check of the
      logo's drawing applied in a script to the same page without the logo
      and to one whose disc is another colour, both of which it fails.
  - **Faults the tests found before anyone knew of them**, each fixed with
    a test that failed first: the thousand mutations broke the fixed point,
    where a group emptied after references were counted left its clip path
    in, which a second cleaning removed; the specificity test found `.a.b`
    losing its `b` to the rule cache; the converter check found `cleanSvg`
    writing `clip-path="url(#)"` for a clip on a gradient or a stop, which
    `checkSvg` then refused, so that an asset approved so would have been
    refused at every print; and the corpus's reader threw a `TypeError` on
    every PDF with a clip path or a group opacity in an SVG, because PDF.js
    hands such a form no matrix. And a benchmark outside the repository
    found the cascade taking 1.9 s for 256 rules over 10,000 elements,
    until the rules each combination of classes matches were merged once:
    85 to 102 ms, as `MAX_SVG_RULES`' comment says.
  - **Faults review found, on 18 October 2026**, each fixed with a test
    that failed first: two patterns whose time grew with the square of a
    value -- an rgb() percentage's digits and a number's trailing zeros,
    32,000 of either 0.75 to 0.88 s -- which the renderer's check met
    too; elements each of their own classes defeating the cascade's merge,
    9,990 of them 1.8 s; two groups shrinking a millionfold each under a
    clip, accepted, from which PDFKit threw `unsupported number` inside
    pdfmake, an error and not a refusal; arcs that draw nothing counted as
    nothing, so a mebibyte of them cost 42 units of `MAX_SVG_DRAWING`, and
    no term for the bytes pdfmake and the converter read again each time;
    an element path repeating a name past ASCII; a property written on an
    element where it draws nothing, a stop's colour on a shape, which no
    test held; and `MAX_SVG_SEGMENTS` measured on paths whose segments
    were a seventh of the box long, a sixth of what a rasteriser's worst
    costs. Found while fixing them: removal in rounds, a round a link, so
    that a chain of 3,300 groups each holding the last one's clip path
    took 2.5 s; `url()` read by a pattern quadratic in the spaces of an
    empty one; a gradient composed to a million cubed, from which PDFKit
    threw in a landscape box 550 points wide.
  - **A fault measured once 0031 drew an e-invoice as a PDF/A-3b**, on 18
    October 2026, with veraPDF 1.30.3: the drawing of `svg-threats.test.ts`
    shrunk to the bound, approved and drawn a point square on A4, wrote
    /BBox entries of -5,669,000,000 and 78,520,000,000 -- the page's corners,
    56.69 pt of margin and 785.2 pt of page below the image, over the
    fit's 0.01, through the groups' inverse of 10^6 -- which 6.1.13-1 failed
    four times. Found beside it: a gradient inside a group shrunk a
    millionfold wrote a pattern /Matrix of 10^10, which the box does not
    change; a far
    viewBox origin and a translated shrink, boxes of 10^10 and 10^12;
    thirty nested groups, a graphics state 33 deep, which 6.1.13-8
    failed; and a clip in objectBoundingBox units on a grown group, a cm
    of 10^12 in the clip's group, which veraPDF passed, reading no number
    in a soft mask's group. Found in review, where the bound was taken from
    the drawing's own numbers and the cleaner's box of a shape: a gradient
    and a clip in the box of a curve, which the converter measures on the
    outline and the cleaner held by its control points, wrote 5 × 10^12,
    1.25 × 10^11 inside a group, and 2.5 × 10^9 in a clip's group; an arc
    of radii a millionth and a million drawn across a million, which the
    converter grows to reach its ends, wrote control points of -5.2 ×
    10^17 into the page's stream, which 6.1.13-1 failed eight times there
    and in a group drawn by `Do`; and a chain of 2,000 reflected
    quadratics between -10^6 and 10^6 wrote -2,667,000,000, which it failed
    260 times. Each is now drawn within the range or refused, by a test
    that failed first.
  - **Not held by anything here.** That the PDF shows what a browser draws
    of the same cleaned drawing; how a real exporter's file fares, since
    every sample is invented; and every time below on another machine than
    the one it was measured on, CI's included, but for the ratio of the
    worst drawing's raster to a starter page's, which the converter test
    holds wherever it runs; and that the converter's arithmetic strays from
    the cleaner's by no more than the e-invoice bound's margin for
    matrices built to cancel one another term by term.

## Context

**A logo is a vector file.** A firm's mark is drawn in Illustrator,
Inkscape, Figma, Affinity, Sketch or Canva, and kept as SVG. The format
took a PNG or a JPEG alone
([0007](0007-a-report-definition-is-its-own-versioned-document.md)), and
an SVG was refused at every layer: by the validator as a media type it
does not know, by the runtime as bytes of no type a report draws, and by
the renderer as a type it does not draw.

**pdfmake draws SVG through the converter it vendors.** pdfmake 0.3.11
carries svg-to-pdfkit, under the MIT licence
([0020](0020-a-qr-code-is-drawn-from-its-own-matrix-and-refused-where-it-may-not-scan.md)).
Until now it drew only the SVG the renderer writes for a QR code and for
an EPC QR code's frame and caption. Handed an
SVG a customer wrote, it does what a probe found on 18 October 2026, on an
Intel i9-10900K under Node 24.21.0, one `createPdf` pass a case:

| What the file holds | What the converter does |
|---|---|
| `<image href>` or `xlink:href` naming a local file | Opens it through PDFKit, past pdfmake's `setLocalAccessPolicy`, which guards only pdfmake's own providers: a 92,817-byte PDF with two image objects, against 1,260 bytes without |
| `<image href="data:…">` | Embeds it with none of the renderer's image checks: no CRC, no 4096-pixel side, no image-data bound |
| `<a href>` | Writes a link annotation to the address, `javascript:` included |
| `<text>` | Draws it in a face pdfmake chooses, past the glyph check: `AB山田` read back as `AB` and two NULs. pdfmake sets the converter's font callback after the options a caller passes, so the renderer cannot choose the face |
| `<style>` | Reads it as CSS, with selectors of its own subset |
| What it cannot draw | Says so on the console and draws on |
| 5,000 nested groups | Throws `RangeError`: its reader and its drawing both recurse. 1,000 drew in 51 ms |
| A gradient whose `href` names itself through another | Throws `RangeError` after 109 ms |
| `use` fanning out | 10⁵ rectangles from 1,091 bytes took 4.8 s and 1,974 MB; 10⁶ killed the process, out of heap, after about 27 s, which no render can catch |
| `width="1e30"` | PDFKit throws `unsupported number: 1e+30`, naming no asset |
| Two groups that each shrink the drawing a millionfold, under a clip or a group opacity | PDFKit throws `unsupported number`: the converter inverts the matrix to find the page's box, whose corners pass 10²¹ (found by review) |
| A gradient whose transform, the box of the shape it paints and its group's transform each reach a million | PDFKit throws `unsupported number: -1.1e+21` writing the pattern, in a box 550 points wide |
| A mebibyte of arcs that end where they start | Draws nothing, and costs 109 ms a page all the same: pdfmake reads the whole text with xmldoc in every pass, and the converter again on every draw |
| A transform on the root | Moves the drawing and its viewport's clip with it, anywhere on the page, a QR-bill's amount included |
| A clip path, a group with an opacity under 1, a translucent gradient | Draws each again for every element that refers to it, each a transparency group the size of the whole page: 100 shapes of a two-stop translucent gradient, 6 KB, took PDF.js 7.4 s to draw, and 1,000 shapes each clipped by one rectangle 43 s |
| Any drawing in a page header or footer | Draws it again on every page: 1,000 path commands were 7,029 bytes on one page, 17,491 on ten and 58,594 on fifty |

Two readers stand between the file and the page: pdfmake measures the
drawing with xmldoc, a sax parser, writes it back with a size, and
svg-to-pdfkit reads what xmldoc wrote with regular expressions of its own.
They agree on little: its DOCTYPE expression stops at the first `>`, and
they decode characters past U+FFFF apart.

**An SVG is untrusted input**, whoever drew it
([`CLAUDE.md`](../../CLAUDE.md),
[formancy.ai 0022](https://github.com/sharkysan/formancy.ai/blob/main/docs/decisions/0022-fail-open-fail-closed.md)).
And an image field draws an asset its data names, so a drawing a dataset
chose could otherwise paint over a payment slip.

**The rules must be one.** A host approves an asset, a builder's upload
will approve one, and the renderer draws it. builder-core may import
report-core and report-spec alone, so a rule all three apply lives in
report-spec, as SIX's and the EPC's already do
([0022](0022-a-report-carries-one-swiss-qr-bill-at-the-foot-of-its-last-page.md),
[0025](0025-a-report-prints-an-epc-qr-code-held-to-the-epc-rules-beside-the-qr-bill.md)).

## Decision

**An asset may be `image/svg+xml`.** `ASSET_MEDIA_TYPES` gains it. An image
component and an image field draw an SVG as they draw a PNG, in a box,
`contain` or `cover`. It is a draft-format addition: `reportSpecVersion`
stays `'0'`.

**Approval cleans it, once: `cleanSvg`.** A host runs report-spec's
`cleanSvg` over the file where it approves the asset, and keeps the bytes
it returns; the asset is those bytes, and its digest is theirs. The
runtime hands `cleanSvg` on, for a host that approves beside its render
code. It reads bytes, with no `TextDecoder` and no DOM, and:
- **keeps drawing elements alone**: the root `svg`, `g`, `defs`, `path`,
  `rect`, `circle`, `ellipse`, `line`, `polyline`, `polygon`,
  `linearGradient`, `radialGradient`, `stop` and `clipPath`, each with its
  geometry and the paint properties the tables in `svg-allow.ts` list;
- **removes what never draws, and lists it**, by kind and name with a
  count and never a value: the declaration, comments, a DOCTYPE without an
  internal subset, `title`, `desc`, `metadata`, `script`, animation, an
  editor's elements and attributes in their own namespaces, event
  handlers, data and accessibility attributes, rendering hints, inert
  values (`none`, `normal`, `auto`), vendor-prefixed declarations, text
  properties on what is not text, a property written where it draws
  nothing (`WRITTEN_ON`: paint and clips on a gradient, a stop or `defs`,
  a stop's colour anywhere else), hidden elements, shapes of no size,
  what nothing that draws refers to, found from the shapes up, ids
  nothing names. A processing instruction or CDATA inside a removed
  subtree is read past;
- **refuses what would draw unsafely, or otherwise than a browser draws
  it**, with one of `SVG_REFUSAL_CODES` and what to do: text (`text`:
  convert the text to outlines); an embedded picture (`raster`: add it as
  an asset of its own); `use`, `symbol`, a reference to anything but a
  gradient or a clip path in the file, a cycle (`reference`); a DOCTYPE
  with an internal subset, whose entities are never expanded, and an
  entity XML does not predefine (`doctype`: save without Illustrator's
  editing capabilities); patterns, masks, markers, filters,
  `foreignObject`, `switch`, a nested `svg`, `systemLanguage`,
  `requiredFeatures` and `requiredExtensions`, a colour with an alpha,
  `hsl()`, `transparent`, `!important`, an at-rule, a combinator, a CSS
  escape, and anything else the tables do not name (`unsupported`); a
  byte past ASCII in what is kept, or a file not in UTF-8, US-ASCII or
  ISO-8859-1 (`encoding`); a number past `MAX_SVG_COORDINATE`, a transform
  composed past it or shrinking past its reciprocal, a gradient drawn
  under a matrix past it in any box inside its shape's, or a viewBox side
  under one (`out-of-range`); a
  file past a bound, the cascade's work among them (`too-large`,
  `too-deep`). Every refusal says what to do after what it found, its own
  advice where it has one and its code's where it has not;
- **flattens CSS into attributes**, a `style` attribute and `<style>`
  rules of types, classes, ids and their compounds, in CSS's cascade;
- **writes on a clip path the clip rule it would inherit** from a group
  or `defs` above it, which both readers inherit, so that its clip never
  rests on `defs`, which holds no property once cleaned;
- **moves the root's paint and transform onto one group inside it**, so
  that the root holds its namespace and its viewBox alone, a transform
  can never move the drawing off its box, and Figma's root `fill="none"`
  still keeps a stroke unfilled;
- **writes a link as the group it draws as**, its transform and its paint
  kept and its address gone;
- **writes the rest in one canonical form**: ASCII, attributes in the
  tables' order, colours as `#rrggbb`, path data in absolute commands
  whose relative steps are summed as exact decimals, transforms composed
  into one matrix, units converted, nothing under a millionth, ids renamed
  `g1`, `c1` in document order. The writer builds from its own tree and
  never copies a span of the input. Cleaning what it wrote gives the same
  bytes, with nothing removed.

**The renderer draws only that form.** report-render-pdf calls `checkSvg`,
which the runtime hands on: it accepts bytes only when cleaning would
change nothing, and refuses any other, as `invalid-asset`, naming the asset
and what cleaning would change, before pdfmake runs. Nothing is cleaned,
dropped or rewritten at print. Two guards stand behind the check, so that
a fault in the cleaner does not reach the converter as a customer's file
would:
- **the renderer's own list of elements** (`svg-content.ts`), written
  there and not taken from report-spec's tables: printable ASCII, no
  entity, and every tag one of the fourteen, a list a test holds to
  report-spec's `SVG_ELEMENTS`, so that it may never refuse what the
  cleaner writes;
- **the converter's callbacks**: its image callback and its warning
  callback both refuse the asset, and no document callback is set. They
  hold for what they are called for, a file's read and a warning, and for
  nothing else: the converter writes a link without asking, and draws text
  and `use` without a callback, which the check and the list refuse.

`contain` is the converter's `xMidYMid meet` and `cover` its `xMidYMid
slice`, both inside the viewport's clip, which is the image's box.

**Every bound but one is measured.** On 18 October 2026, on an Intel
i9-10900K shared with other work, under Node 24.21.0 with pdfmake 0.3.11,
and in Chromium 156.0.8078.4, Playwright 1.64.1's headless shell drawing in
software, with pdfjs-dist 6.4.299 as the Studio's Preview draws a page.
The aim: at the starters' size of 15 mm, the worst drawing a bound accepts
costs a reader about what one more starter page does, 63 to 89 ms to
pixels at a device pixel ratio of 1. What the bounds give is more: the
worst drawing they accept, a path every segment of which crosses its box,
in a clipped group, costs two to six starter pages at 15 mm and three to
eight page-wide, since at 10,000 segments the zigzag alone already costs
more than a starter page, and a bound low enough to keep the aim would
refuse detailed logos. Each constant's comment in
report-spec's `limits.ts`, and `MAX_SVG_DRAWING`'s in report-render-pdf's
`assets.ts`, says what was measured beside it:

| Bound | What it holds |
|---|---|
| `MAX_SVG_BYTES` | The file, and the drawing as written, which can be several times the file: one MiB each |
| `MAX_SVG_DEPTH` | Levels of nesting, and the longest gradient chain: 32, against a stack that overflowed at 5,000 |
| `MAX_SVG_ELEMENTS` | 10,000 elements in the written drawing |
| `MAX_SVG_SEGMENTS` | What a reader paints, 10,000 weighted segments: a line 1, a curve 3, an arc 3 for each 60 degrees the converter splits it into and 1 when it draws nothing, a stroke its commands twice more, a clip path's commands once for every element it clips, a gradient's stops once for every shape painted with it, and a dash each. A path every segment of which crosses its box cost 0.12 to 0.55 s at this bound, and 1.15 to 1.84 s at 30,000, where the bound stood until review measured that shape |
| `MAX_SVG_GROUPS` | Page-sized transparency groups, 4 units: a clip-path reference 1, a group opacity under 1 1, a shape painted with a translucent gradient 2 |
| `MAX_SVG_STOPS`, `MAX_SVG_DASHES` | 64 stops in a gradient, 32 entries in a dash array |
| `MAX_SVG_COORDINATE` | 10⁶, for any number; for any entry of a transform composed from the root, and of its inverse; and for any entry of the matrix a gradient is drawn under, its shape's and its box's composed with its own, in any box inside the shape's |
| `MAX_SVG_RULES` | 256 simple selectors in all of a drawing's stylesheets |
| `MAX_SVG_CASCADE` | 1,000,000 units of the cascade's work, each rule compared with a combination of classes an element holds and each declaration merged: at the bound the costliest shape measured cleaned in 179 ms, where 9,990 elements each of its own classes had taken 1.8 s |
| `MAX_SVG_REMOVED_NAMES` | 32 names listed among what cleaning removed; chosen, not measured |
| `SVG_INTEGER_BOUND`, `PDF_A_NESTING` | In an e-invoice alone, what an SVG's numbers may reach and how deep it may nest: not chosen, PDF/A's 2,147,483,647, less a margin for rounding derived from `MAX_SVG_COORDINATE` and `MAX_SVG_DEPTH`, 5.7 %, and PDF/A's 28 graphics states |
| `MAX_SVG_DRAWING` | What one render may spend drawing SVGs, 1,000,000 units: a line 1, a curve 3, an element 12, a stop 6, a group 40, each measured against a line, and every 32 bytes of the drawing 1, since pdfmake and the converter read the whole text each time; those drawings measured cost from 13 % less than their units say to 27 % more. An image in the body counts once; one in a page header or footer counts on every one of `maxPages`, known before the render. At the budget the renderer spends about what `MAX_IMAGE_DATA`'s largest images cost it to decode |

**In an e-invoice, what it writes is held to PDF/A's limits.** An
e-invoice is drawn as a PDF/A-3b (0031), which holds an integer to
2,147,483,647 and nests the graphics state 28 deep at most (ISO 19005-2,
6.1.13; veraPDF's rules 6.1.13-1 and 6.1.13-8). PDFKit writes a whole
number as an integer, and svg-to-pdfkit computes a page-sized group's
/BBox as the page's corners through the inverse of all the element is
drawn under, the image's box included, a gradient's /Matrix from where
the innermost group began, in the box it measures on the outline, and an
outline in points of its own -- an arc's with the radii it grows to reach
its ends, a quadratic's reflected after a quadratic walked away from the
path -- so a drawing the cleaner accepts can write numbers past the range
as its box shrinks, or wherever it stands. The cleaner measures once how
far they can reach, the drawing's extent (`svg-extent.ts`): the row sum of
the inverse at every element that makes a page-sized group and where
that inverse takes the viewBox's origin, the matrices of the gradients
painted outside every group, the largest entry of what is written in a
group's own coordinates -- a gradient's matrix inside a group, the box a
clip in objectBoundingBox units draws in -- each over every box inside the
shape's, since the cleaner holds a curve by its control points and the
converter by its outline, the largest point of every outline as the
converter draws it, and the deepest a stream nests; `checkSvg` hands it
on. A gradient a box inside its shape's would take past
`MAX_SVG_COORDINATE` is refused at approval in every report, as one past
it in the shape's box was before, since PDFKit throws past 10^21. The renderer, in an
e-invoice alone (`svg-pdfa.ts`), bounds from it every number the converter
will write for each image, at the image's box and fit and anywhere on its
page, and refuses the image as `unsupported`, naming it and saying to draw
it larger or flatten the transforms under its clips, its transparency and
its gradients -- or, where its own outlines reach that far, to save it
again from its program -- past `SVG_INTEGER_BOUND`: the integer less a margin for
rounding, 5.7 %, derived from `MAX_SVG_COORDINATE` and `MAX_SVG_DEPTH` as
its comment says; and one nested more than 28 graphics states deep in one
content stream, pdfmake nesting nothing around an image. A report that is no e-invoice is no PDF/A, and draws such a drawing
as before. A real, PDF/A-3 holds to 3.403 × 10^38 (6.1.13-2), past the
10^21 at which PDFKit throws: PDF/A-1's 32,767 is not PDF/A-3's.

**A page is held as a drawing is.** Which page a body image lands on is
known only once pdfmake has laid the body out, so every SVG image of the
body is counted against `MAX_SVG_SEGMENTS` and `MAX_SVG_GROUPS` as though
all fell on one page, beside those of the page regions, which every page
draws.

**The corpus proves it on the PDF.** An SVG image is no image object, so
the reader gives every page its painted paths, with their paint and the
rectangular clip each was painted inside, skipping what a soft mask
paints; `drawings.ts` finds each expected drawing as a clip of its size
with paint inside it; and `verifyInk` reads the page's pixels for a band
around each drawing, which must be white, since a path painted inside a
clip may reach past it and only the pixels say what the clip kept in.

## Consequences

**What it buys.**
- **A logo prints sharp at any size**, and a plain export of each program
  sampled is accepted: the eight invented logos cleaned to 483 to 994
  bytes.
- **What prints is in the approved form.** Nothing is dropped, cleaned or
  rewritten at print, so "never silently drop" holds: what the renderer
  draws is bytes `cleanSvg` wrote, or nothing.
- **One set of rules** for every place an SVG enters: a host's approval, a
  builder's upload when it comes, and the renderer. They cannot disagree,
  because there is one of them. The renderer's own list of elements is a
  second copy, on purpose, behind the check: it may refuse more than the
  tables, and a test holds it to their `SVG_ELEMENTS`, so that it refuses
  nothing the cleaner writes.
- **Nothing outside the file is read.** No reference may leave the file, no
  image is opened, no link is written.
- **A bounded cost**, to clean, to render and to read, wherever the logo
  stands, each bound measured and dated.

**What it costs.**
- **Files are refused, and each costs its person a round trip through the
  drawing program.** Of thirteen invented samples, one for each program's
  plain export and the variants a person commonly makes, eight are
  accepted, every plain export among them, and five refused:
  - live text, from Illustrator and from Sketch, until it is converted to
    outlines;
  - Illustrator's "Preserve Illustrator Editing Capabilities", and its
    CS-era files, whose namespaces are entities in an internal subset,
    until they are saved without it;
  - **lettering from Canva**, which writes glyphs as `symbol` and `use`
    and cannot convert text to outlines itself: every Canva logo with
    words is refused, until it is saved again through a program that
    expands references.

  And beyond the samples: a filter, a mask, a blend mode, a pattern, a
  marker, an icon sprite of `use`, a hidden layer that holds text or a
  filter, since an element is judged before CSS says it is hidden; a
  colour with an alpha, `hsl()` or `transparent`, which would have to
  become an opacity, a second decision; a Canva logo of five shapes or
  more, since Canva clips every element and `MAX_SVG_GROUPS` allows four;
  and a drawing past 10,000 weighted segments, about 3,300 curves, which a
  detailed crest or a tagline outlined in a fine face can be, until it is
  simplified in its drawing program.
  The samples are written from what each program is known to write, with
  no real file and no real name, and were never compared with a real
  export.
- **A reader pays for what it paints.** The worst drawing the bounds
  accept -- a zigzag whose every segment crosses its box, in a clipped
  group, with three more clipped shapes -- added 190 ms to a page drawn
  15 mm square at a device pixel ratio of 1 and 392 ms at 2, and 269 and
  550 ms page-wide, against 63 to 89 ms for a starter page, on 18 October
  2026. Every recipient's viewer pays it, and the Studio's Preview pays it
  on every edit. svg-to-pdfkit makes every clip and translucent gradient a
  group the size of the page, so that cost is the page's pixels, not the
  logo's; and a rasteriser pays for a segment on every row of pixels it
  spans, so the cost grows faster than the count, 1.15 to 1.84 s at
  30,000 segments.
- **A logo in a page region is drawn on every page.** A PNG is embedded
  once; an SVG grows the PDF and the render with every page. A header
  logo of 30,000 lines, more than a drawing may now hold, took a render of
  32 pages 2.8 s longer than one of a single rectangle, and each
  translucent gradient wrote about 1.8 kB more on every page.
- **A page limit, not the pages printed, decides.** A header logo is
  counted on every page `maxPages` allows, so at the README's 200 a header
  logo may cost 5,000 units, though the report prints two pages: a logo of
  9,999 short lines, the most one drawing may hold, costs 12,152 units and
  may head a report of 82 pages at most, which the Studio's Preview,
  whose limit is 40, draws and a render limited to 200 refuses. The
  invented logos cost 135 to 318 units.
- **A body's SVGs are counted as though on one page.** A logo of three
  group units, as Figma's fade sample is, printed twice in a body is
  refused, wherever the two fall.
- **A second reader, written here.** The tokenizer, the cleaner and the
  writer are seventeen files of report-spec, 3,540 lines counted with
  `wc -l` on 18 October 2026, comments included, which review reads. The
  saxes read-back and the fixed point are what would find their
  disagreement with another reader.
- **Every host carries some of it.** The renderer calls `checkSvg`, so a
  host that bundles it carries the whole reader. Bundled minified with
  esbuild 0.28.2 from report-spec's built `dist/index.mjs`, as a host
  bundles the package, at 635fe02 and with this record's change, on 18
  October 2026, everything report-spec exports grew from 84,753 bytes to
  145,699; its validator and hash alone, what a builder imports, from
  76,251 to 81,509, the SVG reader's tables, which are built when the
  module loads and which esbuild keeps. Bundled from the source with its
  package.json beside it, whose `sideEffects: false` lets esbuild drop the
  modules a validator never imports, the validator and hash stay at
  76,344; the published file is one module, and gives a host no such
  choice.
- **The browser is not the reference.** That the PDF looks as a browser
  draws the same cleaned drawing is held by the tables and by review; no
  browser's drawing is compared with the PDF. A host shows an approver the
  cleaned drawing, or the PDF, never the file as it came, which a browser
  draws with what cleaning removed.
- **What prints is in the approved form, not proved the approved
  drawing.** The runtime trusts the host's lookup to return the bytes the
  digest pins
  ([0010](0010-the-runtime-resolves-a-report-into-a-renderer-neutral-document.md)),
  so a host could hand over another drawing in canonical form, and it
  would print. 0010's reason, that the runtime has no hash function
  without Node or the DOM, has not held since 0.1.0: report-spec's
  `reportHash` calls `@formancy/spec`'s `schemaHash`, which is
  `@noble/hashes`' SHA-256, pure, in the runtime's dependency closure and
  in every builder's bundle. Checking an image's digest changes what every
  host's resolver must satisfy, and is a decision of its own.
- **Times from one machine.** Every time above and beside the constants
  was measured on one shared machine, in a headless Chromium drawing in
  software, and not in Firefox, WebKit or a browser drawing on a GPU, and
  the renderer's browser build was not timed in Chromium.
  `svg-converter.test.ts` holds the worst drawing's raster to sixteen
  times a starter page's, drawn in the same process, against about eight
  measured here, so that a slower runner is not a slower drawing; how far
  CI's runner keeps that ratio has not been measured.
- **A logo shrunk far inside its box may be refused in an e-invoice.** A
  drawing whose clips or transparency are drawn under a shrink of 10^6, as
  report-corpus's `SVG_BOUND` is, is refused on A4 below 41.6 pt square,
  its `SVG_BOUND_SIDE`; one whose gradient inside a group grows as far as
  the group shrinks, at any size; one whose arc has radii far too short
  for its ends, or whose path chains thousands of reflected quadratics, at
  any size; one nested more than 28 graphics states deep in one content
  stream, at any size. Each draws in a report that is no e-invoice, so a
  template finds out at an e-invoice's render. The invented exporter
  samples the cleaner accepts make their page-sized groups under no
  shrink and nest five deep at most. The bound takes the image anywhere
  on its page, a gradient's and a clip's box anywhere inside the shape's,
  and the largest of each term over the drawing's elements, so it may
  refuse what would have fitted: in the drawings measured, where it
  passed 10^8, it was at most twice the largest number written, and four
  times for a gradient in the box of a curve whose control points reach
  past it. In every report, a gradient a box inside its shape's would
  take past `MAX_SVG_COORDINATE` is now refused at approval, where only
  the shape's own box was held before. It
  is checked against the numbers read back in the tests and the gate
  alone, never at print, and it assumes the converter's arithmetic strays
  from the cleaner's by no more than its margin, which holds for matrices
  that do not cancel one another: those built to cancel term by term,
  whose products floating point gets wrong in both, are not held. The
  groups' `/DeviceRGB` beside the sRGB output intent, which this record
  once left open
  ([0027](0027-a-report-carries-one-en-16931-invoice-written-from-the-values-its-page-prints.md)),
  veraPDF accepts in the gate's two SVG variants.
- **The renderer leans on the converter's internals** at one exact
  pdfmake version: its page-sized groups, its redraw per reference, its
  file read, its link, its clip. `pdfmake.test.ts` pins each, so an
  upgrade that changes one shows. A group of the element's own size, and a
  link callback, would be svg-to-pdfkit's to add; neither is asked of it.
- **0.1.0 refuses it.** A report that declares an SVG asset is refused
  whole by 0.1.0, as `not-one-of` on its media type, and an image field's
  SVG is refused by 0.1.0's runtime as bytes of no type it draws.

**What it forecloses.** Drawing a customer's SVG as it came; following a
reference out of the file; text in an SVG; and cleaning at print. The
format addition is a draft's, and nothing else here cannot be undone: a
bound raised, or `use` inlined, admits more without refusing anything
approved now.

## Alternatives considered

**Draw the SVG as it came, with the converter's callbacks set.** The
callbacks stop the file and the warning. They do not stop the link, which
the converter writes whatever they say: `<a href="javascript:…">` drew,
and PDF.js read the link back, with both of them throwing. Nor the text,
the fan-out, the recursion, the per-reference groups or the two readers'
disagreement.

**DOMPurify, or another HTML sanitiser.** It needs a DOM, which report-spec
does not have and builder-core, which must run the same rules, does not
either. It cleans for a browser's drawing, not for svg-to-pdfkit's, and it
keeps `text`, `image` and `symbol`.

**saxes as the reader in production.** It is CommonJS in a package checked
as ESM-only, and a reader of all of XML 1.0 and 1.1, most of which this
grammar refuses. It would be report-spec's first third-party production
dependency. It stays as the tests' reader, a devDependency, where its
disagreeing with the cleaner is the point.

**Rasterise at approval, to a PNG.** It needs a rasteriser in every host
and builder that the renderer does not share, and it loses the vector the
file was chosen for.

**Clean at print.** It prints something other than what was approved and
hashed, and drops content silently, which 0003 and `CLAUDE.md` forbid.

**Inline `use` and `symbol` under a budget now.** A second expansion with
bounds of its own, against the fan-out that killed the process, for files
the refusal already tells how to fix. It would admit Canva's lettering,
and waits until that is asked for.

**Draw text in an SVG.** pdfmake picks the face, and the glyph check never
sees it: `AB山田` printed as `AB` and two missing glyphs, silently.

**Refuse `stop-opacity` under 1.** A translucent gradient is the costliest
construct measured, two page-sized groups a use. But four group units
admit every sample, Figma's fade among them, and keep the worst of groups
alone at about 0.24 s more a page at a device pixel ratio of 2, so it is
bounded, not refused.

**Keep `MAX_SVG_SEGMENTS` at 30,000, and restate what it costs.** It
admits a logo three times as detailed. But a path every segment of which
crosses its box cost a reader 1.15 to 1.84 s a page at that count, six to
ten times what 10,000 cost, since the cost grows with the count and the rows
each segment spans together; a viewer that stalls for seconds on every
page of a header logo is a cost every recipient pays, and the refusal is
one the logo's author pays once.

**Weight a segment by the rows it spans.** It would charge what a
scanline rasteriser pays and admit long paths of short segments. But the
rows depend on the box the logo is drawn in, which the cleaner does not
know, and on one rasteriser's way of paying; and a weight that is a model
of PDF.js in Chromium is one more number to measure again for every other
reader. The bound counts commands, as every reader pays for them.

**Make the cascade linear rather than bound its work.** Merging the type
rules once per type and the rest per element would beat the shape review
found. But a per-element merge of declarations is still the rules an
element holds times their declarations, which a mebibyte of class names
can make millions; a bound on the work, far above what an Illustrator
export costs, holds every shape at once.

**Expand an internal subset's entities under caps.** Old Illustrator files
would open. But an entity is a second reader of the file's meaning, and
expanding none rules out a billion laughs without arguing about caps; such
a file is saved again without them.

**Write numbers on a fixed decimal grid.** It bounds the written drawing's
growth too. But under a scale of 10⁵ the grid's half step is 5 % of a
viewBox one unit wide, so it moves points the author drew; the exact sum of
the steps the file wrote moves none, and `MAX_SVG_BYTES` holds the written
form instead.

**Count the pages printed, not `maxPages`.** Refusing inside pdfmake's
header callback, which knows the page count, would admit a detailed header
logo on a short report. It is a refusal during layout rather than before
it, and is left until a host needs it.

**Refuse every page-sized group in an e-invoice.** No clip, group opacity
or translucent gradient could then write a box at all. But Figma's and
Canva's samples clip their elements, so most logos would be refused in the
one report a firm most wants its logo on, where the bound refuses only a
drawing shrunk far inside a small box.

**Lower `MAX_SVG_COORDINATE`, or `MAX_SVG_DEPTH`, for every report.** A
group's box grows as the image's box shrinks, and a report may draw an
image at any positive size, so no bound on the drawing alone holds the
box; and either would refuse, at approval, drawings that every report but
an e-invoice draws, which is no PDF/A.

**Read the PDF back and refuse what passes.** It would be exact, the
converter's own arithmetic included, matrices that cancel among them. But
it refuses after pdfmake has drawn the whole document, cannot name the
image that wrote the number, and puts a second reader of PDF syntax into
the published renderer; the bound refuses before pdfmake runs, naming the
image, and the tests and the gate read the PDF back.

**Measure the extent at the image's box when the asset is approved.** The
box is the report's and the page's place pdfmake's, and an approval knows
neither; so the cleaner measures what does not depend on them, and the
renderer adds what does.

**Replay the converter's box of each outline.** The bound would then be
tight for a curve, where among the drawings measured it is four times
loose at worst. But the converter finds a curve's box by solving its
derivative with its own tolerances (`source.js:556-579`, `867-890`),
which the cleaner would copy term for term at one pdfmake version, and a
copy that strayed would bound short; every box inside the box of the
control points holds whatever the converter finds.

**Refuse an arc whose grown radii, or a curve whose reflected control
point, passes `MAX_SVG_COORDINATE`, at approval.** Every number the
drawing writes of itself would then be bounded in every report. But it
would refuse at approval drawings every report but an e-invoice draws,
whose numbers stay far below the 10^21 at which PDFKit throws, so the
cleaner measures them and an e-invoice alone refuses them.
