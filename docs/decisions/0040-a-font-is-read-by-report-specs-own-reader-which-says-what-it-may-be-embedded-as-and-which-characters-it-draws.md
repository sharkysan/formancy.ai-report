# 0040 — A font is read by report-spec's own reader, once, from its bytes: a static TrueType font with outlines whose fsType allows embedding a subset is accepted, with its names, its character map as fontkit reads it in format 4 or 12, and the metrics a line is laid out by; collections, web fonts, Type 1, CFF, variable and colour fonts, a font of bitmaps alone and a Restricted License, No subsetting or Bitmap only fsType refused, with no override; the renderer reads its own faces' glyphs through it; fontkit, opentype.js and the name table's licence alone lost

- **Status:** accepted; extends [0011](0011-report-render-pdf-draws-the-document-and-refuses-what-it-cannot.md), whose glyph check now reads the faces the renderer embeds through this reader; leaves [0006](0006-dependencies-and-fonts-allow-public-source-and-licensed-production.md)'s guard as it is, since a host's font is no file a published package ships; numbered while 0039 was another branch's; extended by [0043](0043-a-report-maps-its-font-tokens-to-fonts-the-host-approved-pinned-by-digest-and-the-renderer-embeds-them.md), which maps a report's font tokens to host fonts read through this reader, closes the layout-table risk this record leaves open by stripping the tables fontkit runs at print, and bounds what subsetting a font costs, which this record left to the renderer to measure, by the points, work and components of its outlines together; and holds a font's line to what pdfmake can lay a page out by, added below on 22 October 2026 after a security review of 0043's renderer, and hands back every PostScript name a font states, added below after a second review, since the renderer tells one face from another by them
- **Date:** 2026-10-21
- **Deciders:** Daniel Bacher
- **Verified by:**
  - **The reader, in report-spec**, on fonts made in code from their
    tables, field by field from the specification's layout and never by
    the reader's own code (`src/font-test-support.ts`):
    - `src/font.test.ts`: a TrueType font read whole -- its names, its
      embedding, its metrics, its style, its glyph count and the
      characters it maps -- in Apple's `true` too, at every OS/2 version
      from 0 to 5, in both formats of the index to location, with a
      PostScript table of each version the specification defines,
      composite glyphs whose components are placed by bytes or words and
      scaled each way the specification allows, and empty glyphs; each
      format it does not read refused by
      its own bytes and named (`FONT_FORMATS`), an EOT by a header that
      measures the file and not by its magic number alone; CFF as `OTTO`,
      as a 'CFF ' table and as CFF2; a variable font; each colour table;
      a font with no outlines and one whose glyphs draw nothing beside
      bitmaps; each fsType value and each version's reading of it, ten
      accepted and twelve refused, with what each refusal names
      (`FONT_EMBEDDING_REFUSALS`), the embedding judged before the rest of
      the font; each required table missing; each field a reader acts on
      outside what the specification defines; a last-resort font; a
      glyph's offsets out of order or past the file, a description shorter
      than its header, points, instructions, a repeat or components past
      its end, a component the font lacks, an empty last glyph whose
      header fontkit would read past the file's end; each table it reads
      refused recorded as empty, which fontkit does not see, and read
      where fontkit reads it when its recorded length understates it, but
      for an index to location recorded an offset or a byte short of its
      offsets, which is refused; a maximum profile cut short of its 32
      bytes and a version 2.5 PostScript table whose offsets run past the
      file; the vertical metrics held to the bytes fontkit reads of them,
      by the count it reads two bytes early, and unread where it sees no
      vertical header; the directory cut off, a table past the file and a
      tag twice; every code of `FONT_REFUSAL_CODES` given by the bytes its
      case makes;
      `MAX_FONT_BYTES` and `MAX_FONT_GLYPH_WORK` each accepted at itself
      and refused one past it; the horizontal header's line held to rise
      above its baseline and reach down to it or below, a descender on the
      baseline accepted and an ascender that is its descender refused, and
      to `MIN_FONT_LINE` to `MAX_FONT_LINE` ems, each accepted at itself
      and refused a unit past it, at 1000 and at 2048 units to the em; seven refusals of fonts whose names and
      unknown tags hold a marker, no message holding it or anything but
      printable ASCII; every prefix of three fonts refused, and 9,000
      seeded corruptions of them each read or refused without a throw,
      more than 1,000 read and each read's characters `characterMap`'s;
      and an error of the reader's own let through, never made a refusal.
    - `src/font-cmap.test.ts`: the subtable fontkit 2.0.4 takes, each
      adjacent pair of its order listed in reverse, and whatever the
      records' order; a symbol, Macintosh, variation sequences or custom
      map alone refused, and each other format the chosen subtable may be
      in; format 4 by its delta and through its glyph array, modulo
      65,536, an index past the array or before it glyph 0 as fontkit
      reads it, segments out of order, overlapping or reversed and an odd
      idRangeOffset, segCountX2 or length refused; format 12 beyond the
      BMP, from glyph 0, its groups out of order, overlapping, reversed or
      past U+10FFFF refused; `MAX_FONT_CHARACTERS` mapped and one more
      refused before a code point is added to a Set, which a spy on the
      Set counts; the variation sequences read in format 14, mapping no
      character of their own, refused in another format, past their
      length, with an array past the file, with a sequence to a glyph the
      font lacks and with arrays that add up to more than the font, and a
      record after the first unread; `characterMap` on an sfnt of nothing
      but its character map, on one whose map is recorded as empty, and on
      every prefix of one.
    - `src/font-names.test.ts`: the typographic names before the family's,
      each name from the best record, UTF-16's pairs and a lone surrogate
      as U+FFFD, Mac Roman by its own table, the licence and its address
      handed back as the font states them, a name the font lacks left
      out; the PostScript name refused for each delimiter, a number sign,
      a control character and a character past ASCII, in any record,
      admitted with a space, held to 63 characters, refused missing, empty
      or in an encoding this does not read, and refused, beside a sound
      record, in one fontkit decodes otherwise: Windows symbol, the Unicode
      platform past its encoding 6, Mac Roman in another language than
      English; every name the records of ID 6 hold handed back once each,
      in table order; the naming table's version, a string past the file, a
      UTF-16 string of an odd length, records whose strings add up to more
      than the font, and a record past platform 3 refused; a version 1
      table's language tags read, and a tag past the file, a count of tags
      past it refused where the count is, tags whose strings add up to
      more than the font and a record naming a tag the table lacks
      refused; a language from 0x8000 up read in a version 0 table.
  - **Each rule, changed on its own, on 21 October 2026.** Each of 42
    single changes to the reader made a named test fail, and was put back:
    fsType's bit 0, exclusivity from version 3, Restricted License read as
    installable, No subsetting and Bitmap only admitted, bit 8 read in
    version 0, an OS/2 version past 5 admitted; the magic number, a
    last-resort font, more metrics than glyphs, version 2.0's glyph names
    past the file; the first Unicode record in table order rather than
    fontkit's, format 4's order, its odd idRangeOffset, its glyph array
    read past its length, format 12's order, the bound on characters,
    code points past U+10FFFF, a map of nothing; a number sign in a
    PostScript name, only the Windows record held, the bound on the name
    strings, the family before the typographic family, Windows English not
    preferred, Mac Roman read as Latin-1; an empty glyph's header, a
    component the font lacks, the coordinates, the offsets' order, a font
    of no outline, the bound on a glyph's points times contours, a two by
    two matrix read as four bytes, a component's arguments read as words
    whatever its flags; fvar, COLR and 'CFF ' admitted; a character past
    the glyph count; the bytes' bound; a table past the file, a tag twice;
    an EOT by its magic number alone; and an error of the reader's own
    made a refusal. The arguments read as words failed only once a
    composite of one component was added: in one of three, the misread
    flags happened to end the walk inside the glyph. **And on 22 October
    2026**, after review, each of 33 changes to the rules review added made
    a named test fail, and was put back, and the 42 again, each still
    failing one: a table recorded as empty admitted, and `characterMap`
    holding one; loca's recorded length unheld, and held a byte short;
    the maximum profile's 32 bytes unheld; the vertical metrics unread,
    read by the specification's count, held to a metric a glyph, held
    where fontkit sees no header, and their header's 36 bytes unheld; a
    name record past platform 3; a record naming a tag the table lacks, a
    tag's string past the file, the tags' lengths uncounted and their count
    unheld; a PostScript name held by its encoding rather than as fontkit
    decodes it, and every Unicode encoding read as UTF-16; variation
    sequences in any format, the last record of them read, records past
    their subtable, either array past the file, their arrays unbounded and
    a sequence's glyph unheld; format 4's index before its glyph array
    read; format 12's bound checked once the Set is built; (0, 6) dropped,
    moved last, and (3, 10) swapped with (0, 4); format 8 read as format
    12; post 2.5's offsets unheld; and the glyph and the byte bounds each
    loosened by one. **And on 22 October 2026**, after the security review,
    each of six changes to the line's rule made a named test fail, and was
    put back: an ascender on the baseline admitted, a descender of one unit
    above it admitted, the floor and the ceiling each unheld, the units to
    the em read as 1000, and a line at the floor refused.
  - **The renderer.** report-render-pdf's `src/glyphs.test.ts`, unchanged,
    green on the reader: Roboto's characters and not those it lacks, the
    same from the files and the browser build, the two fonts it cannot
    read refused in the words it had, every place text prints refused.
    `src/fonts.test.ts`: Roboto 3.014's four faces, from pdfmake's own
    copy, and Liberation Sans 2.1.5's two, from `fonts/`, read by the
    runtime's `readFont` to the values measured from the files -- names,
    installable embedding, fsType 0, units per em, ascender, descender,
    line gap, weight, the style bits, the glyph and character counts --
    and glyphs.ts's map of each the reader's, and of a face whose maps
    disagree, which that test failed with glyphs.ts put back as it was;
    `LINE_FACTOR` and `LIBERATION_LINE` the faces' own lines; fontkit,
    loaded from the PDFKit pdfmake loads, mapping every code point of each
    face as the reader does; every table the reader reads, of Roboto
    Regular and Liberation Sans Regular, recorded as empty, as a byte and
    as half its length, each refused, or drawn by fontkit glyph for glyph
    as the face is and embedded by PDFKit, which failed inside fontkit
    with the rules for recorded lengths taken out; and 160 seeded
    corruptions of the tables the reader reads and their records in the
    directory, of the same two faces, each refused, or mapped alike by
    fontkit, named alike, and embedded by PDFKit with every character it
    maps below U+3000 -- 300 of each face, measured so on 22 October
    2026, 276 of 600 accepted. That test failed when the reader took the
    first Unicode record in table order, as glyphs.ts did before, on a
    corruption of Roboto's character map, and with the rules for recorded
    lengths and name records taken out, at a corruption fontkit named
    `null`.
  - **The runtime.** report-runtime's `src/fonts.test.ts` holds the reader,
    its codes and its bounds handed on as report-spec's own, the line's
    among them, and `MAX_FONT_BYTES` within `MAX_ASSET_BYTES`.
  - **From outside.** The install gate's `scripts/install-fixture/fonts.ts`
    holds the packed runtime's reader to the packed report-spec's, reads
    the packed renderer's Liberation Sans to its names, metrics and
    characters, its character map alone to the same characters, and has
    the same bytes with Restricted License embedding, and a collection's
    header, refused by their codes.
  - **Not held by anything here:** what fontkit does with a font's layout
    tables, GSUB, GPOS, kern and morx, which it runs on every run PDFKit
    lays out and this reader does not read; what an outline looks like;
    that a font's fsType is what its licence says; which record of a
    PostScript name fontkit returns where a font's records differ, held
    only on corruptions of two faces; and every time below on another
    machine than the one it was measured on.

