# 0054 — A PDF is read by one reader of its own, which refuses what it cannot bound

- **Status:** accepted; numbered while 0053 was another branch's; extends [0007](0007-a-report-definition-is-its-own-versioned-document.md), whose format holds no PDF engine, so that a PDF is read beside it by a package of its own; and [0006](0006-dependencies-and-fonts-allow-public-source-and-licensed-production.md), whose guard now walks a PDF parser and pako in a published package's production dependencies, every package of their closure under licence metadata the policy allows and none an exception, the parser's stream decoders being ports of PDF.js's and XPDF's under Apache-2.0, which neither its dist nor its licence file says and the guard judges by the parser's MIT field alone
- **Date:** 2026-11-11
- **Deciders:** Daniel Bacher
- **Verified by:**
  - **The reader**, `packages/report-documents/src/`, on PDFs its test
    support writes byte by byte (`test-pdf.ts`, and `test-hostile.ts`,
    the parser spike's hostile files written again), never a file of a
    person's:
    - `parse.test.ts`: the strict loop. A file read under a classic table
      and under a cross-reference stream, predicted or not, the page a
      later revision wrote printed and not the first; an encrypted file
      refused as such, nothing decrypted; a file cut short at any point,
      junk or digits between objects, a cycle in the page tree, a `/Length`
      past the file or behind a chain of references, an object that is
      nothing but a reference, an earlier definition than the last one
      written, each refused; every bound the parse holds refused before
      the work it bounds; the last trailer the encryption check reads
      counted on the document's one count beside the loop's read of it;
      no reference a file holds reaching pdf-lib's
      `PDFRef.of`, a spy on it never called; and pdf-lib's `ByteStream`,
      which the reader takes from a protected field, pinned as the reader
      uses it.
    - `grammar.test.ts`: the reader's own readers of names, literal and
      hexadecimal strings, numbers and references; a name whose `#`
      escapes nothing, a string that does not end, a hexadecimal string
      with a character that is not a digit, a number that is not one, an
      object number past what a number holds exactly, each refused; a
      reference to a number no file can define naming nothing; each token
      at its bound read and one past it refused; the values bound, and the
      names' bytes bound read at it and refused one past it; each number
      read once and no pdf-lib number,
      array or dictionary made; a string a view of the file, each kind
      counted exactly twice.
    - `xref.test.ts`: object streams, hybrid files, an entry in use at
      offset 0 or past the end naming no object and anywhere else refused,
      an object an update frees; every way the cross-reference and the
      objects disagree; the entries and the sections bounded across every
      section, chained or not, before a row is read; members of an object
      stream that share an offset, go back or run into the next refused;
      and a member read from an earlier definition of its object stream
      than the chain names, refused as a shadow is.
    - `inflate.test.ts`: every stage of every stream from one budget,
      stopped the moment its output passes it; chunks sized to the input;
      the Adler-32 not compared; ASCIIHex, ASCII85 and RunLength refused
      before decoding where they could pass the budget; each decoder a
      stage builds counted where it is built; LZW, Crypt, a TIFF predictor
      and a stream whose data is in another file refused; and the two
      pako internals the reader relies on, pinned.
    - `page-tree.test.ts`, `pages.test.ts`: the tree walked once, each
      page's boxes, rotation, unit, resources and group, inherited in one
      pass, its content joined and charged; a rotation not a multiple of
      90, a box of no area and a document of no pages refused; optional
      content in the catalog refused.
    - `closure.test.ts`: every object the pages draw with, each container
      walked once for each way it is read, each walk after the first
      counted on the document's one count, and each image held once
      however many names reach it; a name map followed by where it stands
      and never by what it says of itself, its keys among them the ones
      that change how a value is read elsewhere; a layer, a resource that
      reaches a page, a form that stands in for another file's page
      (`/Ref`) and an image or a form that names one to print in its place
      (`/OPI`) refused.
    - `annotations.test.ts`, `notices.test.ts`: the print rule; a field
      with no appearance, a missing appearance state, a link border a
      viewer would draw, NoRotate on a turned page, XFA and
      NeedAppearances each refused, naming the page and the annotation by
      the reader's own count; each listing counted on the document's one
      count; what does not survive printing counted by code, never named.
    - `images.test.ts`, `inline-images.test.ts`, `inline-shared.test.ts`:
      an image held to its pixels by where it stands, never by its
      `/Subtype`, and passed on undecoded; a font file or a function that
      says it is an image decoded and charged as any stream is; an inline
      image ended only where PDF.js ends it, refused where a viewer could
      end it sooner, start it elsewhere or follow a reference in its
      dictionary; each content lexed once, linear in its bytes.
    - `limits.test.ts`: through `readDocument`, the pages, the bytes, the
      objects, what the streams inflate to, the depth and a hybrid file of
      `MAX_DOCUMENT_OBJECTS` objects, each read at its bound and refused one
      past it.
    - `read.test.ts`: the composition; a fault of the parser's, or of the
      reader's own after the pages are read, a refusal and never a throw;
      anything but a Uint8Array of the host's realm refused before a
      property of it is read; the result frozen, a deep copy of nothing
      the caller holds, and two reads of one file deep-equal; 2,000
      seeded splices of tokens and bytes into a PDF, every one read whole
      or refused; no name of a file reaching pdf-lib's `PDFName.of`, a spy
      on it seeing only the fixed names pdf-lib's own decoders look up;
      and UPNG, which pdf-lib imports, never called while a file is read,
      a `decode` that throws put on the object pdf-lib holds, which its
      own `embedPng` fails through.
    - `sniff.test.ts`: `isPdf`, a header at the first byte and nothing
      else.
  - **The PDF.js the reader mirrors.** `scripts/mirrored-pdfjs.test.mjs`,
    in `pnpm test:repo`, fails when the corpus or the Studio pins another
    `pdfjs-dist` than `MIRRORED_PDFJS`, the release whose ends of an
    inline image the reader's were copied from; it reads `inline-end.ts`,
    which imports nothing of pdf-lib's or pako's.
  - **The built declarations.** `scripts/documents-declarations.test.mjs`,
    in `pnpm test:repo`, which CI runs after `pnpm build`, fails when the
    package's `dist/index.d.mts` names any module.
  - **The licences.** `scripts/dependency-licences.mjs`, in `verify` and
    through its test in `pnpm test:repo`, walks the package's production
    dependencies with every other published package's
    ([0006](0006-dependencies-and-fonts-allow-public-source-and-licensed-production.md)).
  - **The packed package.** The install gate's
    `scripts/install-fixture/documents.ts` reads the PDF the packed
    renderer drew with the packed reader, its pages within the bound the
    package exports, and refuses the same bytes with one before the
    header, type-checked against the built `dist` with `skipLibCheck` off.
  - **Seen failing, 3 to 11 November 2026.** Each case was run before the
    code it holds, or with its guard broken in the working tree and put
    back, and failed for its own reason. On 11 November, the listings, the
    encryption check and the closure's walks again each taken off the one
    count failed their tests; so did an image held at every reach, `/Ref`
    and `/OPI` read, the names' bytes refused at their bound, a name map
    read by the keys that mean something elsewhere -- which the tests did
    not hold before `/HT` and `/SMask` were among its names -- a type of
    pdf-lib's exported, and `MIRRORED_PDFJS` moved. The guards of the
    parse, the pages, the closure, the annotations and the images were
    mutated one at
    a time, and every mutant failed a test but an equivalent one, an
    `isRef` type check, and two refusals that move the cursor forward,
    which would loop and were not mutated. On 11 November, the grammar
    made to hand each plain name to `PDFName.of` failed the names' spy,
    naming the file's names; the read made to hand pdf-lib's `PngEmbedder`
    the file's first bytes failed the UPNG guard, its mock called four
    times; and the mock put on a copy of UPNG's object rather than
    pdf-lib's failed the guard's control, the PNG embedded.
  - **Measured, not gated.** What each bound costs, written beside it in
    `limits.ts`, the acceptance sample and every time below are
    measurements of one machine on the days given: nothing fails when they
    change.

## Context

Report is to print the paper a report carries -- a delivery note beside an
invoice, the terms every quotation ends with, the signed PDFs a site
visit's inspector uploaded -- as pages of the report, counted in its page
numbers and proved on the PDF it produced
([0003](0003-a-rendered-report-is-proved-on-the-pdf-it-produced.md)).
Then a PDF is an input, and untrusted, as every input is, even one an
administrator approved. This record decides how a PDF is read. What names
one in a report, how the runtime resolves it and how the renderer draws its
pages are later records'; nothing calls the reader yet.

What must not happen, whatever else works:
- a page that shows something the author did not see, or loses something
  it showed -- a form's value dropped, a layer a print would show and a
  viewer hid;
- a PDF that hangs a render or exhausts it, instead of being refused;
- a second reader of PDFs that reads one otherwise than the first.

**The shape of the risk is
[0005](0005-pdfmake-renders-reports-behind-one-adapter.md)'s.** The PDF
library at hand, `@pdfme/pdf-lib`, which the corpus already reads a PDF's
objects with, decodes PNGs with UPNG 1.0.1, which never returns on
truncated pixel data: it blocks the thread, so no timer or signal can stop
it. A reader of untrusted bytes that runs synchronously, as report-spec's
`readFont` does so that the runtime reads every font before it hands a
report on
([0040](0040-a-font-is-read-by-report-specs-own-reader-which-says-what-it-may-be-embedded-as-and-which-characters-it-draws.md)),
cannot be stopped either. It has to end, and in a bounded heap, by its own
construction. UPNG is in the reader's own closure: pdf-lib imports it at
its top, so every host that installs the reader installs it. The reader
embeds no PNG and never calls it, which `read.test.ts` holds.

**What pdf-lib's own reading does, measured.** A spike read the hostile
files it wrote, one shape each, with pdf-lib 6.2.4's `PDFDocument.load` as
it stands, on 3 November 2026, each in a fresh worker with a 512 MB old
generation and a 30-second watchdog, under Node 22.23.3 on an Apple M2:
- **it hangs on junk:** after every object it tries an object header at
  every byte, an error thrown and caught each time, so 20 MiB of digits
  between two objects was stopped by the watchdog, and one MiB took 3.1 s;
- **it exhausts the heap:** on a cross-reference stream whose `/Index`
  claims two billion rows, which it trusts, on a name, a string or a number
  of 20 MiB, and on ten million empty arrays, each past 512 MB; one
  cross-reference stream aborted the measuring process itself, past the
  worker's limit;
- **it prints a shadow:** every object it finds is kept in file order,
  whatever the last cross-reference names, so a page written twice prints
  the definition the cross-reference does not name;
- **it forgives:** a file cut before `startxref` loads as whole, a
  `/Length` that lies is replaced by a search for `endstream`, and a cycle
  of `/Kids` or `/Parent` recurses until the stack runs out;
- **it is asynchronous:** the document parser awaits a timer every hundred
  objects, and its object-stream parser throws into a promise a synchronous
  caller never sees;
- **it keeps what a file names, for good:** every distinct name and
  reference it meets goes into a pool of the module's that nothing clears,
  about 28 bytes a character of a name;
- encryption is refused only after the whole parse.

## Decision

**A PDF is read by one reader, `@formancy/report-documents`, in a package
of its own beside report-spec, which keeps 0007's line and holds no PDF
engine.** Its `readDocument` reads a PDF's bytes whole -- its pages in
order, every object they draw with, and what it holds that does not
survive printing -- or refuses them. The runtime, the renderer, the server
and the builders are to read a PDF through it and through no other code.
The corpus proves the pages a report prints with PDF.js, which shares no
code with it.

**What it promises.**
- **Synchronous**, and no global of Node's or a browser's: ES2023's library
  and no `@types/node`, so a `node:` import, a `fetch` or a
  `DecompressionStream` does not compile. It reaches no network and no
  file system.
- **A neutral object model of its own** (`model.ts`): no type of pdf-lib's
  or pako's leaves the package, so neither a host nor another package meets
  one, and the parser can change behind it. The built declarations name no
  module, which `scripts/documents-declarations.test.mjs` holds. The
  model's type guards stay internal for now: the first package that walks
  the objects exports them from here rather than write its own.
- **Never a throw.** Anything thrown while it reads -- by pdf-lib's
  grammar, by pako, by a fault of the reader's own -- is a refusal in its
  own words.
- **A refusal names a place, never content.** It is one of
  `DOCUMENT_REFUSAL_CODES`, its message one of the reader's fixed findings
  then the code's advice, and where what was found belongs to a page or an
  annotation, the page and the annotation by the reader's own count, from
  1. No name, string, offset or object number the file wrote is ever in
  it; an annotation's subtype is said only where ISO 32000 defines it, in
  the reader's own spelling.
- **Its bytes are the host's, copied.** A Uint8Array of the host's own
  realm, copied before a byte is read, so a buffer reused or written by
  another thread changes nothing read. Anything else -- an ArrayBuffer, a
  DataView, a Proxy, an iframe's or a vm's array -- is refused as `not-pdf`
  before a property of it is read, and a host copies bytes of another realm
  into its own first.
- **What it returns is its own**, frozen where JavaScript freezes, every
  byte array a view of its own copy, shared with no other read.

**The parser, and what the reader reads itself.** pdf-lib 6.2.4's object
grammar, `PDFObjectParser`, driven by a strict loop of the reader's own
(`parse.ts`, `xref.ts`), with pako 3.0.2's streaming `Inflate`. pdf-lib's
`load`, its document parser and its object-stream parser are not used.
Every token but the keywords is the reader's to read, measured before it
is copied and refused past its bound (`grammar.ts`, `reading.ts`):
- **names** read and held flat, once a document, and never in pdf-lib's
  pool;
- **literal and hexadecimal strings** by readers of its own, as ISO
  32000-1 7.3.4.2 writes them, one that reads as written a view of the
  file;
- **numbers** read once, never as pdf-lib's `PDFNumber`, and never by
  pdf-lib's own reader, which writes the digits of a number past
  `MAX_SAFE_INTEGER` to `console.warn`, file content in a log, as the
  parse's reading of pdf-lib 6.2.4 found on 3 November 2026;
- **references** made by the reading, never by pdf-lib's `PDFRef.of`,
  whose pool keeps each one for the life of the process;
- **arrays and dictionaries** built in the neutral model as they are read,
  mirroring pdf-lib's loops, the last key written winning in its first
  place;
- **a cross-reference stream's rows** read by the reader. The spike chose
  pdf-lib's row reader, and the same reading found that it pools a
  reference a row, assembles a field with signed 32-bit shifts, and reads
  a row of a type past 2 as in use.

What pdf-lib still does is the grammar's dispatch on the next byte and its
keywords, its byte cursor, and its ports of PDF.js's ASCIIHex, ASCII85 and
RunLength decoders, with the `Stream` and `DecodeStream` they extend.
Flate is pako's, inflated raw after the zlib header the reader checks, its
Adler-32 not compared, as neither PDF.js nor pdf-lib compares it: twelve
of Apple's PDFs in the spike's sample carry checksums that do not match,
and were refused while pako compared them. The internals the reader
reaches into -- pdf-lib's `ByteStream` in a protected field, pako's
stream on `onStart`, what it leaves in `avail_in` and how `chunkSize` sizes
its output -- are pinned by tests, and both packages by exact versions.

**What it bounds, and how.** Every bound is a constant of `limits.ts`, each
checked before the work it bounds -- the bytes before one is parsed, a
cross-reference's claim before a row is read, a token's length before it is
copied, a stream's output chunk by chunk as it is inflated -- and written
beside how it was measured, at it and one past it, or why it was chosen:
- the bytes; the objects a file defines and a cross-reference may claim;
  the cross-reference entries every section claims together, chained or
  not, twice the objects and the free head of each list, so that a hybrid
  file, which lists every object twice, reads at the objects bound; the
  sections, counted as each is met;
- **one count of values a document**, `MAX_DOCUMENT_VALUES`: every number,
  name, array, dictionary, reference and keyword, its own and its inline
  images' dictionaries'; a name that is a value twice, as a value and as a
  name, and a string twice, for the view it is held in; the last trailer,
  or the cross-reference stream's dictionary, twice, as the encryption
  check reads it before the loop does; each decoder a stage of a stream
  builds, a pako inflater as `INFLATER_VALUES` and a fixed-ratio decoder
  as `DECODER_VALUES`, counted where it is built; each annotation a page
  lists, as `LISTING_VALUES`, every page together; and each entry of a
  container the closure walks again under another way of reading it, one
  value an entry. Nothing a document makes the reader do is on a count of
  its own beside this one, but what the bytes, the inflate budget, the
  objects, the cross-reference's entries and sections, the names' bytes
  and the pages bound;
- the distinct names' bytes together; the pages; what every stage of every
  stream decodes to, together, from one budget; nesting; a name's, a
  string's and a number's length;
- **an image's pixels**, `MAX_DOCUMENT_IMAGE_PIXELS`, its width times its
  height, which is what a viewer decodes it to: an image XObject is never
  decoded and never charged to the inflate budget, so a lossless scan is
  held to its size and not to what its data inflates to; a Flate inline
  image is inflated through that budget, its inflater counted, to find
  where its data ends, and passed on as written. Each image is held once,
  however many names reach it.

The criterion each bound was held to: every hostile file refused by a
stable code, or read within every bound, within a second and 256 MiB of
heap in Node, and the costliest within a second in Chromium too. A file
that reads within every bound is a document: a 20 MiB stream of zeros
reads, and would print as whatever it draws.

**What it refuses, each as the first thing found:**
- **not a PDF**, a header past other bytes among it; **too large**;
  **encrypted**, by a trailer's `/Encrypt`, the last trailer's read before
  anything else, so that an encrypted file is refused as that and not as a
  stream that does not inflate; **past a bound**, as above;
- **malformed**: cut short, bytes between or after its objects, a token
  past its bound, a `#` that escapes nothing, a hexadecimal string with a
  character that is not a digit, a number that is not one, a trailer
  without `/Size`, an object that is nothing but a reference, a stream
  whose length or data is wrong;
- **a shadowed revision**: a definition the cross-reference chain does not
  name for its number, through an object stream's container too, where a
  member is read from an earlier definition of its stream than the chain
  names; and wherever else the cross-reference and the objects disagree,
  a reference naming a generation the cross-reference does not give
  among them;
- **optional content**, which a viewer may hide and a print would show:
  `/OCProperties` in the catalog, `/OC` on anything a page draws with or
  on an annotation, and a layer's own dictionary, `/OCG` or `/OCMD`. A
  dictionary reached only as a name map, or under an ExtGState's `/HT`,
  is read as names, so an `/OC` there is a name, and it is copied without
  the layer check; nothing there is drawn;
- **a form a print of its fields cannot draw**: XFA, and
  `/NeedAppearances`;
- **an annotation that would print otherwise than a viewer shows it**: one
  over an area, printed, with no appearance or a state it does not hold; a
  link with no appearance whose border a viewer would draw; one that stays
  upright on a turned page;
- **an image held by where it stands**, an XObject, a mask, an alternate,
  never by its `/Subtype`, which a font file or a function may write; past
  its pixels, refused, and its data passed on undecoded;
- **an inline image whose end, or start, a viewer could read elsewhere**:
  its end taken only where PDF.js 6.4.299 takes it, by the same tests,
  copied from its worker, and refused where PDF.js could end it sooner;
  one glued to the byte before it or inside a dictionary, one whose
  dictionary holds a reference, and one whose filter the reader cannot
  delimit. `scripts/mirrored-pdfjs.test.mjs` holds that release to the one
  the corpus and the Studio pin. The cure is the renderer's: once it
  writes every inline image as an image XObject delimited by its length,
  a later record can lift this;
- **a filter the reader does not decode where it must**: LZW, though
  pdf-lib carries a port of PDF.js's, since the reader decodes only what it
  charges as it decodes -- Flate chunk by chunk, the fixed-ratio filters by
  their ratio first -- and LZW is neither; Crypt, which belongs to
  encryption; a TIFF predictor, where the reader undoes PNG's alone; an
  image's own filter, DCT, JPX, CCITTFax or JBIG2, anywhere but last on an
  image; and a name PDF does not define. No file of the spike's sample was
  refused for one;
- **a stream whose data is in another file**, before a byte of it is read,
  and **a form or an image that names another file to print in its
  place**: a reference XObject's `/Ref`, a form standing in for a page of
  another file that a printing product may print instead, and an `/OPI`
  dictionary, naming a file a prepress system prints in place of an image
  or a form. Report never fetches by address, and the PDF it prints must
  name no file to fetch;
- a page tree that is not a tree, or a tree of no pages; a rotation not a
  multiple of 90; a box of no area; a resource that reaches a page.

**What it reads that a stricter reader would refuse, because the sample
did:**
- **an entry in use at offset 0 or past the end** names no object, and is
  read as nothing: 265 entries in 150 files of the spike's sample were
  so, 136 of the files Apple's regulatory documents written by Quartz,
  which writes an unused number so; anywhere else, where a viewer might
  find an object the reader never saw, it is refused;
- **a reference to a whole number no file can define**, below 1 or past
  2^53, names nothing, as Apple's ENERGY STAR guide writes one in fifteen
  structure elements; a fraction, or a generation past 65,535, is still
  refused, since a reader that rounded it would name a real object.

**What does not survive printing is counted, never named.** Links,
JavaScript, other actions, attachments, form fields, signatures and
annotations the print rule does not draw are each a count of
`DOCUMENT_NOTICE_CODES` in the read: a script's name, a file's name or a
field's value may be a person's data.

## Consequences

**What it buys.**
- **A PDF ends, or is refused.** Every hostile file of the spike's, every
  shape `limits.ts` names and every bound at it and one past it was read or
  refused within a second and 256 MiB of heap in Node, the costliest
  within a second in Chromium too, on the machine measured and the builds
  `limits.ts` dates, where pdf-lib as it stands hung, exhausted its heap
  and once took its process with it. Each bound was measured alone, and
  the work they bound adds up, so files at several bounds at once were
  measured too, on 11 November 2026, on the build where nothing a
  document makes the reader do is on a count of its own and each decoder
  is charged what it costs: a thousand pages, content that inflates to
  the inflate bound and is lexed whole, and the values count at its bound
  exactly, spent on strings, listings, the closure's walks and the last
  trailer, the file 20 MiB, read in 676 ms with 97 MiB of heap; spent on
  the dearest decoders instead, in 502 ms; and on the strings that cost
  the most heap, in 442 ms with 190 MiB, the most of any file measured,
  three quarters of the 256 MiB; each refused one past its bound within
  663 ms. In Chromium the three read in 272 to 525 ms, and were refused
  one past in 253 to 486 ms. That was on mains power, where the same
  machine read the shapes it had read on battery 1.4 to 1.7 times faster.
  By that arithmetic, not measured, the decoders' file would take 0.70 to
  0.85 s on battery, inside the second; the first would take 0.95 to
  1.15 s, at the second or past it. 218 ms of its 676 is the comment that
  pads it to 20 MiB, which pdf-lib's grammar passes a byte at a time and
  which costs 42 ms in a file of nothing else.
- **What prints is what a viewer shows.** A shadowed revision, a layer, a
  field without an appearance and an inline image a viewer would end
  elsewhere are refused rather than printed otherwise than the author saw
  them.
- **One reading, everywhere.** A host's server, the runtime, the renderer
  and a builder will judge one PDF alike, and no type of a parser is any
  of theirs to depend on.
- **Nothing of the file in a log.** A refusal and a notice hold the
  reader's words and its own counts.

**What it costs.**
- **Real PDFs a viewer opens are refused, optional content the most.** The
  acceptance sample is 1,484 files that carry no person's data: every PDF
  under `/System/Library` and `/Library` of one Mac, the one in the four
  formancy repositories' `node_modules`, and 33 that Report's own renderer
  drew; never a personal folder, so it is narrower than a customer's
  files, its largest 1.27 MB. Read on the final build on 8 November 2026,
  1,367 read and 117 were refused: 116 for optional content and one whose
  `startxref` names no section, exactly the files the spike's loop refused
  on 3 November. Optional content is the large one: a file with layers is
  refused even where every layer would print, until a later record reads
  which layers a print shows. No file of the sample holds an inline image,
  so how many real files the inline rules refuse is not measured: binary
  data that happens to hold `EI` and a white-space byte is refused, and so
  is an inline image followed by an array, which PDF.js 6.4.299 itself
  misreads. Of data as random as compressed bytes, by arithmetic and not
  by any file, `E`, `I` and one of PDF's six white-space bytes stand at a
  byte with a chance of 6 in 2^24, about 0.15 % of 4,096-byte images and
  3.6 % of 100,000-byte ones. An old file compressed with LZW is refused,
  to be saved again; no file of the sample was.
- **A dense tagged report past about 700 pages is refused**, and is to be
  added in parts. `MAX_DOCUMENT_OBJECTS` stays at 100,000: a report shaped
  as the sample's densest tagged document, 138 structure elements a page,
  reads at 709 pages in 579 to 628 ms, and its 1,000 pages, 141,022
  objects, are refused in 358 to 362 ms, on 6 November, on builds before
  the last charges, which add about 17,000 values at 709 pages, far below
  the bound, and were not timed again. A raise would rest on an estimate
  at the edge of the second.
- **The second is this machine's.** The slowest shape at its bound alone,
  eight RunLength stages a stream, read in 808 ms in Node and 657 ms in
  Chromium on battery at the charge of 8, and, charged what each decoder
  costs, the dearest of the decoders' shapes in 205 ms and 139 ms on mains
  on 11 November; a legitimate 1,000-page tagged report in object streams
  in 658 ms and 455 ms on battery, 409 ms and 365 ms on mains. Each of those is the median of five cold runs, each in a fresh
  worker or browser context, under Node 22.23.3 and Chrome Headless Shell
  156 on an Apple M2 on battery, from 6 to 8 November 2026, under loads of
  2 to 10 while other work ran; and one earlier series of the tagged
  report, at a load of 7.5, spread from 713 to 1,208 ms. The laptop slept
  between wakes for much of it. Every run's times were read for a sleep
  found in its power log: runs a sleep reached were dropped, and one series
  was discarded whole; one series at 16 ran across sleeps and was kept, and
  whether the 24 series' Chromium half did is unknown, its log gone. By
  arithmetic, if a read's time scales with the machine, on one twice as
  slow those two shapes would take more than a second.
- **Each decoder is charged what it costs.** A pako inflater counts as
  `INFLATER_VALUES`, 79, and a fixed-ratio decoder as `DECODER_VALUES`,
  30: what each was measured to cost against a value on 11 November, the
  dearest of Node and Chromium rounded up -- an inline image's inflater,
  whose input runs to its content's end, at 78.1 values in Chromium, and
  ASCIIHex's decoder at 29.6 -- as a listing's `LISTING_VALUES` is. Until
  then they were 24 and 8, the smallest that kept those shapes within a
  second on battery, which left a file at several bounds at once within
  it on mains alone. A file of many short Flate streams or inline images
  is refused sooner than its values alone would refuse it: a thousand
  pages of one Flate content stream each count 79,000 for their
  inflaters, 55,000 more than before, and the sample's dearest file reads
  at 31,531 of the 2,000,000, from 18,147.
- **The heap is what was held; outside it is said beside it.** The 256 MiB
  is the heap's. What a read decodes is held outside it, as buffers, with
  the reader's own copy of the file, and measured beside it, not in it: up
  to 90 MiB for a file at several bounds at once, 20 MiB of it the copy,
  on 11 November, and 64 MiB at `MAX_DOCUMENT_INFLATED` alone, twice the
  bound, on 6 November.
- **What a read leaves behind is not measured.** The reader feeds pdf-lib's
  pools nothing of a file: no reference reaches `PDFRef.of`, and no name of
  a file reaches `PDFName.of`, only the fixed names pdf-lib's decoders look
  up, which spies hold (`parse.test.ts`, `read.test.ts`). What those pools
  keep was measured on the spike's loop, not on this reader, and whether
  anything else of a read is kept between reads was not measured here. A
  long-running server that reads untrusted PDFs is to read each in a
  worker it discards, which that server's record decides and measures.
- **The parser will be in every bundle that prints.** pdf-lib's grammar and
  model and pako added 234,035 bytes gzipped, 27 %, to the Studio's
  renderer chunk; that is the renderer spike's measurement of the parser
  spike's code, on 3 November, not of this package, and the bundler
  dropped little of pdf-lib. Once the runtime reads documents, the reader
  comes with it wherever the runtime is imported, a browser's preview
  among them.
- **The corpus's second reader shares its parser.** The corpus's
  `objects.ts` reads a PDF's own objects with the same pdf-lib, so a page
  the reader read is proved with PDF.js, which shares no code with it, and
  never with `objects.ts`: a rule review holds.
- **The byte bound is report-spec's by hand.** `MAX_DOCUMENT_BYTES` repeats
  `MAX_ASSET_BYTES`, 20 MiB, and the package depends on nothing that would
  let it import it. The test that holds the two equal belongs to a package
  that depends on both, and arrives with the format's record.
- **Its decoders' licence is said by nothing it ships.** The source map
  pdf-lib 6.2.4 publishes, read on 11 November 2026, gives each of its
  stream decoders a header: ASCIIHex, ASCII85, RunLength and LZW, and the
  `Stream` and `DecodeStream` they extend, are ports of PDF.js's,
  Copyright 2012 Mozilla Foundation, and Flate is XPDF's through PDF.js,
  its header both Copyright 1996-2003 Glyph & Cog and Copyright 2012
  Mozilla Foundation, each "made available under the Apache 2.0 open
  source license". The reader runs the first three and the two they
  extend; `decodePDFRawStream`, which it calls, holds the Flate and LZW
  ports too, which it never runs. `@pdfme/pdf-lib/dist/index.js` keeps
  none of those headers, and pdf-lib's `LICENSE.md` is MIT alone, so the
  licence guard judges them by pdf-lib's MIT field alone (0006), and
  `scripts/third-party-notices.mjs` would list pdf-lib under MIT alone.
  `pdfjs-dist` 6.4.299 ships no NOTICE, so as far as pdfjs-dist shows
  Apache-2.0's section 4(d) asks nothing; its section 4(a) asks that a
  copy of the licence go with a bundle that holds the reader, and its
  section 4(c) that the ports' attribution be kept. A built app's notices
  carry them only through an entry of
  `apps/studio/src/embedded-notices.ts` for
  `@pdfme/pdf-lib/dist/index.js`, and nothing fails without one. Nothing
  bundles the reader yet: the entry lands with the pull request that
  first does. Unchecked: whether PDF.js's
  own repository holds a NOTICE, which of these modules a bundler keeps,
  and whether pdf-lib's MIT label over ported files is sound, which is a
  lawyer's question.
- **Every release of the parser is a reading.** pdf-lib and pako are
  pinned exactly, and moving either means reading again the internals the
  tests pin and whatever changed in what the reader still calls; a fault
  in the grammar's dispatch, which is pdf-lib's, is found by the reader's
  tests or by nobody.

**What it forecloses.** Nothing that cannot be undone: nothing calls the
reader yet, and its contract names no type of the parser, so the parser can
change behind it.

## Alternatives considered

**PDF.js's parser.** It is the viewer whose reading the reader mirrors, and
its decoders are the ones pdf-lib ported. But its objects are not its API:
`pdfjs-dist` offers a document and its pages, through a worker and
promises, and a reader of its objects would reach past what it publishes.
And it is what the corpus proves the printed pages with: a reader built on
it would be proved by itself.

**pdf-lib's `load` as it stands.** It hangs on junk between objects, trusts
a cross-reference stream's `/Index` until the heap is gone, and prints a
shadowed revision, as the spike's files showed; it is asynchronous, and
keeps every name and reference a file holds for the life of the process.
Each of those is what the strict loop exists to refuse.

**`@cantoo/pdf-lib`, the other fork.** Not measured: the spike stopped at
the first candidate that met the criterion. It descends from the same
pdf-lib, so its `load` would need the same reading, and whether it shares
6.2.4's faults was not checked.

**A parser of our own.** The grammar is the smaller half of a reader: the
loop, the bounds, the pages, the closure and the print rule are the
reader's whichever grammar it drives. pdf-lib's met the criterion under the
strict loop when the spike chose it, with decoders ported from PDF.js. It
is also the alternative this record is likeliest to be undone for: the
reader has since replaced every token reader, both containers and the
cross-reference rows, and what it still takes of pdf-lib is the dispatch,
the byte cursor, and three decoders and the classes they extend, for a
dependency that costs every bundle that prints.
