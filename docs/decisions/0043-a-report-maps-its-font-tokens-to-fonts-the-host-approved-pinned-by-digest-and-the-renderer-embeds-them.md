# 0043 — A report maps its font tokens to fonts the host approved, pinned by digest; the renderer embeds them from the bytes the runtime hands over, through pdfmake's virtual files, and refuses a face not mapped, a character the face lacks and the scripts nothing here has proved; the QR-bill keeps Liberation Sans

- **Status:** accepted; extends [0006](0006-dependencies-and-fonts-allow-public-source-and-licensed-production.md) (a host's fonts are outside its guard, and their licence is the customer's), [0007](0007-a-report-definition-is-its-own-versioned-document.md) (the font map is part of the definition the hash names), [0010](0010-the-runtime-resolves-a-report-into-a-renderer-neutral-document.md) (the resolver is widened to fonts and hands their bytes over), [0011](0011-report-render-pdf-draws-the-document-and-refuses-what-it-cannot.md) (the renderer embeds more than Roboto now, and refuses what it cannot draw in a host's face), [0031](0031-an-e-invoice-is-drawn-as-a-pdf-a-3b-that-embeds-its-xml.md) (a PDF/A-3b may embed a host's face) and [0040](0040-a-font-is-read-by-report-specs-own-reader-which-says-what-it-may-be-embedded-as-and-which-characters-it-draws.md) (the reader the format, the runtime and the renderer all read a font through, which now bounds what subsetting a font costs, holds a face's line to what pdfmake can lay out and hands back every PostScript name a face states), and closes the layout-table risk 0040 left open; numbered before 0044 and 0045 and merged after them
- **Date:** 2026-10-22
- **Deciders:** Daniel Bacher
- **Verified by:**
  - **The format**, report-spec's `validate.test.ts` and `font-map.test.ts`:
    the `fonts` map read as part of the report and read back whole, each
    family's faces over the assets it declares; a face mapped to an image
    refused `asset-not-a-font`, a font drawn by an image
    `asset-not-an-image`, an asset declared `font/otf` `not-one-of`, a print
    style that sets bold or italic in a mapped family without that face
    `missing-face`; and `hash.test.ts`, the map part of the report's hash,
    whatever the order of its keys.
  - **The bounds on a font's outlines**, report-spec's `font.test.ts`: the
    points of all its glyphs together accepted at `MAX_FONT_POINTS` and
    refused one point past it, their points times contours at
    `MAX_FONT_OUTLINE_WORK`, and their composites' components at
    `MAX_FONT_COMPONENTS`.
  - **The characters printed**, report-spec's `font-scripts.test.ts`: a
    character of each script around the printed ones refused, the ones a
    denylist let through among them, each bidirectional control refused,
    every printed entry to its bounds and nothing just outside them; and
    report-render-pdf's `scripts.test.ts`: every code point of every printed
    block of the Latin, Greek, Cyrillic, Common or Inherited script, or
    private use, by the Unicode data fontkit chooses its shapers by, and
    every character Roboto maps printed.
  - **report-core**'s `diagnose.test.ts`: a font asset a token maps is used,
    and one no token maps is unused, named as a font, not an image.
  - **The runtime**, `lower-fonts.test.ts`: each mapped face resolved to the
    bytes the host handed over, copied, read with `readFont` before it is
    handed on, fetched once however many tokens share it; a face the host
    has no bytes for, a lookup that throws, an answer that is not a font,
    one past `MAX_FONT_BYTES`, refused before it is copied, one whose fsType
    forbids embedding and one `readFont` refuses each refuse the render, in
    a preview too.
  - **The renderer, on the PDF it produced** (0003): report-corpus's
    `host-fonts` fixture through `corpus.test.ts`, Latin, Greek and Cyrillic
    in Liberation Serif and Mono, every run held to its face's PostScript
    name after the subset prefix (`read-pdf.ts`'s `PdfTextItem.font`,
    `check-text.ts`'s `fontNames`), the text extracted verbatim, every font
    embedded. And `host-fonts.test.ts`, each face read from the PDF where it
    prints: text with no token and a table's cells and bold header in a
    mapped sans, never in Roboto; the QR-bill's slip in Liberation Sans
    with sans mapped to another face; each render in the bytes it was
    handed, whatever another handed under the same digest; a character the
    face lacks refused naming the face and the code point, U+FFFD among
    them, which Roboto has; a page field whose face has no digits; a face
    the family does not map; a right-to-left script and a bidirectional
    control the face maps; a table held to the italic face only where it
    prints its empty text; a line a face makes taller than the body, in a
    paragraph, in a table and in a run of another face than its
    paragraph's; each line's least height taken from the face it prints in,
    a paragraph's from its tallest run's, 42 lines of two faces printed on
    the page they fit and 43 refused by the bound, and a hundred lines and
    sixty rows in Roboto refused by the bound beside a mono face of half
    the size, before pdfmake is handed them; a face whose line is nothing,
    below nothing or 4 units to the em refused `invalid-asset`; the
    measuring sentinels in Roboto under a sans of the tallest line the
    reader accepts, four times its size; a Restricted License, No subsetting, Bitmap
    only, collection or variable font refused `invalid-asset` naming the
    asset; the same document drawn to the same bytes; two renders of one
    face at once, the second started at each of twenty points of the
    first's passes; no host face left in pdfmake's virtual files after a
    render or a refused one; one asset named by two tokens read and filed
    once, and one id handed in two byte strings refused `invalid-asset`
    naming it alone, a copy of the same bytes read once; and every face
    the engine is handed with its layout tables zeroed, the crafted ones
    below rendered.
  - **The faces PDFKit tells apart**, `face-identity.test.ts`, each on the
    render: a host face of the PostScript name of the renderer's own
    Liberation Sans or Roboto Regular and a line of its own refused
    `invalid-asset`, beside a QR-bill's slip and opened before and after
    Roboto, naming the asset and the renderer's face and not the font's
    name; a second host face of the first's name and other bytes refused,
    naming the first; a face whose best name is its own and whose later
    record is Liberation Sans's refused; a face named `null` refused, in
    which PDFKit had drawn the face it opened next, without a word, and one
    named `constructor`, `__proto__`, `toString` or `valueOf`, where PDFKit
    threw a TypeError; a host face of the renderer's own Liberation
    Sans bytes handed to the engine whole and printing a slip run for run
    as the sans unmapped does; two host assets of one font's bytes
    printed; and `drawnAs` knowing each of the renderer's six faces by its
    own bytes. `fonts.test.ts` holds `OWN_FACES` to the files, by the name
    fontkit reads and the digest of the bytes, and report-spec's
    `font-names.test.ts` holds `postScriptNames` to every record's name,
    once each.
  - **One walk of a table's cells**, `tables.test.ts`'s `styledRows`: the
    header in its style, the empty text in italic across the table, a cell
    in its row's style under a null cell style. `refusals.test.ts`: a row's
    96 pt style under a null cell style, and an empty cell of 96 pt,
    refused as taller than a body of 100; a style below `MIN_FONT_SIZE` or
    past `MAX_FONT_SIZE` refused, 20,000 paragraphs at 0.001 pt among them.
    `host-fonts.test.ts`: a header of no size and the empty text in italic,
    in a face of a 4 em line, refused as taller than a body of 30.
    `bounds.test.ts`: a row counted by each cell at its own size, and the
    empty text's row counted. `tables.test.ts`: in a face of a 2 em line,
    a row and the empty text refused where a page cannot hold their line
    under the table's repeated header, and printed whole where it can, as
    0011's fix of 22 October 2026 holds it in Roboto.
  - **The layout tables**, `strip-layout.test.ts`, against the fontkit
    PDFKit loads, whose version it pins: a `morx` that never advances, in a
    face the reader accepts, gave no answer in two seconds and stripped was
    laid out and embedded; a GSUB fontkit throws "Unknown version 10" on
    was laid out once stripped. `browser.test.ts`: the browser entry embeds
    a host font the Node entry does, every object alike, drawn to the same
    bytes twice, and draws the throwing face through the fontkit pdfmake's
    browser build bundles. `pdfmake.test.ts` pins that pdfmake's virtual
    files are a `storage` object a key can be deleted from.
  - **From outside**, the e-invoice gate: a `variant-host-fonts.pdf`, the
    `host-fonts` fixture carrying the first sample's e-invoice, drawn as a
    PDF/A-3b and accepted by veraPDF and Mustang alike, recorded with
    `--record` and judged without it; and the install gate's Node consumer,
    which renders a report mapping the packed Liberation Sans and finds that
    face, subset, the one font its PDF embeds, and refuses a copy of it with
    its line gap a unit more, PDFKit drawing two faces of one name as one.
  - **Each rule, broken on its own.** On 22 October 2026 the font-map
    validation, the runtime's hand-over, the renderer's face resolution, the
    character rules and the layout-table strip were each broken in turn and
    put back, and a named test failed for each; and as review's findings
    were applied, thirteen breaks of the renderer's -- names by digest, a cache by digest, the
    strip, the cleanup, the default face, the face's glyphs, its line, the
    floor, the cells' line, the sentinels, the empty text, the page field,
    the bidirectional controls -- each failed `host-fonts.test.ts`, and the
    outline bounds, the `font/otf` refusal, the read map, the runtime's size
    and the image library's font filter each failed their own. And after a
    security review, on 22 October 2026, a table row counted in another
    face than its cells', and the sentinels in the mapped sans under the
    tallest line the reader accepts, each failed `host-fonts.test.ts`; the
    three crafted lines, the bound by the smallest line in play and the
    paragraph's tall line by its own face had failed it before the fix.
    And after a second review, on 22 October 2026: the identity rule left
    out of the plan failed twelve of `face-identity.test.ts`'s cases, a
    digest of `OWN_FACES` changed failed `fonts.test.ts`, the bound counting
    each cell at the table's size failed `bounds.test.ts`, the walk taking
    no row style under a null cell style failed `refusals.test.ts`, the
    walk leaving the empty text out failed `host-fonts.test.ts` and
    `bounds.test.ts`, and its header without the header's style failed
    `host-fonts.test.ts`; each was put back. And after its re-check, on
    22 October 2026, each case written before its fix failed first: the
    plan reading one id in two byte strings as one face printed the second
    in the first's bytes and failed `host-fonts.test.ts`, and the line
    under a repeated header, 0011's rule, failed `tables.test.ts`, nine of
    its cases printing the table without the row's line.

## Context

0.2.0 printed one family, Roboto, `serif` and `mono` refused (0011). A firm
prints in its own typeface, as it prints its own logo; the owner chose
"Report features" for 0.3.0, fonts a host supplies among them, and accepted
its plan's recommendations (FT-Q13 to Q20). 0040 built the first of three
steps: report-spec's `readFont`, one reader of what a font is and whether it
may be embedded, which the format, the runtime and the renderer share. This
is the second: a report names a host's fonts, the runtime hands their bytes
over, and the renderer embeds them.

0040 left one risk open, and this record must close it before a report may
name a host font. fontkit, which PDFKit lays every run out with and subsets
the face with, runs the font's layout tables at print -- GSUB, GPOS, kern
and the AAT `morx` state machine -- and `readFont` does not read them. A
`morx` table of one state whose one entry does not advance, in a font the
reader accepts, kept PDFKit laying "A" out until it was stopped after 20
seconds on 22 October 2026; fontkit's `AATStateMachine.process` has no bound
on its steps, and a render pass cannot be interrupted (0011). So an accepted
host font could hang a render's thread for good. 0040 left what subsetting
a large font costs to the renderer to measure, too, and review asked for
it: measured, one 'A' of a font the reader accepted, a composite made of
36,733 glyphs of 65,536 points, took PDFKit 162 s to embed.

## Decision

**A font is an approved asset, pinned by digest in the definition and mapped
to a token** (FT-Q13).

- **The media type.** `ASSET_MEDIA_TYPES` keeps the three image types; a new
  `FONT_MEDIA_TYPES` holds `font/ttf` alone (RFC 8081). `font/otf` is not
  admitted: see the CFF decision below (FT-Q15). An `AssetRef` declares
  either an image type or a font type.
- **The map.** The definition gains `fonts?: { sans?; serif?; mono? }`,
  each `{ normal; bold?; italic?; boldItalic? }` of asset ids. A token a
  report maps prints all its own text in that face, text with no token
  included; a token it leaves out prints in the renderer's own face --
  `sans` is Roboto, `serif` and `mono` are refused -- exactly as before.
  The QR-bill's slip and the EPC caption stay Liberation Sans, by SIX's and
  the PSA's rules, whatever `sans` maps. A report that maps nothing renders
  byte for byte as it did, and refuses what it refused: every character
  Roboto maps prints under the rule below, so only the words of a refusal
  of a character in another script are new.
- **Why in the definition.** Styles stay tokens (0007). The report's hash
  covers which font a token prints in, so "the same report renders the same
  PDF" survives: a firm swaps its typeface as it swaps its logo, with a new
  digest and a new template version.
- **Validation.** A font-map face that names an image asset is refused
  `asset-not-a-font`, and an image that draws a font asset `asset-not-an-image`;
  a face naming an undeclared asset is `unknown-asset`. A print style that
  sets bold or italic in a mapped family without that face is `missing-face`,
  so the author hears while editing what the renderer would otherwise refuse
  at print; what the renderer prints in a face of its own choosing -- a
  table's header and total rows in bold, its empty text in italic -- it
  holds to the map at print, where the data decides.

**The runtime hands the bytes over** (`lower-fonts.ts`). The host's resolver
is the image resolver, widened: `ImageResolver` is now `AssetResolver`, with
the old name a type alias for a release. `ResolvedDocument` gains `fonts`
holding each face's id, digest and bytes. Each face is fetched once, its
media type held and its size (`MAX_FONT_BYTES`, within `MAX_ASSET_BYTES`)
before its bytes are copied, and the copy read with `readFont` before it is
handed on; a face the host cannot hand over, or that the reader refuses,
refuses the render, in a preview too, since a font is structural and a
dropped face would print its text in a font nobody chose (fail closed).
That the bytes are the ones the digest names is the host's lookup's to
keep, as for an image (0030).

**The renderer embeds them, per render** (`host-fonts.ts`). Each face is
read once more with `readFont` -- the renderer is a package boundary that
takes resolved input and refuses what it cannot draw (0011) -- its glyphs
read through `characterMap` and its line taken from its hhea (ascender less
descender, over its units), which the reader holds to `MIN_FONT_LINE` to
`MAX_FONT_LINE` ems (0040). Nothing of a face outlives the render that read
it: what a face prints is always the bytes this document carries, never a
face another render read under the same digest. Within a render an asset is
read once by its id, however many faces name it, and an id handed again in
other bytes -- which only a document built by hand can do, since the runtime
resolves each id once -- is refused `invalid-asset`, naming the asset alone:
read by its id, the second printed in the first's bytes. The stripped
bytes -- a face's own, where they are one of the renderer's own faces
(below) -- go into pdfmake's virtual files under a name of the render's own,
`formancy-report-render-pdf/font/<render>/<n>.ttf`, in both entries, never a
path, for each pass, and come out of pdfmake's `storage` after it, whether
it wrote a PDF, measured or threw (`engine.ts`'s `registerHostFonts`):
pdfmake's virtual files are process-wide and have no delete, and two renders
at once never share a name, so one that ends takes no file another still
reads. `setLocalAccessPolicy` stays Roboto's and Liberation's files, which
the virtual files sit beside. A style's font token becomes the host family
pdfmake draws it in, and token-less text the mapped `sans` or Roboto. A face
asked for and not mapped is refused, never synthesised; a character the
face lacks is refused naming the face, its asset and the code point, and a
page number's or count's digits are held to their paragraph's face as any
text is.

**PDFKit tells faces apart by name, so a render's faces have names of their
own** (`face-identity.ts`). PDFKit 0.19.1, which the package pins (0036),
keeps a document's fonts in a plain object keyed by the PostScript name
fontkit reads (`font()`, pdfkit.js 2826-2869), and draws a face whose
name, `head.checkSumAdjustment` and naming table are those of a face already
open as that face (`isEqualFont`), whichever pdfmake opened first; nothing
checks the checksum, so a copy of a face's naming table and header field is
enough. A second review found check.ts and bound.ts measuring a face that
was not the one printed: a mono that was Roboto Regular with only its line
changed printed the Roboto text beside it at its own line, and a 96 pt line
was gone; a sans that was Liberation Sans of a 4 em line laid a QR-bill's
slip out in that line, and 7 of the slip's runs were gone, with no refusal.
PDFKit also looks every face of bytes up under `null` first and takes what
is kept there, and finds a function under a name of `Object.prototype`, then
throws. So a host face is refused `invalid-asset`, in numbers and its id
alone, where one of its PostScript names is `null` or a name of
`Object.prototype`, or is the name of another face of the render with other
bytes: another host asset, or one of the renderer's own four Roboto and two
Liberation Sans faces, whether or not the document prints in it. Every name
its records of ID 6 hold is compared, report-spec's `postScriptNames`
(0040), since fontkit returns the last English record's and not the best.
That refuses more than PDFKit merges, and fails closed. Faces of the same
bytes are allowed: a host face of the renderer's own bytes -- the packed
Liberation Sans the install gate maps -- is embedded as the renderer embeds
that face, its layout tables kept, so that whichever copy PDFKit opened
first is the same font; stripped, it was the copy a slip measured in the
kerned one printed in, unkerned, its runs wider than measured, by up to
3.9 pt where a bill's names kerned. Its bytes are known by the digest of
the bytes, never by the asset's word.

**Each line counts by the face it prints in** (`bound.ts`). The page bound
refuses a report too long for its limit before pdfmake measures it, by a
height no taller than pdfmake lays out (0011): a paragraph's line is its
size times the line of its tallest run's face, since pdfmake lays a line out
as tall as the tallest run on it (`Line.getHeight`), and a table row's its
largest cell's in that cell's face. The faces are the ones check.ts holds
the text to, named once for a run (`content.ts`'s `runFace`); a table's
cells are walked once, by `table.ts`'s `styledRows`, which `tableContent`
builds the table from, check.ts holds every cell's text and line to and
bound.ts counts every row by -- the header in its style, the empty text in
italic where the table prints it, a cell in its own style, else its row's
where its own is null -- each at its size or the table's 9 pt, in its
`cellFace`. The second review found check.ts walking the cells its own way:
a row's cell styles in place of its style, no size where a style set none,
and never the empty text, so a 96 pt cell under a null cell style, which
0.2.0 refused, printed with its line gone. And a style's size is held to
the format's `MIN_FONT_SIZE` to `MAX_FONT_SIZE`, read through the runtime,
which a document the runtime resolved holds to: the bound counts a line as
its size, and a document made otherwise at 0.001 pt put 20,000 paragraphs
on one page. The same line holds a paragraph to the body:
measured by its own face, a paragraph with a run of a taller one passed, and
pdfmake dropped the line whole. The bound first took the smallest line of
any face in play, and a security review found it reached nothing and less:
a crafted line lowered every line's floor to nothing, and a report far past
its limit printed on one page. With the reader's floor that bound is safe,
at most 2.3 times Roboto's count of lines, but a report mapping one short
face for one line still lowered the bound of every line in Roboto by as
much, so pdfmake measured up to 2.3 times the nodes before the limit
refused them: work a host's choice of face granted to text that does not
print in it. Counting by each face costs a face lookup a run and a cell:
over 100,000 rows of three cells, 31.2 ms where one factor took 12.8
(medians of nine, below), on a refusal whose whole render took a median of
149 ms of seven.

**A report prints Latin, Greek and Cyrillic** (FT-Q16, `font-scripts.ts`).
pdfmake reorders nothing and the renderer shapes nothing, so the rule is an
allowlist: a character prints only where it lies in one of
`PRINTED_BLOCKS` -- the Latin, Greek and Cyrillic blocks of the Basic
Multilingual Plane, the combining marks, punctuation and symbol blocks
written with them, the private use area, and named parts of five blocks:
Spacing Modifier Letters and Greek and Coptic around the Bopomofo tone marks
and the Coptic letters, the Latin ligatures, the byte-order mark and the
replacement characters -- and is not one of `BIDI_CONTROLS`, which fontkit
draws as a space where a reader would reorder the text around it. Every
other character is refused, in any face, Roboto's included: right-to-left,
shaping and CJK scripts, and any other script, until a fixture proves it.
The bounds are Unicode's `Blocks.txt` 18.0.0 and the controls its
`PropList.txt` (Sources, below).

**The layout tables are stripped** (`strip-layout.ts`), closing 0040's risk.
Before a host face is embedded, the directory records for the tables
fontkit's layout reads -- GSUB, GPOS, GDEF, kern and `morx`, read from
fontkit 2.0.4's `LayoutEngine` and its OpenType and AAT engines -- are
removed, by setting each one's recorded length to zero: fontkit sees a
table only where its recorded length is not zero, so it builds no advanced
layout engine and runs no kern processor, and `font.layout` falls back to
the one-glyph-per-code-point mapping and its own placing of marks by their
boxes, bounded by the text's length. PDFKit always subsets from the outlines
and never embeds a layout table, so what is embedded is unchanged; only what
fontkit does while measuring is. A test pins fontkit's version, so a fontkit
that reads another table reopens this; the browser build bundles its own,
which pdfmake's exact pin fixes and a test draws a throwing face through.

**What subsetting a font costs is bounded, by its outlines** (report-spec's
`font-outlines.ts`, extending 0040). A subset holds every glyph a printed
character reaches, and a composite can reach every glyph the font has, so
the reader holds a font's glyphs together: their points to
`MAX_FONT_POINTS` (2,097,152), their points times contours to
`MAX_FONT_OUTLINE_WORK` (16,777,216), and its composites' components to
`MAX_FONT_COMPONENTS` (262,144), each refused `too-large`. The machine's
412 fonts the reader accepts hold at most 1,886,654 points (Malgun Gothic
Bold), 12,342,110 of work (Malgun Gothic) and 68,743 components (HP
Simplified Hans Light), and every one is accepted still; Liberation Sans
holds 35,285 points.

**CFF stays refused** (FT-Q15), decided on what there is. The plan admits
`font/otf` only if the e-invoice gate passes a CFF variant, and no CFF face
can reach the gate: `readFont` reads no CFF outlines and refuses `OTTO`
bytes (0040), so nothing here could hold a CFF face to the bounds above or
say which characters it draws, and the renderer, which reads every face
through it, cannot draw one. What there is besides: on 22 October 2026 a
PDF/A-3b that pdfmake and PDFKit drew as the renderer draws one, version
1.7 and subset PDF/A-3b, its text in Source Sans 3's CFF face (Sources),
embedded as `CIDFontType0C` in a `FontFile3`, was compliant to veraPDF
1.30.3's PDF/A-3b profile, 146 rules passed and none failed, as was the
same in Liberation Sans; Mustang, which judges a hybrid invoice, did not
see it. So what bars CFF is the reader, not the PDF/A, and the gate's
`variant-host-fonts.pdf` proves a TrueType host face embeds in a PDF/A-3b
veraPDF and Mustang accept. `font/otf` is refused until a later PR reads
CFF outlines and the gate accepts a CFF variant.

## Consequences

**What it buys.**

- **A firm prints in its own typeface**, held to the renderer's rules, with
  no engine to configure: the font is an asset, approved and pinned like a
  logo, and the same report renders the same PDF.
- **One reader at every door** (0040): the format, the runtime's hand-over
  and the renderer read a host's font through `readFont` and `characterMap`,
  so none can disagree about what a font is or which characters it draws.
- **A render a host font cannot hang or crash.** With the layout tables
  stripped, fontkit builds no state machine and no OpenType processor for a
  host face, and the faces 0040 and review crafted -- a `morx` that never
  advances, a GSUB fontkit throws on -- render; with the outlines bounded,
  the costliest subset found under the bounds took PDFKit 1.3 to 1.4 s to
  embed, where one font the reader accepted before took 162 s; and with
  each render's virtual files its own, two renders of one face at once do
  not take each other's file.
- **Proved on the PDF.** Which face each run printed in is read back from
  the PDF by its PostScript name, not assumed; a serif run drawn in Roboto
  would be caught though its text reads the same.

**What it costs.**

- **fsType is a vendor's hint, and the licence is the customer's** (0006,
  0040). A font that says Installable may be under an EULA that forbids a
  server generating documents with it, which nothing here reads; the font's
  licence is handed back for a person, and admitting a font is the customer's
  decision. A host's font is no file a published package ships, so 0006's
  guard does not read it and is unchanged.
- **Not every font prints.** CFF (`.otf`) is refused until proved, and a
  collection, web font, variable or colour font, a restricted, unsubsettable
  or bitmap-only `fsType`, a font past the outline bounds, and the scripts
  above are each refused (0040, FT-Q14, FT-Q16). The bounds sit just past
  the most measured: a TrueType font of more points than Malgun Gothic's,
  Hangul, Han or a dozen scripts' worth, is refused, though none prints
  here. There is no fallback across faces (FT-Q20): a character the mapped
  face lacks is refused, not drawn in another. No serif or mono face is
  shipped (FT-Q19); the slip's Liberation Sans is the only family a package
  ships, for the slip and the EPC caption alone.
- **Latin, Greek and Cyrillic alone**, by an allowlist: Armenian, Georgian,
  Coptic and Ethiopic, which need no shaping, are refused with the scripts
  that do, until a fixture proves them. The blocks are curated from
  Blocks.txt by hand; `scripts.test.ts` holds each to fontkit's own Unicode
  data, which is older than 18.0.0 and reads a newer character as having
  no script, so that the bounds are Blocks.txt's is review-held -- a script
  compared every entry with the file on 22 October 2026.
- **Shaping and kerning are lost in a host face**, since the layout tables
  are stripped, but for a face of the renderer's own bytes, which keeps
  them. Latin, Greek and Cyrillic business text reads correctly without
  them; a combining mark is placed by its box, not by the font's anchors,
  and a script that needs them is refused rather than drawn wrong.
- **Two faces of one PostScript name and other bytes are refused**, though
  PDFKit draws them as one only where their checksums and naming tables
  match as well, since which it draws is decided inside PDFKit and nothing
  here could hold it to the face measured. So a host's own Roboto or
  Liberation Sans of another release than the renderer's is refused under
  the renderer's name, in a report that never prints the renderer's face
  too, and a host maps the renderer's own bytes of it, or leaves `sans`
  unmapped for Roboto; so is a family whose two faces state one name, and
  a face named `null` or like a property of every object.
- **A shared glyph's text is the first character's.** PDFKit writes each
  glyph's text from the first character it drew it for, so a face that
  draws two characters with one glyph -- Roboto's Ohm sign and Omega, a
  host face's more -- writes the first for both into the PDF's text layer,
  as 0.2.0 did for Roboto. Nothing here reads it.
- **A face of a short line admits more lines before the bound.** A line
  counts its own face's line, at least half its size (0040), so a report
  set in such a face passes the page bound with up to 2.3 times the lines
  Roboto's would, and pdfmake measures them all before its page limit
  refuses what does not fit; text in Roboto beside it is bounded as it was.
- **Each render reads each face again.** No face is kept across renders,
  so none is trusted by its digest: on the machine below, `readFont` took
  0.72 ms for Liberation Sans and 0.75 ms for Noto Sans (medians of nine),
  and a one-paragraph report mapping either rendered in 9 to 10 ms, where
  the same mapping nothing took 15 ms in Roboto, whose layout tables run.
  A render holds each face twice until it ends, the runtime's copy and the
  stripped one, so a report of twelve faces of `MAX_FONT_BYTES` holds
  480 MiB of them; computed, not measured.
- **The corpus's text box assumes a descent of a fifth of the size**
  (0003). The `host-fonts` fixture is bound to Liberation Serif and Mono,
  whose descenders reach about that far, as Roboto's and Helvetica's do, so
  the overlap boxes hold; a host face with a deeper descender is not proved,
  and `PdfTextItem` still computes the box from the baseline, not the face's
  own descent.
- **The virtual files have no delete**, so the renderer removes each pass's
  host faces from pdfmake's `storage` by hand; were pdfmake to hold them
  elsewhere, `pdfmake.test.ts` fails, and `host-fonts.test.ts` finds a face
  left behind.
- **Measured costs.** On an Intel i9-10900K under Windows 11 and Node
  24.21.0, shared with two other workflows' builds, on 22 October 2026, over
  Noto Sans Regular (Sources): `readFont` read it in a median of 1.0 ms of
  nine when first measured and 0.75 ms when measured again, `characterMap`
  in 0.2 ms, and the renderer drew a one-paragraph report mapping it --
  reading, stripping, embedding and laying out -- in 9 to 16 ms. Liberation
  Serif and Mono, which the corpus ships, read in about the same. The
  outline bounds' figures are `limits.ts`'s, measured the same day, and
  so are the line's. Counting each line by its face, the page bound took a
  median of 31.2 ms of nine over a body of 100,000 rows of three cells,
  where the one factor it took before took 12.8, and a render refusing
  those rows against five pages took a median of 149 ms of seven, while
  other workflows shared the machine. With the cells walked once by
  `styledRows`, that refusal took a median of 199 ms of five, where it took
  240 before the walk, under a varying load. The identity rule hashes a
  face only where its name meets another's: 3.8 ms for Liberation Sans's
  410,712 bytes, a mean of ten.

**What it forecloses.** A font named by address rather than by approved
digest; a face synthesised from another; and drawing a host face through
fontkit's shaping, which a report cannot be held to render the same way
twice. A bound raised, a format admitted once proved (CFF), or a script
proved by a fixture refuses nothing accepted now.

## Sources

The files this record was built from, fetched on 22 October 2026 into
directories of their own outside the repository, each held to its SHA-256:

| File | From | SHA-256 |
|---|---|---|
| `liberation-fonts-ttf-2.1.5.tar.gz`, as 0022 has it | https://github.com/liberationfonts/liberation-fonts/files/7261482/liberation-fonts-ttf-2.1.5.tar.gz | `7191c669bf38899f73a2094ed00f7b800553364f90e2637010a69c0e268f25d0` |
| `LiberationSerif-Regular.ttf`, from the archive | report-corpus's `fixtures/host-fonts/` | `058ea80864aef09a23f45cbec2bb5400bc3dfbdea01c3f10538a21fcb497fb74` |
| `LiberationSerif-Bold.ttf` | as above | `d754ba427cfe0bca54ae052384baa8f842da5bd6550ad4da024ac441e7a7d5ce` |
| `LiberationSerif-Italic.ttf` | as above | `0e3dea9f8d613e006ccfa62201f33e265d19167bd0907725c3e145368b04fc2e` |
| `LiberationSerif-BoldItalic.ttf` | as above | `f17db8af71e24d2066b587546021d4f0b296be389512b658dec3c09affeb11a7` |
| `LiberationMono-Regular.ttf` | as above | `f2b83c763e8afd21709333370bed4774337fae82267937e2b5aea7e2fbd922c1` |
| `LiberationMono-Bold.ttf` | as above | `bd62a0672d0b9b6710b01df434c80ad54fa5f0835207eb7b17b7a761463067bb` |
| The archive's `LICENSE` and `AUTHORS` | as above | `93fed46019c38bbe566b479d22148e2e8a1e85ada614accb0211c37b2c61c19b`, `b627404917ef824675cb24c32e2facd0b57650627955f3fc3d8a8863c5d0adfc` |
| `NotoSans-Regular.ttf`, measured and kept out of the repository | https://github.com/notofonts/notofonts.github.io/raw/main/fonts/NotoSans/hinted/ttf/NotoSans-Regular.ttf | `478c558ea716033cd60c03438f628dfa75694dcf6b5f6d505a2f05fd2b4f3823` |
| `Blocks.txt` 18.0.0 (2026-07-08) | https://www.unicode.org/Public/18.0.0/ucd/Blocks.txt | `a58f8d322f3c5e254f9f97b1cbf76a454a7e02de6ac35619a5e4f27aaabfd553` |
| `PropList.txt` 18.0.0 (2026-08-07) | https://www.unicode.org/Public/18.0.0/ucd/PropList.txt | `f438f532e8737bb8a2702126cdf9c4af5e357c58c7acf9d9eb2fc7c1a1d955d6` |
| `SourceSans3-Regular.otf`, OFL-1.1, drawn into a PDF/A-3b and kept out of the repository | https://github.com/adobe-fonts/source-sans/raw/release/OTF/SourceSans3-Regular.otf | `08df266400933d3178d081a45f94a08814c3e55b4b7dd2e0ff69cb1329f13ab6` |

The Noto Sans and Source Sans 3 addresses are branches, not releases: what
they serve may change, and the digests are what was measured. The six Liberation files and the
licence and authors are byte for byte the archive's.

## Alternatives considered

- **A render option outside the hash.** The font would not be part of the
  template a hash names, so two renders of one report could print in
  different typefaces and both be "the report". The map is in the definition
  (0007).
- **A catalogue the host names fonts by.** An asset pinned by digest is the
  same mechanism as an image (0033), with the same guarantee that the bytes
  are the ones approved; a named catalogue is a second resolution path and a
  second thing to trust.
- **Shipping Liberation Serif and Mono** (FT-Q19), so `serif` and `mono`
  print without a host font. Rejected: the slip's Liberation Sans is shipped
  for SIX's rule, not as a default, and shipping more fonts a report prints
  in is a licence surface and a bundle cost for a default few firms would
  keep.
- **Per-glyph fallback across faces** (FT-Q20), so a character a mapped face
  lacks is drawn in another. Rejected: a substitution nobody chose, and a
  report that prints the same text in two typefaces; a missing glyph is
  refused instead, as 0011 refuses one.
- **A cache of faces across renders, keyed by the digest the document
  names**, as this was first built, holding sixteen. Rejected in review: it
  trusted the digest across renders, other firms' included, so a face
  another render had read under a digest printed in place of the bytes
  handed over, and four bytes that were no font rendered; its bound was a
  count, under which a process could hold some 320 MiB of faces, by
  review's reckoning; and shared file names let one render's cleanup take
  another's file. Keying it by the bytes' own digest costs a hash on
  every render -- 4.6 ms for Liberation Sans, measured in review -- to save
  a read of 0.72.
- **Counting each shared file name's renders**, and removing it at the last.
  It mends the cleanup but not two renders handing different bytes under
  one digest, which would write one file over the other.
- **The smallest line in play, floored by the reader**, as this was first
  built without the floor. Safe once 0040 holds the floor, and a face lookup
  cheaper a line, but a host face of a short line would lower the bound of
  every line the report prints, Roboto's included, by up to 2.3 times;
  counting each line by its own face lowers only that face's text's.
- **Comparing the best PostScript name alone**, the one report-spec's
  `postScriptName` returns. Rejected: fontkit names a face by its last
  English record, so a face whose best record was its own and whose later
  one was Liberation Sans's printed a slip in its own line and lost 7 of
  its runs.
- **Refusing exactly what `isEqualFont` merges**, name, checksum and naming
  table together. Rejected: it follows PDFKit 0.19.1's comparison as it is
  written, as fontkit decodes the tables, and misses `null` and the
  prototype's names, which take over or throw without it; refusing by the
  name alone fails closed.
- **A checksum of its own for each host face**, so that PDFKit never merges
  one. Rejected: it rewrites the bytes the font embeds, which the strip
  leaves the font's own but for its layout records, and leaves `null` and
  the prototype's names as they are.
- **Stripping a face of the renderer's own bytes like any other.** Rejected:
  PDFKit drew the stripped copy and the renderer's own as one, so a slip
  measured in the kerned face printed in the unkerned.
- **Saying in limits.ts and 0040 that the bound assumes the format's sizes**,
  the second review's other choice. Rejected: a document made otherwise
  reaches the renderer, which holds what it is handed (0011), and the
  format's own constants, read through the runtime, keep the two one
  decision.
- **Clamping the factor in the renderer**, the review's other suggestion.
  Every face the renderer embeds is read by `readFont`, which refuses a line
  below the floor, so a clamp could never act, and no test could reach it.
- **A denylist of scripts**, as this was first built: the right-to-left,
  shaping and CJK blocks refused and every other printed. Rejected in
  review: Tibetan, Mongolian, Adlam, Javanese, Brahmi, Tangut and the
  bidirectional controls passed, printed unshaped or as spaces, under a
  record that said Latin, Greek and Cyrillic were all that printed.
- **Bounding a subset at print, by the characters a report prints.** It
  would admit a larger font that prints little, but needs each render to
  walk the composites its characters reach, and tells the person approving
  a font nothing until a report prints the costly character. The bounds on
  the font are known where it is approved, and refuse no font of the
  machine's that the reader accepted.
- **Reading and bounding the OpenType layout tables**, rather than stripping
  them. fontkit's own processors are the unbounded thing -- a GSUB multiple
  substitution that grows the glyph array, a `morx` state that never
  advances -- so reading the tables' structure does not bound what fontkit
  does with them at print; stripping the records fontkit reads is what makes
  the layout bounded.
- **Refusing a host face that carries any layout table.** Every real font
  carries GSUB and GPOS, Liberation and Roboto among them, so this refuses
  every host font. Stripping the records, not the font, is the one that
  leaves a font to print.
- **Admitting `font/otf` now** (FT-Q15). PDFKit embeds CFF outlines
  (`FontFile3`, `CIDFontType0C`), and veraPDF accepted the PDF/A-3b it drew
  in one, but `readFont` reads none of them, and no CFF face has been
  through the e-invoice gate; fail closed until both.