## Context

**A host will print in its own fonts.** A firm's typeface is part of its
letterhead, and 0.2.0 prints Roboto alone, `serif` and `mono` refused
(0011). The owner chose "Report features" for 0.3.0, fonts a host supplies
among them, and accepted the recommendations of its plan, which is kept
outside the repository: this record is the plan's first step of three; the
second, which it calls P07, maps the format's three tokens to fonts a host
approved, pinned by their digest (its question FT-Q13), and embeds them;
the third, P08, lets a person add a font in either builder. Before them,
one decision of what a font is and whether it may be embedded must exist
where every place a font enters can call it: a host's approval, a builder's
upload, which may import report-spec and report-core alone, and the
renderer. That is report-spec, as for an image's bytes (0033) and an SVG
([0030](0030-an-image-asset-may-be-an-svg-of-drawing-elements-alone-cleaned-once-and-refused-at-print-in-any-other-form.md)).

**A font is untrusted input**, even when an administrator approved it
([`CLAUDE.md`](../../CLAUDE.md)). The renderer's `characterMap` read the
faces it ships, trusted bytes, with a `DataView` over the file: format 4
alone, of the first record of Windows BMP or Unicode BMP in the order the
table lists them, every segment walked whatever its bounds.

**fontkit is the reader that matters at print.** PDFKit lays every run
out with fontkit 2.0.4 and subsets the face with it; what fontkit maps a
character to is what the PDF draws. Read on 21 October 2026, from the
installed `fontkit/dist/module.mjs` and `pdfkit/js/pdfkit.js`, and on 22
October 2026, after review, from fontkit 2.0.4's and restructure 3.0.2's
sources:

| What fontkit or PDFKit does | What follows for a reader that must agree |
|---|---|
| Takes the first record of (3, 10), (0, 6), (0, 4), (3, 1), (0, 3), (0, 2), (0, 1), (0, 0), in that order, whatever its format; with none, re-encodes text from a legacy subtable | A subtable chosen otherwise maps other glyphs where a font's maps disagree; the renderer's old choice, the first of (3, 1) or (0, 3) in table order, was another |
| Binary-searches format 4's segments and format 12's groups; reads format 4's glyph array bounded by the subtable's own length, an index outside it as glyph 0, and an odd idRangeOffset between two indices | Unsorted or overlapping segments are mapped otherwise by a walk |
| Sees a table only where its recorded length is not 0; reads the index to location's offsets and version 2.0's PostScript names to the table's recorded end; reads every other field from the table's offset in the whole file, whatever its length says | A table recorded as empty leaves PDFKit reading a property of nothing; an index to location recorded short draws the glyphs past its last offset as nothing, the render succeeding; a reader that held every read to the length refuses fonts PDFKit prints |
| Decodes every name record when PDFKit asks for the PostScript name, and writes that name into the PDF as `/` and the name, spaces made underscores and nothing escaped (`PDFObject.convert`) | A name of `(`, `/` or `%` writes PDF syntax the font chose; 65,535 records at one 65,535-byte string are four gigabytes decoded |
| Decodes a name record by its platform and encoding: the Unicode platform's encodings 0 to 6 and Windows' 1 and 10 as UTF-16, Mac Roman in English as Mac Roman, an encoding it has no name for a byte at a time, and Windows symbol and some Macintosh encodings as no string; loses the whole table to a record past platform 3, or one naming a language tag a version 1 table lacks | A name held as UTF-16 that fontkit reads a byte at a time is written with a NUL before every letter; one it decodes as no string throws inside PDFKit; a table it loses names the font `undefined` |
| Decodes the first Unicode Variation Sequences subtable, (0, 5), when it first lays text out, throwing on a format it does not know, and every sequence in it for a character followed by a variation selector | A subtable it cannot decode throws inside pdfmake on the first run of text |
| Measures every glyph by the vertical metrics where it sees a vertical header beside them, reading the header's count two bytes early, from the field the specification calls metricDataFormat, so taking every glyph's side bearing from the table's start | Metrics it reads past the file throw inside pdfmake |
| Reads a glyph's header for its box whenever it measures it, empty or not; decodes the whole description when it subsets, past the glyph's own extent; looks every point up among the contour ends with `indexOf` | A glyph whose header or points lie past the file throws inside pdfmake; one of 32,767 contours and 65,534 points, 66 KB, took PDFKit 1.6 s to embed |
| Decodes the font header, the horizontal header, the maximum profile's 32 bytes and the PostScript table whole, and reads `post.isFixedPitch` and OS/2's family class for the descriptor | A table fontkit cannot decode leaves PDFKit reading a property of nothing |

**fsType is the font's own word on embedding** (OS/2, OpenType 1.9.1, read
21 October 2026): bits 0 to 3 Installable (0), Restricted License (2),
Preview & Print (4) and Editable (8); bit 8 No subsetting and bit 9 Bitmap
embedding only, from version 2; several usage bits the least restrictive
in versions 0 to 2 and invalid from version 3; bits 4 to 15 ignored in
versions 0 and 1. PDFKit always embeds a subset of the outlines.

## Decision

**report-spec reads a font once, from its bytes: `readFont`.** It returns
the font -- its names, the embedding its fsType allows, its metrics, its
style, its glyph count and the characters it maps -- or the first thing
wrong with it, with one of `FONT_REFUSAL_CODES` and what to do, and never
throws for what the bytes hold. `characterMap` reads the directory and the
character map alone, of any sfnt. The runtime hands both on, with their
codes and bounds, as report-spec's own, and the renderer's `glyphs.ts`
reads the faces it embeds through `characterMap`: one reader of a font's
glyphs. No format changes; a report cannot name a font yet.

- **Accepted:** one TrueType font, an sfnt of 0x00010000 or `true`, with
  `glyf` and `loca`, the eight tables every OpenType font needs, a
  Unicode character map fontkit reads in format 4 or 12, and an fsType
  that allows embedding a subset of its outlines: Installable, Preview &
  Print, since a PDF is opened read-only, or Editable.
- **Refused, each with what to do:** a collection, WOFF, WOFF2, EOT and
  Type 1, by their bytes (`format`, naming which); CFF and CFF2 outlines
  (`cff`), until the e-invoice gate proves a CFF face in a PDF/A-3b, as
  the plan's FT-Q15 recommends; a variable font (`variable`); COLR,
  'SVG ', CBDT and sbix (`colour`), whose glyphs PDFKit prints as their
  outlines alone, which a colour font may leave empty; no outlines, or not
  one glyph with a contour (`no-outlines`); Restricted License, No
  subsetting, Bitmap only, bit 0, several usage bits from version 3, and an
  OS/2 version past 5 (`embedding`, naming which), with no override on a
  host's attestation, as the plan's FT-Q14 recommends; no Unicode map, one
  in another format, one that maps nothing, and a last-resort font
  (`character-map`); and what is malformed.
- **Every read is checked against the bytes**, and a read past them is a
  refusal (`font-file.ts`). A table is read where the directory says, as
  fontkit reads it: refused where its recorded length is 0, since fontkit
  then sees no table; the index to location's recorded length held to an
  offset a glyph and one more, and version 2.0's PostScript names read to
  the table's recorded end, since fontkit reads both to there; every other
  field read from the table's offset whatever its length says, as fontkit
  reads it. A structure's own length -- a character map subtable's --
  bounds its arrays. Duplicate tags are refused. Counts are checked against
  the bytes they count before anything is read by them; every loop is
  bounded by the bytes, and nothing recurses.
- **The character map is fontkit's** (`font-cmap.ts`): its subtable, its
  reading, and segments and groups sorted and apart, so that a walk finds
  what fontkit's search finds; a character maps where its glyph is not 0,
  and `readFont` holds every glyph mapped to the glyph count. The first
  variation sequences subtable, which fontkit decodes at its first layout,
  is held to format 14, its records and arrays inside the file, their
  sizes to the font's, and the glyphs its sequences name to the count.
  `characterMap` reads the map alone, whatever length is recorded for it,
  and holds no glyph to a count it does not read: a host's font is held to
  `readFont`'s characters.
- **The names are handed back, never judged** (`font-names.ts`): the
  typographic family and subfamily first, the full name, the version, the
  copyright and the licence and its address, each the best record's,
  Windows English first. Every PostScript name record is held to the
  specification's 63 printable ASCII characters, less its ten delimiters
  and the number sign, a space admitted since PDFKit replaces it, and each
  must be in an encoding fontkit decodes as this does: UTF-16 on the
  Unicode platform's encodings 0 to 6 and Windows' 1 and 10, or Mac Roman
  in English. A record past platform 3, and one naming a language tag a
  version 1 table lacks, which would lose fontkit the whole table, are
  refused. The records' lengths, with the tags', may add up to no more
  than the font's size. Every name the PostScript name records hold is
  handed back besides, once each, in table order (`postScriptNames`):
  fontkit names a font by its last English record, not the best, and
  PDFKit keeps a document's faces by that name, so the renderer tells one
  face from another by all of them (0043).
- **The outlines are walked for their structure** (`font-outlines.ts`):
  the offsets in order and inside the file, every glyph's header too, and
  every description to its end inside its own extent, a composite's
  components each a glyph the font has.
- **The fixed tables are held to what the specification defines**
  (`font-tables.ts`): the font header's version, magic number, units per em
  from 16 to 16,384 and formats; maximum profile 1.0, its 32 bytes, and a
  glyph; the horizontal header's version and between one and the glyph
  count of metrics, all inside the file; the PostScript table's versions,
  2.0's names to its recorded end and 2.5's offsets inside the file; and
  the vertical metrics, where fontkit sees a vertical header beside them,
  held to the bytes fontkit reads of them; and, beyond the specification,
  the line the horizontal header makes (added below).
- **Three bounds, each measured** (`limits.ts`): `MAX_FONT_BYTES`, an
  asset's 20 MB; `MAX_FONT_CHARACTERS`, 131,072; `MAX_FONT_GLYPH_WORK`, a
  glyph's points times its contours, 1,048,576.

**Added 2026-10-22: a line pdfmake can lay a page out by.** pdfmake lays
every line of a face out as tall as its horizontal header's ascender less
its descender, over its units to the em, and sets the line's baseline the
ascender below its top (PDFKit 0.19.1's `lineHeight`, from fontkit 2.0.4's
`hhea.ascent`, `hhea.descent` and `head.unitsPerEm`, and pdfmake 0.3.11's
`Line`; the line gap is not read), and the renderer counts a line of text
by it when it refuses a report too long for its page limit (0043). The
specification bounds none of them, and a security review of 0043's renderer
found the reader accepted any: a face whose ascender was its descender
printed a report of 20,000 lines, limited to one page, on one spot of that
page in 921 ms, one whose ascender was below its descender printed 2,000
lines on one spot above the top margin, and one of a line 4 units of its
2,048 printed 2,000 lines within 35 points, each over the last, every one
rendered and none refused. So `readHorizontal` holds the line it reads
(`font-tables.ts`), each refused `malformed` in numbers alone:

- the ascender above the baseline, and the descender at it or below;
- the line `MIN_FONT_LINE` (0.5) to `MAX_FONT_LINE` (4) ems tall
  (`limits.ts`), measured on 22 October 2026 on an Intel i9-10900K under
  Windows 11 and Node 24.21.0 over the
  425 fonts the reader accepts of Roboto 3.014's four faces, Liberation
  Sans, Serif and Mono 2.1.5's eight, Noto Sans Regular (0043's Sources)
  and the 447 files of the machine's Windows fonts directory, fontkit
  reading every one's metrics as the reader does:

  | | Line, in ems | Font |
  |---|---|---|
  | Shortest | 0.864 | Ink Free (665 and -199 of 1000) |
  | | 0.915, 0.926 | Footlight MT Light, Palace Script MT |
  | Liberation | 1.107 to 1.133 | Serif, Sans, Mono |
  | Roboto | 1.172 | its four faces (1900 and -500 of 2048) |
  | Noto Sans | 1.362 | Regular |
  | | 2.271, 1.904 | Javanese Text, Myanmar Text Bold |
  | Tallest | 2.651 | Sans Serif Collection (1621 and -1030 of 1000) |

  No ascender was at or below its baseline, the least 0.592 of the em
  (Microsoft Himalaya), and no descender above it; two icon fonts, Segoe
  MDL2 Assets and Segoe Fluent Icons, put theirs on it. Chosen with a
  margin: the floor half the shortest line rounded up to half an em, 42 %
  below it, and the ceiling one and a half times the tallest rounded to a
  whole em, 51 % above it.

## Consequences

**What it buys.**
- **One decision of what a font is**, which the renderer reads its own
  faces' maps through today, and a builder and a host's approval will read
  a host's font through: none can disagree with another, because there is
  one of it.
- **Agreement with what prints**, held on the shipped faces and on
  corruptions of them, not assumed: fontkit maps and names what the reader
  says, draws every recorded length the reader accepted as it draws the
  face, and PDFKit embedded every corruption the reader accepted.
- **A refusal a person can act on**, before a host keeps a font no report
  could print, in words that repeat nothing the font chose but a number
  the reader decoded -- a version, an fsType, a count -- in its own digits.
- **Measured costs.** On 22 October 2026, on an Intel i9-10900K under
  Windows 11 and Node 24.21.0, shared with another workflow's builds at 1
  to 12 % load, medians of seven reads of the reader as it now is:
  Liberation Sans in 0.8 ms, Malgun Gothic, 13.5 MB, in 16 to 17 ms over
  three runs, and the costliest font the bounds admit, 65,534 glyphs
  walked flag by flag and 131,066 characters, in 60 ms (57-65). On 21
  October, before review, they were 0.7, 16 and 59 ms.

**What it costs.**
- **Fonts are refused that a reader elsewhere would take.** Of the 447
  `.ttf` and `.ttc` files in that machine's Windows fonts directory, 412 were
  accepted, 370 of them Editable, 41 Installable and one Preview & Print;
  15 collections, 10 symbol fonts mapped in (3, 0), 8 variable fonts, a
  colour font and SimSun-ExtB, past the bound, were refused, and none as
  malformed, on 21 October 2026 and alike on 22 October, after review's
  rules. A CFF font, which most foundries ship beside the TrueType one, is
  refused until the e-invoice gate has proved one.
- **A font whose line pdfmake cannot lay out is refused**, which a reader
  elsewhere would take: an ascender at or below the baseline, a descender
  above it, or a line shorter than half its em or taller than four. No font
  of the 425 measured is, and a font past the margin a machine elsewhere
  holds would be. The line bounds the layout's arithmetic, not the ink: a
  glyph's outline may still reach far past its line -- the walk holds
  structure, not appearance -- and the ascender's share of the line, the
  line gap, which pdfmake does not read, and the OS/2 table's own ascender
  and descender are not judged.
- **fsType is a vendor's hint.** A font that says Installable may come
  under a licence that forbids a server generating documents with it,
  which nothing here can read; the licence description is handed back for
  a person to read, and the decision is the customer's.
- **A third reader of binary formats, written here,** beside the SVG
  reader and the image header's: seven files of report-spec, 1,208 lines
  counted with `wc -l` on 22 October 2026, comments included, which review
  reads. fontkit is still the reader at print; its disagreement with this
  one is found by the renderer's `fonts.test.ts`, on the faces it ships
  and their corruptions, not on every font a customer brings.
- **The layout tables are not read.** fontkit runs GSUB, GPOS, kern and
  morx on every run PDFKit lays out; a crafted one can make a render throw
  inside pdfmake, an error and not a refusal, or never end. Liberation
  Sans with a morx table of one state whose one entry does not advance is
  a font this reader accepts; fontkit's state machine has no bound on its
  steps (`AATStateMachine.process`), and PDFKit, laying "A" out in it, had
  not returned when it was stopped after 20 seconds, on 22 October 2026. A
  pass cannot be interrupted (0011), so such a font holds a render's
  thread for good: the renderer must meet that before it embeds a host's
  font (P07).
- **What an outline draws is not judged.** A glyph whose description
  holds a contour may draw nothing a reader sees, and a mapped character
  prints so; the walk holds structure, not appearance.
- **The PostScript name returned may not be fontkit's**, though
  fontkit's is one of `postScriptNames`, which the renderer compares. It
  is the best record's; where records differ, fontkit returns the last
  English record it decodes, which in a table sorted as the specification
  asks is the Windows one returned here: for Corbel Light and Microsoft
  Himalaya fontkit returned `CorbelLight` and `Microsoft Himalaya`, as this
  does, checked by hand on 21 October 2026. No test holds it for a font
  of a sorted table whose records differ; the renderer's sweep holds the
  two names alike on its corruptions of two faces, and every font of that
  machine the reader accepted and that carries variation sequences or
  vertical metrics was named alike on 22 October 2026. Where a later
  Macintosh record differs from the Windows one, fontkit returns the
  Macintosh one, which the renderer's `face-identity.test.ts` holds.
- **A builder will carry it.** Bundled minified with esbuild 0.28.2 from
  report-spec's built `dist/index.mjs`, as 0030 measured, at d0a284b on
  21 October 2026 and with this change on 22 October 2026: everything
  report-spec exports grew from 161,695 bytes to 178,988; its validator
  and hash alone, from 88,206 to 88,344, the reader's tables built when
  the module loads; and everything report-builder-core exports from
  389,407 to 389,545, which becomes 406,245 once it imports
  `readFont`, as it will to read a font a person adds (P08).
- **0006's guard reads no host's font**, and is not changed: it judges the
  fonts a published package ships, by their licence sentence, and a
  host's font ships in no package. Its licence is the customer's.

**What it forecloses.** Admitting a font past its fsType on a host's word,
and a reader that agrees with fontkit by trusting it. A bound raised, or a
format admitted once proved, refuses nothing accepted now.

## Alternatives considered

**fontkit in report-spec.** It is the reader at print, so it could not
disagree with itself. But its `create` bundles to 365,846 bytes minified
for a browser (esbuild 0.28.2, 21 October 2026), it would be report-spec's
third production dependency and a builder's largest, it throws on a broken
font rather than refusing it, reads past its tables where this refuses,
and judges no fsType; and the questions this record asks of it -- does it
throw, does it stall -- are the ones it would answer by doing so.

**opentype.js.** It is MIT, parses CFF besides, and throws on malformed
input too. It is a second parser that disagrees with fontkit wherever
their readings of a broken font differ, which is where a reader of
untrusted fonts is needed, and it decides nothing of embedding. Not
installed, and not measured here.

**The name table's licence alone, as 0006 reads a shipped font.** A
customer's font is licensed by contract, rarely by a sentence a guard can
read, and its licence text says nothing a machine can act on; fsType is
the field the specification gives embedding. The licence is handed back,
for a person.

**Hold every read inside the table's recorded length**, as the
specification asks of a table's data. fontkit reads the length to see a
table and to end loca's offsets and version 2.0's names, which this holds;
past that it reads a table's fields whatever the length says, so holding
them to it refuses fonts PDFKit prints and changes nothing that is drawn.
`characterMap` does not hold a character map to its length at all: the
renderer's own test font in `glyphs.test.ts` records it as 0.

**Refuse a font with a vertical header or variation sequences**, rather
than read what fontkit reads of them. Myanmar Text and Microsoft PhagsPa
carry variation sequences, and Malgun Gothic, Microsoft Yi Baiti and
SimSun-ExtG vertical metrics; each was accepted, mapped and named alike by
fontkit, and embedded by PDFKit with every character it maps below U+3000,
on 22 October 2026.

**Clamp a line in the renderer**, as the review suggested beside this,
rather than refuse the font. The renderer would then lay a page out by a
line other than the one pdfmake draws, and a builder or a host's approval,
which read the font through this reader, would admit a face the renderer
then measured as something else. Refused at the door, one reader says what
every one of them sees, and the renderer's own bound never meets a line
below the floor (0043).

**Bound the ascender's share of the line too**, so a glyph cannot rise
past its line's top. A glyph's outline may reach past any line a header
states, which the walk does not judge, so a share bounds nothing an
outline cannot undo; the floor and the signs are what the renderer's
arithmetic needs.

**Admit a restricted font on a host's attestation**, recorded in the
manifest, the plan's option (b) for FT-Q14. A foundry that grants
embedding by contract usually ships a font that says so; fail closed.

**Walk format 4's segments as they come**, as glyphs.ts did. A walk and
fontkit's binary search find different glyphs in a subtable whose segments
overlap, and a walk of 32,767 overlapping segments of 65,536 code points is
two billion steps.

**Refuse a space in a PostScript name, and require every record to say
the same name.** The specification asks both. Microsoft Himalaya's Windows
record is `Microsoft Himalaya`, which PDFKit writes as a sound name, and
Corbel Light's records differ; both would have been refused, and neither
writes PDF syntax.
